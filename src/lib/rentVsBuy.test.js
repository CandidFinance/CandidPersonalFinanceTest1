import { test } from "node:test";
import assert from "node:assert/strict";
import { calcRentVsBuy, rentVsBuyInputs, partnerSavingsEstimate, cashRate, breakevenGrowthPct, SELLING_COSTS_PCT, MIN_GROWTH_PCT } from "./rentVsBuy.js";
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

test("inputs: by default the renter's money stays in cash at the user's blended cash rate", () => {
  const i = inputs();
  assert.equal(i.housePriceGrowthPct, 3);
  assert.equal(i.returnType, "cash");
  // £40,000 at 4% and a £5,000 Cash ISA at the same rate.
  near(i.investmentReturnPct, 4, 1e-9);
  near(i.dividendYieldPct, 4, 1e-9);
  assert.equal(i.rentGrowthPct, 5.8);
  assert.equal(i.horizonYears, 5);
  assert.equal(i.people[0].isaHeadroom, 15000);
});

test("inputs: the blended cash rate weights Premium Bonds at the prize fund rate", () => {
  const d = { ...saved, cashTiers: [{ amount: "30000", rate: "3" }], premiumBonds: "10000", isaThisYearCash: "" };
  near(cashRate(d, calcMetrics(d)), (30000 * 3 + 10000 * 4.35) / 40000, 1e-9);
});

test("inputs: invested uses 7%, the rate used for Stocks & Shares ISAs elsewhere", () => {
  const i = inputs({ propertyRenterMoney: "invested" });
  assert.equal(i.returnType, "invested");
  assert.equal(i.investmentReturnPct, 7);
  assert.equal(i.dividendYieldPct, 2);
});

test("inputs: stress never uses a house price figure above the moderate one", () => {
  assert.equal(inputs({}, "stress").housePriceGrowthPct, 3);
  assert.equal(inputs({ propertyRegion: "london" }, "stress").housePriceGrowthPct, -3.3);
});

test("inputs: stress returns 2%, all of it dividends", () => {
  const i = inputs({ propertyRenterMoney: "invested", propertyInvestmentReturn: "7" }, "stress");
  assert.equal(i.investmentReturnPct, 2);
  assert.equal(i.dividendYieldPct, 2);
});

test("inputs: the user's own assumptions win in moderate", () => {
  const i = inputs({ propertyRenterMoney: "invested", propertyHousePriceGrowth: "1.5", propertyRentGrowth: "2", propertyInvestmentReturn: "6", propertyDividendYield: "3", propertyHorizonYears: "8" });
  assert.deepEqual([i.housePriceGrowthPct, i.rentGrowthPct, i.investmentReturnPct, i.dividendYieldPct, i.horizonYears], [1.5, 2, 6, 3, 8]);
  assert.equal(inputs({ propertyCashReturn: "3.2" }).investmentReturnPct, 3.2);
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
  // Cash available 39,000 (40,000 cash and a 5,000 Cash ISA, less 3 months'
  // expenses), first-time buyer at £300k: no stamp duty.
  near(i.upfront, 39000, 0.5);
  assert.equal(i.mortgage.loan, 300000 - 36500);
  // The Cash ISA's share of the pot is already sheltered.
  near(i.alreadyInIsa, 39000 * 5000 / 45000, 0.5);
});

// ── Cash ─────────────────────────────────────────────────────────────────

const cashBase = over => base({ returnType: "cash", investmentReturnPct: 4, dividendYieldPct: 4, ...over });

test("cash: interest is taxed above the Personal Savings Allowance, at income tax rates", () => {
  const big = over => calcRentVsBuy(cashBase({ upfront: 100000, people: [you({ isaHeadroom: 0, isaCapacity: 0, ...over })] }));
  // About £4,000 of interest: basic rate pays 20% above £1,000, higher 40% above £500.
  const basic = big({ taxBand: "basic" }).years[0].taxPaid;
  const higher = big({ taxBand: "higher" }).years[0].taxPaid;
  assert.ok(basic > 500 && basic < 700, String(basic));
  assert.ok(higher > 1300 && higher < 1500, String(higher));
});

