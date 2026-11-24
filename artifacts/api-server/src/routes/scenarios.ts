import { Router } from "express";
import { db, scenariosTable, riskAssessmentsTable } from "@workspace/db";
import { desc, eq, inArray } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { parsePositiveInt } from "../lib/validation";
import { recordAudit } from "../lib/audit";
import {
  computeScenarioImpact,
  type ScenarioParameters,
  type ScenarioResults,
} from "../lib/risk-model";
import {
  CreateScenarioBody,
  CompareScenariosBody,
  GetScenarioParams,
  DeleteScenarioParams,
  GetScenarioReportParams,
} from "@workspace/api-zod";

const router = Router();

type ScenarioRow = typeof scenariosTable.$inferSelect;

function serializeScenario(row: ScenarioRow) {
  return {
    id: row.id,
    name: row.name,
    hazardType: row.hazardType,
    assessmentId: row.assessmentId,
    regionName: row.regionName,
    parameters: row.parameters as unknown as ScenarioParameters,
    results: row.results as unknown as ScenarioResults,
    status: row.status,
    notes: row.notes,
    isSimulation: true,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/scenarios", authenticate, requireRole("operator", "admin"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(scenariosTable).orderBy(desc(scenariosTable.createdAt));
  res.json(rows.map(serializeScenario));
});

router.post("/scenarios", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateScenarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [assessment] = await db
    .select()
    .from(riskAssessmentsTable)
    .where(eq(riskAssessmentsTable.id, parsed.data.assessmentId))
    .limit(1);

  if (!assessment) {
    res.status(400).json({ error: "Assessment not found" });
    return;
  }

  const parameters = parsed.data.parameters as ScenarioParameters;
  const results = computeScenarioImpact(
    {
      hazardType: assessment.hazardType,
      population: assessment.population,
      exposedPopulation: assessment.exposedPopulation,
      exposedFacilities: assessment.exposedFacilities,
      exposedRoadsKm: assessment.exposedRoadsKm,
      vulnerabilityIndex: assessment.vulnerabilityIndex,
    },
    parameters,
  );

  const [created] = await db
    .insert(scenariosTable)
    .values({
      name: parsed.data.name,
      hazardType: assessment.hazardType,
      assessmentId: assessment.id,
      regionName: assessment.regionName,
      parameters: parameters as unknown as Record<string, unknown>,
      results: results as unknown as Record<string, unknown>,
      status: "completed",
      notes: parsed.data.notes ?? null,
      createdBy: req.user!.userId,
    })
    .returning();

  await recordAudit(req, "scenario.create", "scenario", created!.id, {
    name: created!.name,
    regionName: created!.regionName,
    hazardType: created!.hazardType,
    intensity: parameters.intensity,
  });

  res.status(201).json(serializeScenario(created!));
});

router.get("/scenarios/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetScenarioParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [row] = await db.select().from(scenariosTable).where(eq(scenariosTable.id, parsed.data.id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(serializeScenario(row));
});

router.delete("/scenarios/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeleteScenarioParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [deleted] = await db
    .delete(scenariosTable)
    .where(eq(scenariosTable.id, parsed.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await recordAudit(req, "scenario.delete", "scenario", deleted.id, { name: deleted.name });
  res.status(204).send();
});

router.post("/scenarios/compare", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const parsed = CompareScenariosBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ids = [...new Set(parsed.data.scenarioIds)] as number[];
  if (ids.length < 2 || ids.length > 4) {
    res.status(400).json({ error: "Select between 2 and 4 scenarios to compare" });
    return;
  }

  const rows = await db.select().from(scenariosTable).where(inArray(scenariosTable.id, ids));
  if (rows.length !== ids.length) {
    res.status(400).json({ error: "One or more scenarios were not found" });
    return;
  }
  const ordered = ids
    .map((id) => rows.find((row) => row.id === id))
    .filter((row): row is ScenarioRow => Boolean(row));

  const scenarios = ordered.map(serializeScenario);
  const metricDefinitions: {
    key: string;
    label: string;
    unit: string;
    higherIsWorse: boolean;
    pick: (results: ScenarioResults) => number;
  }[] = [
    { key: "affectedPopulation", label: "Populasi terdampak", unit: "orang", higherIsWorse: true, pick: (r) => r.affectedPopulation },
    { key: "displacedPopulation", label: "Pengungsi", unit: "orang", higherIsWorse: true, pick: (r) => r.displacedPopulation },
    { key: "affectedFacilities", label: "Fasilitas terdampak", unit: "fasilitas", higherIsWorse: true, pick: (r) => r.affectedFacilities },
    { key: "affectedRoadsKm", label: "Jalan terdampak", unit: "km", higherIsWorse: true, pick: (r) => r.affectedRoadsKm },
    { key: "economicLossIdrBillion", label: "Estimasi kerugian", unit: "miliar Rp", higherIsWorse: true, pick: (r) => r.economicLossIdrBillion },
    { key: "medicalNeeds", label: "Kebutuhan layanan medis", unit: "orang", higherIsWorse: true, pick: (r) => r.medicalNeeds },
  ];

  const metrics = metricDefinitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    unit: definition.unit,
    higherIsWorse: definition.higherIsWorse,
    values: scenarios.map((scenario) => ({
      scenarioId: scenario.id,
      name: scenario.name,
      regionName: scenario.regionName,
      value: definition.pick(scenario.results),
    })),
  }));

  res.json({ scenarios, metrics });
});

