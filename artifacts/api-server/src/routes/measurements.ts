import { Router, type Request, type Response, type NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { db, measurementsTable, sensorsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { CreateMeasurementBody } from "@workspace/api-zod";
import { parseMeasurementQuery, parseIsoTimestamp } from "../lib/validation";

const router = Router();
const sensorTokens = new Map<number, string>();
const rawTokens = process.env.LANDSAFE_IOT_SENSOR_TOKENS;
if (rawTokens) {
  let entries: unknown;
  try { entries = JSON.parse(rawTokens); } catch { throw new Error("Invalid LANDSAFE_IOT_SENSOR_TOKENS JSON"); }
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    throw new Error("LANDSAFE_IOT_SENSOR_TOKENS must be an object keyed by sensor ID");
  }
  for (const [id, token] of Object.entries(entries)) {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) ||
        typeof token !== "string" || Buffer.byteLength(token, "utf8") < 32) {
      throw new Error("Invalid sensor ID or token in LANDSAFE_IOT_SENSOR_TOKENS");
    }
    sensorTokens.set(Number(id), token);
  }
}

function authorizeIngest(req: Request, res: Response, next: NextFunction): void {
  if (req.headers.authorization) {
    void authenticate(req, res, (error?: unknown) => {
      if (error) next(error); else requireRole("operator", "admin")(req, res, next);
    });
    return;
  }
  const supplied = req.header("x-sensor-token");
  const sensorId = req.body?.sensorId;
  const expected = Number.isSafeInteger(sensorId) ? sensorTokens.get(sensorId) : undefined;
  if (!supplied || !expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/measurements", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const query = parseMeasurementQuery(req.query);
  if (!query) { res.status(400).json({ error: "Invalid measurement query" }); return; }
  const conditions = [];
  if (query.sensorId) conditions.push(eq(measurementsTable.sensorId, query.sensorId));
  if (query.locationId) conditions.push(eq(measurementsTable.locationId, query.locationId));
  if (query.from) conditions.push(gte(measurementsTable.timestamp, query.from));
  if (query.to) conditions.push(lte(measurementsTable.timestamp, query.to));
  const rows = await db.select().from(measurementsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${measurementsTable.timestamp} DESC`)
    .limit(query.limit);
  res.json(rows.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })));
});

function validSensorValues(data: Record<string, unknown>): boolean {
  const ranges: Record<string, [number, number]> = {
    rainfall: [0, 500], soilMoisture: [0, 100], tiltAngle: [-180, 180],
    acceleration: [-100, 100], temperature: [-80, 100], humidity: [0, 100],
    batteryVoltage: [0, 100], solarCharging: [0, 100], signalQuality: [0, 100],
  };
  return Object.entries(ranges).every(([key, [min, max]]) => {
    const value = data[key];
    return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);
  });
}
router.post("/measurements", authorizeIngest, async (req, res): Promise<void> => {
  const parsed = CreateMeasurementBody.strict().safeParse(req.body);
  if (!parsed.success || !Number.isSafeInteger(parsed.data.sensorId) || parsed.data.sensorId <= 0) {
    res.status(400).json({ error: "Invalid measurement" }); return;
  }
  const data = parsed.data;
  const timestamp = parseIsoTimestamp(data.timestamp);
  if (!timestamp || Math.abs(Date.now() - timestamp.getTime()) > 15 * 60_000 ||
      Object.keys(data).length <= 2 || !validSensorValues(data)) {
    res.status(400).json({ error: "Invalid measurement" }); return;
  }
  const [sensor] = await db.select({ id: sensorsTable.id, locationId: sensorsTable.locationId })
    .from(sensorsTable).where(eq(sensorsTable.id, data.sensorId)).limit(1);
  if (!sensor) { res.status(404).json({ error: "Sensor not found" }); return; }

  const result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${data.sensorId})`);
    const [prior] = await tx.select({ id: measurementsTable.id }).from(measurementsTable)
      .where(and(eq(measurementsTable.sensorId, data.sensorId), eq(measurementsTable.timestamp, timestamp))).limit(1);
    if (prior) return null;
    const [measurement] = await tx.insert(measurementsTable)
      .values({ ...data, locationId: sensor.locationId, timestamp }).returning();
    await tx.update(sensorsTable).set({
      lastSeen: new Date(),
      ...(data.signalQuality !== undefined ? { signalStrength: data.signalQuality } : {}),
    }).where(eq(sensorsTable.id, data.sensorId));
    return measurement;
  });
  if (!result) { res.status(409).json({ error: "Duplicate measurement" }); return; }
  res.status(201).json({ ...result, timestamp: result.timestamp.toISOString() });
});

export default router;