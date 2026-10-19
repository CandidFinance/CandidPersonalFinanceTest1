import test from "node:test";
import assert from "node:assert/strict";
import { lastWorkingDay, paydaysBetween, monthOnLoan, rollLoanBalances, overpaymentSources, takeFromSources } from "./loanBalance.js";

const day = s => new Date(`${s}T12:00:00`);

test("payday is the last working day of the month", () => {
  assert.equal(lastWorkingDay(2026, 9).getDate(), 30); // Fri 30 Oct 2026
  assert.equal(lastWorkingDay(2026, 4).getDate(), 29); // 31 May 2026 is a Sunday: Fri 29th
  assert.deepEqual(paydaysBetween(day("2026-10-15"), day("2027-01-05")).map(d => d.toDateString()),
    [new Date(2026, 9, 30), new Date(2026, 10, 30), new Date(2026, 11, 31)].map(d => d.toDateString()));
});

test("a month on a loan: interest added, then 9% of pay over the monthly threshold", () => {
  // £20,000 at 6%: +£100; pay £5,000 a month, threshold £2,448.75: 9% of £2,551.25 = £229.61.
  assert.equal(Math.round(monthOnLoan(20000, { rate: 0.06, monthlyPay: 5000, monthlyThreshold: 29385 / 12, repayRate: 0.09 }) * 100) / 100, 19870.39);
  assert.equal(monthOnLoan(100, { rate: 0.06, monthlyPay: 9000, monthlyThreshold: 2448, repayRate: 0.09 }), 0);
});

test("rolling on: from the day it was set, payday by payday; a typed-in balance starts again", () => {
  const d = { studentLoan: "plan2", salary: "60000", loanBalance: "20000", loanBalanceSet: "20000", loanBalanceAsOf: "2026-10-15" };
  const p = rollLoanBalances(d, day("2026-12-05"));
  assert.equal(p.loanBalanceAsOf, "2026-11-30");
  // Two paydays (30 Oct, 30 Nov) at 6% on £60,000: each +~£100, −£224.
  assert.ok(+p.loanBalance < 20000 && +p.loanBalance > 19700, p.loanBalance);
  assert.equal(p.loanBalanceSet, p.loanBalance);
  // Nothing new since: nothing to do.
  assert.equal(rollLoanBalances({ ...d, ...p }, day("2026-12-10")), null);
  // Typed in since: the new figure is the starting point, today.
  assert.deepEqual(rollLoanBalances({ ...d, loanBalance: "18000" }, day("2026-12-05")), { loanBalanceAsOf: "2026-12-05", loanBalanceSet: "18000" });
  // Below the threshold or not working: interest only.
  assert.ok(+rollLoanBalances({ ...d, salary: "20000" }, day("2026-12-05")).loanBalance > 20000);
  assert.ok(+rollLoanBalances({ ...d, employmentStatus: "not_working" }, day("2026-12-05")).loanBalance > 20000);
  // A Postgraduate loan alongside rolls too.
  const pg = rollLoanBalances({ ...d, hasPgLoan: "yes", pgLoanBalance: "10000", pgLoanBalanceSet: "10000" }, day("2026-12-05"));
  assert.ok(+pg.pgLoanBalance < 10000);
});

test("an overpayment comes from the picked accounts, lowest rate first; Other takes nothing", () => {
  const d = { cashTiers: [{ name: "Easy", amount: "10000", rate: "4.5" }, { name: "Old", amount: "6000", rate: "1" }], premiumBonds: "5000" };
  assert.deepEqual(overpaymentSources(d, 3.6).map(s => s.key), ["tier:0", "tier:1", "pb", "other"]);
  // £8,000 from both accounts: the 1% one first, then £2,000 of the 4.5% one.
  const both = takeFromSources(d, 8000, ["tier:0", "tier:1"]);
  assert.deepEqual(both.cashTiers.map(t => t.amount), ["8000", "0"]);
  // Premium Bonds (3.6%) before the 4.5% account.
  assert.deepEqual(takeFromSources(d, 7000, ["tier:0", "pb"], 3.6), { premiumBonds: "0", cashTiers: [{ name: "Easy", amount: "8000", rate: "4.5" }, { name: "Old", amount: "6000", rate: "1" }] });
  // More than the picked accounts hold, with Other: the rest is Other's.
  assert.deepEqual(takeFromSources(d, 9000, ["tier:1", "other"]).cashTiers.map(t => t.amount), ["10000", "0"]);
  assert.deepEqual(takeFromSources(d, 9000, ["other"]), {});
});
