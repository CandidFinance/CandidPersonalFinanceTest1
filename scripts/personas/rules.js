// The economy and the tax rules, year by year, for the customer-lives model
// (investor-personas.md, section 2). Year 1 is the 2026/27 tax year; a tax
// year is named by the calendar year it starts in, as in src/lib/taxYear.js.
//
// Rates in the app that change on a set date come from the app's own tax.js
// (savingsTaxRates, dividendTaxRates, cashIsaLimit), so the model and the app
// can't disagree. Income tax thresholds are the model's own, because after
// the freeze ends in 2031 they follow the review assumption, which the app
// doesn't need to know about.

import { savingsTaxRates, dividendTaxRates, cashIsaLimit, PSA_BY_BAND, PERSONAL_ALLOWANCE, HIGHER_RATE_THRESHOLD, PA_TAPER_START, ADDITIONAL_RATE_THRESHOLD } from "../../src/lib/tax.js";

export const FIRST_YEAR = 2026;
export const YEARS = 20;
export const yearOf = t => FIRST_YEAR + t - 1; // t = 1..20

// ── Economic paths ──────────────────────────────────────────────────────────
// Bank Rate and CPI by year (the last figure carries on). Pay grows 1 point
// above CPI except where set. The fixed-mortgage spread over Bank Rate is the
// same on every path: wide today, normalising by 2030.
const carry = (list, t) => list[Math.min(t, list.length) - 1];
const MORTGAGE_SPREAD = [2.15, 1.6, 1.4, 1.35, 1.4];

export const PATHS = {
  base: {
    label: "Base",
    bankRate: [3.75, 4.0, 3.5, 3.25, 3.0],
    cpi: [3.1, 2.8, 2.3, 2.0],
    pay: [4.0, 3.8, 3.3, 3.0],
  },
  low: {
    label: "Low rates",
    bankRate: [3.75, 3.25, 2.5, 2.0],
    cpi: [3.1, 2.0],
    pay: [4.0, 3.0],
  },
  high: {
    label: "High rates",
    bankRate: [3.75, 4.5, 4.25, 4.0],
    cpi: [3.1, 4.0, 3.0, 2.5],
    pay: [4.0, 5.0, 4.0, 3.5],
  },
};

// Everything that moves with the economy in year t, in percent.
export function economy(path, t) {
  const p = PATHS[path];
  const br = carry(p.bankRate, t);
  const cpi = carry(p.cpi, t);
  const y = yearOf(t);
  return {
    bankRate: br,
    cpi,
    pay: carry(p.pay, t),
    rpi: y < 2030 ? cpi + 0.9 : cpi,         // RPI aligned with CPIH from 2030
    bestEasyAccess: br + 0.75,
    bestCashIsa: br + 0.9,
    premiumBonds: br + 0.6,
    bigBank: Math.max(0.5, br - 2.25),       // the inertia rate
    midMarket: br - 0.5,                     // moved cash once someone leaves
    shariaExpectedProfit: br + 0.5,          // Sharia-compliant accounts (roadmap)
    avgFix: br + carry(MORTGAGE_SPREAD, t),  // average 2-year fixed mortgage
    bestFix: br + carry(MORTGAGE_SPREAD, t) - 0.4,
    svr: br + 3.75,
    equity: 6,                               // investments, after fees
    housePrices: t === 1 ? 2 : t === 2 ? 3 : cpi + 1.5,
    housePricesLondonSE: t === 1 ? 2 : t === 2 ? 3 : 2,
    creditCard: 24,
  };
}

// Price index (year 1 = 1) for deflating to today's money, and pay index.
export function indices(path) {
  const cpi = [1], pay = [1];
  for (let t = 1; t <= YEARS; t++) {
    const e = economy(path, t);
    cpi.push(cpi[t - 1] * (1 + e.cpi / 100));
    pay.push(pay[t - 1] * (1 + e.pay / 100));
  }
  // cpi[t]: prices at the end of year t; prices during year t ≈ cpi[t - 1].
  return { cpi, pay };
}

