import { Router } from "express";
import {
  db,
  mitigationPlansTable,
  mitigationActionsTable,
  riskAssessmentsTable,
  facilitiesTable,
  resourcesTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { parsePositiveInt } from "../lib/validation";
import { recordAudit } from "../lib/audit";
import { PRIORITY_CRITERIA } from "../lib/risk-model";
import {
  CreateMitigationPlanBody,
  GetMitigationPlanParams,
  UpdateMitigationPlanBody,
  UpdateMitigationPlanParams,
  TransitionMitigationPlanBody,
  TransitionMitigationPlanParams,
  UpdateFacilityBody,
  UpdateFacilityParams,
  UpdateResourceBody,
  UpdateResourceParams,
} from "@workspace/api-zod";

const router = Router();

const HAZARD_TYPES = ["flood", "landslide", "earthquake", "volcanic", "tsunami", "drought", "strong_wind"] as const;

type PlanRow = typeof mitigationPlansTable.$inferSelect;
type ActionRow = typeof mitigationActionsTable.$inferSelect;

const INTERVENTIONS: Record<string, { title: string; category: string; rationale: string }[]> = {
  landslide: [
    { title: "Perkuatan lereng dan bioengineering", category: "structural", rationale: "Menurunkan pergerakan massa tanah pada lereng terjal." },
    { title: "Normalisasi saluran drainase lereng", category: "structural", rationale: "Mengurangi saturasi tanah yang menjadi pemicu longsor." },
    { title: "Sensor pergerakan tanah dan sirine komunitas", category: "early_warning", rationale: "Memperpendek waktu respons warga di lereng terpapar." },
  ],
  flood: [
    { title: "Kolam retensi dan normalisasi sungai", category: "structural", rationale: "Mengurangi volume genangan pada titik terendah." },
    { title: "Rehabilitasi rumah pompa dan drainase", category: "structural", rationale: "Mempercepat pembuangan air saat puncak banjir." },
    { title: "Tim siaga banjir tingkat kelurahan", category: "preparedness", rationale: "Memperkuat respons awal sebelum bantuan datang." },
  ],
  earthquake: [
    { title: "Retrofitting bangunan sekolah dan puskesmas", category: "structural", rationale: "Menurunkan risiko korban pada bangunan publik padat." },
    { title: "Penetapan dan verifikasi titik kumpul", category: "non_structural", rationale: "Memastikan warga tahu lokasi aman terdekat." },
    { title: "Simulasi evakuasi berkala", category: "preparedness", rationale: "Meningkatkan kecepatan evakuasi saat guncangan." },
  ],
  volcanic: [
    { title: "Rehabilitasi jalur evakuasi sektor rawan", category: "structural", rationale: "Menjamin akses keluar saat erupsi." },
    { title: "Stok logistik pengungsian 72 jam", category: "preparedness", rationale: "Menutup kebutuhan dasar pada fase tanggap darurat." },
    { title: "Pemantauan status aktivitas dan diseminasi", category: "early_warning", rationale: "Menjaga informasi radius aman tetap mutakhir." },
  ],
  tsunami: [
    { title: "Jalur evakuasi vertikal dan rambu resmi", category: "structural", rationale: "Menyediakan opsi evakuasi cepat di kawasan pesisir padat." },
    { title: "Sirine peringatan dini pesisir", category: "early_warning", rationale: "Memberi jeda waktu evakuasi yang menentukan." },
    { title: "Latihan evakuasi komunitas pesisir", category: "preparedness", rationale: "Memastikan warga mengenali tanda dan rute evakuasi." },
  ],
  drought: [
    { title: "Penampungan air hujan dan sumur resapan", category: "structural", rationale: "Menambah cadangan air pada musim kering." },
    { title: "Buffer stok air bersih kecamatan", category: "preparedness", rationale: "Menjamin pasokan dasar saat kekeringan panjang." },
    { title: "Kalender tanam adaptif dan diversifikasi", category: "non_structural", rationale: "Mengurangi kerugian pertanian akibat gagal panen." },
  ],
  strong_wind: [
    { title: "Penataan pohon dan penguatan atap bangunan", category: "structural", rationale: "Mengurangi kerusakan akibat angin kencang." },
    { title: "Sosialisasi konstruksi tahan angin", category: "non_structural", rationale: "Meningkatkan ketahanan bangunan warga." },
    { title: "Pembersihan rutin saluran dan puing", category: "preparedness", rationale: "Mengurangi material yang diterbangkan angin." },
  ],
};

function priorityFor(score: number): "immediate" | "high" | "planned" | "monitor" {
  if (score >= 75) return "immediate";
  if (score >= 55) return "high";
  if (score >= 35) return "planned";
  return "monitor";
}

function serializeAction(row: ActionRow) {
  return {
    id: row.id,
    planId: row.planId,
    title: row.title,
    description: row.description,
    category: row.category,
    responsibleAgency: row.responsibleAgency,
    startDate: row.startDate ? row.startDate.toISOString() : null,
    endDate: row.endDate ? row.endDate.toISOString() : null,
    budget: row.budget,
    progress: row.progress,
    status: row.status,
    priorityScore: row.priorityScore,
    criteria: row.criteria,
  };
}

type ActionStats = { total: number; completed: number; progress: number };

function serializePlan(row: PlanRow, stats: ActionStats | undefined) {
  return {
    id: row.id,
    title: row.title,
    regionName: row.regionName,
    province: row.province,
    hazardType: row.hazardType,
    assessmentId: row.assessmentId,
    status: row.status,
    publicSummary: row.publicSummary,
    leadAgency: row.leadAgency,
    budgetTotal: row.budgetTotal,
    timelineStart: row.timelineStart ? row.timelineStart.toISOString() : null,
    timelineEnd: row.timelineEnd ? row.timelineEnd.toISOString() : null,
    version: row.version,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    actionCount: stats?.total ?? 0,
    completedActions: stats?.completed ?? 0,
    progress: Math.round(stats?.progress ?? 0),
  };
}

async function actionStatsByPlan(): Promise<Map<number, ActionStats>> {
  const rows = await db
    .select({
      planId: mitigationActionsTable.planId,
      total: count(),
      completed: sql<number>`COUNT(CASE WHEN ${mitigationActionsTable.status} = 'completed' THEN 1 END)`,
      progress: sql<number>`COALESCE(AVG(${mitigationActionsTable.progress}), 0)`,
    })
    .from(mitigationActionsTable)
    .groupBy(mitigationActionsTable.planId);

  return new Map(
    rows.map((row) => [
      row.planId,
      { total: Number(row.total), completed: Number(row.completed), progress: Number(row.progress) },
    ]),
  );
}

async function planDetail(planId: number) {
  const [plan] = await db.select().from(mitigationPlansTable).where(eq(mitigationPlansTable.id, planId)).limit(1);
  if (!plan) return null;

  const actions = await db
    .select()
    .from(mitigationActionsTable)
    .where(eq(mitigationActionsTable.planId, planId))
    .orderBy(asc(mitigationActionsTable.sortOrder));

  let riskScore: number | null = null;
  if (plan.assessmentId) {
    const [assessment] = await db
      .select({ riskScore: riskAssessmentsTable.riskScore })
      .from(riskAssessmentsTable)
      .where(eq(riskAssessmentsTable.id, plan.assessmentId))
      .limit(1);
    riskScore = assessment ? assessment.riskScore : null;
  }

  return {
    id: plan.id,
    title: plan.title,
    regionName: plan.regionName,
    province: plan.province,
    hazardType: plan.hazardType,
    assessmentId: plan.assessmentId,
    status: plan.status,
    publicSummary: plan.publicSummary,
    internalNotes: plan.internalNotes,
    leadAgency: plan.leadAgency,
    budgetTotal: plan.budgetTotal,
    timelineStart: plan.timelineStart ? plan.timelineStart.toISOString() : null,
    timelineEnd: plan.timelineEnd ? plan.timelineEnd.toISOString() : null,
    version: plan.version,
    createdBy: plan.createdBy,
    reviewedAt: plan.reviewedAt ? plan.reviewedAt.toISOString() : null,
    approvedAt: plan.approvedAt ? plan.approvedAt.toISOString() : null,
    publishedAt: plan.publishedAt ? plan.publishedAt.toISOString() : null,
    updatedAt: plan.updatedAt.toISOString(),
    riskScore,
    actions: actions.map(serializeAction),
  };
}

router.get("/mitigation/recommendations", authenticate, requireRole("operator", "admin"), async (_req, res): Promise<void> => {
  const assessments = await db
    .select()
    .from(riskAssessmentsTable)
    .orderBy(desc(riskAssessmentsTable.riskScore));
  const plans = await db
    .select({
      id: mitigationPlansTable.id,
      status: mitigationPlansTable.status,
      assessmentId: mitigationPlansTable.assessmentId,
      regionName: mitigationPlansTable.regionName,
      hazardType: mitigationPlansTable.hazardType,
    })
    .from(mitigationPlansTable);

  const planFor = (assessmentId: number, regionName: string, hazardType: string) =>
    plans.find((plan) => plan.assessmentId === assessmentId) ??
    plans.find((plan) => plan.regionName === regionName && plan.hazardType === hazardType);

  res.json(
    assessments.map((assessment) => {
      const plan = planFor(assessment.id, assessment.regionName, assessment.hazardType);
      const priority = priorityFor(assessment.riskScore);
      const interventions = INTERVENTIONS[assessment.hazardType] ?? [];
      const rationale = assessment.verified
        ? `Penilaian terverifikasi dengan skor risiko ${assessment.riskScore} (${assessment.riskClass}). ${assessment.exposedPopulation.toLocaleString("id-ID")} penduduk berada pada area terpapar.`
        : `Belum diverifikasi — skor risiko ${assessment.riskScore} (${assessment.riskClass}) bersifat sementara dan perlu verifikasi sebelum dijadikan dasar anggaran.`;

      return {
        assessmentId: assessment.id,
        regionName: assessment.regionName,
        province: assessment.province,
        hazardType: assessment.hazardType,
        riskScore: assessment.riskScore,
        riskClass: assessment.riskClass,
        priority,
        rationale,
        requiresVerification: !assessment.verified,
        existingPlanId: plan ? plan.id : null,
        existingPlanStatus: plan ? plan.status : null,
        suggestedInterventions: interventions,
      };
    }),
  );
});

router.get("/mitigation/plans", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const allowed = ["draft", "review", "approved", "published", "archived"];
  if (status && !allowed.includes(status)) {
    res.status(400).json({ error: "Unknown plan status" });
    return;
  }
  const where = status ? eq(mitigationPlansTable.status, status as PlanRow["status"]) : undefined;
  const rows = await db
    .select()
    .from(mitigationPlansTable)
    .where(where)
    .orderBy(desc(mitigationPlansTable.updatedAt));
  const stats = await actionStatsByPlan();
  res.json(rows.map((row) => serializePlan(row, stats.get(row.id))));
});


