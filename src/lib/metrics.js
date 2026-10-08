import { calcIncomeTax, ADDITIONAL_RATE_THRESHOLD, HIGHER_RATE_THRESHOLD, INCOME_TAX_RATES, ISA_ALLOWANCE, savingsTaxRates, cashIsaLimit, STATE_PENSION_WEEKLY, STATE_PENSION_FULL, calcNI, calcIncomeAndDividendTax, PAST_STATE_PENSION_AGE, CGT_ANNUAL_ALLOWANCE } from "./tax.js";
import { taxYearFor } from "./taxYear.js";
import { GROWTH_REAL_PCT } from "./growth.js";
import { resolveSlRate, slRepaymentThreshold, SL_REPAYMENT_RATES, slYearsLeft, slThresholdIn, slEarnings } from "./studentLoan.js";
import { allocateCash } from "./cashAllocation.js";
import { isaUsedThisYear } from "./isa.js";

export const SALARY_GROWTH_RATES = { stable:0.02, moderate:0.05, high:0.15 };

// marketRates: { isaRate, nonIsaRate, rows } — the live best easy-access rates from
// savings_rates, plus (optionally) the rows themselves. With rows, the cash
// figures spread each portion across real accounts by rate and balance cap
// (allocateCash) instead of assuming all of it gets the single top rate.
// resolved ONCE by the caller (client: Candid's useMemo; server: the PDF route) and
// passed in here as plain numbers so this function stays synchronous. Defaults
// preserve the exact prior hardcoded behaviour for any caller that omits it.
// Emergency fund target in months of expenses — "3" | "6" | "9" on
// `emergencyMonths`. Inputs saved before the 3-month option existed only have
// the old yes/no `higherBuffer` flag, so fall back to it (yes = 9, else 6).
export const EMERGENCY_MONTHS_OPTIONS = [
  { value:"3", label:"3 months" },
  { value:"6", label:"6 months" },
  { value:"9", label:"9 months" },
];
export const EMERGENCY_MONTHS_HINT = {
  "3": "Suits a very secure job, or a second income in the household",
  "6": "The usual target for most employed people",
  "9": "Suits self-employed or variable income",
};
export function getBufferMonths(d) {
  const n = +d.emergencyMonths;
  if (n === 3 || n === 6 || n === 9) return n;
  return d.higherBuffer === "yes" ? 9 : 6;
}

// Past State Pension age. It depends on date of birth (66 for anyone born
// before 6 April 1960, rising a month at a time to 67 for those born from
// 6 March 1961: gov.uk State Pension age timetable), which Candid doesn't
// ask. So: everyone at 67; at 66, unless they've told us they don't get the
// State Pension yet (statePensionAmount "0"). It ends employee NI and Class 4,
// and adds the State Pension to income.
export function pastStatePensionAge(d) {
  const age = +d.age || 0;
  if (age >= PAST_STATE_PENSION_AGE) return true;
  if (age < 66) return false;
  const stated = d.statePensionAmount;
  return !(stated !== "" && stated != null && +stated === 0);
}

// The State Pension in payment: what they told us they get, else the full
// rate. It's taxable, so it counts towards the tax band.
export function statePensionIncome(d) {
  if (!pastStatePensionAge(d)) return 0;
  const stated = d.statePensionAmount;
  return stated !== "" && stated != null && !isNaN(+stated) ? Math.max(0, +stated) : STATE_PENSION_FULL;
}

