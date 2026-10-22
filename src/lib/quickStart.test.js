import { test } from "node:test";
import assert from "node:assert/strict";
import { questionOrder, estimateLineFor, estimateItems } from "./quickStart.js";
import { CASH_QUICK, isaAskedFrom, TYPICAL_EASY_ACCESS_PCT } from "./cashQuick.js";
import { PENSION_QUICK, LEGAL_MIN_YOU, LEGAL_MIN_EMPLOYER } from "./pensionQuick.js";
import { STUDENT_LOAN_QUICK } from "./studentLoanQuick.js";
import { loanSavingsIn, loanPensionChecked } from "./appEntry.js";
import { calcMetrics } from "./metrics.js";

const order = (setup, d, a = {}) => questionOrder(setup, { d, m: calcMetrics(d), a });

test("cash: the rate follows the amount, and costs are asked once", () => {
  assert.deepEqual(order(CASH_QUICK, {}), ["savings", "rate", "costs"]);
  assert.deepEqual(order(CASH_QUICK, {}, { savings: "5-10" }), ["savings", "rate", "costs"]);
  assert.deepEqual(order(CASH_QUICK, { monthlyExpenses: "1800" }, { savings: "5-10" }), ["savings", "rate"]);
});

test("cash: a Cash ISA is asked only where interest could pass the Personal Savings Allowance", () => {
  assert.equal(isaAskedFrom({ taxBandLabel: "basic" }), 20000);
  assert.equal(isaAskedFrom({ taxBandLabel: "higher" }), 10000);
  assert.equal(isaAskedFrom({ taxBandLabel: "additional" }), 1000);
  assert.ok(!order(CASH_QUICK, { salary: "40000" }, { savings: "10-20" }).includes("isa"), "basic rate, £10k to £20k");
  assert.ok(order(CASH_QUICK, { salary: "40000" }, { savings: "20-50" }).includes("isa"), "basic rate, £20k to £50k");
  assert.ok(order(CASH_QUICK, { salary: "70000" }, { savings: "10-20" }).includes("isa"), "higher rate, £10k to £20k");
  assert.deepEqual(order(CASH_QUICK, {}, { savings: "x" }), ["savings", "rate", "costs"], "an unknown band asks no ISA question");
});

test("cash: answers write the fields Student loan's verdict reads, and say what's estimated", () => {
  const d = { salary: "40000" };
  const p = CASH_QUICK.patch(d, calcMetrics(d), { savings: "10-20", rate: "unsure", costs: "1.5-2" });
  assert.deepEqual(p.cashTiers, [{ name: "", amount: "15000", rate: String(TYPICAL_EASY_ACCESS_PCT) }]);
  assert.equal(p.monthlyExpenses, "1750");
  assert.ok(loanSavingsIn({ ...d, ...p }));
  const after = { ...d, ...p };
  assert.equal(estimateLineFor(after, "cash"), `Based on estimates: £10k to £20k in savings, earning ${TYPICAL_EASY_ACCESS_PCT}%, the UK average, £1.5k to £2k a month in costs.`);
  assert.equal(estimateItems({ ...after, monthlyExpenses: "1900" }, "cash").length, 2, "a changed figure drops out");
});

test("pension: percentages only for a scheme they pay into, the employer's only when known how it pays", () => {
  assert.deepEqual(order(PENSION_QUICK, { askedFields: ["pensionStatus"] }), [], "already answered");
  assert.deepEqual(order(PENSION_QUICK, {}), ["payIn", "type", "mine", "employer"], "counted from the start");
  assert.deepEqual(order(PENSION_QUICK, {}, { payIn: "yes", type: "match" }), ["payIn", "type", "mine", "employer"]);
  assert.deepEqual(order(PENSION_QUICK, {}, { payIn: "yes", type: "unsure" }), ["payIn", "type", "mine"]);
  assert.deepEqual(order(PENSION_QUICK, {}, { payIn: "no" }), ["payIn"]);
});

test("pension: not sure of a percentage takes the legal minimum, and says so", () => {
  const p = PENSION_QUICK.patch({}, {}, { payIn: "yes", type: "match", mine: "unsure", employer: "unsure" });
  assert.equal(p.myContribution, String(LEGAL_MIN_YOU));
  assert.equal(p.employerMatch, String(LEGAL_MIN_EMPLOYER));
  assert.equal(p.employerContributionType, "match");
  assert.ok(loanPensionChecked(p));
  assert.equal(estimateItems(p, "pension").length, 2);
  const exact = PENSION_QUICK.patch({}, {}, { payIn: "yes", type: "fixed", mine: "4", employer: "6" });
  assert.equal(exact.employerMatch, "6");
  assert.equal(estimateItems(exact, "pension").length, 0, "chosen percentages aren't estimates");
});

test("student loan: the engine asks the same questions as before", () => {
  assert.deepEqual(order(STUDENT_LOAN_QUICK, { studentLoan: "none" }), ["plan", "salary", "balance", "finish"]);
  assert.deepEqual(order(STUDENT_LOAN_QUICK, { studentLoan: "none" }, { plan: "unsure" }), ["plan", "helper", "salary", "balance", "finish"]);
});
