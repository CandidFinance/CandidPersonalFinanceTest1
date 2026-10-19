// Keeping a student loan's balance current between visits, and recording an
// overpayment. Pure, unit tested in loanBalance.test.js.
//
//  - Each month, on payday (taken as the last working day of the month, when
//    most UK employers pay), the balance gains a month's interest at the
//    plan's rate, then falls by that month's repayment: the plan's rate of
//    pay over its monthly threshold. Pay is the salary they've given (less
//    salary sacrifice, which comes off before deductions), without the
//    bonus. The same for a Postgraduate loan alongside (studentLoan.js).
//  - The balance is rolled on from the day it was last set: `loanBalanceAsOf`
//    (a date) with `loanBalanceSet` (the balance then). A balance they've
//    typed in since (the walk-through, Edit inputs, the page) no longer
//    matches loanBalanceSet, so it becomes the new starting point instead.
//  - An overpayment: the amount comes from the accounts they pick, the
//    lowest rate first ("the worst option"), with "Other" (money Candid
//    doesn't track) covering whatever's left, so nothing is taken for it.

import { taxYearOf } from "./taxYear.js";
import { resolveSlRate, slThresholdIn, slEarnings, SL_REPAYMENT_RATES, hasPgLoan } from "./studentLoan.js";

const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parse = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };

// The last Monday to Friday of a month (month 0 = January). Bank holidays
// aren't counted: a day either way doesn't change a month's figures.
export function lastWorkingDay(year, month) {
  const day = new Date(year, month + 1, 0);
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() - 1);
  return day;
}

// Paydays after `from` and on or before `now`, oldest first.
export function paydaysBetween(from, now) {
  const out = [];
  for (let y = from.getFullYear(), m = from.getMonth(); ; m++) {
    if (m > 11) { m = 0; y++; }
    const pay = lastWorkingDay(y, m);
    if (pay > now) break;
    if (pay > from) out.push(pay);
  }
  return out;
}

// A month on a loan: its interest, then the month's repayment, never below 0.
export function monthOnLoan(balance, { rate, monthlyPay, monthlyThreshold, repayRate }) {
  const repayment = Math.max(0, monthlyPay - monthlyThreshold) * repayRate;
  return Math.max(0, balance * (1 + rate / 12) - repayment);
}

// One loan's balance rolled through the paydays: `plan` decides the rate,
// threshold and repayment rate.
function rollOne(balance, plan, d, paydays, pay) {
  const rate = resolveSlRate({ ...d, studentLoan: plan, studentLoanRate: plan === d.studentLoan ? d.studentLoanRate : "" }, pay);
  let bal = balance;
  for (const day of paydays) {
    if (bal <= 0) break;
    bal = monthOnLoan(bal, { rate, monthlyPay: pay / 12, monthlyThreshold: slThresholdIn(plan, taxYearOf(day)) / 12, repayRate: SL_REPAYMENT_RATES[plan] ?? 0.09 });
  }
  return Math.round(bal);
}

// The patch that brings the loan balances up to `now`, or null when nothing
// changes. A balance typed in since the last roll is the new starting point.
export function rollLoanBalances(d, now = new Date()) {
  if (!d.studentLoan || d.studentLoan === "none" || d.loanBalance === "" || d.loanBalance == null) return null;
  const today = iso(now);
  const pgOn = hasPgLoan(d);
  const typedSince = d.loanBalanceSet !== String(d.loanBalance) || (pgOn && d.pgLoanBalanceSet !== String(d.pgLoanBalance));
  if (!d.loanBalanceAsOf || typedSince) {
    return { loanBalanceAsOf: today, loanBalanceSet: String(d.loanBalance), ...(pgOn ? { pgLoanBalanceSet: String(d.pgLoanBalance) } : {}) };
  }
  const paydays = paydaysBetween(parse(d.loanBalanceAsOf), now);
  if (!paydays.length) return null;
  // Regular pay: salary less salary sacrifice, without the bonus. None while
  // not working.
  const pay = d.employmentStatus === "not_working" ? 0 : Math.max(0, slEarnings(d, +d.salary || 0) - (+d.bonusAmount || 0));
  const main = String(rollOne(+d.loanBalance, d.studentLoan, d, paydays, pay));
  const pg = pgOn ? String(rollOne(+d.pgLoanBalance, "postgrad", d, paydays, pay)) : null;
  return {
    loanBalance: main, loanBalanceSet: main, loanBalanceAsOf: iso(paydays[paydays.length - 1]),
    ...(pg != null ? { pgLoanBalance: pg, pgLoanBalanceSet: pg } : {}),
  };
}

// Where an overpayment can come from: each savings account, the one cash
// figure if accounts weren't itemised, Premium Bonds, and "Other". ISAs
// aren't offered. `pbRate`: Premium Bonds' prize rate, for the order.
export function overpaymentSources(d, pbRate = null) {
  const tiers = Array.isArray(d.cashTiers) ? d.cashTiers : [];
  const out = tiers.map((t, i) => ({ key: `tier:${i}`, label: (t.name || "").trim() || `Savings account ${i + 1}`, amount: +t.amount || 0, rate: +t.rate || 0 }))
    .filter(s => s.amount > 0);
  if (!out.length && +d.cashSavings > 0) out.push({ key: "cash", label: "Savings", amount: +d.cashSavings, rate: +d.savingsRate || 0 });
  if (+d.premiumBonds > 0) out.push({ key: "pb", label: "Premium Bonds", amount: +d.premiumBonds, rate: pbRate ?? 0 });
  out.push({ key: "other", label: "Other", amount: Infinity, rate: Infinity });
  return out;
}

// What paying `amount` from the picked sources does to them: the lowest rate
// first, "Other" last. A patch of the fields that change.
export function takeFromSources(d, amount, picks, pbRate = null) {
  const chosen = overpaymentSources(d, pbRate).filter(s => picks.includes(s.key)).sort((a, b) => a.rate - b.rate);
  const patch = {};
  const tiers = Array.isArray(d.cashTiers) ? d.cashTiers.map(t => ({ ...t })) : [];
  let left = Math.max(0, Math.round(amount));
  for (const s of chosen) {
    if (left <= 0) break;
    const take = Math.min(s.amount, left);
    left -= take;
    if (s.key.startsWith("tier:")) { const i = +s.key.slice(5); tiers[i].amount = String(Math.round((+tiers[i].amount || 0) - take)); patch.cashTiers = tiers; }
    if (s.key === "cash") patch.cashSavings = String(Math.round(s.amount - take));
    if (s.key === "pb") patch.premiumBonds = String(Math.round(s.amount - take));
  }
  return patch;
}

export const todayIso = (now = new Date()) => iso(now);
