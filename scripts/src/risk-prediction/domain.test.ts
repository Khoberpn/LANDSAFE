import assert from "node:assert/strict";
import test from "node:test";

import {
  FEATURE_NAMES,
  buildPredictionDetails,
  riskLevelFromProbability,
  toModelFeatures,
  type LocationFeatures,
} from "./domain";

const sample: LocationFeatures = {
  locationId: 7,
  locationName: "Bukit Uji",
  elevation: 740,
  sampleCount: 12,
  rainfallAvg: 22,
  rainfallMax: 48,
  soilMoistureAvg: 68,
  soilMoistureMax: 82,
  tiltAngleAvg: 2.1,
  tiltAngleMax: 4.6,
  accelerationAvg: 0.18,
  accelerationMax: 0.42,
  temperatureAvg: 25,
  humidityAvg: 86,
  signalQualityAvg: 76,
};

test("maps model probability to LandSafe risk levels", () => {
  assert.equal(riskLevelFromProbability(0), "normal");
  assert.equal(riskLevelFromProbability(34.99), "normal");
  assert.equal(riskLevelFromProbability(35), "watch");
  assert.equal(riskLevelFromProbability(55), "alert");
  assert.equal(riskLevelFromProbability(75), "danger");
  assert.equal(riskLevelFromProbability(100), "danger");
});

test("serializes model features in the declared XGBoost order", () => {
  assert.deepEqual(FEATURE_NAMES, [
    "elevation",
    "sample_count",
    "rainfall_avg",
    "rainfall_max",
    "soil_moisture_avg",
    "soil_moisture_max",
    "tilt_angle_avg",
    "tilt_angle_max",
    "acceleration_avg",
    "acceleration_max",
    "temperature_avg",
    "humidity_avg",
    "signal_quality_avg",
  ]);
  assert.deepEqual(toModelFeatures(sample), [
    740, 12, 22, 48, 68, 82, 2.1, 4.6, 0.18, 0.42, 25, 86, 76,
  ]);
});

test("builds actionable danger details from elevated sensor values", () => {
  const details = buildPredictionDetails(sample, 82, 91);

  assert.equal(details.riskLevel, "danger");
  assert.equal(details.evacuationSuggested, true);
  assert.ok(details.potentialTriggers.some((item) => item.includes("curah hujan")));
  assert.ok(details.potentialTriggers.some((item) => item.includes("kelembapan tanah")));
  assert.ok(details.recommendedActions.some((item) => item.includes("evakuasi")));
  assert.match(details.explanation, /XGBoost/);
  assert.equal(details.confidence, 91);
});

test("rejects feature rows without measurement samples", () => {
  assert.throws(
    () => toModelFeatures({ ...sample, sampleCount: 0 }),
    /at least one measurement/i,
  );
});
