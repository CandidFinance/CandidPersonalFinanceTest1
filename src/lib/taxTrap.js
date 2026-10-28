// The £100,000 tax trap: from £100,000 of adjusted net income, the tax-free
// Personal Allowance goes, £1 for every £2 over, until it's gone at
// £125,140. Each £1 earned there costs 40% tax plus the 20% of allowance it
// takes away (Scotland: 45% plus 22.5%), with 2% NI on top, and student loan
// repayments too. At £100,000.01 childcare support stops as well (Tax-Free
// Childcare, and England's funded hours: childcare.js).
// The module's figures, worked out on the user's own pay: their rate on the
// next £1,000, what being over costs, and what each way back to £100,000
// costs in take-home pay and what it brings back. Pure, unit tested in
// taxTrap.test.js.
//
// Ways back to £100,000, each lowering adjusted net income:
//  - Pension: salary sacrifice (lowers pay, so NI and student loan too) or
//    relief at source (paid from take-home; the 20% basic relief goes into
//    the pension, the rest is claimed back through tax).
//  - Gift Aid: like relief at source, with the money going to charity.
//  - Other salary sacrifice (an electric car, cycle to work): like a pension
//    sacrifice, per £1; what it buys is theirs to weigh.
//  - A 4-day week: 80% of the salary.

import { PA_TAPER_START, ADDITIONAL_RATE_THRESHOLD, PERSONAL_ALLOWANCE, calcIncomeAndDividendTax, calcNI, salarySacrificeNiCap } from "./tax.js";
import { SL_REPAYMENT_THRESHOLDS, SL_REPAYMENT_RATES } from "./studentLoan.js";
import { payGrowthOf, calcMetrics } from "./metrics.js";
import { taxYearFor, taxYearOf } from "./taxYear.js";
import { payFactor } from "./growth.js";
import { calcAnnualAllowanceRoomBeforeTopUps } from "./pension.js";
import { childcareSupport } from "./childcare.js";

export const TRAP_START = PA_TAPER_START;
export const TRAP_END = ADDITIONAL_RATE_THRESHOLD;
// Within this of £100,000, on this much pay before any pension (a 20%
// bonus takes £85,000 close), or crossing it within TRAP_YEARS at the pay
// growth they expect, the module is offered.
export const TRAP_NEAR = 10000;
// Within this of £100,000 it's on the edge: amber, on Progress's Tax shield
// and the module's card (moduleStatus.js).
export const TRAP_EDGE = 5000;
export const TRAP_GROSS = 85000;
export const TRAP_YEARS = 3;
// How far ahead crossingYear looks.
const CROSSING_LOOKAHEAD = 10;
export const FOUR_DAY_SHARE = 0.8;

const num = v => +v || 0;

// The day of the month they're paid (d.payday, set in Inputs), the 28th
// until they say.
export const DEFAULT_PAYDAY = 28;
export const paydayOf = d => Math.min(31, Math.max(1, Math.round(+d.payday || DEFAULT_PAYDAY)));

// Pay and other income before any pension.
const grossIncome = d => num(d.salary) + num(d.bonusAmount) + num(d.otherIncome) + num(d.dividendIncome);
// Adjusted net income from the answers alone (metrics.js works it out the
// same way), for deciding whether to offer the module where only `d` is to
// hand (appEntry.js modulesInView).
export function roughAdjustedNetIncome(d) {
  return grossIncome(d) - num(d.salary) * num(d.myContribution) / 100;
}
// Near or over £100,000, on £85,000 or more before pension, or heading
// over it within TRAP_YEARS.
export function trapInView(d, ani = roughAdjustedNetIncome(d)) {
  if (!(num(d.salary) > 0) || d.employmentStatus === "not_working") return false;
  if (ani >= TRAP_START - TRAP_NEAR || grossIncome(d) >= TRAP_GROSS) return true;
  const growth = payGrowthOf(d, num(d.salary), taxYearFor(d));
  return ani * payFactor(growth, TRAP_YEARS) >= TRAP_START;
}

