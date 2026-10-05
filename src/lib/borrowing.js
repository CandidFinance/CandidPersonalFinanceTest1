// Borrowing check for the Property module: how big a mortgage a purchase
// needs, measured against the income multiple most lenders work to. A
// warning only, never a block. Pure functions, unit tested in
// borrowing.test.js.

import { calcStampDuty } from "./stampDuty.js";
import { regionNation } from "./regions.js";

export const LENDER_INCOME_MULTIPLE = 4.5;
// The top of what some lenders offer higher earners.
export const HIGH_EARNER_MULTIPLE = 5.5;
export const DEFAULT_PROPERTY_FEES = 2500;
export const EMERGENCY_KEEP_BACK_MONTHS = 3;
// The smallest deposit most lenders accept, as a share of the price: a 95%
// mortgage is the most widely offered.
export const MIN_DEPOSIT_PCT = 0.05;

// Cash ISA balances (this year's payments and earlier years'), which a
// buyer would usually draw on for a deposit alongside their other cash.
export function cashIsaBalance(d) {
  return (+d.isaThisYearCash || 0) + (+d.isaPrevCash || 0);
}

// Starting value for "cash available": cash savings, Premium Bonds and Cash
// ISAs (`cashPot`), less 3 months of expenses kept back as an emergency
// fund. Editable by the user, e.g. to add a partner's savings.
export function suggestedCashAvailable(cashPot, monthlyExpenses) {
  return Math.max(0, Math.round((cashPot || 0) - EMERGENCY_KEEP_BACK_MONTHS * (monthlyExpenses || 0)));
}

const filled = v => v !== "" && v !== null && v !== undefined && !isNaN(+v);

// Income a lender would look at for one buyer: salary plus other income.
// Bonuses and dividends are left out, as lenders treat them case by case.
export function lenderIncome(salary, otherIncome) {
  return Math.max(0, +salary || 0) + Math.max(0, +otherIncome || 0);
}

// Builds calcBorrowingCheck's input from Candid's saved inputs (`d`) and
// calcMetrics' output (`m`). Cash available and fees fall back to their
// starting values until the user changes them.
//
// Stamp duty is worked out for England and Northern Ireland once the user
// says where they're buying (`stampDutyDetail` holds the breakdown). For
// Scotland and Wales, which have their own taxes Candid doesn't calculate
// yet, it's the user's own figure. With no location yet, it's £0 and
// `stampDutyDetail` is null. First-time buyer status not yet answered counts
// as "no", so relief is never assumed.
export function borrowingInputs(d, m) {
  const together = d.propertyBuyingMode === "together";
  const incomes = [lenderIncome(m.salary, d.otherIncome)];
  if (together) incomes.push(lenderIncome(d.partnerSalary, d.partnerOtherIncome));
  const price = +d.propertyPrice || 0;
  const stampDutyDetail = stampDutyDetailAt(d, price);
  return {
    price,
    cashAvailable: filled(d.propertyCashAvailable) ? +d.propertyCashAvailable : suggestedCashAvailable(m.totalLiquid + cashIsaBalance(d), m.expenses),
    stampDuty: stampDutyOf(d, stampDutyDetail),
    stampDutyDetail,
    fees: filled(d.propertyFees) ? +d.propertyFees : DEFAULT_PROPERTY_FEES,
    incomes,
  };
}

// Stamp duty at a given price, from the user's answers: the breakdown, or
// null with no location yet; and the figure the borrowing check uses.
function stampDutyDetailAt(d, price) {
  const nation = regionNation(d.propertyRegion);
  const together = d.propertyBuyingMode === "together";
  return nation ? calcStampDuty({
    price, nation,
    firstTimeBuyers: together ? [d.propertyFirstTimeBuyer === "yes", d.partnerFirstTimeBuyer === "yes"] : [d.propertyFirstTimeBuyer === "yes"],
    additionalProperty: d.propertySoleProperty === "no",
  }) : null;
}
function stampDutyOf(d, detail) {
  return detail?.supported ? detail.total : detail ? (+d.propertyStampDuty || 0) : 0;
}

