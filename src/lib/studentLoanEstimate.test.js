import test from "node:test";
import assert from "node:assert/strict";
import { estimateSlBalance, slTuitionPerYear } from "./studentLoan.js";
import { calcMetrics } from "./metrics.js";

const medic = { studentLoan: "plan2", slBalanceEstimate: "yes", slStudyYears: "6", slFinishYear: "2018", slTuition: "nhs5", slMaintenance: "full" };

test("borrowed: fees for the years paid, maintenance every year", () => {
  // Started 2012: fees £9,000 for four years, maintenance £5,500 for six.
  assert.equal(estimateSlBalance(medic, { salary: 0, taxYear: 2026 }).borrowed, 4 * 9000 + 6 * 5500);
  assert.equal(estimateSlBalance({ ...medic, slTuition: "full", slMaintenance: "half" }, { taxYear: 2026 }).borrowed, 6 * 9000 + 3 * 5500);
});

test("interest builds with no repayments, repayments bring it down", () => {
  const none = estimateSlBalance(medic, { salary: 0, taxYear: 2026 }).balance;
  assert.ok(none > 69000 * 1.4, `with no repayments the balance grows (${none})`);
  const paying = estimateSlBalance(medic, { salary: 70000, growth: 0.03, taxYear: 2026 }).balance;
  assert.ok(paying < none && paying > 0);
});

test("only when the questions are answered, and Scotland has no fee loan", () => {
  assert.equal(estimateSlBalance({ ...medic, slFinishYear: "" }), null);
  assert.equal(estimateSlBalance({ ...medic, slBalanceEstimate: "" }), null);
  assert.equal(slTuitionPerYear("plan4", 2015), 0);
});

test("metrics use the estimate only when no balance is given", () => {
  const d = { ...medic, salary: "60000", loanBalance: "" };
  assert.ok(calcMetrics(d).loanBal > 0 && calcMetrics(d).loanBalEstimated);
  assert.equal(calcMetrics({ ...d, loanBalance: "20000" }).loanBal, 20000);
});
