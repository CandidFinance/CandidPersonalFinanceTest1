import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { calcStudentLoanScenario, describeLoanVsPension, resolveSlRate, slRepaymentThreshold, studentLoanPlanConstants, SL_REPAYMENT_THRESHOLDS, studentLoanPlanFrom } from "./studentLoan.js";
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

test("overpaying is weighed against the best savings rate, not a poorer current one", () => {
  const { sl } = borrower({});
  assert.equal(sl.cashRate, 4.5);
  assert.equal(sl.effectiveBenefit, 1.5);
  assert.equal(sl.overpayAnnualBenefit, 675);
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
  const { sl } = borrower({});
  assert.equal(sl.pensionGap, 0);
  assert.equal(sl.beatsPension, true);
  assert.equal(sl.worthOverpaying, true);
  assert.match(describeLoanVsPension(sl), /^Level/);
});

test("the pension beats a loan that clears and beats savings but grows slower than 6%", () => {
  const { sl } = borrower(
    { salary: "60000", studentLoan: "plan5", loanBalance: "5000", studentLoanRate: "4.1", cashTiers: [{ amount: "5000", rate: "3.0" }] },
    { isaRate: 3.5 },
  );
  assert.equal(sl.willClear, true);
  assert.equal(sl.effectiveBenefit, 0.6);
  assert.equal(sl.pensionGap, -1.9);
  assert.equal(sl.worthOverpaying, false);
  assert.equal(sl.overpayAnnualBenefit, 0);
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