router.post("/mitigation/plans", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateMitigationPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!HAZARD_TYPES.includes(parsed.data.hazardType as (typeof HAZARD_TYPES)[number])) {
    res.status(400).json({ error: "Unknown hazard type" });
    return;
  }

  const toDate = (value: string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  };

  const [created] = await db
    .insert(mitigationPlansTable)
    .values({
      title: parsed.data.title,
      regionName: parsed.data.regionName,
      province: parsed.data.province ?? "Central Java",
      hazardType: parsed.data.hazardType as (typeof HAZARD_TYPES)[number],
      assessmentId: parsed.data.assessmentId ?? null,
      status: "draft",
      publicSummary: parsed.data.publicSummary ?? null,
      internalNotes: parsed.data.internalNotes ?? null,
      leadAgency: parsed.data.leadAgency,
      budgetTotal: parsed.data.budgetTotal ?? 0,
      timelineStart: toDate(parsed.data.timelineStart),
      timelineEnd: toDate(parsed.data.timelineEnd),
      createdBy: req.user!.userId,
    })
    .returning();

  await recordAudit(req, "mitigation.plan.create", "mitigation_plan", created!.id, {
    title: created!.title,
    regionName: created!.regionName,
    hazardType: created!.hazardType,
  });

  const detail = await planDetail(created!.id);
  res.status(201).json(detail);
});

