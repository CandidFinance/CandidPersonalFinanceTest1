import test from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { taxTrap, pensionPath, paydayOf } from "./taxTrap.js";
import { recordSacrifice, undoSacrifice } from "./taxTrapRecord.js";
import { computeModuleStatuses, pendingBank, bankedFor, bankChange } from "./moduleStatus.js";
import { CHOICE_IDS, choiceFor } from "./opportunityChoices.js";

// £110,000, 5% by salary sacrifice, a toddler in nursery: the trap costs
// £11,190 a year, and £4,500 more a year takes them back to £100k.
const base = { employmentStatus: "employed", salary: "110000", myContribution: "5", pensionType: "sacrifice", pensionStatus: "yes", hasPension: "yes", studentLoan: "none",
  ukNation: "england", scottishTaxpayer: "no", age: "35", kidsStatus: "yes", kidsCount: "1", kidsPreschool: "1", kidsSchool: "0", childcareMonthly: "1500",
  selectedModules: ["taxTrap", "pension"] };
// Pension's baseline taken at these answers, as the app does once it's
// answered.
base.moduleBaselines = bankChange(base, "pension", 0);
const apply = (d, patch) => ({ ...d, ...patch });

test("recording the way back to £100k: the contribution goes up, its £ a year counts as saved, and nothing asks about it again", () => {
  const m = calcMetrics(base);
  const t = taxTrap(base, m);
  const after = apply(base, recordSacrifice(base, m, t.needed, "sacrifice", "2026-10-27"));
  assert.equal(after.myContribution, "9.091");
  assert.equal(taxTrap(after, calcMetrics(after)).amount, 0);
  const c = choiceFor(after, CHOICE_IDS.taxTrapSacrifice);
  assert.equal(c.perYear, t.amount);
  assert.equal(c.perYear, pensionPath(base, m, t.needed).avoided);
  assert.equal(bankedFor(after, "taxTrap"), t.amount);
  // The pension module's answers moved too, without a "did you make a
  // change?" of its own.
  assert.ok(after.moduleBaselines.pension.answers !== base.moduleBaselines.pension.answers);
  const statuses = computeModuleStatuses(after, calcMetrics(after));
  for (const key of Object.keys(after.moduleBaselines)) assert.equal(pendingBank(after, key, statuses[key]?.amount || 0), 0, key);
});

test("undo puts the answers back and takes the saving off", () => {
  const m = calcMetrics(base);
  const after = apply(base, recordSacrifice(base, m, 4500, "sacrifice", "2026-10-27"));
  const back = apply(after, undoSacrifice(after));
  assert.equal(back.myContribution, "5");
  assert.equal(back.pensionType, "sacrifice");
  assert.equal(choiceFor(back, CHOICE_IDS.taxTrapSacrifice), null);
  assert.equal(bankedFor(back, "taxTrap"), 0);
});

test("someone not yet paying in is recorded as paying in, and undo takes it back", () => {
  const none = { ...base, myContribution: "", pensionType: "", pensionStatus: "no", hasPension: "no" };
  const after = apply(none, recordSacrifice(none, calcMetrics(none), 10000, "sacrifice", "2026-10-27"));
  assert.equal(after.pensionStatus, "yes");
  const back = apply(after, undoSacrifice(after));
  assert.equal(back.pensionStatus, "no");
  assert.equal(back.hasPension, "no");
  assert.equal(back.myContribution, "");
});

test("payday: the 28th until they say", () => {
  assert.equal(paydayOf({}), 28);
  assert.equal(paydayOf({ payday: "15" }), 15);
});

test("undo after a later edit to the contribution takes off only what this added", () => {
  const m = calcMetrics(base);
  const after = apply(base, recordSacrifice(base, m, 4500, "sacrifice", "2026-10-27"));
  const edited = { ...after, myContribution: "12" };
  const back = apply(edited, undoSacrifice(edited));
  assert.equal(back.myContribution, String(Math.round((12 - (9.091 - 5)) * 1e4) / 1e4));
});

test("a change already waiting to be confirmed elsewhere is left to ask about", () => {
  // Pension's answers moved before recording (a new employer match).
  const pending = { ...base, employerMatch: "8" };
  const after = apply(pending, recordSacrifice(pending, calcMetrics(pending), 4500, "sacrifice", "2026-10-27"));
  assert.equal(after.moduleBaselines.pension.answers, base.moduleBaselines.pension.answers);
});
