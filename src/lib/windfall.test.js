import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { sanitizeForMvp } from "./moduleStatus.js";
import { windfallOptions, sourceNote, roomFor, describeSplit, REDUNDANCY_TAX_FREE } from "./windfall.js";

const MARKET = { isaRate: 4.68, nonIsaRate: 4.5 };
const base = {
  age: "33", salary: "55000", employmentStatus: "employed", monthlyExpenses: "2000",
  cashTiers: [{ amount: "20000", rate: "3.0" }], hasInvestments: "yes", isaThisYearCash: "0", isaThisYearSS: "0",
  hasPension: "yes", myContribution: "5", employerMatch: "5", pensionType: "relief", potValue: "40000",
  studentLoan: "none", loanBalance: "0", selectedModules: [],
};
const planFor = (over, w) => {
  const d = sanitizeForMvp({ ...base, ...over });
  const m = calcMetrics(d, MARKET);
  return { d, m, plan: windfallOptions(d, m, { amount: 20000, arrived: true, source: "other", earmark: "none", ...w }, MARKET) };
};
const keys = plan => plan.options.map(o => o.key);

test("redundancy: tax-free up to £30,000, and the rest said to be taxed", () => {
  assert.match(sourceNote({ amount: 20000, source: "redundancy" }, base), /all of yours is/);
  assert.match(sourceNote({ amount: 45000, source: "redundancy" }, base), /other £15,000 is taxed like pay/);
  assert.equal(REDUNDANCY_TAX_FREE, 30000);
});

test("between jobs: £2,880 into a pension gets £720, the money to live on comes first, and no drawdown", () => {
  const { plan } = planFor({ employmentStatus: "not_working", notWorkingReason: "break", cashTiers: [{ amount: "80000", rate: "3.0" }] }, { source: "redundancy" });
  assert.equal(plan.safety.title, "Money to live on");
  const pension = plan.options.find(o => o.key === "pension");
  assert.equal(pension.cap, 2880);
  assert.equal(pension.value(2880).figure, 720);
  assert.equal(pension.access, "Locked until 57.");
});

test("ranked by what each £ adds in a year, guaranteed figures first", () => {
  const { plan } = planFor({});
  const guaranteed = plan.options.filter(o => o.guaranteed);
  const rate = o => o.value(Math.min(o.cap, plan.amount)).figure / Math.min(o.cap, plan.amount);
  for (let i = 1; i < guaranteed.length; i++) assert.ok(rate(guaranteed[i - 1]) >= rate(guaranteed[i]), keys(plan).join(","));
  // Assumed growth sits after every guaranteed option.
  assert.equal(plan.options.findIndex(o => !o.guaranteed) >= guaranteed.length, true);
  assert.equal(keys(plan)[0], "pension"); // 40% relief at once
});

test("a home under 40: a Lifetime ISA, and the pension marked as out of reach for it", () => {
  const { plan } = planFor({}, { earmark: "home", when: "mid" });
  const lisa = plan.options.find(o => o.key === "lisa");
  assert.equal(lisa.cap, 4000);
  assert.equal(lisa.value(4000).figure, 1000);
  assert.match(plan.options.find(o => o.key === "pension").fit, /^Not reachable for your home\.$/);
  assert.match(plan.options.find(o => o.key === "stocksIsa").fit, /short time/);
  // No Lifetime ISA from 40. (Owning a home rules it out too, but the
  // mortgage questions are hidden for now: sanitizeForMvp clears them.)
  assert.equal(keys(planFor({ age: "41" }, { earmark: "home", when: "mid" }).plan).includes("lisa"), false);
});

test("a bonus not yet paid can go into the pension before tax; once paid, it can't", () => {
  assert.ok(keys(planFor({}, { source: "bonus", arrived: false }).plan).includes("bonusSacrifice"));
  assert.equal(keys(planFor({}, { source: "bonus", arrived: true }).plan).includes("bonusSacrifice"), false);
});

test("ISAs share the allowance left: placing in one leaves less for the other", () => {
  const { plan } = planFor({ isaThisYearSS: "5000" });
  const cash = plan.options.find(o => o.key === "cashIsa"), shares = plan.options.find(o => o.key === "stocksIsa");
  assert.equal(roomFor(shares, {}, plan), 15000);
  assert.equal(roomFor(shares, { cashIsa: 10000 }, plan), 5000);
  // And no option takes more than is left to place.
  assert.equal(roomFor(cash, { savings: 18000 }, plan), 2000);
});

test("a student loan written off anyway is left out, with why", () => {
  const { plan } = planFor({ salary: "32000", studentLoan: "plan2", loanBalance: "60000" });
  assert.equal(keys(plan).includes("studentLoan"), false);
  assert.match(plan.leftOut[0].why, /written off/);
});

test("the split in words", () => {
  const { plan } = planFor({});
  const text = describeSplit({ cashIsa: 15000 }, plan);
  assert.match(text, /^That puts £15,000 into a Cash ISA \(£702 a year in interest, tax-free\)\. £5,000 isn't placed yet\.$/);
});
