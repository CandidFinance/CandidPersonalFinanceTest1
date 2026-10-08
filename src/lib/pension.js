import { calcBonusTaxBreakdown, calcIncomeTax, marginalNiRate, EMPLOYER_NI_RATE, PA_TAPER_START, ADDITIONAL_RATE_THRESHOLD, NI_RATE_ABOVE_UEL, salarySacrificeNiCap } from "./tax.js";
import { SALARY_GROWTH_RATES, pastStatePensionAge } from "./metrics.js";
import { slRepaymentThreshold, resolveSlRate, SL_REPAYMENT_RATES } from "./studentLoan.js";
import { taxYearFor, taxYearOf } from "./taxYear.js";
import { GROWTH_NOMINAL_PCT, GROWTH_REAL_PCT } from "./growth.js";

// ── User contributing to pension ────────────────────────────────────────────────────────
export function isPensionContributing(d) {
  // pensionType has zero effect here — only affects return ratio
  if (d.hasPension !== "yes") return false;
  const pct = Number(d.myContribution);
  return isNaN(pct) || d.myContribution === "" ? false : pct > 0;
}

// The tax relief missed by not paying in: on 5% of salary, the figure the
// module's status, its screen and its answer all use. Nil with nothing paid
// in and no earnings to pay in from, as for someone retired: there's no
// relief to miss, so that's not a gap.
// No relief at all from 75 (HMRC PTM044100).
export const PENSION_RELIEF_MAX_AGE = 75;
export function missedPensionRelief(d, m) {
  if (isPensionContributing(d)) return 0;
  if (+d.age >= PENSION_RELIEF_MAX_AGE) return 0;
  return Math.max(0, Math.round((m.salary || 0) * 0.05 * (m.tr || 0)));
}

// At or past the age they told us they'd retire (65 if not given).
export function pastRetirementAge(d) {
  return (+d.age || 0) >= (+d.retirementAge || 65);
}

// Started taking money out: tax-free cash only, or an income or lump sums.
export function hasStartedDrawing(d) {
  return d.pensionAccess === "taxFreeOnly" || d.pensionAccess === "income";
}

// The earliest a pension can be taken: 55, rising to 57 from 6 April 2028
// (tax year 2028). Protected pension ages aren't asked about.
export function minimumPensionAge(taxYear) {
  return taxYear >= 2028 ? 57 : 55;
}

// Retirement mode: at their retirement age (once old enough to take a
// pension), or already drawing. The pension screen then shows tax-free cash
// and drawing it down, not growth to an age they've reached.
export function inRetirement(d) {
  if (hasStartedDrawing(d)) return true;
  return pastRetirementAge(d) && (+d.age || 0) >= minimumPensionAge(taxYearFor(d));
}

// Having drawn an income (or lump sums beyond tax-free cash), only £10,000 a
// year can go into a pension with tax relief: the Money Purchase Annual
// Allowance.
export const MONEY_PURCHASE_ANNUAL_ALLOWANCE = 10000;

