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
import { projectPlan } from "./loanPlan.js";

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

// A debt paid down: its rate on what's owed (null: not known, so all of
// it), for `years` (or to the end date), then savings; anything over what's
// owed stays in savings.
function debtRow(amount, owed, ratePct, years, endYears, cashPct) {
  const into = owed == null ? amount : Math.min(amount, Math.max(0, owed));
  const held = Math.max(0, Math.min(years, endYears));
  return grow(grow(into, ratePct, held), cashPct, endYears - held) + grow(amount - into, cashPct, endYears);
}

// `paid`: a lump sum today (a number), or a plan's payments as they were
// made ([{ at, amount }], loanPlan.js planEvents, `at` years from now).
// Every place gets the same payments on the same dates, each grown to the
// end date. The loan's own row: its repayments no longer due, kept in
// savings, plus anything paid in beyond what was owed.
export function loanComparison(d, m, sl, paid) {
  const years = sl.willClear ? sl.clearYr : sl.writeOffYr;
  const events = (typeof paid === "number" ? [{ at: 0, amount: paid }] : paid || []).filter(e => e.amount > 0 && e.at <= years);
  const amount = events.reduce((t, e) => t + e.amount, 0);
  if (!(amount > 0) || !(years > 0) || !(m.loanBal > 0)) return null;
  const cash = sl.cashRate || 0;
  const taxYear = sl.writeOffTaxYear - sl.writeOffYr;
  const extras = [];
  events.forEach(e => { extras[e.at] = (extras[e.at] || 0) + e.amount; });
  const base = projectPlan(m, sl, []), after = projectPlan(m, sl, extras);
  const freed = base.repayments.reduce((t, p, i) => t + (p - (after.repayments[i] || 0)) * Math.pow(1 + cash / 100, years - (i + 1)), 0);
  const over = events.reduce((t, e) => t + grow(e.amount, cash, years - e.at), 0) - after.absorbed.reduce((t, a, k) => t + grow(a, cash, years - k), 0);
  const each = fn => events.reduce((t, e) => t + fn(e), 0);
  const scottish = d.scottishTaxpayer === "yes";
  const income = m.adjustedNetIncome || m.salary || 0;
  const outlook = pensionOutlook(d, m);
  const laterRate = drawnTaxRate(outlook?.retirementIncome || 0, scottish);
  const reliefs = events.map(e => pensionRelief(income, e.amount, scottish));
  const gross = reliefs.reduce((t, r) => t + r.gross, 0);
  const rows = [
    { key: "loan", value: freed + Math.max(0, over), certain: true },
    { key: "savings", value: each(e => grow(e.amount, cash, years - e.at)), certain: true, ratePct: cash },
    { key: "isa", value: each(e => grow(e.amount, GROWTH_NOMINAL_PCT, years - e.at)), certain: false, ratePct: GROWTH_NOMINAL_PCT },
    { key: "pension", value: events.reduce((t, e, i) => t + grow(reliefs[i].gross, GROWTH_NOMINAL_PCT, years - e.at), 0) * (1 - (1 - PENSION_TAX_FREE_SHARE) * laterRate),
      certain: false, ratePct: GROWTH_NOMINAL_PCT, reliefPct: Math.round((1 - amount / gross) * 100), laterPct: Math.round(laterRate * 100) },
  ];
  // A debt: each payment on what's still owed after the ones before it.
  const debt = (owed, ratePct, termYears) => {
    let left = owed;
    return each(e => {
      const v = debtRow(e.amount, owed > 0 ? left : null, ratePct, termYears - e.at, years - e.at, cash);
      left -= e.amount;
      return v;
    });
  };
  const mortgage = d.hasMortgage === "yes" || d.slCompareMortgage === "yes";
  if (mortgage && +d.mortgageRate > 0) {
    rows.push({ key: "mortgage", value: debt(+d.mortgageBalance || 0, +d.mortgageRate, years), certain: true, ratePct: +d.mortgageRate });
  }
  if (d.hasPersonalLoan === "yes" && +d.personalLoanRate > 0) {
    const months = +d.personalLoanTermRemaining || 0;
    rows.push({ key: "personalLoan", value: debt(+d.personalLoanBalance || 0, +d.personalLoanRate, months > 0 ? months / 12 : years), certain: true, ratePct: +d.personalLoanRate });
  }
  const ranked = rows.map(r => ({ ...r, value: Math.round(r.value) })).sort((a, b) => b.value - a.value);
  const ask = d.slCompareMortgage !== "no" && !(mortgage && +d.mortgageRate > 0) ? [{ key: "mortgage", ask: true }] : [];
  return { amount: Math.round(amount), years, byTaxYear: taxYear + years, cleared: sl.willClear, rows: [...ranked, ...ask] };
}
