import { parsePositiveInt, parseBoundedLimit } from "../lib/validation";
import { Router } from "express";
import { db, alertsTable, locationsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { UpdateAlertBody, GetAlertParams, UpdateAlertParams, GetAlertsQueryParams } from "@workspace/api-zod";

const router = Router();

const alertSelect = {
  id: alertsTable.id,
  locationId: alertsTable.locationId,
  locationName: locationsTable.name,
  alertType: alertsTable.alertType,
  priority: alertsTable.priority,
  status: alertsTable.status,
  message: alertsTable.message,
  operatorId: alertsTable.operatorId,
  operatorName: usersTable.name,
  acknowledgedAt: alertsTable.acknowledgedAt,
  resolvedAt: alertsTable.resolvedAt,
  createdAt: alertsTable.createdAt,
};

function formatAlert(a: typeof alertSelect extends Record<string, any> ? any : never) {
  return {
    ...a,
    acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: a.resolvedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

router.get("/alerts", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const qp = GetAlertsQueryParams.safeParse(req.query);
  const limit = parseBoundedLimit(req.query.limit, 50, 100);
  if (!qp.success || limit === null || (req.query.locationId !== undefined && parsePositiveInt(req.query.locationId) === null)) {
    res.status(400).json({ error: "Invalid alert query" }); return;
  }
  const conditions = [];
  if (qp.success && qp.data.priority) conditions.push(eq(alertsTable.priority, qp.data.priority as any));
  if (qp.success && qp.data.status) conditions.push(eq(alertsTable.status, qp.data.status as any));
  if (qp.success && qp.data.locationId) conditions.push(eq(alertsTable.locationId, qp.data.locationId));

  const rows = await db
    .select(alertSelect)
    .from(alertsTable)
    .leftJoin(locationsTable, eq(alertsTable.locationId, locationsTable.id))
    .leftJoin(usersTable, eq(alertsTable.operatorId, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${alertsTable.createdAt} DESC`)
    .limit(limit);

  res.json(rows.map(formatAlert));
});

router.get("/alerts/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetAlertParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!parsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [a] = await db
    .select(alertSelect)
    .from(alertsTable)
    .leftJoin(locationsTable, eq(alertsTable.locationId, locationsTable.id))
    .leftJoin(usersTable, eq(alertsTable.operatorId, usersTable.id))
    .where(eq(alertsTable.id, parsed.data.id))
    .limit(1);
  if (!a) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatAlert(a));
});

router.patch("/alerts/:id", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramParsed = UpdateAlertParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
  if (!paramParsed.success) { res.status(400).json({ error: "Invalid ID" }); return; }
  const bodyParsed = UpdateAlertBody.strict().safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }

  if (Object.keys(bodyParsed.data).length === 0 || (bodyParsed.data.operatorNote?.length ?? 0) > 2000) {
    res.status(400).json({ error: "Invalid alert update" }); return;
  }
  const updates: Record<string, any> = {};
  if (bodyParsed.data.status === "acknowledged") {
    updates.status = "acknowledged";
    updates.acknowledgedAt = new Date();
    updates.operatorId = req.user!.userId;
  } else if (bodyParsed.data.status === "resolved") {
    updates.status = "resolved";
    updates.resolvedAt = new Date();
    updates.operatorId = req.user!.userId;
  }
  if (bodyParsed.data.operatorNote) updates.operatorNote = bodyParsed.data.operatorNote;

  const [a] = await db.update(alertsTable).set(updates).where(eq(alertsTable.id, paramParsed.data.id)).returning();
  if (!a) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...a, acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null, resolvedAt: a.resolvedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(), locationName: null, operatorName: null });
});

export default router;