router.get("/mitigation/plans/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetMitigationPlanParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const detail = await planDetail(parsed.data.id);
  if (!detail) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(detail);
});

router.patch("/mitigation/plans/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramParsed = UpdateMitigationPlanParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const bodyParsed = UpdateMitigationPlanBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(mitigationPlansTable)
    .where(eq(mitigationPlansTable.id, paramParsed.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (existing.status !== "draft" && existing.status !== "review") {
    res.status(409).json({
      error: "Plan is locked. Return it to draft status before editing approved or published content.",
    });
    return;
  }

  const toDate = (value: string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  };

  const updates: Partial<typeof mitigationPlansTable.$inferInsert> = {};
  if (bodyParsed.data.title !== undefined) updates.title = bodyParsed.data.title;
  if (bodyParsed.data.publicSummary !== undefined) updates.publicSummary = bodyParsed.data.publicSummary;
  if (bodyParsed.data.internalNotes !== undefined) updates.internalNotes = bodyParsed.data.internalNotes;
  if (bodyParsed.data.leadAgency !== undefined) updates.leadAgency = bodyParsed.data.leadAgency;
  if (bodyParsed.data.budgetTotal !== undefined) updates.budgetTotal = bodyParsed.data.budgetTotal;
  if (bodyParsed.data.timelineStart !== undefined) updates.timelineStart = toDate(bodyParsed.data.timelineStart);
  if (bodyParsed.data.timelineEnd !== undefined) updates.timelineEnd = toDate(bodyParsed.data.timelineEnd);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No supported fields supplied" });
    return;
  }

  await db.update(mitigationPlansTable).set(updates).where(eq(mitigationPlansTable.id, existing.id));
  await recordAudit(req, "mitigation.plan.update", "mitigation_plan", existing.id, {
    fields: Object.keys(updates),
  });

  res.json(await planDetail(existing.id));
});


