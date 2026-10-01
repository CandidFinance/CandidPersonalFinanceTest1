import { test } from "node:test";
import assert from "node:assert/strict";
import { calcBorrowingCheck, suggestedCashAvailable, borrowingInputs, multipleBar, DEFAULT_PROPERTY_FEES } from "./borrowing.js";

test("usable deposit is cash available less stamp duty and fees", () => {
  const r = calcBorrowingCheck({ price: 300000, cashAvailable: 40000, stampDuty: 5000, fees: 2500, incomes: [60000] });
  assert.equal(r.usableDeposit, 32500);
  assert.equal(r.loanNeeded, 267500);
});

test("fees default to £2,500", () => {
  const r = calcBorrowingCheck({ price: 300000, cashAvailable: 40000, incomes: [60000] });
  assert.equal(r.upfrontCosts, DEFAULT_PROPERTY_FEES);
  assert.equal(r.usableDeposit, 37500);
});

test("no warning just under 4.5x income", () => {
  // Loan needed 269,999 vs 4.5 x 60,000 = 270,000.
  const r = calcBorrowingCheck({ price: 299999, cashAvailable: 30000, stampDuty: 0, fees: 0, incomes: [60000] });
  assert.equal(r.loanNeeded, 269999);
  assert.equal(r.warn, false);
});

test("no warning at exactly 4.5x income", () => {
  const r = calcBorrowingCheck({ price: 300000, cashAvailable: 30000, stampDuty: 0, fees: 0, incomes: [60000] });
  assert.equal(r.multiple, 4.5);
  assert.equal(r.warn, false);
});

test("warning just over 4.5x income", () => {
  const r = calcBorrowingCheck({ price: 300001, cashAvailable: 30000, stampDuty: 0, fees: 0, incomes: [60000] });
  assert.equal(r.warn, true);
  assert.equal(r.gapAboveMultiple, 1);
});

test("band: within up to and including 4.5x", () => {
  assert.equal(calcBorrowingCheck({ price: 300000, cashAvailable: 30000, stampDuty: 0, fees: 0, incomes: [60000] }).band, "within");
});

test("band: stretch above 4.5x up to and including 5.5x", () => {
  assert.equal(calcBorrowingCheck({ price: 300001, cashAvailable: 30000, stampDuty: 0, fees: 0, incomes: [60000] }).band, "stretch");
  // Loan 330,000 = exactly 5.5 x 60,000.
  assert.equal(calcBorrowingCheck({ price: 360000, cashAvailable: 30000, stampDuty: 0, fees: 0, incomes: [60000] }).band, "stretch");
});

test("band: beyond above 5.5x", () => {
  assert.equal(calcBorrowingCheck({ price: 360001, cashAvailable: 30000, stampDuty: 0, fees: 0, incomes: [60000] }).band, "beyond");
});

test("band: a cash purchase is within, and no income gives no band", () => {
  assert.equal(calcBorrowingCheck({ price: 150000, cashAvailable: 200000, incomes: [] }).band, "within");
  assert.equal(calcBorrowingCheck({ price: 200000, cashAvailable: 20000, incomes: [] }).band, null);
});

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("bar: within 4.5x fills green only", () => {
  const b = multipleBar(3);
  assert.equal(b.scaleMax, 7);
  assert.deepEqual(b.segments.map(s => s.band), ["within"]);
  close(b.segments[0].width, (3 / 7) * 100);
});

test("bar: between 4.5x and 5.5x fills green then orange", () => {
  const b = multipleBar(5);
  assert.deepEqual(b.segments.map(s => s.band), ["within", "stretch"]);
  close(b.segments[0].width, (4.5 / 7) * 100);
  close(b.segments[1].left, (4.5 / 7) * 100);
  close(b.segments[1].width, (0.5 / 7) * 100);
});

test("bar: above 5.5x fills green, orange then red", () => {
  const b = multipleBar(8);
  close(b.scaleMax, 8.8);
  assert.deepEqual(b.segments.map(s => s.band), ["within", "stretch", "beyond"]);
  close(b.segments[2].left + b.segments[2].width, (8 / 8.8) * 100);
  assert.equal(b.capped, false);
});

