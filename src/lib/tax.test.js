import { test } from "node:test";
import assert from "node:assert/strict";
import { calcIncomeTax } from "./tax.js";

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
