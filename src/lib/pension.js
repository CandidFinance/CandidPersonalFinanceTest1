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
  return { thresholdIncome, adjustedIncome, inAATaper, approxAA, AA_THRESHOLD_INCOME_LIMIT, AA_ADJUSTED_INCOME_LIMIT };
}

// Simple carry-forward estimate — assumes a pension scheme existed with £0
// contributed in each of the last 3 tax years (the maximum-unused, best-case
// assumption), which is also the exact default desktop's own interactive
// 3-year carry-forward calculator starts from before a user edits anything.
// A real figure needs the user's actual contribution history; this is the
// "assume the best case" simple figure for a first mobile pass, not a
// replacement for that calculator.
export function calcSimpleCarryForward(d, m, approxAA) {
  const CF_STANDARD_AA = 60000;
  const cfTotalUnused = CF_STANDARD_AA * 3;
  const cfRelevantEarnings = Math.round(m.salary + (+d.bonusAmount||0));
  const cfTheoreticalMax = approxAA + cfTotalUnused;
  const cfMaxContributable = Math.max(0, Math.min(cfTheoreticalMax, cfRelevantEarnings));
  const cfEarningsCapped = cfTheoreticalMax > cfRelevantEarnings;
  const showCarryForward = d.hasPension === "yes" && cfRelevantEarnings >= 100000;
  return { cfTotalUnused, cfRelevantEarnings, cfTheoreticalMax, cfMaxContributable, cfEarningsCapped, showCarryForward };
}
