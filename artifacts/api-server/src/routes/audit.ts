import { parseBoundedLimit } from "../lib/validation";
import { Router } from "express";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/audit", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const limit = parseBoundedLimit(req.query.limit, 100, 500);
  if (limit === null) { res.status(400).json({ error: "Invalid limit" }); return; }
  const rows = await db
    .select({
      id: auditLogsTable.id,
      userId: auditLogsTable.userId,
      userName: usersTable.name,
      action: auditLogsTable.action,
      entityType: auditLogsTable.entityType,
      entityId: auditLogsTable.entityId,
      details: auditLogsTable.details,
      ipAddress: auditLogsTable.ipAddress,
      createdAt: auditLogsTable.createdAt,
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .orderBy(sql`${auditLogsTable.createdAt} DESC`)
    .limit(limit);

  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

export default router;
