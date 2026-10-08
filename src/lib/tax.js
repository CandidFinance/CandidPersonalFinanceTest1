// ── UK income tax figures (England, Wales and NI), 2026/27 ──────────────────
// Frozen until April 2031. The only place these live: the app's calculations
// and the public calculator pages (via src/lib/pageFigures.js) all read them.
export const PERSONAL_ALLOWANCE = 12570;
export const PA_TAPER_START = 100000;          // allowance withdrawn £1 per £2 above this
export const ADDITIONAL_RATE_THRESHOLD = 125140; // 45% from here; allowance fully gone
export const BASIC_RATE_BAND = 37700;
export const HIGHER_RATE_THRESHOLD = PERSONAL_ALLOWANCE + BASIC_RATE_BAND; // £50,270
export const INCOME_TAX_RATES = { basic: 0.20, higher: 0.40, additional: 0.45 };
// National Insurance, 2026/27 (gov.uk rates and thresholds for employers
// 2026 to 2027; self-employed National Insurance rates).
export const NI_PRIMARY_THRESHOLD = 12570;     // employee NI and Class 4 start here
export const NI_UPPER_EARNINGS_LIMIT = 50270;  // and drop to 2% above here
export const NI_MAIN_RATE = 0.08;              // employee NI between the two
export const NI_RATE_ABOVE_UEL = 0.02;         // employee NI above £50,270
export const CLASS4_MAIN_RATE = 0.06;          // self-employed, between the two
export const CLASS4_UPPER_RATE = 0.02;         // self-employed, above £50,270
export const EMPLOYER_NI_RATE = 0.15;          // from April 2025
// Everyone is past State Pension age at 67 (until it starts rising to 68 in
// 2044). At 66 it depends on date of birth, which Candid doesn't ask.
export const PAST_STATE_PENSION_AGE = 67;
// Capital Gains Tax: the yearly tax-free allowance.
export const CGT_ANNUAL_ALLOWANCE = 3000;
// Dividends: the yearly tax-free allowance.
export const DIVIDEND_ALLOWANCE = 500;
// Starting rate for savings: up to £5,000 of interest at 0%, less £1 for every
// £1 of other income over the Personal Allowance (gone at £17,570).
export const STARTING_RATE_FOR_SAVINGS = 5000;
// Personal Savings Allowance: interest tax-free each year, by tax band.
export const PSA_BY_BAND = { basic: 1000, higher: 500, additional: 0 };
// Total ISA allowance per tax year.
export const ISA_ALLOWANCE = 20000;
// The full new State Pension, 2026/27: £241.30 a week. State Pension age is
// rising from 66 to 67 between April 2026 and March 2028; anyone under 66
// now gets it from 67.
export const STATE_PENSION_WEEKLY = 241.30;
export const STATE_PENSION_FULL = Math.round(STATE_PENSION_WEEKLY * 52);
export const STATE_PENSION_AGE = 67;

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
// Salary sacrifice into a pension: from April 2029 only the first £2,000 a
// year is free of NI (employee and employer); above it, NI is due as on pay.
// Income tax relief is unchanged. gov.uk "Changes to salary sacrifice for
// pensions from April 2029".
export const SALARY_SACRIFICE_NI_CAP = 2000;
export function salarySacrificeNiCap(taxYear) {
  return taxYear >= 2029 ? SALARY_SACRIFICE_NI_CAP : Infinity;
}
// How much of the ISA allowance can go into cash: £12,000 for under-65s from
// April 2027 (the rest can still go into stocks and shares); 65 and over keep
// the full £20,000. An unknown age counts as under 65.
export const CASH_ISA_LIMIT_UNDER_65 = 12000;
export function cashIsaLimit(taxYear, age) {
  return taxYear >= 2027 && !(+age >= 65) ? CASH_ISA_LIMIT_UNDER_65 : ISA_ALLOWANCE;
}