// The tax year (by the year it starts in) their adjusted net income passes
// £100,000 at the pay growth they expect (as trapInView projects it),
// within CROSSING_LOOKAHEAD years; null if it doesn't, or they're over.
export function crossingYear(d, m) {
  const ani = m.adjustedNetIncome;
  if (!(m.salary > 0) || ani > TRAP_START) return null;
  const year = taxYearFor(d);
  const growth = payGrowthOf(d, m.salary, year);
  for (let y = 1; y <= CROSSING_LOOKAHEAD; y++) {
    if (ani * payFactor(growth, y) > TRAP_START) return year + y;
  }
  return null;
}

// Where their money goes at a given salary, with extra paid in by salary
// sacrifice (`sacrifice`) or from take-home with relief at source or Gift
// Aid (`relief`, the gross amount). Their own pension contribution stays the
// same share of salary. Take-home is after income tax, NI, student loan
// repayments and every contribution; relief at source costs its gross
// amount, the basic-rate part of it coming back through the tax worked out
// here (`tax` already allows for it).
// `extra`: more pay on top (a rise or a bonus), the contribution unchanged.
export function position(d, m, { salary = m.salary, sacrifice = 0, relief = 0, extra = 0 } = {}) {
  const pct = num(d.myContribution) / 100;
  const own = salary * pct;
  const bySacrifice = d.pensionType === "sacrifice";
  const totalSacrifice = (bySacrifice ? own : 0) + sacrifice;
  // Relief at source top-ups this year (thisTaxYear), already off m's
  // adjusted net income: counted here as paid in, for their tax and take-home.
  const topUps = m.topUpRelief || 0;
  const totalRelief = (bySacrifice ? 0 : own) + relief + topUps;
  const bonus = num(d.bonusAmount) + extra, other = num(d.otherIncome), dividends = num(d.dividendIncome);
  const pay = salary + bonus - totalSacrifice;
  // Anything else in adjusted net income (a State Pension, pay earlier in the
  // year) as metrics.js has it.
  const rest = m.adjustedNetIncome + topUps - (m.salary + num(d.bonusAmount) + other + dividends - m.salary * pct);
  const ani = pay + other + dividends - totalRelief + rest;
  // Relief at source: the basic-rate band is extended by the gross paid in
  // and the allowance worked out on income less it, which comes to the tax
  // on income less the gross, plus the basic rate on the gross (that 20%
  // goes into the pension, or to the charity). E.g. £120,000 with £20,000
  // paid in: £27,432 on £100,000, plus £4,000, is £31,432.
  const tax = calcIncomeAndDividendTax(ani - dividends, dividends, m.taxYear, !!m.scottish) + 0.2 * totalRelief;
  // From April 2029, salary sacrifice past £2,000 a year pays NI as pay.
  const niPay = pay + Math.max(0, totalSacrifice - salarySacrificeNiCap(m.taxYear));
  const ni = calcNI(niPay, { selfEmployed: d.employmentStatus === "self_employed", pastStatePensionAge: !!m.pastStatePensionAge });
  const plan = d.studentLoan;
  const sl = m.loanBal > 0 && SL_REPAYMENT_THRESHOLDS[plan] ? Math.max(0, pay - SL_REPAYMENT_THRESHOLDS[plan]) * (SL_REPAYMENT_RATES[plan] || 0) : 0;
  const pg = m.pgLoanBal > 0 ? Math.max(0, pay - SL_REPAYMENT_THRESHOLDS.postgrad) * SL_REPAYMENT_RATES.postgrad : 0;
  // Paid from take-home with relief at source: 80% of the gross (the rest is
  // the relief added).
  const takeHome = salary + bonus + other + dividends - totalSacrifice - 0.8 * totalRelief - tax - ni - sl - pg;
  return { salary, ani, tax, ni, sl: sl + pg, takeHome };
}

