import type { Request } from "express";
import { db, auditLogsTable } from "@workspace/db";

/**
 * Central audit trail helper. Every privileged mutation in the mitigation,
 * data-hub and verification flows calls this so the existing Audit Logs page
 * reflects actions taken in the new modules.
 */
export async function recordAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId: number | null,
  details?: Record<string, unknown>,
): Promise<void> {
  const actorId = req.user?.userId;
  if (!actorId) return;
  await db.insert(auditLogsTable).values({
    userId: actorId,
    action,
    entityType,
    entityId,
    details: details ? JSON.stringify(details) : null,
    ipAddress: req.ip ?? null,
  });
}
