import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateCash } from "./cashAllocation.js";
import { calcCashOptimisation } from "./cash.js";

const row = (provider_name, rate_aer, max_balance = null, extra = {}) =>
  ({ provider_name, account_type: "Easy access", rate_aer: String(rate_aer), max_balance, is_isa: false, ...extra });

test("a capped account takes up to its cap and the rest goes to the best uncapped one", () => {
  const a = allocateCash(20000, [row("Capped", 6, 5000), row("Big", 4.5), row("Lower", 4.3)]);
  assert.deepEqual(a.lines.map(l => [l.provider, l.amount]), [["Capped", 5000], ["Big", 15000]]);
  assert.equal(a.interest, 300 + 675);
  assert.equal(a.blendedRatePct, 4.875);
  assert.equal(a.lines[0].extra, 75);
  assert.equal(a.lines[1].extra, null);
});

test("a capped account worth under £25 a year more is left out", () => {
  // Cahoot today: 5% on up to £3,000 is £15 a year more than 4.5% on that £3,000.
  const a = allocateCash(20000, [row("Cahoot", 5, 3000), row("Saga", 4.5)]);
  assert.deepEqual(a.lines.map(l => [l.provider, l.amount]), [["Saga", 20000]]);
});

test("less than the cap stays in the capped account if it's still worth it", () => {
  const a = allocateCash(2000, [row("Capped", 6, 5000), row("Big", 4.5)]);
  assert.deepEqual(a.lines.map(l => [l.provider, l.amount]), [["Capped", 2000]]);
});

test("at most three accounts, keeping a place for the uncapped one", () => {
  const rows = [row("A", 7, 2000), row("B", 6.8, 2000), row("C", 6.6, 2000), row("D", 6.4, 2000), row("Big", 4)];
  assert.deepEqual(allocateCash(20000, rows).lines.map(l => l.provider), ["A", "B", "Big"]);
});

test("with every account capped, what doesn't fit is left unallocated", () => {
  const a = allocateCash(10000, [row("A", 6, 3000), row("B", 5, 2000)]);
  assert.equal(a.allocated, 5000);
  assert.equal(a.unallocated, 5000);
});

test("an interest ceiling and a minimum rate limit what's used", () => {
  const a = allocateCash(50000, [row("Capped", 6, 5000), row("Big", 4.5), row("Low", 4)], { minRatePct: 4.4, maxInterest: 1000 });
  assert.equal(Math.round(a.interest), 1000);
  assert.deepEqual(a.lines.map(l => l.provider), ["Capped", "Big"]);
  assert.equal(allocateCash(5000, [row("Low", 4)], { minRatePct: 4.4 }).lines.length, 0);
});

test("fixed, notice and regular-saver products are never used", () => {
  const rows = [row("Bond", 6, null, { account_type: "2-year fixed" }), row("Easy", 4)];
  assert.deepEqual(allocateCash(1000, rows).lines.map(l => l.provider), ["Easy"]);
});

test("the cash optimiser spreads each step across real accounts when given rows", () => {
  const m = { cash: 30000, bonds: 0, isaHeadroom: 20000, taxBandLabel: "basic", savingsRate: 1, tr: 0.2 };
  const rows = [
    row("Chip", 4.72, null, { is_isa: true, account_type: "Easy access ISA" }),
    row("Capped", 6, 5000), row("Big", 4.5),
  ];
  const opt = calcCashOptimisation(m, 4.72, 6, rows);
  assert.equal(opt.step1Isa, 20000);
  assert.equal(opt.step1IsaInterest, 944);
  assert.deepEqual(opt.savingsLines.map(l => [l.provider, l.amount]), [["Capped", 5000], ["Big", 5000]]);
  assert.equal(opt.step2SavingsInterest, 525);
  assert.equal(opt.nonIsaRateDisplay, "5.25%");
  // Without the rows, the old single-rate answer: the whole step at the top rate.
  const legacy = calcCashOptimisation(m, 4.72, 6);
  assert.equal(legacy.step2SavingsInterest, 600);
  assert.deepEqual(legacy.savingsLines, []);
});

test("no non-ISA account beating Premium Bonds means no savings step", () => {
  const m = { cash: 30000, bonds: 0, isaHeadroom: 20000, taxBandLabel: "basic", savingsRate: 1, tr: 0.2 };
  const opt = calcCashOptimisation(m, 4.72, 4.3, [row("Low", 4.3)]);
  assert.equal(opt.step2Savings, 0);
  assert.equal(opt.savingsWorthIt, false);
});
