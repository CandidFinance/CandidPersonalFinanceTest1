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
import { SALARY_GROWTH_RATES } from "./metrics.js";
import { payFactor } from "./growth.js";
import { calcPensionTaperSaving, calcAnnualAllowanceRoom } from "./pension.js";
import { childcareSupport } from "./childcare.js";

export const TRAP_START = PA_TAPER_START;
export const TRAP_END = ADDITIONAL_RATE_THRESHOLD;
// Within this of £100,000, or crossing it within TRAP_YEARS at the pay
// growth they expect, the module is offered.
export const TRAP_NEAR = 10000;
export const TRAP_YEARS = 3;
export const FOUR_DAY_SHARE = 0.8;

const num = v => +v || 0;

// Adjusted net income from the answers alone (metrics.js works it out the
// same way), for deciding whether to offer the module where only `d` is to
// hand (appEntry.js modulesInView).
export function roughAdjustedNetIncome(d) {
  const salary = num(d.salary);
  return salary + num(d.bonusAmount) + num(d.otherIncome) + num(d.dividendIncome) - salary * num(d.myContribution) / 100;
}
// Near or over £100,000, or heading over it within TRAP_YEARS.
export function trapInView(d, ani = roughAdjustedNetIncome(d)) {
  if (!(num(d.salary) > 0) || d.employmentStatus === "not_working") return false;
  if (ani >= TRAP_START - TRAP_NEAR) return true;
  const growth = SALARY_GROWTH_RATES[d.salaryTrajectory] ?? SALARY_GROWTH_RATES.stable;
  return ani * payFactor(growth, TRAP_YEARS) >= TRAP_START;
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
  const totalRelief = (bySacrifice ? 0 : own) + relief;
  const bonus = num(d.bonusAmount) + extra, other = num(d.otherIncome), dividends = num(d.dividendIncome);
  const pay = salary + bonus - totalSacrifice;
  // Anything else in adjusted net income (a State Pension, pay earlier in the
  // year) as metrics.js has it.
  const rest = m.adjustedNetIncome - (m.salary + num(d.bonusAmount) + other + dividends - m.salary * pct);
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

// The rate across £90,000 to £130,000 of adjusted net income, moved by
// salary, for the chart: [{ income, rate }].
export function rateCurve(d, m, from = 90000, to = 130000, step = 500) {
  const offset = m.adjustedNetIncome - m.salary;
  const points = [];
  for (let income = from; income <= to; income += step) points.push({ income, rate: marginalRate(d, m, income - offset).rate });
  return points;
}

// The Personal Allowance lost at an adjusted net income, and the tax it
// costs (at 40%, Scotland 45%).
export function allowanceLost(ani, scottish = false) {
  const lost = Math.max(0, Math.min(PERSONAL_ALLOWANCE, (ani - TRAP_START) / 2));
  return { lost: Math.round(lost), tax: Math.round(lost * (scottish ? 0.45 : 0.4)) };
}

const round10 = n => Math.round(n / 10) * 10;

// Everything the module shows. Null without a salary.
export function taxTrap(d, m) {
  if (!(m.salary > 0) || m.noEarnings) return null;
  const ani = m.adjustedNetIncome;
  const over = ani > TRAP_START;
  const now = position(d, m);
  const rate = marginalRate(d, m);
  const aaRoom = calcAnnualAllowanceRoom(d, m).room;
  const taper = calcPensionTaperSaving(m, aaRoom);
  const allowance = allowanceLost(ani, !!m.scottish);
  const cc = childcareSupport(d, m);
  // Their own income over £100,000 stops the support; back at £100,000 it's
  // theirs again (unless a partner is over too: Kids & family has that).
  const childcareLost = cc && cc.state === "lost" && !cc.planning ? cc.atStake : 0;
  const childcareAtRisk = cc && cc.state === "near" ? cc.atStake : 0;
  const needed = over ? Math.ceil(ani - TRAP_START) : 0;
  const fits = needed <= aaRoom;
  // The module's £: the tax a payment back to £100,000 saves (Pension's
  // figure until now), and the childcare it restores.
  const amount = Math.round((taper.recoverable ? taper.taperTotalSaving : 0) + (fits && cc?.recoverable ? childcareLost : 0));

  const employed = d.employmentStatus !== "self_employed";
  const cost = after => Math.max(0, Math.round(now.takeHome - after.takeHome));
  const options = [];
  if (over) {
    // Pension, the way they pay in (salary sacrifice where their employer
    // offers it; relief at source otherwise, and for the self-employed).
    const bySacrifice = employed && d.pensionType === "sacrifice";
    const pension = position(d, m, bySacrifice ? { sacrifice: needed } : { relief: needed });
    options.push({ key: "pension", route: bySacrifice ? "sacrifice" : "relief", amount: needed, takeHome: cost(pension), pension: needed, childcare: fits ? childcareLost : 0, fits,
      bonus: Math.min(needed, num(d.bonusAmount)) });
    const giftAid = position(d, m, { relief: needed });
    options.push({ key: "giftAid", amount: needed, takeHome: cost(giftAid), charity: needed, childcare: childcareLost });
    if (employed) {
      const other = position(d, m, { sacrifice: needed });
      options.push({ key: "sacrifice", amount: needed, takeHome: cost(other), perPound: Math.round(cost(other) / needed * 100), childcare: childcareLost });
    }
  }
  // A 4-day week: 80% of the salary, the same share of it paid in.
  if (over) {
    const fourDay = position(d, m, { salary: m.salary * FOUR_DAY_SHARE });
    const fourDayUnder = fourDay.ani <= TRAP_START;
    options.push({ key: "fourDay", gross: Math.round(m.salary * (1 - FOUR_DAY_SHARE)), takeHome: cost(fourDay),
      childcare: fourDayUnder ? childcareLost : 0, under: fourDayUnder, daysOff: 52 });
  }

  return {
    ani: Math.round(ani), over, aboveTaper: ani >= TRAP_END, needed, fits, aaRoom,
    headroom: over ? 0 : Math.round(TRAP_START - ani),
    rate, allowance, childcareLost, childcareAtRisk, nation: cc?.nation || null,
    // The rate just over £100,000, for someone under it.
    trapRate: marginalRate(d, m, m.salary + (TRAP_START + 1000 - ani)).rate,
    taxSaving: taper.recoverable ? taper.taperTotalSaving : 0,
    amount, options, takeHome: Math.round(now.takeHome),
    payValue: round10(amount / Math.max(0.01, 1 - rate.rate)),
  };
}
