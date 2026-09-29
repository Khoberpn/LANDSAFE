import json
import random
from pathlib import Path

import xgboost as xgb

from predict_xgboost import FEATURE_NAMES


def build_bootstrap_dataset(sample_count=2500, seed=20260727):
    randomizer = random.Random(seed)
    features = []
    labels = []

    for _ in range(sample_count):
        row = [
            randomizer.uniform(100, 1800),
            randomizer.randint(4, 96),
            randomizer.uniform(0, 60),
            randomizer.uniform(0, 120),
            randomizer.uniform(20, 95),
            randomizer.uniform(25, 100),
            randomizer.uniform(0, 6),
            randomizer.uniform(0, 12),
            randomizer.uniform(0, 0.6),
            randomizer.uniform(0, 1.2),
            randomizer.uniform(16, 36),
            randomizer.uniform(35, 100),
            randomizer.uniform(20, 100),
        ]
        score = (
            row[3] / 120 * 0.25
            + row[5] / 100 * 0.25
            + row[7] / 12 * 0.22
            + row[9] / 1.2 * 0.18
            + row[0] / 1800 * 0.05
            + row[11] / 100 * 0.05
        )
        label = 1 if score + randomizer.uniform(-0.08, 0.08) >= 0.58 else 0
        features.append(row)
        labels.append(label)

    return features, labels


def main():
    output_dir = Path(__file__).parent / "models"
    output_dir.mkdir(parents=True, exist_ok=True)
    model_path = output_dir / "landslide-risk-xgboost.json"

    features, labels = build_bootstrap_dataset()
    matrix = xgb.DMatrix(features, label=labels, feature_names=FEATURE_NAMES)
    params = {
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "max_depth": 4,
        "eta": 0.08,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "seed": 20260727,
        "nthread": 2,
    }
    model = xgb.train(params, matrix, num_boost_round=100)
    model.save_model(model_path)

    metadata = {
        "modelType": "xgboost-bootstrap-demo",
        "productionReady": False,
        "featureNames": FEATURE_NAMES,
        "trainingRows": len(features),
        "warning": "Replace with a model trained and validated on labeled landslide events.",
    }
    model_path.with_suffix(".metadata.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )
    print(f"Bootstrap model written to {model_path}")


if __name__ == "__main__":
    main()

