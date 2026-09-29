import { Router } from "express";
import { db, reportsTable, locationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { GenerateReportBody } from "@workspace/api-zod";

const router = Router();

function fmt(r: any) {
  return {
    ...r,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  };
}

router.get("/reports", authenticate, requireRole("operator", "admin"), async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: reportsTable.id,
      reportType: reportsTable.reportType,
      title: reportsTable.title,
      period: reportsTable.period,
      status: reportsTable.status,
      locationId: reportsTable.locationId,
      locationName: locationsTable.name,
      generatedBy: reportsTable.generatedBy,
      createdAt: reportsTable.createdAt,
      completedAt: reportsTable.completedAt,
    })
    .from(reportsTable)
    .leftJoin(locationsTable, eq(reportsTable.locationId, locationsTable.id))
    .orderBy(sql`${reportsTable.createdAt} DESC`);
  res.json(rows.map(fmt));
});

router.post("/reports", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const parsed = GenerateReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const title = parsed.data.title ?? `${parsed.data.reportType.charAt(0).toUpperCase() + parsed.data.reportType.slice(1)} Report - ${parsed.data.period}`;
  const [report] = await db.insert(reportsTable).values({
    reportType: parsed.data.reportType,
    title,
    period: parsed.data.period,
    locationId: parsed.data.locationId ?? null,
    generatedBy: req.user!.userId,
    status: "generating",
  }).returning();

  // Simulate async completion
  setTimeout(async () => {
    await db.update(reportsTable).set({ status: "ready", completedAt: new Date() }).where(eq(reportsTable.id, report!.id));
  }, 3000);

  res.status(201).json(fmt({ ...report, locationName: null }));
});

export default router;