test("cash: no capital gains, so below the allowance it's worth the same in or out of an ISA", () => {
  // £10,000 plus monthly additions at 4% earns well under the £1,000 allowance.
  const run = people => calcRentVsBuy(cashBase({ upfront: 10000, horizonYears: 1, people }));
  const outside = run([you({ isaHeadroom: 0, isaCapacity: 0 })]);
  const inside = run([you({ isaHeadroom: 1e9, isaCapacity: 1e9 })]);
  assert.equal(outside.years[0].taxPaid, 0);
  near(outside.years[0].renterWealth, inside.years[0].renterWealth, 0.01);
});

test("money already in Cash ISAs stays sheltered without using new allowance", () => {
  const r = calcRentVsBuy(cashBase({ upfront: 40000, alreadyInIsa: 10000, monthlyRent: 99999, people: [you({ isaHeadroom: 20000 })] }));
  near(r.isaPaidIn, 30000, 0.001);
  near(r.outsideIsaPaidIn, 10000, 0.001);
});

// ── Money not got back vs what it earns ───────────────────────────────────

const reconciles = r => r.years.forEach(y => {
  near(y.buyerWealth - y.renterWealth, y.renting.netCost - y.buying.netCost, 0.01);
  near(y.buyerWealth, y.buying.ownMoneyIn + y.buying.priceRise - y.buying.sellingCosts, 0.01);
  near(y.renterWealth, y.renting.ownMoneyIn + y.renting.earnings - y.renting.tax, 0.01);
});

test("split: the net cost gap equals the net wealth gap, every year", () => {
  reconciles(calcRentVsBuy(base({ horizonYears: 12 })));
  reconciles(calcRentVsBuy(base({ horizonYears: 12, tenure: "leasehold", groundRent: 250, groundRentGrowthPct: 2, serviceCharge: 1800 })));
  reconciles(calcRentVsBuy(cashBase({ horizonYears: 8, upfront: 200000, people: [you({ isaHeadroom: 0, isaCapacity: 0, taxBand: "higher" })] })));
  reconciles(calcRentVsBuy(base({ monthlyRent: 3000, horizonYears: 6 })));
  // Savings run out: a £2,500 deposit on a £300,000 home, with £2,500 of fees.
  reconciles(calcRentVsBuy(base({ upfront: 5000, monthlyRent: 5000, mortgage: { loan: 297500, termYears: 30, fixedYears: 5, ratePct: 4.5, remortgageFee: 1000 } })));
  // Mortgage paid off before the sale: £250,000 deposit plus £7,500 of fees.
  reconciles(calcRentVsBuy(base({ horizonYears: 7, upfront: 257500, mortgage: { loan: 50000, termYears: 5, fixedYears: 5, ratePct: 4.5, remortgageFee: 0 } })));
  reconciles(calcRentVsBuy(base({ upfront: 37500, people: [you({ share: 0.6 }), you({ who: "partner", share: 0.4, taxBand: "higher" })] })));
});

test("split: buying's one-off costs are the upfront sum less the deposit", () => {
  // Price 300,000, loan 270,000: deposit 30,000, so 7,500 of the 37,500 is stamp duty and fees.
  near(calcRentVsBuy(base()).years[0].buying.stampDutyAndFees, 7500, 0.001);
});

test("split: the loan paid off isn't counted as a cost", () => {
  const y = calcRentVsBuy(base()).years[0];
  const s = mortgageSchedule(base().mortgage).years[0];
  near(y.buying.mortgageInterest, s.interest, 1);
  near(y.renting.rent, 1300 * 12, 0.01);
});

// ── Mortgage rate at the remortgage ───────────────────────────────────────

test('rates: higher rates at a remortgage before the sale make buying look worse, lower better', () => {
  const run = scenario => calcRentVsBuy(base({ horizonYears: 5, mortgage: { loan: 270000, termYears: 30, fixedYears: 3, ratePct: 4.5, remortgageFee: 1000 }, mortgageScenario: scenario }));
  const higher = run('stress').gapAtHorizon, same = run('moderate').gapAtHorizon, lower = run('lower').gapAtHorizon;
  assert.ok(higher < same && same < lower, [higher, same, lower].join(', '));
  // Nothing changes before the fix ends.
  near(run('stress').years[2].buyerWealth - run('stress').years[2].renterWealth, run('moderate').years[2].buyerWealth - run('moderate').years[2].renterWealth, 0.01);
  reconciles(run('stress'));
  reconciles(run('lower'));
});

