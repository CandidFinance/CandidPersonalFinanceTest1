// One test per engine error fixed from the November 2026 re-audit
// (docs/finance-engine-audit-2026-11.md), tax trap and pension batch. Rules,
// examples and sources are in the report, by the same numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics, daysToTaxYearEnd } from "./metrics.js";
import { niOnBonusMonthly } from "./tax.js";
import { calcBonusSacrifice, calcAnnualAllowanceTaper } from "./pension.js";
import { taxTrap, thisTaxYear, yearProjection, position, bonusPotentialThisYear, topUpMonths, paydaysBetween, isPayday, paydayCheckDue } from "./taxTrap.js";
import { computeModuleStatuses, pendingBank, baselinePatch, gainedSoFar, bankChange } from "./moduleStatus.js";
import { childcareSupport } from "./childcare.js";
import { alertsDue } from "./alerts.js";
import { rollTaxYear } from "./taxYear.js";

test("E1: taxable savings interest counts in adjusted net income, not in take-home", () => {
  const d = { salary: "99000", cashTiers: [{ amount: "80000", rate: "4.5" }] };
  const m = calcMetrics(d);
  assert.equal(m.savingsInterest, 3600);
  assert.equal(m.adjustedNetIncome, 102600);
  // Not pay, but it tapers the allowance: take-home falls by the £520 of
  // tax on pay that the lost allowance costs, and no more.
  const without = calcMetrics({ ...d, cashTiers: [{ amount: "80000", rate: "" }] });
  assert.equal(Math.round((without.monthlyTakeHome - m.monthlyTakeHome) * 12), 520);
  // £2,600 over £100,000: £1,300 of allowance lost, £520 of tax.
  assert.equal(taxTrap(d, m).allowance?.tax ?? taxTrap(d, m).amount, 520);
  // No rate given: none assumed.
  assert.equal(calcMetrics({ salary: "99000", cashSavings: "80000" }).savingsInterest, 0);
});

test("E1: savings interest that takes income over £100,000 loses childcare support", () => {
  const d = { salary: "99000", cashTiers: [{ amount: "80000", rate: "4.5" }], kidsStatus: "yes", kidsCount: "1", kidsPreschool: "1", kidsSchool: "0" };
  const cc = childcareSupport(d, calcMetrics(d));
  assert.equal(cc?.state, "lost");
});

test("E2: the Pension module's bonus figure is on this tax year's figures, as the bonus email", () => {
  const d = { selectedModules: ["pension", "taxTrap"], salary: "100000", bonusAmount: "20000", myContribution: "5", employerMatch: "5", pensionType: "sacrifice", hasPension: "yes", employmentStatus: "employed",
    trapTopUps: [{ amount: 15000, route: "sacrifice", month: 11, taxYear: 2026, on: "2026-10-08" }] };
  const m = calcMetrics(d);
  const potential = bonusPotentialThisYear(d, m);
  assert.equal(Math.round(potential.standalone), 8000);
  const statuses = computeModuleStatuses(d, m);
  assert.equal(statuses.pension.potentialAmount, Math.round(potential.beyondTaper));
});

test("E3: the year-end email's trap figure is the module's, with or without pay to date", () => {
  const base = { salary: "110000", myContribution: "0", employerMatch: "0", hasPension: "yes", pensionType: "sacrifice", employmentStatus: "employed", email: "a@b.c", subscribed: true };
  const today = new Date(2027, 2, 2);
  const taxOf = d => alertsDue(d, { today }).find(a => a.kind === "taxYearEnd")?.items.find(i => /of tax:/.test(i));
  const without = taxOf(base);
  assert.match(without, /^£2,000 of tax/);
  // Pay to date that projects to the same £110,000.
  const withPay = taxOf({ ...base, payToDate: String(Math.round(110000 * 11 / 12)), payToDateOn: "2027-02-26", payday: "26" });
  assert.match(withPay, /^£2,000 of tax/);
});

test("E4: on 6 April, a new tax year asks nothing until the baseline's re-taken", () => {
  const d = { salary: "110000", myContribution: "5", employerMatch: "5", pensionType: "sacrifice", hasPension: "yes", employmentStatus: "employed", inputsTaxYear: 2026,
    moduleBaselines: { taxTrap: { amount: 0, answers: "x", banked: 1600, changes: [{ perYear: 1600, on: "2026-11-16", until: "2027-04-05" }] } } };
  const april = new Date(2027, 3, 6);
  const rolled = rollTaxYear(d, april);
  assert.equal(rolled.moduleBaselines.taxTrap.rebase, true);
  const changed = { ...rolled, myContribution: "6" };
  assert.equal(pendingBank(changed, "taxTrap", 900), 0);
  // Re-taken on the new year's £: the flag goes, and what's banked stays.
  const next = baselinePatch(rolled, { taxTrap: { amount: 900 } });
  assert.equal(next.taxTrap.rebase, undefined);
  assert.equal(next.taxTrap.amount, 900);
  assert.equal(next.taxTrap.banked, 1600);
});

