import assert from "node:assert/strict";
import test from "node:test";

import { parseWorkerResponse } from "./runtime";

test("parses one XGBoost probability per requested location", () => {
  const result = parseWorkerResponse(
    JSON.stringify({
      engine: "xgboost",
      predictions: [
        { locationId: 2, probability: 64.25 },
        { locationId: 5, probability: 12.5 },
      ],
    }),
    [2, 5],
  );

  assert.deepEqual(result, new Map([[2, 64.25], [5, 12.5]]));
});

test("rejects incomplete worker output", () => {
  assert.throws(
    () =>
      parseWorkerResponse(
        JSON.stringify({
          engine: "xgboost",
          predictions: [{ locationId: 2, probability: 64.25 }],
        }),
        [2, 5],
      ),
    /missing prediction for location 5/i,
  );
});

test("rejects duplicate location predictions", () => {
  assert.throws(
    () =>
      parseWorkerResponse(
        JSON.stringify({
          engine: "xgboost",
          predictions: [
            { locationId: 2, probability: 64.25 },
            { locationId: 2, probability: 70 },
          ],
        }),
        [2],
      ),
    /duplicate prediction/i,
  );
});