// ── Income tax thresholds ───────────────────────────────────────────────────
// Frozen to April 2031, then revisited every five years, each time rising by
// about half of the previous five years' inflation, then frozen again. The
// £100,000 taper point and £125,140 additional-rate threshold never move.
export const REVIEW_YEARS = [2031, 2036, 2041];
export function thresholds(path, t) {
  let pa = PERSONAL_ALLOWANCE, hrt = HIGHER_RATE_THRESHOLD;
  const y = yearOf(t);
  for (const review of REVIEW_YEARS) {
    if (y < review) break;
    let inflation = 1;
    for (let k = review - 5; k < review; k++) inflation *= 1 + economy(path, k - FIRST_YEAR + 1).cpi / 100;
    const rise = 1 + (inflation - 1) / 2;
    pa = Math.round(pa * rise / 10) * 10;
    hrt = Math.round(hrt * rise / 10) * 10;
  }
  return { pa, basicBand: hrt - pa, hrt, taperStart: PA_TAPER_START, additional: ADDITIONAL_RATE_THRESHOLD };
}

// ── Income tax, NI ──────────────────────────────────────────────────────────
// Non-savings income tax with the year's thresholds; the same method as the
// app's calcIncomeTax (checked against it in model.test.js for 2026/27).
export function incomeTax(gross, th) {
  const g = Math.max(0, gross);
  const pa = Math.max(0, th.pa - Math.max(0, (g - th.taperStart) / 2));
  const taxable = Math.max(0, g - pa);
  let tax = Math.min(taxable, th.basicBand) * 0.20;
  if (taxable > th.basicBand) tax += (Math.min(taxable, th.additional) - th.basicBand) * 0.40;
  if (taxable > th.additional) tax += (taxable - th.additional) * 0.45;
  return tax;
}

export function bandOf(adjustedNetIncome, th) {
  return adjustedNetIncome > th.additional ? "additional" : adjustedNetIncome > th.hrt ? "higher" : "basic";
}

// Employee NI: 8% between the primary threshold (the personal allowance) and
// the upper earnings limit (the higher-rate threshold), 2% above.
export function employeeNI(pay, th) {
  return 0.08 * Math.max(0, Math.min(pay, th.hrt) - th.pa) + 0.02 * Math.max(0, pay - th.hrt);
}
// Self-employed Class 4: 6% and 2% on the same bands.
export function class4NI(profit, th) {
  return 0.06 * Math.max(0, Math.min(profit, th.hrt) - th.pa) + 0.02 * Math.max(0, profit - th.hrt);
}

// Savings interest outside ISAs, on top of other income: nothing up to the
// Personal Savings Allowance, then the year's savings rates (tax.js), split
// between what's left of the basic-rate band and above it.
export function savingsTax(interest, otherIncome, th, t) {
  const total = otherIncome + interest;
  const band = bandOf(total, th);
  const psa = PSA_BY_BAND[band];
  const taxable = Math.max(0, interest - psa);
  if (taxable <= 0) return 0;
  const rates = savingsTaxRates(yearOf(t));
  const basicRoom = Math.max(0, th.hrt - (otherIncome + psa));
  const atBasic = Math.min(taxable, basicRoom);
  const atAdditional = Math.max(0, otherIncome + interest - th.additional) > 0 ? Math.min(taxable - atBasic, otherIncome + interest - th.additional) : 0;
  const atHigher = taxable - atBasic - atAdditional;
  return atBasic * rates.basic + atHigher * rates.higher + atAdditional * rates.additional;
}

export function dividendTax(dividends, otherIncome, th, t) {
  const taxable = Math.max(0, dividends - 500);
  const rates = dividendTaxRates(yearOf(t));
  const basicRoom = Math.max(0, th.hrt - otherIncome - 500);
  const atBasic = Math.min(taxable, basicRoom);
  return atBasic * rates.basic + (taxable - atBasic) * (otherIncome + dividends > th.additional ? rates.additional : rates.higher);
}

