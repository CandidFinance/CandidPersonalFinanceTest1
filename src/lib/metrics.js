import { REDUNDANCY_TAX_FREE, scottishRate, ADDITIONAL_RATE_THRESHOLD, HIGHER_RATE_THRESHOLD, INCOME_TAX_RATES, ISA_ALLOWANCE, savingsTaxRates, cashIsaLimit, STATE_PENSION_WEEKLY, STATE_PENSION_FULL, calcNI, calcIncomeAndDividendTax, PAST_STATE_PENSION_AGE, CGT_ANNUAL_ALLOWANCE } from "./tax.js";
import { taxYearFor } from "./taxYear.js";
import { employerPct, unclaimedMatchPct } from "./employer.js";
import { GROWTH_REAL_PCT, payFactor, PAY_LATER_GROWTH } from "./growth.js";
import { slRateIn, slRepaymentThreshold, SL_REPAYMENT_RATES, SL_REPAYMENT_THRESHOLDS, slYearsLeft, slThresholdIn, slEarnings, estimateSlBalance, hasPgLoan } from "./studentLoan.js";
import { allocateCash } from "./cashAllocation.js";
import { isaUsedThisYear } from "./isa.js";

// Each for the first ten years, then pay rises with prices (growth.js
// payFactor). "high" was 15%, which over a loan's 30 years compounded to
// 66 times today's pay.
export const SALARY_GROWTH_RATES = { stable:0.02, moderate:0.05, high:0.10 };
// Their own rate, set on the student loan page (salaryGrowthPct, 1% to 10%
// a year, or from what they expect to earn in ten years), else the band
// they picked (salaryTrajectory), else `fallback`. A fraction (0.05).
export const SALARY_GROWTH_MIN_PCT = 1, SALARY_GROWTH_MAX_PCT = 10;
export function salaryGrowthOf(d, fallback = SALARY_GROWTH_RATES.stable) {
  const own = +d.salaryGrowthPct;
  if (own > 0) return Math.min(SALARY_GROWTH_MAX_PCT, Math.max(SALARY_GROWTH_MIN_PCT, own)) / 100;
  return SALARY_GROWTH_RATES[d.salaryTrajectory] ?? fallback;
}
// Their pay year by year, where they know it (d.payByYear: [{ year, salary
// }], the tax year from April and its pay in money of the day; a
// subscriber's, set in Scenario modelling): from today's salary, rising
// steadily between the years given, then with prices after the last. Usable
// wherever a growth rate is (growth.js payFactor, payGrowthIn), as
// { points, factor(years) }, pay `years` on as a multiple of today's. Null
// without a year after this one.
export function payPathOf(d, salary, taxYear) {
  if (!(salary > 0)) return null;
  const byYear = new Map();
  for (const p of d.payByYear || []) if (+p.year > taxYear && +p.salary > 0) byYear.set(+p.year - taxYear, +p.salary);
  if (!byYear.size) return null;
  const points = [{ i: 0, pay: salary }, ...[...byYear].sort((a, b) => a[0] - b[0]).map(([i, pay]) => ({ i, pay }))];
  const last = points[points.length - 1];
  return {
    points,
    factor(years) {
      if (years <= 0) return 1;
      for (let k = 1; k < points.length; k++) {
        const a = points[k - 1], b = points[k];
        if (years <= b.i) return a.pay * Math.pow(b.pay / a.pay, (years - a.i) / (b.i - a.i)) / salary;
      }
      return last.pay * Math.pow(1 + PAY_LATER_GROWTH, years - last.i) / salary;
    },
  };
}
// The pay growth every projection uses: their pay by year, else a rate.
export const payGrowthOf = (d, salary, taxYear, fallback) => payPathOf(d, salary, taxYear) || salaryGrowthOf(d, fallback);

// The band nearest a rate of their own, kept alongside it for anything that
// asks by band (the walk-through's question, a free user's saved row).
export const trajectoryNearest = pct => pct < 3.5 ? "stable" : pct < 7.5 ? "moderate" : "high";

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

// The age someone stops working. Earning at or past the retirement age they
// gave (65 if none), they're asked when they plan to stop; until they say,
// they're taken to stop at 75 (or now, if they're already 75 or over), not
// to earn for ever. Not earning: the retirement age they gave.
export const WORKING_AGE_LIMIT = 75;
export function workingPastRetirementAge(d) {
  return (+d.salary || 0) > 0 && (+d.age || 0) >= (+d.retirementAge || 65);
}
export function retirementAgeFor(d) {
  const age = +d.age || 0, stated = +d.retirementAge || 65;
  if (!((+d.salary || 0) > 0) || stated > age) return stated;
  return Math.max(age, WORKING_AGE_LIMIT);
}