// ── Tax-free cash: the Lump Sum Allowance ─────────────────────────────────
// Since April 2024, 25% of a pension can be taken tax-free, up to £268,275
// in all. The cap bites from a pot of £1,073,100 (25% of it is £268,275).
// Older protections allow more: Fixed Protection 2012 £450,000; Fixed or
// Individual Protection 2014 £375,000, and 2016 £312,500 (Individual
// Protection: 25% of the protected amount, up to those figures).
// Tax-free cash already taken counts against the limit. Each £1 taken moved
// £3 into drawdown, which has no tax-free cash left, so the part of the pot
// still untouched is estimated as the pot less three times what was taken.
export const LUMP_SUM_ALLOWANCE = 268275;
export const LSA_INFLECTION_POT = 1073100;
// Individual Protection: the lower of that figure and 25% of the protected
// amount (HMRC PTM174600), or the figure while the amount isn't known.
// "p2014"/"p2016" were saved before Fixed and Individual were asked apart.
export const PROTECTED_LUMP_SUM = { fp2012: 450000, fp2014: 375000, ip2014: 375000, fp2016: 312500, ip2016: 312500, p2014: 375000, p2016: 312500 };
export function protectedLumpSum(d) {
  const cap = PROTECTED_LUMP_SUM[d.pensionProtection];
  if (!cap) return null;
  const amount = +d.pensionProtectedAmount;
  return (d.pensionProtection === "ip2014" || d.pensionProtection === "ip2016") && amount > 0 ? Math.min(cap, Math.round(amount * 0.25)) : cap;
}
export function calcTaxFreeCash(d) {
  const pot = Math.max(0, (+d.potValue || 0) + (+d.potValue2 || 0));
  const allowance = protectedLumpSum(d) || LUMP_SUM_ALLOWANCE;
  const taken = hasStartedDrawing(d) ? Math.max(0, +d.taxFreeCashTaken || 0) : 0;
  const left = Math.max(0, allowance - taken);
  const untouched = Math.max(0, pot - 3 * taken);
  const quarter = Math.round(untouched * 0.25);
  const taxFree = Math.min(quarter, left);
  return { pot, allowance, taken, left, untouched, quarter, taxFree, capped: quarter > left, overCap: Math.max(0, quarter - left) };
}

// ── Pension return ratio (salary sacrifice vs relief at source) ───────────────────────
// The NI a pound of salary sacrifice saves: 8% in the basic band, 2% above
// it, none below the threshold or past State Pension age, and from April
// 2029 none once £2,000 a year is already sacrificed (salarySacrificeNiCap).
export function sacrificeNiRate(d, m) {
  const ongoing = d.pensionType === "sacrifice" ? m.salary * (+d.myContribution || 0) / 100 : 0;
  if (ongoing >= salarySacrificeNiCap(m.taxYear)) return 0;
  return marginalNiRate(m.salary, { pastStatePensionAge: pastStatePensionAge(d) });
}
export function pensionReturnRatio(d, m) {
  const isSS = d.pensionType === "sacrifice";
  const niSaving = isSS ? sacrificeNiRate(d, m) : 0;
  return 1 / Math.max(0.01, 1 - (m.tr + niSaving));
}
// ── Estimate a pension pot for someone who doesn't know their balance ──────────────────
// Reverse-engineers a rough current pot from salary/age/trajectory, for the onboarding
// "I don't know" case — not a real balance lookup (there is no source for that), just a
// same-order-of-magnitude illustration so the rest of the report has something to work
// with. Projects today's salary backwards year by year using the same SALARY_GROWTH_RATES
// used elsewhere to project it forwards, applies a contribution rate (the user's own
// stated %s if known, else the UK auto-enrolment minimum of 8% combined), and grows each
// year's contribution forward at 6% a year. That's the nominal rate (growth.js):
// these are past contributions in money of the day, not a projection in
// today's money.
export const CAREER_START_AGE = 22;
const DEFAULT_TOTAL_CONTRIB_RATE = 0.08; // UK auto-enrolment minimum: 5% employee + 3% employer
const PENSION_GROWTH_RATE = GROWTH_NOMINAL_PCT / 100;

export function estimatePensionPot(d) {
  const age = +d.age || 0;
  const salary = +d.salary || 0;
  const yearsWorked = Math.max(0, Math.min(45, age - CAREER_START_AGE));
  if (salary <= 0 || yearsWorked === 0) return 0;

  const salaryGrowth = SALARY_GROWTH_RATES[d.salaryTrajectory] ?? 0.02;
  const statedRate = ((+d.myContribution || 0) + (+d.employerMatch || 0)) / 100;
  const totalContribRate = statedRate > 0 ? statedRate : DEFAULT_TOTAL_CONTRIB_RATE;

  // Walk backwards from the earliest working year to now: each year's salary is
  // today's salary discounted by the growth rate, contributions are a % of that
  // year's salary, and the running pot compounds forward at the growth rate.
  let pot = 0;
  for (let yearsAgo = yearsWorked; yearsAgo >= 1; yearsAgo--) {
    const salaryThatYear = salary / Math.pow(1 + salaryGrowth, yearsAgo);
    pot = (pot + salaryThatYear * totalContribRate) * (1 + PENSION_GROWTH_RATE);
  }
  return Math.round(pot);
}

