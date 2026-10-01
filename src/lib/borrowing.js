// Borrowing check for the Property module: how big a mortgage a purchase
// needs, measured against the income multiple most lenders work to. A
// warning only, never a block. Pure functions, unit tested in
// borrowing.test.js.

export const LENDER_INCOME_MULTIPLE = 4.5;
export const DEFAULT_PROPERTY_FEES = 2500;
export const EMERGENCY_KEEP_BACK_MONTHS = 3;

// Starting value for "cash available": cash savings plus Premium Bonds, less
// 3 months of expenses kept back as an emergency fund. Editable by the user,
// e.g. to add a partner's savings.
export function suggestedCashAvailable(totalLiquid, monthlyExpenses) {
  return Math.max(0, Math.round((totalLiquid || 0) - EMERGENCY_KEEP_BACK_MONTHS * (monthlyExpenses || 0)));
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
export function borrowingInputs(d, m) {
  const incomes = [lenderIncome(m.salary, d.otherIncome)];
  if (d.propertyBuyingMode === "together") incomes.push(lenderIncome(d.partnerSalary, d.partnerOtherIncome));
  return {
    price: +d.propertyPrice || 0,
    cashAvailable: filled(d.propertyCashAvailable) ? +d.propertyCashAvailable : suggestedCashAvailable(m.totalLiquid, m.expenses),
    stampDuty: +d.propertyStampDuty || 0,
    fees: filled(d.propertyFees) ? +d.propertyFees : DEFAULT_PROPERTY_FEES,
    incomes,
  };
}

// `incomes` is one entry per buyer (salary plus other income). Stamp duty is
// entered by the user for now; the stamp duty rules come in a later phase.
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
  return {
    income, upfrontCosts, usableDeposit, upfrontShortfall, loanNeeded,
    loanToValue: price > 0 ? loanNeeded / price : null,
    multiple, loanAtMultiple,
    gapAboveMultiple: Math.max(0, loanNeeded - loanAtMultiple),
    warn,
  };
}
