// Resolves the effective student loan interest rate for a given user.
// Uses d.studentLoanRate (user-entered, %) if supplied, otherwise falls back to
// statutory defaults below. Update these each September when SLC publishes
// that academic year's rates — see gov.uk's "How interest is calculated"
// guidance for each plan.
//
// Plan 2 (2026/27): rate = RPI, ramped LINEARLY up by up to 3 percentage
// points between the lower and upper income thresholds, capped at 6.0% —
// per gov.uk's "How interest is calculated - Plan 2". The linear ramp
// mathematically reaches the 6.0% cap at salary ≈ £44,268, then Math.min
// holds it flat at 6.0% for every salary above that (rather than a separate
// branch) — same numeric result, one less special case.
// Plan 5: rate = RPI directly (no ramp) — set 1 September each year. Using
// the same 2026/27 RPI figure as Plan 2 since gov.uk hasn't published a
// separate reference for Plan 5; confirm they match if this matters.
// Plan 1: lower of RPI or Bank of England base rate + 1%, set 1 September
// each year — see gov.uk's "How interest is calculated - Plan 1". Value
// below is the last one that page had published (1 Sept 2025 – 31 Aug 2026)
// as of this update; re-check it once SLC publishes the 2026/27 Plan 1 rate,
// since this app's "today" is already past that 1 September reset date.
const PLAN2_RPI_BASE = 0.041; // 2026/27 RPI
const PLAN2_INCOME_LOWER = 29385, PLAN2_INCOME_UPPER = 52885;
const PLAN2_MAX_VARIABLE = 0.03; // percentage points added by the time income reaches PLAN2_INCOME_UPPER, before capping
const PLAN2_RATE_CAP = 0.06;
const PLAN5_RATE = 0.041; // = 2026/27 RPI, same figure as Plan 2's base
const PLAN1_RATE = 0.032; // last published: 1 Sept 2025 – 31 Aug 2026 — verify against https://www.gov.uk/guidance/how-interest-is-calculated-plan-1

export function resolveSlRate(d, grossSalary) {
  if (+d.studentLoanRate > 0) return +d.studentLoanRate / 100;
  if (d.studentLoan === "plan2") {
    if (grossSalary <= PLAN2_INCOME_LOWER) return PLAN2_RPI_BASE;
    const frac = (grossSalary - PLAN2_INCOME_LOWER) / (PLAN2_INCOME_UPPER - PLAN2_INCOME_LOWER);
    return Math.min(PLAN2_RPI_BASE + frac * PLAN2_MAX_VARIABLE, PLAN2_RATE_CAP);
  }
  if (d.studentLoan === "plan5") return PLAN5_RATE;
  return PLAN1_RATE; // plan1
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

// ── Overpayment scenario cards — "what would repaying £5k/£10k/£20k today
// do to your clear date/write-off balance" — ported from desktop's
// ModuleDeepDive local projectLoan()/scenarios (CandidApp.jsx), the only
// place this currently lives, so the mobile deep dive can share it. Uses its
// own simple year-stepping projection (matching calcStudentLoanScenario's
// loop above) rather than lib/forecast.js's simulateLoan — forecast.js
// already imports resolveSlRate from this file, so importing simulateLoan
// back here would create a lib-to-lib circular import.
export function calcOverpaymentScenarios(m, sl, amounts = [5000, 10000, 20000]) {
  const { writeOffYr, slInterestRate, annualRep, balanceGrowing } = sl;
  function projectLoan(extraOneOff) {
    let bal = Math.max(0, m.loanBal - extraOneOff);
    let totalPaid = extraOneOff;
    let clearYr = null;
    let writeOffBal = 0;
    for (let yr = 1; yr <= writeOffYr; yr++) {
      bal = bal * (1 + slInterestRate);
      // Cap the final year's repayment at what's actually left to clear — see
      // calcStudentLoanScenario above for why this matters.
      const payment = Math.min(annualRep, bal);
      bal -= payment;
      totalPaid += payment;
      if (bal <= 0 && !clearYr) { clearYr = yr; break; }
      if (yr === writeOffYr) { writeOffBal = Math.max(0, bal); }
    }
    const newInterestYr1 = Math.round(Math.max(0, m.loanBal - extraOneOff) * slInterestRate);
    const newNetChange = newInterestYr1 - annualRep;
    const crossesInflection = !clearYr && newNetChange <= 0 && balanceGrowing;
    return { clearYr, writeOffBal: Math.round(writeOffBal), totalPaid: Math.round(totalPaid), newNetChange, crossesInflection };
  }
  const overpayAmounts = amounts.filter(x => x > 0 && x <= m.loanBal);
  const scenarios = overpayAmounts.map(amt => ({ amt, ...projectLoan(amt) }));
  const baseProjection = projectLoan(0);
  return { scenarios, baseProjection };
}
