import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses, bankChange, unbankChange, bankedFor } from "./moduleStatus.js";
import { choiceFor, withChoice, withoutChoice, CHOICE_IDS } from "./opportunityChoices.js";

const RATES = { isaRate: 4.5, nonIsaRate: 4.6 };
const base = {
  selectedModules: ["pension"], employmentStatus: "employed",
  salary: "55000", bonusAmount: "10000", otherIncome: "0", dividendIncome: "0", monthlyExpenses: "2000",
  hasPension: "yes", myContribution: "5", employerMatch: "5", pensionType: "sacrifice", studentLoan: "none", age: "35",
};
const pension = d => computeModuleStatuses(d, calcMetrics(d, RATES), RATES).pension;
const OCT_2026 = new Date(2026, 9, 8), MAY_2027 = new Date(2027, 4, 1);

test("a bonus to sacrifice keeps the pension needing action until it's answered", () => {
  const before = pension(base);
  assert.equal(before.status, "attention");
  assert.ok(before.potentialAmount > 0);
  for (const choice of ["done", "notForMe"]) {
    const after = pension({ ...base, opportunityChoices: withChoice(base, CHOICE_IDS.bonus, choice) });
    assert.equal(after.status, "ok");
    assert.equal(after.potentialAmount, 0);
  }
});

test("a retirement income gap set aside stops counting", () => {
  const short = { ...base, bonusAmount: "0", retirementTarget: "60000" };
  assert.match(pension(short).impactLabel, /retirement income you'd like/);
  const aside = pension({ ...short, opportunityChoices: withChoice(short, CHOICE_IDS.retirementGap, "notForMe") });
  assert.equal(aside.status, "ok");
  assert.equal(aside.impactLabel, null);
});

test("a choice lasts the tax year it was made in, and can be taken back", () => {
  const choices = withChoice(base, CHOICE_IDS.bonus, "notForMe", {}, OCT_2026);
  assert.ok(choiceFor({ opportunityChoices: choices }, CHOICE_IDS.bonus, OCT_2026));
  assert.equal(choiceFor({ opportunityChoices: choices }, CHOICE_IDS.bonus, MAY_2027), null);
  assert.equal(choiceFor({ opportunityChoices: withoutChoice({ opportunityChoices: choices }, CHOICE_IDS.bonus) }, CHOICE_IDS.bonus, OCT_2026), null);
});

test("undoing a done choice takes its saving back off", () => {
  const banked = { moduleBaselines: bankChange({}, "pension", 1200, "2026-10-08") };
  assert.equal(bankedFor(banked, "pension"), 1200);
  const undone = { moduleBaselines: unbankChange(banked, "pension", 1200, "2026-10-08") };
  assert.equal(bankedFor(undone, "pension"), 0);
  assert.deepEqual(undone.moduleBaselines.pension.changes, []);
});
