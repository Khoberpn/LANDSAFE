import { parsePositiveInt } from "../lib/validation";
import { Router } from "express";
import { db, predictionsTable, locationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authenticate } from "../middlewares/auth";

const router = Router();

function fmtPrediction(p: any, locationName: string) {
  return {
    locationId: p.locationId,
    locationName,
    riskLevel: p.riskLevel,
    probability: p.probability,
    confidence: p.confidence,
    potentialTriggers: p.potentialTriggers ?? [],
    recommendedActions: p.recommendedActions ?? [],
    evacuationSuggested: p.evacuationSuggested,
    explanation: p.explanation,
    historicalSimilarEvents: p.historicalSimilarEvents,
    analyzedAt: p.analyzedAt.toISOString(),
  };
}

router.get("/ai/risk-analysis", authenticate, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: predictionsTable.id,
      locationId: predictionsTable.locationId,
      locationName: locationsTable.name,
      riskLevel: predictionsTable.riskLevel,
      probability: predictionsTable.probability,
      confidence: predictionsTable.confidence,
      potentialTriggers: predictionsTable.potentialTriggers,
      recommendedActions: predictionsTable.recommendedActions,
      evacuationSuggested: predictionsTable.evacuationSuggested,
      explanation: predictionsTable.explanation,
      historicalSimilarEvents: predictionsTable.historicalSimilarEvents,
      analyzedAt: predictionsTable.analyzedAt,
    })
    .from(predictionsTable)
    .leftJoin(locationsTable, eq(predictionsTable.locationId, locationsTable.id))
    .orderBy(sql`${predictionsTable.analyzedAt} DESC`);

  // Get latest per location
  const seen = new Set<number>();
  const latest = rows.filter(r => { if (seen.has(r.locationId)) return false; seen.add(r.locationId); return true; });
  res.json(latest.map(r => fmtPrediction(r, r.locationName ?? "Unknown")));
});

router.get("/ai/risk-analysis/:locationId", authenticate, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.locationId) ? req.params.locationId[0] : req.params.locationId;
  const locationId = parsePositiveInt(raw);
  if (locationId === null) { res.status(400).json({ error: "Invalid location ID" }); return; }

  const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.id, locationId)).limit(1);
  if (!loc) { res.status(404).json({ error: "Location not found" }); return; }

  const [pred] = await db.select().from(predictionsTable)
    .where(eq(predictionsTable.locationId, locationId))
    .orderBy(sql`${predictionsTable.analyzedAt} DESC`)
    .limit(1);

  if (!pred) {
    res.json({
      locationId,
      locationName: loc.name,
      riskLevel: loc.riskLevel,
      probability: 0.1,
      confidence: 0.5,
      potentialTriggers: ["Insufficient data"],
      recommendedActions: ["Continue monitoring", "Ensure sensor calibration"],
      evacuationSuggested: false,
      explanation: "Insufficient historical data to generate a reliable risk assessment. Continue monitoring and ensure all sensors are properly calibrated.",
      historicalSimilarEvents: 0,
      analyzedAt: new Date().toISOString(),
    });
    return;
  }

  res.json(fmtPrediction(pred, loc.name));
});

export default router;
