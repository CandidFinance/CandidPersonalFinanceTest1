// Figures that reach across modules, so one answer leads on to another:
// rough estimates for modules not started yet, worked out from what's already
// known (salary, spending); what a pension's path means for tax later on; and
// where money not put towards a student loan could go. Pure, unit tested in
// crossModule.test.js.

import { calcIncomeTax } from "./tax.js";
import { employerPct } from "./employer.js";
import { SALARY_GROWTH_RATES, retirementAgeFor } from "./metrics.js";
import { inRetirement, LUMP_SUM_ALLOWANCE, LSA_INFLECTION_POT } from "./pension.js";
import { GROWTH_NOMINAL_PCT, GROWTH_REAL_PCT, INFLATION_PCT, PAY_FAST_YEARS, PAY_LATER_GROWTH } from "./growth.js";
import { CASH_RATE_LOW } from "./forecast.js";
import { DEFAULT_DRAWDOWN_YEARS } from "./drawdown.js";
import { slEarnings, SL_REPAYMENT_THRESHOLDS, SL_REPAYMENT_RATES } from "./studentLoan.js";
import { PA_TAPER_START, HIGHER_RATE_THRESHOLD, ADDITIONAL_RATE_THRESHOLD, PERSONAL_ALLOWANCE, STATE_PENSION_FULL } from "./tax.js";

const round10 = n => Math.round(n / 10) * 10;

// ── Estimates for a module not started yet ──────────────────────────────
// A range from the user's own figures, shown on its tile until the module's
// questions are answered and the real figure replaces it. Only where the
// answers already given support one: Investments and Student loan depend on
// figures not yet asked, so they have none (studentLoanRepaid is the loan's
// figure for its paywall).
//
// Pension: employer money and tax relief commonly missed, 1% to 3% of salary.
// Employers must pay at least 3% (auto-enrolment); many match more, often up
// to 5% or 6%, if the employee pays more, so not paying enough in to get the
// full match typically leaves 1 to 3 points of salary unclaimed. Self-employed:
// no employer, so the tax relief on £100 a month paid in.
// Cash: 3 to 6 months of spending (or take-home pay, if spending isn't known)
// held at a typical high-street rate (CASH_RATE_LOW) against the best
// available (m.bestSavingsRate).

export const ESTIMATE_PAY_IN_MONTHLY = 100;

export function moduleEstimate(key, d, m) {
  if (key === "pension") {
    if (!(m.salary > 0)) return null;
    if (d.employmentStatus === "self_employed") {
      const relief = round10(ESTIMATE_PAY_IN_MONTHLY * 12 * m.tr / (1 - m.tr));
      return relief > 0 ? { low: relief, high: relief, line: `Tax relief on £${ESTIMATE_PAY_IN_MONTHLY} a month paid in` } : null;
    }
    return { low: round10(m.salary * 0.01), high: round10(m.salary * 0.03), line: "Employer money and tax relief often missed at your salary" };
  }
  if (key === "cash") {
    const monthly = m.expenses > 0 ? m.expenses : m.monthlyTakeHome;
    const gap = ((m.bestSavingsRate || 0) - CASH_RATE_LOW * 100) / 100;
    if (!(monthly > 0) || gap <= 0) return null;
    return { low: round10(monthly * 3 * gap), high: round10(monthly * 6 * gap), line: "Extra interest on 3 to 6 months' money at the best rates" };
  }
  return null;
}

// ── Student loan: what comes off pay for it, before its questions ──────
// What comes off their pay for it a year at their salary, on the plan
// they've given, or Plan 2 (England, courses started 2012 to 2022, the most
// common) until it's asked. Not a gain, so never a "worth a look" figure or
// set against what Candid costs: the locked module's paywall shows it as
// what the answer is about.
export function studentLoanRepaid(d, m) {
  // studentLoan is "none" until the plan's asked (a blank profile's
  // default), so only their own "I don't have one" rules it out.
  if (!(m.salary > 0) || d.slPlanAnswer === "none") return null;
  const known = d.studentLoan in SL_REPAYMENT_THRESHOLDS;
  const plan = known ? d.studentLoan : "plan2";
  const repaid = round10((slEarnings(d, m.salary) - SL_REPAYMENT_THRESHOLDS[plan]) * SL_REPAYMENT_RATES[plan]);
  if (!(repaid > 0)) return null;
  return { low: repaid, high: repaid, stake: true, line: known ? "Repaid from your pay at your salary" : "Repaid from your pay at your salary, if you're on Plan 2" };
}

