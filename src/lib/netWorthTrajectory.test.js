// The Net worth line's monthly saving: Forecast passes only what the user
// typed (calcNetWorthTrajectory's surplusOverride), not our estimate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { calcNetWorthTrajectory } from "./forecast.js";

const d = { age: "38", employmentStatus: "employed", salary: "110000", monthlyExpenses: "3000", cashTiers: [{ amount: "25000", rate: "1" }] };

test("net worth: no saving counted until a monthly amount is given", () => {
  const m = calcMetrics(d);
  assert.ok(m.monthlySurplus > 0);
  const estimate = calcNetWorthTrajectory(d, m, 10);
  const none = calcNetWorthTrajectory(d, m, 10, 0);
  const typed = calcNetWorthTrajectory(d, m, 10, 500);
  assert.ok(none[10].netWorth < typed[10].netWorth);
  assert.ok(typed[10].netWorth < estimate[10].netWorth);
  // Passing the estimate itself is the same as leaving it out.
  assert.equal(calcNetWorthTrajectory(d, m, 10, m.monthlySurplus)[10].netWorth, estimate[10].netWorth);
});
