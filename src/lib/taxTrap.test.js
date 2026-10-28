import test from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { taxTrap, position, marginalRate, allowanceLost, trapInView, rateCurve, lostTo, pensionPath, crossingYear } from "./taxTrap.js";

// £110,000, 5% by salary sacrifice: £104,500 of adjusted net income. A
// toddler in nursery in England, £1,500 a month.
const base = { employmentStatus: "employed", salary: "110000", myContribution: "5", pensionType: "sacrifice", hasPension: "yes", studentLoan: "none",
  ukNation: "england", scottishTaxpayer: "no", age: "35", kidsStatus: "yes", kidsCount: "1", kidsPreschool: "1", kidsSchool: "0", childcareMonthly: "1500" };
const at = d => { const m = calcMetrics(d); return { t: taxTrap(d, m), m }; };
const pct = r => Math.round(r * 1000) / 10;

test("the rate on the next £1,000: 62% in England, 69.5% in Scotland, 71% with a Plan 2 loan, 42% under £100,000", () => {
  assert.equal(pct(at(base).t.rate.rate), 62);
  assert.equal(pct(at({ ...base, ukNation: "scotland", scottishTaxpayer: "yes" }).t.rate.rate), 69.5);
  assert.equal(pct(at({ ...base, studentLoan: "plan2", loanBalance: "40000" }).t.rate.rate), 71);
  const near = at({ ...base, salary: "95000" }).t;
  assert.equal(pct(near.rate.rate), 42);
  assert.equal(pct(near.trapRate), 62);
});

test("over £100k: the allowance lost, the childcare that stops, and what the trap costs a year", () => {
  const { t } = at(base);
  assert.equal(t.needed, 4500);
  assert.deepEqual(t.allowance, { lost: 2250, tax: 900 });
  // £2,000 of Tax-Free Childcare and £8,290 of funded hours.
  assert.equal(t.childcareLost, 10290);
  // £900 of tax on the allowance lost, and the childcare: money, a year.
  assert.equal(t.amount, 900 + 10290);
});

test("the ways back: what each costs in take-home, and the childcare it brings back", () => {
  const { t } = at(base);
  const way = k => t.options.find(o => o.key === k);
  // Salary sacrifice saves the 62%: £4,500 costs £1,710 of take-home.
  assert.equal(way("pension").takeHome, 1710);
  assert.equal(way("pension").route, "sacrifice");
  // Gift Aid saves the 60% tax, not the NI.
  assert.equal(way("giftAid").takeHome, 1800);
  // What goes in, less the take-home it costs, is the tax saved.
  assert.equal(way("pension").taxSaved, 2790);
  assert.equal(way("sacrifice").taxSaved, 2790);
  // What's left in the bank: the childcare back, less the take-home.
  assert.equal(way("pension").bank, 10290 - 1710);
  assert.equal(way("giftAid").given, 3600);
  // A 4-day week: £22,000 less pay, much less take-home, under £100,000.
  assert.equal(way("fourDay").gross, 22000);
  assert.ok(way("fourDay").under);
  assert.ok(way("fourDay").takeHome < 12000);
  assert.equal(way("fourDay").childcare, 10290);
  // Self-employed: no salary sacrifice, and the pension is relief at source.
  const own = at({ ...base, employmentStatus: "self_employed" }).t;
  assert.equal(own.options.find(o => o.key === "pension").route, "relief");
  assert.ok(!own.options.some(o => o.key === "sacrifice"));
});

test("relief at source: the basic-rate band is extended, which matches tax on income less the gross plus 20% of it", () => {
  const d = { ...base, myContribution: "0", pensionType: "relief", kidsStatus: "no" };
  const m = calcMetrics({ ...d, salary: "120000" });
  // £120,000 with £20,000 paid in: £27,432 on £100,000, plus £4,000.
  assert.equal(Math.round(position(d, m, { relief: 20000 }).tax), 31432);
});

test("the allowance goes £1 for £2 over £100,000, until it's gone", () => {
  assert.deepEqual(allowanceLost(100000), { lost: 0, tax: 0 });
  assert.deepEqual(allowanceLost(110000), { lost: 5000, tax: 2000 });
  assert.equal(allowanceLost(200000).lost, 12570);
});

