import test from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { taxTrap, position, marginalRate, allowanceLost, trapInView } from "./taxTrap.js";

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

test("over £100,000: the allowance lost, the childcare that stops, and the module's £", () => {
  const { t } = at(base);
  assert.equal(t.needed, 4500);
  assert.deepEqual(t.allowance, { lost: 2250, tax: 900 });
  // £2,000 of Tax-Free Childcare and £8,290 of funded hours.
  assert.equal(t.childcareLost, 10290);
  // 60% tax and 2% NI on the £4,500, and the childcare.
  assert.equal(t.amount, 2790 + 10290);
});

test("the ways back: what each costs in take-home, and the childcare it brings back", () => {
  const { t } = at(base);
  const way = k => t.options.find(o => o.key === k);
  // Salary sacrifice saves the 62%: £4,500 costs £1,710 of take-home.
  assert.equal(way("pension").takeHome, 1710);
  assert.equal(way("pension").route, "sacrifice");
  // Gift Aid saves the 60% tax, not the NI.
  assert.equal(way("giftAid").takeHome, 1800);
  assert.equal(way("sacrifice").perPound, 38);
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

test("in view near or over £100,000, or heading there; not with no salary", () => {
  assert.ok(trapInView({ salary: "90000" }));
  assert.ok(!trapInView({ salary: "70000" }));
  assert.ok(!trapInView({ salary: "120000", employmentStatus: "not_working" }));
  assert.equal(taxTrap({ salary: "" }, calcMetrics({ salary: "" })), null);
  assert.equal(pct(marginalRate(base, calcMetrics(base)).rate), 62);
});
