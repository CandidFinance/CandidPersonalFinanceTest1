// UK tax years run 6 April to 5 April. A tax year is identified here by the
// calendar year it starts in: 2026 means 2026/27.
export function taxYearOf(date) {
  const y = date.getFullYear(), month = date.getMonth(), day = date.getDate();
  return (month > 3 || (month === 3 && day >= 6)) ? y : y - 1;
}

const ISA_TYPES = ["Cash", "SS", "LISA", "Other"];

// Some saved inputs only describe the tax year they were entered in: this
// year's ISA payments (isaThisYear*) and gains realised against this year's
// £3,000 CGT allowance. Without a rollover, a user who entered £15,000 of ISA
// payments in March would still be shown as having only £5,000 of allowance
// left the following tax year.
//
// Saved inputs carry `inputsTaxYear`. Once a new tax year has started, this
// year's ISA payments move into the previous-years balance (the money is
// still in the ISA, it just no longer counts against this year's allowance)
// and realised gains reset. Inputs saved before the stamp existed fall back
// to `fallbackDate` (when their last report was generated), the best record
// Candid has of when they were entered; with no fallback either, they're
// treated as this tax year's.
export function rollTaxYear(d, now = new Date(), fallbackDate = null) {
  const current = taxYearOf(now);
  const savedYear = Number.isInteger(d.inputsTaxYear) ? d.inputsTaxYear
    : (fallbackDate instanceof Date && !isNaN(fallbackDate)) ? taxYearOf(fallbackDate)
    : current;
  if (savedYear >= current) {
    return d.inputsTaxYear === current ? d : { ...d, inputsTaxYear: current };
  }

  const next = { ...d, inputsTaxYear: current };
  const thisYearTotal = ISA_TYPES.reduce((s, t) => s + (+d[`isaThisYear${t}`] || 0), 0);
  const prevGranular = ISA_TYPES.reduce((s, t) => s + (+d[`isaPrev${t}`] || 0), 0);
  const legacyPrev = +d.isaPreviousBalance || 0;
  if (thisYearTotal > 0) {
    // Older inputs hold the previous-years balance as one isaPreviousBalance
    // figure, which calcMetrics only reads while every isaPrev* field is
    // empty, so it has to be added to there rather than split by type.
    if (prevGranular === 0 && legacyPrev > 0) {
      next.isaPreviousBalance = String(legacyPrev + thisYearTotal);
    } else {
      for (const t of ISA_TYPES) {
        const paidIn = +d[`isaThisYear${t}`] || 0;
        if (paidIn > 0) next[`isaPrev${t}`] = String((+d[`isaPrev${t}`] || 0) + paidIn);
      }
    }
  }
  for (const t of ISA_TYPES) next[`isaThisYear${t}`] = "";
  next.realisedCgtGains = "";
  next.hasSoldAssetsOutsideWrapper = "no";
  return next;
}
