import { Router } from "express";
import {
  db,
  dataSourcesTable,
  integrationLogsTable,
  devicesTable,
  sensorsTable,
  measurementsTable,
  locationsTable,
  riskAssessmentsTable,
  standardizedHazardEventsTable,
  standardizedWeatherObservationsTable,
  crossSourceCorrelationsTable,
  dataSourceResourcesTable,
  rawIngestionRecordsTable,
  dataQualityIssuesTable,
} from "@workspace/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { parseBoundedLimit, parsePositiveInt } from "../lib/validation";
import { recordAudit } from "../lib/audit";
import { UpdateDataSourceBody, UpdateDataSourceParams, SyncDataSourceParams } from "@workspace/api-zod";
import { syncEngine } from "../integrations/sync-engine";
import { connectorRegistry } from "../integrations/registry";

const router = Router();

type SourceRow = typeof dataSourcesTable.$inferSelect;

function serializeSource(row: SourceRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    agency: row.agency,
    category: row.category,
    integrationType: row.integrationType,
    status: row.status,
    endpointUrl: row.endpointUrl,
    updateFrequency: row.updateFrequency,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    lastSyncStatus: row.lastSyncStatus,
    recordsAvailable: row.recordsAvailable,
    completeness: row.completeness,
    duplicateRate: row.duplicateRate,
    owner: row.owner,
    description: row.description,
    isSimulated: row.isSimulated,
    verificationStatus: (row as any).verificationStatus ?? "discovered",
    authType: (row as any).authType ?? "none",
    license: (row as any).license ?? null,
    attribution: (row as any).attribution ?? null,
    documentationUrl: (row as any).documentationUrl ?? null,
    geographicCoverage: (row as any).geographicCoverage ?? "Nasional",
    lastSuccessAt: (row as any).lastSuccessAt ? (row as any).lastSuccessAt.toISOString() : null,
    lastError: (row as any).lastError ?? null,
    circuitBreakerState: (row as any).circuitBreakerState ?? "closed",
  };
}

async function findSource(id: number): Promise<SourceRow | undefined> {
  const [row] = await db.select().from(dataSourcesTable).where(eq(dataSourcesTable.id, id)).limit(1);
  return row;
}

router.get("/data-hub/sources", authenticate, requireRole("operator", "admin"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(dataSourcesTable).orderBy(dataSourcesTable.id);
  res.json(rows.map(serializeSource));
});

router.patch(
  "/data-hub/sources/:id",
  authenticate,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const paramParsed = UpdateDataSourceParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
    if (!paramParsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const bodyParsed = UpdateDataSourceBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.message });
      return;
    }

    const allowedStatuses = ["connected", "degraded", "unavailable", "simulated"];
    if (bodyParsed.data.status && !allowedStatuses.includes(bodyParsed.data.status)) {
      res.status(400).json({ error: "Unknown source status" });
      return;
    }

    const updates: Partial<typeof dataSourcesTable.$inferInsert> = {};
    if (bodyParsed.data.status) updates.status = bodyParsed.data.status as SourceRow["status"];
    if (bodyParsed.data.description !== undefined) updates.description = bodyParsed.data.description;
    if (bodyParsed.data.updateFrequency !== undefined) updates.updateFrequency = bodyParsed.data.updateFrequency;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No supported fields supplied" });
      return;
    }

    const [updated] = await db
      .update(dataSourcesTable)
      .set(updates)
      .where(eq(dataSourcesTable.id, paramParsed.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await recordAudit(req, "datasource.update", "data_source", updated.id, {
      code: updated.code,
      changes: updates,
    });

    res.json(serializeSource(updated));
  },
);

