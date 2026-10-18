// What the employer pays into the user's pension, as % of salary. Most match
// what the user pays, up to a cap (employerMatch); some pay a set % whatever
// the user pays (employerContributionType "fixed"), and then there's no
// match to miss. One place, so every figure (the missed match, projections,
// the annual allowance) reads it the same way. No imports, so any module can
// use it.
export const employerFixed = d => d.employerContributionType === "fixed";
export function employerPct(d, myPct = +d.myContribution || 0) {
  const cap = +d.employerMatch || 0;
  return employerFixed(d) ? cap : Math.min(myPct, cap);
}
// The % of salary left unclaimed by paying in less than the match: none
// when the employer pays a fixed %.
export function unclaimedMatchPct(d, myPct = +d.myContribution || 0) {
  return employerFixed(d) ? 0 : Math.max(0, (+d.employerMatch || 0) - myPct);
}
