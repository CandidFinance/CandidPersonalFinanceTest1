import { test } from "node:test";
import assert from "node:assert/strict";
import { moduleLimits } from "./moduleLimits.js";
import { calcMetrics } from "./metrics.js";

const employee = { employmentStatus: "employed", salary: "110000", age: "38" };

test("pension: share awards and lower pay for a higher-paid employee, at most three", () => {
  const line = moduleLimits("pension", employee, calcMetrics(employee));
  assert.equal(line, "Not included yet: share awards from work, pay that's lower for a while (parental leave or part-time) and a partner's pension.");
});

test("pension: a final salary member hears about their scheme's own rules first", () => {
  const d = { ...employee, salary: "45000", pensionKind: "db" };
  assert.match(moduleLimits("pension", d, calcMetrics(d)), /^Not included yet: your scheme's own rules/);
});

test("pension: self-employed, uneven earnings; no lower-pay line", () => {
  const d = { employmentStatus: "self_employed", salary: "40000" };
  const line = moduleLimits("pension", d, calcMetrics(d));
  assert.match(line, /earnings that change from year to year/);
  assert.doesNotMatch(line, /parental leave|share awards/);
});

test("student loan: the other kind of loan, by plan", () => {
  const d = { ...employee, studentLoan: "plan2" };
  assert.match(moduleLimits("studentLoan", d, calcMetrics(d)), /a Postgraduate loan repaid alongside this one/);
  const pg = { ...employee, studentLoan: "postgrad" };
  assert.match(moduleLimits("studentLoan", pg, calcMetrics(pg)), /an undergraduate loan repaid alongside this one/);
});

test("cash and investments always name what isn't covered; property has none", () => {
  const m = calcMetrics(employee);
  assert.match(moduleLimits("cash", employee, m), /Sharia-compliant accounts/);
  assert.equal(moduleLimits("investments", employee, m), "Not included yet: share awards from work, crypto and Sharia-compliant funds.");
  assert.equal(moduleLimits("property", employee, m), null);
});
