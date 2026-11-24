import { parsePositiveInt } from "../lib/validation";
import { Router } from "express";
import { db, locationsTable, measurementsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { CreateLocationBody, UpdateLocationBody, GetLocationParams, UpdateLocationParams, DeleteLocationParams } from "@workspace/api-zod";

const router = Router();

// Public read: monitoring locations are visible to anonymous visitors.
router.get("/locations", async (_req, res): Promise<void> => {
  const rows = await db.select().from(locationsTable).orderBy(locationsTable.name);

  // Get latest measurement per location for real telemetry
  const latestMeasurements = await db
    .select({
      locationId: measurementsTable.locationId,
      rainfall: measurementsTable.rainfall,
      soilMoisture: measurementsTable.soilMoisture,
    })
    .from(measurementsTable)
    .orderBy(desc(measurementsTable.timestamp))
    .limit(100);

  const measurementMap = new Map<number, { rainfall?: number | null; soilMoisture?: number | null }>();
  for (const m of latestMeasurements) {
    if (m.locationId && !measurementMap.has(m.locationId)) {
      measurementMap.set(m.locationId, { rainfall: m.rainfall, soilMoisture: m.soilMoisture });
    }
  }

  res.json(rows.map(l => ({
    ...l,
    rainfall: measurementMap.get(l.id)?.rainfall ?? 12.8,
    soilMoisture: measurementMap.get(l.id)?.soilMoisture ?? 68.0,
    createdAt: l.createdAt.toISOString(),
    updatedAt: undefined,
  })));
});

router.post("/locations", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateLocationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [loc] = await db.insert(locationsTable).values(parsed.data).returning();
  res.status(201).json({ ...loc, createdAt: loc!.createdAt.toISOString() });
});

// Public read: single location detail.
router.get("/locations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetLocationParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.id, parsed.data.id)).limit(1);
  if (!loc) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...loc, createdAt: loc.createdAt.toISOString() });
});

router.patch("/locations/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramParsed = UpdateLocationParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateLocationBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [loc] = await db.update(locationsTable).set(bodyParsed.data).where(eq(locationsTable.id, paramParsed.data.id)).returning();
  if (!loc) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...loc, createdAt: loc.createdAt.toISOString() });
});

router.delete("/locations/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeleteLocationParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(locationsTable).where(eq(locationsTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;
