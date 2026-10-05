import { test } from "node:test";
import assert from "node:assert/strict";
import { calcBorrowingCheck, suggestedCashAvailable, borrowingInputs, multipleBar, DEFAULT_PROPERTY_FEES, calcMaxPrice, maxPriceFor } from "./borrowing.js";

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
  const r = borrowingInputs({ propertyPrice: "250000", propertyRegion: "scotland", propertyCashAvailable: "40000", propertyFees: "0", propertyStampDuty: "2500" }, m);
  assert.equal(r.cashAvailable, 40000);
  assert.equal(r.fees, 0);
  assert.equal(r.stampDuty, 2500);
});

test("borrowingInputs: buying together adds the partner's income", () => {
  const d = { propertyBuyingMode: "together", partnerSalary: "35000", partnerOtherIncome: "2000" };
  assert.deepEqual(borrowingInputs(d, m).incomes, [50000, 37000]);
  assert.deepEqual(borrowingInputs({ ...d, propertyBuyingMode: "alone" }, m).incomes, [50000]);
});

test("borrowingInputs: stamp duty is calculated in England, ignoring any typed figure", () => {
  const r = borrowingInputs({ propertyPrice: "300000", propertyRegion: "london", propertyFirstTimeBuyer: "no", propertyStampDuty: "999" }, m);
  assert.equal(r.stampDuty, 5000);
  assert.equal(r.stampDutyDetail.supported, true);
});

test("borrowingInputs: first-time buyer relief needs both joint buyers to qualify", () => {
  const d = { propertyPrice: "300000", propertyRegion: "north_west", propertyBuyingMode: "together", propertyFirstTimeBuyer: "yes", partnerFirstTimeBuyer: "yes" };
  assert.equal(borrowingInputs(d, m).stampDuty, 0);
  assert.equal(borrowingInputs({ ...d, partnerFirstTimeBuyer: "no" }, m).stampDuty, 5000);
});

test("borrowingInputs: unanswered first-time buyer status never assumes relief", () => {
  assert.equal(borrowingInputs({ propertyPrice: "300000", propertyRegion: "london" }, m).stampDuty, 5000);
});

test("borrowingInputs: not the only property adds the surcharge", () => {
  assert.equal(borrowingInputs({ propertyPrice: "300000", propertyRegion: "london", propertyFirstTimeBuyer: "no", propertySoleProperty: "no" }, m).stampDuty, 20000);
});

test("borrowingInputs: no location yet means no stamp duty and no breakdown", () => {
  const r = borrowingInputs({ propertyPrice: "300000", propertyStampDuty: "4000" }, m);
  assert.equal(r.stampDuty, 0);
  assert.equal(r.stampDutyDetail, null);
});

test("borrowingInputs: suggested cash available includes Cash ISAs", () => {
  const r = borrowingInputs({ propertyPrice: "250000", isaPrevCash: "8000", isaThisYearCash: "2000" }, m);
  assert.equal(r.cashAvailable, 34000);
});

test("deposit short: how far the deposit is below 5% of the price", () => {
  assert.equal(calcBorrowingCheck({ price: 300000, cashAvailable: 10000, stampDuty: 0, fees: 2500, incomes: [80000] }).depositShort, 7500);
  assert.equal(calcBorrowingCheck({ price: 300000, cashAvailable: 17500, stampDuty: 0, fees: 2500, incomes: [80000] }).depositShort, 0);
  assert.equal(calcBorrowingCheck({ price: 100000, cashAvailable: 200000, incomes: [] }).depositShort, 0);
});

const buyer = { propertyBuyingMode: "alone", propertyRegion: "london", propertyFirstTimeBuyer: "yes", propertyFees: "2500" };
const metrics = salary => ({ salary, totalLiquid: 0, expenses: 0 });

test("max price: income sets it when the deposit is big enough", () => {
  // 4.5 x 45,000 = 202,500 loan, plus 30,000 less 2,500 fees; no stamp duty
  // for a first-time buyer under 300,000.
  const r = maxPriceFor({ ...buyer, propertyCashAvailable: "30000" }, metrics(45000));
  assert.deepEqual([r.price, r.limit, r.loan, r.deposit], [230000, "income", 202500, 27500]);
});

test("max price: the deposit sets it when it's under 5% of what income would allow", () => {
  // 12,500 deposit is 5% of 250,000, though 4.5x income would lend 360,000.
  const r = maxPriceFor({ ...buyer, propertyCashAvailable: "15000" }, metrics(80000));
  assert.deepEqual([r.price, r.limit], [250000, "deposit"]);
});

test("max price: stamp duty is worked out at each price, including first-time buyer relief stopping at £500,000", () => {
  const r = maxPriceFor({ ...buyer, propertyCashAvailable: "120000" }, metrics(90000));
  assert.equal(r.price, 507000);
  assert.equal(r.stampDuty, 15350);
  const check = calcBorrowingCheck(borrowingInputs({ ...buyer, propertyCashAvailable: "120000", propertyPrice: String(r.price) }, metrics(90000)));
  assert.ok(check.loanNeeded <= 405000 && check.depositShort === 0);
  const over = calcBorrowingCheck(borrowingInputs({ ...buyer, propertyCashAvailable: "120000", propertyPrice: String(r.price + 1000) }, metrics(90000)));
  assert.ok(over.loanNeeded > 405000);
});

test("max price: some lenders' 5.5x for higher earners raises it", () => {
  assert.equal(maxPriceFor({ ...buyer, propertyCashAvailable: "120000" }, metrics(90000), 5.5).price, 592000);
});

test("max price: Scotland and Wales use the user's own tax figure; buying together adds incomes", () => {
  assert.equal(maxPriceFor({ ...buyer, propertyRegion: "scotland", propertyStampDuty: "3000", propertyCashAvailable: "30000" }, metrics(45000)).price, 227000);
  assert.equal(maxPriceFor({ ...buyer, propertyBuyingMode: "together", partnerSalary: "45000", partnerFirstTimeBuyer: "yes", propertyCashAvailable: "60000" }, metrics(45000)).price, 454000); // 405,000 + 57,500 - 5% stamp duty above 300,000
});

test("max price: nothing to buy with until cash covers the fees, and no figure without income", () => {
  assert.deepEqual(calcMaxPrice({ cashAvailable: 1000, fees: 2500, incomes: [90000] }).price, 0);
  assert.equal(calcMaxPrice({ cashAvailable: 30000, incomes: [] }), null);
});