export function pensionReturnLabel(d, m) {
  const ratio = pensionReturnRatio(d, m);
  if (d.pensionType === "sacrifice") return `1:${ratio.toFixed(2)} — includes income tax + NI saving (employer never sees this income)`;
  if (d.pensionType === "relief") return `1:${ratio.toFixed(2)} — income tax relief only (claim higher rate via self-assessment if applicable)`;
  const low = (1 / Math.max(0.01, 1 - m.tr)).toFixed(2);
  const high = (1 / Math.max(0.01, 1 - (m.tr + sacrificeNiRate(d, m)))).toFixed(2);
  return low === high ? `1:${low}` : `1:${low}–1:${high} — check your payslip: if pension deduction appears before tax, it's likely salary sacrifice`;
}

// ── Pension Personal Allowance taper — single source of truth for the £100k–
// £125,140 60% marginal-rate zone maths, shared by computeModuleStatuses
// (Dashboard figure) and the module's own opportunity strip/Win tile, so the
// two can't disagree (same pattern as calcStudentLoanScenario above).
// NB: taperSacrificeNeeded/taperNiSaving are only meaningful when recoverable is
// true — otherwise they're repurposed to describe "how far below £100k you are"
// for messaging, so taperTotalSaving must always be gated on recoverable before
// being treated as a real £/yr saving.
// aaRoom: Annual Allowance left this tax year (calcAnnualAllowanceRoom) — the
// recovery is only offered when the sacrifice it needs fits inside it.
export function calcPensionTaperSaving(m, aaRoom = Infinity) {
  const taperStart = PA_TAPER_START, taperEnd = ADDITIONAL_RATE_THRESHOLD;
  const ani = m.adjustedNetIncome;
  const inTaper = ani > taperStart && ani < taperEnd;
  // Above £125,140 the allowance is already gone in full. Recovering it still
  // means sacrificing all the way back to £100,000: 45% saved on the slice above
  // £125,140, plus the 60% taper slice beneath it.
  const aboveTaper = ani >= taperEnd;
  // Sacrifice needed to fully recover the Personal Allowance is the FULL gap back to
  // £100,000, 1-for-1 — not half of it. Every £1 sacrificed while ANI is still above
  // £100,000 saves 40% tax directly AND restores 50p of Personal Allowance (itself
  // taxed at 40%, i.e. a further 20%), for a genuine 60% effective saving on that £1
  // — but reaching that saving on the WHOLE gap requires sacrificing the whole gap,
  // not half of it. (Previously halved here, which underclaimed "recovers your full
  // Personal Allowance" by 2x — sacrificing half the gap only recovers half the
  // withdrawn allowance.)
  const taperSacrificeNeeded = (inTaper || aboveTaper) ? Math.ceil(ani - taperStart) : Math.max(0, taperStart - ani);
  const recoverable = (inTaper || aboveTaper) && taperSacrificeNeeded <= aaRoom;
  // NI is only saved when it's paid by salary sacrifice, not past State
  // Pension age, and from April 2029 only on the first £2,000 a year.
  const niFree = m.pensionType === "sacrifice" && !m.pastStatePensionAge
    ? Math.min(taperSacrificeNeeded, Math.max(0, salarySacrificeNiCap(m.taxYear) - (m.salarySacrifice || 0))) : 0;
  const taperNiSaving = Math.round(niFree * NI_RATE_ABOVE_UEL);
  const taperTaxSaving = (inTaper || aboveTaper) ? calcIncomeTax(ani) - calcIncomeTax(taperStart) : 0;
  const taperTotalSaving = taperNiSaving + taperTaxSaving;
  return { taperStart, taperEnd, ani, inTaper, aboveTaper, recoverable, taperSacrificeNeeded, taperNiSaving, taperTaxSaving, taperTotalSaving };
}

