import { test } from "node:test";
import assert from "node:assert/strict";
import { questionOrder, estimateLineFor, estimateItems, SALARY_DEFAULT, MEDIAN_BANDS } from "./quickStart.js";
import { CASH_QUICK, isaAskedFrom, TYPICAL_EASY_ACCESS_PCT, costsDefault } from "./cashQuick.js";
import { PENSION_QUICK, LEGAL_MIN_YOU, LEGAL_MIN_EMPLOYER } from "./pensionQuick.js";
import { STUDENT_LOAN_QUICK } from "./studentLoanQuick.js";
import { loanSavingsIn, loanPensionChecked } from "./appEntry.js";
import { calcMetrics } from "./metrics.js";

const order = (setup, d, a = {}) => questionOrder(setup, { d, m: calcMetrics(d), a });

test("cash: the rate follows the amount, and costs are asked once", () => {
  assert.deepEqual(order(CASH_QUICK, {}), ["savings", "rate", "costs", "buffer"]);
  assert.deepEqual(order(CASH_QUICK, {}, { savings: "5-10" }), ["savings", "rate", "costs", "buffer"]);
  assert.deepEqual(order(CASH_QUICK, { monthlyExpenses: "1800" }, { savings: "5-10" }), ["savings", "rate", "buffer"]);
});

test("cash: the emergency fund target is asked once, and saved as the user's own", () => {
  assert.ok(!order(CASH_QUICK, { emergencyMonths: "3" }).includes("buffer"));
  assert.ok(!order(CASH_QUICK, { askedFields: ["emergencyMonths"] }).includes("buffer"));
  const d = {};
  const p = CASH_QUICK.patch(d, calcMetrics(d), { savings: "5-10", rate: "2-3", costs: "1.5-2", buffer: "9" });
  assert.equal(p.emergencyMonths, "9");
  assert.ok(p.askedFields.includes("emergencyMonths"));
  assert.ok(!p.quickEstimates.cash.items.some(i => i.field === "emergencyMonths"), "not an estimate");
});

test("cash: a Cash ISA is asked only where interest could pass the Personal Savings Allowance", () => {
  assert.equal(isaAskedFrom({ taxBandLabel: "basic" }), 20000);
  assert.equal(isaAskedFrom({ taxBandLabel: "higher" }), 10000);
  assert.equal(isaAskedFrom({ taxBandLabel: "additional" }), 1000);
  assert.ok(!order(CASH_QUICK, { salary: "40000" }, { savings: "10-20" }).includes("isa"), "basic rate, £10k to £20k");
  assert.ok(order(CASH_QUICK, { salary: "40000" }, { savings: "20-50" }).includes("isa"), "basic rate, £20k to £50k");
  assert.ok(order(CASH_QUICK, { salary: "70000" }, { savings: "10-20" }).includes("isa"), "higher rate, £10k to £20k");
  assert.deepEqual(order(CASH_QUICK, {}, { savings: "x" }), ["savings", "rate", "costs", "buffer"], "an unknown band asks no ISA question");
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

const direct = (d, a = {}) => questionOrder(PENSION_QUICK, { d, m: calcMetrics(d), a, direct: true });

test("pension opened directly: asks work, pay and age first, then what's in the pot", () => {
  assert.deepEqual(direct({}), ["employment", "salary", "age", "payIn", "type", "mine", "employer", "pot"]);
  assert.deepEqual(direct({}, { employment: "self_employed" }), ["employment", "salary", "age", "payIn", "mine", "pot"]);
  assert.deepEqual(direct({}, { employment: "not_working" }), ["employment", "notWorking", "age", "pot"]);
  assert.deepEqual(direct({}, { employment: "employed", payIn: "db" }), ["employment", "salary", "age", "payIn"], "a final salary scheme has no pot to size");
});

test("pension opened directly asks only what's missing", () => {
  const d = { employmentStatus: "employed", employmentAsked: true, salary: "52000", age: "41", askedFields: ["pensionStatus"] };
  assert.deepEqual(direct(d), ["pot"]);
  assert.deepEqual(questionOrder(PENSION_QUICK, { d: { ...d, askedFields: [] }, m: {}, a: {}, direct: false }), ["payIn", "type", "mine", "employer"], "from Student loan: only what its verdict uses");
});

test("pension opened directly writes everything its answer reads, and says what's estimated", () => {
  const a = { employment: "employed", salary: "45-60", age: "35-44", payIn: "yes", type: "match", mine: "3", employer: "5", pot: "10-25" };
  const p = PENSION_QUICK.patch({}, {}, a);
  assert.equal(p.employmentStatus, "employed");
  assert.equal(p.salary, "52500");
  assert.equal(p.age, "40");
  assert.equal(p.myContribution, "3");
  assert.equal(p.employerMatch, "5");
  assert.equal(p.potValue, "17500");
  assert.equal(estimateLineFor(p, "pension"), "Based on estimates: £45k to £60k salary, aged 35 to 44, £10k to £25k in your pension.");
  const m = calcMetrics({ ...p, selectedModules: ["pension"] });
  assert.ok(m.missedMatch > 0, "paying 3% against a 5% match leaves some unclaimed");
});

test("pension: a pot 'not sure' is estimated from age and pay, and not working means nothing paid in", () => {
  const p = PENSION_QUICK.patch({}, {}, { employment: "employed", salary: "45-60", age: "45-54", payIn: "yes", type: "match", mine: "5", employer: "5", pot: "unsure" });
  assert.ok(+p.potValue > 0);
  assert.match(estimateLineFor(p, "pension"), /estimated from your age and pay/);
  const n = PENSION_QUICK.patch({}, {}, { employment: "not_working", notWorking: "break", age: "35-44", pot: "none" });
  assert.equal(n.pensionStatus, "no");
  assert.equal(n.hasPensionPot, "no");
  assert.equal(n.notWorkingReason, "break");
});

test("defaults: costs offered from take-home pay, the default band's with no pay known", () => {
  assert.equal(costsDefault(30000), "u1");
  assert.equal(costsDefault(70000), "1.5-2");
  assert.equal(costsDefault(130000), "3-4");
  assert.equal(costsDefault(75000), "2-3"); // £2,027 a month: in £2k to £3k, though nearer £1,750
  assert.equal(costsDefault(0), MEDIAN_BANDS.costs);
  assert.equal(CASH_QUICK.questions.costs.default({ d: { salary: "130000" } }), "3-4");
});

test("defaults: the median bands, each one of its question's answers; none without enough data or for the user's own choice", () => {
  const offered = (setup, id) => setup.questions[id].options({ d: {}, a: {} }).some(o => o.value === setup.questions[id].default({ d: {}, a: {} }));
  for (const id of ["salary", "plan", "balance"]) assert.ok(offered(STUDENT_LOAN_QUICK, id), id);
  for (const id of ["salary", "age", "pot"]) assert.ok(offered(PENSION_QUICK, id), id);
  assert.ok(offered(CASH_QUICK, "costs"));
  assert.equal(STUDENT_LOAN_QUICK.questions.salary.default(), SALARY_DEFAULT);
  for (const id of ["savings", "rate", "buffer", "isa"]) assert.equal(CASH_QUICK.questions[id].default, undefined, id);
  assert.equal(STUDENT_LOAN_QUICK.questions.finish.default, undefined);
});