type TransitionAction = "submit_review" | "approve" | "publish" | "return_draft" | "archive";

const TRANSITIONS: Record<
  TransitionAction,
  { from: PlanRow["status"][]; to: PlanRow["status"]; roles: ("operator" | "admin")[]; label: string; audit: string }
> = {
  submit_review: {
    from: ["draft"],
    to: "review",
    roles: ["operator", "admin"],
    label: "Pengajuan tinjauan",
    audit: "mitigation.plan.submit_review",
  },
  approve: {
    from: ["review"],
    to: "approved",
    roles: ["admin"],
    label: "Persetujuan",
    audit: "mitigation.plan.approve",
  },
  publish: {
    from: ["approved"],
    to: "published",
    roles: ["admin"],
    label: "Publikasi",
    audit: "mitigation.plan.publish",
  },
  return_draft: {
    from: ["review", "approved"],
    to: "draft",
    roles: ["admin"],
    label: "Pengembalian ke draf",
    audit: "mitigation.plan.return_draft",
  },
  archive: {
    from: ["published", "approved"],
    to: "archived",
    roles: ["admin"],
    label: "Pengarsipan",
    audit: "mitigation.plan.archive",
  },
};

router.post(
  "/mitigation/plans/:id/transition",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const paramParsed = TransitionMitigationPlanParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
    if (!paramParsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const bodyParsed = TransitionMitigationPlanBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.message });
      return;
    }

    const action = bodyParsed.data.action as TransitionAction;
    const rule = TRANSITIONS[action];
    if (!rule) {
      res.status(400).json({ error: "Unknown transition" });
      return;
    }
    if (!rule.roles.includes(req.user!.role as "operator" | "admin")) {
      res.status(403).json({ error: `Only ${rule.roles.join("/")} may perform ${action}` });
      return;
    }

    const [existing] = await db
      .select()
      .from(mitigationPlansTable)
      .where(eq(mitigationPlansTable.id, paramParsed.data.id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!rule.from.includes(existing.status)) {
      res.status(400).json({ error: `Cannot ${action} a plan in "${existing.status}" status` });
      return;
    }

    const now = new Date();
    const updates: Partial<typeof mitigationPlansTable.$inferInsert> = { status: rule.to };
    if (action === "submit_review") {
      updates.reviewedBy = req.user!.userId;
      updates.reviewedAt = now;
    }
    if (action === "approve") {
      updates.approvedBy = req.user!.userId;
      updates.approvedAt = now;
    }
    if (action === "publish") {
      updates.publishedAt = now;
      updates.version = existing.version + 1;
    }
    if (action === "return_draft") {
      updates.reviewedBy = null;
      updates.reviewedAt = null;
      updates.approvedBy = null;
      updates.approvedAt = null;
    }
    if (action === "archive") {
      updates.publishedAt = existing.publishedAt;
    }

    await db.update(mitigationPlansTable).set(updates).where(eq(mitigationPlansTable.id, existing.id));
    await recordAudit(req, rule.audit, "mitigation_plan", existing.id, {
      title: existing.title,
      from: existing.status,
      to: rule.to,
      note: bodyParsed.data.note ?? null,
    });

    res.json(await planDetail(existing.id));
  },
);


