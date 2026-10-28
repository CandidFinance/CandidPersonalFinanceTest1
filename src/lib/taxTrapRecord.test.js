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

test("a monthly plan: one top-up a payday left, its £ a year banked, their % as it was; removing it takes it all back", async () => {
  const { recordTopUps, removeTopUp } = await import("./taxTrapRecord.js");
  const { monthlyPlan } = await import("./taxTrap.js");
  const m = calcMetrics(base);
  const t = taxTrap(base, m);
  const plan = monthlyPlan(base, m, t.needed);
  const after = apply(base, recordTopUps(base, plan.months.map(x => ({ amount: plan.monthly, route: "sacrifice", month: x.month })), "2026-10-08"));
  assert.equal(after.myContribution, "5");
  assert.equal(after.trapTopUps.length, plan.n);
  assert.equal(new Set(after.trapTopUps.map(u => u.group)).size, 1);
  assert.equal(after.trapTopUps[0].perYear, t.amount);
  assert.equal(bankedFor(after, "taxTrap"), t.amount);
  const statuses = computeModuleStatuses(after, calcMetrics(after));
  assert.equal(statuses.taxTrap.amount, 0);
  for (const key of Object.keys(after.moduleBaselines)) assert.equal(pendingBank(after, key, statuses[key]?.amount || 0), 0, key);
  const back = apply(after, removeTopUp(after, after.trapTopUps[0].group));
  assert.equal(back.trapTopUps.length, 0);
  assert.equal(bankedFor(back, "taxTrap"), 0);
});

test("a group taken back doesn't let the next one share a group with one still on the list", async () => {
  const { recordTopUps, removeTopUp } = await import("./taxTrapRecord.js");
  const one = (d, amount) => apply(d, recordTopUps(d, [{ amount, route: "sacrifice", month: 11 }], "2026-10-08"));
  const ab = one(one(base, 1000), 2000);
  const c = one(apply(ab, removeTopUp(ab, ab.trapTopUps[0].group)), 3000);
  assert.equal(new Set(c.trapTopUps.map(u => u.group)).size, 2);
  const left = apply(c, removeTopUp(c, c.trapTopUps[1].group));
  assert.deepEqual(left.trapTopUps.map(u => u.amount), [2000]);
});

test("no pension route answered yet:the one chosen is saved for Pension, with no \"did you make a change?\"", async () => {
  const { recordTopUps } = await import("./taxTrapRecord.js");
  const open = { ...base, pensionType: "" };
  open.moduleBaselines = bankChange(open, "pension", 0);
  const after = apply(open, recordTopUps(open, [{ amount: 3000, route: "relief", month: 11 }], "2026-10-08"));
  assert.equal(after.pensionType, "relief");
  const statuses = computeModuleStatuses(after, calcMetrics(after));
  assert.equal(pendingBank(after, "pension", statuses.pension?.amount || 0), 0);
  // Already answered: left as it is.
  assert.equal(recordTopUps(base, [{ amount: 3000, route: "relief", month: 11 }], "2026-10-08").pensionType, undefined);
});

test("a top-up's saving lasts its tax year: from 6 April it's no longer counted as saved", async () => {
  const { recordTopUps } = await import("./taxTrapRecord.js");
  const { gainedSoFar } = await import("./moduleStatus.js");
  const after = apply(base, recordTopUps(base, [{ amount: 4500, route: "sacrifice", month: 11 }], "2026-10-08"));
  const perYear = after.trapTopUps[0].perYear;
  assert.ok(perYear > 0);
  assert.equal(bankedFor(after, "taxTrap"), perYear);
  assert.equal(after.moduleBaselines.taxTrap.changes.at(-1).until, "2027-04-05");
  const april = new Date(2027, 3, 10);
  assert.equal(bankedFor(after, "taxTrap", april), 0);
  const g = gainedSoFar(after, april);
  assert.equal(g.perYear, 0);
  // Counted from 8 October to 5 April, both days: 180 days of it.
  assert.equal(g.total, Math.round(perYear * 180 / 365));
  // Last tax year's, seen now (8 Oct 2026): the trap's £ is back, and a
  // change made now counts from there, not from the £0 after the top-up.
  const lastYear = { ...after,
    trapTopUps: after.trapTopUps.map(u => ({ ...u, taxYear: 2025, on: "2025-10-08" })),
    moduleBaselines: { ...after.moduleBaselines, taxTrap: { ...after.moduleBaselines.taxTrap, changes: after.moduleBaselines.taxTrap.changes.map(c => ({ ...c, on: "2025-10-08", until: "2026-04-05" })) } } };
  assert.equal(bankedFor(lastYear, "taxTrap"), 0);
  const raised = { ...lastYear, myContribution: "9.091" };
  const now = computeModuleStatuses(raised, calcMetrics(raised)).taxTrap.amount;
  assert.equal(now, 0);
  assert.equal(pendingBank(raised, "taxTrap", now), perYear);
  // Recorded before `until` was kept: found by its top-up all the same.
  const legacy = { ...lastYear, moduleBaselines: { ...lastYear.moduleBaselines, taxTrap: { ...lastYear.moduleBaselines.taxTrap, changes: lastYear.moduleBaselines.taxTrap.changes.map(({ until, ...c }) => c) } } };
  assert.equal(bankedFor(legacy, "taxTrap"), 0);
});