// NI on a year's earnings: employee Class 1, or Class 4 for the
// self-employed (Class 2 is treated as paid), and none past State Pension age.
export function calcNI(earnings, { selfEmployed = false, pastStatePensionAge = false } = {}) {
  if (pastStatePensionAge) return 0;
  const main = selfEmployed ? CLASS4_MAIN_RATE : NI_MAIN_RATE;
  const upper = selfEmployed ? CLASS4_UPPER_RATE : NI_RATE_ABOVE_UEL;
  const e = Math.max(0, earnings || 0);
  return main * Math.max(0, Math.min(e, NI_UPPER_EARNINGS_LIMIT) - NI_PRIMARY_THRESHOLD) + upper * Math.max(0, e - NI_UPPER_EARNINGS_LIMIT);
}

// The NI rate on the last pound of `earnings` (what a pound of salary
// sacrifice saves), on the same terms as calcNI.
export function marginalNiRate(earnings, opts = {}) {
  if (opts.pastStatePensionAge) return 0;
  const e = earnings || 0;
  if (e > NI_UPPER_EARNINGS_LIMIT) return opts.selfEmployed ? CLASS4_UPPER_RATE : NI_RATE_ABOVE_UEL;
  if (e > NI_PRIMARY_THRESHOLD) return opts.selfEmployed ? CLASS4_MAIN_RATE : NI_MAIN_RATE;
  return 0;
}

// Interest that can be earned tax-free in a year, given other (non-savings)
// income: whatever Personal Allowance that income leaves unused, the
// starting rate for savings, and the Personal Savings Allowance for the band.
// With the income unknown, only the Personal Savings Allowance is certain.
export function taxFreeInterest(nonSavingsIncome, band) {
  if (nonSavingsIncome == null || isNaN(+nonSavingsIncome)) return PSA_BY_BAND[band] ?? 0;
  const other = Math.max(0, +nonSavingsIncome);
  const unusedAllowance = Math.max(0, PERSONAL_ALLOWANCE - other);
  const startingRate = Math.max(0, STARTING_RATE_FOR_SAVINGS - Math.max(0, other - PERSONAL_ALLOWANCE));
  return unusedAllowance + startingRate + (PSA_BY_BAND[band] ?? 0);
}

// Income tax on other income plus dividends. Dividends sit on top: unused
// Personal Allowance covers them first, then the £500 allowance (which still
// uses up band), then the dividend rates for the band they fall in. The
// allowance taper counts the dividends too.
export function calcIncomeAndDividendTax(nonDividendIncome, dividends, taxYear) {
  const other = Math.max(0, nonDividendIncome || 0), div0 = Math.max(0, dividends || 0);
  const total = other + div0;
  const pa = Math.max(0, PERSONAL_ALLOWANCE - Math.max(0, Math.min(PERSONAL_ALLOWANCE, (total - PA_TAPER_START) / 2)));
  const taxableOther = Math.max(0, other - pa);
  let tax = Math.min(taxableOther, BASIC_RATE_BAND) * INCOME_TAX_RATES.basic
    + Math.max(0, Math.min(taxableOther, ADDITIONAL_RATE_THRESHOLD) - BASIC_RATE_BAND) * INCOME_TAX_RATES.higher
    + Math.max(0, taxableOther - ADDITIONAL_RATE_THRESHOLD) * INCOME_TAX_RATES.additional;
  let div = Math.max(0, div0 - Math.max(0, pa - other));
  let position = taxableOther;
  const allowance = Math.min(div, DIVIDEND_ALLOWANCE);
  div -= allowance; position += allowance;
  const rates = dividendTaxRates(taxYear);
  const inBasic = Math.min(div, Math.max(0, BASIC_RATE_BAND - position));
  div -= inBasic; position += inBasic;
  const inHigher = Math.min(div, Math.max(0, ADDITIONAL_RATE_THRESHOLD - position));
  div -= inHigher;
  tax += inBasic * rates.basic + inHigher * rates.higher + div * rates.additional;
  return Math.round(tax);
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