router.post(
  "/data-hub/sources/:id/sync",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsed = SyncDataSourceParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const source = await findSource(parsed.data.id);
    if (!source) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const startedAt = Date.now();
    const now = new Date();

    if (source.code === "IOT-GATEWAY") {
      const [deviceTotals] = await db.select({ total: count() }).from(devicesTable);
      const [measurementTotals] = await db.select({ total: count() }).from(measurementsTable);
      const recordCount = Number(measurementTotals?.total ?? 0);
      const durationMs = Date.now() - startedAt;

      const [updated] = await db
        .update(dataSourcesTable)
        .set({
          recordsAvailable: recordCount,
          lastSyncAt: now,
          lastSyncStatus: `Sinkron — ${Number(deviceTotals?.total ?? 0)} perangkat, ${recordCount} pembacaan`,
        })
        .where(eq(dataSourcesTable.id, source.id))
        .returning();

      await db.insert(integrationLogsTable).values({
        sourceId: source.id,
        level: "info",
        event: "sync.completed",
        message: `Sinkronisasi manual berhasil — ${Number(deviceTotals?.total ?? 0)} perangkat, ${recordCount} pembacaan`,
        recordsProcessed: recordCount,
        invalidRecords: 0,
        durationMs,
        actorId: req.user!.userId,
      });
      await recordAudit(req, "datasource.sync", "data_source", source.id, { code: source.code, recordCount });

      res.json({
        outcome: "synced",
        message: "Sinkronisasi data internal selesai.",
        recordsProcessed: recordCount,
        durationMs,
        source: serializeSource(updated!),
      });
      return;
    }

    // Check if an autonomous government connector is registered for this source
    const connector = connectorRegistry.getConnector(source.code);
    if (connector) {
      try {
        const outcome = await syncEngine.syncSource(source.code, req.user?.userId);
        const refreshed = await findSource(source.id);
        const durationMs = Date.now() - startedAt;

        await recordAudit(req, "datasource.sync", "data_source", source.id, {
          code: source.code,
          outcome: outcome.status,
          recordsInserted: outcome.recordsInserted,
          recordsUpdated: outcome.recordsUpdated,
        });

        res.json({
          outcome: outcome.status === "completed" ? "synced" : "degraded",
          message: outcome.error
            ? `Sinkronisasi selesai dengan catatan: ${outcome.error}`
            : `Sinkronisasi resmi ${source.name} berhasil — ${outcome.recordsInserted} data baru, ${outcome.recordsUpdated} diperbarui.`,
          recordsProcessed: outcome.recordsInserted + outcome.recordsUpdated,
          durationMs,
          source: serializeSource(refreshed || source),
        });
        return;
      } catch (err: any) {
        const durationMs = Date.now() - startedAt;
        res.status(500).json({
          outcome: "failed",
          message: `Gagal menjalankan sinkronisasi: ${err.message}`,
          recordsProcessed: 0,
          durationMs,
          source: serializeSource(source),
        });
        return;
      }
    }

    const durationMs = Date.now() - startedAt;

    if (source.status === "unavailable") {
      const message =
        "Integrasi belum dikonfigurasi pada deployment ini. Tidak ada data yang diambil dari layanan resmi.";
      await db.insert(integrationLogsTable).values({
        sourceId: source.id,
        level: "error",
        event: "sync.unavailable",
        message,
        recordsProcessed: 0,
        invalidRecords: 0,
        durationMs,
        actorId: req.user!.userId,
      });
      await recordAudit(req, "datasource.sync_failed", "data_source", source.id, { code: source.code });

      res.json({ outcome: "unavailable", message, recordsProcessed: 0, durationMs, source: serializeSource(source) });
      return;
    }

    if (source.isSimulated) {
      const message =
        "Sinkronisasi dijalankan pada dataset demo. Tidak ada koneksi ke layanan resmi — data tidak diperbarui dari sumber eksternal.";
      const [updated] = await db
        .update(dataSourcesTable)
        .set({ lastSyncAt: now, lastSyncStatus: "Sinkronisasi simulasi (data demo)" })
        .where(eq(dataSourcesTable.id, source.id))
        .returning();

      await db.insert(integrationLogsTable).values({
        sourceId: source.id,
        level: "warning",
        event: "sync.simulated",
        message,
        recordsProcessed: 0,
        invalidRecords: 0,
        durationMs,
        actorId: req.user!.userId,
      });
      await recordAudit(req, "datasource.sync_simulated", "data_source", source.id, { code: source.code });

      res.json({ outcome: "simulated", message, recordsProcessed: 0, durationMs, source: serializeSource(updated!) });
      return;
    }

    // Defensive fallback
    res.json({
      outcome: "unavailable",
      message: "Adapter untuk sumber ini belum diimplementasikan.",
      recordsProcessed: 0,
      durationMs,
      source: serializeSource(source),
    });
  },
);