test("the pension slider: what any amount paid in does, and the childcare back once at £100,000", () => {
  const { t, m } = at(base);
  // The amount needed matches the pension option.
  const full = pensionPath(base, m, t.needed);
  assert.equal(full.takeHome, 1710);
  assert.ok(full.under);
  assert.equal(full.bank, 10290 - 1710);
  // Half of it: no childcare back yet, the same 62% saved.
  const half = pensionPath(base, m, t.needed / 2);
  assert.ok(!half.under);
  assert.equal(half.childcare, 0);
  assert.equal(half.taxSaved, 2790 / 2);
  // Relief at source saves the tax, not the NI.
  assert.equal(pensionPath(base, m, t.needed, "relief").takeHome, 1800);
  // Not said how they pay in: salary sacrifice, which lowers a student loan's repayments too.
  const loan = { ...base, pensionType: "", studentLoan: "plan2", loanBalance: "40000" };
  const withLoan = pensionPath(loan, calcMetrics(loan), 4000);
  assert.equal(withLoan.route, "sacrifice");
  assert.equal(withLoan.takeHome, 1160);
});

test("the ways back, largest worth first: the pension first, the 4-day week last", () => {
  const keys = at(base).t.options.map(o => o.key);
  assert.equal(keys[0], "pension");
  assert.equal(keys[keys.length - 1], "fourDay");
});

test("the tax year they'd pass £100,000 at the pay growth they expect", () => {
  const d = { ...base, salary: "90000", myContribution: "0", inputsTaxYear: 2026 };
  // 4% a year: £97,344 in two years, £101,238 in three.
  assert.equal(crossingYear({ ...d, salaryGrowthPct: "4" }, calcMetrics({ ...d, salaryGrowthPct: "4" })), 2029);
  assert.equal(crossingYear(base, calcMetrics(base)), null);
});

test("in view near or over £100,000, on £85,000 or more before pension, or heading there; not with no salary", () => {
  assert.ok(trapInView({ salary: "90000" }));
  assert.ok(trapInView({ salary: "85000", myContribution: "10" }));
  assert.ok(!trapInView({ salary: "84000" }));
  assert.ok(!trapInView({ salary: "70000" }));
  assert.ok(!trapInView({ salary: "120000", employmentStatus: "not_working" }));
  assert.equal(taxTrap({ salary: "" }, calcMetrics({ salary: "" })), null);
  assert.equal(pct(marginalRate(base, calcMetrics(base)).rate), 62);
});

test("the chart runs from £0: the marginal rate at each band, and the trap", () => {
  const { m } = at(base);
  const curve = rateCurve(base, m);
  const rate = income => pct(curve.find(p => p.income === income).rate);
  assert.equal(rate(10000), 0);
  assert.equal(rate(30000), 28);
  assert.equal(rate(70000), 42);
  assert.equal(rate(110000), 62);
  assert.equal(rate(130000), 47);
  assert.equal(lostTo({ ni: 0.02, sl: 0.09 }), "tax, National Insurance and student loan");
});

