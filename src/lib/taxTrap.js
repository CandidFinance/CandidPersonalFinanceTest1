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
import { calcAnnualAllowanceRoom } from "./pension.js";
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

// The marginal rate at every income from £0, for the chart: [{ income,
// rate }]. On their own setup (where they live, a student loan, employed or
// self-employed), with income all from salary, so each step shows where it
// comes: the 20%, 40% and 45% bands, NI, and the £100,000 trap.
export function rateCurve(d, m, from = 0, to = 130000, step = 1000) {
  const plain = { ...d, bonusAmount: 0, otherIncome: 0, dividendIncome: 0, myContribution: 0 };
  const points = [];
  for (let income = from; income <= to; income += step) {
    points.push({ income, rate: marginalRate(plain, { ...m, salary: income, adjustedNetIncome: income }, income).rate });
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

// Everything the module shows. Null without a salary.
//  amount: what the trap costs them a year, in money: the tax on the
//    allowance lost, and the childcare support their own income over £100k
//    stops (a partner's is Kids & family's). The module's £, on Home too.
//  options: the ways back to £100k, each with its outcome in £ a year:
//    takeHome (what it takes off take-home pay, or for Gift Aid what it
//    costs them after the relief), what it adds (pension, charity), taxSaved
//    (what it doesn't cost, for what goes in), childcare (support back) and
//    bank (childcare back less the take-home it costs).
export function taxTrap(d, m) {
  if (!(m.salary > 0) || m.noEarnings) return null;
  const ani = m.adjustedNetIncome;
  const over = ani > TRAP_START;
  const now = position(d, m);
  const rate = marginalRate(d, m);
  const aaRoom = calcAnnualAllowanceRoom(d, m).room;
  const allowance = allowanceLost(ani, !!m.scottish);
  const cc = childcareSupport(d, m);
  // Their own income over £100k stops the support; back at £100k it's
  // theirs again (unless a partner is over too: Kids & family has that).
  const childcareLost = cc && cc.state === "lost" && !cc.planning ? cc.atStake : 0;
  const childcareAtRisk = cc && cc.state === "near" ? cc.atStake : 0;
  const needed = over ? Math.ceil(ani - TRAP_START) : 0;
  const fits = needed <= aaRoom;
  const amount = over ? Math.round(allowance.tax + childcareLost) : 0;

  const employed = d.employmentStatus !== "self_employed";
  const cost = after => Math.max(0, Math.round(now.takeHome - after.takeHome));
  const outcome = (o, childcare) => ({ ...o, childcare, bank: childcare - o.takeHome });
  const options = [];
  if (over) {
    const share = needed / m.salary;
    // Pension, the way they pay in (salary sacrifice where their employer
    // offers it; relief at source otherwise, and for the self-employed).
    const bySacrifice = employed && d.pensionType === "sacrifice";
    const pension = cost(position(d, m, bySacrifice ? { sacrifice: needed } : { relief: needed }));
    options.push(outcome({ key: "pension", route: bySacrifice ? "sacrifice" : "relief", amount: needed, share, fits,
      takeHome: pension, pension: needed, taxSaved: needed - pension }, fits ? childcareLost : 0));
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
    amount, options, takeHome: Math.round(now.takeHome),
  };
}
