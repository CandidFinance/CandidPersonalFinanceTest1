// The Property module's monthly budget check: what someone would have left
// each month once they own the home. The borrowing check only measures the
// loan against 4.5x income, which a high spender can pass and still not be
// able to pay the mortgage. Pure functions, unit tested in
// monthlyBudget.test.js.
//
//   left = take-home pay - spending other than rent - mortgage - upkeep
//          (and, for a leasehold flat, ground rent and service charge)
//
// Monthly spending includes rent (the question says "rent or mortgage,
// bills, food and getting around"), and buying replaces the rent, so the
// rent comes off it. Shown at today's rate, and if rates are
// STRESS_REMORTGAGE_UPLIFT points higher when the fix ends, as the mortgage
// step's chart does.
//
// Buying together: the partner's take-home pay is estimated from their
// salary (partnerSavingsEstimate), the user's spending is taken as their own
// share with half the rent, and the partner's spending other than rent is
// the user's scaled by the ratio of their salaries.
import { borrowingInputs, calcBorrowingCheck, maxPriceFor, LENDER_INCOME_MULTIPLE } from "./borrowing.js";
import { mortgageInputs, mortgageSummary, monthlyPayment, STRESS_REMORTGAGE_UPLIFT } from "./mortgage.js";
import { rentVsBuyInputs, buyerYearCosts, partnerSavingsEstimate } from "./rentVsBuy.js";

// Less than this left a month reads as tight. MoneyHelper sets no figure
// ("there's no specific percentage you should aim to spend on a mortgage"),
// so this is Candid's own: about a week's food shopping and a bill or two.
export const TIGHT_BUDGET = 200;

const filled = v => v !== "" && v !== null && v !== undefined && !isNaN(+v);

// Take-home pay and spending other than rent, for the household buying, or
// null while Candid lacks the income, the spending or the rent.
export function budgetBasics(d, m) {
  if (!(+d.monthlyExpenses > 0) || !filled(d.propertyMonthlyRent)) return null;
  const rent = Math.max(0, +d.propertyMonthlyRent);
  const together = d.propertyBuyingMode === "together";
  const yourOther = Math.max(0, +d.monthlyExpenses - (together ? rent / 2 : rent));
  let takeHome = Math.max(0, m.monthlyTakeHome || 0);
  let otherSpending = yourOther;
  if (together) {
    const partner = partnerSavingsEstimate({
      salary: +d.partnerSalary || 0, otherIncome: +d.partnerOtherIncome || 0, pensionPct: +d.partnerMyContribution || 0,
      yourSalary: m.salary, yourMonthlyExpenses: +d.monthlyExpenses,
    });
    takeHome += partner.takeHome / 12;
    otherSpending += yourOther * (m.salary > 0 ? (+d.partnerSalary || 0) / m.salary : 1);
  }
  if (!(takeHome > 0)) return null;
  return { takeHome, otherSpending, rent, room: takeHome - otherSpending, together };
}

// The home's running costs a month, other than the mortgage, at a price:
// upkeep, plus ground rent and service charge for a leasehold flat. First
// year's figures.
function homeCostsAt(rvbInput, price) {
  const c = buyerYearCosts({ ...rvbInput, price }, null, 1);
  return c.maintenance + c.groundRent + c.serviceCharge;
}

// The rate the budget is tested at: the higher rate if the fix ends before
// the mortgage does, as lenders test at a higher rate than the one you get.
function testRate(mi) {
  return mi.fixedYears < mi.termYears ? mi.ratePct + STRESS_REMORTGAGE_UPLIFT : mi.ratePct;
}

// The check itself, at the price and mortgage the user has entered. Null
// until there's a price and budgetBasics has its figures.
//   status: "short" (less than nothing left now), "tight" (under
//   TIGHT_BUDGET left, or short once rates rise), or "ok"
export function monthlyBudget(d, m) {
  const basics = budgetBasics(d, m);
  const price = +d.propertyPrice || 0;
  if (!basics || !(price > 0)) return null;
  const loan = calcBorrowingCheck(borrowingInputs(d, m)).loanNeeded;
  const mi = mortgageInputs(d, loan);
  const s = loan > 0 ? mortgageSummary(mi) : null;
  const mortgage = s ? s.monthlyPayment : 0;
  const homeCosts = homeCostsAt(rentVsBuyInputs(d, m, null), price);
  const left = basics.room - mortgage - homeCosts;
  const stress = s?.remortgageOutcomes?.find(o => o.scenario === "stress") || null;
  const leftIfRatesRise = stress ? basics.room - stress.monthlyPayment - homeCosts : null;
  const status = left < 0 ? "short"
    : left < TIGHT_BUDGET || (leftIfRatesRise != null && leftIfRatesRise < 0) ? "tight"
    : "ok";
  return {
    ...basics, mortgage, homeCosts, left, leftIfRatesRise, status,
    ratesRise: stress ? { year: s.firstRemortgageYear, ratePct: stress.ratePct, payment: stress.monthlyPayment } : null,
  };
}

// The most someone could pay (calcMaxPrice), with the monthly budget as a
// third limit once Candid has the figures for it: the mortgage at the test
// rate plus the home's running costs must fit in what's left after other
// spending. The screens use this rather than maxPriceFor.
export function affordableMaxPrice(d, m, multiple = LENDER_INCOME_MULTIPLE) {
  const basics = budgetBasics(d, m);
  if (!basics) return maxPriceFor(d, m, multiple);
  const mi = mortgageInputs(d, 0);
  const rate = testRate(mi);
  const rvbInput = rentVsBuyInputs(d, m, null);
  const most = maxPriceFor(d, m, multiple, {
    room: basics.room,
    costAt: (price, loan) => (loan > 0 ? monthlyPayment(loan, rate, mi.termYears * 12) : 0) + homeCostsAt(rvbInput, price),
  });
  return most && { ...most, testRatePct: rate };
}