test("E5: a payday at the weekend is the Friday before, so pay to date isn't counted twice", () => {
  const d = { salary: "110000", myContribution: "0", employerMatch: "0", employmentStatus: "employed", payToDate: "70000", payday: "28" };
  const m = calcMetrics(d);
  const today = new Date(2026, 10, 30);
  // 28 Nov 2026 is a Saturday: paid Friday 27th.
  const friday = yearProjection({ ...d, payToDateOn: "2026-11-27" }, m, today).projected;
  const saturday = yearProjection({ ...d, payToDateOn: "2026-11-28" }, m, today).projected;
  assert.equal(friday, saturday);
});

test("E6: a top-up's saving counts in full on the day; an ongoing change by the day", () => {
  const topUp = { moduleBaselines: bankChange({}, "taxTrap", 1600, "2026-11-16", "2027-04-05") };
  assert.equal(gainedSoFar(topUp, new Date(2026, 10, 16)).total, 1600);
  const ongoing = { moduleBaselines: bankChange({}, "pension", 365, "2026-11-16") };
  assert.equal(gainedSoFar(ongoing, new Date(2026, 10, 25)).total, 10);
});

test("E7: thisTaxYear run on its own output gives the same answer", () => {
  const d = { salary: "110000", myContribution: "0", employerMatch: "0", employmentStatus: "employed", payToDate: "50000", payToDateOn: "2026-10-01", payday: "28" };
  const a = thisTaxYear(d, calcMetrics(d));
  const b = thisTaxYear(a.d, a.m);
  assert.equal(taxTrap(b.d, b.m).amount, taxTrap(a.d, a.m).amount);
  assert.equal(b.m.adjustedNetIncome, a.m.adjustedNetIncome);
});

test("E8: NI on a bonus is on the month it's paid in", () => {
  // £45,000 salary, £10,000 bonus: £439 at 8% and £9,561 at 2%.
  assert.equal(Math.round(niOnBonusMonthly(45000 / 12, 10000)), 226);
  const d = { salary: "45000", bonusAmount: "10000", myContribution: "0", employerMatch: "0", hasPension: "yes", employmentStatus: "employed" };
  const r = calcBonusSacrifice(d, calcMetrics(d), 10000, 0);
  assert.equal(r.fullNIPct, 2);
});

test("E9: on 5 April there's no more than a day left", () => {
  assert.equal(daysToTaxYearEnd(new Date(2027, 3, 4, 10)), 1);
  assert.ok(daysToTaxYearEnd(new Date(2027, 3, 5, 10)) <= 1);
  assert.equal(daysToTaxYearEnd(new Date(2027, 3, 6, 10)), 365);
});

test("E10: take-home pays no NI on salary sacrificed, and matches the trap's", () => {
  const d = { salary: "40000", myContribution: "5", employerMatch: "5", pensionType: "sacrifice", hasPension: "yes", employmentStatus: "employed" };
  const m = calcMetrics(d);
  assert.equal(Math.round(position(d, m).takeHome / 12), Math.round(m.monthlyTakeHome));
});

test("E12: paid on the 3rd, April's payday is in the plan and the months match the paydays left", () => {
  const d = { payday: "3" };
  const today = new Date(2026, 10, 16);
  const months = topUpMonths(d, today);
  assert.equal(months.length, paydaysBetween(new Date(2026, 10, 16), new Date(2027, 3, 5), 3));
  assert.equal(months.at(-1).month, 4);
});

test("E12: the annual allowance taper takes a relief at source % as already gross", () => {
  const d = { salary: "250000", myContribution: "10", employerMatch: "0", pensionType: "relief", hasPension: "yes" };
  const t = calcAnnualAllowanceTaper(d, calcMetrics(d));
  assert.equal(t.thresholdIncome, 225000);
});

test("E5: paid on the 1st, a Sunday: payday is the Friday before, in the month before", () => {
  // 1 Feb 2026 is a Sunday: paid Friday 30 January.
  const d = { payday: "1" };
  assert.equal(isPayday(d, new Date(2026, 0, 30)), true);
  assert.equal(isPayday(d, new Date(2026, 1, 1)), false);
  assert.equal(paydayCheckDue(d, new Date(2026, 0, 30)), true);
});

test("E12: paid on the 6th, with 6 April at a weekend: no payday after 5 April in the plan", () => {
  // 6 Apr 2025 is a Sunday (paid Friday 4th, last tax year); 6 Apr 2026 is a Monday, next tax year.
  const months = topUpMonths({ payday: "6" }, new Date(2025, 3, 7));
  assert.equal(months.length, 11);
  assert.ok(!months.some(x => x.month === 4));
});

test("E1: interest on Cash ISA money isn't counted", () => {
  const d = { salary: "98000", cashTiers: [{ amount: "20000", rate: "5" }], isaPrevCash: "20000" };
  assert.equal(calcMetrics(d).savingsInterest, 0);
  assert.equal(calcMetrics({ ...d, isaPrevCash: "10000" }).savingsInterest, 500);
});
