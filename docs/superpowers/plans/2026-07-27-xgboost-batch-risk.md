# LandSafe XGBoost Batch Risk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify an XGBoost batch prediction pipeline for the LandSafe dashboard.

**Architecture:** A TypeScript batch job aggregates Postgres sensor data and persists predictions through Drizzle. A Python worker loads a deterministic bootstrap XGBoost model and communicates with the job using JSON over stdin/stdout.

**Tech Stack:** TypeScript, Node.js test runner, Drizzle ORM, PostgreSQL, Python, XGBoost

---

### Task 1: Risk-domain helpers

**Files:**
- Create: `scripts/src/risk-prediction/domain.test.ts`
- Create: `scripts/src/risk-prediction/domain.ts`

- [ ] Write tests for probability thresholds, feature order, trigger generation, and empty sample handling.
- [ ] Run `node --import tsx --test ./src/risk-prediction/domain.test.ts` and verify the missing-module failure.
- [ ] Implement the minimal domain helpers and types.
- [ ] Re-run the focused tests and verify they pass.

### Task 2: XGBoost worker and bootstrap artifact

**Files:**
- Create: `scripts/ml/requirements.txt`
- Create: `scripts/ml/train_bootstrap_model.py`
- Create: `scripts/ml/predict_xgboost.py`
- Create: `scripts/ml/models/.gitkeep`

- [ ] Define the exact ordered feature contract in both scripts.
- [ ] Generate deterministic synthetic labeled samples in the trainer.
- [ ] Train and save an XGBoost JSON model with metadata identifying it as a demo bootstrap artifact.
- [ ] Make the worker validate input, load the artifact, and emit probabilities as JSON.
- [ ] Install requirements, train the artifact, and verify one worker request.

### Task 3: Database batch orchestration

**Files:**
- Create: `scripts/src/predict-risk.ts`
- Modify: `scripts/package.json`

- [ ] Aggregate recent measurements by active location with explicit numeric coercion.
- [ ] Invoke the Python worker and validate its response.
- [ ] Insert prediction history and update each location risk level in one database transaction.
- [ ] Add `test`, `ml:train`, and `predict:risk` package scripts.
- [ ] Run script typechecking.

### Task 4: Documentation and verification

**Files:**
- Create: `docs/xgboost-batch-job.md`
- Modify: `artifacts/landsafe/src/pages/AiRisk.tsx`

- [ ] Document bootstrap limitations, setup, configuration, scheduler usage, and production model replacement.
- [ ] Rename the model summary label to XGBoost summary.
- [ ] Run focused tests, scripts typecheck, workspace typecheck, Python syntax checks, model training, and worker inference.

