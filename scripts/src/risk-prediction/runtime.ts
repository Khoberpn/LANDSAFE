import { spawn } from "node:child_process";

import type { LocationFeatures } from "./domain";
import { toModelFeatures } from "./domain";

interface WorkerPrediction {
  locationId: number;
  probability: number;
}

interface WorkerResponse {
  engine: string;
  predictions: WorkerPrediction[];
}

export function parseWorkerResponse(
  output: string,
  expectedLocationIds: number[],
): Map<number, number> {
  const parsed = JSON.parse(output) as Partial<WorkerResponse>;
  if (parsed.engine !== "xgboost" || !Array.isArray(parsed.predictions)) {
    throw new Error("Invalid XGBoost worker response");
  }

  const probabilities = new Map<number, number>();
  for (const prediction of parsed.predictions) {
    if (
      !Number.isInteger(prediction?.locationId) ||
      !Number.isFinite(prediction?.probability) ||
      prediction.probability < 0 ||
      prediction.probability > 100
    ) {
      throw new Error("Invalid prediction returned by XGBoost worker");
    }
    if (probabilities.has(prediction.locationId)) {
      throw new Error(`Duplicate prediction for location ${prediction.locationId}`);
    }
    probabilities.set(prediction.locationId, prediction.probability);
  }

  for (const locationId of expectedLocationIds) {
    if (!probabilities.has(locationId)) {
      throw new Error(`Missing prediction for location ${locationId}`);
    }
  }
  if (probabilities.size !== expectedLocationIds.length) {
    throw new Error("XGBoost worker returned an unexpected location");
  }

  return probabilities;
}

export async function runXgboostWorker(
  pythonBinary: string,
  workerPath: string,
  rows: LocationFeatures[],
): Promise<Map<number, number>> {
  const request = JSON.stringify({
    rows: rows.map((row) => ({
      locationId: row.locationId,
      features: toModelFeatures(row),
    })),
  });

  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(pythonBinary, [workerPath], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `XGBoost worker exited with code ${code}`));
    });
    child.stdin.end(request);
  });

  return parseWorkerResponse(output, rows.map((row) => row.locationId));
}