// ── Annual Allowance taper (high earners, £200k+ threshold income) — how far
// this year's £60,000 contribution allowance is reduced. Ported unchanged
// from desktop's ModuleDeepDive (CandidApp.jsx) pension section, which is the
// only place this currently lives; extracted here so the mobile deep dive can
// share it. See that component for the fuller commentary on threshold vs
// adjusted income and why sacrifice/relief/unknown pension types differ.
export function calcAnnualAllowanceTaper(d, m) {
  const salary = m.salary;
  const myPct = +d.myContribution || 0, empCapPct = +d.employerMatch || 0;
  const baseGrossIncome = salary + (+d.bonusAmount||0) + (+d.otherIncome||0) + (+d.dividendIncome||0);
  const personalContributionCash = salary * myPct / 100;
  const employerContribCashAA = Math.min(myPct, empCapPct) / 100 * salary;
  let thresholdIncome;
  if (d.pensionType === "sacrifice") {
    thresholdIncome = baseGrossIncome;
  } else if (d.pensionType === "relief") {
    thresholdIncome = baseGrossIncome - (personalContributionCash / 0.80);
  } else {
    thresholdIncome = baseGrossIncome - personalContributionCash;
  }
  const employeeContribForAdjusted = d.pensionType === "relief" ? personalContributionCash / 0.80 : personalContributionCash;
  const adjustedIncome = thresholdIncome + employeeContribForAdjusted + employerContribCashAA;
  const AA_THRESHOLD_INCOME_LIMIT = 200000, AA_ADJUSTED_INCOME_LIMIT = 260000;
  const inAATaper = d.hasPension === "yes" && thresholdIncome > AA_THRESHOLD_INCOME_LIMIT && adjustedIncome > AA_ADJUSTED_INCOME_LIMIT;
  // Rounds DOWN so a just-tapered result never rounds back up to exactly
  // £60,000 — which would contradict the message announcing the reduction.
  const approxAA = inAATaper ? Math.max(10000, Math.floor((60000 - Math.max(0, adjustedIncome - AA_ADJUSTED_INCOME_LIMIT) / 2) / 1000) * 1000) : 60000;
  // VCT/EIS gate — when pension contributions alone can't realistically bring
  // Threshold Income below £200k (either the allowance is already at the
  // £10k floor, or the sacrifice needed to escape the taper exceeds 30% of
  // salary), VCT/EIS become the usual alternative (30% income tax relief).
  const thresholdIncomeSacrificeToEscape = inAATaper ? Math.max(0, thresholdIncome - AA_THRESHOLD_INCOME_LIMIT) : 0;
  const showVctEis = inAATaper && (approxAA <= 20000 || thresholdIncomeSacrificeToEscape > salary * 0.3);
  return { thresholdIncome, adjustedIncome, inAATaper, approxAA, AA_THRESHOLD_INCOME_LIMIT, AA_ADJUSTED_INCOME_LIMIT, showVctEis };
}

// ── Annual Allowance room — how much more can go into a pension this tax year
// without an allowance charge: the (possibly tapered) allowance minus what
// regular contributions already put in (the user's own plus the employer's
// matched share, as calcAnnualAllowanceTaper counts them). Carry forward isn't
// included — it needs the last 3 years' contributions, which only the deep
// dive's calculator asks for.
export function calcAnnualAllowanceRoom(d, m) {
  const aa = calcAnnualAllowanceTaper(d, m);
  const myPct = isPensionContributing(d) ? (+d.myContribution || 0) : 0;
  const employerPct = Math.min(myPct, +d.employerMatch || 0);
  const currentInputs = Math.round(m.salary * (myPct + employerPct) / 100);
  // Once an income has been drawn, the £10,000 limit applies instead.
  const mpaa = d.pensionAccess === "income";
  const approxAA = mpaa ? Math.min(aa.approxAA, MONEY_PURCHASE_ANNUAL_ALLOWANCE) : aa.approxAA;
  return {
    approxAA, inAATaper: aa.inAATaper, mpaa, currentInputs,
    room: Math.max(0, approxAA - currentInputs),
    excess: Math.max(0, currentInputs - approxAA),
  };
}

