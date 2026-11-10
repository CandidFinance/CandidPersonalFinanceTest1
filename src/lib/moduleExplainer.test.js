import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULE_EXPLAINERS } from "./moduleExplainer.js";
import { calcMetrics } from "./metrics.js";
import { calcCashOptimisation } from "./cash.js";
import { fmt } from "./format.js";

const base = { selectedModules: ["investments"], salary: "45000", age: "31", monthlyExpenses: "2000" };
const higher = { ...base, salary: "80000" };
const pages = d => MODULE_EXPLAINERS.investments(d, calcMetrics(d));
const words = list => list.flatMap(p => [p.title, ...p.blocks.flatMap(b => [b.intro, ...Object.values(b.labels)])]).join(" ");
const block = (list, id) => list.flatMap(p => p.blocks).find(b => b.id === id);

test("Investments: six pages, ending on the user's own figures", () => {
  assert.deepEqual(pages(base).map(p => p.id), ["what", "gain", "isa", "outside", "reset", "yours"]);
});

test("Investments: says the value can fall, and never directs", () => {
  const all = words(pages(base));
  assert.match(all, /can also fall/);
  assert.match(all, /less than you put in/);
  assert.doesNotMatch(all, /\b(should|optimal|effective|best way|you must|advice)\b/i);
});

test("Investments: every page opens with its explainer text and fills the page", () => {
  for (const p of pages(base)) {
    assert.equal(p.blocks.length, 1, p.id);
    assert.ok(p.blocks[0].intro.length > 20, p.id);
    assert.equal(p.blocks[0].fill, true, p.id);
  }
});

test("Investments: the examples' tax follows the user's rate", () => {
  const b = pages(base), h = pages(higher);
  assert.equal(block(b, "gain-scene").tax, 1.8);
  assert.equal(block(h, "gain-scene").tax, 2.4);
  assert.equal(block(b, "outside-scene").tax, 360);
  assert.equal(block(h, "outside-scene").tax, 480);
  assert.match(block(b, "gain-scene").intro, /18%/);
  assert.match(block(b, "gain-scene").labels.captionSplit, /£1\.80/);
  assert.match(block(h, "gain-scene").labels.captionSplit, /£2\.40/);
  assert.match(block(h, "gain-scene").intro, /24%/);
});

test("Investments: the share's 30 movements start and end where the example says", () => {
  const { points, start, end } = block(pages(base), "what-scene");
  assert.equal(points.length, 31);
  assert.equal(points[0], start);
  assert.equal(points[30], end);
});

test("Investments: every split adds back up", () => {
  for (const d of [base, higher]) {
    const list = pages(d);
    const g = block(list, "gain-scene");
    assert.equal(g.keep + g.tax, g.gain);
    const c = block(list, "isa-scene");
    assert.equal(c.received + c.tax, c.end);
    const w = block(list, "outside-scene");
    assert.equal(w.value - w.invested, w.gain);
    assert.equal(w.exempt + w.taxable, w.gain);
    assert.equal(w.tax + w.kept, w.taxable);
    assert.equal(w.received, w.exempt + w.kept);
  }
});

test("Investments: the full-ISA example is 10% of the allowance at the user's rate", () => {
  assert.equal(block(pages(base), "isa-scene").exampleSaved, 360);
  assert.equal(block(pages(higher), "isa-scene").exampleSaved, 480);
});

test("Investments: the gain goes 'To you', whatever the user's name", () => {
  const w = block(pages({ ...base, name: "Alexandria-Rose" }), "outside-scene");
  assert.equal(w.labels.toUser, "To you");
  assert.equal(w.labels.receiveTitle, "You receive");
});

test("Investments: the two allowances reach the last day at different levels", () => {
  const [isa, cgt] = block(pages(base), "reset-scene").meters;
  assert.ok(cgt.nearly / cgt.full < isa.nearly / isa.full);
  assert.ok(isa.nearly < isa.full);
});

test("Investments: allowances left and used are the engine's", () => {
  const m = calcMetrics(base);
  const list = MODULE_EXPLAINERS.investments(base, m);
  assert.equal(block(list, "isa-scene").labels.captionUsed, `You have ${fmt(m.isaHeadroom)} left this tax year.`);
  const [isa, cgt] = block(list, "yours-scene").bars;
  assert.equal(isa.unused, m.isaHeadroom);
  assert.equal(isa.used + isa.unused, isa.limit);
  assert.equal(cgt.unused, m.remainingCgtAllowance);
  assert.equal(cgt.used + cgt.unused, cgt.limit);
});

test("Investments: the label riding each bar is short, and never £0k", () => {
  const [none] = block(pages(base), "yours-scene").bars;
  assert.equal(none.usedShort, "£0");
  const d = { ...base, hasCashIsaThisYear: "yes", isaThisYearCash: "5000" };
  const [isa] = block(pages(d), "yours-scene").bars;
  assert.equal(isa.usedShort, "£5k");
});

const cashD = { selectedModules: ["cash"], salary: "45000", age: "31", monthlyExpenses: "2000", cashTiers: [{ amount: "10000", rate: "2" }], hasCashIsaThisYear: "yes", isaThisYearCash: "5000" };
const cashHigher = { ...cashD, salary: "80000" };
const cashTop = { ...cashD, salary: "150000" };
const cashPages = (d, ctx) => MODULE_EXPLAINERS.cash(d, calcMetrics(d), ctx);

