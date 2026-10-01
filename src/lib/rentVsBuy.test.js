import { test } from "node:test";
import assert from "node:assert/strict";
import { calcRentVsBuy, rentVsBuyInputs, partnerSavingsEstimate, SELLING_COSTS_PCT } from "./rentVsBuy.js";
import { mortgageSchedule } from "./mortgage.js";
import { calcMetrics } from "./metrics.js";

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);
const you = (over = {}) => ({ who: "you", isaHeadroom: 20000, isaCapacity: 20000, share: 1, taxBand: "basic", ...over });
const base = (over = {}) => ({
  horizonYears: 5, price: 300000, upfront: 37500,
  mortgage: { loan: 270000, termYears: 30, fixedYears: 5, ratePct: 4.5, remortgageFee: 1000 },
  housePriceGrowthPct: 3, tenure: "freehold", groundRent: 0, groundRentGrowthPct: 0, serviceCharge: 0,
  monthlyRent: 1300, rentGrowthPct: 3.5, investmentReturnPct: 5, dividendYieldPct: 2,
  people: [you()],
  ...over,
});

// ── Buyer ─────────────────────────────────────────────────────────────────

test("buyer: net wealth is value less selling costs less the mortgage still owed", () => {
  const r = calcRentVsBuy(base());
  const balance = mortgageSchedule(base().mortgage).years[0].balance;
  near(r.years[0].buyerWealth, 300000 * 1.03 * (1 - SELLING_COSTS_PCT / 100) - balance);
});

test("buyer: monthly cost is the mortgage plus running costs", () => {
  const r = calcRentVsBuy(base());
  const c = r.firstYearCosts;
  near(c.maintenance, 300000 * 0.01 / 12, 0.01);
  near(c.monthlyTotal, c.mortgagePayment + c.maintenance, 0.01);
});

test("buyer: leasehold adds ground rent and service charge, with flat-rate maintenance", () => {
  const c = calcRentVsBuy(base({ tenure: "leasehold", groundRent: 250, serviceCharge: 1800 })).firstYearCosts;
  near(c.maintenance, 100, 0.01);
  near(c.groundRent, 250 / 12, 0.01);
  near(c.serviceCharge, 150, 0.01);
});

test("buyer: payments stop once the mortgage is paid off", () => {
  const r = calcRentVsBuy(base({ horizonYears: 7, mortgage: { loan: 50000, termYears: 5, fixedYears: 5, ratePct: 4.5, remortgageFee: 0 } }));
  assert.equal(r.years[6].mortgageBalance, 0);
  near(r.years[6].buyerMonthlyCost, 300000 * Math.pow(1.03, 6) * 0.01 / 12, 0.01);
});

// ── Renter: ISAs and tax ──────────────────────────────────────────────────

test("renter: the upfront sum fills the remaining ISA allowance, the rest goes outside", () => {
  // Rent above the buyer's cost, so nothing more is paid in after day one.
  const r = calcRentVsBuy(base({ upfront: 40000, monthlyRent: 99999, people: [you({ isaHeadroom: 15000 })] }));
  near(r.isaPaidIn, 15000, 0.001);
  near(r.outsideIsaPaidIn, 25000, 0.001);
});

test("renter: a fully used ISA allowance sends the upfront sum outside an ISA", () => {
  const r = calcRentVsBuy(base({ upfront: 30000, monthlyRent: 99999, people: [you({ isaHeadroom: 0, isaCapacity: 0 })] }));
  near(r.isaPaidIn, 0, 0.001);
});

test("renter: everything inside an ISA pays no tax", () => {
  const r = calcRentVsBuy(base({ upfront: 20000, people: [you({ isaHeadroom: 20000, isaCapacity: 20000 })] }));
  assert.ok(r.years.every(y => y.taxPaid === 0));
});

test("renter: a large pot outside an ISA pays dividend tax, more for a higher-rate payer", () => {
  const big = over => calcRentVsBuy(base({ upfront: 200000, people: [you({ isaHeadroom: 0, isaCapacity: 0, ...over })] }));
  const basic = big({ taxBand: "basic" }).years[0].taxPaid;
  const higher = big({ taxBand: "higher" }).years[0].taxPaid;
  assert.ok(basic > 0);
  assert.ok(higher > basic * 3);
});

test("renter: cashing in outside an ISA pays CGT above the £3,000 allowance", () => {
  const r = calcRentVsBuy(base({ upfront: 200000, horizonYears: 10, people: [you({ isaHeadroom: 0, isaCapacity: 0 })] }));
  const isaVersion = calcRentVsBuy(base({ upfront: 200000, horizonYears: 10, people: [you({ isaHeadroom: 1e9, isaCapacity: 1e9 })] }));
  assert.ok(r.years.at(-1).renterWealth < isaVersion.years.at(-1).renterWealth);
});

test("renter: rent above the buyer's cost is drawn from the investments", () => {
  const cheapBuy = calcRentVsBuy(base({ monthlyRent: 1000 }));
  const dearRent = calcRentVsBuy(base({ monthlyRent: 3000 }));
  assert.ok(dearRent.years.at(-1).renterWealth < cheapBuy.years.at(-1).renterWealth);
});

test("renter: drawing down can run the investments out", () => {
  const r = calcRentVsBuy(base({ upfront: 5000, monthlyRent: 5000 }));
  assert.ok(r.years.at(-1).renterWealth < 0);
});

// ── Joint buyers ──────────────────────────────────────────────────────────

