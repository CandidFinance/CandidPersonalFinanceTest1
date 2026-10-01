import { test } from "node:test";
import assert from "node:assert/strict";
import { taxYearOf, rollTaxYear } from "./taxYear.js";
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
