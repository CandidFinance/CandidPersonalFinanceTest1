import { test } from "node:test";
import assert from "node:assert/strict";
import { calcIncomeTax } from "../../src/lib/tax.js";
import * as R from "./rules.js";
import { simulate, TODAY, pensionAfterTax } from "./engine.js";
import { ARCHETYPES } from "./archetypes.js";

const arch = id => ARCHETYPES.find(a => a.id === id);
const gapAt = (run, base, t) => run.rows[t - 1].netWorth - base.rows[t - 1].netWorth;

test("the model's income tax matches the app's for 2026/27", () => {
  const th = R.thresholds("base", 1);
  for (const income of [0, 12570, 30000, 50270, 75000, 100000, 110000, 125140, 150000, 250000]) {
    assert.equal(Math.round(R.incomeTax(income, th)), calcIncomeTax(income), `£${income}`);
  }
});

test("thresholds stay frozen to April 2031, then rise by about half of five years' inflation", () => {
  assert.equal(R.thresholds("base", 5).pa, 12570); // 2030/31
  const review = R.thresholds("base", 6);          // 2031/32
  assert.ok(review.pa > 13200 && review.pa < 13450, review.pa);
  assert.ok(review.hrt > 53000 && review.hrt < 53500, review.hrt);
  assert.equal(review.taperStart, 100000);
  assert.equal(review.additional, 125140);
});

test("the price rises 15% every three years, to about £11.54 by year 20", () => {
  assert.equal(R.monthlyPrice(1), 4.99);
  assert.equal(R.monthlyPrice(4), 5.74);
  assert.equal(R.monthlyPrice(20), 11.54);
});

test("the churn curve's shares add up to everyone", () => {
  let total = 0;
  for (let k = 1; k < R.YEARS; k++) total += R.survival(k - 1) - R.survival(k);
  total += R.survival(R.YEARS - 1);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("a member who acts on nothing is behind only by the subscription", () => {
  const a = arch("margaret");
  const base = simulate(a, {});
  const idle = simulate(a, { levers: TODAY, actionRate: 0 });
  const gap = gapAt(idle, base, 20);
  assert.ok(gap < 0 && gap > -2 * idle.feesReal, `${gap} against fees of ${idle.feesReal}`);
});

test("the same inputs give the same results", () => {
  const a = arch("callum");
  const one = simulate(a, { levers: TODAY, actionRate: 0.8 }), two = simulate(a, { levers: TODAY, actionRate: 0.8 });
  assert.deepEqual(one.rows.map(r => r.netWorth), two.rows.map(r => r.netWorth));
});

test("someone who already does it all gains next to nothing", () => {
  const a = arch("oliver");
  const gap = gapAt(simulate(a, { levers: TODAY, actionRate: 0.8 }), simulate(a, {}), 20);
  assert.ok(Math.abs(gap) < 1000, gap);
});

test("cash-rich savers gain from better rates, and gain more when rates are higher", () => {
  const a = arch("margaret");
  const benefit = path => gapAt(simulate(a, { path, levers: ["cash"], actionRate: 0.8 }), simulate(a, { path }), 20);
  assert.ok(benefit("base") > 50000);
  assert.ok(benefit("low") < benefit("base"));
  assert.ok(benefit("high") > benefit("base"));
});

test("pensions are valued after the tax due on drawing them", () => {
  assert.equal(Math.round(pensionAfterTax(100000)), 85000);
  assert.equal(Math.round(pensionAfterTax(600000)), 500000 * 0.85 + 100000 * 0.7);
});
