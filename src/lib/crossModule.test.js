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

test("a module opened and skipped isn't counted: the total is answered modules only", async () => {
  const { computeModuleStatuses, getModuleBreakdown } = await import("./moduleStatus.js");
  const d = { age: "26", salary: "38000", studentLoan: "plan2", loanBalance: "52000", selectedModules: ["studentLoan", "pension"], answeredModules: ["studentLoan"] };
  const m = calcMetrics(d);
  assert.equal(getModuleBreakdown(d, m, computeModuleStatuses(d, m), null).totalOpp, 0);
  const answered = { ...d, answeredModules: ["studentLoan", "pension"] };
  assert.ok(getModuleBreakdown(answered, m, computeModuleStatuses(answered, m), null).totalOpp > 0);
  const before = { ...d, answeredModules: undefined };
  assert.ok(getModuleBreakdown(before, m, computeModuleStatuses(before, m), null).totalOpp > 0);
});

test("banked: what a module's £ has come down by since it was first answered", async () => {
  const { computeModuleStatuses, getModuleBreakdown, baselinePatch, bankPatch } = await import("./moduleStatus.js");
  const d = { age: "32", salary: "45000", selectedModules: ["pension"], hasPension: "yes", pensionStatus: "yes", myContribution: "3", employerMatch: "5", potValue: "30000", pensionType: "relief" };
  const m = calcMetrics(d);
  const baselines = baselinePatch(d, computeModuleStatuses(d, m));
  assert.equal(baselines.pension.amount, 900);
  assert.equal(baselinePatch({ ...d, moduleBaselines: baselines }, computeModuleStatuses(d, m)), null);
  const acted = { ...d, myContribution: "5", moduleBaselines: baselines };
  const breakdown = x => getModuleBreakdown(x, calcMetrics(x), computeModuleStatuses(x, calcMetrics(x)), null);
  // Waits for the user to say they made the change.
  let b = breakdown(acted);
  assert.equal(b.moduleList.find(x => x.key === "pension").pending, 900);
  assert.equal(b.totalBanked, 0);
  assert.equal(b.totalOpp, 0);
  const made = { ...acted, moduleBaselines: bankPatch(acted, "pension", 0, true) };
  b = breakdown(made);
  assert.equal(b.totalBanked, 900);
  assert.equal(b.moduleList.find(x => x.key === "pension").pending, 0);
  // A correction moves the baseline and banks nothing.
  const corrected = { ...acted, moduleBaselines: bankPatch(acted, "pension", 0, false) };
  assert.equal(breakdown(corrected).totalBanked, 0);
  assert.equal(breakdown(corrected).moduleList.find(x => x.key === "pension").pending, 0);
  // Cash's £ moving because of a pension change isn't banked on Cash.
  const cash = { ...d, selectedModules: ["pension", "cash"], monthlyExpenses: "1800", cashTiers: [{ amount: "15000", rate: "1" }] };
  const cashBase = baselinePatch(cash, computeModuleStatuses(cash, calcMetrics(cash)));
  const after = { ...cash, myContribution: "5", moduleBaselines: cashBase };
  const ab = breakdown(after);
  assert.equal(ab.moduleList.find(x => x.key === "cash").pending, 0);
  assert.equal(ab.moduleList.find(x => x.key === "pension").pending, 900);
});