router.get("/data-hub/logs", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const limit = parseBoundedLimit(req.query.limit, 50, 200);
  if (limit === null) {
    res.status(400).json({ error: "Invalid limit" });
    return;
  }
  const level = typeof req.query.level === "string" ? req.query.level : undefined;
  if (level && !["info", "warning", "error"].includes(level)) {
    res.status(400).json({ error: "Invalid level" });
    return;
  }
  const sourceId = req.query.sourceId === undefined ? undefined : parsePositiveInt(req.query.sourceId);
  if (sourceId === null) {
    res.status(400).json({ error: "Invalid sourceId" });
    return;
  }

  const filters = [
    level ? eq(integrationLogsTable.level, level) : undefined,
    sourceId ? eq(integrationLogsTable.sourceId, sourceId) : undefined,
  ].filter((filter) => filter !== undefined);

  const rows = await db
    .select({
      id: integrationLogsTable.id,
      sourceId: integrationLogsTable.sourceId,
      sourceName: dataSourcesTable.name,
      level: integrationLogsTable.level,
      event: integrationLogsTable.event,
      message: integrationLogsTable.message,
      recordsProcessed: integrationLogsTable.recordsProcessed,
      invalidRecords: integrationLogsTable.invalidRecords,
      durationMs: integrationLogsTable.durationMs,
      createdAt: integrationLogsTable.createdAt,
    })
    .from(integrationLogsTable)
    .leftJoin(dataSourcesTable, eq(integrationLogsTable.sourceId, dataSourcesTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(integrationLogsTable.createdAt))
    .limit(limit);

  res.json(rows.map((row) => ({
    ...row,
    sourceName: row.sourceName ?? "Sumber tidak dikenal",
    createdAt: row.createdAt.toISOString(),
  })));
});


type QualityCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  affected: number;
};

/**
 * Validation suite. Every figure comes from this deployment's own tables, so
 * the numbers shown to operators are real measurements of data quality.
 */
