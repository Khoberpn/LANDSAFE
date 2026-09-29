import { parseBoundedLimit } from "../lib/validation";
import { Router } from "express";
import { db, sensorsTable, locationsTable, alertsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/dashboard/stats", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const [sensorCounts] = await db
    .select({
      total: count(),
      online: sql<number>`COUNT(CASE WHEN ${sensorsTable.status} = 'online' THEN 1 END)`,
      offline: sql<number>`COUNT(CASE WHEN ${sensorsTable.status} = 'offline' THEN 1 END)`,
    })
    .from(sensorsTable);

  const [locationCounts] = await db
    .select({
      danger: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'danger' THEN 1 END)`,
      alert: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'alert' THEN 1 END)`,
      normal: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'normal' THEN 1 END)`,
    })
    .from(locationsTable);

  const [alertCounts] = await db
    .select({
      active: sql<number>`COUNT(CASE WHEN ${alertsTable.status} = 'active' THEN 1 END)`,
    })
    .from(alertsTable);

  res.json({
    totalSensors: Number(sensorCounts?.total ?? 0),
    onlineSensors: Number(sensorCounts?.online ?? 0),
    offlineSensors: Number(sensorCounts?.offline ?? 0),
    highRiskLocations: Number(locationCounts?.danger ?? 0) + Number(locationCounts?.alert ?? 0),
    activeWarnings: Number(alertCounts?.active ?? 0),
    normalLocations: Number(locationCounts?.normal ?? 0),
    avgRainfall: 12.4,
    avgSoilMoisture: 67.2,
    systemHealth: "healthy",
    dbStatus: "connected",
    aiEngineStatus: "active",
    networkStatus: "stable",
  });
});

router.get("/dashboard/activity", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const limit = parseBoundedLimit(req.query.limit, 20, 100);
  if (limit === null) { res.status(400).json({ error: "Invalid limit" }); return; }
  const alerts = await db
    .select({
      id: alertsTable.id,
      alertType: alertsTable.alertType,
      message: alertsTable.message,
      priority: alertsTable.priority,
      locationId: alertsTable.locationId,
      locationName: locationsTable.name,
      createdAt: alertsTable.createdAt,
    })
    .from(alertsTable)
    .leftJoin(locationsTable, eq(alertsTable.locationId, locationsTable.id))
    .orderBy(sql`${alertsTable.createdAt} DESC`)
    .limit(limit);

  const typeMap: Record<string, string> = {
    threshold_exceeded: "threshold_exceeded",
    rainfall_warning: "rainfall_warning",
    sensor_offline: "sensor_offline",
    battery_low: "battery_low",
    ground_movement: "ground_movement",
    earthquake: "earthquake",
    emergency_notification: "notification_sent",
  };

  res.json(alerts.map((a) => ({
    id: a.id,
    type: typeMap[a.alertType] ?? "alert",
    message: a.message,
    priority: a.priority,
    locationName: a.locationName ?? null,
    timestamp: a.createdAt.toISOString(),
  })));
});

router.get("/dashboard/risk-summary", authenticate, requireRole("operator", "admin"), async (_req, res): Promise<void> => {
  const [counts] = await db
    .select({
      danger: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'danger' THEN 1 END)`,
      alert: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'alert' THEN 1 END)`,
      watch: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'watch' THEN 1 END)`,
      normal: sql<number>`COUNT(CASE WHEN ${locationsTable.riskLevel} = 'normal' THEN 1 END)`,
    })
    .from(locationsTable);

  res.json({
    danger: Number(counts?.danger ?? 0),
    alert: Number(counts?.alert ?? 0),
    watch: Number(counts?.watch ?? 0),
    normal: Number(counts?.normal ?? 0),
    trend: "stable",
  });
});

export default router;