// What the next £1,000 of pay (a rise or a bonus) loses to tax, NI and
// student loan, as a share: their marginal rate, and its parts.
export function marginalRate(d, m, salary = m.salary) {
  const step = 1000;
  const a = position(d, m, { salary }), b = position(d, m, { salary, extra: step });
  const part = k => Math.max(0, (b[k] - a[k]) / step);
  const tax = part("tax"), ni = part("ni"), sl = part("sl");
  return { rate: tax + ni + sl, tax, ni, sl };
}

// The marginal rate at every income from £0, for the chart: [{ income,
// rate, tax, ni, sl }], the rate and its parts. On their own setup (where
// they live, a student loan, employed or self-employed), with income all
// from salary, so each step shows where it comes: the 20%, 40% and 45%
// bands, NI, and the £100k trap.
export function rateCurve(d, m, from = 0, to = 130000, step = 1000) {
  const plain = { ...d, bonusAmount: 0, otherIncome: 0, dividendIncome: 0, myContribution: 0 };
  const points = [];
  for (let income = from; income <= to; income += step) {
    points.push({ income, ...marginalRate(plain, { ...m, salary: income, adjustedNetIncome: income }, income) });
  }
  return points;
}

// What the rate is made of, in words: "tax and National Insurance", with
// student loan where there is one.
export function lostTo(rate) {
  const parts = ["tax", rate.ni > 0 ? "National Insurance" : null, rate.sl > 0 ? "student loan" : null].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
}

// The Personal Allowance lost at an adjusted net income, and the tax it
// costs (at 40%, Scotland 45%).
export function allowanceLost(ani, scottish = false) {
  const lost = Math.max(0, Math.min(PERSONAL_ALLOWANCE, (ani - TRAP_START) / 2));
  return { lost: Math.round(lost), tax: Math.round(lost * (scottish ? 0.45 : 0.4)) };
}

// The childcare support their own income over £100k stops: back at £100k
// it's theirs again (unless a partner is over too: Kids & family has that).
function childcareLostOf(d, m) {
  const cc = childcareSupport(d, m);
  return { cc, lost: cc && cc.state === "lost" && !cc.planning ? cc.atStake : 0 };
}

// What paying `amount` more into a pension does, by salary sacrifice or
// relief at source (`route`): the take-home it costs, the tax (and NI) it
// saves, and, once their income is back to £100k, the childcare support
// that comes back. bank: that childcare less the take-home. Past the annual
// allowance left (overRoom) the extra is taxed back, so no childcare is
// counted for it. For the module's slider and its pension option. Employed,
// it's salary sacrifice unless they've said they pay in from take-home.
export function pensionPath(d, m, amount, route = d.pensionType !== "relief" && d.employmentStatus !== "self_employed" ? "sacrifice" : "relief") {
  const now = position(d, m);
  const after = position(d, m, route === "sacrifice" ? { sacrifice: amount } : { relief: amount });
  const takeHome = Math.max(0, Math.round(now.takeHome - after.takeHome));
  const under = after.ani <= TRAP_START;
  const overRoom = amount > allowanceLeft(d, m);
  const childcare = under && !overRoom ? childcareLostOf(d, m).lost : 0;
  // What it keeps of the trap's £ a year: the allowance tax back, and the
  // childcare.
  const avoided = allowanceLost(now.ani, !!m.scottish).tax - allowanceLost(after.ani, !!m.scottish).tax + childcare;
  return { route, amount, pension: amount, takeHome, taxSaved: amount - takeHome, ani: Math.round(after.ani), under, overRoom, childcare, bank: childcare - takeHome, avoided };
}

