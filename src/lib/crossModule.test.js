import test from "node:test";
import assert from "node:assert/strict";
import { moduleEstimate, pensionOutlook, loanAlternatives } from "./crossModule.js";
import { calcMetrics } from "./metrics.js";

const base = { age: "32", salary: "45000", employmentStatus: "employed", salaryTrajectory: "stable" };

test("pension estimate: 1% to 3% of salary; self-employed get the relief on £100 a month", () => {
  const d = base, m = calcMetrics(d);
  assert.deepEqual(moduleEstimate("pension", d, m), { low: 450, high: 1350, line: "Employer money and tax relief often missed at your salary" });
  const se = { ...base, employmentStatus: "self_employed" };
  assert.equal(moduleEstimate("pension", se, calcMetrics(se)).high, 300); // £1,200 x 20/80
});

test("cash estimate: 3 to 6 months of spending, typical rate against the best", () => {
  const d = { ...base, monthlyExpenses: "2000" };
  const m = { ...calcMetrics(d), bestSavingsRate: 5 };
  assert.deepEqual([moduleEstimate("cash", d, m).low, moduleEstimate("cash", d, m).high], [120, 240]); // £6k/£12k x 2%
  assert.equal(moduleEstimate("cash", d, { ...m, bestSavingsRate: 2.5 }), null);
});

test("no estimate without the figures to support one", () => {
  const m = calcMetrics({});
  assert.equal(moduleEstimate("pension", {}, m), null);
  assert.equal(moduleEstimate("investments", base, calcMetrics(base)), null);
  assert.equal(moduleEstimate("studentLoan", base, calcMetrics(base)), null);
});

test("pension outlook: a basic-rate payer whose pot will pay out at higher rate", () => {
  const d = { ...base, hasPension: "yes", myContribution: "10", employerMatch: "10", potValue: "60000", retirementAge: "65" };
  const o = pensionOutlook(d, calcMetrics(d));
  const flag = o.flags.find(f => f.key === "retirementRate");
  assert.ok(o.retirementIncome > 50270, `income ${o.retirementIncome}`);
  assert.equal(flag.nowRate, 0.2);
  assert.equal(flag.laterRate, 0.4);
  assert.ok(flag.extraTax > 0);
});

test("pension outlook: salary growth passing £100,000 is found, and the year it happens", () => {
  const d = { ...base, salary: "80000", salaryTrajectory: "moderate", hasPension: "yes", myContribution: "5", employerMatch: "5", potValue: "50000", retirementAge: "65" };
  const trap = pensionOutlook(d, calcMetrics(d)).flags.find(f => f.key === "taxTrap");
  // £80k less 5% paid in is £76k adjusted; at 5% a year it passes £100k in year 6.
  assert.equal(trap.age, 38);
});

test("pension outlook: a large pot passes the tax-free cash limit", () => {
  const d = { ...base, age: "40", salary: "150000", hasPension: "yes", myContribution: "10", employerMatch: "10", potValue: "400000", retirementAge: "65" };
  const lsa = pensionOutlook(d, calcMetrics(d)).flags.find(f => f.key === "lumpSum");
  assert.ok(lsa && lsa.age < 65 && lsa.overCap > 0 && lsa.extraTax > 0);
});

test("pension outlook: nothing flagged for a modest pot at basic rate", () => {
  const d = { ...base, salary: "30000", hasPension: "yes", myContribution: "5", employerMatch: "3", potValue: "10000", retirementAge: "67" };
  assert.deepEqual(pensionOutlook(d, calcMetrics(d)).flags, []);
  assert.equal(pensionOutlook({ ...d, hasPension: "no" }, calcMetrics(d)), null);
});

test("student loan alternatives: £100 a month for 5 years in a pension, an ISA or savings, largest first", () => {
  const a = loanAlternatives({ tr: 0.2, bestSavingsRate: 4.5 });
  assert.equal(a.paidIn, 6000);
  assert.deepEqual(a.options.map(o => o.key), ["pension", "investments", "cash"]);
  assert.equal(a.options[0].monthlyIn, 125);
  assert.equal(a.options[0].total, 8720); // £125 a month at 6% for 5 years
  assert.equal(a.options[1].total, 6980);
  assert.equal(a.options[2].total, 6710);
});
