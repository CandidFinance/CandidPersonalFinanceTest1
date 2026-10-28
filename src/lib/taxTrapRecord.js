// "I've set this up" for the £100k tax trap's pension payment: the amount a
// year, by salary sacrifice or relief at source, added to what they pay in
// now, as their own answers (myContribution, pensionType), and what it keeps
// a year (the trap's £ before less after) counted as saved. Every module
// whose answers that moves has its baseline moved with it, so none of them
// asks "did you make a change?" (BankConfirm) about it as well. Undo puts it
// all back. Apart from taxTrap.js, which moduleStatus.js imports.

import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses, bankChange, unbankChange, bankPatch, answersMoved } from "./moduleStatus.js";
import { CHOICE_IDS, choiceFor, withChoice, withoutChoice } from "./opportunityChoices.js";
import { taxYearOf } from "./taxYear.js";

const trapAmount = d => computeModuleStatuses(d, calcMetrics(d)).taxTrap?.amount || 0;
// Today as the local date, so just after midnight isn't yesterday.
const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

// Baselines moved, not banked, for every module but `except` whose answers
// this has moved. One with a change already waiting to be confirmed
// (`was` has its answers moved) is left to ask about it.
function settle(d, except, was) {
  const statuses = computeModuleStatuses(d, calcMetrics(d));
  let next = d;
  for (const key of Object.keys(d.moduleBaselines || {})) {
    if (key === except || answersMoved(was, key) || !answersMoved(next, key)) continue;
    next = { ...next, moduleBaselines: bankPatch(next, key, statuses[key]?.amount || 0, false) };
  }
  return next.moduleBaselines || {};
}

// Top-ups this tax year (taxTrap.js trapTopUps), as one group: a monthly
// plan's payments ([{ amount, route, month }], one a payday) or a one-off
// from the bonus. Their monthly contribution stays as it is; how they pay in
// (pensionType), if Pension doesn't have it yet, is the route chosen, for
// Pension too. What it keeps a year of the trap's £ is banked as a change
// made today (on the group's first payment), and the baseline taken at the
// new £. The patch (fields to set).
export function recordTopUps(d, payments, on = today()) {
  const now = new Date();
  const taxYear = taxYearOf(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  // One past the highest group number so far: the list's length could repeat
  // a group still on it once an earlier one is taken back.
  const group = `${on}-${Math.max(-1, ...(d.trapTopUps || []).map(u => +String(u.group || u.id).split("-").pop() || 0)) + 1}`;
  const ups = payments.filter(u => u.amount > 0).map((u, i) => ({ id: `${group}-${i}`, group, amount: Math.round(u.amount), route: u.route, month: +u.month || now.getMonth() + 1, taxYear, on }));
  if (!ups.length) return {};
  const route = d.pensionType ? {} : { pensionType: ups[0].route };
  let next = { ...d, ...route, trapTopUps: [...(d.trapTopUps || []), ...ups] };
  ups[0].perYear = Math.max(0, Math.round(trapAmount(d) - trapAmount(next)));
  next = { ...next, moduleBaselines: bankChange(next, "taxTrap", ups[0].perYear, on) };
  next = { ...next, moduleBaselines: bankPatch(next, "taxTrap", trapAmount(next), false, on) };
  if (route.pensionType) next = { ...next, moduleBaselines: settle(next, "taxTrap", d) };
  return { ...route, trapTopUps: next.trapTopUps, moduleBaselines: next.moduleBaselines };
}

// Taking a group back (`group`, or a single top-up's id): off the list, and
// what it banked off the baseline.
export function removeTopUp(d, group) {
  const gone = (d.trapTopUps || []).filter(u => (u.group || u.id) === group);
  if (!gone.length) return {};
  const perYear = gone.reduce((s, u) => s + (u.perYear || 0), 0);
  let next = { ...d, trapTopUps: d.trapTopUps.filter(u => (u.group || u.id) !== group) };
  next = { ...next, moduleBaselines: unbankChange(next, "taxTrap", perYear, gone[0].on) };
  next = { ...next, moduleBaselines: bankPatch(next, "taxTrap", trapAmount(next), false) };
  return { trapTopUps: next.trapTopUps, moduleBaselines: next.moduleBaselines };
}

// Before top-ups (to 28 Oct 2026), "I've set this up" raised their pension %:
// recordSacrifice is how those were recorded, undoSacrifice takes one back.
// The patch (fields to set) recording `amount` a year paid in by `route`.
export function recordSacrifice(d, m, amount, route, on = today()) {
  const prevContribution = d.myContribution ?? "";
  const prevType = d.pensionType ?? "";
  const pct = (+prevContribution || 0) + amount / m.salary * 100;
  const paying = d.pensionStatus === "yes" || d.pensionStatus === "db" ? {} : { pensionStatus: "yes", hasPension: "yes" };
  // Rounded up, so at least the amount goes in: a pound short of it would
  // leave them over £100k, the childcare still lost.
  let next = { ...d, ...paying, myContribution: String(Math.ceil(pct * 1e4 - 1e-6) / 1e4), pensionType: route };
  const perYear = Math.max(0, Math.round(trapAmount(d) - trapAmount(next)));
  // Banked as a change made today, then the baseline taken at the new £.
  next = { ...next, moduleBaselines: bankChange(next, "taxTrap", perYear, on) };
  next = { ...next, moduleBaselines: bankPatch(next, "taxTrap", trapAmount(next), false, on) };
  next = { ...next, moduleBaselines: settle(next, "taxTrap", d) };
  return {
    ...paying,
    myContribution: next.myContribution,
    pensionType: route,
    moduleBaselines: next.moduleBaselines,
    opportunityChoices: withChoice(d, CHOICE_IDS.taxTrapSacrifice, "done", { amount, route, prevContribution, prevType, setContribution: next.myContribution, perYear, on, moduleKey: "taxTrap",
      ...(paying.pensionStatus ? { prevStatus: d.pensionStatus ?? "", prevHas: d.hasPension ?? "" } : {}) }),
  };
}

// The patch taking it back: their answers as they were, the saving off.
// Their contribution changed since: only what this added comes off it.
export function undoSacrifice(d) {
  const c = choiceFor(d, CHOICE_IDS.taxTrapSacrifice);
  if (!c) return {};
  const edited = c.setContribution != null && String(d.myContribution ?? "") !== String(c.setContribution);
  const status = "prevStatus" in c && !edited ? { pensionStatus: c.prevStatus, hasPension: c.prevHas } : {};
  const contribution = edited ? String(Math.max(0, Math.round(((+d.myContribution || 0) - (+c.setContribution - (+c.prevContribution || 0))) * 1e4) / 1e4)) : c.prevContribution;
  const type = edited ? d.pensionType : c.prevType;
  let next = { ...d, ...status, myContribution: contribution, pensionType: type };
  next = { ...next, moduleBaselines: unbankChange(next, "taxTrap", c.perYear, c.on) };
  next = { ...next, moduleBaselines: bankPatch(next, "taxTrap", trapAmount(next), false) };
  next = { ...next, moduleBaselines: settle(next, "taxTrap", d) };
  return {
    ...status,
    myContribution: contribution,
    pensionType: type,
    moduleBaselines: next.moduleBaselines,
    opportunityChoices: withoutChoice(d, CHOICE_IDS.taxTrapSacrifice),
  };
}
