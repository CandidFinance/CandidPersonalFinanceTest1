import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { calcStudentLoanScenario, calcOverpaymentScenarios } from "./studentLoan.js";
import { planExtras, projectPlan, runPlan, planEvents, newPlan } from "./loanPlan.js";

const d = { age: "30", employmentStatus: "employed", salary: "60000", studentLoan: "plan2", loanBalance: "45000", salaryGrowthPct: "5", cashTiers: [{ amount: "20000", rate: "4" }] };
const m = calcMetrics(d), sl = calcStudentLoanScenario(d, m);
const taxYear = sl.writeOffTaxYear - sl.writeOffYr;

test("a plan of one payment now is the lump sum today", () => {
  const plan = { items: [{ kind: "once", amount: "10000", year: String(taxYear) }] };
  const run = runPlan(m, sl, plan);
  const lump = calcOverpaymentScenarios(m, sl, [10000]).scenarios[0];
  assert.deepEqual([run.clearYr, run.totalPaid, run.paidToday], [lump.clearYr, lump.totalPaid, lump.paidToday]);
  assert.deepEqual(run.path, lump.path);
  assert.equal(run.base.clearYr, sl.clearYr);
});

test("when payments land: a one-off at the start of its tax year, a year of monthly payments at its end", () => {
  const extras = planExtras({ items: [
    { kind: "once", amount: "5000", year: String(taxYear + 2) },
    { kind: "monthly", amount: "200", from: String(taxYear), to: String(taxYear + 1) },
  ] }, taxYear, 10);
  assert.deepEqual(extras.slice(0, 4), [0, 2400, 7400, 0]);
  // Until cleared: every year to the write-off.
  assert.equal(planExtras({ items: [{ kind: "monthly", amount: "100", from: String(taxYear), to: "" }] }, taxYear, 5).filter(x => x === 1200).length, 5);
});

test("nothing is paid in once it's cleared, and the payments made are what's compared", () => {
  const run = runPlan(m, sl, { items: [{ kind: "monthly", amount: "2000", from: String(taxYear), to: "" }] });
  assert.ok(run.clearYr < sl.clearYr);
  assert.ok(run.absorbed.slice(run.clearYr + 1).every(a => a === 0));
  assert.equal(planEvents(run).reduce((t, e) => t + e.amount, 0), run.absorbed.reduce((t, a) => t + a, 0));
});

test("new plans take the next free name", () => {
  assert.equal(newPlan([]).name, "Plan A");
  assert.equal(newPlan([{ name: "Plan A" }, { name: "Plan C" }]).name, "Plan B");
});