// ── Bonus sacrifice — the income tax saved by sacrificing the stated bonus
// into the pension, worked out band by band (a bonus can straddle the 40%,
// 60% taper and 45% slices), and capped at the Annual Allowance room left,
// since sacrificing past it just triggers an allowance charge.
//   standalone:  sacrificing the bonus on its own (the deep dives' bonus win).
//   beyondTaper: only the part not already counted in a recoverable Personal
//                Allowance recovery (calcPensionTaperSaving), assuming that
//                recovery comes out of the bonus first — what the Dashboard
//                adds as potential on top of it, so the two never double count.
export function calcBonusSacrificePotential(d, m) {
  const bonus = Math.max(0, +d.bonusAmount || 0);
  const { room } = calcAnnualAllowanceRoom(d, m);
  const taper = calcPensionTaperSaving(m, room);
  const ani = m.adjustedNetIncome;
  const taxSaved = (from, amount) => amount > 0 ? calcIncomeTax(from) - calcIncomeTax(from - amount) : 0;

  const standaloneSacrifice = Math.min(bonus, room);
  const taperSacrifice = taper.recoverable ? taper.taperSacrificeNeeded : 0;
  const beyondTaperSacrifice = Math.min(Math.max(0, bonus - taperSacrifice), Math.max(0, room - taperSacrifice));
  return {
    bonus, room, standaloneSacrifice,
    standalone: taxSaved(ani, standaloneSacrifice),
    beyondTaper: taxSaved(ani - taperSacrifice, beyondTaperSacrifice),
  };
}

// ── Annual Allowance carry-forward — a member of a UK-registered pension
// scheme can carry forward up to 3 prior tax years' unused Annual Allowance
// (flat £60,000/yr under the current regime), stacked on top of the current
// (possibly tapered) allowance, capped at 100% of relevant UK earnings.
// cfYears: array of 3 {label, hadScheme, contribution} objects, most recent
// first — real user input from the mobile/desktop carry-forward table, not
// an assumption baked into this function.
export function calcCarryForward(d, m, approxAA, cfYears) {
  const CF_STANDARD_AA = 60000;
  const cfBreakdown = cfYears.map(y => {
    const contributed = y.hadScheme ? Math.max(0, +y.contribution || 0) : 0;
    const unused = y.hadScheme ? Math.max(0, CF_STANDARD_AA - contributed) : 0;
    return { ...y, contributed, unused };
  });
  const cfTotalUnused = cfBreakdown.reduce((s,y) => s + y.unused, 0);
  // "Relevant UK earnings" for the 100%-of-earnings cap — approximated as
  // salary + bonus, excluding dividends and other unearned income.
  const cfRelevantEarnings = Math.round(m.salary + (+d.bonusAmount||0));
  const cfTheoreticalMax = approxAA + cfTotalUnused;
  const cfMaxContributable = Math.max(0, Math.min(cfTheoreticalMax, cfRelevantEarnings));
  const cfEarningsCapped = cfTheoreticalMax > cfRelevantEarnings;
  const showCarryForward = d.hasPension === "yes" && cfRelevantEarnings >= 100000;
  return { cfBreakdown, cfTotalUnused, cfRelevantEarnings, cfTheoreticalMax, cfMaxContributable, cfEarningsCapped, showCarryForward };
}

// The default 3-year carry-forward state — most recent tax year first,
// assuming a scheme existed with nothing contributed (the same default
// desktop's own calculator starts from before a user edits anything).
export function defaultCarryForwardYears(taxYear = taxYearOf(new Date())) {
  const label = y => `${y}/${String(y + 1).slice(2)}`;
  return [1, 2, 3].map(back => ({ label: label(taxYear - back), hadScheme:true, contribution:"" }));
}

