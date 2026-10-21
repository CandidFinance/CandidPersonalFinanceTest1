import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { calcStudentLoanScenario } from "./studentLoan.js";
import { loanComparison } from "./loanCompare.js";

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
