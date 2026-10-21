import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { calcStudentLoanScenario, calcOverpaymentScenarios } from "./studentLoan.js";
import { planPayments, projectPlan, runPlan, planEvents, newPlan, monthsFrom } from "./loanPlan.js";

const d = { age: "30", employmentStatus: "employed", salary: "60000", studentLoan: "plan2", loanBalance: "45000", salaryGrowthPct: "5", cashTiers: [{ amount: "20000", rate: "4" }] };
const m = calcMetrics(d), sl = calcStudentLoanScenario(d, m);
const now = new Date(2026, 9, 21); // 21 October 2026

test("a plan of one payment now is the lump sum today", () => {
  const plan = { items: [{ kind: "once", amount: "10000", month: "10", year: "2026" }] };
  const run = runPlan(m, sl, plan, now);
  const lump = calcOverpaymentScenarios(m, sl, [10000]).scenarios[0];
  assert.deepEqual([run.clearYr, run.totalPaid, run.paidToday], [lump.clearYr, lump.totalPaid, lump.paidToday]);
  assert.deepEqual(run.path, lump.path);
  assert.equal(run.base.clearYr, sl.clearYr);
});

test("when payments land: a one-off in its month, monthly payments at the end of each month", () => {
  assert.equal(monthsFrom(now, 2027, 4), 6);
  const pays = planPayments({ items: [
    { kind: "once", amount: "5000", month: "4", year: "2027" },
    { kind: "monthly", amount: "200", from: "2026", to: "2026" },
  ] }, 10, now);
  // Monthly from now (April 2026 has passed) to the end of March 2027: the
  // ends of October to March, six payments.
  assert.deepEqual(pays.map(p => [Math.round(p.t * 12), p.amount]), [[1, 200], [2, 200], [3, 200], [4, 200], [5, 200], [6, 5000], [6, 200]]);
  // Until it's cleared: every month to the end.
  assert.equal(planPayments({ items: [{ kind: "monthly", amount: "100", from: "2026", to: "" }] }, 5, now).length, 60);
  // Saved before months were asked: April.
  assert.equal(planPayments({ items: [{ kind: "once", amount: "100", year: "2027" }] }, 5, now)[0].t, 0.5);
});

test("paid partway through a year, it saves that year's interest for the rest of the year", () => {
  const early = projectPlan(m, sl, [{ t: 0.25, amount: 5000 }]), late = projectPlan(m, sl, [{ t: 0.75, amount: 5000 }]);
  assert.ok(early.path[1].bal < late.path[1].bal);
  assert.equal(Math.round(late.path[1].bal - early.path[1].bal), Math.round(5000 * (Math.pow(1 + sl.schedule[0].rate, 0.75) - Math.pow(1 + sl.schedule[0].rate, 0.25))));
});

test("nothing is paid in once it's cleared, and the payments made are what's compared", () => {
  const run = runPlan(m, sl, { items: [{ kind: "monthly", amount: "2000", from: "2026", to: "" }] }, now);
  assert.ok(run.clearYr < sl.clearYr);
  assert.ok(run.paid.filter(p => p.t > run.clearYr).every(p => p.amount === 0));
  assert.equal(planEvents(run).reduce((t, p) => t + p.amount, 0), run.paid.reduce((t, p) => t + p.amount, 0));
});

test("new plans take the next free name", () => {
  assert.equal(newPlan([]).name, "Plan A");
  assert.equal(newPlan([{ name: "Plan A" }, { name: "Plan C" }]).name, "Plan B");
});
