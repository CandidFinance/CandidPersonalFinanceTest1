// Older users: working past retirement age, and the drawdown strategy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics, retirementAgeFor, workingPastRetirementAge } from "./metrics.js";
import { pastRetirementAge, inRetirement } from "./pension.js";
import { calcDrawdown, bestDrawdown, defaultDrawdownYears, drawdownYearOptions, drawdownComparison, phaseReason, DRAWDOWN_TO_AGE } from "./drawdown.js";
import { pensionReveal } from "./moduleReveal.js";
import { calcNetWorthTrajectory } from "./forecast.js";
import { MODULE_GUIDES } from "./moduleGuide.js";

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);

test("still earning past retirement age: assumed to stop at 75 unless they say", () => {
  assert.equal(retirementAgeFor({ age: "68", salary: "40000", retirementAge: "65" }), 75);
  assert.equal(retirementAgeFor({ age: "68", salary: "40000", retirementAge: "70" }), 70);
  assert.equal(retirementAgeFor({ age: "68", salary: "0", retirementAge: "65" }), 65);
  assert.equal(retirementAgeFor({ age: "78", salary: "40000", retirementAge: "65" }), 78);
  assert.equal(workingPastRetirementAge({ age: "68", salary: "40000", retirementAge: "65" }), true);
  assert.equal(pastRetirementAge({ age: "68", salary: "40000", retirementAge: "65" }), false);
  assert.equal(inRetirement({ age: "76", salary: "40000", retirementAge: "65" }), true);
});

test("a 68-year-old still working is projected to the age they stop, not 65", () => {
  const d = { age: "68", salary: "40000", retirementAge: "65", hasPension: "yes", myContribution: "5", employerMatch: "5", potValue: "300000" };
  const m = calcMetrics(d);
  assert.equal(m.years, 7);
  const answer = pensionReveal(d, m)[0];
  assert.match(answer.title, /by 75/);
});

test("the question: when they plan to stop working, an age after today", () => {
  const q = MODULE_GUIDES.pension.questions.find(x => x.id === "retirementAge");
  const ctx = { d: { age: "68", salary: "40000", retirementAge: "65" } };
  assert.equal(q.ask(ctx), "When do you plan to stop working?");
  assert.equal(q.min(ctx), 69);
  assert.equal(q.ask({ d: { age: "40" } }), "When would you like to retire?");
});

test("wealth: pay and pension payments stop at the stop age, and the pension is drawn down by 87", () => {
  const d = { age: "68", salary: "40000", retirementAge: "70", hasPension: "yes", myContribution: "5", employerMatch: "5", potValue: "300000" };
  const m = calcMetrics(d);
  const rows = calcNetWorthTrajectory(d, m, 19);
  assert.ok(rows[2].pension > rows[1].pension);       // still paying in at 70
  assert.ok(rows[5].pension < rows[2].pension);       // drawing from 70
  near(rows[19].pension, 0, 5);                        // empty at 87
});

test("drawdown: by default to 87, with the years offered alongside", () => {
  assert.equal(DRAWDOWN_TO_AGE, 87);
  assert.equal(defaultDrawdownYears({ age: "69" }), 18);
  assert.equal(defaultDrawdownYears({ age: "84" }), 5);
  assert.deepEqual(drawdownYearOptions({ age: "69" }), [10, 15, 18, 20, 25, 30]);
  assert.deepEqual(drawdownYearOptions({ age: "67" }), [10, 15, 20, 25, 30]);
});

const retiree = { age: "69", salary: "0", hasPension: "yes", potValue: "2000000", pensionAccess: "none" };

test("drawdown: the headline figures, all about what comes out of the pension", () => {
  const m = calcMetrics(retiree);
  const p = calcDrawdown(retiree, m, { years: 20 });
  const tax = p.rows.reduce((s, r) => s + r.taxOnPension, 0);
  assert.equal(p.totalTax, tax);
  near(p.effectiveRate, tax / (p.yearly * 20), 1e-9);
  assert.equal(p.firstYear.tax, p.rows[0].taxOnPension);
  assert.equal(p.firstYear.afterTax, p.yearly - p.rows[0].taxOnPension);
  // More than the pot divided by the years, because what's left keeps growing.
  assert.equal(p.simpleYearly, 100000);
  assert.ok(p.yearly > p.simpleYearly);
});

