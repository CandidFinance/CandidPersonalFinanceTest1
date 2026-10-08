import { taxFreeInterest } from "./tax.js";
import { allocateCash } from "./cashAllocation.js";
import { isEasyAccess, premiumBondsRow } from "./savingsRates.js";

// ── Cash waterfall optimiser: ISA → Personal Savings Allowance → Premium Bonds ──
// Single source of truth for "what could this cash + Premium Bonds pot earn if
// optimally allocated, vs what it earns today" — shared by the Cash & Savings
// module's "Optimise your cash" win and computeModuleStatuses below, so the
// Dashboard and the module page never show two different numbers for the same
// underlying opportunity. isaRatePct/nonIsaRatePct are percentage numbers (e.g.
// 5.1) or null/undefined, in which case the same pre-data-load fallbacks apply.
// rateRows (optional) is savings_rates itself: when given, each step spreads
// its money across real accounts by rate and balance cap (allocateCash), and
// the step's rate is what that money earns on average. isaLines/savingsLines
// list the accounts. Without it, each step uses the single rate as before.
// Premium Bonds' prize fund rate, their effective tax-free return: the live
// figure from the rate feed (NS&I's page) when rateRows has it, otherwise
// this fallback, NS&I's rate from the September 2026 draw.
export const PB_RATE = 0.0435;

const pctLabel = ratePct => `${ratePct.toFixed(2)}%`;

export function calcCashOptimisation(m, isaRatePct, nonIsaRatePct, rateRows = null) {
  const bondsVal = m.bonds || 0;
  // Interest that's tax-free: the PSA, plus any unused Personal Allowance and
  // starting rate for savings (tax.js taxFreeInterest).
  const psaLimit = taxFreeInterest(m.nonSavingsIncome ?? m.adjustedNetIncome, m.taxBandLabel);
  // 0.049/0.045 fallbacks only cover the brief window before savingsRates loads.
  let isaRateDecimal = isaRatePct != null ? +isaRatePct / 100 : 0.049;
  let isaRateDisplay = isaRatePct != null ? `${isaRatePct}%` : "4.9%";
  let nonIsaRateDecimal = nonIsaRatePct != null ? +nonIsaRatePct / 100 : 0.045;
  let nonIsaRateDisplay = nonIsaRatePct != null ? `${nonIsaRatePct}%` : "4.5%";
  const rows = Array.isArray(rateRows) ? rateRows : null;
  const pbRow = premiumBondsRow(rows);
  const pbRate = pbRow ? +pbRow.rate_aer / 100 : PB_RATE;

  const currentTaxableInterest = Math.round(m.cash * m.savingsRate / 100);
  const currentPbInterest = Math.round(bondsVal * pbRate);
  const currentGrossTotal = currentTaxableInterest + currentPbInterest;
  const currentTaxableAmount = Math.max(0, currentTaxableInterest - psaLimit);
  // Savings interest is taxed at its own rates (2 points over income tax from April 2027).
  const savingsTr = m.savingsTr ?? m.tr;
  const trPct = Math.round(savingsTr * 100);
  const currentTaxCost = Math.round(currentTaxableAmount * savingsTr);
  const currentAfterTaxTotal = currentTaxableInterest - currentTaxCost + currentPbInterest;

  // The full reallocation pot — cash (already outside any ISA) plus premium bonds.
  // Deliberately the WHOLE amount, not just the surplus above the buffer: ISAs and
  // Premium Bonds are both easy/near-instant access, so there's no liquidity reason
  // to exclude the buffer portion from this.
  const totalPot = m.cash + bondsVal;
  let step1Isa = Math.min(totalPot, m.cashIsaHeadroom ?? m.isaHeadroom);
  let step1IsaInterest = Math.round(step1Isa * isaRateDecimal);
  let isaLines = [];
  const isaAlloc = rows && allocateCash(step1Isa, rows.filter(r => r.is_isa === true));
  if (isaAlloc?.lines.length) {
    // Anything the ISA accounts can't take (only if every one is capped)
    // carries on to the next step rather than earning a rate it can't get.
    step1Isa = isaAlloc.allocated;
    step1IsaInterest = Math.round(isaAlloc.interest);
    isaRateDecimal = isaAlloc.blendedRatePct / 100;
    isaRateDisplay = pctLabel(isaAlloc.blendedRatePct);
    isaLines = isaAlloc.lines;
  }
  const afterStep1 = totalPot - step1Isa;
  // Only worth filling the PSA with ordinary savings if the best available non-ISA
  // rate actually beats the Premium Bonds average — otherwise the "tax-free"
  // comparison is a wash and Premium Bonds are simply better.
  let savingsWorthIt = nonIsaRateDecimal > pbRate;
  let step2Savings = savingsWorthIt ? Math.min(afterStep1, psaLimit / nonIsaRateDecimal) : 0;
  let step2SavingsInterest = Math.round(step2Savings * nonIsaRateDecimal);
  let savingsLines = [];
  const nonIsaRows = rows && rows.filter(r => r.is_isa === false);
  if (nonIsaRows?.length) {
    // Accounts beating Premium Bonds, filled until the interest reaches the
    // Personal Savings Allowance.
    const alloc = allocateCash(afterStep1, nonIsaRows, { minRatePct: pbRate * 100, maxInterest: psaLimit });
    // Real accounts to go on: use the answer even when it's "none beat
    // Premium Bonds" (or there's no allowance left to use).
    if (alloc.lines.length || nonIsaRows.some(isEasyAccess)) {
      savingsWorthIt = alloc.lines.length > 0;
      step2Savings = alloc.allocated;
      step2SavingsInterest = Math.round(alloc.interest);
      if (alloc.lines.length) {
        nonIsaRateDecimal = alloc.blendedRatePct / 100;
        nonIsaRateDisplay = pctLabel(alloc.blendedRatePct);
      }
      savingsLines = alloc.lines;
    }
  }
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
  const step3PbInterest = Math.round(step3Pb * pbRate);
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
    psaLimit, isaRateDecimal, isaRateDisplay, nonIsaRateDecimal, nonIsaRateDisplay, PB_RATE: pbRate,
    currentTaxableInterest, currentPbInterest, currentGrossTotal, currentTaxableAmount, trPct, currentTaxCost, currentAfterTaxTotal,
    totalPot, step1Isa, step1IsaInterest, afterStep1, savingsWorthIt, isaLines, savingsLines,
    step2Savings, step2SavingsInterest, step2CurrentInterest, step2Delta, afterStep2, discretionaryAmount,
    step3Pb, step3PbInterest, step3UpliftVsCurrent, beyondPbCap,
    optimisedTotal, keptAmount, todayBlendedRate, currentInterestOnKeptAmount, optimisationGain,
  };
}
