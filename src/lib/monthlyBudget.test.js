import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyBudget, budgetBasics, affordableMaxPrice, TIGHT_BUDGET } from "./monthlyBudget.js";
import { calcMetrics } from "./metrics.js";
import { monthlyPayment } from "./mortgage.js";
import { calcBorrowingCheck, borrowingInputs } from "./borrowing.js";
import { mortgageReveal, budgetLine } from "./propertyReveal.js";

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

// £45,000 salary, £2,000 a month spending including £1,300 rent, buying a
// £230,000 London home with £27,500 cash (a £202,500 loan at 4.5% over 30
// years, fixed for 5).
const buyer = {
  employmentStatus: "employed", salary: "45000", monthlyExpenses: "2000",
  propertyBuyingMode: "alone", propertyRegion: "london", propertyFirstTimeBuyer: "yes", propertyFees: "2500",
  propertyCashAvailable: "27500", propertyPrice: "230000", propertyMonthlyRent: "1300",
};
const budgetFor = d => monthlyBudget(d, calcMetrics(d));

test("left each month: take-home, less spending other than rent, less the mortgage and upkeep", () => {
  const m = calcMetrics(buyer);
  const b = monthlyBudget(buyer, m);
  const loan = calcBorrowingCheck(borrowingInputs(buyer, m)).loanNeeded;
  near(b.takeHome, m.monthlyTakeHome);
  assert.equal(b.otherSpending, 700);
  near(b.mortgage, monthlyPayment(loan, 4.5, 360));
  near(b.homeCosts, 230000 * 0.01 / 12); // 1% of the value a year
  near(b.left, b.takeHome - 700 - b.mortgage - b.homeCosts);
  assert.equal(b.status, "ok");
  // From year 6 at 6%: a higher payment, so less left.
  assert.equal(b.ratesRise.year, 6);
  assert.ok(b.leftIfRatesRise < b.left);
});

test("short: spending that leaves less than the mortgage and upkeep", () => {
  // £3,500 spending, £2,200 of it other than rent: more than £2,993 take-home
  // less about £1,230 of mortgage and upkeep.
  const b = budgetFor({ ...buyer, monthlyExpenses: "3500" });
  assert.ok(b.left < 0);
  assert.equal(b.status, "short");
});

test("tight: under the buffer now, or short once rates rise", () => {
  // £90,000 salary, £2,500 other spending, £450,000 home: about £265 left
  // now but short at 6% from year 6.
  const high = budgetFor({ ...buyer, salary: "90000", monthlyExpenses: "4500", propertyMonthlyRent: "2000", propertyCashAvailable: "47500", propertyPrice: "450000" });
  assert.ok(high.left >= TIGHT_BUDGET && high.leftIfRatesRise < 0);
  assert.equal(high.status, "tight");
  const thin = budgetFor({ ...buyer, monthlyExpenses: "2950" });
  assert.ok(thin.left >= 0 && thin.left < TIGHT_BUDGET);
  assert.equal(thin.status, "tight");
});

test("needs spending and rent: nothing until both are in; £0 rent counts", () => {
  assert.equal(budgetFor({ ...buyer, propertyMonthlyRent: "" }), null);
  assert.equal(budgetFor({ ...buyer, monthlyExpenses: "" }), null);
  assert.equal(budgetFor({ ...buyer, propertyMonthlyRent: "0" }).otherSpending, 2000);
});

test("buying together: the partner's take-home is added, and their spending estimated from yours", () => {
  const d = { ...buyer, propertyBuyingMode: "together", partnerSalary: "45000", partnerFirstTimeBuyer: "yes" };
  const m = calcMetrics(d);
  const basics = budgetBasics(d, m);
  near(basics.takeHome, 2 * m.monthlyTakeHome, 5);
  // Half the rent each: £1,350 other spending each.
  assert.equal(basics.otherSpending, 2700);
});

test("the most you could afford: the budget limit, at the higher rate, when it's lowest", () => {
  const d = { ...buyer, salary: "90000", monthlyExpenses: "4500", propertyMonthlyRent: "2000", propertyCashAvailable: "47500", propertyPrice: "450000" };
  const m = calcMetrics(d);
  const most = affordableMaxPrice(d, m);
  assert.equal(most.limit, "budget");
  assert.equal(most.testRatePct, 6);
  // At that price the mortgage at 6% and upkeep fit what's left; £1,000 more doesn't.
  const room = budgetBasics(d, m).room;
  const costAt = price => {
    const loan = calcBorrowingCheck(borrowingInputs({ ...d, propertyPrice: String(price) }, m)).loanNeeded;
    return monthlyPayment(loan, 6, 360) + price * 0.01 / 12;
  };
  assert.ok(costAt(most.price) <= room && costAt(most.price + 1000) > room);
  // Without rent, no budget limit yet.
  assert.notEqual(affordableMaxPrice({ ...d, propertyMonthlyRent: "" }, m).limit, "budget");
});

test("the mortgage explanation leads with being short, and otherwise says what's left", () => {
  const short = { ...buyer, monthlyExpenses: "3500" };
  const steps = mortgageReveal(short, calcMetrics(short));
  assert.match(steps[2].title, /^Buying at this price would leave you £[\d,]+ short each month\.$/);
  assert.match(mortgageReveal(buyer, calcMetrics(buyer))[2].body, /^You'd have about £[\d,]+ left each month after your other spending, or £[\d,]+ if rates are higher from year 6\.$/);
  assert.equal(budgetLine(null), null);
});
