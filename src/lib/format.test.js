import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtK1, fmtCompact } from "./format.js";

test("fmtK1: £X.Xk with one decimal, in full below £1,000, £X.XXm from a million", () => {
  assert.equal(fmtK1(0), "£0");
  assert.equal(fmtK1(850), "£850");
  assert.equal(fmtK1(25000), "£25.0k");
  assert.equal(fmtK1(145500), "£145.5k");
  assert.equal(fmtK1(18549), "£18.5k");
  assert.equal(fmtK1(-6500), "£6.5k");
  assert.equal(fmtK1(999960), "£1.00m");
  assert.equal(fmtK1(1234567), "£1.23m");
});

test("fmtCompact: whole £k from £10,000, one decimal below", () => {
  assert.equal(fmtCompact(150), "£150");
  assert.equal(fmtCompact(7500), "£7.5k");
  assert.equal(fmtCompact(9000), "£9k");
  assert.equal(fmtCompact(20000), "£20k");
});
