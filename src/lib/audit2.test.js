// The audit's follow-ups, as agreed (finance-engine-audit.md, section 3, Q1
// to Q14 and FSCS), each written before its change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics, pastStatePensionAge, statePensionIncome } from "./metrics.js";
import { calcStudentLoanScenario, slFirstDueYear, slThresholdIn, slEarnings } from "./studentLoan.js";
import { pensionReturnRatio, calcPensionTaperSaving, calcBonusSacrifice, calcTaxFreeCash } from "./pension.js";
import { salarySacrificeNiCap } from "./tax.js";
import { INVESTED_RETURN_PCT } from "./rentVsBuy.js";
import { computeModuleStatuses, AVERAGE_MORTGAGE_RATE_PCT } from "./moduleStatus.js";
import { calcStampDuty, NON_RESIDENT_SURCHARGE } from "./stampDuty.js";
import { allocateCash, FSCS_DEPOSIT_LIMIT } from "./cashAllocation.js";
import { AGE_QUESTION } from "./sharedQuestions.js";
import { MODULE_GUIDES } from "./moduleGuide.js";
import { READINESS_QUESTIONS } from "./propertyGuide.js";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);

// ── Q1: write-off counted from when repayments started ──
test("Q1: repayments are taken to start the April after 22, unless the user says otherwise", () => {
  assert.equal(slFirstDueYear({ studentLoan: "plan2", age: "30" }, 2026), 2018);
  assert.equal(slFirstDueYear({ studentLoan: "plan2", age: "30", slFirstDueYear: "2020" }, 2026), 2020);
  // Not before the plan existed: Plan 2 from April 2016, Plan 5 from April 2026.
  assert.equal(slFirstDueYear({ studentLoan: "plan2", age: "45" }, 2026), 2016);
  assert.equal(slFirstDueYear({ studentLoan: "plan5", age: "40" }, 2026), 2026);
});

test("Q1: the scenario runs to the write-off year, not a full term from today", () => {
  const d = { age: "30", salary: "40000", studentLoan: "plan2", loanBalance: "45000", inputsTaxYear: 2026 };
  const m = calcMetrics(d);
  const sl = calcStudentLoanScenario(d, m);
  assert.equal(sl.firstDueYear, 2018);
  assert.equal(sl.firstDueEstimated, true);
  assert.equal(sl.writeOffTaxYear, 2048);
  assert.equal(sl.writeOffYr, 22);
  assert.equal(m.willClear, sl.willClear);
});

// ── Q5: bonus counts; salary sacrifice reduces the pay it's taken from ──
test("Q5: student loan repayments include the bonus, less any salary sacrifice", () => {
  const d = { salary: "40000", bonusAmount: "10000", studentLoan: "plan2", loanBalance: "40000" };
  near(calcMetrics(d).annualRepayment, (50000 - 29385) * 0.09);
  const ss = { ...d, hasPension: "yes", myContribution: "5", pensionType: "sacrifice" };
  assert.equal(slEarnings(ss, calcMetrics(ss).salary), 48000);
  near(calcMetrics(ss).annualRepayment, (48000 - 29385) * 0.09);
  // Relief at source comes out of take-home pay, so it doesn't.
  near(calcMetrics({ ...ss, pensionType: "relief" }).annualRepayment, (50000 - 29385) * 0.09);
  // Take-home a month leaves the bonus out, and the repayment on it.
  const m = calcMetrics(d);
  near(m.slRepaymentRegular, (40000 - 29385) * 0.09);
});

// ── Q14: thresholds indexed as each plan's rules say ──
test("Q14: Plan 1 rises from next April, Plan 5 from April 2027, Plan 2 after 2029/30; Postgraduate and Plan 4 stay", () => {
  assert.equal(slThresholdIn("plan1", 2026), 26900);
  near(slThresholdIn("plan1", 2027), 26900 * 1.02);
  assert.equal(slThresholdIn("plan5", 2026), 25000);
  near(slThresholdIn("plan5", 2027), 25000 * 1.02);
  assert.equal(slThresholdIn("plan2", 2029), 29385);
  near(slThresholdIn("plan2", 2030), 29385 * 1.02);
  assert.equal(slThresholdIn("postgrad", 2035), 21000);
  assert.equal(slThresholdIn("plan4", 2035), 33795);
});