// Everything the module shows. Null without a salary.
//  amount: what the trap costs them a year, in money: the tax on the
//    allowance lost, and the childcare support their own income over £100k
//    stops (a partner's is Kids & family's). The module's £, on Home too.
//  options: the ways back to £100k, each with its outcome in £ a year:
//    takeHome (what it takes off take-home pay, or for Gift Aid what it
//    costs them after the relief), what it adds (pension, charity), taxSaved
//    (what it doesn't cost, for what goes in), childcare (support back) and
//    bank (childcare back less the take-home it costs). Largest worth first:
//    bank, plus what goes into their own pension (not a charity's £, a
//    car's or days off).
//  crossing: under £100k, the tax year they'd pass it (crossingYear).
export function taxTrap(d, m) {
  if (!(m.salary > 0) || m.noEarnings) return null;
  const ani = m.adjustedNetIncome;
  const over = ani > TRAP_START;
  const now = position(d, m);
  const rate = marginalRate(d, m);
  const aaRoom = allowanceLeft(d, m);
  const allowance = allowanceLost(ani, !!m.scottish);
  const { cc, lost: childcareLost } = childcareLostOf(d, m);
  const childcareAtRisk = cc && cc.state === "near" ? cc.atStake : 0;
  const needed = over ? Math.ceil(ani - TRAP_START) : 0;
  const fits = needed <= aaRoom;
  const amount = over ? Math.round(allowance.tax + childcareLost) : 0;

  const employed = d.employmentStatus !== "self_employed";
  const cost = after => Math.max(0, Math.round(now.takeHome - after.takeHome));
  const outcome = (o, childcare) => ({ ...o, childcare, bank: childcare - o.takeHome, worth: childcare - o.takeHome });
  const options = [];
  if (over) {
    const share = needed / m.salary;
    // Pension, the way they pay in (salary sacrifice, unless they've said
    // relief at source; always relief at source for the self-employed).
    const pension = pensionPath(d, m, needed);
    options.push({ key: "pension", share, fits, ...pension, worth: pension.bank + pension.pension });
    if (employed) {
      const other = cost(position(d, m, { sacrifice: needed }));
      options.push(outcome({ key: "sacrifice", amount: needed, share, takeHome: other, taxSaved: needed - other }, childcareLost));
    }
    // Gift Aid: they give 80% and the charity claims the rest; the higher
    // rate comes back to them through Self Assessment.
    const giftAid = cost(position(d, m, { relief: needed }));
    options.push(outcome({ key: "giftAid", amount: needed, given: Math.round(needed * 0.8), takeHome: giftAid, charity: needed,
      taxSaved: Math.round(needed * 0.8) - giftAid }, childcareLost));
    // A 4-day week: 80% of the salary, the same share of it paid in.
    const fourDay = position(d, m, { salary: m.salary * FOUR_DAY_SHARE });
    const gross = Math.round(m.salary * (1 - FOUR_DAY_SHARE));
    const fourDayCost = cost(fourDay);
    options.push(outcome({ key: "fourDay", gross, takeHome: fourDayCost, taxSaved: gross - fourDayCost, under: fourDay.ani <= TRAP_START, daysOff: 52 },
      fourDay.ani <= TRAP_START ? childcareLost : 0));
    options.sort((a, b) => b.worth - a.worth);
  }

  return {
    ani: Math.round(ani), over, aboveTaper: ani >= TRAP_END, needed, fits, aaRoom,
    headroom: over ? 0 : Math.round(TRAP_START - ani),
    rate, allowance, childcareLost, childcareAtRisk, nation: cc?.nation || null,
    // The rate just over £100k, for someone under it, and just under it, to
    // set the trap's rate against.
    trapRate: marginalRate(d, m, m.salary + (TRAP_START + 1000 - ani)).rate,
    belowRate: marginalRate(d, m, m.salary + (TRAP_START - 2000 - ani)).rate,
    // The childcare at stake, in its two parts (childcare.js): null without
    // children 11 or under, or one on the way.
    childcare: cc ? { tfc: cc.tfc, hours: cc.hours, preschool: cc.preschool, children: cc.children, planning: cc.planning, state: cc.state } : null,
    amount, options, takeHome: Math.round(now.takeHome), crossing: crossingYear(d, m),
  };
}

