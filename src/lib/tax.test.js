import { test } from "node:test";
import assert from "node:assert/strict";
import { calcIncomeTax, savingsTaxRates, dividendTaxRates, cashIsaLimit } from "./tax.js";

test("income tax: basic and higher rate bands", () => {
  assert.equal(calcIncomeTax(12570), 0);
  assert.equal(calcIncomeTax(50270), 7540);
  assert.equal(calcIncomeTax(100000), 27432);
});

test("income tax: Personal Allowance taper between £100k and £125,140", () => {
  // £120k: allowance cut to £2,570, all remaining income still at 40%
  assert.equal(calcIncomeTax(120000), 39432);
  assert.equal(calcIncomeTax(125140), 42516);
});

test("income tax: 45% only starts above £125,140", () => {
  assert.equal(calcIncomeTax(150000), 53703);
  assert.equal(calcIncomeTax(200000), 76203);
});

test("savings interest is taxed 4 points more from April 2027", () => {
  assert.deepEqual(savingsTaxRates(2026), { basic: 0.20, higher: 0.40, additional: 0.45 });
  assert.deepEqual(savingsTaxRates(2027), { basic: 0.24, higher: 0.44, additional: 0.49 });
  assert.equal(savingsTaxRates(2030).higher, 0.44);
});

test("dividend tax: basic and higher 2 points more from April 2026, additional unchanged", () => {
  assert.deepEqual(dividendTaxRates(2025), { basic: 0.0875, higher: 0.3375, additional: 0.3935 });
  assert.deepEqual(dividendTaxRates(2026), { basic: 0.1075, higher: 0.3575, additional: 0.3935 });
});

test("cash ISA limit: the full £20,000 at any age, the £12,000 cap scrapped (October 2026 Budget)", () => {
  assert.equal(cashIsaLimit(2026, 30), 20000);
  assert.equal(cashIsaLimit(2027, 30), 20000);
  assert.equal(cashIsaLimit(2027, 65), 20000);
  assert.equal(cashIsaLimit(2027, ""), 20000);
});

// Scottish income tax, 2026/27 (GOV.UK): starter 19% to £16,537, basic 20%
// to £29,526, intermediate 21% to £43,662, higher 42% to £75,000, advanced
// 45% to £125,140, top 48%.
test("Scottish income tax: the six bands", async () => {
  const { calcIncomeTax, scottishRate, calcIncomeAndDividendTax } = await import("./tax.js");
  // £95,000: 3,967 at 19%, 12,989 at 20%, 14,136 at 21%, 31,338 at 42%, 20,000 at 45%.
  assert.equal(calcIncomeTax(95000, true), Math.round(3967 * 0.19 + 12989 * 0.2 + 14136 * 0.21 + 31338 * 0.42 + 20000 * 0.45));
  assert.equal(calcIncomeTax(95000), 25432);
  assert.equal(calcIncomeTax(12570, true), 0);
  // The £100k trap: 45% plus the allowance lost, 67.5% a slice.
  assert.equal(calcIncomeTax(110000, true) - calcIncomeTax(100000, true), 6750);
  // Above £125,140: 48%.
  assert.equal(calcIncomeTax(135140, true) - calcIncomeTax(125140, true), 4800);
  assert.deepEqual([20000, 35000, 50000, 80000, 130000].map(scottishRate), [0.2, 0.21, 0.42, 0.45, 0.48]);
  // Dividends stay on UK rates.
  assert.equal(calcIncomeAndDividendTax(30000, 10000, 2026, true) - calcIncomeAndDividendTax(30000, 0, 2026, true),
    calcIncomeAndDividendTax(30000, 10000, 2026) - calcIncomeAndDividendTax(30000, 0, 2026));
});

test("a Scottish taxpayer's rate, take-home and £100k trap follow Scottish rates", async () => {
  const { calcMetrics } = await import("./metrics.js");
  const { taxTrapReveal } = await import("./moduleReveal.js");
  const fiona = { salary: "95000", age: "38", hasPension: "yes", myContribution: "6", employerMatch: "6", potValue: "85000", pensionType: "sacrifice", selectedModules: ["pension"] };
  const rUK = calcMetrics(fiona), scot = calcMetrics({ ...fiona, scottishTaxpayer: "yes" });
  assert.equal(rUK.tr, 0.4);
  assert.equal(scot.tr, 0.45);
  assert.ok(scot.monthlyTakeHome < rUK.monthlyTakeHome, "more tax in Scotland at £95k");
  assert.equal(scot.taxBandLabel, "higher"); // UK band, for savings and dividends
  const sophie = { ...fiona, salary: "110000", scottishTaxpayer: "yes" };
  // 45% plus the 22.5% of allowance lost, and 2% NI.
  assert.match(taxTrapReveal(sophie, calcMetrics(sophie))[1].title, /marginal tax rate is 69\.5%: for every extra £1 you earn, 69\.5p is lost to tax and National Insurance \(67\.5% tax and 2% National Insurance\)\.$/);
});