test('rates: no remortgage before the sale means rates make no difference', () => {
  const run = scenario => calcRentVsBuy(base({ horizonYears: 5, mortgageScenario: scenario }));
  near(run('stress').gapAtHorizon, run('moderate').gapAtHorizon, 0.01);
});

test("own money: the buyer's is the deposit plus the loan paid off; the renter's the starting money plus what's put aside", () => {
  const y = calcRentVsBuy(base()).years[0];
  const s = mortgageSchedule(base().mortgage).years[0];
  near(y.buying.ownMoneyIn, 30000 + (270000 - s.balance), 0.01);
  near(y.renting.ownMoneyIn, 37500 + (y.buyerMonthlyCost - 1300) * 12, 0.01);
});

// ── Cash rate: the better of the user's own and the best tracked ──────────

test("cash rate: the best tracked rate is used when it beats the user's own", () => {
  const d = { ...saved, cashTiers: [{ amount: "40000", rate: "1.5" }], isaThisYearCash: "" };
  const i = rentVsBuyInputs(d, calcMetrics(d), null, "moderate", { nonIsaRate: 5 });
  assert.equal(i.investmentReturnPct, 5);
  near(i.ownCashRatePct, 1.5, 1e-9);
  assert.equal(i.bestCashRatePct, 5);
});

test("cash rate: the user's own rate is kept when it's better, or the best isn't loaded", () => {
  const d = { ...saved, cashTiers: [{ amount: "40000", rate: "5.5" }], isaThisYearCash: "" };
  near(rentVsBuyInputs(d, calcMetrics(d), null, "moderate", { nonIsaRate: 5 }).investmentReturnPct, 5.5, 1e-9);
  near(rentVsBuyInputs(d, calcMetrics(d), null, "moderate", null).investmentReturnPct, 5.5, 1e-9);
});

test("cash rate: the user's own figure wins over both", () => {
  const d = { ...saved, propertyCashReturn: "3" };
  assert.equal(rentVsBuyInputs(d, calcMetrics(d), null, "moderate", { nonIsaRate: 5 }).investmentReturnPct, 3);
});

// ── Falling prices and negative equity ─────────────────────────────────────

test("falling prices: negative growth is allowed, floored at MIN_GROWTH_PCT", () => {
  const fall = { ...saved, propertyHousePriceGrowth: "-5", propertyRentGrowth: "-2" };
  const i = rentVsBuyInputs(fall, calcMetrics(fall), null);
  assert.equal(i.housePriceGrowthPct, -5);
  assert.equal(i.rentGrowthPct, -2);
  const extreme = { ...saved, propertyHousePriceGrowth: "-150", propertyRentGrowth: "-120" };
  const j = rentVsBuyInputs(extreme, calcMetrics(extreme), null);
  assert.equal(j.housePriceGrowthPct, MIN_GROWTH_PCT);
  assert.equal(j.rentGrowthPct, MIN_GROWTH_PCT);
});

test("negative equity: flagged when the home is worth less than the loan, with the shortfall on selling", () => {
  // 10% deposit, prices falling 5% a year. Years 1-2: enough equity to
  // sell. Year 3: still some equity, but not enough to cover selling costs.
  // Years 4-5: worth less than the loan.
  const r = calcRentVsBuy(base({ upfront: 30000 + 2500, housePriceGrowthPct: -5 }));
  assert.deepEqual(r.negativeEquityYears, [4, 5]);
  for (const y of r.years) {
    near(y.equity, y.propertyValue - y.mortgageBalance, 1e-6);
    near(y.saleShortfall, Math.max(0, -y.buyerWealth), 1e-6);
  }
  assert.deepEqual(r.years.map(y => y.saleShortfall > 0), [false, false, true, true, true]);
  assert.ok(r.years[2].equity > 0);
  // The fall shows as negative growth, so it's part of the cost of living there.
  assert.ok(r.years[4].buying.priceRise < 0);
  near(r.years[4].buying.netCost, r.years[4].buying.notRecovered - r.years[4].buying.priceRise, 1e-6);
});