// ── Q3: State Pension age, one rule everywhere ──
test("Q3: past State Pension age at 67, or at 66 unless they've said they don't get it yet", () => {
  assert.equal(pastStatePensionAge({ age: "65" }), false);
  assert.equal(pastStatePensionAge({ age: "66" }), true);
  assert.equal(pastStatePensionAge({ age: "66", statePensionAmount: "0" }), false);
  assert.equal(pastStatePensionAge({ age: "67", statePensionAmount: "0" }), true);
  assert.equal(statePensionIncome({ age: "66", statePensionAmount: "0" }), 0);
  // NI follows the same rule.
  const take = extra => calcMetrics({ age: "66", salary: "40000", ...extra }).monthlyTakeHome;
  near(take({ statePensionAmount: "0" }) - take({ statePensionAmount: "0", age: "40" }), 0);
  const asked = MODULE_GUIDES.pension.questions.find(q => q.id === "statePension");
  assert.ok(asked.notSure({}).value === "0");
});

// ── Q6: the £100k trap's NI saving only with salary sacrifice ──
test("Q6: no NI saving in the £100k trap unless paid by salary sacrifice", () => {
  const at = pensionType => calcPensionTaperSaving(calcMetrics({ age: "40", salary: "110000", hasPension: "yes", myContribution: "0", pensionType }));
  assert.equal(at("relief").taperNiSaving, 0);
  assert.equal(at("sacrifice").taperNiSaving, 200);
});

// ── Q12: £2,000 NI-free salary sacrifice from April 2029 ──
test("Q12: from April 2029 only £2,000 a year of salary sacrifice is free of NI", () => {
  assert.equal(salarySacrificeNiCap(2028), Infinity);
  assert.equal(salarySacrificeNiCap(2029), 2000);
  const d = { age: "40", salary: "60000", hasPension: "yes", myContribution: "5", pensionType: "sacrifice", bonusAmount: "10000", studentLoan: "none" };
  // £3,000 a year already sacrificed: nothing NI-free left in 2029.
  near(pensionReturnRatio({ ...d, inputsTaxYear: 2029 }, calcMetrics({ ...d, inputsTaxYear: 2029 })), 1 / (1 - 0.40), 1e-9);
  near(pensionReturnRatio({ ...d, inputsTaxYear: 2026 }, calcMetrics({ ...d, inputsTaxYear: 2026 })), 1 / (1 - 0.42), 1e-9);
  const later = { ...d, inputsTaxYear: 2029 };
  assert.equal(calcBonusSacrifice(later, calcMetrics(later), 10000, 100).employerNISave, 0);
  const smaller = { ...later, myContribution: "1" }; // £600 sacrificed, £1,400 left NI-free
  assert.equal(calcBonusSacrifice(smaller, calcMetrics(smaller), 10000, 100).employerNISave, Math.round(1400 * 0.15));
});

// ── Q9: Individual Protection's limit from the protected amount ──
test("Q9: Individual Protection allows 25% of the protected amount, up to £375,000 or £312,500", () => {
  assert.equal(calcTaxFreeCash({ potValue: "2000000", pensionProtection: "ip2014", pensionProtectedAmount: "1200000" }).allowance, 300000);
  assert.equal(calcTaxFreeCash({ potValue: "2000000", pensionProtection: "ip2016", pensionProtectedAmount: "1400000" }).allowance, 312500);
  assert.equal(calcTaxFreeCash({ potValue: "2000000", pensionProtection: "fp2014" }).allowance, 375000);
  // Saved before the split: still read as the fixed amounts.
  assert.equal(calcTaxFreeCash({ potValue: "2000000", pensionProtection: "p2014" }).allowance, 375000);
  // Not known yet: the maximum, as before.
  assert.equal(calcTaxFreeCash({ potValue: "2000000", pensionProtection: "ip2014" }).allowance, 375000);
  const ids = MODULE_GUIDES.pension.questions.map(q => q.id);
  assert.ok(ids.includes("pensionProtectedAmount"));
});

// ── Q4: 6% for investments, as for pensions ──
test("Q4: invested money grows at 6%, the same as pensions", () => {
  assert.equal(INVESTED_RETURN_PCT, 6);
});

// ── Q8: average mortgage rate from the feed when it has one ──
test("Q8: a mortgage is above average against the feed's figure, else 4.5%", () => {
  const d = { hasMortgage: "yes", mortgageRate: "4.8", mortgageBalance: "200000" };
  assert.equal(AVERAGE_MORTGAGE_RATE_PCT, 4.5);
  assert.equal(computeModuleStatuses(d, calcMetrics(d)).mortgage.status, "attention");
  assert.equal(computeModuleStatuses(d, calcMetrics(d), { avgMortgageRate: 5 }).mortgage.status, "ok");
});

