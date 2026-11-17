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

test("E12: Postgraduate turning-point salary uses the 6% repayment rate", async () => {
  const { calcStudentLoanScenario } = await import("./studentLoan.js");
  const d = { salary: "30000", studentLoan: "postgrad", loanBalance: "12000" };
  const m = calcMetrics(d);
  const sl = calcStudentLoanScenario(d, m);
  // £21,000 threshold + £12,000 × 6% interest ÷ 6% repayment = £33,000.
  assert.equal(sl.inflectionSalary, 33000);
});

// ── Forecast and windfall batch (F1–F8, Q9–Q12), 17 Nov 2026 ─────────────
// The characterisation base: age 32, £55,000, 5% salary sacrifice, £10,000
// cash at 2.5%, £5,000 into a Stocks and Shares ISA this year.
const fBase = {
  age: "32", salary: "55000", employmentStatus: "employed", monthlyExpenses: "1800",
  cashTiers: [{ amount: "10000", rate: "2.5" }], isaThisYearSS: "5000", isaPrevSS: "8000",
  hasPension: "yes", myContribution: "5", employerMatch: "5", potValue: "30000", retirementAge: "65", pensionType: "sacrifice", niYears: "8",
  studentLoan: "none", hasMortgage: "no",
};
const fRun = async (d, ...args) => {
  const { calcForecast } = await import("./forecast.js");
  return calcForecast(d, calcMetrics(d), ...args).options;
};
const line = (opts, label) => opts.find(o => o.label === label);

test("F1: a mortgage with no monthly payment entered holds its balance", async () => {
  const { calcNetWorthTrajectory } = await import("./forecast.js");
  const d = { ...fBase, hasMortgage: "yes", mortgageBalance: "240000", mortgageRate: "5.4", monthlyMortgage: "", propertyEquity: "110000" };
  const rows = calcNetWorthTrajectory(d, calcMetrics(d), 10, 0);
  assert.equal(rows[10].mortgageBalance, 240000);
  assert.equal(rows[10].propertyEquity, rows[0].propertyEquity);
  const opts = await fRun(d, 500, 10, 0);
  assert.ok(line(opts, "Mortgage overpayment").central > 60000);
});

test("F2: the mortgage line counts the money paid in, like the ISA line", async () => {
  const d = { ...fBase, hasMortgage: "yes", mortgageBalance: "240000", mortgageRate: "5.4", monthlyMortgage: "1500", propertyEquity: "110000" };
  const opts = await fRun(d, 500, 10, 0);
  // £60,000 paid in plus £19,325 of interest saved.
  assert.equal(line(opts, "Mortgage overpayment").central, 79325);
});

test("F2: the student loan line counts the money paid in", async () => {
  const d = { ...fBase, studentLoan: "plan2", loanBalance: "45000" };
  const sl = line(await fRun(d, 300, 10, 10000), "Student loan overpayment");
  // The loan cleared, so far more than the interest saved (£2,901 before).
  // Left alone this one is written off, so it's the repayments avoided from
  // then to the write-off, under the £45,000 balance.
  assert.ok(sl.clearedAt < 120 && sl.central > 30000 && sl.central < 45000, `${sl.central}`);
  assert.ok(sl.low <= sl.central && sl.central <= sl.high);
});

test("F5: salary sacrifice relief is band by band, with no NI saved past the 2029 cap", async () => {
  const sac = line(await fRun(fBase, 300, 10, 0), "Pension (salary sacrifice)").central;
  // Was £84,765 at 40% on all of it; only £1,980 of income is in the 40% band.
  assert.ok(sac < 74000 && sac > 70000, `${sac}`);
});

test("Q9: relief at source gets band-by-band relief too, not 20% only", async () => {
  const d = { ...fBase, salary: "80000", pensionType: "relief" };
  const opts = await fRun(d, 300, 10, 0);
  // All £3,600 a year is in the 40% band: the pension line is the ISA's ÷ 0.6.
  assert.equal(line(opts, "Pension (relief at source)").central, Math.round(line(opts, "Stocks & Shares ISA").central / 0.6));
});

