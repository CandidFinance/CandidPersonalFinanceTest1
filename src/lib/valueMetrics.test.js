import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { bankChange, unbankChange } from "./moduleStatus.js";
import { rentVsBuyDecision, studentLoanDecision, decisionRowFields, gainedRowFields, bankedDiff } from "./valueMetrics.js";

// Cash & savings and Pension answered, so the loan's verdict is in.
const verdictIn = { selectedModules: ["cash", "pension", "studentLoan"], answeredModules: ["cash", "pension", "studentLoan"] };
const borrower = overrides => {
  const d = {
    salary: "60000", salaryTrajectory: "stable", monthlyExpenses: "2600",
    cashTiers: [{ amount: "5000", rate: "3.0" }],
    hasPension: "yes", myContribution: "5", employerMatch: "6", pensionType: "sacrifice",
    studentLoan: "plan5", loanBalance: "5000", studentLoanRate: "4.1",
    ...verdictIn, ...overrides,
  };
  return { d, m: calcMetrics(d, { isaRate: 3.5 }) };
};

test("rent vs buy: buying ahead at the horizon is 'buy', the gap rounded to £100 either way", () => {
  assert.deepEqual(rentVsBuyDecision({ gapAtHorizon: 12345, horizonYears: 10 }), { id: "rentVsBuy", result: "buy", gap: 12300, years: 10 });
  assert.deepEqual(rentVsBuyDecision({ gapAtHorizon: -8760, horizonYears: 5 }), { id: "rentVsBuy", result: "rent", gap: 8800, years: 5 });
  assert.equal(rentVsBuyDecision({ gapAtHorizon: 30, horizonYears: 5 }).result, "even");
  assert.equal(rentVsBuyDecision(null), null);
});

test("student loan: no decision until the verdict is in, or with no loan", () => {
  const { d, m } = borrower({ selectedModules: ["studentLoan"], answeredModules: ["studentLoan"] });
  assert.equal(studentLoanDecision(d, m), null);
  const none = borrower({ studentLoan: "none" });
  assert.equal(studentLoanDecision(none.d, none.m), null);
});

test("student loan: a loan that beats savings is 'overpay', its gap the total benefit", () => {
  const { d, m } = borrower();
  const decision = studentLoanDecision(d, m);
  assert.equal(decision.result, "overpay");
  assert.ok(decision.gap > 0);
});

test("student loan: one heading for write-off with no spare cash is 'leave', its gap what paying off today would cost", () => {
  const { d, m } = borrower({ salary: "32000", studentLoan: "plan2", loanBalance: "60000", studentLoanRate: undefined, cashTiers: [{ amount: "2000", rate: "3.0" }] });
  const decision = studentLoanDecision(d, m);
  assert.equal(decision.result, "leave");
  assert.ok(decision.gap > 0);
});

test("student loan: one that clears anyway but earns less than savings is 'leave', its gap what savings earn above the interest saved", () => {
  const { d, m } = borrower({ salary: "58000", studentLoan: "plan1", loanBalance: "6000", studentLoanRate: undefined, cashTiers: [{ amount: "6000", rate: "1.5" }] });
  const decision = studentLoanDecision(d, m);
  assert.equal(decision.result, "leave");
  assert.ok(decision.gap > 0);
});

test("row fields: nothing seen is null, a seen decision is its result and gap", () => {
  assert.deepEqual(decisionRowFields({}), { rent_vs_buy_result: null, rent_vs_buy_gap_gbp: null, student_loan_result: null, student_loan_gap_gbp: null });
  const row = decisionRowFields({ decisionsInformed: { studentLoan: { result: "leave", gap: 21000, years: 25, on: "2026-10-26" } } });
  assert.equal(row.student_loan_result, "leave");
  assert.equal(row.student_loan_gap_gbp, 21000);
  assert.equal(row.rent_vs_buy_result, null);
  assert.deepEqual(gainedRowFields({}), { gained_per_year_gbp: 0, gained_so_far_gbp: 0 });
});

test("banked diff: a change made is positive for its module, taking it back negative", () => {
  const before = {};
  const after = { moduleBaselines: bankChange(before, "studentLoan", 400, "2026-10-20") };
  assert.deepEqual(bankedDiff(before, after), [{ key: "studentLoan", perYear: 400 }]);
  const undone = { moduleBaselines: unbankChange(after, "studentLoan", 400, "2026-10-20") };
  assert.deepEqual(bankedDiff(after, undone), [{ key: "studentLoan", perYear: -400 }]);
  assert.deepEqual(bankedDiff(after, after), []);
  assert.equal(gainedRowFields(after, new Date(2026, 9, 26)).gained_per_year_gbp, 400);
});
