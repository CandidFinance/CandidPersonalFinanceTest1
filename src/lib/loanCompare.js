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
//    Up to the £20,000 allowance each tax year (this year's after what's
//    gone in already); the rest stays in savings.
//  - A pension: tax relief added going in, at what it really saves them:
//    the tax on the top slice of their income that the payment covers, so
//    60% where it brings back the Personal Allowance (£100,000 to
//    £125,140), and 20% at least (relief at source). Then the same assumed
//    growth, a quarter taken tax-free and the rest taxed at their rate in
//    retirement: the rate on income they're on track for then
//    (crossModule.js pensionOutlook), 40% or 60% if that's where it lands,
//    and 20% at least. Not certain, and locked until the minimum pension age.
//    Only as much as gets relief goes in: the annual allowance room left
//    each tax year (this year's after top-ups), and no more than their
//    earnings (£3,600 gross without any). The rest stays in savings.
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
import { calcIncomeTax, ISA_ALLOWANCE } from "./tax.js";
import { pensionOutlook } from "./crossModule.js";
import { projectPlan } from "./loanPlan.js";
import { isaUsedThisYear } from "./isa.js";
import { calcAnnualAllowanceRoomBeforeTopUps } from "./pension.js";
import { allowanceLeft } from "./taxTrap.js";

export const PENSION_TAX_FREE_SHARE = 0.25;
export const PENSION_MIN_TAX_RATE = 0.2;
// The most anyone gets relief on a year without earnings, gross.
const PENSION_RELIEF_FLOOR = 3600;

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
// made ([{ t, amount }], loanPlan.js planEvents, `t` years from now).
// Every place gets the same payments on the same dates, each grown to the
// end date. The loan's own row: its repayments no longer due, kept in
// savings, plus anything paid in beyond what was owed.
export function loanComparison(d, m, sl, paid) {
  const years = sl.willClear ? sl.clearYr : sl.writeOffYr;
  const events = (typeof paid === "number" ? [{ t: 0, amount: paid }] : paid || []).filter(e => e.amount > 0 && e.t <= years);
  const amount = events.reduce((t, e) => t + e.amount, 0);
  if (!(amount > 0) || !(years > 0) || !(m.loanBal > 0)) return null;
  const cash = sl.cashRate || 0;
  const taxYear = sl.writeOffTaxYear - sl.writeOffYr;
  const base = projectPlan(m, sl, []), after = projectPlan(m, sl, events);
  const freed = base.repayments.reduce((t, p, i) => t + (p - (after.repayments[i] || 0)) * Math.pow(1 + cash / 100, years - (i + 1)), 0);
  // The same repayments as they'd be paid, not grown: what went into the
  // loan (principal) and the interest on it they'd have covered, for the
  // row to say what its £ is made of.
  const freedPaid = base.repayments.reduce((t, p, i) => t + p - (after.repayments[i] || 0), 0);
  const principal = after.paidIn;
  const over = events.reduce((t, e) => t + grow(e.amount, cash, years - e.t), 0) - after.paid.reduce((t, p) => t + grow(p.amount, cash, years - p.t), 0);
  const each = fn => events.reduce((t, e, i) => t + fn(e, i), 0);
  const scottish = d.scottishTaxpayer === "yes";
  const income = m.adjustedNetIncome || m.salary || 0;
  const outlook = pensionOutlook(d, m);
  const laterRate = drawnTaxRate(outlook?.retirementIncome || 0, scottish);
  // Each tax year's limits (a payment's year: whole years from now). This
  // year: the ISA allowance after what's gone in, and the annual allowance
  // room after top-ups; later years in full. Relief also only on up to
  // their earnings (£3,600 gross without any).
  const isaLeft = {}, reliefLeft = {};
  const aaLater = calcAnnualAllowanceRoomBeforeTopUps(d, m).room;
  const earnings = Math.max(PENSION_RELIEF_FLOOR, m.salary || 0);
  const isaPart = [], pensionPart = [];
  for (const e of events) {
    const y = Math.floor(e.t);
    isaLeft[y] ??= Math.max(0, ISA_ALLOWANCE - (y === 0 ? isaUsedThisYear(d) : 0));
    reliefLeft[y] ??= Math.min(earnings, y === 0 ? allowanceLeft(d, m) : aaLater);
    const isa = Math.min(e.amount, isaLeft[y]);
    isaLeft[y] -= isa;
    isaPart.push(isa);
    // The most that fits, net: what `cap` gross costs them after relief.
    const cap = reliefLeft[y];
    const full = pensionRelief(income, e.amount, scottish);
    const fits = full.gross <= cap ? { net: e.amount, gross: full.gross }
      : cap > 0 ? { net: cap * (1 - Math.max(PENSION_MIN_TAX_RATE, (calcIncomeTax(income, scottish) - calcIncomeTax(income - cap, scottish)) / cap)), gross: cap }
      : { net: 0, gross: 0 };
    reliefLeft[y] -= fits.gross;
    pensionPart.push(fits);
  }
  const net = pensionPart.reduce((t, p) => t + p.net, 0);
  const gross = pensionPart.reduce((t, p) => t + p.gross, 0);
  // What doesn't fit stays in savings, from the day it's paid.
  const rest = parts => each((e, i) => grow(e.amount - parts[i], cash, years - e.t));
  const isaOver = amount - isaPart.reduce((t, a) => t + a, 0);
  const pensionOver = amount - net;
  const rows = [
    { key: "loan", value: freed + Math.max(0, over), certain: true, freedPaid: Math.round(freedPaid), principal: Math.round(principal), interest: Math.round(freedPaid - principal), over: Math.round(Math.max(0, over)) },
    { key: "savings", value: each(e => grow(e.amount, cash, years - e.t)), certain: true, ratePct: cash },
    { key: "isa", value: each((e, i) => grow(isaPart[i], GROWTH_NOMINAL_PCT, years - e.t)) + rest(isaPart),
      certain: false, ratePct: GROWTH_NOMINAL_PCT, over: Math.round(isaOver), cashPct: cash },
    { key: "pension", value: each((e, i) => grow(pensionPart[i].gross, GROWTH_NOMINAL_PCT, years - e.t)) * (1 - (1 - PENSION_TAX_FREE_SHARE) * laterRate) + rest(pensionPart.map(p => p.net)),
      certain: false, ratePct: GROWTH_NOMINAL_PCT, reliefPct: gross > 0 ? Math.round((1 - net / gross) * 100) : 0, laterPct: Math.round(laterRate * 100),
      over: Math.round(pensionOver), cashPct: cash },
  ];
  // A debt: each payment on what's still owed after the ones before it.
  const debt = (owed, ratePct, termYears) => {
    let left = owed;
    return each(e => {
      const v = debtRow(e.amount, owed > 0 ? left : null, ratePct, termYears - e.t, years - e.t, cash);
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
