import { Router } from "express";
import { db, riskAssessmentsTable } from "@workspace/db";
import { and, desc, eq, gte, ilike, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { parsePositiveInt, parseBoundedLimit } from "../lib/validation";
import { recordAudit } from "../lib/audit";
import { RISK_WEIGHTS } from "../lib/risk-model";
import {
  GetRiskAssessmentsQueryParams,
  VerifyRiskAssessmentBody,
  VerifyRiskAssessmentParams,
} from "@workspace/api-zod";

const router = Router();

const HAZARD_TYPES = ["flood", "landslide", "earthquake", "volcanic", "tsunami", "drought", "strong_wind"] as const;
const RISK_CLASSES = ["low", "moderate", "high", "extreme"] as const;

type RiskRow = typeof riskAssessmentsTable.$inferSelect;

function serializeAssessment(row: RiskRow) {
  return {
    id: row.id,
    regionName: row.regionName,
    regionCode: row.regionCode,
    province: row.province,
    latitude: row.latitude,
    longitude: row.longitude,
    extentKm: row.extentKm,
    hazardType: row.hazardType,
    hazardIndex: row.hazardIndex,
    exposureIndex: row.exposureIndex,
    vulnerabilityIndex: row.vulnerabilityIndex,
    capacityIndex: row.capacityIndex,
    riskScore: row.riskScore,
    riskClass: row.riskClass,
    population: row.population,
    exposedPopulation: row.exposedPopulation,
    exposedFacilities: row.exposedFacilities,
    exposedRoadsKm: row.exposedRoadsKm,
    indicators: row.indicators,
    sources: row.sources,
    verified: row.verified,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    assessedAt: row.assessedAt.toISOString(),
  };
}

router.get("/risk/assessments", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const parsed = GetRiskAssessmentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { hazardType, province, riskClass, verified, minScore, search } = parsed.data;

  if (hazardType && !HAZARD_TYPES.includes(hazardType as (typeof HAZARD_TYPES)[number])) {
    res.status(400).json({ error: "Unknown hazard type" });
    return;
  }
  if (riskClass && !RISK_CLASSES.includes(riskClass as (typeof RISK_CLASSES)[number])) {
    res.status(400).json({ error: "Unknown risk class" });
    return;
  }

  const filters = [
    hazardType ? eq(riskAssessmentsTable.hazardType, hazardType as (typeof HAZARD_TYPES)[number]) : undefined,
    province ? ilike(riskAssessmentsTable.province, `%${province}%`) : undefined,
    riskClass ? eq(riskAssessmentsTable.riskClass, riskClass as (typeof RISK_CLASSES)[number]) : undefined,
    typeof verified === "boolean" ? eq(riskAssessmentsTable.verified, verified) : undefined,
    typeof minScore === "number" ? gte(riskAssessmentsTable.riskScore, minScore) : undefined,
    search ? ilike(riskAssessmentsTable.regionName, `%${search}%`) : undefined,
  ].filter((filter) => filter !== undefined);

  const where = filters.length > 0 ? and(...filters) : undefined;
  const rows = await db
    .select()
    .from(riskAssessmentsTable)
    .where(where)
    .orderBy(desc(riskAssessmentsTable.riskScore));

  res.json(rows.map(serializeAssessment));
});

