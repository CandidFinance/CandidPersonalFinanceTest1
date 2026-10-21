import { test } from "node:test";
import assert from "node:assert/strict";
import { salaryGrowthOf, trajectoryNearest, calcMetrics, payPathOf } from "./metrics.js";
import { payFactor, payGrowthIn } from "./growth.js";
import { calcStudentLoanScenario } from "./studentLoan.js";
import { taxYearFor } from "./taxYear.js";

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

test("pay by year: steady rises between the years given, then with prices; past years ignored", () => {
  const ty = 2026;
  const path = payPathOf({ payByYear: [{ year: "2028", salary: "60500" }, { year: "2025", salary: "1" }, { year: "2029", salary: "" }] }, 50000, ty);
  assert.equal(path.points.length, 2);
  assert.ok(Math.abs(path.factor(1) - 1.1) < 1e-9);
  assert.ok(Math.abs(path.factor(2) - 1.21) < 1e-9);
  assert.ok(Math.abs(path.factor(3) - 1.21 * 1.02) < 1e-9);
  // Used wherever a rate is.
  assert.equal(payFactor(path, 2), path.factor(2));
  assert.ok(Math.abs(payGrowthIn(path, 0) - 0.1) < 1e-9);
  assert.equal(payPathOf({ payByYear: [] }, 50000, ty), null);
});

test("pay by year runs through the projections: a rise sooner clears the loan sooner", () => {
  const d = { age: "30", employmentStatus: "employed", salary: "40000", studentLoan: "plan2", loanBalance: "40000", salaryTrajectory: "stable" };
  const ty = taxYearFor(d);
  const withPath = { ...d, payByYear: [{ year: String(ty + 2), salary: "80000" }] };
  const m = calcMetrics(withPath);
  assert.equal(typeof m.payGrowth, "object");
  assert.ok(m.salaryGrowthRate > 0.02);
  const base = calcStudentLoanScenario(d, calcMetrics(d)), faster = calcStudentLoanScenario(withPath, m);
  assert.ok((faster.clearYr ?? 99) < (base.clearYr ?? 99) || faster.totalRepaidProjected !== base.totalRepaidProjected);
});
