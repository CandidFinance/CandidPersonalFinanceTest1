import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { calcStudentLoanScenario } from "./studentLoan.js";
import { loanComparison, pensionRelief, drawnTaxRate } from "./loanCompare.js";

const run = (d, amount) => {
  const m = calcMetrics(d);
  return loanComparison(d, m, calcStudentLoanScenario(d, m), amount);
};
const row = (c, key) => c.rows.find(r => r.key === key);
// Clears in a few years at a 6% rate (Postgraduate), with savings at 1%.
const clears = { age: "30", employmentStatus: "employed", salary: "90000", studentLoan: "postgrad", loanBalance: "8000", salaryTrajectory: "stable",
  cashTiers: [{ amount: "20000", rate: "1" }], slCompareMortgage: "no" };
// Plan 2 on a modest salary: written off, so paying in frees little.
const writtenOff = { ...clears, salary: "32000", studentLoan: "plan2", loanBalance: "60000" };

test("every row is valued at the same date: when the loan would end", () => {
  const m = calcMetrics(clears), sl = calcStudentLoanScenario(clears, m);
  const c = loanComparison(clears, m, sl, 5000);
  assert.equal(c.years, sl.clearYr);
  assert.equal(c.byTaxYear, sl.writeOffTaxYear - sl.writeOffYr + sl.clearYr);
  assert.equal(row(c, "savings").value, Math.round(5000 * Math.pow(1 + sl.cashRate / 100, c.years)));
});

test("a loan that clears at a higher rate than savings: paying it in comes out above savings, and is certain", () => {
  const c = run(clears, 5000);
  assert.ok(row(c, "loan").value > row(c, "savings").value);
  assert.equal(row(c, "loan").certain, true);
  assert.equal(row(c, "isa").certain, false);
});

test("a loan heading for write-off: paying in frees far less than savings would earn", () => {
  const c = run(writtenOff, 5000);
  assert.ok(row(c, "loan").value < row(c, "savings").value);
  assert.equal(c.cleared, false);
});

test("listed by £, largest first, with the mortgage asked about until there's a rate", () => {
  const c = run({ ...writtenOff, slCompareMortgage: "" }, 5000);
  const valued = c.rows.filter(r => !r.ask);
  assert.deepEqual(valued.map(r => r.value), [...valued.map(r => r.value)].sort((a, b) => b - a));
  assert.deepEqual(c.rows.at(-1), { key: "mortgage", ask: true });
  assert.ok(!run(writtenOff, 5000).rows.some(r => r.key === "mortgage")); // "no"
  assert.ok(run({ ...writtenOff, slCompareMortgage: "yes" }, 5000).rows.some(r => r.ask)); // no rate yet
  // The hidden Mortgage module's "no" (sanitizeForMvp) isn't an answer here.
  assert.ok(run({ ...writtenOff, slCompareMortgage: "", hasMortgage: "no" }, 5000).rows.some(r => r.ask));
});

test("a mortgage: its rate on what's owed, the rest in savings", () => {
  const d = { ...writtenOff, hasMortgage: "no", slCompareMortgage: "yes", mortgageRate: "5", mortgageBalance: "3000" };
  const c = run(d, 5000), years = c.years, cash = row(c, "savings").ratePct;
  assert.equal(row(c, "mortgage").value, Math.round(3000 * Math.pow(1.05, years) + 2000 * Math.pow(1 + cash / 100, years)));
});

test("a pension: relief going in, a quarter tax-free and the rest at 20% coming out", () => {
  const c = run(clears, 5000);
  const p = row(c, "pension");
  assert.equal(p.reliefPct, 40);
  assert.equal(p.value, Math.round(5000 / 0.6 * Math.pow(1.06, c.years) * 0.85));
});

test("pension relief is what the payment really saves in tax: 60% where it brings back the Personal Allowance", () => {
  assert.equal(Math.round(pensionRelief(30000, 4000).rate * 100), 20);
  assert.equal(Math.round(pensionRelief(80000, 6000).rate * 100), 40);
  // £110,000: £6,000 paid in is £15,000 gross, all of it inside the £100k to £125,140 band.
  assert.equal(Math.round(pensionRelief(115000, 6000).rate * 100), 60);
  assert.equal(Math.round(pensionRelief(115000, 6000).gross), 15000);
  // Straddling £100,000: part at 60%, part at 40%.
  const r = pensionRelief(104000, 6000).rate;
  assert.ok(r > 0.4 && r < 0.6);
});

test("tax on the pension when drawn: the rate their retirement income is on track for, 20% at least", () => {
  assert.equal(drawnTaxRate(0), 0.2);
  assert.equal(drawnTaxRate(30000), 0.2);
  assert.equal(drawnTaxRate(70000), 0.4);
  assert.equal(drawnTaxRate(110000), 0.6);
  assert.equal(drawnTaxRate(150000), 0.45);
});

test("a pension on track to be taxed at 40% in retirement keeps less of what it drew", () => {
  const big = { ...clears, salary: "110000", hasPension: "yes", pensionStatus: "yes", myContribution: "10", employerMatch: "10", employerContributionType: "match", potValue: "400000" };
  const p = row(run(big, 5000), "pension");
  assert.ok(p.laterPct >= 40);
  // Their own 10% already takes £110,000 under £100,000 (adjusted net
  // income), so more paid in gets 40%, not 60%.
  assert.equal(p.reliefPct, 40);
});

test("a plan's payments, each valued from the date it's paid; one payment today is the lump sum", () => {
  const m = calcMetrics(writtenOff), sl = calcStudentLoanScenario(writtenOff, m);
  assert.deepEqual(loanComparison(writtenOff, m, sl, [{ at: 0, amount: 5000 }]), loanComparison(writtenOff, m, sl, 5000));
  const later = loanComparison(writtenOff, m, sl, [{ at: 3, amount: 5000 }]);
  assert.equal(row(later, "savings").value, Math.round(5000 * Math.pow(1 + sl.cashRate / 100, later.years - 3)));
});

test("a mortgage paid off by earlier payments takes no more at its rate", () => {
  const d = { ...writtenOff, slCompareMortgage: "yes", mortgageRate: "5", mortgageBalance: "3000" };
  const m = calcMetrics(d), sl = calcStudentLoanScenario(d, m);
  const c = loanComparison(d, m, sl, [{ at: 0, amount: 3000 }, { at: 1, amount: 2000 }]), y = c.years, cash = sl.cashRate / 100;
  assert.equal(row(c, "mortgage").value, Math.round(3000 * Math.pow(1.05, y) + 2000 * Math.pow(1 + cash, y - 1)));
});
