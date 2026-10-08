import { test } from "node:test";
import assert from "node:assert/strict";
import { taxYearOf, taxYearFor, rollTaxYear } from "./taxYear.js";
import { calcMetrics } from "./metrics.js";

test("the tax year starts on 6 April", () => {
  assert.equal(taxYearOf(new Date(2026, 3, 5)), 2025);
  assert.equal(taxYearOf(new Date(2026, 3, 6)), 2026);
  assert.equal(taxYearOf(new Date(2027, 0, 15)), 2026);
});

const lastYearsInputs = {
  inputsTaxYear: 2025,
  isaThisYearCash: "5000", isaThisYearSS: "10000", isaThisYearLISA: "", isaThisYearOther: "",
  isaPrevCash: "2000", isaPrevSS: "30000", isaPrevLISA: "", isaPrevOther: "",
  hasSoldAssetsOutsideWrapper: "yes", realisedCgtGains: "1500",
};
const oct2026 = new Date(2026, 9, 1);

test("a new tax year moves this year's ISA payments into the previous-years balance", () => {
  const before = calcMetrics(lastYearsInputs);
  const after = rollTaxYear(lastYearsInputs, oct2026);
  assert.equal(after.inputsTaxYear, 2026);
  assert.equal(after.isaThisYearCash, "");
  assert.equal(after.isaThisYearSS, "");
  assert.equal(after.isaPrevCash, "7000");
  assert.equal(after.isaPrevSS, "40000");
  const m = calcMetrics(after);
  assert.equal(m.isaHeadroom, 20000);
  // The money is still in ISAs, so net worth doesn't move.
  assert.equal(m.netWorth, before.netWorth);
});

test("a new tax year resets gains realised against last year's CGT allowance", () => {
  const after = rollTaxYear(lastYearsInputs, oct2026);
  assert.equal(after.realisedCgtGains, "");
  assert.equal(after.hasSoldAssetsOutsideWrapper, "no");
  assert.equal(calcMetrics(after).remainingCgtAllowance, 3000);
});

test("inputs from the current tax year are left alone", () => {
  const d = { ...lastYearsInputs, inputsTaxYear: 2026 };
  assert.equal(rollTaxYear(d, oct2026), d);
});

test("unstamped inputs use the last report's date to tell which year they're from", () => {
  const { inputsTaxYear, ...unstamped } = lastYearsInputs;
  const rolled = rollTaxYear(unstamped, oct2026, new Date(2026, 2, 20));
  assert.equal(rolled.isaThisYearSS, "");
  assert.equal(rolled.isaPrevSS, "40000");
  const kept = rollTaxYear(unstamped, oct2026, new Date(2026, 7, 20));
  assert.equal(kept.isaThisYearSS, "10000");
  assert.equal(kept.inputsTaxYear, 2026);
});

test("unstamped inputs with no report date are treated as this year's", () => {
  const { inputsTaxYear, ...unstamped } = lastYearsInputs;
  const r = rollTaxYear(unstamped, oct2026, null);
  assert.equal(r.isaThisYearSS, "10000");
  assert.equal(r.inputsTaxYear, 2026);
});

test("an older single previous-years ISA balance is added to, not dropped", () => {
  const d = {
    inputsTaxYear: 2025, isaPreviousBalance: "25000",
    isaThisYearCash: "", isaThisYearSS: "8000", isaThisYearLISA: "", isaThisYearOther: "",
    isaPrevCash: "", isaPrevSS: "", isaPrevLISA: "", isaPrevOther: "",
  };
  const before = calcMetrics(d);
  const after = rollTaxYear(d, oct2026);
  assert.equal(after.isaPreviousBalance, "33000");
  assert.equal(calcMetrics(after).netWorth, before.netWorth);
  assert.equal(calcMetrics(after).isaHeadroom, 20000);
});

test("the figures' tax year is the one the inputs are stamped with, else today's", () => {
  assert.equal(taxYearFor({ inputsTaxYear: 2027 }), 2027);
  assert.equal(taxYearFor({}, new Date(2027, 3, 6)), 2027);
  assert.equal(taxYearFor({}, new Date(2027, 3, 5)), 2026);
});

test("rates and limits switch over when the inputs roll into 2027/28", () => {
  const d = { salary: "40000", age: "40", cashTiers: [{ amount: "30000", rate: "1" }], isaThisYearCash: "5000" };
  const before = calcMetrics(rollTaxYear(d, new Date(2027, 3, 5)));
  assert.equal(before.savingsTr, 0.20);
  assert.equal(before.cashIsaHeadroom, 15000);
  // On 6 April this year's £5,000 rolls into last year's, and the new limits apply.
  const after = calcMetrics(rollTaxYear({ ...d, inputsTaxYear: 2026 }, new Date(2027, 3, 6)));
  assert.equal(after.savingsTr, 0.22);
  assert.equal(after.cashIsaHeadroom, 12000);
  assert.equal(after.isaHeadroom, 20000);
});

test("a full NI record gives the 2026/27 full State Pension, £241.30 a week", () => {
  const m = calcMetrics({ niYears: "35" });
  assert.equal(Math.round(m.statePensionWeekly * 100) / 100, 241.30);
});