// The State Pension in payment: what they told us they get, else the full
// rate. It's taxable, so it counts towards the tax band.
export function statePensionIncome(d) {
  if (!pastStatePensionAge(d)) return 0;
  const stated = d.statePensionAmount;
  return stated !== "" && stated != null && !isNaN(+stated) ? Math.max(0, +stated) : STATE_PENSION_FULL;
}

/**
 * @param {import("./types.js").Inputs} d
 * @param {import("./types.js").MarketRates} [marketRates]
 * @returns {import("./types.js").Metrics}
 */
export function calcMetrics(d, marketRates = {}) {
  const { isaRate = 5.1, nonIsaRate = 5.1, rows = null } = marketRates;
  // Pay by year where they've given it (payGrowth, for the projections),
  // and as a single rate, its ten-year average then, for what's said in
  // words (salaryGrowthRate).
  const payGrowth = payGrowthOf(d, +d.salary || 0, taxYearFor(d));
  const salaryGrowthRate = typeof payGrowth === "number" ? payGrowth : Math.pow(payGrowth.factor(10), 0.1) - 1;
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
        // With no spending entered there's no emergency fund to measure
        // against, so no cash counts as spare (rather than all of it).
        expensesUnknown = !(expenses > 0),
        emergencyExcess = expensesUnknown ? 0 : Math.max(0, emergencyFund - emergencyBuffer),
        surplusCash = emergencyExcess,
        // The most at any one bank, for the FSCS limit: the largest account
        // listed, or all of it when it isn't split.
        largestCashHolding = tiers.length > 1 ? Math.max(...tiers.map(t => +t.amount || 0)) : cash,
        // ISA: every kind of ISA shares the allowance (src/lib/isa.js)
        isaUsedThisYearCalc = isaUsedThisYear(d),
        isaHeadroom = Math.max(0, ISA_ALLOWANCE - isaUsedThisYearCalc),
        myPct = +d.myContribution||0,
        missedMatch = unclaimedMatchPct(d, myPct) * salary / 100,
        potVal = (+d.potValue||0) + (+d.potValue2||0),
        retireAge = retirementAgeFor(d),
        age = +d.age||30, years = Math.max(1, retireAge - age),
        // The employer's share as missedMatch reads it (employer.js). A final
        // salary scheme's payments build an income, not this pot: only old
        // pots (potValue2) grow here for them.
        annualContrib = d.pensionKind === "db" ? 0 : (myPct + employerPct(d, myPct)) / 100 * salary,
        // In today's money: contributions at today's salary, growing at the
        // real rate, after inflation (growth.js).
        pensionGrowth = GROWTH_REAL_PCT / 100,
        projectedPot = potVal * Math.pow(1 + pensionGrowth, years) +
          annualContrib * ((Math.pow(1 + pensionGrowth, years) - 1) / pensionGrowth);
  let annualRepayment = 0, willClear = false;
  const slGrow = salaryGrowthOf(d);
  // The balance they gave, or, if they weren't sure, Candid's estimate from
  // what they borrowed (estimateSlBalance).
  const slEstimate = d.loanBalance === "" || d.loanBalance == null ? estimateSlBalance(d, { salary, growth: slGrow }) : null;
  const loanBal = slEstimate ? slEstimate.balance : +d.loanBalance||0;
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
    willClear = (() => { let b = loanBal; for (let y=1; y<=yearsLeft; y++) { const g = payFactor(payGrowth, y - 1), s = slPay * g; b = b*(1 + slRateIn(d, salary * g, y - 1, slYear)) - Math.max(0,(s-slThresholdIn(d.studentLoan, slYear + y - 1))*slRepayRate); if(b<=0) return true; } return false; })();
  }
  // A Postgraduate loan alongside the main plan (GOV.UK: both are repaid at
  // once, 6% of pay over £21,000 on top of the main plan's 9%): its balance
  // and this year's repayment, for take-home pay and the Student loan
  // module (studentLoan.js pgScenario).
  const pgLoanBal = hasPgLoan(d) ? +d.pgLoanBalance : 0;
  const pgOver = pay => Math.max(0, (pay - SL_REPAYMENT_THRESHOLDS.postgrad) * SL_REPAYMENT_RATES.postgrad);
  const pgRepayment = pgLoanBal > 0 ? pgOver(slPay) : 0;
  const pgRepaymentRegular = pgLoanBal > 0 ? pgOver(slPay - (+d.bonusAmount || 0)) : 0;
  const otherIncome = +d.otherIncome||0;
  const dividendIncome = +d.dividendIncome||0;
  // The stated annual bonus counts: in a year it's paid, it's part of what sets
  // the tax band, the £100k taper and the Personal Savings Allowance.
  const bonusIncome = +d.bonusAmount||0;
  const pensionSacrifice = salary * myPct / 100;
  const statePensionPaid = statePensionIncome(d);
  // Not working now: pay earlier this tax year still sets this year's band,
  // and so the tax on savings interest, but isn't pay coming in each month.
  const earlier = d.employmentStatus === "not_working" ? earnedEarlierThisYear(d, taxYearFor(d)) : { pay: 0, settlementTaxed: 0, estimated: false };
  const earlierIncome = earlier.pay + earlier.settlementTaxed;
  const adjustedNetIncome = salary + bonusIncome + otherIncome + dividendIncome + statePensionPaid - pensionSacrifice + earlierIncome;
  // Income other than savings interest and dividends: what the starting rate
  // for savings is measured against (tax.js taxFreeInterest).
  const nonSavingsIncome = adjustedNetIncome - dividendIncome;
  const taxBandLabel = adjustedNetIncome > ADDITIONAL_RATE_THRESHOLD ? "additional" : adjustedNetIncome > HIGHER_RATE_THRESHOLD ? "higher" : "basic";
  // Scottish taxpayers: their own rate on the top slice (tax.js scottishRate),
  // never under the 20% relief at source adds. The UK band (taxBandLabel)
  // still sets the Personal Savings Allowance, dividend and capital gains
  // rates, which are UK-wide.
  const scottish = d.scottishTaxpayer === "yes";
  const tr = scottish ? Math.max(0.2, scottishRate(adjustedNetIncome)) : INCOME_TAX_RATES[taxBandLabel];
  // Rates and limits that change on 6 April follow the tax year the figures
  // are for: savings interest above the PSA has its own rates (4 points over
  // income tax from April 2027), and the cash ISA limit (tax.js
  // cashIsaLimit).
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
        cgtRate = taxBandLabel !== "basic" ? 0.24 : 0.18,
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
  const regularIncome = adjustedNetIncome - bonusIncome - earlierIncome;
  // Dividends on their own rates, after the £500 allowance.
  const incomeTaxAnnual = calcIncomeAndDividendTax(regularIncome - dividendIncome, dividendIncome, taxYear, scottish);
  const netAnnualIncome = regularIncome - incomeTaxAnnual - niAnnual;
  const existingMortgagePmt = hasMortgage ? (+d.monthlyMortgage||0) : 0;
  const existingPersonalLoanPmt = d.hasPersonalLoan === "yes" ? plMonthly : 0;
  const monthlyBalance = netAnnualIncome / 12 - expenses - existingMortgagePmt - existingPersonalLoanPmt - (slRepaymentRegular + pgRepaymentRegular) / 12;
  const monthlySurplus = Math.max(0, monthlyBalance);
  // More going out than coming in: the gap a month (0 when there's a surplus,
  // or when it's under £25, which is rounding in the inputs, not a gap).
  const monthlyShortfall = -monthlyBalance >= 25 ? -monthlyBalance : 0;
  // Take-home pay a month after tax, NI, student loan and personal loan
  // repayments, before living costs. Not less any current mortgage: the
  // Property module's budget check (monthlyBudget.js) is for a purchase that
  // replaces it.
  const monthlyTakeHome = netAnnualIncome / 12 - existingPersonalLoanPmt - (slRepaymentRegular + pgRepaymentRegular) / 12;

  return {
    salary, expenses, totalLiquid, runwayMonths,
    emergencyFund, emergencyBuffer, emergencyShortfall, emergencyExcess, surplusCash,
    isaHeadroom, isaUsedThisYear: isaUsedThisYearCalc,
    missedMatch, annualRepayment, slRepaymentRegular, slEarnings: slPay, willClear, pgLoanBal, pgRepayment, crystallisable, cgtSaving, cgtRate, remainingCgtAllowance,
    projectedPot, years, annualYieldGap, savingsRate, loanBal, loanBalEstimated: !!slEstimate, tr, savingsTr, cashIsaHeadroom, taxYear,
    cashMoveAmount, cashExcessNotWorthMoving,
    cash, bonds, totalAssets, totalLiabilities, netWorth,
    taxBandLabel, adjustedNetIncome, nonSavingsIncome, bufferMonths,
    statePensionWeekly, statePensionAnnual, niYearsToFull,
    daysToFixExpiry, effectiveSavingsRate, salaryGrowthRate, payGrowth,
    propertyEquity, propertyValue, ltv,
    pensionStatus, personalLoanAnnualRepayment, personalLoanPayoffMonths,
    // For the pension figures that depend on how it's paid in (NI on salary
    // sacrifice) and on State Pension age.
    pensionType: d.pensionType || "", pastStatePensionAge: pastSpa,
    salarySacrifice: d.pensionType === "sacrifice" ? pensionSacrifice : 0,
    monthlySurplus, monthlyShortfall, monthlyTakeHome, expensesUnknown, largestCashHolding,
    // A Scottish taxpayer: Scottish rates on earnings (tax.js).
    scottish,
    // Not working now: pay earlier this tax year (stated, or estimated from
    // their last salary), and a settlement's taxed parts.
    earnedEarlierThisYear: earlier.pay, earnedEarlierEstimated: earlier.estimated, settlementTaxedThisYear: earlier.settlementTaxed,
    // No earnings: not working, with no salary (other income, dividends or a
    // pension may still come in).
    noEarnings: d.employmentStatus === "not_working" || !(salary > 0),
    // The best savings rate available (the live best Cash ISA rate) — what
    // overpaying a student loan is weighed against (calcStudentLoanScenario).
    bestSavingsRate: isaRate,
  };
}

