// Figures quoted in the public calculator pages' text (100k-tax-trap,
// mortgage-vs-savings and student-loan calculators). Every one is derived
// from the same constants the app calculates with, so the pages can't drift
// from the app. At build time, vite.config.js swaps each {{NAME}} token in
// those pages for its value here (see fillFigures); the pages' own maths
// imports the constants directly.
import {
  PERSONAL_ALLOWANCE, PA_TAPER_START, ADDITIONAL_RATE_THRESHOLD,
  INCOME_TAX_RATES, NI_RATE_ABOVE_UEL, PSA_BY_BAND, ISA_ALLOWANCE,
} from "./tax.js";
import {
  SL_REPAYMENT_THRESHOLDS, SL_REPAYMENT_RATES, SL_WRITE_OFF_YEARS,
  PLAN1_RATE, PLAN4_RATE, PLAN5_RATE, POSTGRAD_RATE,
  PLAN2_RPI_BASE, PLAN2_INCOME_LOWER, PLAN2_INCOME_UPPER, PLAN2_MAX_VARIABLE, PLAN2_RATE_CAP,
} from "./studentLoan.js";

// Childcare support lost above £100k — used only by the £100k calculator.
// Tax-Free Childcare is a statutory top-up (children under 11); the 30 hours
// figure is the commonly cited value, which varies by area and provider.
export const TAX_FREE_CHILDCARE_PER_CHILD = 2000;
export const THIRTY_HOURS_VALUE_PER_CHILD = 7500;

// Student loan interest rates above apply for this period (set each September).
export const SL_RATES_PERIOD = "1 September 2026 to 31 August 2027";

const gbp = n => "£" + Math.round(n).toLocaleString("en-GB");
const pct = r => `${+(r * 100).toFixed(2)}%`;

// Effective rate inside the taper: higher rate plus the higher rate again on
// the 50p of allowance lost per £1 (40% + 20% = 60%).
const TAPER_RATE = INCOME_TAX_RATES.higher * 1.5;
const paLeftAt = income => Math.max(0, PERSONAL_ALLOWANCE - (income - PA_TAPER_START) / 2);
// Income at which Plan 2's rising rate reaches the cap, to the nearest £10.
const plan2CapIncome = PLAN2_INCOME_LOWER
  + (PLAN2_RATE_CAP - PLAN2_RPI_BASE) / PLAN2_MAX_VARIABLE * (PLAN2_INCOME_UPPER - PLAN2_INCOME_LOWER);

export const PAGE_FIGURES = {
  // Income tax and the £100k taper
  PERSONAL_ALLOWANCE: gbp(PERSONAL_ALLOWANCE),
  TAPER_START: gbp(PA_TAPER_START),
  TAPER_END: gbp(ADDITIONAL_RATE_THRESHOLD),
  BASIC_RATE: pct(INCOME_TAX_RATES.basic),
  HIGHER_RATE: pct(INCOME_TAX_RATES.higher),
  ADDITIONAL_RATE: pct(INCOME_TAX_RATES.additional),
  TAPER_RATE: pct(TAPER_RATE),
  TAPER_EXTRA_RATE: pct(TAPER_RATE - INCOME_TAX_RATES.higher),
  NI_UPPER_RATE: pct(NI_RATE_ABOVE_UEL),
  TAPER_ALL_IN_MIN: pct(TAPER_RATE + NI_RATE_ABOVE_UEL),
  TAPER_ALL_IN_MAX: pct(TAPER_RATE + NI_RATE_ABOVE_UEL + SL_REPAYMENT_RATES.plan2),
  PA_LEFT_AT_110K: gbp(paLeftAt(110000)),
  PA_LEFT_AT_120K: gbp(paLeftAt(120000)),
  TAX_FREE_CHILDCARE: gbp(TAX_FREE_CHILDCARE_PER_CHILD),
  THIRTY_HOURS_VALUE: gbp(THIRTY_HOURS_VALUE_PER_CHILD),

  // Savings
  PSA_BASIC: gbp(PSA_BY_BAND.basic),
  PSA_HIGHER: gbp(PSA_BY_BAND.higher),
  PSA_ADDITIONAL: gbp(PSA_BY_BAND.additional),
  ISA_ALLOWANCE: gbp(ISA_ALLOWANCE),

  // Student loans
  SL_RATES_PERIOD,
  SL_THRESHOLD_PLAN1: gbp(SL_REPAYMENT_THRESHOLDS.plan1),
  SL_THRESHOLD_PLAN2: gbp(SL_REPAYMENT_THRESHOLDS.plan2),
  SL_THRESHOLD_PLAN4: gbp(SL_REPAYMENT_THRESHOLDS.plan4),
  SL_THRESHOLD_PLAN5: gbp(SL_REPAYMENT_THRESHOLDS.plan5),
  SL_THRESHOLD_POSTGRAD: gbp(SL_REPAYMENT_THRESHOLDS.postgrad),
  SL_REPAY_RATE_PLAN: pct(SL_REPAYMENT_RATES.plan2),
  SL_REPAY_RATE_POSTGRAD: pct(SL_REPAYMENT_RATES.postgrad),
  SL_WRITE_OFF_PLAN1: String(SL_WRITE_OFF_YEARS.plan1),
  SL_WRITE_OFF_PLAN2: String(SL_WRITE_OFF_YEARS.plan2),
  SL_WRITE_OFF_PLAN4: String(SL_WRITE_OFF_YEARS.plan4),
  SL_WRITE_OFF_PLAN5: String(SL_WRITE_OFF_YEARS.plan5),
  SL_WRITE_OFF_POSTGRAD: String(SL_WRITE_OFF_YEARS.postgrad),
  SL_RATE_PLAN1: pct(PLAN1_RATE),
  SL_RATE_PLAN4: pct(PLAN4_RATE),
  SL_RATE_PLAN5: pct(PLAN5_RATE),
  SL_RATE_POSTGRAD: pct(POSTGRAD_RATE),
  SL_PLAN2_RATE_LOWEST: pct(PLAN2_RPI_BASE),
  SL_PLAN2_RATE_CAP: pct(PLAN2_RATE_CAP),
  SL_PLAN2_MAX_VARIABLE: pct(PLAN2_MAX_VARIABLE),
  SL_PLAN2_INCOME_LOWER: gbp(PLAN2_INCOME_LOWER),
  SL_PLAN2_INCOME_UPPER: gbp(PLAN2_INCOME_UPPER),
  SL_PLAN2_CAP_INCOME: gbp(Math.round(plan2CapIncome / 10) * 10),
};

// Replaces every {{NAME}} token with its figure. An unknown name throws, so a
// typo in a page fails the build instead of shipping "{{TYPO}}" to visitors.
export function fillFigures(html) {
  return html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, name) => {
    if (!(name in PAGE_FIGURES)) throw new Error(`Unknown page figure {{${name}}}`);
    return PAGE_FIGURES[name];
  });
}
