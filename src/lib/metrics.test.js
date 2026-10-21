import { test } from "node:test";
import assert from "node:assert/strict";
import { salaryGrowthOf, trajectoryNearest, calcMetrics } from "./metrics.js";

test("pay growth: their own rate (1% to 10%) over the band they picked, else 2%", () => {
  assert.equal(salaryGrowthOf({ salaryTrajectory: "moderate" }), 0.05);
  assert.ok(Math.abs(salaryGrowthOf({ salaryTrajectory: "moderate", salaryGrowthPct: "7.92" }) - 0.0792) < 1e-12);
  assert.equal(salaryGrowthOf({ salaryGrowthPct: "14" }), 0.10);
  assert.equal(salaryGrowthOf({ salaryGrowthPct: "0.4" }), 0.01);
  assert.equal(salaryGrowthOf({ salaryGrowthPct: "" }), 0.02);
  assert.equal(salaryGrowthOf({}, 0.03), 0.03);
  assert.equal(calcMetrics({ salary: "42000", salaryGrowthPct: "6" }).salaryGrowthRate, 0.06);
});

test("the band nearest a rate of their own", () => {
  assert.deepEqual([1, 3, 4, 7, 8, 10].map(trajectoryNearest), ["stable", "stable", "moderate", "moderate", "high", "high"]);
});
