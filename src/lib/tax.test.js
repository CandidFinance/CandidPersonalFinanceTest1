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

test("savings interest is taxed 2 points more from April 2027", () => {
  assert.deepEqual(savingsTaxRates(2026), { basic: 0.20, higher: 0.40, additional: 0.45 });
  assert.deepEqual(savingsTaxRates(2027), { basic: 0.22, higher: 0.42, additional: 0.47 });
  assert.equal(savingsTaxRates(2030).higher, 0.42);
});

test("dividend tax: basic and higher 2 points more from April 2026, additional unchanged", () => {
  assert.deepEqual(dividendTaxRates(2025), { basic: 0.0875, higher: 0.3375, additional: 0.3935 });
  assert.deepEqual(dividendTaxRates(2026), { basic: 0.1075, higher: 0.3575, additional: 0.3935 });
});

test("cash ISA limit: £12,000 for under-65s from April 2027, £20,000 before and from 65", () => {
  assert.equal(cashIsaLimit(2026, 30), 20000);
  assert.equal(cashIsaLimit(2027, 30), 12000);
  assert.equal(cashIsaLimit(2027, 64), 12000);
  assert.equal(cashIsaLimit(2027, 65), 20000);
  assert.equal(cashIsaLimit(2027, ""), 12000); // unknown age counts as under 65
});
