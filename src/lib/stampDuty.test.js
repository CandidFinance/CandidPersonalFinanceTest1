import { test } from "node:test";
import assert from "node:assert/strict";
import { calcStampDuty } from "./stampDuty.js";

const sdlt = (price, opts = {}) => calcStampDuty({ price, nation: "england", firstTimeBuyers: [false], ...opts });

test("standard rates: nothing up to £125,000", () => {
  assert.equal(sdlt(125000).total, 0);
});

test("standard rates: 2% from £125,001 and 5% from £250,001", () => {
  assert.equal(sdlt(250000).total, 2500);
  assert.equal(sdlt(300000).total, 5000);
});

test("standard rates: 10% from £925,001 and 12% above £1.5m", () => {
  // 2,500 + 33,750 + 57,500 + 12,000
  assert.equal(sdlt(1600000).total, 105750);
});

test("first-time buyer: nothing up to £300,000, then 5% to £500,000", () => {
  assert.equal(sdlt(300000, { firstTimeBuyers: [true] }).total, 0);
  assert.equal(sdlt(400000, { firstTimeBuyers: [true] }).total, 5000);
  assert.equal(sdlt(500000, { firstTimeBuyers: [true] }).total, 10000);
  assert.equal(sdlt(500000, { firstTimeBuyers: [true] }).reliefApplies, true);
});

test("first-time buyer: the £500,000 cliff loses the relief entirely", () => {
  const over = sdlt(500001, { firstTimeBuyers: [true] });
  assert.equal(over.reliefApplies, false);
  assert.equal(over.reliefLostOverCap, true);
  // Standard rates on £500,001: 2,500 + 12,500.05, rounded down.
  assert.equal(over.total, 15000);
});

test("additional property: +5 points on every band", () => {
  // 125,000 x 5% + 125,000 x 7% + 50,000 x 10%
  const r = sdlt(300000, { additionalProperty: true });
  assert.equal(r.total, 20000);
  assert.equal(r.surcharge, 0.05);
});

test("additional property: no surcharge under £40,000", () => {
  assert.equal(sdlt(39999, { additionalProperty: true }).total, 0);
  assert.equal(sdlt(40000, { additionalProperty: true }).total, 2000);
});

test("additional property: a first-time buyer keeping another home gets no relief", () => {
  const r = sdlt(300000, { firstTimeBuyers: [true], additionalProperty: true });
  assert.equal(r.reliefApplies, false);
  assert.equal(r.total, 20000);
});

test("joint buyers: relief only when both are first-time buyers", () => {
  assert.equal(sdlt(400000, { firstTimeBuyers: [true, true] }).total, 5000);
  const one = sdlt(400000, { firstTimeBuyers: [true, false] });
  assert.equal(one.total, 10000);
  assert.equal(one.reliefNeedsAllBuyers, true);
});

test("Northern Ireland uses the same rates", () => {
  assert.equal(calcStampDuty({ price: 300000, nation: "northern_ireland", firstTimeBuyers: [false] }).total, 5000);
});

test("Scotland and Wales aren't calculated", () => {
  assert.equal(calcStampDuty({ price: 300000, nation: "scotland" }).supported, false);
  assert.equal(calcStampDuty({ price: 300000, nation: "wales" }).supported, false);
});

test("the breakdown adds up to the total", () => {
  const r = sdlt(1000000);
  assert.equal(Math.floor(r.breakdown.reduce((s, b) => s + b.tax, 0)), r.total);
  assert.deepEqual(r.breakdown.map(b => b.rate), [0, 0.02, 0.05, 0.10]);
});
