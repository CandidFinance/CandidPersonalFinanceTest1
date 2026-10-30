import { test } from "node:test";
import assert from "node:assert/strict";
import { WORKING_CHECKS, workingChecks } from "./workingChecks.js";
import { calcMetrics } from "./metrics.js";
import { CASH_QUICK } from "./cashQuick.js";
import { quickPatch } from "./studentLoanQuick.js";

const checks = (key, d, ctx = {}) => workingChecks(key, d, calcMetrics(d), ctx);
const rates = { isaRate: 4.5, nonIsaRate: 4.7, rows: [{ provider: "Bank", rate: 4.7 }] };

test("only the agreed modules: no Kids & family or £100k tax trap", () => {
  assert.deepEqual(Object.keys(WORKING_CHECKS).sort(), ["cash", "investments", "pension", "rentVsBuy", "studentLoan"]);
  assert.equal(workingChecks("kids", {}, {}, {}), null);
});

const cashBase = { salary: "40000", age: "30", cashSavings: "18000", savingsRate: "2", monthlyExpenses: "1800" };
test("cash: rates, allowance, FSCS and emergency fund, on the user's figures", () => {
  assert.deepEqual(checks("cash", cashBase, { marketRates: rates }), [
    "Checking your £18,000 against today's top savings and Cash ISA rates",
    "Checking your interest against your £1,000 Personal Savings Allowance",
    "Checking each bank's balance against the £120,000 FSCS limit",
    "Checking your savings against 6 months of essential spending",
  ]);
});
test("cash: no rates line before the feed loads, no emergency line without spending", () => {
  const lines = checks("cash", { ...cashBase, monthlyExpenses: "" });
  assert.ok(!lines.some(l => /top savings/.test(l)));
  assert.ok(!lines.some(l => /essential spending/.test(l)));
});
test("cash: higher rate gets the £500 allowance; additional rate the tax on interest", () => {
  assert.ok(checks("cash", { ...cashBase, salary: "70000" }).includes("Checking your interest against your £500 Personal Savings Allowance"));
  assert.ok(checks("cash", { ...cashBase, salary: "200000" }).some(l => /^Working out tax on your interest at 4[57]%$/.test(l)));
});
test("cash: nothing to check with no savings", () => {
  assert.equal(checks("cash", { ...cashBase, cashSavings: "0" }), null);
});

const pensionBase = { salary: "45000", age: "31", retirementAge: "65", hasPension: "yes", potValue: "40000", myContribution: "3", employerMatch: "5" };
test("pension: relief rate, match and annual allowance", () => {
  assert.deepEqual(checks("pension", pensionBase), [
    "Working out tax relief at your 20% rate",
    "Checking your 3% against your employer's 5% match",
    "Checking your payments against the £60,000 annual allowance",
  ]);
});
test("pension: the target line only with a target; no match line for a fixed employer %", () => {
  assert.ok(checks("pension", { ...pensionBase, retirementTarget: "25000" }).includes("Checking your projected income against your £25,000 a year target"));
  assert.ok(!checks("pension", { ...pensionBase, employerContributionType: "fixed" }).some(l => /match/.test(l)));
});

test("student loan: threshold, rate, interest and write-off", () => {
  const lines = checks("studentLoan", { salary: "40000", age: "28", studentLoan: "plan2", loanBalance: "45000" });
  assert.equal(lines[0], "Checking your £40,000 pay against the Plan 2 threshold of £29,385");
  assert.equal(lines[1], "Working out 9% of what you earn above it");
  assert.match(lines[2], /^Adding interest at [\d.]+% to your £45,000$/);
  assert.match(lines[3], /^Checking the write-off after 30 years, in April 20\d\d$/);
  assert.equal(checks("studentLoan", { salary: "40000", studentLoan: "none" }), null);
});

test("investments: gains lines only with gains", () => {
  const isa = "Checking this year's ISA payments against the £20,000 ISA allowance";
  assert.deepEqual(checks("investments", { salary: "40000", unrealisedGains: "5000" }), [
    "Checking your £5,000 of gains against the £3,000 capital gains allowance", "Working out tax on gains above it at 18%", isa,
  ]);
  assert.deepEqual(checks("investments", { salary: "40000" }), [isa]);
});

const property = { salary: "50000", age: "30", cashSavings: "40000", monthlyExpenses: "1500", propertyPrice: "300000", propertyRegion: "north_west", propertyFirstTimeBuyer: "yes", propertyMonthlyRent: "1100" };
test("rent vs buy: stamp duty, regional rent, mortgage and the renter's savings", () => {
  const lines = checks("rentVsBuy", property, { marketRates: rates });
  assert.equal(lines[0], "Working out stamp duty on £300,000, with first-time buyer relief");
  assert.equal(lines[1], "Growing your £1,100 rent by 5.8% a year (ONS, North West)");
  assert.match(lines[2], /^Costing a £[\d,]+ mortgage at 4\.5% over 30 years, and 2% selling costs$/);
  assert.match(lines[3], /^Growing your deposit in cash at [\d.]+% if you rent/);
});
test("rent vs buy: no stamp duty line in Scotland, nothing without a rent", () => {
  assert.ok(!checks("rentVsBuy", { ...property, propertyRegion: "scotland" }).some(l => /stamp duty/.test(l)));
  assert.equal(checks("rentVsBuy", { ...property, propertyMonthlyRent: "" }), null);
});

test("quick-start estimates lose their £; typed figures and rule figures keep theirs", () => {
  const base = { salary: "40000", age: "28" };
  const sl = { ...base, ...quickPatch(base, { plan: "plan2", salary: "45-60", balance: "40-60", finish: "2020" }, 2026) };
  const lines = checks("studentLoan", sl);
  assert.equal(lines[0], "Checking your pay against the Plan 2 threshold of £29,385");
  assert.match(lines[2], /^Adding interest at [\d.]+% to your balance$/);
  const typed = checks("studentLoan", { ...sl, salary: "52000", loanBalance: "48000" });
  assert.equal(typed[0], "Checking your £52,000 pay against the Plan 2 threshold of £29,385");
  assert.match(typed[2], /to your £48,000$/);

  const cashBand = { ...cashBase, ...CASH_QUICK.patch(cashBase, calcMetrics(cashBase), { savings: "10-20", rate: "2-3" }) };
  const cash = checks("cash", cashBand, { marketRates: rates });
  assert.equal(cash[0], "Checking your savings against today's top savings and Cash ISA rates");
  assert.ok(cash.includes("Checking each bank's balance against the £120,000 FSCS limit"));
  const cashTyped = { ...cashBand, cashTiers: [{ ...cashBand.cashTiers[0], amount: "16000" }] };
  assert.equal(checks("cash", cashTyped, { marketRates: rates })[0], "Checking your £16,000 against today's top savings and Cash ISA rates");
});

test("never directive", () => {
  const all = [
    checks("cash", cashBase, { marketRates: rates }), checks("pension", { ...pensionBase, retirementTarget: "25000" }),
    checks("studentLoan", { salary: "40000", studentLoan: "plan2", loanBalance: "45000" }),
    checks("investments", { salary: "40000", unrealisedGains: "5000" }), checks("rentVsBuy", property, { marketRates: rates }),
  ].flat();
  for (const l of all) assert.doesNotMatch(l, /\b(should|start|move|consider|switch|you need)\b/i);
});
