# LandSafe XGBoost Batch Job

The batch job aggregates recent sensor measurements, runs an XGBoost model, and
writes prediction history to `predictions`. It also updates
`locations.riskLevel`, so both the AI Risk page and dashboard summary stay in
sync.

## Initial setup

From the repository root:

```powershell
python -m pip install -r scripts/ml/requirements.txt
pnpm --filter @workspace/scripts run ml:train
```

The trainer creates `scripts/ml/models/landslide-risk-xgboost.json`. This is a
deterministic bootstrap demonstration model trained on synthetic labels. It
verifies the software pipeline but is not a scientifically validated landslide
model. Replace it before production with an artifact trained and evaluated on
labeled field events using the same feature names and order.

## Run predictions

Make sure `artifacts/api-server/.env` contains a valid `DATABASE_URL`, then run:

```powershell
pnpm --filter @workspace/scripts run predict:risk
```

Optional environment variables:

- `LANDSAFE_PYTHON_BIN`: Python executable, default `python`.
- `LANDSAFE_PREDICTION_WINDOW_HOURS`: measurement window, default `24`.

Locations with no measurements in the selected window are skipped. Each
successful run inserts a new prediction row and updates the current location
risk level in one database transaction.

## Scheduling

Run the `predict:risk` command from Windows Task Scheduler or another scheduler.
A 15-minute interval is a reasonable starting point; align it with the actual
sensor reporting frequency and operational response policy.

## Verification

```powershell
pnpm --filter @workspace/scripts run test
python -m unittest discover -s scripts/ml -p "test_*.py"
pnpm --filter @workspace/scripts run typecheck
```

