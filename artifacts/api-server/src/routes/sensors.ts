import { parsePositiveInt, parseIsoTimestamp } from "../lib/validation";
import { Router } from "express";
import { db, sensorsTable, locationsTable, measurementsTable } from "@workspace/db";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { CreateSensorBody, UpdateSensorBody, GetSensorParams, UpdateSensorParams, DeleteSensorParams, GetSensorReadingsParams, GetSensorsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/sensors", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const qp = GetSensorsQueryParams.safeParse(req.query);
  if (!qp.success || (req.query.locationId !== undefined && parsePositiveInt(req.query.locationId) === null)) {
    res.status(400).json({ error: "Invalid sensor query" }); return;
  }
  let query = db
    .select({
      id: sensorsTable.id,
      locationId: sensorsTable.locationId,
      locationName: locationsTable.name,
      sensorCode: sensorsTable.sensorCode,
      sensorType: sensorsTable.sensorType,
      status: sensorsTable.status,
      batteryLevel: sensorsTable.batteryLevel,
      signalStrength: sensorsTable.signalStrength,
      firmwareVersion: sensorsTable.firmwareVersion,
      lastSeen: sensorsTable.lastSeen,
      createdAt: sensorsTable.createdAt,
    })
    .from(sensorsTable)
    .leftJoin(locationsTable, eq(sensorsTable.locationId, locationsTable.id));

  const rows = qp.success && qp.data.locationId
    ? await query.where(eq(sensorsTable.locationId, qp.data.locationId))
    : await query;

  res.json(rows.map(s => ({
    ...s,
    lastSeen: s.lastSeen?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  })));
});

router.post("/sensors", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateSensorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [sensor] = await db.insert(sensorsTable).values(parsed.data).returning();
  res.status(201).json({ ...sensor, lastSeen: null, locationName: null, createdAt: sensor!.createdAt.toISOString() });
});

router.get("/sensors/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetSensorParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [s] = await db
    .select({ id: sensorsTable.id, locationId: sensorsTable.locationId, locationName: locationsTable.name, sensorCode: sensorsTable.sensorCode, sensorType: sensorsTable.sensorType, status: sensorsTable.status, batteryLevel: sensorsTable.batteryLevel, signalStrength: sensorsTable.signalStrength, firmwareVersion: sensorsTable.firmwareVersion, lastSeen: sensorsTable.lastSeen, createdAt: sensorsTable.createdAt })
    .from(sensorsTable)
    .leftJoin(locationsTable, eq(sensorsTable.locationId, locationsTable.id))
    .where(eq(sensorsTable.id, parsed.data.id))
    .limit(1);
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...s, lastSeen: s.lastSeen?.toISOString() ?? null, createdAt: s.createdAt.toISOString() });
});

router.patch("/sensors/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramParsed = UpdateSensorParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateSensorBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [s] = await db.update(sensorsTable).set(bodyParsed.data).where(eq(sensorsTable.id, paramParsed.data.id)).returning();
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...s, lastSeen: s.lastSeen?.toISOString() ?? null, locationName: null, createdAt: s.createdAt.toISOString() });
});

router.delete("/sensors/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeleteSensorParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(sensorsTable).where(eq(sensorsTable.id, parsed.data.id));
  res.status(204).send();
});

router.get("/sensors/:id/readings", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramParsed = GetSensorReadingsParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const conditions = [eq(measurementsTable.sensorId, paramParsed.data.id)];
  const from = req.query.from === undefined ? undefined : parseIsoTimestamp(req.query.from);
  const to = req.query.to === undefined ? undefined : parseIsoTimestamp(req.query.to);
  if (from === null || to === null || (from && to && from > to)) {
    res.status(400).json({ error: "Invalid time range" }); return;
  }
  if (from) conditions.push(gte(measurementsTable.timestamp, from));
  if (to) conditions.push(lte(measurementsTable.timestamp, to));

  const rows = await db.select().from(measurementsTable)
    .where(and(...conditions))
    .orderBy(sql`${measurementsTable.timestamp} DESC`)
    .limit(500);

  res.json(rows.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })));
});

export default router;