test("this tax year: from answers, or from pay to date and the paydays left", async () => {
  const { yearProjection, paydaysBetween, paydayCheckDue } = await import("./taxTrap.js");
  const today = new Date(2026, 9, 8);
  // 12 paydays in a tax year, on the 28th.
  assert.equal(paydaysBetween(new Date(2026, 3, 5), new Date(2027, 3, 5), 28), 12);
  // A payday on the 31st falls on a shorter month's last day.
  assert.equal(paydaysBetween(new Date(2027, 1, 1), new Date(2027, 1, 28), 31), 1);
  const m = calcMetrics(base);
  const plain = yearProjection(base, m, today);
  assert.equal(plain.tracked, false);
  assert.equal(plain.projected, 104500);
  assert.equal(plain.topUp, 4500);
  // From 6 April to 8 October: 6 paydays (April to September) left 6 to come.
  assert.equal(plain.paydaysLeft, 6);
  // Paid £52,250 so far (half the year's £104,500), and a £10,000 bonus in
  // March still to come: £114,500.
  const withBonus = { ...base, bonusAmount: "10000", bonusMonth: "3" };
  const tracked = yearProjection({ ...withBonus, payToDate: "52250", payToDateOn: "2026-09-28" }, calcMetrics(withBonus), today);
  assert.equal(tracked.tracked, true);
  assert.equal(tracked.projected, 114500);
  assert.equal(tracked.topUp, 14500);
  // A pay rise since: the payslip says more, and so does the year.
  const raised = yearProjection({ ...base, payToDate: "55000", payToDateOn: "2026-09-28" }, m, today);
  assert.equal(raised.projected, 107250);
  // Last year's figure is ignored.
  assert.equal(yearProjection({ ...base, payToDate: "90000", payToDateOn: "2026-03-28" }, m, today).tracked, false);
  // The check-in is due from payday until answered that month.
  assert.equal(paydayCheckDue({ payday: "28" }, today), false);
  assert.equal(paydayCheckDue({ payday: "5" }, today), true);
  assert.equal(paydayCheckDue({ payday: "5", paydayCheckedMonth: "2026-10" }, today), false);
});

test("on pay to date: the module works from the salary it implies", async () => {
  const { effectiveSalary, thisTaxYear, salaryDrift } = await import("./taxTrap.js");
  const { computeModuleStatuses, baselinePatch, answersMoved } = await import("./moduleStatus.js");
  const today = new Date(2026, 9, 8);
  const m = calcMetrics(base);
  // Without pay to date: their own answers, untouched.
  assert.equal(effectiveSalary(base, m, today), null);
  const own = thisTaxYear(base, m, today);
  assert.equal(own.d, base);
  assert.equal(own.m, m);
  // £60,000 by 28 Sep heads for £112,250, £7,750 over their answers' £104,500:
  // £8,158 more salary at 5% into their pension.
  const ahead = { ...base, selectedModules: ["taxTrap"], payToDate: "60000", payToDateOn: "2026-09-28" };
  assert.equal(effectiveSalary(ahead, m, today), 118158);
  const year = thisTaxYear(ahead, m, today);
  assert.equal(year.y.projected, 112250);
  assert.ok(Math.abs(year.m.adjustedNetIncome - 112250) <= 1);
  assert.ok(Math.abs(taxTrap(year.d, year.m).ani - 112250) <= 1);
  // The module's card has the same figure (the test clock is 8 Oct 2026).
  assert.equal(computeModuleStatuses(ahead, calcMetrics(ahead)).taxTrap.amount, taxTrap(year.d, year.m).amount);
  // 7% over their salary: asked whether their pay's gone up to about £118,000.
  assert.equal(salaryDrift(ahead, m, today), 118000);
  // £55,000 heads for £107,250: under 5% off, not asked.
  assert.equal(salaryDrift({ ...base, payToDate: "55000", payToDateOn: "2026-09-28" }, m, today), null);
  // Pay to date isn't one of the module's answers: no "did you make a change?".
  const withBaseline = { ...base, moduleBaselines: baselinePatch(base, computeModuleStatuses(base, m)) };
  assert.equal(answersMoved({ ...withBaseline, payToDate: "60000", payToDateOn: "2026-09-28" }, "taxTrap"), false);
});