// ── This tax year, as it goes. The trap is measured on the whole tax year's
// income, so where it's heading moves with each payday, a bonus, a pay rise.
// `d.payToDate`: taxable pay to date from their payslip (after any salary
// sacrifice), as of `d.payToDateOn` ("YYYY-MM-DD"), from the payday
// check-in. Without it, or from an earlier tax year, the year is their
// answers' adjusted net income.
// `d.trapTopUps`: pension payments this tax year on top of what they pay in
// each month (myContribution): [{ id, group, amount, route, month, taxYear,
// perYear, on }], one per payday for a monthly plan (sharing its `group`),
// or one from the bonus. route "sacrifice" comes out of that month's pay
// (`month`, 1 to 12); "relief" is a payment of `amount` gross (with the
// basic-rate relief added) to a pension such as a SIPP. Each lowers the
// year's adjusted net income by its amount. Those from another tax year are
// ignored.

const ymd = s => { const [y, mo, day] = String(s).split("-").map(Number); return y && mo && day ? new Date(y, mo - 1, day) : null; };
const dayOnly = t => new Date(t.getFullYear(), t.getMonth(), t.getDate());
// Their payday in a month: the day, or the month's last day if it's shorter.
const paydayIn = (y, mo, payday) => new Date(y, mo, Math.min(payday, new Date(y, mo + 1, 0).getDate()));
// Paydays after `from` up to and including `to`.
export function paydaysBetween(from, to, payday) {
  let n = 0;
  for (let y = from.getFullYear(), mo = from.getMonth(); y < to.getFullYear() || (y === to.getFullYear() && mo <= to.getMonth()); mo === 11 ? (y++, mo = 0) : mo++) {
    const p = paydayIn(y, mo, payday);
    if (p > from && p <= to) n++;
  }
  return n;
}
const taxYearEnd = ty => new Date(ty + 1, 3, 5);
const DAY = 86400000;

export const topUpsThisYear = (d, today = new Date()) => {
  const ty = taxYearOf(dayOnly(today));
  return (Array.isArray(d.trapTopUps) ? d.trapTopUps : []).filter(u => +u.taxYear === ty && +u.amount > 0);
};
const sum = (ups, route) => ups.reduce((s, u) => s + (!route || u.route === route ? +u.amount : 0), 0);
// A month's payday in tax year `ty`: April to December in `ty`, January to
// March after it.
const paydayOfMonth = (ty, month, payday) => paydayIn(month >= 4 ? ty : ty + 1, month - 1, payday);

// The month the bonus is paid (1 to 12): March when it isn't known.
export const bonusMonthOf = d => +d.bonusMonth >= 1 && +d.bonusMonth <= 12 ? +d.bonusMonth : 3;
// The bonus's payday.
const bonusDay = (d, ty, payday) => paydayOfMonth(ty, bonusMonthOf(d), payday);