async function computeQuality() {
  const sources = await db.select().from(dataSourcesTable).orderBy(dataSourcesTable.id);

  const [deviceStats] = await db
    .select({
      total: count(),
      offline: sql<number>`COUNT(CASE WHEN ${devicesTable.status} = 'offline' THEN 1 END)`,
      stale: sql<number>`COUNT(CASE WHEN ${devicesTable.status} <> 'offline' AND ${devicesTable.lastCommunication} < NOW() - INTERVAL '6 hours' THEN 1 END)`,
    })
    .from(devicesTable);

  const [sensorStats] = await db
    .select({
      total: count(),
      offline: sql<number>`COUNT(CASE WHEN ${sensorsTable.status} = 'offline' THEN 1 END)`,
    })
    .from(sensorsTable);

  const [locationStats] = await db
    .select({
      total: count(),
      missingElevation: sql<number>`COUNT(CASE WHEN ${locationsTable.elevation} IS NULL THEN 1 END)`,
    })
    .from(locationsTable);

  const [measurementStats] = await db
    .select({
      total: count(),
      invalidRainfall: sql<number>`COUNT(CASE WHEN ${measurementsTable.rainfall} < 0 OR ${measurementsTable.rainfall} > 500 THEN 1 END)`,
      invalidMoisture: sql<number>`COUNT(CASE WHEN ${measurementsTable.soilMoisture} < 0 OR ${measurementsTable.soilMoisture} > 100 THEN 1 END)`,
      missingTilt: sql<number>`COUNT(CASE WHEN ${measurementsTable.tiltAngle} IS NULL THEN 1 END)`,
    })
    .from(measurementsTable);

  const [assessmentStats] = await db
    .select({
      total: count(),
      unverified: sql<number>`COUNT(CASE WHEN ${riskAssessmentsTable.verified} = false THEN 1 END)`,
    })
    .from(riskAssessmentsTable);

  const duplicateDevices = await db
    .select({ deviceId: devicesTable.deviceId })
    .from(devicesTable)
    .groupBy(devicesTable.deviceId)
    .having(sql`COUNT(*) > 1`);

  const offline = Number(deviceStats?.offline ?? 0) + Number(sensorStats?.offline ?? 0);
  const stale = Number(deviceStats?.stale ?? 0);
  const missingElevation = Number(locationStats?.missingElevation ?? 0);
  const invalidMeasurements = Number(measurementStats?.invalidRainfall ?? 0) + Number(measurementStats?.invalidMoisture ?? 0);
  const missingTilt = Number(measurementStats?.missingTilt ?? 0);
  const unverified = Number(assessmentStats?.unverified ?? 0);
  const duplicates = duplicateDevices.length;
  const unavailableSources = sources.filter((s) => s.status === "unavailable").length;
  const lowCompleteness = sources.filter((s) => s.status !== "unavailable" && s.completeness < 90).length;


  const checks: QualityCheck[] = [
    {
      id: "duplicate.devices",
      label: "Duplikasi kode perangkat",
      status: duplicates > 0 ? "fail" : "pass",
      detail: duplicates > 0
        ? `${duplicates} kode perangkat muncul lebih dari sekali.`
        : "Tidak ada kode perangkat duplikat pada registri perangkat.",
      affected: duplicates,
    },
    {
      id: "range.measurements",
      label: "Nilai pengukuran di luar rentang",
      status: invalidMeasurements > 0 ? "warn" : "pass",
      detail: invalidMeasurements > 0
        ? `${invalidMeasurements} pembacaan memiliki curah hujan atau kelembapan tanah di luar rentang wajar.`
        : "Seluruh pembacaan curah hujan dan kelembapan tanah berada dalam rentang valid.",
      affected: invalidMeasurements,
    },
    {
      id: "completeness.measurements",
      label: "Kelengkapan field pengukuran",
      status: missingTilt > 0 ? "warn" : "pass",
      detail: missingTilt > 0
        ? `${missingTilt} pembacaan tidak memiliki nilai tilt angle.`
        : "Field tilt angle terisi pada seluruh pembacaan.",
      affected: missingTilt,
    },
    {
      id: "completeness.locations",
      label: "Kelengkapan data lokasi",
      status: missingElevation > 0 ? "warn" : "pass",
      detail: missingElevation > 0
        ? `${missingElevation} lokasi belum memiliki nilai elevasi.`
        : "Seluruh lokasi memiliki koordinat dan elevasi.",
      affected: missingElevation,
    },
    {
      id: "connectivity.devices",
      label: "Konektivitas perangkat & sensor",
      status: offline + stale > 0 ? "warn" : "pass",
      detail: offline + stale > 0
        ? `${offline} perangkat/sensor offline dan ${stale} perangkat tidak mengirim data lebih dari 6 jam.`
        : "Seluruh perangkat dan sensor mengirim data dalam 6 jam terakhir.",
      affected: offline + stale,
    },
    {
      id: "completeness.sources",
      label: "Kelengkapan dataset sumber",
      status: lowCompleteness > 0 ? "warn" : "pass",
      detail: lowCompleteness > 0
        ? `${lowCompleteness} sumber aktif memiliki tingkat kelengkapan di bawah 90%.`
        : "Seluruh sumber aktif memiliki kelengkapan minimal 90%.",
      affected: lowCompleteness,
    },
    {
      id: "availability.sources",
      label: "Ketersediaan integrasi",
      status: unavailableSources > 0 ? "warn" : "pass",
      detail: unavailableSources > 0
        ? `${unavailableSources} integrasi belum terhubung dan hanya tersedia sebagai data contoh.`
        : "Seluruh integrasi terhubung.",
      affected: unavailableSources,
    },
    {
      id: "verification.assessments",
      label: "Verifikasi penilaian risiko",
      status: unverified > 0 ? "warn" : "pass",
      detail: unverified > 0
        ? `${unverified} dari ${Number(assessmentStats?.total ?? 0)} penilaian risiko belum diverifikasi.`
        : "Seluruh penilaian risiko telah diverifikasi.",
      affected: unverified,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: checks.length,
      passed: checks.filter((c) => c.status === "pass").length,
      warnings: checks.filter((c) => c.status === "warn").length,
      failed: checks.filter((c) => c.status === "fail").length,
    },
    checks,
    datasets: sources.map((source) => ({
      sourceId: source.id,
      code: source.code,
      name: source.name,
      records: source.recordsAvailable,
      completeness: source.completeness,
      duplicateRate: source.duplicateRate,
      isSimulated: source.isSimulated,
    })),
  };
}