// ── Bonus sacrifice calculator — tax/NI/student-loan breakdown for
// sacrificing some or all of a stated bonus into the pension instead of
// taking it as cash, at a chosen sacrifice percentage (0–100).
export function calcBonusSacrifice(d, m, bonusInput, sacrificePct) {
  const bonus = Math.max(0, +bonusInput || 0);
  const ongoingSacrifice = (+d.myContribution||0) / 100 * m.salary;
  const taxableSalary = Math.max(0, m.salary - ongoingSacrifice);
  // NI rate on bonus: above the £50,270 threshold it's 2%, below it's 8% —
  // bonus sits on top of salary, so if salary is already above threshold,
  // all of the bonus falls at 2%.
  // The rate on the first pound above salary; none past State Pension age.
  const niRateOnBonus = marginalNiRate(m.salary + 1, { pastStatePensionAge: pastStatePensionAge(d) });
  // Student loan: the plan's rate (6% Postgraduate, 9% otherwise) on the part
  // of salary plus bonus above the threshold.
  const slThreshold = slRepaymentThreshold(d.studentLoan);
  const slPlanRate = slThreshold > 0 ? (SL_REPAYMENT_RATES[d.studentLoan] || 0) : 0;
  // The pay it sits on top of: salary less salary sacrifice (m.slEarnings
  // without the stated bonus).
  const slBase = (m.slEarnings ?? m.salary) - (+d.bonusAmount || 0);
  const slOn = amount => slPlanRate * Math.max(0, Math.min(amount, slBase + amount - slThreshold));
  const bonusSlRate = bonus > 0 ? slOn(bonus) / bonus : 0;

  // Full bonus, no sacrifice — effective income tax rate on the whole amount.
  const fullBonusTax = calcBonusTaxBreakdown(taxableSalary, bonus);
  const fullTaxPct = Math.round(fullBonusTax.effectiveRate * 100);
  const fullNIPct = Math.round(niRateOnBonus * 100);
  const fullSLPct = Math.round(bonusSlRate * 100);
  const fullKeepPct = 100 - fullTaxPct - fullNIPct - fullSLPct;

  // At the chosen sacrifice percentage.
  const sacrificedAmt = Math.round(bonus * sacrificePct / 100);
  const cashPortionBonus = bonus - sacrificedAmt;
  const bonusTaxDetail = calcBonusTaxBreakdown(taxableSalary, cashPortionBonus);
  const taxOnCash = bonusTaxDetail.tax;
  const niOnCash = Math.round(cashPortionBonus * niRateOnBonus);
  const slOnCash = Math.round(slOn(cashPortionBonus));
  // From April 2029 only £2,000 a year of salary sacrifice is free of NI:
  // what's over it (after the regular sacrifice) still pays NI, for the
  // employee and the employer.
  const niFreeSacrifice = Math.min(sacrificedAmt, Math.max(0, salarySacrificeNiCap(m.taxYear) - ongoingSacrifice));
  const niOnSacrificed = Math.round((sacrificedAmt - niFreeSacrifice) * niRateOnBonus);
  const takeHomeCash = cashPortionBonus - taxOnCash - niOnCash - slOnCash;
  const totalDeducted = taxOnCash + niOnCash + slOnCash + niOnSacrificed;
  const totalReceived = sacrificedAmt + takeHomeCash - niOnSacrificed;
  const employerNISave = Math.round(niFreeSacrifice * EMPLOYER_NI_RATE);
  const crossesTaper = fullBonusTax.crossesTaper;
  const crossesAR = fullBonusTax.crossesAR;

  const age = +d.age||30, retireAge = +d.retirementAge||65;
  const years = Math.max(1, retireAge - age);
  // In today's money, at the real growth rate (growth.js).
  const bonusFVpartial = (pct) => Math.round(bonus * pct/100 * Math.pow(1 + GROWTH_REAL_PCT/100, years));

  const loanBal = m.loanBal || 0;
  // Based on slOnCash (the deduction on the portion NOT sacrificed), so it
  // moves with the sacrifice slider — it's 0 at 100% sacrifice.
  const slInterestRate = slThreshold > 0 ? resolveSlRate(d, m.salary) : 0;
  const slInterestSaved = Math.round(slOnCash * slInterestRate * Math.max(1, loanBal/Math.max(1,m.annualRepayment)));

  return {
    bonus, bonusSlRate,
    fullTaxPct, fullNIPct, fullSLPct, fullKeepPct,
    sacrificedAmt, cashPortionBonus, taxOnCash, niOnCash, slOnCash,
    takeHomeCash, totalDeducted, totalReceived, employerNISave, niOnSacrificed,
    crossesTaper, crossesAR, years, retireAge, bonusFVpartial,
    loanBal, slInterestSaved,
    bonusTaxDetailEffectiveRate: bonusTaxDetail.effectiveRate,
  };
}

