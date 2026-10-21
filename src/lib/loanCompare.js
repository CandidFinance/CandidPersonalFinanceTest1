// ── Where a lump sum does most, beside a student loan (subscribers) ─────────
// The same £ put into each place it could go, and what it comes to by the
// April the loan would otherwise end (cleared, or written off): one date for
// all, so the figures line up. Listed by £, largest first, each saying
// whether its gain is certain or rests on assumed growth. Information, not
// instruction: which suits them is theirs to weigh.
//
//  - The loan: paying it in now means smaller repayments later (or none
//    once it clears). Each year's repayment no longer due is kept in savings
//    at the module's savings rate until the end date, the same way
//    calcOverpaymentScenarios values payments. A loan heading for write-off
//    frees little, as most of what's paid would have been written off.
//  - Savings: the module's savings rate (sl.cashRate, the best Cash ISA rate
//    or their own if higher), tax-free like the interest a loan payment saves.
//  - A Stocks and Shares ISA: Candid's assumed growth, tax-free, not certain.
//  - A pension: tax relief added going in, at what it really saves them:
//    the tax on the top slice of their income that the payment covers, so
//    60% where it brings back the Personal Allowance (£100,000 to
//    £125,140), and 20% at least (relief at source). Then the same assumed
//    growth, a quarter taken tax-free and the rest taxed at their rate in
//    retirement: the rate on income they're on track for then
//    (crossModule.js pensionOutlook), 40% or 60% if that's where it lands,
//    and 20% at least. Not certain, and locked until the minimum pension age.
//  - A mortgage or personal loan: each £ paid off saves its rate, certain,
//    up to what's owed (anything over stays in savings). The mortgage is
//    taken to run past the end date; a personal loan only for the months it
//    has left, then savings.
// The mortgage: from the Mortgage module (hasMortgage), or asked here
// (slCompareMortgage), as that module is hidden for now and its answer read
// as "no" (moduleStatus.js sanitizeForMvp); its rate and balance in the
// module's own fields either way. Not asked yet, or without a rate, it comes
// back as a row to ask about (`ask`), not a figure.
import { GROWTH_NOMINAL_PCT } from "./growth.js";
import { calcIncomeTax } from "./tax.js";
import { pensionOutlook } from "./crossModule.js";

export const PENSION_TAX_FREE_SHARE = 0.25;
export const PENSION_MIN_TAX_RATE = 0.2;

// What paying `net` from their own money into a pension puts in, gross:
// the relief is the tax that gross amount takes off their income, found by
// trying the gross until the two agree. A share of the gross.
export function pensionRelief(income, net, scottish = false) {
  let gross = net / (1 - PENSION_MIN_TAX_RATE), rate = PENSION_MIN_TAX_RATE;
  for (let i = 0; i < 20; i++) {
    rate = Math.max(PENSION_MIN_TAX_RATE, (calcIncomeTax(income, scottish) - calcIncomeTax(income - gross, scottish)) / gross);
    gross = net / (1 - rate);
  }
  return { gross, rate };
}
// Tax on the next £1,000 of income at `income` a year: the rate a pension
// drawn on top of it pays, 60% included. 20% at least.
export function drawnTaxRate(income, scottish = false) {
  return Math.max(PENSION_MIN_TAX_RATE, (calcIncomeTax(income + 1000, scottish) - calcIncomeTax(income, scottish)) / 1000);
}
const grow = (amount, pct, years) => amount * Math.pow(1 + pct / 100, Math.max(0, years));

// The loan's repayment each year from now, after a lump sum of `extra`.
function repayments(m, sl, extra) {
  let bal = Math.max(0, m.loanBal - extra);
  const out = [];
  for (let yr = 1; yr <= sl.writeOffYr && bal > 0; yr++) {
    const { rate = sl.slInterestRate, repayment = sl.annualRep } = sl.schedule?.[yr - 1] || {};
    bal *= 1 + rate;
    const paid = Math.min(repayment, bal);
    bal -= paid;
    out.push(paid);
  }
  return out;
}

// A debt paid down: its rate on what's owed, for `years` (or to the end
// date), then savings; anything over what's owed stays in savings.
function debtRow(amount, owed, ratePct, years, endYears, cashPct) {
  const into = owed > 0 ? Math.min(amount, owed) : amount;
  const held = Math.min(years, endYears);
  return grow(grow(into, ratePct, held), cashPct, endYears - held) + grow(amount - into, cashPct, endYears);
}

export function loanComparison(d, m, sl, amount) {
  const years = sl.willClear ? sl.clearYr : sl.writeOffYr;
  if (!(amount > 0) || !(years > 0) || !(m.loanBal > 0)) return null;
  const cash = sl.cashRate || 0;
  const taxYear = sl.writeOffTaxYear - sl.writeOffYr;
  const into = Math.min(amount, m.loanBal);
  const base = repayments(m, sl, 0), after = repayments(m, sl, into);
  const freed = base.reduce((t, paid, i) => t + (paid - (after[i] || 0)) * Math.pow(1 + cash / 100, years - (i + 1)), 0);
  const scottish = d.scottishTaxpayer === "yes";
  const relief = pensionRelief(m.adjustedNetIncome || m.salary || 0, amount, scottish);
  const outlook = pensionOutlook(d, m);
  const laterRate = drawnTaxRate(outlook?.retirementIncome || 0, scottish);
  const rows = [
    { key: "loan", value: freed + grow(amount - into, cash, years), certain: true },
    { key: "savings", value: grow(amount, cash, years), certain: true, ratePct: cash },
    { key: "isa", value: grow(amount, GROWTH_NOMINAL_PCT, years), certain: false, ratePct: GROWTH_NOMINAL_PCT },
    { key: "pension", value: grow(relief.gross, GROWTH_NOMINAL_PCT, years) * (1 - (1 - PENSION_TAX_FREE_SHARE) * laterRate),
      certain: false, ratePct: GROWTH_NOMINAL_PCT, reliefPct: Math.round(relief.rate * 100), laterPct: Math.round(laterRate * 100) },
  ];
  const mortgage = d.hasMortgage === "yes" || d.slCompareMortgage === "yes";
  if (mortgage && +d.mortgageRate > 0) {
    rows.push({ key: "mortgage", value: debtRow(amount, +d.mortgageBalance || 0, +d.mortgageRate, years, years, cash), certain: true, ratePct: +d.mortgageRate });
  }
  if (d.hasPersonalLoan === "yes" && +d.personalLoanRate > 0) {
    const months = +d.personalLoanTermRemaining || 0;
    rows.push({ key: "personalLoan", value: debtRow(amount, +d.personalLoanBalance || 0, +d.personalLoanRate, months > 0 ? months / 12 : years, years, cash), certain: true, ratePct: +d.personalLoanRate });
  }
  const ranked = rows.map(r => ({ ...r, value: Math.round(r.value) })).sort((a, b) => b.value - a.value);
  const ask = d.slCompareMortgage !== "no" && !(mortgage && +d.mortgageRate > 0) ? [{ key: "mortgage", ask: true }] : [];
  return { amount, years, byTaxYear: taxYear + years, cleared: sl.willClear, rows: [...ranked, ...ask] };
}
