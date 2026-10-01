import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyPayment, mortgageSchedule, mortgageInputs, mortgageSummary, DEFAULT_REMORTGAGE_FEE } from "./mortgage.js";

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);
const base = { loan: 200000, termYears: 30, fixedYears: 5, ratePct: 4.5, remortgageFee: 1000 };

test("monthly payment matches the standard repayment formula", () => {
  near(monthlyPayment(200000, 4.5, 360), 1013.37);
  near(monthlyPayment(120000, 0, 120), 1000);
  assert.equal(monthlyPayment(0, 4.5, 360), 0);
});

test("the balance is cleared by the end of the term", () => {
  const s = mortgageSchedule(base);
  assert.equal(s.years.length, 30);
  near(s.years.at(-1).balance, 0, 0.5);
});

test("remortgage fees: one at the start of each new deal after the first", () => {
  const s = mortgageSchedule(base);
  assert.equal(s.remortgages, 5);
  assert.equal(s.totalFees, 5000);
  assert.deepEqual(s.years.filter(y => y.remortgage).map(y => y.year), [6, 11, 16, 21, 26]);
  assert.equal(s.years[4].fee, 0);
});

test("remortgage fees: none when the fix covers the whole term", () => {
  assert.equal(mortgageSchedule({ ...base, termYears: 10, fixedYears: 10 }).totalFees, 0);
  assert.equal(mortgageSchedule({ ...base, termYears: 25 }).remortgages, 4);
});

test("moderate: remortgaging at the same rate leaves the payment unchanged", () => {
  const s = mortgageSchedule(base);
  near(s.years[5].monthlyPayment, s.years[0].monthlyPayment);
  assert.equal(s.years[5].ratePct, 4.5);
});

test("stress: every remortgage is 1.5 points above today's rate, not compounding", () => {
  const s = mortgageSchedule({ ...base, scenario: "stress" });
  assert.equal(s.years[0].ratePct, 4.5);
  assert.equal(s.years[5].ratePct, 6);
  assert.equal(s.years[10].ratePct, 6);
  assert.equal(s.years[25].ratePct, 6);
  assert.ok(s.years[5].monthlyPayment > s.years[0].monthlyPayment);
  near(s.years.at(-1).balance, 0, 0.5);
});

test("inputs: blanks fall back to the defaults", () => {
  assert.deepEqual(mortgageInputs({}, 250000), { loan: 250000, termYears: 30, fixedYears: 5, ratePct: 4.5, remortgageFee: DEFAULT_REMORTGAGE_FEE });
});

test("inputs: the user's figures win, with the term capped at 40 years", () => {
  const r = mortgageInputs({ propertyMortgageTerm: "45", propertyFixedYears: "2", propertyMortgageRate: "5.2", propertyRemortgageFee: "0" }, 250000);
  assert.equal(r.termYears, 40);
  assert.equal(r.fixedYears, 2);
  assert.equal(r.ratePct, 5.2);
  assert.equal(r.remortgageFee, 0);
});

test("lower: every remortgage is 1.5 points below today's rate, not below 0%", () => {
  const s = mortgageSchedule({ ...base, scenario: "lower" });
  assert.equal(s.years[0].ratePct, 4.5);
  assert.equal(s.years[5].ratePct, 3);
  assert.equal(s.years[20].ratePct, 3);
  assert.ok(s.years[5].monthlyPayment < s.years[0].monthlyPayment);
  near(s.years.at(-1).balance, 0, 0.5);
  assert.equal(mortgageSchedule({ ...base, ratePct: 1, scenario: "lower" }).years[5].ratePct, 0);
});

test("summary: first-deal payment, the three outcomes at the first remortgage, fees", () => {
  const s = mortgageSummary(base);
  near(s.monthlyPayment, 1013.37);
  assert.equal(s.firstRemortgageYear, 6);
  assert.deepEqual(s.remortgageOutcomes.map(o => [o.scenario, o.ratePct]), [["stress", 6], ["moderate", 4.5], ["lower", 3]]);
  const [higher, same, lower] = s.remortgageOutcomes.map(o => o.monthlyPayment);
  assert.ok(higher > same && same > lower);
  near(same, s.monthlyPayment);
  assert.equal(s.totalFees, 5000);
});

test("summary: no remortgage means no outcomes", () => {
  const s = mortgageSummary({ ...base, termYears: 5, fixedYears: 5 });
  assert.equal(s.remortgageOutcomes, null);
  assert.equal(s.remortgages, 0);
});