router.get("/mitigation/facilities", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const allowed = ["shelter", "assembly_point", "hospital", "health_center", "command_post", "evacuation_route"];
  if (type && !allowed.includes(type)) {
    res.status(400).json({ error: "Unknown facility type" });
    return;
  }
  const rows = await db
    .select()
    .from(facilitiesTable)
    .where(type ? eq(facilitiesTable.type, type as (typeof facilitiesTable.type.enumValues)[number]) : undefined)
    .orderBy(asc(facilitiesTable.type), asc(facilitiesTable.name));

  res.json(rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    regionName: row.regionName,
    province: row.province,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    capacity: row.capacity,
    occupancy: row.occupancy,
    amenities: row.amenities,
    status: row.status,
    isPublic: row.isPublic,
    contact: row.contact,
    operatingAgency: row.operatingAgency,
    notes: row.notes,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  })));
});

router.patch("/mitigation/facilities/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramParsed = UpdateFacilityParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const bodyParsed = UpdateFacilityBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(facilitiesTable)
    .where(eq(facilitiesTable.id, paramParsed.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const updates: Partial<typeof facilitiesTable.$inferInsert> = {};
  if (bodyParsed.data.status !== undefined) {
    if (!["operational", "limited", "full", "closed"].includes(bodyParsed.data.status)) {
      res.status(400).json({ error: "Unknown facility status" });
      return;
    }
    updates.status = bodyParsed.data.status as typeof existing.status;
  }
  if (bodyParsed.data.occupancy !== undefined) {
    if (bodyParsed.data.occupancy < 0) {
      res.status(400).json({ error: "Occupancy cannot be negative" });
      return;
    }
    if (existing.capacity > 0 && bodyParsed.data.occupancy > existing.capacity) {
      res.status(400).json({ error: `Occupancy cannot exceed capacity (${existing.capacity})` });
      return;
    }
    updates.occupancy = bodyParsed.data.occupancy;
  }
  if (bodyParsed.data.notes !== undefined) updates.notes = bodyParsed.data.notes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No supported fields supplied" });
    return;
  }

  const [updated] = await db
    .update(facilitiesTable)
    .set(updates)
    .where(eq(facilitiesTable.id, existing.id))
    .returning();

  await recordAudit(req, "facility.update", "facility", existing.id, {
    name: existing.name,
    changes: updates,
  });

  res.json({
    id: updated!.id,
    name: updated!.name,
    type: updated!.type,
    regionName: updated!.regionName,
    province: updated!.province,
    address: updated!.address,
    latitude: updated!.latitude,
    longitude: updated!.longitude,
    capacity: updated!.capacity,
    occupancy: updated!.occupancy,
    amenities: updated!.amenities,
    status: updated!.status,
    isPublic: updated!.isPublic,
    contact: updated!.contact,
    operatingAgency: updated!.operatingAgency,
    notes: updated!.notes,
    verifiedAt: updated!.verifiedAt ? updated!.verifiedAt.toISOString() : null,
  });
});


