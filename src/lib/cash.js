// ── Cash waterfall optimiser: ISA → Personal Savings Allowance → Premium Bonds ──
// Single source of truth for "what could this cash + Premium Bonds pot earn if
// optimally allocated, vs what it earns today" — shared by the Cash & Savings
// module's "Optimise your cash" win and computeModuleStatuses below, so the
// Dashboard and the module page never show two different numbers for the same
// underlying opportunity. isaRatePct/nonIsaRatePct are percentage numbers (e.g.
// 5.1) or null/undefined, in which case the same pre-data-load fallbacks apply.
export function calcCashOptimisation(m, isaRatePct, nonIsaRatePct) {
  const bondsVal = m.bonds || 0;
  const psaLimit = m.taxBandLabel === "basic" ? 1000 : m.taxBandLabel === "higher" ? 500 : 0;
  // 0.049/0.045 fallbacks only cover the brief window before savingsRates loads.
  const isaRateDecimal = isaRatePct != null ? +isaRatePct / 100 : 0.049;
  const isaRateDisplay = isaRatePct != null ? `${isaRatePct}%` : "4.9%";
  const nonIsaRateDecimal = nonIsaRatePct != null ? +nonIsaRatePct / 100 : 0.045;
  const nonIsaRateDisplay = nonIsaRatePct != null ? `${nonIsaRatePct}%` : "4.5%";
  // NS&I's long-run prize-fund average — the same figure used everywhere else in
  // this file for Premium Bonds' effective tax-free return.
  const PB_RATE = 0.044;

  const currentTaxableInterest = Math.round(m.cash * m.savingsRate / 100);
  const currentPbInterest = Math.round(bondsVal * PB_RATE);
  const currentGrossTotal = currentTaxableInterest + currentPbInterest;
  const currentTaxableAmount = Math.max(0, currentTaxableInterest - psaLimit);
  const trPct = Math.round(m.tr * 100);
  const currentTaxCost = Math.round(currentTaxableAmount * m.tr);
  const currentAfterTaxTotal = currentTaxableInterest - currentTaxCost + currentPbInterest;

  // The full reallocation pot — cash (already outside any ISA) plus premium bonds.
  // Deliberately the WHOLE amount, not just the surplus above the buffer: ISAs and
  // Premium Bonds are both easy/near-instant access, so there's no liquidity reason
  // to exclude the buffer portion from this.
  const totalPot = m.cash + bondsVal;
  const step1Isa = Math.min(totalPot, m.isaHeadroom);
  const step1IsaInterest = Math.round(step1Isa * isaRateDecimal);
  const afterStep1 = totalPot - step1Isa;
  // Only worth filling the PSA with ordinary savings if the best available non-ISA
  // rate actually beats the Premium Bonds average — otherwise the "tax-free"
  // comparison is a wash and Premium Bonds are simply better.
  const savingsWorthIt = nonIsaRateDecimal > PB_RATE;
  const step2Savings = savingsWorthIt ? Math.min(afterStep1, psaLimit / nonIsaRateDecimal) : 0;
  const step2SavingsInterest = Math.round(step2Savings * nonIsaRateDecimal);
  // What this same slice of money already earns today, at the person's actual
  // current blended rate — so the step shows the genuine incremental benefit
  // of moving it to the best rate, not the full interest as if starting from
  // zero (which double-counts money they're already earning).
  const step2CurrentInterest = Math.round(step2Savings * m.savingsRate / 100);
  const step2Delta = step2SavingsInterest - step2CurrentInterest;
  const afterStep2 = afterStep1 - step2Savings;
  // Once the ISA and PSA are filled, what's left is a genuine choice (Step 3 vs
  // Step 4) rather than something this function should silently decide.
  const discretionaryAmount = afterStep2;
  const step3Pb = Math.min(discretionaryAmount, 50000); // £50,000 is a hard NS&I product limit, not a preference
  const step3PbInterest = Math.round(step3Pb * PB_RATE);
  const step3UpliftVsCurrent = step3PbInterest - Math.round(step3Pb * m.savingsRate / 100);
  const beyondPbCap = Math.max(0, discretionaryAmount - step3Pb); // only nonzero above the £50,000 cap

  // "Optimised interest income" and the top-line gain default to the cash-safe path
  // (Step 3) — the same-unit, guaranteed comparison. Step 4's long-term illustration
  // is a separate, non-guaranteed figure and isn't folded into this £/yr total.
  const optimisedTotal = step1IsaInterest + step2SavingsInterest + step3PbInterest;
  const keptAmount = step1Isa + step2Savings + step3Pb;
  const todayBlendedRate = totalPot > 0 ? (currentTaxableInterest + currentPbInterest) / totalPot : 0;
  const currentInterestOnKeptAmount = Math.round(keptAmount * todayBlendedRate);
  const optimisationGain = optimisedTotal - currentInterestOnKeptAmount;

  return {
    psaLimit, isaRateDecimal, isaRateDisplay, nonIsaRateDecimal, nonIsaRateDisplay, PB_RATE,
    currentTaxableInterest, currentPbInterest, currentGrossTotal, currentTaxableAmount, trPct, currentTaxCost, currentAfterTaxTotal,
    totalPot, step1Isa, step1IsaInterest, afterStep1, savingsWorthIt,
    step2Savings, step2SavingsInterest, step2CurrentInterest, step2Delta, afterStep2, discretionaryAmount,
    step3Pb, step3PbInterest, step3UpliftVsCurrent, beyondPbCap,
    optimisedTotal, keptAmount, todayBlendedRate, currentInterestOnKeptAmount, optimisationGain,
  };
}
