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
// Plan 5: rate = RPI directly (no ramp) — set 1 September each year.
// Plan 1: lower of RPI or Bank of England base rate + 1%, set 1 September
// each year.
// All three checked 3 Oct 2026 against https://www.gov.uk/repaying-your-student-loan/what-you-pay,
// which carries the 1 Sept 2026 – 31 Aug 2027 rates (Plan 1/5: 4.1%; Plan 2:
// 4.1% plus up to 3%, capped at 6%). The per-plan "How interest is
// calculated" guidance pages lagged behind and still showed 2025/26 rates.
// Plan 4 and the Postgraduate Loan aren't offered in the app's onboarding;
// they're here so the public student loan calculator reads the same figures.
export const PLAN2_RPI_BASE = 0.041; // 2026/27 RPI
export const PLAN2_INCOME_LOWER = 29385, PLAN2_INCOME_UPPER = 52885;
export const PLAN2_MAX_VARIABLE = 0.03; // percentage points added by the time income reaches PLAN2_INCOME_UPPER, before capping
export const PLAN2_RATE_CAP = 0.06;
export const PLAN5_RATE = 0.041; // = 2026/27 RPI, same figure as Plan 2's base
export const PLAN1_RATE = 0.041; // 1 Sept 2026 – 31 Aug 2027: RPI, as RPI is below base rate + 1%
export const PLAN4_RATE = 0.041; // same rule as Plan 1
export const POSTGRAD_RATE = 0.06; // RPI + 3% = 7.1%, capped at 6% for 2026/27
// The same 6% a year the pension projections assume (pension.js) — duplicated
// rather than imported, since pension.js → metrics.js → this file would make
// the import circular. Keep in sync.
const PENSION_GROWTH_PCT = 6;

export function resolveSlRate(d, grossSalary) {
  if (+d.studentLoanRate > 0) return +d.studentLoanRate / 100;
  if (d.studentLoan === "plan2") {
    if (grossSalary <= PLAN2_INCOME_LOWER) return PLAN2_RPI_BASE;
    const frac = Math.min(1, (grossSalary - PLAN2_INCOME_LOWER) / (PLAN2_INCOME_UPPER - PLAN2_INCOME_LOWER));
    return Math.min(PLAN2_RPI_BASE + frac * PLAN2_MAX_VARIABLE, PLAN2_RATE_CAP);
  }
  if (d.studentLoan === "plan5") return PLAN5_RATE;
  if (d.studentLoan === "plan4") return PLAN4_RATE;
  if (d.studentLoan === "postgrad") return POSTGRAD_RATE;
  return PLAN1_RATE; // plan1
}

// ── Repayment thresholds (2026/27) — the repayment rate below applies to
// gross pay above these. The ONLY place these figures live: every repayment,
// forecast and bonus calculation, and the public calculator pages, read them
// from here. They change most Aprils — check
// https://www.gov.uk/repaying-your-student-loan/what-you-pay each tax year.
export const SL_REPAYMENT_THRESHOLDS = { plan1: 26900, plan2: 29385, plan4: 33795, plan5: 25000, postgrad: 21000 };
export const SL_REPAYMENT_RATES = { plan1: 0.09, plan2: 0.09, plan4: 0.09, plan5: 0.09, postgrad: 0.06 };
export const SL_WRITE_OFF_YEARS = { plan1: 25, plan2: 30, plan4: 30, plan5: 40, postgrad: 30 };

// Threshold for a plan, or 0 for no loan / an unrecognised plan.
export function slRepaymentThreshold(studentLoanType) {
  return SL_REPAYMENT_THRESHOLDS[studentLoanType] ?? 0;
}

// ── Student loan plan constants — single source for write-off year + repayment
// threshold, previously duplicated independently in getModuleInsights,
// getModuleProducts, and the marginal-return chart memo.
export function studentLoanPlanConstants(studentLoanType) {
  const writeOffYr = SL_WRITE_OFF_YEARS[studentLoanType] ?? SL_WRITE_OFF_YEARS.plan1;
  const threshold = SL_REPAYMENT_THRESHOLDS[studentLoanType] ?? SL_REPAYMENT_THRESHOLDS.plan1;
  const repayRate = SL_REPAYMENT_RATES[studentLoanType] ?? SL_REPAYMENT_RATES.plan1;
  return { writeOffYr, threshold, repayRate };
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

  // Overpaying a loan that will clear anyway earns its interest rate,
  // guaranteed, until the date it would have cleared. It's weighed against:
  //  - Savings: the best rate available (m.bestSavingsRate — the live best
  //    Cash ISA rate, tax-free like the interest overpaying saves), or the
  //    user's own rate if that's higher. Not their own rate alone: Cash &
  //    savings already counts the gain from moving to a better account, so a
  //    poor current rate would count that gain twice.
  //  - Pension: tax relief doesn't decide it. £1 paid into a pension now gets
  //    relief now; overpay instead and the loan clears sooner, freeing up money
  //    that gets the same relief when it goes into the pension then. With the
  //    same tax rate either way the relief cancels out, leaving the pension's
  //    assumed growth against the loan's rate. A tie goes to overpaying — its
  //    return is guaranteed, the pension's isn't.
  const cashRate = Math.round(Math.max(m.bestSavingsRate ?? 0, m.effectiveSavingsRate || 0) * 100) / 100;
  const effectiveBenefit = Math.round((slInterestRate*100 - cashRate) * 10) / 10; // % — overpaying vs the best savings rate
  const pensionGap = Math.round((slRatePct - PENSION_GROWTH_PCT) * 10) / 10; // % — overpaying vs the pension's growth
  const beatsPension = pensionGap >= 0;
  const worthOverpaying = willClear && effectiveBenefit > 0 && beatsPension;
  // A genuine £/yr figure: the rate differential applied to the current balance
  // — same shape as Cash's annualYieldGap (rate gap × principal) — rather than a
  // one-off lump sum, so it stays comparable to every other module's £/yr amount.
  const overpayAnnualBenefit = worthOverpaying ? Math.round(m.loanBal * effectiveBenefit / 100) : 0;

  return {
    writeOffYr, threshold, slInterestRate, slRatePct, annualInterest, annualRep,
    belowThreshold, netAnnualChange, balanceGrowing, inflectionSalary, salaryGapToInflection,
    clearYr, writeOffBal: Math.round(writeOffBal), willClear, totalRepaidProjected,
    cashRate, effectiveBenefit, pensionGrowthPct: PENSION_GROWTH_PCT, pensionGap, beatsPension,
    worthOverpaying, overpayAnnualBenefit,
  };
}

// One-line verdict on overpaying vs the pension, like for like (see
// calcStudentLoanScenario for why tax relief cancels out) — shared by the
// desktop and mobile deep dives' repay-vs-pension charts.
export function describeLoanVsPension(sl) {
  const { slRatePct: loan, pensionGrowthPct: pension, pensionGap } = sl;
  if (pensionGap > 0) return `This loan's ${loan}% beats the ${pension}% a year your pension is assumed to grow — and overpaying's return is guaranteed.`;
  if (pensionGap === 0) return `Level: this loan's ${loan}% matches the ${pension}% a year your pension is assumed to grow. Overpaying's return is guaranteed; the pension's isn't.`;
  return `Your pension is assumed to grow ${pension}% a year — faster than this loan's ${loan}%, so it beats overpaying.`;
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
