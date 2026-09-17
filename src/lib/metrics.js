import { calcIncomeTax } from "./tax.js";
import { resolveSlRate } from "./studentLoan.js";

export const SALARY_GROWTH_RATES = { stable:0.02, moderate:0.05, high:0.15 };

// marketRates: { isaRate, nonIsaRate } — the live max(rate_aer) from savings_rates,
// resolved ONCE by the caller (client: Candid's useMemo; server: the PDF route) and
// passed in here as plain numbers so this function stays synchronous. Defaults
// preserve the exact prior hardcoded behaviour for any caller that omits it.
export function calcMetrics(d, marketRates = {}) {
  const { isaRate = 5.1, nonIsaRate = 5.1 } = marketRates;
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
        bufferMonths = d.higherBuffer === "yes" ? 9 : 6,
        emergencyFund = totalLiquid,
        emergencyBuffer = expenses * bufferMonths,
        emergencyShortfall = Math.max(0, emergencyBuffer - emergencyFund),
        emergencyExcess = Math.max(0, emergencyFund - emergencyBuffer),
        surplusCash = emergencyExcess,
        // ISA: always derived from granular breakdown fields
        isaUsedThisYearCalc = (+d.isaThisYearCash||0) + (+d.isaThisYearSS||0) + (+d.isaThisYearLISA||0) + (+d.isaThisYearOther||0),
        isaHeadroom = Math.max(0, 20000 - isaUsedThisYearCalc),
        myPct = +d.myContribution||0, empCapPct = +d.employerMatch||0,
        missedMatch = Math.max(0, empCapPct - myPct) * salary / 100,
        potVal = (+d.potValue||0) + (+d.potValue2||0),
        retireAge = +d.retirementAge||65,
        age = +d.age||30, years = Math.max(1, retireAge - age),
        annualContrib = (myPct + empCapPct) / 100 * salary,
        projectedPot = potVal * Math.pow(1.06, years) +
          annualContrib * ((Math.pow(1.06, years) - 1) / 0.06);
  let annualRepayment = 0, willClear = false;
  const loanBal = +d.loanBalance||0;
  const slGrow = SALARY_GROWTH_RATES[d.salaryTrajectory] ?? 0.02;
  if (d.studentLoan === "plan2") {
    annualRepayment = Math.max(0, (salary - 27295) * 0.09);
    willClear = (() => { const r = 1 + resolveSlRate(d, salary); let b = loanBal; for (let y=1; y<=30; y++) { const s = salary * Math.pow(1+slGrow,y); b = b*r - Math.max(0,(s-27295)*0.09); if(b<=0) return true; } return false; })();
  } else if (d.studentLoan === "plan5") {
    annualRepayment = Math.max(0, (salary - 25000) * 0.09);
    willClear = (() => { const r = 1 + resolveSlRate(d, salary); let b = loanBal; for (let y=1; y<=40; y++) { const s = salary * Math.pow(1+slGrow,y); b = b*r - Math.max(0,(s-25000)*0.09); if(b<=0) return true; } return false; })();
  } else if (d.studentLoan === "plan1") {
    annualRepayment = Math.max(0, (salary - 24990) * 0.09);
    willClear = (() => { const r = 1 + resolveSlRate(d, salary); let b = loanBal; for (let y=1; y<=25; y++) { const s = salary * Math.pow(1+slGrow,y); b = b*r - Math.max(0,(s-24990)*0.09); if(b<=0) return true; } return false; })();
  }
  const otherIncome = +d.otherIncome||0;
  const dividendIncome = +d.dividendIncome||0;
  const pensionSacrifice = salary * myPct / 100;
  const adjustedNetIncome = salary + otherIncome + dividendIncome - pensionSacrifice;
  const tr = adjustedNetIncome > 125140 ? 0.45
           : adjustedNetIncome > 50270  ? 0.40
           : 0.20;
  const taxBandLabel = adjustedNetIncome > 125140 ? "additional" : adjustedNetIncome > 50270 ? "higher" : "basic";
  // CGT rates on shares/other assets (non-property): 18% basic, 24% higher/additional —
  // aligned with residential property rates from the 30 Oct 2024 Budget. Not 10%/20%,
  // which were the pre-Budget rates.
  const gains = +d.unrealisedGains||0, crystallisable = Math.min(gains, 3000),
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
        isaPortionGain = isaEligiblePortion * (isaRate - savingsRate),
        nonIsaPortionGain = nonIsaPortion * (nonIsaRate - savingsRate),
        cashExcessNotWorthMoving = nonIsaPortionGain < 0,
        annualYieldGap = (isaPortionGain + Math.max(0, nonIsaPortionGain)) / 100,
        // What to actually recommend moving: the full cash balance normally, but
        // capped to the ISA-eligible portion when the excess has nowhere better to
        // go — copy generators use this instead of the raw cash figure so they don't
        // overstate the ask.
        cashMoveAmount = cashExcessNotWorthMoving ? isaEligiblePortion : cash;
  // State pension estimate
  const niYears = +d.niYears||0;
  const statePensionWeekly = (niYears / 35) * 221.20;
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
  const niAnnual = 0.08 * Math.min(Math.max(0, salary - 12570), 37700) + 0.02 * Math.max(0, salary - 50270);
  const incomeTaxAnnual = calcIncomeTax(adjustedNetIncome);
  const netAnnualIncome = adjustedNetIncome - incomeTaxAnnual - niAnnual;
  const existingMortgagePmt = hasMortgage ? (+d.monthlyMortgage||0) : 0;
  const existingPersonalLoanPmt = d.hasPersonalLoan === "yes" ? plMonthly : 0;
  const monthlySurplus = Math.max(0, netAnnualIncome / 12 - expenses - existingMortgagePmt - existingPersonalLoanPmt - annualRepayment / 12);

  return {
    salary, expenses, totalLiquid, runwayMonths,
    emergencyFund, emergencyBuffer, emergencyShortfall, emergencyExcess, surplusCash,
    isaHeadroom, isaUsedThisYear: isaUsedThisYearCalc,
    missedMatch, annualRepayment, willClear, crystallisable, cgtSaving, cgtRate,
    projectedPot, years, annualYieldGap, savingsRate, loanBal, tr,
    cashMoveAmount, cashExcessNotWorthMoving,
    cash, bonds, totalAssets, totalLiabilities, netWorth,
    taxBandLabel, adjustedNetIncome, bufferMonths,
    statePensionWeekly, statePensionAnnual, niYearsToFull,
    daysToFixExpiry, effectiveSavingsRate, salaryGrowthRate,
    propertyEquity, propertyValue, ltv,
    pensionStatus, personalLoanAnnualRepayment, personalLoanPayoffMonths,
    monthlySurplus,
  };
}
