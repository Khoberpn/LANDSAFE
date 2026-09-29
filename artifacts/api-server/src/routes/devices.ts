import { parsePositiveInt } from "../lib/validation";
import { Router } from "express";
import { db, devicesTable, locationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { CreateDeviceBody, UpdateDeviceBody, GetDeviceParams, UpdateDeviceParams, DeleteDeviceParams } from "@workspace/api-zod";

const router = Router();

const deviceSelect = {
  id: devicesTable.id,
  deviceId: devicesTable.deviceId,
  locationId: devicesTable.locationId,
  locationName: locationsTable.name,
  firmwareVersion: devicesTable.firmwareVersion,
  status: devicesTable.status,
  batteryLevel: devicesTable.batteryLevel,
  signalStrength: devicesTable.signalStrength,
  lastCommunication: devicesTable.lastCommunication,
  installationDate: devicesTable.installationDate,
  notes: devicesTable.notes,
  createdAt: devicesTable.createdAt,
};

function fmt(d: any) {
  return {
    ...d,
    lastCommunication: d.lastCommunication.toISOString(),
    installationDate: d.installationDate?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}

router.get("/devices", authenticate, requireRole("operator", "admin"), async (_req, res): Promise<void> => {
  const rows = await db.select(deviceSelect).from(devicesTable)
    .leftJoin(locationsTable, eq(devicesTable.locationId, locationsTable.id))
    .orderBy(sql`${devicesTable.deviceId} ASC`);
  res.json(rows.map(fmt));
});

router.post("/devices", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateDeviceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = { ...parsed.data, installationDate: parsed.data.installationDate ? new Date(parsed.data.installationDate) : undefined };
  const [d] = await db.insert(devicesTable).values(data as any).returning();
  res.status(201).json(fmt({ ...d, locationName: null }));
});

router.get("/devices/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetDeviceParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [d] = await db.select(deviceSelect).from(devicesTable)
    .leftJoin(locationsTable, eq(devicesTable.locationId, locationsTable.id))
    .where(eq(devicesTable.id, parsed.data.id)).limit(1);
  if (!d) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(d));
});

router.patch("/devices/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramParsed = UpdateDeviceParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateDeviceBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [d] = await db.update(devicesTable).set(bodyParsed.data).where(eq(devicesTable.id, paramParsed.data.id)).returning();
  if (!d) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt({ ...d, locationName: null }));
});

router.delete("/devices/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeleteDeviceParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(devicesTable).where(eq(devicesTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;