// ── Pension: what its path means for tax later on ───────────────────────
// Projects salary and the pot to retirement with salary growth, which the
// module's own projection (in today's salary) leaves out, and flags:
//  - taxTrap: salary (adjusted net income) passing £100,000, where the
//    Personal Allowance starts to go: a 60% rate on the next £25,140. The
//    threshold is a fixed sum, so it's compared in money of the day.
//  - lumpSum: the pot passing £1,073,100, beyond which tax-free cash stops
//    at the £268,275 Lump Sum Allowance (also fixed), so a quarter of the
//    rest is taxed instead. overPot is that rest (the pot above £1,073,100),
//    in today's money.
//  - retirementRate: income in retirement taxed at a higher rate than the
//    relief paying in gets now (basic rate now, higher rate later), when an
//    ISA, taxed on the way in but not out, can do better for extra savings.
//    Income: three quarters of the pot (a quarter taken tax-free) drawn over
//    DEFAULT_DRAWDOWN_YEARS at the real growth rate, plus the full State
//    Pension, in today's money against today's bands.
// The trajectory's growth rate applies for the first 10 years, then pay
// rises with prices (growth.js, the same rule as the student loan).
export const FAST_GROWTH_YEARS = PAY_FAST_YEARS;
const LATER_GROWTH = PAY_LATER_GROWTH;

function topRate(income) {
  return income > ADDITIONAL_RATE_THRESHOLD ? 0.45 : income > HIGHER_RATE_THRESHOLD ? 0.4 : income > PERSONAL_ALLOWANCE ? 0.2 : 0;
}

export function pensionOutlook(d, m) {
  const age = +d.age || 0;
  if (d.hasPension !== "yes" || d.pensionKind === "db" || inRetirement(d) || !age || !(m.salary > 0)) return null;
  const retireAge = retirementAgeFor(d);
  const years = retireAge - age;
  if (years < 1) return null;

  const myPct = +d.myContribution || 0;
  const rate = (myPct + employerPct(d, myPct)) / 100;
  const fast = SALARY_GROWTH_RATES[d.salaryTrajectory] ?? LATER_GROWTH;
  const g = GROWTH_NOMINAL_PCT / 100;
  const ani = m.adjustedNetIncome || m.salary;
  let pot = (+d.potValue || 0) + (+d.potValue2 || 0), pay = m.salary;
  let taperAge = null, lsaAge = null;
  for (let y = 1; y <= years; y++) {
    pay *= 1 + (y <= FAST_GROWTH_YEARS ? fast : LATER_GROWTH);
    pot = pot * (1 + g) + pay * rate;
    if (taperAge === null && ani < PA_TAPER_START && ani * pay / m.salary >= PA_TAPER_START) taperAge = age + y;
    if (lsaAge === null && pot >= LSA_INFLECTION_POT) lsaAge = age + y;
  }

  const inflate = Math.pow(1 + INFLATION_PCT / 100, years);
  const potToday = pot / inflate;
  const r = GROWTH_REAL_PCT / 100;
  const drawn = potToday * 0.75 * r / (1 - Math.pow(1 + r, -DEFAULT_DRAWDOWN_YEARS));
  const retirementIncome = Math.round(drawn + STATE_PENSION_FULL);
  const laterRate = topRate(retirementIncome);
  const nowRate = m.tr || 0;

  const flags = [];
  if (taperAge !== null) flags.push({ key: "taxTrap", age: taperAge });
  if (lsaAge !== null && pot * 0.25 > LUMP_SUM_ALLOWANCE) {
    const overCapToday = (pot * 0.25 - LUMP_SUM_ALLOWANCE) / inflate;
    flags.push({ key: "lumpSum", age: lsaAge, overCap: round10(overCapToday), overPot: round10(overCapToday * 4), extraTax: round10(overCapToday * Math.max(0.2, laterRate)) });
  }
  if (laterRate > nowRate && laterRate >= 0.4) {
    const band = laterRate === 0.45 ? ADDITIONAL_RATE_THRESHOLD : HIGHER_RATE_THRESHOLD;
    flags.push({ key: "retirementRate", nowRate, laterRate, income: round10(retirementIncome), extraTax: round10((retirementIncome - band) * (laterRate - nowRate)) });
  }
  return { retireAge, potAtRetirement: Math.round(pot), potToday: Math.round(potToday), retirementIncome, laterRate, flags,
    alreadyPastLsa: (+d.potValue || 0) + (+d.potValue2 || 0) >= LSA_INFLECTION_POT };
}