test("one-off top-ups this tax year: off the year once, within each month's pay and the allowance", async () => {
  const { yearProjection, thisTaxYear, effectiveSalary, salaryDrift, topUpLimit, topUpMonths, pastAllowance, allowanceLeft } = await import("./taxTrap.js");
  const { calcAnnualAllowanceRoom } = await import("./pension.js");
  const today = new Date(2026, 9, 8);
  const up = (amount, route, month, taxYear = 2026) => ({ id: `${route}${month}`, amount, route, month, taxYear });
  // From their answers: £4,500 from November's pay takes £104,500 to £100,000.
  const nov = { ...base, trapTopUps: [up(4500, "sacrifice", 11)] };
  const m = calcMetrics(base);
  assert.equal(yearProjection(nov, m, today).projected, 100000);
  const year = thisTaxYear(nov, m, today);
  assert.ok(Math.abs(year.m.adjustedNetIncome - 100000) <= 1);
  assert.equal(taxTrap(year.d, year.m).amount, 0);
  // Last tax year's top-up is ignored.
  assert.equal(yearProjection({ ...base, trapTopUps: [up(4500, "sacrifice", 11, 2025)] }, m, today).projected, 104500);
  // Pay to date is after salary sacrifice: £2,000 from September's pay is in
  // the 28 Sep payslip already (£50,250, not £52,250), so it counts once.
  const sep = { ...base, payToDate: "50250", payToDateOn: "2026-09-28", trapTopUps: [up(2000, "sacrifice", 9)] };
  assert.equal(yearProjection(sep, m, today).projected, 102500);
  // From November's pay, after the payslip: it comes off the year.
  assert.equal(yearProjection({ ...base, payToDate: "52250", payToDateOn: "2026-09-28", trapTopUps: [up(2000, "sacrifice", 11)] }, m, today).projected, 102500);
  // And their pay still reads as £110,000: no "has your pay changed?".
  assert.equal(effectiveSalary(sep, m, today), 110000);
  assert.equal(salaryDrift(sep, m, today), null);
  // £3,000 gross into a SIPP: off adjusted net income, not pay.
  const sipp = { ...base, trapTopUps: [up(3000, "relief", 10)] };
  const bySipp = thisTaxYear(sipp, m, today);
  assert.equal(bySipp.d.salary, "110000");
  assert.ok(Math.abs(bySipp.m.adjustedNetIncome - 101500) <= 1);
  // A month's pay after the 5% sacrificed: £8,708; the bonus in its month.
  assert.equal(topUpLimit(base, m, "sacrifice", 11, today), 8708);
  assert.equal(topUpLimit(nov, m, "sacrifice", 11, today), 4208);
  const withBonus = { ...base, bonusAmount: "10000", bonusMonth: "3" };
  assert.equal(topUpLimit(withBonus, calcMetrics(withBonus), "sacrifice", 3, today), 18708);
  // Relief at source: up to earnings after salary sacrifice, £104,500 here.
  assert.equal(topUpLimit(nov, m, "relief", 10, today), 100000);
  // Paydays still to come on 8 October, on the 28th: October to March.
  assert.deepEqual(topUpMonths(withBonus, today).map(x => x.month), [10, 11, 12, 1, 2, 3]);
  assert.equal(topUpMonths(withBonus, today).find(x => x.bonus).month, 3);
  // The annual allowance: what's paid in each month plus the top-ups.
  const room = calcAnnualAllowanceRoom(base, m);
  assert.equal(allowanceLeft(nov, m, today), room.room - 4500);
  assert.equal(pastAllowance(nov, m, room.room - 4500, today).over, 0);
  assert.equal(pastAllowance(nov, m, room.room - 4500 + 1000, today).over, 1000);
  assert.equal(pastAllowance(nov, m, 0, today).allowance, 60000);
});

test("spread over the paydays left: the same each month, and the pension % that comes to", async () => {
  const { monthlyPlan, monthlyPay, yearProjection } = await import("./taxTrap.js");
  const today = new Date(2026, 9, 8);
  const m = calcMetrics(base);
  // £4,500 over 6 paydays (October to March, on the 28th): £750 a month, an
  // extra 8.2% of £110,000's £9,167 a month, so 5% to 13.2%.
  const plan = monthlyPlan(base, m, 4500, today);
  assert.equal(plan.n, 6);
  assert.equal(plan.monthly, 750);
  assert.equal(plan.pctTo, 13.2);
  assert.equal(plan.pctFor(0), 5);
  // Recorded a payday each: the year comes to £100,000.
  const ups = plan.months.map(x => ({ id: `p${x.month}`, group: "p", amount: plan.monthly, route: "sacrifice", month: x.month, taxYear: 2026 }));
  assert.equal(yearProjection({ ...base, trapTopUps: ups }, m, today).projected, 100000);
  // The slider's top: a month's pay after the 5% sacrificed.
  assert.equal(monthlyPay(base, m), 8708);
});
