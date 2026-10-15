import { test } from "node:test";
import assert from "node:assert/strict";
import { reportStorageFailure, setStorageFailureReporter } from "./storage.js";

test("storage failures before the reporter is set are kept, then sent once each", () => {
  const boom = new Error("QuotaExceededError");
  reportStorageFailure("save_inputs", boom);
  reportStorageFailure("save_inputs", boom);
  reportStorageFailure("read_subscription", boom);
  const seen = [];
  setStorageFailureReporter((context, e) => seen.push([context, e.message]));
  assert.deepEqual(seen, [["save_inputs", "QuotaExceededError"], ["read_subscription", "QuotaExceededError"]]);
  // Later failures go straight out, still once per context.
  reportStorageFailure("save_inputs", boom);
  reportStorageFailure("load_inputs", boom);
  assert.deepEqual(seen.map(([c]) => c), ["save_inputs", "read_subscription", "load_inputs"]);
});