// The cliff edge in £: what £100 of take-home pay paid in becomes when it's
// drawn, before the pot passes the tax-free cash limit and after, against
// £100 in an ISA. Growth is the same for all three, so it's left out. Paid
// in: £100 plus tax relief at today's rate. Drawn before: a quarter
// tax-free, the rest taxed at the rate in retirement; after: all of it
// taxed (at least basic rate, as pensionOutlook's extraTax).
export function cliffEdge(outlook, m) {
  const flag = outlook?.flags.find(f => f.key === "lumpSum");
  if (!flag) return null;
  const nowRate = m.tr || 0, laterRate = Math.max(0.2, outlook.laterRate);
  const paidIn = 100 / (1 - nowRate);
  return {
    age: flag.age, already: outlook.alreadyPastLsa, nowRate, laterRate,
    paidIn: Math.round(paidIn),
    before: Math.round(paidIn * (0.25 + 0.75 * (1 - laterRate))),
    after: Math.round(paidIn * (1 - laterRate)),
    isa: 100,
  };
}

// ── Student loan: where money not overpaid could go ─────────────────────
// For a loan not worth overpaying, the same £100 a month for 5 years in
// three places, side by side, so the user chooses: a pension (tax relief
// adds to each payment, £125 at basic rate, about £167 at higher; can't be
// touched until the minimum pension age), a Stocks and Shares ISA (no relief,
// but growth is tax-free and it can be taken out any time; can fall), and
// savings at the best rate (safe, any time). Investments grow at the nominal
// rate, savings at the best rate available; no employer money included.
export const LOAN_ALTERNATIVE_YEARS = 5;
const saved = (monthly, ratePct, years) => {
  const i = ratePct / 100 / 12, n = years * 12;
  return i > 0 ? monthly * (Math.pow(1 + i, n) - 1) / i : monthly * n;
};
export function loanAlternatives(m, years = LOAN_ALTERNATIVE_YEARS) {
  const monthly = ESTIMATE_PAY_IN_MONTHLY, tr = m.tr || 0;
  const options = [
    { key: "pension", monthlyIn: Math.round(monthly / (1 - tr)), total: round10(saved(monthly / (1 - tr), GROWTH_NOMINAL_PCT, years)) },
    { key: "investments", monthlyIn: monthly, total: round10(saved(monthly, GROWTH_NOMINAL_PCT, years)) },
    { key: "cash", monthlyIn: monthly, total: round10(saved(monthly, m.bestSavingsRate || 0, years)) },
  ];
  return { monthly, years, paidIn: monthly * 12 * years, options: options.sort((a, b) => b.total - a.total) };
}


// ── Retirement: after-tax income in today's money, against what they'd
// like to live on (retirementTarget). From the pension (drawn over the
// default years, a quarter tax-free taken first) and a full State Pension;
// for a final salary scheme, what its statement says it'll pay, plus any
// old pots. Null without a target or a projection.
export function retirementAdequacy(d, m) {
  const target = +d.retirementTarget || 0;
  if (!target) return null;
  let gross;
  if (d.pensionKind === "db") {
    if (!(+d.dbPensionIncome > 0)) return null;
    gross = +d.dbPensionIncome + STATE_PENSION_FULL;
  } else {
    const o = pensionOutlook(d, m);
    if (!o) return null;
    gross = o.retirementIncome;
  }
  const net = Math.round(gross - calcIncomeTax(gross, d.scottishTaxpayer === "yes"));
  // How much more of their salary paid in would close a gap (whole points,
  // up to 30): their own payments, with the employer's share unchanged.
  let extraPct = null;
  if (net < target && d.pensionKind !== "db") {
    const my = +d.myContribution || 0;
    for (let x = 1; x <= 30; x++) {
      const o = pensionOutlook({ ...d, myContribution: String(my + x), employerContributionType: "fixed", employerMatch: String(employerPct(d, my)) }, m);
      if (o && Math.round(o.retirementIncome - calcIncomeTax(o.retirementIncome, d.scottishTaxpayer === "yes")) >= target) { extraPct = x; break; }
    }
  }
  return { target, net, gap: Math.max(0, target - net), extraPct };
}