router.get("/data-hub/quality", authenticate, requireRole("operator", "admin"), async (_req, res): Promise<void> => {
  res.json(await computeQuality());
});

router.post("/data-hub/validation/run", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const startedAt = Date.now();
  const report = await computeQuality();
  const durationMs = Date.now() - startedAt;
  const level = report.summary.failed > 0 ? "error" : report.summary.warnings > 0 ? "warning" : "info";
  const iot = await db
    .select({ id: dataSourcesTable.id })
    .from(dataSourcesTable)
    .where(eq(dataSourcesTable.code, "IOT-GATEWAY"))
    .limit(1);

  if (iot[0]) {
    await db.insert(integrationLogsTable).values({
      sourceId: iot[0].id,
      level,
      event: "validation.completed",
      message: `Validasi data dijalankan — ${report.summary.passed} lolos, ${report.summary.warnings} peringatan, ${report.summary.failed} gagal`,
      recordsProcessed: report.datasets.reduce((sum, dataset) => sum + dataset.records, 0),
      invalidRecords: report.checks.reduce((sum, check) => sum + check.affected, 0),
      durationMs,
      actorId: req.user!.userId,
    });
  }

  await recordAudit(req, "datahub.validation_run", "data_source", iot[0]?.id ?? null, {
    passed: report.summary.passed,
    warnings: report.summary.warnings,
    failed: report.summary.failed,
  });

  res.json(report);
});

// ─── Standardized Government Intelligence Endpoints ──────────────────────────

router.get("/data-hub/events", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const limit = parseBoundedLimit(req.query.limit, 50, 200) ?? 50;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const sourceCode = typeof req.query.sourceCode === "string" ? req.query.sourceCode : undefined;

  const filters = [
    category ? eq(standardizedHazardEventsTable.hazardCategory, category as any) : undefined,
    sourceCode ? eq(standardizedHazardEventsTable.sourceCode, sourceCode) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(standardizedHazardEventsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(standardizedHazardEventsTable.occurredAt))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      ...r,
      occurredAt: r.occurredAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
  );
});

router.get("/data-hub/weather", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const limit = parseBoundedLimit(req.query.limit, 50, 200) ?? 50;
  const regency = typeof req.query.regency === "string" ? req.query.regency : undefined;

  const rows = await db
    .select()
    .from(standardizedWeatherObservationsTable)
    .where(regency ? eq(standardizedWeatherObservationsTable.regency, regency) : undefined)
    .orderBy(desc(standardizedWeatherObservationsTable.observationTime))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      ...r,
      observationTime: r.observationTime.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.get("/data-hub/correlations", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const limit = parseBoundedLimit(req.query.limit, 50, 200) ?? 50;

  const rows = await db
    .select()
    .from(crossSourceCorrelationsTable)
    .orderBy(desc(crossSourceCorrelationsTable.createdAt))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.get("/data-hub/resources", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const rows = await db.select().from(dataSourceResourcesTable).orderBy(dataSourceResourcesTable.id);
  res.json(
    rows.map((r) => ({
      ...r,
      lastSyncAt: r.lastSyncAt ? r.lastSyncAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
  );
});

router.post("/data-hub/verify", authenticate, requireRole("operator", "admin"), async (_req, res): Promise<void> => {
  const reports = await connectorRegistry.verifyAll();
  res.json(reports);
});

export default router;

