import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics, statePensionIncome } from "./metrics.js";
import { calcDrawdown, topRate, pensionIhtLine, statePensionPlan } from "./drawdown.js";
import { calcAnnualAllowanceRoom, inRetirement } from "./pension.js";

const retiree = overrides => {
  const d = { age: "69", salary: "0", employmentStatus: "not_working", hasPension: "yes", potValue: "2000000", pensionAccess: "none", ...overrides };
  return { d, m: calcMetrics(d) };
};

test("£2m over 20 years from 69: the same each year, tax-free cash 25% at a time", () => {
  const { d, m } = retiree();
  const plan = calcDrawdown(d, m, { years: 20 });
  assert.equal(plan.yearly, 147164);
  // Full State Pension alongside (66 or over, none stated).
  assert.equal(plan.rows[0].statePension, 12548);
  assert.equal(plan.rows[0].taxFree, 36791);
  assert.equal(plan.rows[0].tax, 41185);
  // £268,275 at £36,791 a year: seven full years, then the last of it.
  assert.equal(plan.rows.reduce((s, r) => s + r.taxFree, 0), 268275);
  assert.deepEqual(plan.phases.map(p => [p.fromAge, p.toAge]), [[69, 75], [76, 76], [77, 88]]);
  // Empty at the end of the years chosen.
  assert.ok(plan.rows[19].potAfter < 5);
  assert.equal(plan.halfway.age, 79);
  assert.ok(plan.halfway.pot > 1100000 && plan.halfway.pot < 1300000);
});

test("tax-free cash up front: taken now, the rest drawn and all of it taxed", () => {
  const { d, m } = retiree();
  const plan = calcDrawdown(d, m, { years: 20, taxFree: "upfront" });
  assert.equal(plan.upfront, 268275);
  assert.ok(plan.yearly < 147164);
  assert.ok(plan.rows.every(r => r.taxFree === 0));
  assert.equal(plan.phases.length, 1);
});

test("more years, a smaller share in tax", () => {
  const { d, m } = retiree({ potValue: "1100000" });
  const share = years => calcDrawdown(d, m, { years }).taxShare;
  assert.ok(share(10) > share(20) && share(20) > share(30));
});

test("under 66: the State Pension starts at 67, at the rate NI years point to", () => {
  const { d, m } = retiree({ age: "60", niYears: "35" });
  assert.deepEqual(statePensionPlan(d, m), { fromAge: 67, amount: 12548, started: false });
  const plan = calcDrawdown(d, m, { years: 15, taxFree: "upfront" });
  assert.equal(plan.rows[6].statePension, 0);
  assert.equal(plan.rows[7].statePension, 12548);
});

test("the State Pension in payment counts towards the tax band", () => {
  assert.equal(statePensionIncome({ age: "60" }), 0);
  assert.equal(statePensionIncome({ age: "67" }), 12548);
  assert.equal(statePensionIncome({ age: "67", statePensionAmount: "9000" }), 9000);
  assert.equal(calcMetrics({ age: "67", salary: "40000" }).taxBandLabel, "higher");
});

test("top rate, the £100k taper's 60% included", () => {
  assert.deepEqual([10000, 40000, 80000, 110000, 200000].map(topRate), [0, 20, 40, 60, 45]);
});

test("inheritance tax on pensions: from April 2027", () => {
  assert.match(pensionIhtLine({ inputsTaxYear: 2026 }), /^From 6 April 2027/);
  assert.match(pensionIhtLine({ inputsTaxYear: 2027 }), /^What's left in a pension counts/);
});

test("drawing an income: £10,000 a year can go in, and retirement mode", () => {
  const d = { age: "60", retirementAge: "67", salary: "60000", hasPension: "yes", myContribution: "10", employerMatch: "5", pensionAccess: "income" };
  const room = calcAnnualAllowanceRoom(d, calcMetrics(d));
  assert.equal(room.approxAA, 10000);
  // 10% plus a 5% match on £60,000 is £9,000: inside it. 15% plus 5% is £12,000: £2,000 over.
  assert.equal(room.excess, 0);
  const more = { ...d, myContribution: "15" };
  assert.equal(calcAnnualAllowanceRoom(more, calcMetrics(more)).excess, 2000);
  assert.equal(inRetirement(d), true);
  assert.equal(inRetirement({ ...d, pensionAccess: "none" }), false);
});
