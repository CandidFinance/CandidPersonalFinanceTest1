import { calcBonusTaxBreakdown } from "./tax.js";
import { SALARY_GROWTH_RATES } from "./metrics.js";

// ── User contributing to pension ────────────────────────────────────────────────────────
export function isPensionContributing(d) {
  // pensionType has zero effect here — only affects return ratio
  if (d.hasPension !== "yes") return false;
  const pct = Number(d.myContribution);
  return isNaN(pct) || d.myContribution === "" ? false : pct > 0;
}

// ── Pension return ratio (salary sacrifice vs relief at source) ───────────────────────
export function pensionReturnRatio(d, m) {
  const isSS = d.pensionType === "sacrifice";
  const niSaving = isSS && m.salary > 50270 ? 0.02 : 0;
  return 1 / Math.max(0.01, 1 - (m.tr + niSaving));
}
// ── Estimate a pension pot for someone who doesn't know their balance ──────────────────
// Reverse-engineers a rough current pot from salary/age/trajectory, for the onboarding
// "I don't know" case — not a real balance lookup (there is no source for that), just a
// same-order-of-magnitude illustration so the rest of the report has something to work
// with. Projects today's salary backwards year by year using the same SALARY_GROWTH_RATES
// used elsewhere to project it forwards, applies a contribution rate (the user's own
// stated %s if known, else the UK auto-enrolment minimum of 8% combined), and grows each
// year's contribution forward at 6% — the same investment-growth assumption
// calcPensionGrowthTrajectory uses for future projections, applied here in reverse.
export const CAREER_START_AGE = 22;
const DEFAULT_TOTAL_CONTRIB_RATE = 0.08; // UK auto-enrolment minimum: 5% employee + 3% employer
const PENSION_GROWTH_RATE = 0.06;

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
  const high = (1 / Math.max(0.01, 1 - (m.tr + 0.02))).toFixed(2);
  return low === high ? `1:${low}` : `1:${low}–1:${high} — check your payslip: if pension deduction appears before tax, it's likely salary sacrifice`;
}