test("bar: the scale stops at 10x and anything above is full and capped", () => {
  const b = multipleBar(14);
  assert.equal(b.scaleMax, 10);
  assert.equal(b.capped, true);
  close(b.segments[2].left + b.segments[2].width, 100);
  close(b.markers[0].pct, 45);
  close(b.markers[1].pct, 55);
  assert.equal(multipleBar(10).capped, false);
});

test("stamp duty and fees can tip the loan over 4.5x", () => {
  const without = calcBorrowingCheck({ price: 300000, cashAvailable: 30000, stampDuty: 0, fees: 0, incomes: [60000] });
  const withCosts = calcBorrowingCheck({ price: 300000, cashAvailable: 30000, stampDuty: 5000, fees: 2500, incomes: [60000] });
  assert.equal(without.warn, false);
  assert.equal(withCosts.warn, true);
  assert.equal(withCosts.loanNeeded, 277500);
});

test("joint buyers: incomes are combined", () => {
  const alone = calcBorrowingCheck({ price: 400000, cashAvailable: 40000, stampDuty: 0, fees: 0, incomes: [50000] });
  const together = calcBorrowingCheck({ price: 400000, cashAvailable: 40000, stampDuty: 0, fees: 0, incomes: [50000, 35000] });
  assert.equal(together.income, 85000);
  assert.equal(alone.warn, true);
  assert.equal(together.warn, false);
});

test("cash that doesn't cover stamp duty and fees leaves no deposit", () => {
  const r = calcBorrowingCheck({ price: 250000, cashAvailable: 3000, stampDuty: 2500, fees: 2500, incomes: [80000] });
  assert.equal(r.usableDeposit, 0);
  assert.equal(r.upfrontShortfall, 2000);
  assert.equal(r.loanNeeded, 250000);
});

test("no income recorded warns on any loan", () => {
  assert.equal(calcBorrowingCheck({ price: 200000, cashAvailable: 20000, incomes: [] }).warn, true);
  assert.equal(calcBorrowingCheck({ price: 200000, cashAvailable: 20000, incomes: [] }).multiple, null);
});

test("a cash purchase needs no loan and no warning", () => {
  const r = calcBorrowingCheck({ price: 150000, cashAvailable: 200000, stampDuty: 0, fees: 2500, incomes: [] });
  assert.equal(r.loanNeeded, 0);
  assert.equal(r.warn, false);
});

test("suggested cash available keeps 3 months of expenses back", () => {
  assert.equal(suggestedCashAvailable(30000, 2000), 24000);
  assert.equal(suggestedCashAvailable(4000, 2000), 0);
});

// ── borrowingInputs: reading Candid's own saved inputs ─────────────────────

const m = { salary: 50000, totalLiquid: 30000, expenses: 2000 };

test("borrowingInputs: blank cash available and fees use their starting values", () => {
  const r = borrowingInputs({ propertyPrice: "250000", otherIncome: "5000", propertyCashAvailable: "", propertyFees: "" }, m);
  assert.equal(r.cashAvailable, 24000);
  assert.equal(r.fees, DEFAULT_PROPERTY_FEES);
  assert.deepEqual(r.incomes, [55000]);
});

test("borrowingInputs: the user's own figures win, including zero", () => {
  const r = borrowingInputs({ propertyPrice: "250000", propertyCashAvailable: "40000", propertyFees: "0", propertyStampDuty: "2500" }, m);
  assert.equal(r.cashAvailable, 40000);
  assert.equal(r.fees, 0);
  assert.equal(r.stampDuty, 2500);
});

test("borrowingInputs: buying together adds the partner's income", () => {
  const d = { propertyBuyingMode: "together", partnerSalary: "35000", partnerOtherIncome: "2000" };
  assert.deepEqual(borrowingInputs(d, m).incomes, [50000, 37000]);
  assert.deepEqual(borrowingInputs({ ...d, propertyBuyingMode: "alone" }, m).incomes, [50000]);
});