export function calcMetrics(d, marketRates = {}) {
  const { isaRate = 5.1, nonIsaRate = 5.1, rows = null } = marketRates;
  const salaryGrowthRate = SALARY_GROWTH_RATES[d.salaryTrajectory] ?? 0.02;
  const salary = +d.salary||0, expenses = +d.monthlyExpenses||0,
        bonds = +d.premiumBonds||0;
  // Cash: prefer sum of cashTiers (more granular); fall back to d.cashSavings
  const tiers = Array.isArray(d.cashTiers) ? d.cashTiers : [];
  const tiersTotal = tiers.reduce((s, t) => s + (+t.amount||0), 0);
  const tiersWeightedRate = tiersTotal > 0
    ? tiers.reduce((s, t) => s + (+t.amount||0) * (+t.rate||0), 0) / tiersTotal
    : 0;
  const effectiveSavingsRate = tiersTotal > 0 ? tiersWeightedRate : (+d.savingsRate||3.5);
  const cash = tiersTotal > 0 ? tiersTotal : (+d.cashSavings||0);
  const totalLiquid = cash + bonds,
        runwayMonths = expenses > 0 ? totalLiquid / expenses : 0,
        bufferMonths = getBufferMonths(d),
        emergencyFund = totalLiquid,
        emergencyBuffer = expenses * bufferMonths,
        emergencyShortfall = Math.max(0, emergencyBuffer - emergencyFund),
        emergencyExcess = Math.max(0, emergencyFund - emergencyBuffer),
        surplusCash = emergencyExcess,
        // ISA: every kind of ISA shares the allowance (src/lib/isa.js)
        isaUsedThisYearCalc = isaUsedThisYear(d),
        isaHeadroom = Math.max(0, ISA_ALLOWANCE - isaUsedThisYearCalc),
        myPct = +d.myContribution||0, empCapPct = +d.employerMatch||0,
        missedMatch = Math.max(0, empCapPct - myPct) * salary / 100,
        potVal = (+d.potValue||0) + (+d.potValue2||0),
        retireAge = +d.retirementAge||65,
        age = +d.age||30, years = Math.max(1, retireAge - age),
        // The employer matches what the user pays, up to its cap (the same
        // model as missedMatch).
        annualContrib = (myPct + Math.min(myPct, empCapPct)) / 100 * salary,
        // In today's money: contributions at today's salary, growing at the
        // real rate, after inflation (growth.js).
        pensionGrowth = GROWTH_REAL_PCT / 100,
        projectedPot = potVal * Math.pow(1 + pensionGrowth, years) +
          annualContrib * ((Math.pow(1 + pensionGrowth, years) - 1) / pensionGrowth);
  let annualRepayment = 0, willClear = false;
  const loanBal = +d.loanBalance||0;
  const slGrow = SALARY_GROWTH_RATES[d.salaryTrajectory] ?? 0.02;
  const slThreshold = slRepaymentThreshold(d.studentLoan);
  // Every plan, Plan 4 and Postgraduate included: the plan's rate on salary
  // above its threshold, and whether it clears before the plan's write-off.
  // Repayments are on salary and bonus, less salary sacrifice (slEarnings);
  // the regular part leaves out the bonus, for the monthly figures. Whether
  // it clears runs to the write-off year (from when repayments started) with
  // the threshold rising as each plan's rules say.
  const slRepayRate = SL_REPAYMENT_RATES[d.studentLoan];
  const slPay = slEarnings(d, salary);
  let slRepaymentRegular = 0;
  if (slRepayRate && slThreshold > 0) {
    const slYear = taxYearFor(d);
    annualRepayment = Math.max(0, (slPay - slThreshold) * slRepayRate);
    slRepaymentRegular = Math.max(0, (slPay - (+d.bonusAmount || 0) - slThreshold) * slRepayRate);
    const yearsLeft = slYearsLeft(d, slYear);
    willClear = (() => { const r = 1 + resolveSlRate(d, salary); let b = loanBal; for (let y=1; y<=yearsLeft; y++) { const s = slPay * Math.pow(1+slGrow,y-1); b = b*r - Math.max(0,(s-slThresholdIn(d.studentLoan, slYear + y - 1))*slRepayRate); if(b<=0) return true; } return false; })();
  }
  const otherIncome = +d.otherIncome||0;
  const dividendIncome = +d.dividendIncome||0;
  // The stated annual bonus counts: in a year it's paid, it's part of what sets
  // the tax band, the £100k taper and the Personal Savings Allowance.
  const bonusIncome = +d.bonusAmount||0;
  const pensionSacrifice = salary * myPct / 100;
  const statePensionPaid = statePensionIncome(d);
  const adjustedNetIncome = salary + bonusIncome + otherIncome + dividendIncome + statePensionPaid - pensionSacrifice;
  // Income other than savings interest and dividends: what the starting rate
  // for savings is measured against (tax.js taxFreeInterest).
  const nonSavingsIncome = adjustedNetIncome - dividendIncome;
  const taxBandLabel = adjustedNetIncome > ADDITIONAL_RATE_THRESHOLD ? "additional" : adjustedNetIncome > HIGHER_RATE_THRESHOLD ? "higher" : "basic";
  const tr = INCOME_TAX_RATES[taxBandLabel];
  // Rates and limits that change on 6 April follow the tax year the figures
  // are for: savings interest above the PSA has its own rates (2 points over
  // income tax from April 2027), and from April 2027 under-65s can put only
  // £12,000 of the ISA allowance into cash.
  const taxYear = taxYearFor(d);
  const savingsTr = savingsTaxRates(taxYear)[taxBandLabel];
  const cashIsaHeadroom = Math.max(0, Math.min(isaHeadroom, cashIsaLimit(taxYear, d.age) - (+d.isaThisYearCash || 0)));
  // CGT rates on shares/other assets (non-property): 18% basic, 24% higher/additional —
  // aligned with residential property rates from the 30 Oct 2024 Budget. Not 10%/20%,
  // which were the pre-Budget rates.
  const gains = +d.unrealisedGains||0,
        realisedCgtGains = d.hasSoldAssetsOutsideWrapper === "yes" ? Math.max(0, +d.realisedCgtGains||0) : 0,
        remainingCgtAllowance = Math.max(0, CGT_ANNUAL_ALLOWANCE - realisedCgtGains),
        crystallisable = Math.min(gains, remainingCgtAllowance),
        cgtRate = tr !== 0.20 ? 0.24 : 0.18,
        cgtSaving = crystallisable * cgtRate,
        savingsRate = effectiveSavingsRate,
        // Blended, not flat: only isaHeadroom worth of CASH could actually go into an
        // ISA — the rest would realistically land in a (usually lower-rate) non-ISA
        // account. Each portion's gain is measured against the user's own current
        // rate, then summed. The non-ISA portion is floored at £0 (not left negative)
        // — if the best non-ISA rate doesn't even beat the user's current rate,
        // there's nowhere better to move that excess right now.
        // Deliberately `cash`, not `emergencyFund` (= cash + bonds) — premium bonds
        // have their own separate yield-gap calculation (bondsYieldGain, in
        // computeModuleStatuses, based on bondsSurplus). Basing this on emergencyFund
        // would silently double-count the same bonds balance in both calculations.
        isaEligiblePortion = Math.min(cash, isaHeadroom),
        nonIsaPortion = Math.max(0, cash - isaHeadroom),
        isaAlloc = Array.isArray(rows) ? allocateCash(isaEligiblePortion, rows.filter(r => r.is_isa === true)) : null,
        nonIsaAlloc = Array.isArray(rows) ? allocateCash(nonIsaPortion, rows.filter(r => r.is_isa === false)) : null,
        isaPortionRate = isaAlloc?.lines.length && !isaAlloc.unallocated ? isaAlloc.blendedRatePct : isaRate,
        nonIsaPortionRate = nonIsaAlloc?.lines.length && !nonIsaAlloc.unallocated ? nonIsaAlloc.blendedRatePct : nonIsaRate,
        isaPortionGain = isaEligiblePortion * (isaPortionRate - savingsRate),
        nonIsaPortionGain = nonIsaPortion * (nonIsaPortionRate - savingsRate),
        cashExcessNotWorthMoving = nonIsaPortionGain < 0,
        annualYieldGap = (isaPortionGain + Math.max(0, nonIsaPortionGain)) / 100,
        // What to actually recommend moving: the full cash balance normally, but
        // capped to the ISA-eligible portion when the excess has nowhere better to
        // go — copy generators use this instead of the raw cash figure so they don't
        // overstate the ask.
        cashMoveAmount = cashExcessNotWorthMoving ? isaEligiblePortion : cash;
  // State pension estimate
  const niYears = +d.niYears||0;
  // Full new State Pension, 2026/27.
  // Nothing below 10 qualifying years (gov.uk/new-state-pension).
  const statePensionWeekly = niYears >= 10 ? (Math.min(niYears, 35) / 35) * STATE_PENSION_WEEKLY : 0;
  const statePensionAnnual = statePensionWeekly * 52;
  const niYearsToFull = Math.max(0, 35 - niYears);
  // Mortgage fix expiry in days
  let daysToFixExpiry = null;
  if (d.hasMortgage === "yes" && d.fixExpiryMonth && d.fixExpiryYear) {
    const expiryDate = new Date(+d.fixExpiryYear, +d.fixExpiryMonth - 1, 1);
    daysToFixExpiry = Math.round((expiryDate - new Date()) / 86400000);
  }
  // Net worth — use derived ISA totals
  const isaPrevCalc = (+d.isaPrevCash||0) + (+d.isaPrevSS||0) + (+d.isaPrevLISA||0) + (+d.isaPrevOther||0) || (+d.isaPreviousBalance||0);
  const totalIsaValue = isaUsedThisYearCalc + isaPrevCalc;
  const hasMortgage = d.hasMortgage === "yes";
  const propertyEquity = hasMortgage ? (+d.propertyEquity || 0) : (d.ownsOutright ? (+d.outrightPropertyValue || 0) : 0);
  const totalAssets = totalLiquid + totalIsaValue + (+d.unwrappedValue||0) + potVal + propertyEquity;
  const mortgageBalance = hasMortgage ? (+d.mortgageBalance||0) : 0;
  const totalLiabilities = loanBal + mortgageBalance + (d.hasPersonalLoan === "yes" ? (+d.personalLoanBalance||0) : 0);
  // Net worth excludes the mortgage — propertyEquity above is already net of it (it's
  // the equity stake the user enters, not the gross property value), so subtracting
  // mortgageBalance again here would double-count the same debt. Mortgage still shows
  // in totalLiabilities and the liabilities breakdown, just not in this figure.
  const netWorth = totalAssets - (totalLiabilities - mortgageBalance);
  const propertyValue = hasMortgage ? (propertyEquity + (+d.mortgageBalance || 0)) : 0;
  const ltv = hasMortgage && propertyValue > 0 ? Math.round((+d.mortgageBalance / propertyValue) * 100) : null;
  // Pension: user has told us they don't know their pension situation —
  // exclude from the normal "no contributions = critical" scoring
  const pensionStatus = d.pensionUnknown ? "unknown" : null;
  // Personal loan payoff projection — factor in an optional extra annual repayment
  const plMonthly = +d.personalLoanMonthly||0;
  const plAnnualExtra = +d.personalLoanAnnualExtra||0;
  const personalLoanAnnualRepayment = plMonthly * 12 + plAnnualExtra;
  let personalLoanPayoffMonths = null;
  if (d.hasPersonalLoan === "yes") {
    const plBal = +d.personalLoanBalance||0;
    const plRate = +d.personalLoanRate||0;
    const monthlyEquiv = personalLoanAnnualRepayment / 12;
    const r = plRate / 100 / 12;
    if (plBal > 0 && monthlyEquiv > 0) {
      if (r > 0 && monthlyEquiv > plBal * r) {
        personalLoanPayoffMonths = Math.ceil(Math.log(monthlyEquiv / (monthlyEquiv - plBal * r)) / Math.log(1 + r));
      } else if (r === 0) {
        personalLoanPayoffMonths = Math.ceil(plBal / monthlyEquiv);
      }
    }
  }
  // Monthly surplus — rough "free cash" per month after estimated income tax,
  // NI, pension contributions, living expenses, and existing debt repayments.
  // Used as the default monthly contribution for forecasting (see calcForecast).
  // Regular income only — the bonus is irregular, so it's left out of this
  // monthly figure.
  // Employee NI, or Class 4 when self-employed; none past State Pension age.
  const pastSpa = pastStatePensionAge(d);
  const niAnnual = calcNI(salary, { selfEmployed: d.employmentStatus === "self_employed", pastStatePensionAge: pastSpa });
  const regularIncome = adjustedNetIncome - bonusIncome;
  // Dividends on their own rates, after the £500 allowance.
  const incomeTaxAnnual = calcIncomeAndDividendTax(regularIncome - dividendIncome, dividendIncome, taxYear);
  const netAnnualIncome = regularIncome - incomeTaxAnnual - niAnnual;
  const existingMortgagePmt = hasMortgage ? (+d.monthlyMortgage||0) : 0;
  const existingPersonalLoanPmt = d.hasPersonalLoan === "yes" ? plMonthly : 0;
  const monthlySurplus = Math.max(0, netAnnualIncome / 12 - expenses - existingMortgagePmt - existingPersonalLoanPmt - slRepaymentRegular / 12);
  // Take-home pay a month after tax, NI, student loan and personal loan
  // repayments, before living costs. Not less any current mortgage: the
  // Property module's budget check (monthlyBudget.js) is for a purchase that
  // replaces it.
  const monthlyTakeHome = netAnnualIncome / 12 - existingPersonalLoanPmt - slRepaymentRegular / 12;

  return {
    salary, expenses, totalLiquid, runwayMonths,
    emergencyFund, emergencyBuffer, emergencyShortfall, emergencyExcess, surplusCash,
    isaHeadroom, isaUsedThisYear: isaUsedThisYearCalc,
    missedMatch, annualRepayment, slRepaymentRegular, slEarnings: slPay, willClear, crystallisable, cgtSaving, cgtRate, remainingCgtAllowance,
    projectedPot, years, annualYieldGap, savingsRate, loanBal, tr, savingsTr, cashIsaHeadroom, taxYear,
    cashMoveAmount, cashExcessNotWorthMoving,
    cash, bonds, totalAssets, totalLiabilities, netWorth,
    taxBandLabel, adjustedNetIncome, nonSavingsIncome, bufferMonths,
    statePensionWeekly, statePensionAnnual, niYearsToFull,
    daysToFixExpiry, effectiveSavingsRate, salaryGrowthRate,
    propertyEquity, propertyValue, ltv,
    pensionStatus, personalLoanAnnualRepayment, personalLoanPayoffMonths,
    // For the pension figures that depend on how it's paid in (NI on salary
    // sacrifice) and on State Pension age.
    pensionType: d.pensionType || "", pastStatePensionAge: pastSpa,
    salarySacrifice: d.pensionType === "sacrifice" ? pensionSacrifice : 0,
    monthlySurplus, monthlyTakeHome,
    // The best savings rate available (the live best Cash ISA rate) — what
    // overpaying a student loan is weighed against (calcStudentLoanScenario).
    bestSavingsRate: isaRate,
  };
}