export function yearProjection(d, m, today = new Date()) {
  const payday = paydayOf(d);
  const now = dayOnly(today);
  const ty = taxYearOf(now);
  const end = taxYearEnd(ty);
  const left = paydaysBetween(now, end, payday);
  const daysLeft = Math.max(0, Math.round((end - now) / DAY));
  const on = ymd(d.payToDateOn);
  const tracked = +d.payToDate > 0 && on && on <= now && taxYearOf(on) === ty && d.employmentStatus === "employed";
  let projected = m.adjustedNetIncome;
  if (tracked) {
    const contribution = (m.salary || 0) * (+d.myContribution || 0) / 100;
    const sacrificed = d.pensionType === "relief" ? 0 : contribution;
    const monthly = ((m.salary || 0) - sacrificed) / 12;
    const bonus = +d.bonusAmount || 0;
    const bonusAhead = bonus > 0 && bonusDay(d, ty, payday) > on ? bonus : 0;
    // Pay to date and the paydays still to come, a bonus not yet paid, and
    // everything else in their answers' adjusted net income as it is.
    const pay = (m.salary || 0) - contribution + bonus;
    const rest = m.adjustedNetIncome - pay;
    // Relief at source is paid from pay after tax, so the payslip's pay is
    // before it: the year's payments come off.
    const relieved = d.pensionType === "relief" ? contribution : 0;
    projected = +d.payToDate + paydaysBetween(on, end, payday) * monthly + bonusAhead + rest - relieved;
  }
  // Top-ups: pay to date is after salary sacrifice, so one already paid by
  // then is in it; it's added back, and all of them come off.
  const ups = topUpsThisYear(d, now);
  const paidBy = tracked ? sum(ups.filter(u => u.route === "sacrifice" && paydayOfMonth(ty, +u.month, payday) <= on)) : 0;
  const beforeTopUps = Math.round(projected + paidBy);
  const topUps = sum(ups);
  projected = beforeTopUps - topUps;
  return { projected, beforeTopUps, topUps, tracked: !!tracked, asOf: tracked ? d.payToDateOn : null, over: projected > TRAP_START, topUp: Math.max(0, projected - TRAP_START), paydaysLeft: left, daysLeft, payday };
}

// The salary their pay to date implies: the one whose adjusted net income is
// the year's projection before any top-ups (each £1 of salary adds 1 − their
// pension % to it). null until they've entered pay to date this tax year.
// `y`: the projection, when it's been worked out already.
const keptOf = d => Math.max(0.01, 1 - num(d.myContribution) / 100);
export function effectiveSalary(d, m, today = new Date(), y = yearProjection(d, m, today)) {
  if (!y.tracked) return null;
  return Math.round(m.salary + (y.beforeTopUps - m.adjustedNetIncome) / keptOf(d));
}

// Pay to date more than DRIFT off their salary: the salary it implies, to
// the nearest £500, to ask whether their pay has changed. Else null, and
// after a "No" (driftDismissed) this tax year, on the same salary, to about
// the same pay. `y`: the projection, when it's been worked out already.
export const DRIFT = 0.05;
const near = (a, b) => b > 0 && Math.abs(a - b) / b <= DRIFT;
export function salaryDrift(d, m, today = new Date(), y = yearProjection(d, m, today)) {
  const salary = effectiveSalary(d, m, today, y);
  if (salary == null || !(m.salary > 0) || near(salary, m.salary)) return null;
  const no = d.driftDismissed;
  if (no && +no.taxYear === taxYearOf(dayOnly(today)) && +no.salary === Math.round(m.salary) && near(salary, +no.implied)) return null;
  return Math.round(salary / 500) * 500;
}
// What a "No" to `drift` keeps: the pay it was about, their salary then and
// the tax year.
export const driftDismissal = (m, drift, today = new Date()) => ({ implied: drift, salary: Math.round(m.salary), taxYear: taxYearOf(dayOnly(today)) });

// The answers and metrics the module works from this tax year: on the salary
// their pay to date implies, once it's in, less the salary sacrifice
// top-ups; relief at source top-ups off adjusted net income (not pay). Else
// their own. `y` is the projection. m.salaryBeforeTopUps and m.topUpsTotal:
// the salary before the sacrifice top-ups and all the top-ups, for the
// annual allowance (childcare.js). From their own answers
// only: run on what this returns, it would count pay to date and the top-ups
// twice.
export function thisTaxYear(d, m, today = new Date()) {
  const y = yearProjection(d, m, today);
  const ups = topUpsThisYear(d, today);
  const implied = effectiveSalary(d, m, today, y);
  const relief = sum(ups, "relief");
  const salary = Math.round((implied ?? m.salary) - sum(ups, "sacrifice") / keptOf(d));
  if (salary === Math.round(m.salary) && !ups.length) return { d, m, y };
  const at = { ...d, salary: String(salary) };
  const mm = { ...calcMetrics(at), salaryBeforeTopUps: implied ?? m.salary, topUpsTotal: sum(ups) };
  return { d: at, m: relief ? { ...mm, adjustedNetIncome: mm.adjustedNetIncome - relief, topUpRelief: relief } : mm, y };
}