test("F6: cash at a stated 0% stays at 0%", async () => {
  const { calcNetWorthTrajectory } = await import("./forecast.js");
  const d = { ...fBase, cashTiers: [], cashSavings: "20000", savingsRate: "0", monthlyExpenses: "0" };
  const m = calcMetrics(d);
  assert.equal(m.effectiveSavingsRate, 0);
  assert.equal(calcNetWorthTrajectory(d, m, 10, 0)[10].cash, 20000);
  // Blank still means 3.5%.
  assert.equal(calcMetrics({ ...d, savingsRate: "" }).effectiveSavingsRate, 3.5);
});

test("F8: cash 'high' is never under 'central' with an own rate over 5%", async () => {
  const c = line(await fRun({ ...fBase, cashTiers: [], savingsRate: "6" }, 500, 10, 0), "Cash savings");
  assert.ok(c.high >= c.central && c.central >= c.low);
});

test("Q12: both ISA lines fill the allowance first, the overflow taxed where it goes", async () => {
  const d = { ...fBase, salary: "80000" };
  // £500 a month fits in the allowance: nothing over it.
  const small = await fRun(d, 500, 10, 0);
  assert.equal(line(small, "Stocks & Shares ISA").split.out, 0);
  assert.equal(line(small, "Cash savings").split.out, 0);
  // £3,000 a month and £50,000 today go over it.
  const toShares = await fRun(d, 3000, 10, 50000, { overflow: "shares" });
  const toCash = await fRun(d, 3000, 10, 50000, { overflow: "cash" });
  for (const opts of [toShares, toCash]) for (const l of ["Stocks & Shares ISA", "Cash savings"]) {
    const o = line(opts, l);
    assert.ok(o.split.out > 0, l);
    assert.ok(Math.abs(o.split.isa + o.split.out - o.central) <= 1, l);
  }
  // Shares overflow grows faster than a savings account's.
  assert.ok(line(toShares, "Cash savings").central > line(toCash, "Cash savings").central);
});

test("Q12: the ISA line respects the £20,000 allowance", async () => {
  const { growPot } = await import("./forecast.js");
  const d = { ...fBase, salary: "80000" };
  const isa = line(await fRun(d, 3000, 10, 50000), "Stocks & Shares ISA").central;
  // With no limit and no tax it would be the plain compounding figure.
  const untaxed = Math.round(growPot({ months: 120, ratePct: 6, monthly: 3000, lump: 50000 }));
  assert.ok(isa < untaxed, `${isa} < ${untaxed}`);
});

test("Debt lines stop when the loan clears, never more than it would have cost", async () => {
  const { calcForecastSeries } = await import("./forecast.js");
  const d = { ...fBase, studentLoan: "plan2", loanBalance: "45000" };
  const m = calcMetrics(d);
  // £500 a month to 65 (33 years): was £337k, saving the freed money in cash.
  const sl = line(await fRun(d, 500, 33, 0), "Student loan overpayment");
  assert.ok(sl.clearedAt > 0);
  // No more than the balance plus the interest it would have charged
  // meanwhile: well under what was paid in over 33 years.
  assert.ok(sl.central < 45000 * 2, `${sl.central}`);
  const s = calcForecastSeries(d, m, 500, 33, 0).series.find(x => x.label === "Student loan overpayment");
  assert.equal(s.termLabel, "Cleared");
  assert.equal(s.values[33], s.values[s.termYear]);
});

test("Review: a one-off is counted from year 0", async () => {
  const { calcForecastSeries } = await import("./forecast.js");
  const d = { ...fBase, salary: "80000", hasMortgage: "yes", mortgageBalance: "200000", mortgageRate: "5", monthlyMortgage: "1200" };
  const s = calcForecastSeries(d, calcMetrics(d), 0, 5, 10000).series;
  for (const l of ["Stocks & Shares ISA", "Cash savings", "Mortgage overpayment"]) assert.equal(s.find(x => x.label === l).values[0], 10000, l);
  assert.ok(s.find(x => x.label === "Pension (salary sacrifice)").values[0] > 10000);
});

