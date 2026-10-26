import { gainedSoFar } from "./moduleStatus.js";
import { calcStudentLoanScenario, loanCostComparison, bestLumpSum } from "./studentLoan.js";
import { loanVerdictReady } from "./appEntry.js";

// The value Candid has driven, in two measures, for PostHog and the report
// row: the £ a year of changes the user says they made (gainedSoFar), and
// the either/or questions they've had answered (rent or buy, overpay the
// student loan or leave it), "leave it" answers included, which never bank
// any £. A decision's `gap` is the £ between the two choices over the
// period it covers (the years before selling, the life of the loan), not a
// year's worth.

// Rent vs buy, from calcRentVsBuy's result for the rate scenario on screen.
// Within £50 either way is "even".
export function rentVsBuyDecision(result) {
  if (!result) return null;
  const gap = Math.round(Math.abs(result.gapAtHorizon) / 100) * 100;
  return {
    id: "rentVsBuy",
    result: gap === 0 ? "even" : result.gapAtHorizon > 0 ? "buy" : "rent",
    gap,
    years: result.horizonYears,
  };
}

// Overpay or leave the student loan: as the module shows it, only once its
// verdict is in (appEntry.js loanVerdictReady); none below the threshold,
// where there's nothing to decide. "lumpSum": heading for write-off, but a
// lump sum from spare cash clears it and comes out ahead. "leave": no gain
// from paying it off. For one that clears anyway, the gap is what the money
// would earn in savings above the interest it would save; for one heading
// for write-off, what paying it all off today would cost over letting it
// run (loanCostComparison payNowSaves).
export function studentLoanDecision(d, m) {
  if (!d.studentLoan || d.studentLoan === "none" || !loanVerdictReady(d)) return null;
  const sl = calcStudentLoanScenario(d, m);
  if (sl.belowThreshold) return null;
  if (sl.worthOverpaying) return { id: "studentLoan", result: "overpay", gap: Math.round(sl.overpayTotalBenefit), years: sl.clearYr };
  const lump = bestLumpSum(m, sl, m.surplusCash || 0);
  if (lump) return { id: "studentLoan", result: "lumpSum", gap: lump.saving, years: sl.writeOffYr };
  const cost = loanCostComparison(m, sl);
  const gap = sl.willClear ? sl.savingsForgone - sl.interestAvoided : -cost.payNowSaves;
  return { id: "studentLoan", result: "leave", gap: Math.max(0, Math.round(gap)), years: cost.years };
}

// `d.decisionsInformed`: { [id]: { result, gap, years, on } }, the last
// answer seen for each (useDecisionLog).
export function decisionRowFields(d) {
  const seen = d.decisionsInformed || {};
  return {
    rent_vs_buy_result: seen.rentVsBuy?.result ?? null,
    rent_vs_buy_gap_gbp: seen.rentVsBuy?.gap ?? null,
    student_loan_result: seen.studentLoan?.result ?? null,
    student_loan_gap_gbp: seen.studentLoan?.gap ?? null,
  };
}

export function gainedRowFields(d, now = new Date()) {
  const g = gainedSoFar(d, now);
  return { gained_per_year_gbp: g.perYear, gained_so_far_gbp: g.total };
}

// Each module's change in banked £ a year between two sets of answers:
// positive for a change made, negative for one taken back.
export function bankedDiff(prev, next) {
  const perYear = d => Object.fromEntries(gainedSoFar(d).byModule.map(mm => [mm.key, mm.perYear]));
  const before = perYear(prev), after = perYear(next);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .map(key => ({ key, perYear: (after[key] || 0) - (before[key] || 0) }))
    .filter(c => c.perYear !== 0);
}