// Annual allowance left this year after the top-ups.
export const allowanceLeft = (d, m, today = new Date()) => Math.max(0, calcAnnualAllowanceRoomBeforeTopUps(d, m).room - sum(topUpsThisYear(d, today)));
// How far `extra` more on top of this year's top-ups goes past the annual
// allowance (0 within it): past it, carry forward (Pension) may cover it.
export function pastAllowance(d, m, extra = 0, today = new Date()) {
  const room = calcAnnualAllowanceRoomBeforeTopUps(d, m);
  return { over: Math.max(0, Math.round(sum(topUpsThisYear(d, today)) + extra - room.room)), allowance: room.approxAA };
}

// The most a salary sacrifice top-up from `month`'s pay can be, on their
// own answers: that month's pay (with the bonus, in its month) after what
// they sacrifice each month and any top-up from it already.
export function topUpLimit(d, m, month, today = new Date()) {
  const ups = topUpsThisYear(d, today);
  const salary = m.salary || 0;
  const regular = d.pensionType === "relief" ? 0 : salary * num(d.myContribution) / 100;
  const bonus = num(d.bonusAmount);
  const pay = (salary - regular) / 12 + (bonus > 0 && bonusMonthOf(d) === +month ? bonus : 0);
  return Math.max(0, Math.floor(pay - sum(ups.filter(u => u.route === "sacrifice" && +u.month === +month))));
}

// A month's pay after what they salary sacrifice each month: the most a
// month's top-up can be (the monthly slider's top).
export const monthlyPay = (d, m) => Math.max(0, Math.floor(((m.salary || 0) - (d.pensionType === "relief" ? 0 : (m.salary || 0) * num(d.myContribution) / 100)) / 12));

// `needed` spread over the paydays left this tax year: `monthly` on each
// (rounded up to £10, so it's at least enough), and as a pension % of
// salary, from `pctNow` to `pctTo` (rounded up to 0.1%) for those paydays.
// `pctFor(monthly)`: the % for any other monthly amount.
export function monthlyPlan(d, m, needed, today = new Date()) {
  const months = topUpMonths(d, today);
  const n = months.length;
  const monthly = n > 0 ? Math.ceil(needed / n / 10) * 10 : 0;
  const pctNow = num(d.myContribution);
  const pctFor = amount => m.salary > 0 ? Math.ceil((pctNow + amount * 12 / m.salary * 100) * 10 - 1e-9) / 10 : pctNow;
  return { months, n, monthly, pctNow, pctTo: pctFor(monthly), pctFor };
}

// The months a salary sacrifice top-up can come from: each payday still to
// come this tax year, in order, with whether the bonus is paid in it.
export function topUpMonths(d, today = new Date()) {
  const now = dayOnly(today), ty = taxYearOf(now), payday = paydayOf(d);
  const bonusMonth = num(d.bonusAmount) > 0 ? bonusMonthOf(d) : null;
  const out = [];
  for (const month of [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]) {
    if (paydayOfMonth(ty, month, payday) > now) out.push({ month, bonus: month === bonusMonth });
  }
  return out;
}

// Whether today is on or after this month's payday and they haven't checked
// in this month: the Home card's cue.
export const monthKey = t => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
export function paydayCheckDue(d, today = new Date()) {
  const now = dayOnly(today);
  return now >= paydayIn(now.getFullYear(), now.getMonth(), paydayOf(d)) && d.paydayCheckedMonth !== monthKey(now);
}
export const isPayday = (d, today = new Date()) => dayOnly(today).getTime() === paydayIn(today.getFullYear(), today.getMonth(), paydayOf(d)).getTime();
