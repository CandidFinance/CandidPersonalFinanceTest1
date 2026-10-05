import { test } from "node:test";
import assert from "node:assert/strict";
import { pensionReveal } from "./moduleReveal.js";
import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses } from "./moduleStatus.js";

const base = { selectedModules: ["pension"], salary: "45000", age: "31", retirementAge: "65", monthlyExpenses: "2000", hasPension: "yes", potValue: "40000" };
const reveal = d => { const m = calcMetrics(d); return { steps: pensionReveal(d, m), m, statuses: computeModuleStatuses(d, m) }; };

test("three steps every time: answer, why, what you could do", () => {
  for (const d of [base, { ...base, myContribution: "3", employerMatch: "5" }, { ...base, hasPension: "no" }, { ...base, pensionUnknown: true }]) {
    assert.deepEqual(reveal(d).steps.map(s => s.label), ["Your answer", "Why", "What you could do"]);
  }
});

test("missing match: the figure is the module's own, and the cost after tax relief is shown", () => {
  const { steps, m, statuses } = reveal({ ...base, myContribution: "3", employerMatch: "5" });
  assert.equal(steps[0].figure, "£900 a year");
  assert.equal(statuses.pension.amount, Math.round(m.missedMatch));
  assert.equal(steps[1].title, "Your employer matches up to 5% of your salary. You pay 3%.");
  // 2% of £45,000 is £900; at 20% relief it costs £720.
  assert.match(steps[2].body, /^It would cost you about £720 a year after tax relief\./);
});

test("not paying in: the tax relief figure matches the module's status", () => {
  const { steps, statuses } = reveal({ ...base, hasPension: "no", employerMatch: "4" });
  assert.equal(steps[0].figure, `£${statuses.pension.amount.toLocaleString("en-GB")} a year`);
  assert.equal(steps[2].title, "Paying in 4% of your salary would start it.");
});

test("on track: the projected pot, and nothing to change without a bonus", () => {
  const { steps } = reveal({ ...base, myContribution: "5", employerMatch: "5" });
  assert.match(steps[0].title, /^projected in your pension by 65\.$/);
  assert.equal(steps[2].title, "Nothing to change right now.");
});

test("£100k tax trap: the saving and the sacrifice needed come from the module's own calculation", () => {
  const { steps } = reveal({ ...base, salary: "110000", myContribution: "5", employerMatch: "5" });
  assert.match(steps[0].title, /^of tax you could save\.$/);
  assert.match(steps[2].title, /through salary sacrifice would bring your income back to £100,000\./);
});