test("Cash: six pages, ending on the user's own figures", () => {
  assert.deepEqual(cashPages(cashD).map(p => p.id), ["rates", "tax", "isa", "bonds", "emergency", "yours"]);
  for (const p of cashPages(cashD)) assert.equal(p.blocks[0].fill, true, p.id);
});

test("Cash: facts only, and says what a prize isn't", () => {
  const all = words(cashPages(cashD));
  assert.doesNotMatch(all, /\b(should|optimal|effective|best way|you must|advice)\b/i);
  assert.match(all, /aren't guaranteed/);
  assert.match(all, /rainy day/);
});

test("Cash: the example rates are 2.5% and 4%", () => {
  const r = block(cashPages(cashD), "rates-scene");
  assert.deepEqual([r.amount, r.lowInterest, r.highInterest, r.difference], [20000, 500, 800, 300]);
});

test("Cash: interest tax follows the user's band and adds back up", () => {
  const expected = [[cashD, 1000, 40, 1160], [cashHigher, 500, 280, 920], [cashTop, 0, 540, 660]];
  for (const [d, exempt, tax, received] of expected) {
    const t = block(cashPages(d), "tax-scene");
    assert.deepEqual([t.interest, t.exempt, t.tax, t.received], [1200, exempt, tax, received]);
    assert.equal(t.exempt + t.taxable, t.interest);
    assert.equal(t.tax + t.kept, t.taxable);
    assert.equal(t.received, t.exempt + t.kept);
  }
});

test("Cash: no allowance is said plainly at the additional rate", () => {
  const t = block(cashPages(cashTop), "tax-scene");
  assert.match(t.intro, /no allowance/);
  assert.equal(t.labels.captionExempt, "None of it is tax-free.");
  assert.doesNotMatch(t.labels.receiveWorking, /\+/);
});

test("Cash: the ISA example uses the engine's limit and the user's rate", () => {
  const c = block(cashPages(cashHigher), "isa-scene");
  assert.deepEqual([c.amount, c.interest, c.tax, c.received, c.saved], [20000, 800, 320, 480, 320]);
  assert.equal(c.received + c.tax, c.interest);
});

test("Cash: Premium Bonds use the live rate, else the fallback", () => {
  const live = { marketRates: { rows: [{ account_type: "Premium Bonds", rate_aer: "3.60" }] } };
  assert.equal(block(cashPages(cashD, live), "bonds-scene").rateText, "3.60%");
  assert.equal(block(cashPages(cashD), "bonds-scene").rateText, "4.35%");
  assert.equal(block(cashPages(cashD), "bonds-scene").draws.length, 12);
});

test("Cash: a year's prizes add up, and match the prize fund rate to the nearest £25", () => {
  const prizes = rows => block(cashPages(cashD, rows ? { marketRates: { rows } } : undefined), "bonds-scene");
  for (const [rows, total] of [[null, 875], [[{ account_type: "Premium Bonds", rate_aer: "3.60" }], 725]]) {
    const b = prizes(rows);
    assert.equal(b.total, total);
    assert.equal(b.draws.reduce((sum, d) => sum + d.prize, 0), total);
    assert.equal(b.amount, 20000);
    assert.ok(b.draws.every(d => d.prize % 25 === 0));
    assert.ok(b.labels.sumLine.includes(fmt(total)));
  }
});

test("Cash: the emergency fund markers are months times the example costs", () => {
  const { markers, monthly } = block(cashPages(cashD), "emergency-scene");
  assert.deepEqual(markers.map(k => k.amount), [3, 6, 9].map(n => n * monthly));
  for (const k of markers) assert.ok(k.hint.length > 10, k.label);
});

test("Cash: allowances on the last page are the engine's and add up", () => {
  const m = calcMetrics(cashD);
  const [isa, psa] = block(MODULE_EXPLAINERS.cash(cashD, m), "yours-scene").bars;
  assert.equal(isa.label, "ISA allowance");
  assert.equal(isa.unused, m.isaHeadroom);
  assert.equal(isa.used + isa.unused, isa.limit);
  assert.equal(psa.limit, 1000);
  assert.equal(psa.used, 200);
  assert.equal(psa.used + psa.unused, psa.limit);
});

test("Cash: the bar counts every ISA payment, so it's labelled the ISA allowance", () => {
  const d = { ...cashD, isaThisYearCash: "2000", hasOtherIsaThisYear: "yes", isaThisYearOther: "3000" };
  const m = calcMetrics(d);
  const [isa] = block(MODULE_EXPLAINERS.cash(d, m), "yours-scene").bars;
  assert.equal(isa.used, 20000 - m.isaHeadroom);
  assert.equal(isa.used + isa.unused, 20000);
});

test("Cash: tax-free interest matches the Cash answer on a low income", () => {
  const low = { ...cashD, salary: "15000" };
  const m = calcMetrics(low);
  const list = MODULE_EXPLAINERS.cash(low, m);
  const t = block(list, "tax-scene");
  const expected = calcCashOptimisation(m, null, null).psaLimit;
  assert.ok(expected > 1000);
  assert.equal(t.exempt, Math.min(expected, t.interest));
  assert.deepEqual([t.taxable, t.tax, t.received], [0, 0, 1200]);
  assert.equal(t.labels.captionSplit, "Nothing goes to HMRC.");
  assert.equal(t.labels.receiveWorking, "");
  assert.match(t.intro, new RegExp(fmt(expected).replace("£", "£")));
  const [, allowance] = block(list, "yours-scene").bars;
  assert.equal(allowance.limit, expected);
  assert.equal(allowance.used + allowance.unused, allowance.limit);
});
