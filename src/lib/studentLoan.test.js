import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { calcStudentLoanScenario, describeLoanVsPension, resolveSlRate, slRepaymentThreshold, studentLoanPlanConstants, SL_REPAYMENT_THRESHOLDS, studentLoanPlanFrom, pensionCaveat } from "./studentLoan.js";
import { calcLoanMarginalReturnCurve } from "./forecast.js";

const RATES = { isaRate: 4.5, nonIsaRate: 4.6 };
const borrower = (overrides, rates = RATES) => {
  const d = {
    salary: "95000", salaryTrajectory: "stable", monthlyExpenses: "2600",
    cashTiers: [{ amount: "30000", rate: "3.0" }],
    hasPension: "yes", myContribution: "5", employerMatch: "6", pensionType: "sacrifice",
    studentLoan: "plan2", loanBalance: "45000",
    ...overrides,
  };
  const m = calcMetrics(d, rates);
  return { d, m, sl: calcStudentLoanScenario(d, m) };
};

test("repayments use the 2026/27 thresholds: 9% of pay above them", () => {
  // The borrower pays 5% into the pension by salary sacrifice, which comes
  // off the pay repayments are taken from.
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} is not ${b}`);
  near(borrower({ salary: "85000" }).m.annualRepayment, (85000 * 0.95 - 29385) * 0.09);
  near(borrower({ salary: "40000", studentLoan: "plan1" }).m.annualRepayment, (40000 * 0.95 - 26900) * 0.09);
  near(borrower({ salary: "40000", studentLoan: "plan5" }).m.annualRepayment, (40000 * 0.95 - 25000) * 0.09);
  assert.equal(borrower({ salary: "29000" }).m.annualRepayment, 0);
  assert.equal(slRepaymentThreshold("none"), 0);
  assert.equal(studentLoanPlanConstants("plan2").threshold, SL_REPAYMENT_THRESHOLDS.plan2);
});

test("interest uses the 2026/27 rates: RPI 4.1%, Plan 2 ramp capped at 6%", () => {
  assert.equal(resolveSlRate({ studentLoan: "plan1" }, 40000), 0.041);
  assert.equal(resolveSlRate({ studentLoan: "plan5" }, 40000), 0.041);
  assert.equal(resolveSlRate({ studentLoan: "plan2" }, 29000), 0.041);
  assert.equal(resolveSlRate({ studentLoan: "plan2" }, 45000), 0.06); // gov.uk: 6.09%, capped at 6%
  assert.equal(resolveSlRate({ studentLoan: "plan2", studentLoanRate: "5" }, 45000), 0.05);
});

// A rate the user typed in holds for every year, so these weigh a flat 6%.
test("overpaying is weighed against the best savings rate, not a poorer current one", () => {
  const { sl } = borrower({ studentLoanRate: "6" });
  assert.equal(sl.cashRate, 4.5);
  assert.equal(sl.effectiveBenefit, 1.5);
  // The gain is each year's 1.5% gap on that year's balance, so less than
  // 1.5% of today's £45,000 every year: a total, and that a year on average
  // until it would have cleared.
  assert.equal(sl.overpayTotalBenefit, sl.interestAvoided - sl.savingsForgone);
  assert.equal(sl.overpayAnnualBenefit, Math.round(sl.overpayTotalBenefit / sl.clearYr));
  assert.ok(sl.overpayAnnualBenefit > 0 && sl.overpayAnnualBenefit < 675);
});

test("Plan 2 is weighed on its average rate over the loan's life: 6% now, RPI at 2% after", () => {
  const { sl } = borrower({});
  assert.equal(sl.slRatePct, 6);
  assert.ok(sl.lifeRatePct < 6 && sl.lifeRatePct >= 5, `life rate ${sl.lifeRatePct}`);
  assert.equal(sl.pensionGap < 0, true);
  // Decided against savings: the pension is a caveat, not a veto.
  assert.equal(sl.worthOverpaying, sl.effectiveBenefit > 0);
  assert.match(pensionCaveat(sl), /isn't guaranteed, and money in a pension is locked away until 57/);
});

test("the user's own rate counts when it beats the best rate on offer", () => {
  const { sl } = borrower({ cashTiers: [{ amount: "30000", rate: "5.0" }] });
  assert.equal(sl.cashRate, 5);
});

test("a loan rate below the best savings rate isn't worth overpaying, even against a poor current rate", () => {
  const { sl } = borrower({ salary: "58000", studentLoan: "plan1", loanBalance: "6000", cashTiers: [{ amount: "6000", rate: "1.5" }] });
  assert.equal(sl.willClear, true);
  assert.equal(sl.worthOverpaying, false);
  assert.equal(sl.overpayAnnualBenefit, 0);
});

test("a 6% loan against the pension's 6% growth is a tie, and a tie goes to overpaying", () => {
  const { sl } = borrower({ studentLoanRate: "6" });
  assert.equal(sl.pensionGap, 0);
  assert.equal(sl.beatsPension, true);
  assert.equal(sl.worthOverpaying, true);
  assert.match(describeLoanVsPension(sl), /^Level/);
});

test("a loan that beats savings is worth paying off from cash, the pension's faster growth a caveat", () => {
  const { sl } = borrower(
    { salary: "60000", studentLoan: "plan5", loanBalance: "5000", studentLoanRate: "4.1", cashTiers: [{ amount: "5000", rate: "3.0" }] },
    { isaRate: 3.5 },
  );
  assert.equal(sl.willClear, true);
  assert.equal(sl.effectiveBenefit, 0.6);
  assert.equal(sl.pensionGap, -1.9);
  assert.equal(sl.worthOverpaying, true);
  assert.ok(sl.overpayAnnualBenefit > 0);
  assert.match(pensionCaveat(sl), /^A pension could grow more: it's assumed to grow 6% a year, against the loan's 4\.1%/);
});

test("no pension caveat when the loan's rate beats or matches the pension's growth", () => {
  assert.equal(pensionCaveat(borrower({ studentLoanRate: "6" }).sl), null);
});

test("chart: equal rates put the pension line on the loan line", () => {
  const { d, m, sl } = borrower({});
  const curve = calcLoanMarginalReturnCurve(d, m, sl);
  for (const p of curve.data) assert.ok(Math.abs(p.pension - p.ratio) < 1e-9);
  assert.equal(curve.path, curve.pensionPath);
});

test("chart: a loan growing slower than the pension puts the pension line above it throughout", () => {
  const { d, m, sl } = borrower({ studentLoanRate: "4" });
  const curve = calcLoanMarginalReturnCurve(d, m, sl);
  for (const p of curve.data) assert.ok(p.pension >= p.ratio);
  assert.ok(curve.data.some(p => p.pension > p.ratio));
});

test("plan from where you lived, the course and when it started (GOV.UK rules)", () => {
  const plan = (country, course, start) => studentLoanPlanFrom({ country, course, start });
  assert.equal(plan("england", "undergrad", "pre2012"), "plan1");
  assert.equal(plan("england", "undergrad", "2012to2023"), "plan2");
  assert.equal(plan("england", "undergrad", "2023on"), "plan5");
  assert.equal(plan("wales", "undergrad", "pre2012"), "plan1");
  assert.equal(plan("wales", "undergrad", "2012on"), "plan2");
  assert.equal(plan("england", "postgrad"), "postgrad");
  assert.equal(plan("wales", "postgrad"), "postgrad");
  assert.equal(plan("scotland"), "plan4");
  assert.equal(plan("ni"), "plan1");
  // Not enough to tell yet.
  assert.equal(plan("england"), null);
  assert.equal(plan("england", "undergrad"), null);
  assert.equal(plan(), null);
});

test("pay growth counts: a loan that never clears on today's pay can clear as pay rises", () => {
  const d = { salary: "52000", studentLoan: "plan2", loanBalance: "60000" };
  const flat = calcStudentLoanScenario({ ...d }, { ...calcMetrics(d), salaryGrowthRate: 0 });
  assert.equal(flat.willClear, false);
  const rising = { ...d, salaryTrajectory: "moderate" };
  const sl = calcStudentLoanScenario(rising, calcMetrics(rising));
  assert.equal(sl.willClear, true);
  // The scenario and the metrics agree on whether it clears.
  assert.equal(calcMetrics(rising).willClear, true);
});

test("pay rises at the expected rate for ten years, then with prices", async () => {
  const { payFactor } = await import("./growth.js");
  assert.equal(payFactor(0.10, 0), 1);
  assert.ok(Math.abs(payFactor(0.10, 10) - Math.pow(1.1, 10)) < 1e-9);
  assert.ok(Math.abs(payFactor(0.10, 12) - Math.pow(1.1, 10) * 1.02 * 1.02) < 1e-9);
  // Faster pay clears a loan that pay rising with prices doesn't.
  const { calcMetrics } = await import("./metrics.js");
  const grad = { studentLoan: "plan2", salary: "32000", age: "25", loanBalance: "55000", inputsTaxYear: 2026 };
  const slow = calcStudentLoanScenario({ ...grad, salaryTrajectory: "stable" }, calcMetrics({ ...grad, salaryTrajectory: "stable" }));
  const fast = calcStudentLoanScenario({ ...grad, salaryTrajectory: "high" }, calcMetrics({ ...grad, salaryTrajectory: "high" }));
  assert.equal(slow.willClear, false);
  assert.ok(fast.totalRepaidProjected > slow.totalRepaidProjected * 3);
});

test("a Postgraduate loan alongside Plan 2: its own loan, repaid at the same time, and in take-home pay", async () => {
  const { pgScenario, hasPgLoan } = await import("./studentLoan.js");
  const { calcMetrics } = await import("./metrics.js");
  const d = { studentLoan: "plan2", salary: "48000", age: "30", loanBalance: "45000", hasPgLoan: "yes", pgLoanBalance: "14000", inputsTaxYear: 2026 };
  const m = calcMetrics(d);
  assert.equal(m.pgRepayment, 1620); // 6% of £27,000
  assert.equal(m.annualRepayment, Math.round((48000 - 29385) * 0.09 * 100) / 100); // the main loan's, unchanged
  const pg = pgScenario(d, m);
  assert.equal(pg.slRatePct, 6);
  assert.equal(pg.annualRep, 1620);
  assert.equal(pg.writeOffTaxYear, calcStudentLoanScenario(d, m).writeOffTaxYear + 1);
  // Both come off take-home pay.
  assert.ok(Math.abs(calcMetrics({ ...d, hasPgLoan: "no" }).monthlyTakeHome - m.monthlyTakeHome - 1620 / 12) < 0.01);
  // Plan 4, or no balance: none.
  assert.equal(hasPgLoan({ ...d, studentLoan: "plan4" }), false);
  assert.equal(pgScenario({ ...d, pgLoanBalance: "" }, m), null);
});

test("what the loan costs left to clear, against paying it off today; and a lump sum's own path", async () => {
  const { loanCostComparison, calcOverpaymentScenarios } = await import("./studentLoan.js");
  // £18,500 on £70,000: clears in a few years.
  const d = { studentLoan: "plan2", salary: "70000", age: "33", loanBalance: "18500", inputsTaxYear: 2026 };
  const m = calcMetrics(d);
  const sl = calcStudentLoanScenario(d, m);
  const c = loanCostComparison(m, sl);
  assert.equal(sl.willClear, true);
  assert.equal(c.balance, 18500);
  assert.equal(c.interest, sl.totalRepaidProjected - 18500);
  assert.equal(c.interestPerYear, Math.round(c.interest / sl.clearYr));
  assert.ok(c.payNowSaves > 0);
  // A lump sum: its own line, starting below today's balance and clearing sooner.
  const { scenarios, baseProjection } = calcOverpaymentScenarios(m, sl, [5000]);
  assert.equal(scenarios[0].path[0].bal, 13500);
  assert.ok(scenarios[0].clearYr < baseProjection.clearYr);
  assert.equal(scenarios[0].path[scenarios[0].path.length - 1].bal, 0);
  // Paying the lot: cleared today.
  assert.equal(calcOverpaymentScenarios(m, sl, [18500]).scenarios[0].clearYr, 0);
  // Written off: paying today costs more than would ever be repaid.
  const grad = { studentLoan: "plan2", salary: "32000", age: "25", loanBalance: "52000", inputsTaxYear: 2026 };
  const gm = calcMetrics(grad);
  const gc = loanCostComparison(gm, calcStudentLoanScenario(grad, gm));
  assert.equal(gc.interest, null);
  assert.ok(gc.writtenOff > 0);
  assert.ok(gc.payNowSaves < 0);
});

test("a loan heading for write-off: the lump sum that clears it and comes out ahead, counting savings interest", async () => {
  const { bestLumpSum, calcOverpaymentScenarios } = await import("./studentLoan.js");
  // £60k on £62k, pay rising with prices: written off as it is.
  const d = { studentLoan: "plan2", salary: "62000", age: "30", loanBalance: "60000", salaryTrajectory: "stable", inputsTaxYear: 2026 };
  const m = calcMetrics(d);
  const sl = calcStudentLoanScenario(d, m);
  assert.equal(sl.willClear, false);
  // At today's best savings rate (about 5.1%), kept in savings the money
  // earns as much as the loan charges, so no lump sum comes out ahead.
  assert.equal(bestLumpSum(m, sl, 50000), null);
  // With savings earning about inflation (2%) over the long run, a big
  // enough one does.
  const best = bestLumpSum(m, { ...sl, cashRate: 2 }, 50000);
  assert.ok(best, "a lump sum within £50k comes out ahead at 2%");
  assert.ok(best.clearYr > 0 && best.saving > 0);
  // Small sums only shrink the write-off: they cost more.
  const small = calcOverpaymentScenarios(m, sl, [5000]);
  assert.equal(small.scenarios[0].clearYr, null);
  assert.ok(small.scenarios[0].totalPaid > small.baseProjection.totalPaid);
  assert.ok(best.clearsFrom > 5000 && best.clearsFrom <= best.amount);
  // Not enough spare cash to get there: nothing to suggest.
  assert.equal(bestLumpSum(m, { ...sl, cashRate: 2 }, 5000), null);
  // A loan that clears anyway is the overpaying answer's, not this one's.
  const clears = { ...d, salary: "90000", loanBalance: "30000" };
  const cm = calcMetrics(clears);
  assert.equal(bestLumpSum(cm, calcStudentLoanScenario(clears, cm), 50000), null);
});

test("finish years: only those each plan allows, and a year outside them is ignored", async () => {
  const { slFinishYearRange, slFirstDueRange, slFirstDueYearStated } = await import("./studentLoan.js");
  assert.deepEqual(slFinishYearRange("plan2", 2026), { min: 2015, max: 2029 });
  assert.deepEqual(slFinishYearRange("plan5", 2026), { min: 2025, max: 2031 });
  assert.deepEqual(slFinishYearRange("postgrad", 2026), { min: 2017, max: 2031 });
  assert.deepEqual(slFinishYearRange("plan1", 2026), { min: 1999, max: 2031 });
  assert.deepEqual(slFinishYearRange(null, 2026), { min: 1990, max: 2031 });
  assert.deepEqual(slFirstDueRange("plan2", 2026), { min: 2016, max: 2030 });
  assert.equal(slFirstDueYearStated({ studentLoan: "plan2", slFirstDueYear: "2020" }), 2020);
  for (const y of ["1500", "3000", "2010"]) assert.equal(slFirstDueYearStated({ studentLoan: "plan2", slFirstDueYear: y }), null);
});