router.get("/scenarios/:id/report", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetScenarioReportParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [row] = await db.select().from(scenariosTable).where(eq(scenariosTable.id, parsed.data.id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const params = row.parameters as unknown as ScenarioParameters;
  const results = row.results as unknown as ScenarioResults;
  const nf = new Intl.NumberFormat("id-ID");
  const line = "=".repeat(72);
  const lines = [
    "LANDSAFE — LAPORAN ANALISIS SKENARIO",
    line,
    "PERINGATAN PENTING",
    "Dokumen ini memuat hasil SIMULASI skenario hipotetis untuk perencanaan.",
    "Ini BUKAN prediksi kejadian, bukan peringatan dini, dan tidak menunjukkan",
    "adanya ancaman yang sedang berlangsung.",
    line,
    `Nama skenario      : ${row.name}`,
    `ID skenario        : ${row.id}`,
    `Wilayah            : ${row.regionName}`,
    `Jenis ancaman      : ${row.hazardType}`,
    `Dibuat             : ${row.createdAt.toISOString()}`,
    "",
    "PARAMETER SIMULASI",
    line,
    `Intensitas (0-100) : ${params.intensity}`,
    `Durasi (jam)       : ${params.durationHours}`,
    `Curah hujan (mm)   : ${params.rainfallMm}`,
    `Musim              : ${params.season}`,
    `Waktu kejadian     : ${params.timeOfDay}`,
    `Jeda peringatan    : ${params.warningLeadTimeHours} jam`,
    "",
    "ESTIMASI DAMPAK",
    line,
    `Populasi terdampak : ${nf.format(results.affectedPopulation)} orang`,
    `Kelompok rentan    : ${nf.format(results.affectedVulnerableGroups)} orang`,
    `Pengungsi          : ${nf.format(results.displacedPopulation)} orang`,
    `Kebutuhan medis    : ${nf.format(results.medicalNeeds)} orang`,
    `Fasilitas terdampak: ${nf.format(results.affectedFacilities)}`,
    `Jalan terdampak    : ${nf.format(results.affectedRoadsKm)} km`,
    `Estimasi kerugian  : Rp ${nf.format(results.economicLossIdrBillion)} miliar`,
    `Tingkat dampak     : ${results.impactLevel}`,
    "",
    "DAMPAK SEKTORAL",
    line,
    ...results.sectorImpacts.map((sector) => `- ${sector.sector}: ${sector.impact}/100 — ${sector.note}`),
    "",
    "KEBUTUHAN BANTUAN (INDIKATIF)",
    line,
    ...results.reliefNeeds.map((need) => `- ${need.category}: ${nf.format(need.quantity)} ${need.unit}`),
    "",
    "FASE RESPONS",
    line,
    ...results.responsePhases.map((phase) => `- ${phase.phase} (${phase.window}): ${phase.focus}`),
    "",
    "CATATAN METODOLOGI",
    line,
    ...results.modelNotes.map((note) => `- ${note}`),
    "",
    `Dihasilkan oleh LANDSAFE pada ${new Date().toISOString()}.`,
    "Angka bersifat indikatif dan harus diverifikasi oleh analis BPBD sebelum digunakan.",
    "",
  ];

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="landsafe-skenario-${row.id}.txt"`);
  res.send(lines.join("\n"));
});

export default router;

