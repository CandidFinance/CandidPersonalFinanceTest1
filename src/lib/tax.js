// ── UK income tax figures (England, Wales and NI), 2026/27 ──────────────────
// Frozen until April 2031. The only place these live: the app's calculations
// and the public calculator pages (via src/lib/pageFigures.js) all read them.
export const PERSONAL_ALLOWANCE = 12570;
export const PA_TAPER_START = 100000;          // allowance withdrawn £1 per £2 above this
export const ADDITIONAL_RATE_THRESHOLD = 125140; // 45% from here; allowance fully gone
export const BASIC_RATE_BAND = 37700;
export const HIGHER_RATE_THRESHOLD = PERSONAL_ALLOWANCE + BASIC_RATE_BAND; // £50,270
export const INCOME_TAX_RATES = { basic: 0.20, higher: 0.40, additional: 0.45 };
export const NI_RATE_ABOVE_UEL = 0.02;         // employee NI above £50,270
// Personal Savings Allowance: interest tax-free each year, by tax band.
export const PSA_BY_BAND = { basic: 1000, higher: 500, additional: 0 };
// Total ISA allowance per tax year.
export const ISA_ALLOWANCE = 20000;

// ── Announced changes, switched on by tax year ──────────────────────────────
// Each takes the tax year (2027 means 2027/28, from 6 April 2027), so the app
// moves over on the day with no code change. The app passes the year the
// user's figures are for (taxYearFor in taxYear.js). Budget, November 2025.
//
// Savings interest above the Personal Savings Allowance: 2 points more on
// every band from April 2027.
export function savingsTaxRates(taxYear) {
  return taxYear >= 2027 ? { basic: 0.22, higher: 0.42, additional: 0.47 } : INCOME_TAX_RATES;
}
// Dividends above the £500 allowance: basic and higher rates 2 points more
// from April 2026; the additional rate is unchanged.
export function dividendTaxRates(taxYear) {
  return taxYear >= 2026
    ? { basic: 0.1075, higher: 0.3575, additional: 0.3935 }
    : { basic: 0.0875, higher: 0.3375, additional: 0.3935 };
}
// How much of the ISA allowance can go into cash: £12,000 for under-65s from
// April 2027 (the rest can still go into stocks and shares); 65 and over keep
// the full £20,000. An unknown age counts as under 65.
export const CASH_ISA_LIMIT_UNDER_65 = 12000;
export function cashIsaLimit(taxYear, age) {
  return taxYear >= 2027 && !(+age >= 65) ? CASH_ISA_LIMIT_UNDER_65 : ISA_ALLOWANCE;
}

// Full marginal income tax calculation
// Handles personal allowance taper (£100k–£125,140 → effective 60% rate)
export function calcIncomeTax(gross) {
  const g = Math.max(0, gross);
  const taperReduction = Math.max(0, Math.min(PERSONAL_ALLOWANCE, (g - PA_TAPER_START) / 2));
  const pa = Math.max(0, PERSONAL_ALLOWANCE - taperReduction);
  const taxable = Math.max(0, g - pa);
  let tax = 0;
  // The 45% rate starts at £125,140 of taxable income — the Personal Allowance
  // is fully withdrawn by then, so that's also £125,140 of gross income.
  tax += Math.min(taxable, BASIC_RATE_BAND) * INCOME_TAX_RATES.basic;
  if (taxable > BASIC_RATE_BAND) tax += (Math.min(taxable, ADDITIONAL_RATE_THRESHOLD) - BASIC_RATE_BAND) * INCOME_TAX_RATES.higher;
  if (taxable > ADDITIONAL_RATE_THRESHOLD) tax += (taxable - ADDITIONAL_RATE_THRESHOLD) * INCOME_TAX_RATES.additional;
  return Math.round(tax);
}

// Returns tax breakdown on a cash bonus given taxable salary (after sacrifice)
export function calcBonusTaxBreakdown(taxableSalary, cashBonus) {
  if (cashBonus <= 0) return { tax:0, effectiveRate:0, crossesTaper:false, crossesAR:false };
  const taxTotal = calcIncomeTax(taxableSalary + cashBonus);
  const taxSalary = calcIncomeTax(taxableSalary);
  const tax = Math.max(0, taxTotal - taxSalary);
  const effectiveRate = cashBonus > 0 ? tax / cashBonus : 0;
  const crossesTaper = (taxableSalary < 125140) && (taxableSalary + cashBonus > 100000);
  const crossesAR = taxableSalary + cashBonus > 125140;
  return { tax, effectiveRate, crossesTaper, crossesAR };
}
