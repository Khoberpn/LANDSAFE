import json
import sys
from pathlib import Path


FEATURE_NAMES = [
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
]


def validate_request(payload):
    rows = payload.get("rows")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Request must contain a non-empty rows array")

    for row in rows:
        features = row.get("features")
        if not isinstance(row.get("locationId"), int):
            raise ValueError("Each row requires an integer locationId")
        if not isinstance(features, list) or len(features) != len(FEATURE_NAMES):
            raise ValueError(f"Each row must contain exactly {len(FEATURE_NAMES)} features")
        if any(not isinstance(value, (int, float)) for value in features):
            raise ValueError("All feature values must be numeric")

    return rows


def normalize_predictions(values):
    return [round(min(1.0, max(0.0, float(value))) * 100, 2) for value in values]


def predict(payload, model_path):
    try:
        import xgboost as xgb
    except ImportError as exc:
        raise RuntimeError(
            "xgboost is not installed; run: python -m pip install -r scripts/ml/requirements.txt"
        ) from exc

    rows = validate_request(payload)
    if not model_path.exists():
        raise FileNotFoundError(
            f"Model not found at {model_path}; run the ml:train script first"
        )

    booster = xgb.Booster()
    booster.load_model(model_path)
    matrix = xgb.DMatrix(
        [row["features"] for row in rows],
        feature_names=FEATURE_NAMES,
    )
    probabilities = normalize_predictions(booster.predict(matrix))

    return {
        "engine": "xgboost",
        "modelPath": str(model_path),
        "predictions": [
            {"locationId": row["locationId"], "probability": probability}
            for row, probability in zip(rows, probabilities)
        ],
    }


def main():
    default_model = Path(__file__).parent / "models" / "landslide-risk-xgboost.json"
    payload = json.load(sys.stdin)
    result = predict(payload, default_model)
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)