router.get("/risk/summary", authenticate, requireRole("operator", "admin"), async (_req, res): Promise<void> => {
  const [aggregate] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      verified: sql<number>`COUNT(CASE WHEN ${riskAssessmentsTable.verified} THEN 1 END)`,
      regions: sql<number>`COUNT(DISTINCT ${riskAssessmentsTable.regionName})`,
      averageRisk: sql<number>`COALESCE(AVG(${riskAssessmentsTable.riskScore}), 0)`,
      averageHazard: sql<number>`COALESCE(AVG(${riskAssessmentsTable.hazardIndex}), 0)`,
      averageExposure: sql<number>`COALESCE(AVG(${riskAssessmentsTable.exposureIndex}), 0)`,
      averageVulnerability: sql<number>`COALESCE(AVG(${riskAssessmentsTable.vulnerabilityIndex}), 0)`,
      averageCapacity: sql<number>`COALESCE(AVG(${riskAssessmentsTable.capacityIndex}), 0)`,
      low: sql<number>`COUNT(CASE WHEN ${riskAssessmentsTable.riskClass} = 'low' THEN 1 END)`,
      moderate: sql<number>`COUNT(CASE WHEN ${riskAssessmentsTable.riskClass} = 'moderate' THEN 1 END)`,
      high: sql<number>`COUNT(CASE WHEN ${riskAssessmentsTable.riskClass} = 'high' THEN 1 END)`,
      extreme: sql<number>`COUNT(CASE WHEN ${riskAssessmentsTable.riskClass} = 'extreme' THEN 1 END)`,
      exposedPopulation: sql<number>`COALESCE(SUM(${riskAssessmentsTable.exposedPopulation}), 0)`,
      exposedFacilities: sql<number>`COALESCE(SUM(${riskAssessmentsTable.exposedFacilities}), 0)`,
      exposedRoadsKm: sql<number>`COALESCE(SUM(${riskAssessmentsTable.exposedRoadsKm}), 0)`,
      lastAssessedAt: sql<string | null>`MAX(${riskAssessmentsTable.assessedAt})::text`,
    })
    .from(riskAssessmentsTable);

  const byHazard = await db
    .select({
      hazardType: riskAssessmentsTable.hazardType,
      count: sql<number>`COUNT(*)`,
      averageRiskScore: sql<number>`COALESCE(AVG(${riskAssessmentsTable.riskScore}), 0)`,
    })
    .from(riskAssessmentsTable)
    .groupBy(riskAssessmentsTable.hazardType);

  const provinceRows = await db
    .selectDistinct({ province: riskAssessmentsTable.province })
    .from(riskAssessmentsTable);

  const round = (value: unknown) => Math.round(Number(value ?? 0) * 10) / 10;
  const lastAssessedAt = aggregate?.lastAssessedAt ? new Date(aggregate.lastAssessedAt).toISOString() : null;

  res.json({
    totalAssessments: Number(aggregate?.total ?? 0),
    verifiedAssessments: Number(aggregate?.verified ?? 0),
    regionsCovered: Number(aggregate?.regions ?? 0),
    provinces: provinceRows.map((row) => row.province).sort(),
    averageRiskScore: round(aggregate?.averageRisk),
    averageHazard: round(aggregate?.averageHazard),
    averageExposure: round(aggregate?.averageExposure),
    averageVulnerability: round(aggregate?.averageVulnerability),
    averageCapacity: round(aggregate?.averageCapacity),
    byClass: {
      low: Number(aggregate?.low ?? 0),
      moderate: Number(aggregate?.moderate ?? 0),
      high: Number(aggregate?.high ?? 0),
      extreme: Number(aggregate?.extreme ?? 0),
    },
    byHazard: byHazard
      .map((row) => ({
        hazardType: row.hazardType,
        count: Number(row.count),
        averageRiskScore: round(row.averageRiskScore),
      }))
      .sort((a, b) => b.averageRiskScore - a.averageRiskScore),
    exposedPopulation: Number(aggregate?.exposedPopulation ?? 0),
    exposedFacilities: Number(aggregate?.exposedFacilities ?? 0),
    exposedRoadsKm: round(aggregate?.exposedRoadsKm),
    lastAssessedAt,
    weights: RISK_WEIGHTS,
  });
});

router.get("/risk/rankings", authenticate, requireRole("operator", "admin"), async (req, res): Promise<void> => {
  const limit = parseBoundedLimit(req.query.limit, 10, 50);
  if (limit === null) {
    res.status(400).json({ error: "Invalid limit" });
    return;
  }
  const rows = await db
    .select({
      id: riskAssessmentsTable.id,
      regionName: riskAssessmentsTable.regionName,
      province: riskAssessmentsTable.province,
      hazardType: riskAssessmentsTable.hazardType,
      riskScore: riskAssessmentsTable.riskScore,
      riskClass: riskAssessmentsTable.riskClass,
      exposedPopulation: riskAssessmentsTable.exposedPopulation,
      verified: riskAssessmentsTable.verified,
    })
    .from(riskAssessmentsTable)
    .orderBy(desc(riskAssessmentsTable.riskScore))
    .limit(limit);

  res.json(rows.map((row, index) => ({ rank: index + 1, ...row })));
});


router.patch(
  "/risk/assessments/:id/verify",
  authenticate,
  requireRole("operator", "admin"),
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const paramParsed = VerifyRiskAssessmentParams.safeParse({ id: parsePositiveInt(raw) ?? NaN });
    if (!paramParsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const bodyParsed = VerifyRiskAssessmentBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: bodyParsed.error.message });
      return;
    }

    const [updated] = await db
      .update(riskAssessmentsTable)
      .set({
        verified: bodyParsed.data.verified,
        verifiedBy: bodyParsed.data.verified ? req.user!.userId : null,
        verifiedAt: bodyParsed.data.verified ? new Date() : null,
      })
      .where(eq(riskAssessmentsTable.id, paramParsed.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await recordAudit(
      req,
      bodyParsed.data.verified ? "risk.verify" : "risk.unverify",
      "risk_assessment",
      updated.id,
      {
        regionName: updated.regionName,
        hazardType: updated.hazardType,
        riskScore: updated.riskScore,
        note: bodyParsed.data.note ?? null,
      },
    );

    res.json(serializeAssessment(updated));
  },
);

export default router;