test("drawdown: the strategy is whichever tax-free cash option keeps more after tax, on the same money", () => {
  const m = calcMetrics(retiree);
  const best = bestDrawdown(retiree, m, 18);
  const phased = calcDrawdown(retiree, m, { years: 18, taxFree: "phased" });
  const upfront = calcDrawdown(retiree, m, { years: 18, taxFree: "upfront" });
  // Up front pays less tax only because less comes out of a smaller pot.
  assert.ok(upfront.totalTax < phased.totalTax);
  assert.equal(best.plan.totalKept, Math.max(phased.totalKept, upfront.totalKept));
  assert.equal(best.saving, Math.abs(phased.totalKept - upfront.totalKept));
  assert.equal(best.other.taxFree, best.plan.taxFree === "phased" ? "upfront" : "phased");
});

test("phased: 25% of each withdrawal, growth included, up to the Lump Sum Allowance", () => {
  const d = { age: "69", salary: "0", hasPension: "yes", potValue: "500000", pensionAccess: "none" };
  const p = calcDrawdown(d, calcMetrics(d), { years: 18, taxFree: "phased" });
  const taxFree = p.rows.reduce((s, r) => s + r.taxFree, 0);
  assert.ok(taxFree > 125000 && taxFree <= 268275);
  assert.ok(p.rows.every(r => Math.abs(r.taxFree - r.pension * 0.25) <= 1));
});

test("drawdown: each number of years compared on the same four figures", () => {
  const m = calcMetrics(retiree);
  const rows = drawdownComparison(retiree, m, "phased");
  assert.deepEqual(rows.map(r => r.years), [10, 15, 18, 20, 25, 30]);
  assert.equal(rows[2].toAge, 87);
  // Longer: less a year, a lower rate.
  assert.ok(rows[0].afterTax > rows[5].afterTax && rows[0].effectiveRate > rows[5].effectiveRate);
});

test("drawdown: why each run of years differs from the one before", () => {
  const m = calcMetrics({ ...retiree, age: "62" });
  const p = calcDrawdown({ ...retiree, age: "62" }, m, { years: 25 });
  assert.match(phaseReason(p.phases[0], null), /quarter of each withdrawal is tax-free/);
  const sp = p.phases.findIndex(x => x.statePension > 0);
  assert.match(phaseReason(p.phases[sp], p.phases[sp - 1]), /State Pension starts/);
  const last = p.phases[p.phases.length - 1];
  assert.match(phaseReason(last, p.phases[p.phases.length - 2]), /run out, so all of each withdrawal is taxed/);
});

test("Explain this, retired: leads with the drawdown strategy", () => {
  const m = calcMetrics(retiree);
  const steps = pensionReveal(retiree, m);
  assert.match(steps[0].title, /drawn over 18 years, to 87/);
  assert.doesNotMatch(steps.map(s => `${s.title} ${s.body || ""}`).join(" "), /6% a year/);
});

test("drawdown while still working: pay counts until the stop age, then stops", () => {
  const d = { age: "69", retirementAge: "75", salary: "22000", hasPension: "yes", myContribution: "0", potValue: "1400000", pensionAccess: "none" };
  const p = calcDrawdown(d, calcMetrics(d), { years: 18 });
  assert.equal(p.stillWorking, true);
  assert.equal(p.rows[5].other, 22000);  // 74
  assert.equal(p.rows[6].other, 0);      // 75
  const stop = p.phases.findIndex(x => x.fromAge === 75);
  assert.match(phaseReason(p.phases[stop], p.phases[stop - 1]), /pay stops/);
});

test("drawdown: each period's change in a few words", async () => {
  const { phaseChange } = await import("./drawdown.js");
  const d = { age: "62", salary: "0", hasPension: "yes", potValue: "2000000", pensionAccess: "none" };
  const p = calcDrawdown(d, calcMetrics(d), { years: 25 });
  assert.equal(phaseChange(p.phases[0], null), "25% tax-free");
  assert.deepEqual(p.phases.slice(1).map((x, i) => phaseChange(x, p.phases[i])), ["State Pension starts", "Last tax-free", "No tax-free cash"]);
});
