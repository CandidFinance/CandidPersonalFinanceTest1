// Long-run investment growth, after fees: 6% a year, which is about 4% after
// 2% inflation (the Bank of England's target). Pension projections shown in
// today's money use the real figure; comparisons with rates quoted in money
// of the day (a loan's interest, a savings rate) and estimates of what's
// already built up use the nominal one.
export const GROWTH_NOMINAL_PCT = 6;
export const INFLATION_PCT = 2;
export const GROWTH_REAL_PCT = 4;

// Pay over a career: the rate the user expects (metrics.js
// SALARY_GROWTH_RATES) for the first ten years, then rising with prices,
// since no one's pay rises 10% a year for a whole career. The same rule for
// the student loan projections, the forecast and the pension outlook.
export const PAY_FAST_YEARS = 10;
export const PAY_LATER_GROWTH = INFLATION_PCT / 100;
// The rise from year i to year i + 1 (year 0 is today).
export const payGrowthIn = (rate, i) => i < PAY_FAST_YEARS ? rate : PAY_LATER_GROWTH;
// Pay in `years` years' time, as a multiple of today's.
export function payFactor(rate, years) {
  let f = 1;
  for (let i = 0; i < years; i++) f *= 1 + payGrowthIn(rate, i);
  return f;
}
