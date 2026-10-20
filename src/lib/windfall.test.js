import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { sanitizeForMvp } from "./moduleStatus.js";
import { windfallOptions, sourceNote, roomFor, describeSplit, settlementTax, REDUNDANCY_TAX_FREE } from "./windfall.js";

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

// A settlement: £15,000 notice, £6,000 bonus, £1,500 holiday pay, £12,000
// of redundancy and thank-you, after £30,000 of pay this tax year.
const settlement = { notice: 15000, bonus: 6000, holiday: 1500, compensation: 12000 };

test("redundancy: only redundancy and thank-you payments are tax-free, up to £30,000", () => {
  const t = settlementTax(settlement, 30000);
  assert.equal(REDUNDANCY_TAX_FREE, 30000);
  assert.equal(t.taxFree, 12000);
  assert.equal(t.taxed, 22500);
  // Income tax on the £22,500 on top of £30,000: 20% to £50,270, 40% above.
  assert.equal(t.incomeTax, 4946);
  // NI on one month's pay: 8% to £4,189, 2% above.
  assert.equal(t.ni, 618);
  assert.equal(t.net, 34500 - 4946 - 618);
  // Compensation over £30,000 is taxed, without NI.
  const big = settlementTax({ compensation: 40000 }, 0);
  assert.equal(big.taxed, 10000);
  assert.equal(big.ni, 0);
  assert.equal(sourceNote({ source: "redundancy" }, base), null);
});

test("redundancy year: the pension limit is this year's earnings, and the employer can pay in before tax", () => {
  const { plan } = planFor({ employmentStatus: "not_working", notWorkingReason: "break" },
    { source: "redundancy", parts: settlement, earnedBefore: 30000, arrived: false });
  assert.equal(plan.amount, 28936);
  const pension = plan.options.find(o => o.key === "pension");
  assert.ok(pension.cap > 2880, `cap ${pension.cap}`);
  assert.match(pension.detail, /£52,500/);
  const employer = plan.options.find(o => o.key === "employerPension");
  // All £22,500 of taxed parts into the pension: none of the £5,564 of tax and NI.
  assert.equal(employer.value(employer.cap).figure, 5564);
  // Once it's been paid, it's too late for the employer to pay it in.
  const paid = planFor({ employmentStatus: "not_working", notWorkingReason: "break" },
    { source: "redundancy", parts: settlement, earnedBefore: 30000, arrived: true }).plan;
  assert.equal(paid.options.some(o => o.key === "employerPension"), false);
});

test("savings: interest already earned uses this year's tax-free amount first, at this year's band", () => {
  // Higher rate this year (£52,500 with the settlement): £500 tax-free, of
  // which £281 is used by £5,000 at 4% and £2,500 at 3.25%.
  const { plan } = planFor({ employmentStatus: "not_working", notWorkingReason: "break",
    cashTiers: [{ amount: "5000", rate: "4" }, { amount: "2500", rate: "3.25" }] },
    { source: "redundancy", parts: settlement, earnedBefore: 30000 });
  const savings = plan.options.find(o => o.key === "savings");
  assert.match(savings.detail, /£219 more interest is tax-free this tax year, then it's taxed at 40%/);
  assert.match(savings.detail, /From April, if you're still not working/);
  const gross = Math.round(10000 * 0.045);
  assert.ok(savings.value(10000).figure < gross, "some of it taxed this year");
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

// Between jobs, pay earlier this tax year still sets this year's band, for
// the Cash module, Home and Candid Assist as much as for the Chat tab.
test("not working: earlier pay this tax year sets the band; estimated from the last salary if not given", async () => {
  const { earnedEarlierThisYear } = await import("./metrics.js");
  const d = sanitizeForMvp({ ...base, employmentStatus: "not_working", notWorkingReason: "break", salary: "60000" });
  // 6 April to 5 October, 182 days: about half the last salary.
  const half = new Date(2026, 9, 5);
  assert.equal(earnedEarlierThisYear(d, 2026, half).pay, 29897);
  assert.equal(earnedEarlierThisYear(d, 2026, half).estimated, true);
  // Said: that wins. A settlement's taxed parts count too.
  const said = { ...d, earnedThisTaxYear: "30000", windfall: { source: "redundancy", taxYear: 2026, parts: { notice: 15000, compensation: 35000 } } };
  assert.deepEqual(earnedEarlierThisYear(said, 2026, half), { pay: 30000, estimated: false, settlementTaxed: 20000 });
  // Last year's settlement doesn't count this year.
  assert.equal(earnedEarlierThisYear({ ...said, windfall: { ...said.windfall, taxYear: 2025 } }, 2026, half).settlementTaxed, 0);
  // The band follows (£50,000 is still basic rate), but not the pay each month.
  const m = calcMetrics({ ...said, cashTiers: [{ amount: "20000", rate: "4" }] }, MARKET);
  assert.equal(m.taxBandLabel, "basic");
  assert.equal(m.monthlyTakeHome, 0);
  const higher = calcMetrics({ ...said, earnedThisTaxYear: "40000" }, MARKET);
  assert.equal(higher.taxBandLabel, "higher");
  assert.equal(higher.savingsTr, 0.4);
});

test("redundancy year pension limit: less what went in through work this year, at the old rate", () => {
  const { plan } = planFor({ employmentStatus: "not_working", notWorkingReason: "break", myContribution: "5", employerMatch: "5", pensionType: "relief" },
    { source: "redundancy", parts: settlement, earnedBefore: 30000, arrived: false });
  const pension = plan.options.find(o => o.key === "pension");
  // £52,500 of earnings, less £1,500 paid in personally (5% of £30,000).
  assert.match(pension.detail, /up to £51,000 can go in with relief/);
  assert.match(pension.detail, /£3,000 already paid in through work \(your 5% and your employer's 5% on £30,000\)/);
});

// A fixed employer contribution isn't a match: nothing missed by paying less.
test("employer pays a fixed %: no missed match, and it still counts towards the pension", async () => {
  const match = calcMetrics({ ...base, salary: "120000", myContribution: "5", employerMatch: "15" }, MARKET);
  const fixed = calcMetrics({ ...base, salary: "120000", myContribution: "5", employerMatch: "15", employerContributionType: "fixed" }, MARKET);
  assert.equal(match.missedMatch, 12000);
  assert.equal(fixed.missedMatch, 0);
  assert.ok(fixed.projectedPot > match.projectedPot, "the fixed 15% is all paid in");
});

// Final salary members get an answer about their scheme, not a pot; "not
// sure" gets one worked out on the legal minimum.
test("pension answers: final salary scheme, and not sure on the legal minimum", async () => {
  const { pensionReveal } = await import("./moduleReveal.js");
  const db = { ...base, salary: "58000", age: "33", pensionKind: "db", hasPension: "yes", myContribution: "6", potValue: "", dbPensionIncome: "21000" };
  const steps = pensionReveal(db, calcMetrics(db, MARKET));
  assert.equal(steps[0].figure, "£21,000 a year");
  assert.match(steps[1].title, /no pot/);
  // In the £100k trap, that's the £100k tax trap module's, not Pension's.
  const high = { ...db, salary: "110000" };
  assert.equal(pensionReveal(high, calcMetrics(high, MARKET))[0].figure, "£21,000 a year");
  const unsure = { ...base, salary: "45000", age: "35", pensionUnknown: true, myContribution: "", employerMatch: "", potValue: "" };
  const u = pensionReveal(unsure, calcMetrics(unsure, MARKET));
  assert.match(u[0].title, /if you pay the legal minimum/);
  assert.match(u[1].body, /our estimate/);
});
