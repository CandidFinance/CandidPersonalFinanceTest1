import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { calcStudentLoanScenario, describeLoanVsPension, slRepaymentThreshold, studentLoanPlanConstants, SL_REPAYMENT_THRESHOLDS } from "./studentLoan.js";
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
  assert.equal(borrower({ salary: "85000" }).m.annualRepayment, (85000 - 29385) * 0.09);
  assert.equal(borrower({ salary: "40000", studentLoan: "plan1" }).m.annualRepayment, (40000 - 26900) * 0.09);
  assert.equal(borrower({ salary: "40000", studentLoan: "plan5" }).m.annualRepayment, (40000 - 25000) * 0.09);
  assert.equal(borrower({ salary: "29000" }).m.annualRepayment, 0);
  assert.equal(slRepaymentThreshold("none"), 0);
  assert.equal(studentLoanPlanConstants("plan2").threshold, SL_REPAYMENT_THRESHOLDS.plan2);
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
