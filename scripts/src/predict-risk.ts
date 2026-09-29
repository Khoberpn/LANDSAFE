import { fileURLToPath } from "node:url";

import {
  db,
  locationsTable,
  measurementsTable,
  pool,
  predictionsTable,
} from "@workspace/db";
import { and, avg, count, eq, gte, max } from "drizzle-orm";

import {
  buildPredictionDetails,
  type LocationFeatures,
} from "./risk-prediction/domain";
import { runXgboostWorker } from "./risk-prediction/runtime";

function numeric(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

async function loadLocationFeatures(windowHours: number): Promise<LocationFeatures[]> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const rows = await db
    .select({
      locationId: locationsTable.id,
      locationName: locationsTable.name,
      elevation: locationsTable.elevation,
      sampleCount: count(measurementsTable.id),
      rainfallAvg: avg(measurementsTable.rainfall),
      rainfallMax: max(measurementsTable.rainfall),
      soilMoistureAvg: avg(measurementsTable.soilMoisture),
      soilMoistureMax: max(measurementsTable.soilMoisture),
      tiltAngleAvg: avg(measurementsTable.tiltAngle),
      tiltAngleMax: max(measurementsTable.tiltAngle),
      accelerationAvg: avg(measurementsTable.acceleration),
      accelerationMax: max(measurementsTable.acceleration),
      temperatureAvg: avg(measurementsTable.temperature),
      humidityAvg: avg(measurementsTable.humidity),
      signalQualityAvg: avg(measurementsTable.signalQuality),
    })
    .from(locationsTable)
    .innerJoin(
      measurementsTable,
      and(
        eq(measurementsTable.locationId, locationsTable.id),
        gte(measurementsTable.timestamp, since),
      ),
    )
    .where(eq(locationsTable.status, "active"))
    .groupBy(locationsTable.id, locationsTable.name, locationsTable.elevation);

  return rows.map((row) => ({
    locationId: row.locationId,
    locationName: row.locationName,
    elevation: numeric(row.elevation),
    sampleCount: numeric(row.sampleCount),
    rainfallAvg: numeric(row.rainfallAvg),
    rainfallMax: numeric(row.rainfallMax),
    soilMoistureAvg: numeric(row.soilMoistureAvg),
    soilMoistureMax: numeric(row.soilMoistureMax),
    tiltAngleAvg: numeric(row.tiltAngleAvg),
    tiltAngleMax: numeric(row.tiltAngleMax),
    accelerationAvg: numeric(row.accelerationAvg),
    accelerationMax: numeric(row.accelerationMax),
    temperatureAvg: numeric(row.temperatureAvg),
    humidityAvg: numeric(row.humidityAvg),
    signalQualityAvg: numeric(row.signalQualityAvg),
  }));
}

async function main(): Promise<void> {
  const windowHours = numeric(process.env.LANDSAFE_PREDICTION_WINDOW_HOURS || 24);
  if (windowHours <= 0) {
    throw new Error("LANDSAFE_PREDICTION_WINDOW_HOURS must be greater than zero");
  }

  const features = await loadLocationFeatures(windowHours);
  if (features.length === 0) {
    console.log(`No measurements found in the last ${windowHours} hours; nothing to predict.`);
    return;
  }

  const workerPath = fileURLToPath(new URL("../ml/predict_xgboost.py", import.meta.url));
  const probabilities = await runXgboostWorker(
    process.env.LANDSAFE_PYTHON_BIN || "python",
    workerPath,
    features,
  );
  const analyzedAt = new Date();

  await db.transaction(async (tx) => {
    for (const row of features) {
      const probability = probabilities.get(row.locationId);
      if (probability === undefined) {
        throw new Error(`Missing prediction for location ${row.locationId}`);
      }
      const confidence = Math.min(95, 60 + Math.min(row.sampleCount, 35));
      const details = buildPredictionDetails(row, probability, confidence);

      await tx.insert(predictionsTable).values({
        locationId: row.locationId,
        riskLevel: details.riskLevel,
        probability: details.probability,
        confidence: details.confidence,
        potentialTriggers: details.potentialTriggers,
        recommendedActions: details.recommendedActions,
        evacuationSuggested: details.evacuationSuggested,
        explanation: details.explanation,
        historicalSimilarEvents: 0,
        analyzedAt,
      });
      await tx
        .update(locationsTable)
        .set({ riskLevel: details.riskLevel, updatedAt: analyzedAt })
        .where(eq(locationsTable.id, row.locationId));
    }
  });

  console.log(`Stored ${features.length} XGBoost predictions at ${analyzedAt.toISOString()}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

