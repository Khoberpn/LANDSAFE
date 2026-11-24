import { Router } from "express";
import {
  db,
  mitigationPlansTable,
  mitigationActionsTable,
  facilitiesTable,
  preparednessGuidelinesTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { parsePositiveInt } from "../lib/validation";
import { GetPublicMitigationPlanParams } from "@workspace/api-zod";

/**
 * Public portal endpoints. No authentication, and every response is an explicit
 * whitelist of public-safe fields: internal notes, occupancy figures, device
 * coordinates and unpublished plans never leave this router.
 */
const router = Router();

type PublicActionRow = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  responsibleAgency: string;
  startDate: Date | null;
  endDate: Date | null;
  progress: number;
  status: string;
};

function publicAction(row: PublicActionRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    responsibleAgency: row.responsibleAgency,
    startDate: row.startDate ? row.startDate.toISOString() : null,
    endDate: row.endDate ? row.endDate.toISOString() : null,
    progress: row.progress,
    status: row.status,
  };
}

router.get("/public/mitigation/overview", async (_req, res): Promise<void> => {
  const [planCounts] = await db
    .select({
      published: sql<number>`COUNT(CASE WHEN ${mitigationPlansTable.status} = 'published' THEN 1 END)`,
      regions: sql<number>`COUNT(DISTINCT CASE WHEN ${mitigationPlansTable.status} = 'published' THEN ${mitigationPlansTable.regionName} END)`,
      lastPublishedAt: sql<string | null>`MAX(CASE WHEN ${mitigationPlansTable.status} = 'published' THEN ${mitigationPlansTable.publishedAt} END)::text`,
    })
    .from(mitigationPlansTable);

  const [facilityCounts] = await db
    .select({
      shelters: sql<number>`COUNT(CASE WHEN ${facilitiesTable.type} = 'shelter' AND ${facilitiesTable.isPublic} THEN 1 END)`,
      capacity: sql<number>`COALESCE(SUM(CASE WHEN ${facilitiesTable.type} = 'shelter' AND ${facilitiesTable.isPublic} THEN ${facilitiesTable.capacity} ELSE 0 END), 0)`,
    })
    .from(facilitiesTable);

  const [guidelineCounts] = await db
    .select({ total: count() })
    .from(preparednessGuidelinesTable)
    .where(eq(preparednessGuidelinesTable.isPublic, true));

  const lastPublished = planCounts?.lastPublishedAt ? new Date(planCounts.lastPublishedAt).toISOString() : null;

  res.json({
    publishedPlans: Number(planCounts?.published ?? 0),
    regionsCovered: Number(planCounts?.regions ?? 0),
    shelters: Number(facilityCounts?.shelters ?? 0),
    totalShelterCapacity: Number(facilityCounts?.capacity ?? 0),
    guidelines: Number(guidelineCounts?.total ?? 0),
    lastPublishedAt: lastPublished,
  });
});

router.get("/public/mitigation/plans", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(mitigationPlansTable)
    .where(eq(mitigationPlansTable.status, "published"))
    .orderBy(desc(mitigationPlansTable.publishedAt));

  const stats = await db
    .select({
      planId: mitigationActionsTable.planId,
      total: count(),
      progress: sql<number>`COALESCE(AVG(${mitigationActionsTable.progress}), 0)`,
    })
    .from(mitigationActionsTable)
    .groupBy(mitigationActionsTable.planId);

  const statsByPlan = new Map(stats.map((row) => [row.planId, row]));

  res.json(rows.map((row) => ({
    id: row.id,
    title: row.title,
    regionName: row.regionName,
    province: row.province,
    hazardType: row.hazardType,
    publicSummary: row.publicSummary,
    leadAgency: row.leadAgency,
    budgetTotal: row.budgetTotal,
    timelineStart: row.timelineStart ? row.timelineStart.toISOString() : null,
    timelineEnd: row.timelineEnd ? row.timelineEnd.toISOString() : null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    version: row.version,
    actionCount: Number(statsByPlan.get(row.id)?.total ?? 0),
    progress: Math.round(Number(statsByPlan.get(row.id)?.progress ?? 0)),
  })));
});

router.get("/public/mitigation/plans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetPublicMitigationPlanParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [plan] = await db
    .select()
    .from(mitigationPlansTable)
    .where(and(eq(mitigationPlansTable.id, parsed.data.id), eq(mitigationPlansTable.status, "published")))
    .limit(1);

  if (!plan) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const actions = await db
    .select({
      id: mitigationActionsTable.id,
      title: mitigationActionsTable.title,
      description: mitigationActionsTable.description,
      category: mitigationActionsTable.category,
      responsibleAgency: mitigationActionsTable.responsibleAgency,
      startDate: mitigationActionsTable.startDate,
      endDate: mitigationActionsTable.endDate,
      progress: mitigationActionsTable.progress,
      status: mitigationActionsTable.status,
    })
    .from(mitigationActionsTable)
    .where(eq(mitigationActionsTable.planId, plan.id))
    .orderBy(asc(mitigationActionsTable.sortOrder));

  const averageProgress = actions.length > 0
    ? Math.round(actions.reduce((sum, action) => sum + action.progress, 0) / actions.length)
    : 0;

  res.json({
    id: plan.id,
    title: plan.title,
    regionName: plan.regionName,
    province: plan.province,
    hazardType: plan.hazardType,
    publicSummary: plan.publicSummary,
    leadAgency: plan.leadAgency,
    budgetTotal: plan.budgetTotal,
    timelineStart: plan.timelineStart ? plan.timelineStart.toISOString() : null,
    timelineEnd: plan.timelineEnd ? plan.timelineEnd.toISOString() : null,
    publishedAt: plan.publishedAt ? plan.publishedAt.toISOString() : null,
    version: plan.version,
    progress: averageProgress,
    actions: actions.map(publicAction),
  });
});

router.get("/public/evacuation", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(facilitiesTable)
    .where(and(eq(facilitiesTable.isPublic, true), ne(facilitiesTable.type, "command_post")))
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
    amenities: row.amenities,
    status: row.status,
    contact: row.contact,
    operatingAgency: row.operatingAgency,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  })));
});

router.get("/public/guidelines", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(preparednessGuidelinesTable)
    .where(eq(preparednessGuidelinesTable.isPublic, true))
    .orderBy(asc(preparednessGuidelinesTable.category), asc(preparednessGuidelinesTable.title));

  res.json(rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    audience: row.audience,
    summary: row.summary,
    steps: row.steps,
    source: row.source,
    sourceUrl: row.sourceUrl,
    updatedAt: row.updatedAt.toISOString(),
  })));
});

export default router;