test("negative equity: none when prices rise", () => {
  const r = calcRentVsBuy(base());
  assert.deepEqual(r.negativeEquityYears, []);
  for (const y of r.years) assert.equal(y.saleShortfall, 0);
});

const londonBuyer = {
  salary: "45000", monthlyExpenses: "2000", cashTiers: [{ amount: "30000", rate: "4" }], selectedModules: ["cash"],
  propertyBuyingMode: "alone", propertyRegion: "london", propertyFirstTimeBuyer: "yes", propertyPrice: "300000",
  propertyCashAvailable: "30000", propertyMonthlyRent: "1300", propertyHorizonYears: "5",
};
const inputsFor = d => rentVsBuyInputs(d, calcMetrics(d), null);

test("break-even growth: buying is ahead just above it and behind just below", () => {
  const input = inputsFor(londonBuyer);
  const g = breakevenGrowthPct(input);
  assert.equal(g, 0.5);
  assert.ok(calcRentVsBuy({ ...input, housePriceGrowthPct: g }).gapAtHorizon > 0);
  assert.ok(calcRentVsBuy({ ...input, housePriceGrowthPct: g - 0.1 }).gapAtHorizon < 0);
  // Staying longer spreads the one-off costs: buying holds up to a small fall.
  assert.equal(breakevenGrowthPct(inputsFor({ ...londonBuyer, propertyHorizonYears: "10" })), -0.4);
});

test("break-even growth: none when one side is ahead whatever prices do", () => {
  // £6,000 a month in rent for 10 years: buying is ahead even if prices
  // halve every year.
  assert.equal(breakevenGrowthPct(inputsFor({ ...londonBuyer, propertyMonthlyRent: "6000", propertyHorizonYears: "10" })), null);
  // £0 rent still has a point where buying wins: prices rising fast enough.
  assert.equal(breakevenGrowthPct(inputsFor({ ...londonBuyer, propertyMonthlyRent: "0" })), 6.1);
});

test("selling costs default to 2% and upkeep to 1% a year; both can be changed", () => {
  const input = inputsFor(londonBuyer);
  assert.equal(SELLING_COSTS_PCT, 2);
  assert.deepEqual([input.sellingCostsPct, input.maintenancePct], [2, 1]);
  const own = inputsFor({ ...londonBuyer, propertySellingCosts: "3", propertyMaintenancePct: "2" });
  const a = calcRentVsBuy(input).years.at(-1), b = calcRentVsBuy(own).years.at(-1);
  near(b.buying.sellingCosts, a.buying.sellingCosts * 1.5);
  near(b.buying.maintenance, a.buying.maintenance * 2);
  // Leasehold upkeep is a yearly sum.
  const flat = inputsFor({ ...londonBuyer, propertyTenure: "leasehold", propertyLeaseholdMaintenance: "2400" });
  near(calcRentVsBuy({ ...flat, horizonYears: 1 }).years[0].buying.maintenance, 2400);
});

test("buying together with shared spending: the household saves both pays less one spending figure", () => {
  const couple = { ...londonBuyer, salary: "50000", monthlyExpenses: "3000", propertyBuyingMode: "together", partnerSalary: "50000", partnerFirstTimeBuyer: "yes" };
  const m = calcMetrics(couple);
  const own = rentVsBuyInputs(couple, m, null), shared = rentVsBuyInputs({ ...couple, propertySpendingScope: "household" }, m, null);
  const total = input => input.people.reduce((s, p) => s + p.surplus, 0);
  near(total(shared), 12 * (2 * m.monthlyTakeHome - 3000), 50);
  assert.ok(total(shared) > total(own));
  assert.equal(shared.partnerEstimate.shared, true);
  // Equal pay: split evenly.
  near(shared.people[0].surplus, shared.people[1].surplus, 50);
});