test("Review: a lump into a salary sacrifice pension saves no NI", async () => {
  const d = { ...fBase, pensionType: "sacrifice" };
  const sac = line(await fRun(d, 0, 1, 10000), "Pension (salary sacrifice)").central;
  const ras = line(await fRun({ ...d, pensionType: "relief" }, 0, 1, 10000), "Pension (relief at source)").central;
  assert.equal(sac, ras);
});

test("Review: Premium Bonds and Cash ISA money aren't taxed in the projection", async () => {
  const { calcNetWorthTrajectory } = await import("./forecast.js");
  const d = { ...fBase, salary: "80000", monthlyExpenses: "0", cashTiers: [], cashSavings: "20000", savingsRate: "", isaPrevCash: "20000", premiumBonds: "50000" };
  const m = calcMetrics(d);
  const rows = calcNetWorthTrajectory(d, m, 1, 0);
  // All cash is in a Cash ISA or Premium Bonds: grown untaxed at 3.5%.
  assert.equal(rows[1].cash, Math.round(m.totalLiquid * Math.pow(1 + 0.035 / 12, 12)));
  // The same £20,000 outside an ISA at an assumed 3.5% is taxed.
  const d2 = { ...d, isaPrevCash: "0", premiumBonds: "0", cashSavings: "80000" };
  const m2 = calcMetrics(d2);
  assert.ok(calcNetWorthTrajectory(d2, m2, 1, 0)[1].cash < Math.round(m2.totalLiquid * Math.pow(1 + 0.035 / 12, 12)));
});

test("F4: windfall pension relief is band by band", async () => {
  const { windfallOptions } = await import("./windfall.js");
  const d = { ...fBase, pensionType: "relief" };
  const p = windfallOptions(d, calcMetrics(d), { amount: 50000, source: "inheritance", arrived: true, earmark: "none" }).options.find(o => o.key === "pension");
  // £10,000 in: 20% added on all of it, and 20% more on the £1,980 in the
  // 40% band. Was £6,667 at 40% on the whole.
  const relief = p.value(10000).figure;
  assert.ok(relief > 2900 && relief < 3100, `${relief}`);
});

test("F7: redundancy compensation over £30,000 counts as earnings for pension relief", async () => {
  const { settlementTax } = await import("./windfall.js");
  const t = settlementTax({ notice: 5000, compensation: 80000 }, 20000);
  assert.equal(t.relevantEarnings, 75000);
});

test("Q11: the redundancy pension room uses the tapered or £10,000 allowance", async () => {
  const { windfallOptions } = await import("./windfall.js");
  // £300,000 of pay: the allowance tapers well under £60,000.
  const d = { ...fBase, salary: "300000", pensionType: "relief" };
  const m = calcMetrics(d);
  const { calcAnnualAllowanceRoom } = await import("./pension.js");
  const aa = calcAnnualAllowanceRoom(d, m).approxAA;
  assert.ok(aa < 60000);
  const p = windfallOptions(d, m, { source: "redundancy", arrived: true, earmark: "none", earnedBefore: 0, parts: { notice: 5000, compensation: 80000 } }).options.find(o => o.key === "pension");
  assert.match(p.detail, new RegExp(`up to £${aa.toLocaleString("en-GB")} can go in`));
});

test("Q10: retirement adequacy uses the NI-years State Pension, from State Pension age", async () => {
  const { retirementAdequacy, projectedStatePension } = await import("./crossModule.js");
  // 8 years now, 27 more to 67: a full State Pension.
  assert.equal(projectedStatePension(fBase, 65), 12548);
  // Starting at 50 with 5 years: 5 + 17 = 22 years.
  assert.equal(projectedStatePension({ age: "50", niYears: "5" }, 67), Math.round(22 / 35 * 241.30 * 52));
  const early = retirementAdequacy({ ...fBase, retirementTarget: "30000", retirementAge: "60" }, calcMetrics(fBase));
  assert.equal(early.beforeStatePension, true);
  const at67 = retirementAdequacy({ ...fBase, retirementTarget: "30000", retirementAge: "67" }, calcMetrics(fBase));
  assert.equal(at67.beforeStatePension, false);
  assert.ok(early.net < at67.net);
});
