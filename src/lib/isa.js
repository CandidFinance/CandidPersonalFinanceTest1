// ISA allowance used this tax year, across every kind of ISA (they share
// one allowance). Stocks and shares, Lifetime and other ISAs are asked one
// by one in Investments; anyone who hasn't done Investments is asked in Cash
// for a single total across them (isaThisYearOtherTypes). Whichever is
// larger counts, so the two never add up twice.
// Stocks and shares, Lifetime and other ISAs as itemised in Investments.
export function itemisedNonCashIsa(d) {
  return (+d.isaThisYearSS || 0) + (+d.isaThisYearLISA || 0) + (+d.isaThisYearOther || 0);
}

export function nonCashIsaThisYear(d) {
  const itemised = itemisedNonCashIsa(d);
  const declared = d.hasOtherIsaThisYear === "yes" ? (+d.isaThisYearOtherTypes || 0) : 0;
  return Math.max(itemised, declared);
}

export function isaUsedThisYear(d) {
  return (+d.isaThisYearCash || 0) + nonCashIsaThisYear(d);
}
