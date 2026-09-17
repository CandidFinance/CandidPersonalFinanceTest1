// Resolves the effective student loan interest rate for a given user.
// Uses d.studentLoanRate (user-entered, %) if supplied, otherwise falls back to
// statutory defaults. Update defaults each September when SLC publishes annual rates.
// Plan 2: RPI to RPI+3%, ramped LINEARLY between two income thresholds (per
// gov.uk's "How interest is calculated - Plan 2") — not a single cliff. Was
// previously a step function (>£49,130 ? 6.1% : 3.1%), which both used the
// wrong mechanism and an income figure that didn't correspond to either real
// threshold. PLAN2_RATE_LOWER/_UPPER below are the current published values.
// Plan 5: Prevailing market rate (2024/25: 7.3%)
// Plan 1: Lower of RPI or BoE base+1% (2024/25 floor: 6.25%)
const PLAN2_INCOME_LOWER = 29385, PLAN2_INCOME_UPPER = 52885;
const PLAN2_RATE_LOWER = 0.032, PLAN2_RATE_UPPER = 0.062;

export function resolveSlRate(d, grossSalary) {
  if (+d.studentLoanRate > 0) return +d.studentLoanRate / 100;
  if (d.studentLoan === "plan2") {
    if (grossSalary <= PLAN2_INCOME_LOWER) return PLAN2_RATE_LOWER;
    if (grossSalary >= PLAN2_INCOME_UPPER) return PLAN2_RATE_UPPER;
    const frac = (grossSalary - PLAN2_INCOME_LOWER) / (PLAN2_INCOME_UPPER - PLAN2_INCOME_LOWER);
    return PLAN2_RATE_LOWER + frac * (PLAN2_RATE_UPPER - PLAN2_RATE_LOWER);
  }
  if (d.studentLoan === "plan5") return 0.073;
  return 0.0625; // plan1 fallback
}

// ── Student loan plan constants — single source for write-off year + repayment
// threshold, previously duplicated independently in getModuleInsights,
// getModuleProducts, and the marginal-return chart memo.
export function studentLoanPlanConstants(studentLoanType) {
  const writeOffYr = studentLoanType==="plan2" ? 30 : studentLoanType==="plan5" ? 40 : 25;
  const threshold = studentLoanType==="plan2" ? 27295 : studentLoanType==="plan5" ? 25000 : 24990;
  return { writeOffYr, threshold };
}

// ── Student loan core scenario — single source of truth for "is this loan
// growing, will it clear before write-off, and is overpaying actually worth
// it" — shared by computeModuleStatuses (Dashboard figure) and the module's
// own Win/info tile, so the two can't disagree (same pattern as
// calcCashOptimisation).
export function calcStudentLoanScenario(d, m) {
  const { writeOffYr, threshold } = studentLoanPlanConstants(d.studentLoan);
  const slInterestRate = resolveSlRate(d, m.salary);
  const slRatePct = Math.round(slInterestRate * 1000) / 10;
  const annualInterest = Math.round(m.loanBal * slInterestRate);
  const annualRep = m.annualRepayment;
  const belowThreshold = d.studentLoan !== "none" && annualRep === 0;
  const netAnnualChange = annualInterest - annualRep; // positive = balance GROWING
  const balanceGrowing = netAnnualChange > 0;
  // Inflection point: salary at which repayments equal interest accrual
  const inflectionSalary = Math.round(threshold + (m.loanBal * slInterestRate) / 0.09);
  const salaryGapToInflection = Math.max(0, inflectionSalary - m.salary);

  let projBal = m.loanBal, writeOffBal = 0, clearYr = null, totalRepaidProjected = 0;
  for (let yr = 1; yr <= writeOffYr; yr++) {
    projBal = projBal * (1 + slInterestRate);
    // Cap the final year's repayment at what's actually left to clear — otherwise
    // a loan that pays off partway through its final year books a full year's
    // repayment against a balance that no longer exists, overstating total repaid.
    const payment = Math.min(annualRep, projBal);
    projBal -= payment;
    totalRepaidProjected += payment;
    if (projBal <= 0 && !clearYr) { clearYr = yr; break; }
    if (yr === writeOffYr) writeOffBal = Math.max(0, projBal);
  }
  const willClear = clearYr !== null;
  totalRepaidProjected = Math.round(totalRepaidProjected);

  const cashRate = +d.savingsRate || 4.2;
  const effectiveBenefit = Math.round((slInterestRate*100 - cashRate) * 10) / 10; // % — overpaying vs holding cash
  // A genuine £/yr figure: the rate differential applied to the current balance
  // — same shape as Cash's annualYieldGap (rate gap × principal) — rather than a
  // one-off lump sum, so it stays comparable to every other module's £/yr amount.
  const overpayAnnualBenefit = (willClear && effectiveBenefit > 0) ? Math.round(m.loanBal * effectiveBenefit / 100) : 0;

  return {
    writeOffYr, threshold, slInterestRate, slRatePct, annualInterest, annualRep,
    belowThreshold, netAnnualChange, balanceGrowing, inflectionSalary, salaryGapToInflection,
    clearYr, writeOffBal: Math.round(writeOffBal), willClear, totalRepaidProjected,
    cashRate, effectiveBenefit, overpayAnnualBenefit,
  };
}