// The most someone could pay for a home: the highest price where the loan
// is no more than `multiple` times income and the deposit left after stamp
// duty and fees is at least MIN_DEPOSIT_PCT of the price. `stampDutyAt`
// gives the stamp duty at a price, worked out afresh as the price moves
// (first-time buyer relief stops at £500,000, say).
//
// Both limits only tighten as the price rises (stamp duty never falls as
// the price goes up), so the highest price passing each is found by
// halving the range. Rounded down to the £1,000, which still passes.
// `limit` says which one sets it: "income" or "deposit". Null with no
// income, as lenders lend against income.
const PRICE_SEARCH_MAX = 20000000;
const PRICE_ROUND = 1000;
function highestPassing(passes) {
  if (!passes(0)) return 0;
  let lo = 0, hi = PRICE_SEARCH_MAX;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (passes(mid)) lo = mid; else hi = mid;
  }
  return Math.floor(lo / PRICE_ROUND) * PRICE_ROUND;
}
export function calcMaxPrice({ cashAvailable = 0, fees = DEFAULT_PROPERTY_FEES, incomes = [], stampDutyAt = () => 0, multiple = LENDER_INCOME_MULTIPLE }) {
  const income = incomes.reduce((s, x) => s + Math.max(0, +x || 0), 0);
  if (!(income > 0)) return null;
  const maxLoan = income * multiple;
  const check = p => calcBorrowingCheck({ price: p, cashAvailable, stampDuty: stampDutyAt(p), fees, incomes });
  const byIncome = highestPassing(p => check(p).loanNeeded <= maxLoan);
  const byDeposit = highestPassing(p => p - check(p).loanNeeded >= p * MIN_DEPOSIT_PCT && check(p).upfrontShortfall === 0);
  const price = Math.min(byIncome, byDeposit);
  const r = check(price);
  return {
    price, multiple, maxLoan,
    limit: byDeposit < byIncome ? "deposit" : "income",
    loan: r.loanNeeded, deposit: r.usableDeposit, stampDuty: stampDutyAt(price),
  };
}

// calcMaxPrice from Candid's saved inputs, as borrowingInputs.
export function maxPriceFor(d, m, multiple = LENDER_INCOME_MULTIPLE) {
  const { cashAvailable, fees, incomes } = borrowingInputs(d, m);
  return calcMaxPrice({ cashAvailable, fees, incomes, multiple, stampDutyAt: p => stampDutyOf(d, stampDutyDetailAt(d, p)) });
}

// Geometry for the times-income bar, as percentages of its width. The scale
// grows with the multiple (always showing past 5.5x) but stops at 10x:
// beyond that the bar is simply full and labelled "10x+". The fill is split
// into its green (to 4.5x), orange (to 5.5x) and red (above) stretches, each
// named by the band it belongs to.
export const BAR_MAX_MULTIPLE = 10;
export function multipleBar(multiple) {
  const scaleMax = Math.min(BAR_MAX_MULTIPLE, Math.max(7, multiple * 1.1));
  const shown = Math.min(Math.max(0, multiple), scaleMax);
  const pct = x => (x / scaleMax) * 100;
  const stretches = [
    ["within", 0, LENDER_INCOME_MULTIPLE],
    ["stretch", LENDER_INCOME_MULTIPLE, HIGH_EARNER_MULTIPLE],
    ["beyond", HIGH_EARNER_MULTIPLE, scaleMax],
  ];
  return {
    scaleMax,
    capped: multiple > BAR_MAX_MULTIPLE,
    segments: stretches
      .filter(([, from]) => shown > from)
      .map(([band, from, to]) => ({ band, left: pct(from), width: pct(Math.min(shown, to) - from) })),
    markers: [LENDER_INCOME_MULTIPLE, HIGH_EARNER_MULTIPLE].map(x => ({ x, pct: pct(x) })),
  };
}

// `incomes` is one entry per buyer (salary plus other income). Stamp duty
// comes from borrowingInputs.
export function calcBorrowingCheck({ price = 0, cashAvailable = 0, stampDuty = 0, fees = DEFAULT_PROPERTY_FEES, incomes = [] }) {
  const income = incomes.reduce((s, x) => s + Math.max(0, +x || 0), 0);
  const upfrontCosts = Math.max(0, stampDuty) + Math.max(0, fees);
  const usableDeposit = Math.max(0, cashAvailable - upfrontCosts);
  // Cash that doesn't even cover stamp duty and fees leaves nothing for a deposit.
  const upfrontShortfall = Math.max(0, upfrontCosts - cashAvailable);
  const loanNeeded = Math.max(0, price - usableDeposit);
  const multiple = income > 0 ? loanNeeded / income : null;
  const loanAtMultiple = income * LENDER_INCOME_MULTIPLE;
  // Strictly above 4.5x. With no income recorded, any loan is above it.
  const warn = loanNeeded > 0 && (income > 0 ? loanNeeded > loanAtMultiple : true);
  // "within" up to and including 4.5x, "stretch" above that up to and
  // including 5.5x, "beyond" above 5.5x. Null with no income to compare.
  const band = loanNeeded === 0 ? "within"
    : multiple == null ? null
    : multiple <= LENDER_INCOME_MULTIPLE ? "within"
    : multiple <= HIGH_EARNER_MULTIPLE ? "stretch"
    : "beyond";
  return {
    income, upfrontCosts, usableDeposit, upfrontShortfall, loanNeeded,
    loanToValue: price > 0 ? loanNeeded / price : null,
    multiple, loanAtMultiple,
    gapAboveMultiple: Math.max(0, loanNeeded - loanAtMultiple),
    // How far the deposit is below the 5% most lenders need. Nothing for a
    // purchase with no loan.
    depositShort: loanNeeded > 0 ? Math.max(0, Math.ceil(price * MIN_DEPOSIT_PCT - usableDeposit)) : 0,
    warn, band,
  };
}