router.get("/mitigation/resources", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const region = typeof req.query.region === "string" ? req.query.region : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;

  const filters = [
    region ? ilike(resourcesTable.regionName, `%${region}%`) : undefined,
    category ? eq(resourcesTable.category, category) : undefined,
  ].filter((filter) => filter !== undefined);

  const rows = await db
    .select({
      id: resourcesTable.id,
      itemName: resourcesTable.itemName,
      category: resourcesTable.category,
      quantity: resourcesTable.quantity,
      unit: resourcesTable.unit,
      regionName: resourcesTable.regionName,
      facilityId: resourcesTable.facilityId,
      facilityName: facilitiesTable.name,
      condition: resourcesTable.condition,
      allocationStatus: resourcesTable.allocationStatus,
      notes: resourcesTable.notes,
      lastUpdated: resourcesTable.lastUpdated,
    })
    .from(resourcesTable)
    .leftJoin(facilitiesTable, eq(resourcesTable.facilityId, facilitiesTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(resourcesTable.category), asc(resourcesTable.itemName));

  res.json(rows.map((row) => ({ ...row, lastUpdated: row.lastUpdated.toISOString() })));
});

router.patch("/mitigation/resources/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramParsed = UpdateResourceParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!paramParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const bodyParsed = UpdateResourceBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(resourcesTable)
    .where(eq(resourcesTable.id, paramParsed.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const updates: Partial<typeof resourcesTable.$inferInsert> = {};
  if (bodyParsed.data.quantity !== undefined) {
    if (bodyParsed.data.quantity < 0) {
      res.status(400).json({ error: "Quantity cannot be negative" });
      return;
    }
    updates.quantity = bodyParsed.data.quantity;
  }
  if (bodyParsed.data.condition !== undefined) {
    if (!["good", "fair", "damaged"].includes(bodyParsed.data.condition)) {
      res.status(400).json({ error: "Unknown condition" });
      return;
    }
    updates.condition = bodyParsed.data.condition;
  }
  if (bodyParsed.data.allocationStatus !== undefined) {
    if (!["available", "allocated", "maintenance", "depleted"].includes(bodyParsed.data.allocationStatus)) {
      res.status(400).json({ error: "Unknown allocation status" });
      return;
    }
    updates.allocationStatus = bodyParsed.data.allocationStatus;
  }
  if (bodyParsed.data.notes !== undefined) updates.notes = bodyParsed.data.notes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No supported fields supplied" });
    return;
  }

  updates.updatedBy = req.user!.userId;
  updates.lastUpdated = new Date();

  const [updated] = await db
    .update(resourcesTable)
    .set(updates)
    .where(eq(resourcesTable.id, existing.id))
    .returning();

  await recordAudit(req, "resource.update", "resource", existing.id, {
    itemName: existing.itemName,
    changes: { quantity: updates.quantity, condition: updates.condition, allocationStatus: updates.allocationStatus },
  });

  res.json({
    id: updated!.id,
    itemName: updated!.itemName,
    category: updated!.category,
    quantity: updated!.quantity,
    unit: updated!.unit,
    regionName: updated!.regionName,
    facilityId: updated!.facilityId,
    facilityName: null,
    condition: updated!.condition,
    allocationStatus: updated!.allocationStatus,
    notes: updated!.notes,
    lastUpdated: updated!.lastUpdated.toISOString(),
  });
});

export default router;