// ── Q11: the 2% surcharge for buyers not resident in the UK ──
test("Q11: non-UK residents pay 2% more on every band, first-time buyer rates included", () => {
  assert.equal(NON_RESIDENT_SURCHARGE, 0.02);
  assert.equal(calcStampDuty({ price: 400000, nation: "england", nonResident: true }).total, 10000 + 8000);
  assert.equal(calcStampDuty({ price: 400000, nation: "england", firstTimeBuyers: [true], nonResident: true }).total, 5000 + 8000);
  assert.equal(calcStampDuty({ price: 400000, nation: "england", additionalProperty: true, nonResident: true }).total, 10000 + 20000 + 8000);
  const q = READINESS_QUESTIONS.find(x => x.id === "ukResident");
  assert.ok(q);
});

// ── Q13: Candid is for adults ──
test("Q13: the age question needs 18 or over", () => {
  assert.equal(AGE_QUESTION.min, 18);
});

// ── FSCS: no more than £120,000 with one bank ──
test("FSCS: no more than £120,000 goes to one bank; NS&I is backed by the Treasury", () => {
  assert.equal(FSCS_DEPOSIT_LIMIT, 120000);
  const rows = [
    { provider_name: "Bank A", rate_aer: 5.0, account_type: "Easy access" },
    { provider_name: "Bank B", rate_aer: 4.8, account_type: "Easy access" },
    { provider_name: "NS&I", product_name: "Direct Saver", rate_aer: 4.0, account_type: "Easy access" },
  ];
  const r = allocateCash(300000, rows);
  assert.deepEqual(r.lines.map(l => [l.provider, l.amount]), [["Bank A", 120000], ["Bank B", 120000], ["NS&I", 60000]]);
  assert.equal(r.lines[0].fscsLimited, true);
  // Under the limit: unchanged, all of it in the best account.
  assert.deepEqual(allocateCash(50000, rows).lines.map(l => [l.provider, l.amount]), [["Bank A", 50000]]);
});

test("FSCS: the cash plan puts no more than £120,000 with one bank, and offers a second for the rest", async () => {
  const { cashPlan } = await import("./assist.js");
  const rows = [
    { provider_name: "Bank A", product_name: "Saver", account_type: "Easy access", rate_aer: "5.0", is_isa: false },
    { provider_name: "Bank B", product_name: "Saver", account_type: "Easy access", rate_aer: "4.8", is_isa: false },
  ];
  const d = { cashTiers: [{ name: "Old Bank", amount: "200000", rate: "1" }] };
  const m = { cash: 200000, bonds: 0, isaHeadroom: 0, savingsRate: 1, tr: 0.4, taxBandLabel: "higher" };
  const first = cashPlan(d, m, rows, { skipPb: true });
  const a = first.savings.options.find(o => o.provider === "Bank A");
  assert.equal(a.amount, 120000);
  assert.equal(a.fscsLimited, true);
  const picked = cashPlan(d, m, rows, { skipPb: true, savingsChoice: a.id });
  assert.equal(picked.savings.leftover, 80000);
  assert.equal(picked.savings.secondOptions[0].provider, "Bank B");
});

test("Q8: a mortgage is compared with a rate they've been offered, then the reference rate, then 4.5%", async () => {
  const { mortgageComparisonRate } = await import("./moduleStatus.js");
  assert.deepEqual(mortgageComparisonRate({ mortgageOfferRate: "4.1" }, { avgMortgageRate: 5 }), { rate: 4.1, source: "offer" });
  assert.deepEqual(mortgageComparisonRate({}, { avgMortgageRate: 5 }), { rate: 5, source: "reference" });
  assert.deepEqual(mortgageComparisonRate({ mortgageOfferRate: "" }, {}), { rate: 4.5, source: "default" });
  const d = { hasMortgage: "yes", mortgageRate: "4.8", mortgageBalance: "200000", mortgageOfferRate: "4.1" };
  const s = computeModuleStatuses(d, calcMetrics(d), { avgMortgageRate: 5 }).mortgage;
  assert.equal(s.status, "attention");
  assert.match(s.impactLabel, /4\.1% you've been offered/);
});