// Future value helpers matching src/lib/forecast.js's fvSingle/fvAnnuity
// exactly — duplicated here (rather than imported) to avoid a circular
// import, since forecast.js already imports pensionReturnRatio from this
// file. Keep in sync if either changes.
function fvSingleLocal(pv, annualRatePct, months) {
  if (pv <= 0 || months <= 0) return 0;
  return pv * Math.pow(1 + annualRatePct / 100 / 12, months);
}
function fvAnnuityLocal(pmt, annualRatePct, months) {
  if (months <= 0 || pmt <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return pmt * months;
  return pmt * ((Math.pow(1 + r, months) - 1) / r);
}

// ── Pension growth trajectory — the bar-chart data (now / at retirement /
// optimised / with bonus / with extra contribution), the earliest-viable-
// retirement-age search, and the Lump Sum Allowance inflection flag.
// extraPct: the "what if you contributed more" stepper value (1/2/3/5).
export function calcPensionGrowthTrajectory(d, m, extraPct = 1) {
  const salary = m.salary, potVal = +d.potValue||0;
  const myPct = +d.myContribution||0, empCapPct = +d.employerMatch||0;
  const retireAge = +d.retirementAge||65, age = +d.age||30;
  const years = Math.max(1, retireAge - age);
  // In today's money: the real growth rate, after inflation (growth.js), the
  // same as calcMetrics' projectedPot.
  const g = GROWTH_REAL_PCT / 100;
  const annuityFactor = (Math.pow(1 + g, years) - 1) / g;
  // The employer matches what the user pays, up to its cap (as calcMetrics).
  const annualContrib = (myPct + Math.min(myPct, empCapPct)) / 100 * salary;
  const currentPot = m.projectedPot;
  const hasMissedMatch = m.missedMatch > 0;
  const hasBonus = (+d.bonusAmount||0) > 0;
  // Percentage-points the user would need to add to their own contribution to
  // fully capture the employer match — shown on the "Optimised" bar so the
  // chart itself states the action needed, not just the resulting pot.
  const matchCapIncreasePct = Math.max(0, empCapPct - myPct);

  // The four bars are a genuine cumulative staircase — each builds on the
  // pot from every lever to its left, not an independent "what if only this
  // one thing changed" comparison (that was the previous behaviour, and
  // meant e.g. the "+X% contribution" bar silently ignored any bonus the
  // user was already modelling). "Optimised" contribution degrades to the
  // user's actual current rate when there's no missed match, so withBonusPot/
  // withExtraPot below are always built on the right base regardless of
  // whether the match-cap or bonus levers are individually active.
  const optimisedContrib = hasMissedMatch ? (empCapPct * 2) * salary / 100 : annualContrib;
  const optimisedPot = potVal * Math.pow(1 + g, years) + optimisedContrib * annuityFactor;

  // Bonus sacrifice is a one-off lump sum this year, not a recurring annual
  // contribution — grown with fvSingleLocal (simple compounding) on top of
  // optimisedPot, not the annuity formula optimisedContrib itself uses.
  const bonusExtra = (+d.bonusAmount||0) * 0.9;
  const withBonusPot = optimisedPot + fvSingleLocal(bonusExtra, GROWTH_REAL_PCT, years * 12);

  const showOptimised = hasMissedMatch || hasBonus;
  const extraBase = hasBonus ? withBonusPot : optimisedPot;
  const extraGrowth = Math.round(salary * extraPct/100 * annuityFactor);
  const withExtraPot = Math.round(extraBase) + extraGrowth;

  // Builds each label as "everything included so far", e.g. once both the
  // match-cap and bonus levers are active: "Optimised", "Optimised + bonus",
  // "Optimised + bonus + 2% extra" — so the labels themselves show the
  // staircase, not just the bar heights.
  const priorLevers = [];
  if (hasMissedMatch) priorLevers.push(`Optimised (+${matchCapIncreasePct}%)`);
  if (hasBonus) priorLevers.push("bonus");
  const extraLabel = priorLevers.length > 0 ? `${priorLevers.join(" + ")} + ${extraPct}% extra` : `With +${extraPct}% contribution`;

  const bars = [
    { key:"now", value: potVal, label: "Now" },
    { key:"retirement", value: currentPot, label: `At retirement (age ${retireAge})` },
    ...(hasMissedMatch ? [{ key:"optimised", value: optimisedPot, label: `Optimised (+${matchCapIncreasePct}%)` }] : []),
    ...(hasBonus ? [{ key:"bonus", value: withBonusPot, label: hasMissedMatch ? `Optimised (+${matchCapIncreasePct}%) + bonus` : "With bonus sacrifice" }] : []),
    { key:"extra", value: withExtraPot, label: extraLabel },
  ];

  // Earliest viable retirement age — binary/linear search for when the pot
  // reaches 25× estimated annual spend (or a £400k floor).
  const annualSpend = (m.expenses||2000) * 12;
  const targetPot = Math.max(400000, annualSpend * 25);
  let earlyRetire = retireAge;
  for (let testYrs = 1; testYrs <= years; testYrs++) {
    const pot = potVal * Math.pow(1 + g, testYrs) + annualContrib * ((Math.pow(1 + g, testYrs) - 1) / g);
    if (pot >= targetPot) { earlyRetire = age + testYrs; break; }
  }
  const yearsSaved = retireAge - earlyRetire;
  const onTrackEarly = yearsSaved > 0 && isPensionContributing(d);
  // Not once they're at their retirement age: a chart of growth "to age 65"
  // means nothing at 69. The tax-free cash note covers them instead.
  const showTrajectory = d.hasPension === "yes" && (potVal > 0 || myPct > 0) && !inRetirement(d);

  // Lump Sum Allowance inflection point — £1,073,100 is the pot size at
  // which the standard 25% tax-free withdrawal entitlement equals the
  // £268,275 Lump Sum Allowance cap (April 2024 reform). Below it, 25%
  // tax-free applies in full; above it, the tax-free portion stays fixed
  // while further growth is otherwise unrestricted.
  const alreadyPastLsa = potVal >= LSA_INFLECTION_POT;
  let lsaCrossYearsLeft = null;
  if (showTrajectory && !alreadyPastLsa) {
    const monthlyContrib = annualContrib / 12;
    const totalMonths = years * 12;
    for (let testMonths = 1; testMonths <= totalMonths; testMonths++) {
      // Nominal growth here: the Lump Sum Allowance is a fixed sum of money,
      // not one that rises with prices.
      const pot = fvSingleLocal(potVal, GROWTH_NOMINAL_PCT, testMonths) + fvAnnuityLocal(monthlyContrib, GROWTH_NOMINAL_PCT, testMonths);
      if (pot >= LSA_INFLECTION_POT) { lsaCrossYearsLeft = Math.round(testMonths / 12); break; }
    }
  }
  const lsaCrossAge = lsaCrossYearsLeft != null ? age + lsaCrossYearsLeft : null;
  const showLsaFlag = showTrajectory && (alreadyPastLsa || lsaCrossAge != null);

  return {
    years, retireAge, age, currentPot, optimisedPot, withBonusPot, withExtraPot,
    hasMissedMatch, hasBonus, showOptimised, bars, matchCapIncreasePct,
    earlyRetire, yearsSaved, onTrackEarly, showTrajectory,
    alreadyPastLsa, lsaCrossAge, showLsaFlag, LSA_INFLECTION_POT,
  };
}