// ── Pension Personal Allowance taper — single source of truth for the £100k–
// £125,140 60% marginal-rate zone maths, shared by computeModuleStatuses
// (Dashboard figure) and the module's own opportunity strip/Win tile, so the
// two can't disagree (same pattern as calcStudentLoanScenario above).
// NB: taperSacrificeNeeded/taperNiSaving are only meaningful when inTaper is
// true — outside the taper zone they're repurposed to describe "how far below
// £100k you are" for messaging, so taperTotalSaving must always be gated on
// inTaper before being treated as a real £/yr saving.
export function calcPensionTaperSaving(m) {
  const taperStart = 100000, taperEnd = 125140;
  const ani = m.adjustedNetIncome;
  const inTaper = ani > taperStart && ani < taperEnd;
  // Sacrifice needed to fully recover the Personal Allowance is the FULL gap back to
  // £100,000, 1-for-1 — not half of it. Every £1 sacrificed while ANI is still above
  // £100,000 saves 40% tax directly AND restores 50p of Personal Allowance (itself
  // taxed at 40%, i.e. a further 20%), for a genuine 60% effective saving on that £1
  // — but reaching that saving on the WHOLE gap requires sacrificing the whole gap,
  // not half of it. (Previously halved here, which underclaimed "recovers your full
  // Personal Allowance" by 2x — sacrificing half the gap only recovers half the
  // withdrawn allowance.)
  const taperSacrificeNeeded = inTaper ? Math.ceil(ani - taperStart) : Math.max(0, taperStart - ani);
  const taperNiSaving = Math.round(taperSacrificeNeeded * 0.02);
  const taperTaxSaving = inTaper ? Math.round(taperSacrificeNeeded * 0.60) : 0;
  const taperTotalSaving = taperNiSaving + taperTaxSaving;
  return { taperStart, taperEnd, ani, inTaper, taperSacrificeNeeded, taperNiSaving, taperTaxSaving, taperTotalSaving };
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
export function defaultCarryForwardYears() {
  return [
    { label:"2025/26", hadScheme:true, contribution:"" },
    { label:"2024/25", hadScheme:true, contribution:"" },
    { label:"2023/24", hadScheme:true, contribution:"" },
  ];
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
  const niRateOnBonus = m.salary >= 50270 ? 0.02 : 0.08;
  const slThreshold = d.studentLoan==="plan2" ? 27295 : d.studentLoan==="plan5" ? 25000 : d.studentLoan==="plan1" ? 24990 : 0;
  const bonusSlRate = (d.studentLoan !== "none" && m.salary > slThreshold) ? 0.09 : 0;

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
  const slOnCash = Math.round(cashPortionBonus * bonusSlRate);
  const takeHomeCash = cashPortionBonus - taxOnCash - niOnCash - slOnCash;
  const totalDeducted = taxOnCash + niOnCash + slOnCash;
  const totalReceived = sacrificedAmt + takeHomeCash;
  const employerNISave = Math.round(sacrificedAmt * 0.138);
  const crossesTaper = fullBonusTax.crossesTaper;
  const crossesAR = fullBonusTax.crossesAR;

  const age = +d.age||30, retireAge = +d.retirementAge||65;
  const years = Math.max(1, retireAge - age);
  const bonusFVpartial = (pct) => Math.round(bonus * pct/100 * Math.pow(1.06, years));

  const loanBal = m.loanBal || 0;
  const slRepaymentFromBonus = Math.round(bonus * bonusSlRate);
  const slInterestRate = d.studentLoan==="plan2" ? 0.075 : d.studentLoan==="plan5" ? 0.075 : 0.05;
  const slInterestSaved = Math.round(slRepaymentFromBonus * slInterestRate * Math.max(1, loanBal/Math.max(1,m.annualRepayment)));

  return {
    bonus, bonusSlRate,
    fullTaxPct, fullNIPct, fullSLPct, fullKeepPct,
    sacrificedAmt, cashPortionBonus, taxOnCash, niOnCash, slOnCash,
    takeHomeCash, totalDeducted, totalReceived, employerNISave,
    crossesTaper, crossesAR, years, retireAge, bonusFVpartial,
    loanBal, slRepaymentFromBonus, slInterestSaved,
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
  const annualContrib = (myPct + empCapPct) / 100 * salary;
  const currentPot = m.projectedPot;
  const optimisedContrib = (empCapPct * 2) * salary / 100;
  const optimisedPot = potVal * Math.pow(1.06, years) + optimisedContrib * ((Math.pow(1.06, years) - 1) / 0.06);
  // Bonus sacrifice is a one-off lump sum this year, not a recurring annual
  // contribution — grown with fvSingleLocal (simple compounding), not the
  // annuity formula used for optimisedContrib. Previously this used the
  // annuity formula for both, which assumed the bonus repeated every year
  // until retirement and wildly overstated the "with bonus" bar.
  const bonusExtra = (+d.bonusAmount||0) * 0.9;
  const withBonusPot = potVal * Math.pow(1.06, years) + optimisedContrib * ((Math.pow(1.06, years) - 1) / 0.06) + fvSingleLocal(bonusExtra, 6, years * 12);
  const hasMissedMatch = m.missedMatch > 0;
  const hasBonus = (+d.bonusAmount||0) > 0;
  const showOptimised = hasMissedMatch || hasBonus;

  const extraGrowth = Math.round(salary * extraPct/100 * ((Math.pow(1.06, years) - 1) / 0.06));
  const withExtraPot = Math.round(currentPot) + extraGrowth;

  const bars = [
    { key:"now", value: potVal, label: "Now" },
    { key:"retirement", value: currentPot, label: `At retirement (age ${retireAge})` },
    ...(hasMissedMatch ? [{ key:"optimised", value: optimisedPot, label: "Optimised (match cap)" }] : []),
    ...(hasBonus ? [{ key:"bonus", value: withBonusPot, label: "With bonus sacrifice" }] : []),
    { key:"extra", value: withExtraPot, label: `With +${extraPct}% contribution` },
  ];

  // Earliest viable retirement age — binary/linear search for when the pot
  // reaches 25× estimated annual spend (or a £400k floor).
  const annualSpend = (m.expenses||2000) * 12;
  const targetPot = Math.max(400000, annualSpend * 25);
  let earlyRetire = retireAge;
  for (let testYrs = 1; testYrs <= years; testYrs++) {
    const pot = potVal * Math.pow(1.06, testYrs) + annualContrib * ((Math.pow(1.06, testYrs) - 1) / 0.06);
    if (pot >= targetPot) { earlyRetire = age + testYrs; break; }
  }
  const yearsSaved = retireAge - earlyRetire;
  const onTrackEarly = yearsSaved > 0 && isPensionContributing(d);
  const showTrajectory = d.hasPension === "yes" && (potVal > 0 || myPct > 0);

  // Lump Sum Allowance inflection point — £1,073,100 is the pot size at
  // which the standard 25% tax-free withdrawal entitlement equals the
  // £268,275 Lump Sum Allowance cap (April 2024 reform). Below it, 25%
  // tax-free applies in full; above it, the tax-free portion stays fixed
  // while further growth is otherwise unrestricted.
  const LSA_INFLECTION_POT = 1073100;
  const alreadyPastLsa = potVal >= LSA_INFLECTION_POT;
  let lsaCrossYearsLeft = null;
  if (showTrajectory && !alreadyPastLsa) {
    const monthlyContrib = annualContrib / 12;
    const totalMonths = years * 12;
    for (let testMonths = 1; testMonths <= totalMonths; testMonths++) {
      const pot = fvSingleLocal(potVal, 6, testMonths) + fvAnnuityLocal(monthlyContrib, 6, testMonths);
      if (pot >= LSA_INFLECTION_POT) { lsaCrossYearsLeft = Math.round(testMonths / 12); break; }
    }
  }
  const lsaCrossAge = lsaCrossYearsLeft != null ? age + lsaCrossYearsLeft : null;
  const showLsaFlag = showTrajectory && (alreadyPastLsa || lsaCrossAge != null);

  return {
    years, retireAge, age, currentPot, optimisedPot, withBonusPot, withExtraPot,
    hasMissedMatch, hasBonus, showOptimised, bars,
    earlyRetire, yearsSaved, onTrackEarly, showTrajectory,
    alreadyPastLsa, lsaCrossAge, showLsaFlag, LSA_INFLECTION_POT,
  };
}
