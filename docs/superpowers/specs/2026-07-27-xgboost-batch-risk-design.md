# LandSafe XGBoost Batch Risk Design

## Goal

Add an offline batch job that converts recent sensor measurements into XGBoost
risk predictions, persists them in the existing `predictions` table, and keeps
the dashboard location risk summary in sync.

## Architecture

The TypeScript job owns database access through the existing `@workspace/db`
package. It aggregates recent measurements per active location, sends an ordered
feature matrix to a Python XGBoost worker over stdin/stdout JSON, and persists
the returned probabilities.

The Python worker loads a JSON XGBoost model artifact. A separate bootstrap
trainer creates a deterministic demonstration model so the pipeline can be
verified without claiming scientific accuracy. A production deployment must
replace that artifact with a model trained and validated on labeled landslide
events.

## Behavior

- Risk levels map from probability: normal below 35%, watch from 35%, alert from
  55%, and danger from 75%.
- Explanations, triggers, and recommended actions are generated from the sensor
  feature values and risk level.
- Each run inserts a new prediction history row and updates
  `locations.riskLevel`.
- Locations without measurements in the configured time window are skipped.
- The model feature order is explicit and shared with the worker request.

## Operation

The scripts package exposes commands for installing Python requirements,
training the bootstrap model, running predictions, testing, and typechecking.
The batch command reads the existing API server `.env` file for `DATABASE_URL`.

