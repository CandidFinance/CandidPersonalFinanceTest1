// One test per error found in the 2026/27 engine audit (finance-engine-audit.md
// at the repo root), each written before its fix. Rules and sources are in
// the report, by the same numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { calcIncomeTax, calcIncomeAndDividendTax, taxFreeInterest } from "./tax.js";
import { calcBonusSacrifice, missedPensionRelief, pensionReturnRatio, inRetirement, defaultCarryForwardYears, calcPensionGrowthTrajectory } from "./pension.js";
import { savingsTax } from "./assist.js";
import { calcCashOptimisation } from "./cash.js";
import { resolveSlRate } from "./studentLoan.js";
import { buildFinancialSummary } from "./aiPrompt.js";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);

test("F1: employer NI saved on a salary-sacrificed bonus is 15%", () => {
  const d = { salary: "60000", bonusAmount: "10000", studentLoan: "none", myContribution: "5", employerMatch: "5", hasPension: "yes" };
  assert.equal(calcBonusSacrifice(d, calcMetrics(d), 10000, 100).employerNISave, 1500);
});

test("F2: Plan 4 and Postgraduate loans are repaid, at their own threshold and rate", () => {
  const plan4 = calcMetrics({ salary: "50000", studentLoan: "plan4", loanBalance: "20000" });
  near(plan4.annualRepayment, (50000 - 33795) * 0.09);
  assert.equal(plan4.willClear, true);
  const pg = calcMetrics({ salary: "50000", studentLoan: "postgrad", loanBalance: "10000" });
  near(pg.annualRepayment, (50000 - 21000) * 0.06);
  // Unchanged for the plans that already worked.
  near(calcMetrics({ salary: "50000", studentLoan: "plan2", loanBalance: "40000" }).annualRepayment, (50000 - 29385) * 0.09);
});

test("F3: no new State Pension with fewer than 10 qualifying years", () => {
  assert.equal(calcMetrics({ niYears: "9" }).statePensionAnnual, 0);
  near(calcMetrics({ niYears: "10" }).statePensionAnnual, 10 / 35 * 241.30 * 52);
});

test("F4: no tax relief to miss from 75", () => {
  const d = { age: "76", salary: "40000", hasPension: "yes", myContribution: "0", statePensionAmount: "0" };
  assert.equal(missedPensionRelief(d, calcMetrics(d)), 0);
  const younger = { ...d, age: "74" };
  assert.ok(missedPensionRelief(younger, calcMetrics(younger)) > 0);
});

test("F5: no employee NI past State Pension age", () => {
  const at = age => calcMetrics({ age, salary: "40000", statePensionAmount: "0" }).monthlyTakeHome;
  near(at("70") - at("40"), (40000 - 12570) * 0.08 / 12);
});

test("F6: self-employed pay Class 4 NI at 6% and 2%, not employee NI", () => {
  const take = employmentStatus => calcMetrics({ age: "40", salary: "60000", employmentStatus }).monthlyTakeHome;
  near(take("self_employed") - take("employed"), (50270 - 12570) * (0.08 - 0.06) / 12);
});

test("F7: unused Personal Allowance and the starting rate for savings count as tax-free interest", () => {
  // Nothing but the State Pension: £22 of allowance left, the full £5,000
  // starting rate, and the £1,000 PSA.
  assert.equal(taxFreeInterest(12548, "basic"), 22 + 5000 + 1000);
  // £15,000 of other income: £2,430 over the allowance takes the starting rate to £2,570.
  assert.equal(taxFreeInterest(15000, "basic"), 2570 + 1000);
  assert.equal(taxFreeInterest(40000, "basic"), 1000);
  assert.equal(taxFreeInterest(60000, "higher"), 500);
  const retiree = calcMetrics({ age: "70", salary: "0", statePensionAmount: "12548" });
  assert.equal(savingsTax(retiree).kept(4500), 4500);
  assert.equal(calcCashOptimisation(retiree, 4.5, 4.5).psaLimit, 6022);
  const worker = calcMetrics({ age: "40", salary: "40000" });
  near(savingsTax(worker).kept(4500), 4500 - 0.2 * 3500);
});