export const CGT_ALLOWANCE = 3000;
export const cgtRate = band => band === "basic" ? 0.18 : 0.24;

export { cashIsaLimit };
export const ISA_ALLOWANCE = 20000;
export const LISA_LIMIT = 4000;
export const LISA_PRICE_CAP = 450000;
export const PB_MAX = 50000;
export const PENSION_ANNUAL_ALLOWANCE = 60000;
// From April 2029 only the first £2,000 a year sacrificed saves NI.
export const sacrificeNiFree = t => yearOf(t) >= 2029 ? 2000 : Infinity;

// ── Student loans ───────────────────────────────────────────────────────────
// Repayment thresholds by plan (2026/27 from the app's studentLoan.js); Plan 2
// frozen to April 2030, then rising with pay; Plans 1 and 5 with RPI.
export const SL_START = { plan1: 26900, plan2: 29385, plan5: 25000 };
export const SL_WRITE_OFF = { plan1: 25, plan2: 30, plan5: 40 };
export function slThreshold(plan, path, t) {
  let th = SL_START[plan];
  for (let k = 2; k <= t; k++) {
    const e = economy(path, k);
    const y = yearOf(k);
    if (plan === "plan2") { if (y >= 2030) th *= 1 + e.pay / 100; }
    else th *= 1 + e.rpi / 100;
  }
  return th;
}
// Interest: Plan 2 RPI plus up to 3 points by income, capped at 6%; Plan 5
// RPI; Plan 1 the lower of RPI and Bank Rate + 1.
export function slRate(plan, income, path, t) {
  const e = economy(path, t);
  if (plan === "plan2") {
    const lower = slThreshold("plan2", path, t), upper = lower + 23500;
    const extra = 3 * Math.min(1, Math.max(0, (income - lower) / (upper - lower)));
    return Math.min(6, e.rpi + extra);
  }
  if (plan === "plan5") return e.rpi;
  return Math.min(e.rpi, e.bankRate + 1);
}

// ── Benefits and the state pension ──────────────────────────────────────────
// 2026/27 figures, rising with CPI (child benefit) or 3.5% (state pension).
export const STATE_PENSION_2026 = 241.30 * 52;
export const STATE_PENSION_GROWTH = 3.5;
export const CHILD_BENEFIT_2026 = { eldest: 27.05 * 52, other: 17.90 * 52 };
export const HICBC_START = 60000, HICBC_END = 80000;
// Childcare, in today's money, per child: nursery from age 1 to 4, then
// wraparound care to 11. Working parents each under £100,000 get 30 funded
// hours (worth about £7,500 a year) and Tax-Free Childcare (20% of costs, up
// to £2,000 a year per child).
export const NURSERY_COST = 14000, WRAPAROUND_COST = 3000, FUNDED_HOURS_VALUE = 7500, TFC_MAX = 2000;
export const CHILDCARE_INCOME_LIMIT = 100000;

// ── Revenue ─────────────────────────────────────────────────────────────────
// £4.99 a month, rising 15% every three years; VAT included. Billing: 90%
// through the app stores at 15%, 10% on the web at 2%.
export function monthlyPrice(t) {
  return Math.round(4.99 * Math.pow(1.15, Math.floor((t - 1) / 3)) * 100) / 100;
}
export const annualPrice = t => monthlyPrice(t) * 12;
export const BLENDED_FEE = 0.9 * 0.15 + 0.1 * 0.02;
export const netRevenue = t => annualPrice(t) / 1.2 * (1 - BLENDED_FEE);

// ── Churn ───────────────────────────────────────────────────────────────────
// The standard consumer-subscription curve: 40% leave in year 1, then 20% a
// year. survival(k) = share still a member after k years.
export const survival = k => k <= 0 ? 1 : 0.6 * Math.pow(0.8, k - 1);

export const ACTION_RATES = { high: 0.8, mid: 0.5, low: 0.25 };
