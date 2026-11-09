import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULE_EXPLAINERS } from "./moduleExplainer.js";
import { calcMetrics } from "./metrics.js";
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