test("joint: the upfront sum can use both people's ISA allowances", () => {
  const alone = calcRentVsBuy(base({ upfront: 40000, monthlyRent: 99999 }));
  const together = calcRentVsBuy(base({ upfront: 40000, monthlyRent: 99999, people: [you({ share: 0.6 }), you({ who: "partner", share: 0.4 })] }));
  near(alone.isaPaidIn, 20000, 0.001);
  near(together.isaPaidIn, 40000, 0.001);
});

test("partner estimate: a £35,000 partner can't fill an ISA; around £70,000 they can", () => {
  const low = partnerSavingsEstimate({ salary: 35000, yourSalary: 55000, yourMonthlyExpenses: 2000 });
  near(low.takeHome, 35000 - 4486 - 1794.4, 0.5);
  near(low.costs, 24000 * 35 / 55, 0.5);
  assert.ok(low.isaCapacity < 20000);
  assert.equal(low.taxBand, "basic");
  const high = partnerSavingsEstimate({ salary: 70000, yourSalary: 70000, yourMonthlyExpenses: 2500 });
  assert.equal(high.isaCapacity, 20000);
  assert.equal(high.taxBand, "higher");
});

test("partner estimate: pension contributions come off take-home pay", () => {
  const none = partnerSavingsEstimate({ salary: 50000, yourSalary: 50000, yourMonthlyExpenses: 1500 });
  const five = partnerSavingsEstimate({ salary: 50000, pensionPct: 5, yourSalary: 50000, yourMonthlyExpenses: 1500 });
  assert.ok(five.takeHome < none.takeHome);
});

// ── Outcomes ──────────────────────────────────────────────────────────────

test("outcome: breakeven when rent is high and prices grow", () => {
  const r = calcRentVsBuy(base({ monthlyRent: 2200, housePriceGrowthPct: 5, horizonYears: 10 }));
  assert.ok(r.breakevenYear >= 1 && r.breakevenYear <= 10);
  assert.ok(r.gapAtHorizon > 0);
});

test("outcome: no breakeven when rent is cheap and prices are flat", () => {
  const r = calcRentVsBuy(base({ monthlyRent: 700, housePriceGrowthPct: 0 }));
  assert.equal(r.breakevenYear, null);
  assert.ok(r.gapAtHorizon < 0);
  assert.equal(r.years.length, 5);
});

// ── Inputs from Candid's saved data ───────────────────────────────────────

const saved = {
  selectedModules: ["cash", "investments", "pension"], salary: "55000", monthlyExpenses: "2000",
  cashTiers: [{ amount: "40000", rate: "4" }], hasPension: "yes", myContribution: "5", employerMatch: "5", isaThisYearCash: "5000",
  propertyBuyingMode: "alone", propertyPrice: "300000", propertyRegion: "north_east", propertyFirstTimeBuyer: "yes",
  propertyMonthlyRent: "1200",
};
const inputs = (over = {}, scenario) => { const d = { ...saved, ...over }; return rentVsBuyInputs(d, calcMetrics(d), null, scenario); };

test("inputs: moderate uses 3% house prices, a 5% return and the region's rent growth", () => {
  const i = inputs();
  assert.equal(i.housePriceGrowthPct, 3);
  assert.equal(i.investmentReturnPct, 5);
  assert.equal(i.dividendYieldPct, 2);
  assert.equal(i.rentGrowthPct, 5.8);
  assert.equal(i.horizonYears, 5);
  assert.equal(i.people[0].isaHeadroom, 15000);
});

test("inputs: stress never uses a house price figure above the moderate one", () => {
  assert.equal(inputs({}, "stress").housePriceGrowthPct, 3);
  assert.equal(inputs({ propertyRegion: "london" }, "stress").housePriceGrowthPct, -3.3);
});

test("inputs: stress returns 2%, all of it dividends", () => {
  const i = inputs({ propertyInvestmentReturn: "7" }, "stress");
  assert.equal(i.investmentReturnPct, 2);
  assert.equal(i.dividendYieldPct, 2);
});

test("inputs: the user's own assumptions win in moderate", () => {
  const i = inputs({ propertyHousePriceGrowth: "1.5", propertyRentGrowth: "2", propertyInvestmentReturn: "6", propertyDividendYield: "3", propertyHorizonYears: "8" });
  assert.deepEqual([i.housePriceGrowthPct, i.rentGrowthPct, i.investmentReturnPct, i.dividendYieldPct, i.horizonYears], [1.5, 2, 6, 3, 8]);
});

test("inputs: the regional table wins over the snapshot when loaded", () => {
  const d = saved;
  const i = rentVsBuyInputs(d, calcMetrics(d), [{ region: "north_east", rent_growth_pct: "4.1", house_price_growth_pct: "2.2" }]);
  assert.equal(i.rentGrowthPct, 4.1);
});

test("inputs: buying together splits the money by each person's capacity to save", () => {
  const i = inputs({ propertyBuyingMode: "together", partnerSalary: "35000", partnerIsaThisYear: "20000" });
  assert.equal(i.people.length, 2);
  near(i.people[0].share + i.people[1].share, 1, 1e-9);
  assert.equal(i.people[1].isaHeadroom, 0);
  assert.ok(i.people[1].isaCapacity < 20000);
});

test("inputs: the upfront sum is the deposit plus stamp duty and fees", () => {
  const d = saved, m = calcMetrics(d);
  const i = rentVsBuyInputs(d, m, null);
  // Cash available 34,000 (40,000 less 3 months' expenses), first-time buyer at £300k: no stamp duty.
  near(i.upfront, 34000, 0.5);
  assert.equal(i.mortgage.loan, 300000 - 31500);
});
