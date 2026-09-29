import unittest

from predict_xgboost import FEATURE_NAMES, normalize_predictions, validate_request


class PredictXGBoostTest(unittest.TestCase):
    def test_rejects_rows_with_wrong_feature_count(self):
        with self.assertRaisesRegex(ValueError, "13 features"):
            validate_request({"rows": [{"locationId": 1, "features": [1.0, 2.0]}]})

    def test_accepts_rows_matching_feature_contract(self):
        payload = {
            "rows": [
                {
                    "locationId": 9,
                    "features": [1.0] * len(FEATURE_NAMES),
                }
            ]
        }

        self.assertEqual(validate_request(payload), payload["rows"])

    def test_normalizes_binary_probabilities_to_percent(self):
        self.assertEqual(normalize_predictions([0.125, 0.999]), [12.5, 99.9])


if __name__ == "__main__":
    unittest.main()