// The days left in this tax year (to 5 April).
export function daysToTaxYearEnd(now = new Date()) {
  const taxEnd = new Date(now.getFullYear(), 3, 5);
  if (taxEnd < now) taxEnd.setFullYear(taxEnd.getFullYear() + 1);
  return Math.ceil((taxEnd - now) / (1000 * 60 * 60 * 24));
}
// How much of this year's ISA allowance there's money to fill before
// 5 April: investments held outside an ISA, cash above the emergency fund,
// and spare income until then, less any emergency shortfall (when Cash &
// savings was picked; otherwise spare income is taken at face value).
export function isaFillable(d, m, now = new Date()) {
  const cashSelected = (d.selectedModules || []).includes("cash");
  const spareIncome = Math.max(0, m.monthlySurplus * (daysToTaxYearEnd(now) / 30.44) - (cashSelected ? m.emergencyShortfall : 0));
  const unwrapped = d.hasInvestments === "yes" ? (+d.unwrappedValue || 0) : 0;
  return Math.min(m.isaHeadroom, unwrapped + m.emergencyExcess + spareIncome);
}

// The share of this tax year gone so far, from 6 April (0 to 1).
export function taxYearElapsed(taxYear, now = new Date()) {
  const start = new Date(taxYear, 3, 6);
  return Math.min(1, Math.max(0, (now - start) / (365.25 * 24 * 3600 * 1000)));
}
// A redundancy settlement's taxed parts (src/lib/windfall.js): notice,
// bonus, holiday pay and anything else in full, and redundancy and
// thank-you payments above £30,000.
export function settlementTaxedPay(parts = {}) {
  const n = k => Math.max(0, +parts[k] || 0);
  return n("notice") + n("bonus") + n("holiday") + n("other") + Math.max(0, n("compensation") - REDUNDANCY_TAX_FREE);
}
// Pay this tax year before they stopped working: what they said (in Edit
// inputs, or to the Chat tab's lump-sum questions), else their last salary
// for the share of the tax year gone so far, as if they'd only just
// stopped. Plus a redundancy settlement's taxed parts, from the Chat tab,
// when it's this tax year's.
export function earnedEarlierThisYear(d, taxYear, now = new Date()) {
  const w = d.windfall || {};
  const thisYears = w.taxYear == null || w.taxYear === taxYear;
  const stated = [d.earnedThisTaxYear, thisYears && w.source === "redundancy" ? w.earnedBefore : null]
    .find(v => v !== "" && v != null && !isNaN(+v));
  const pay = stated != null ? Math.max(0, +stated) : Math.round((+d.previousSalary || 0) * taxYearElapsed(taxYear, now));
  return {
    pay, estimated: stated == null && pay > 0,
    settlementTaxed: thisYears && w.source === "redundancy" && w.parts ? settlementTaxedPay(w.parts) : 0,
  };
}