test("F8: salary sacrifice saves 8% NI in the basic band, 2% above, none past State Pension age", () => {
  const ratio = (salary, age = "30") => { const d = { age, salary, pensionType: "sacrifice", statePensionAmount: "0" }; return pensionReturnRatio(d, calcMetrics(d)); };
  near(ratio("40000"), 1 / (1 - 0.28), 1e-9);
  near(ratio("60000"), 1 / (1 - 0.42), 1e-9);
  near(ratio("40000", "70"), 1 / (1 - 0.20), 1e-9);
});

test("F9: bonus sacrifice uses the loan's real rate, the plan's deduction rate, and the threshold", () => {
  // Postgraduate: 6%, not 9%.
  const pg = { salary: "50000", bonusAmount: "10000", studentLoan: "postgrad", loanBalance: "10000" };
  assert.equal(calcBonusSacrifice(pg, calcMetrics(pg), 10000, 0).fullSLPct, 6);
  // Plan 2 on £25,000: only the £5,615 of the bonus above £29,385 is deducted.
  const p2 = { salary: "25000", bonusAmount: "10000", studentLoan: "plan2", loanBalance: "30000" };
  const m = calcMetrics(p2);
  const r = calcBonusSacrifice(p2, m, 10000, 0);
  assert.equal(r.slOnCash, Math.round(5615 * 0.09));
  const expected = Math.round(r.slOnCash * resolveSlRate(p2, m.salary) * Math.max(1, m.loanBal / Math.max(1, m.annualRepayment)));
  assert.equal(r.slInterestSaved, expected);
});

test("F10: the projected pot counts only the employer's matched share", () => {
  const d = { age: "30", retirementAge: "65", salary: "50000", hasPension: "yes", myContribution: "3", employerMatch: "5", potValue: "0" };
  const m = calcMetrics(d);
  const annuity = (Math.pow(1.04, 35) - 1) / 0.04;
  near(m.projectedPot, 50000 * 0.06 * annuity, 1);
  near(calcPensionGrowthTrajectory(d, m).bars.find(b => b.key === "retirement").value, m.projectedPot, 1);
});

test("F11: the chat is told about the 60% band between £100,000 and £125,140", () => {
  const d = { salary: "110000" };
  assert.match(buildFinancialSummary(d, calcMetrics(d), {}).taxBand, /60%/);
  const d2 = { salary: "70000" };
  assert.match(buildFinancialSummary(d2, calcMetrics(d2), {}).taxBand, /Higher rate/);
});

test("F12: no retirement mode before the minimum pension age (55, then 57 from April 2028)", () => {
  assert.equal(inRetirement({ age: "52", retirementAge: "50", inputsTaxYear: 2026 }), false);
  assert.equal(inRetirement({ age: "56", retirementAge: "55", inputsTaxYear: 2026 }), true);
  assert.equal(inRetirement({ age: "56", retirementAge: "55", inputsTaxYear: 2028 }), false);
  // Already drawing: they've accessed it, whatever the age.
  assert.equal(inRetirement({ age: "56", retirementAge: "60", pensionAccess: "income", inputsTaxYear: 2028 }), true);
});

test("F13: dividends are taxed at dividend rates, after a £500 allowance", () => {
  // £30,000 salary and £10,000 of dividends, 2026/27.
  assert.equal(calcIncomeAndDividendTax(30000, 10000, 2026), Math.round(calcIncomeTax(30000) + 9500 * 0.1075));
  // Unused Personal Allowance covers dividends first.
  assert.equal(calcIncomeAndDividendTax(0, 13070, 2026), 0);
  // No dividends: the same as income tax.
  assert.equal(calcIncomeAndDividendTax(80000, 0, 2026), calcIncomeTax(80000));
  const d = { age: "40", salary: "30000", dividendIncome: "10000" };
  const m = calcMetrics(d);
  const ni = (30000 - 12570) * 0.08;
  near(m.monthlyTakeHome, (40000 - calcIncomeAndDividendTax(30000, 10000, m.taxYear) - ni) / 12);
});

test("H2: carry forward's three years follow the tax year", () => {
  assert.deepEqual(defaultCarryForwardYears(2026).map(y => y.label), ["2025/26", "2024/25", "2023/24"]);
  assert.deepEqual(defaultCarryForwardYears(2027).map(y => y.label), ["2026/27", "2025/26", "2024/25"]);
});

test("F7: with the income unknown, only the Personal Savings Allowance counts", () => {
  assert.equal(taxFreeInterest(undefined, "basic"), 1000);
  assert.equal(savingsTax({ tr: 0.2, taxBandLabel: "basic" }).allowance, 1000);
});
