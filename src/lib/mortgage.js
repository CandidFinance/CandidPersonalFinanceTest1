// Repayment mortgage engine for the Property module: monthly payment and a
// year-by-year schedule with a remortgage at the end of each fixed period.
// Pure functions, unit tested in mortgage.test.js.

export const DEFAULT_MORTGAGE_TERM_YEARS = 30;
export const DEFAULT_FIXED_YEARS = 5;
export const DEFAULT_MORTGAGE_RATE_PCT = 4.5;
export const DEFAULT_REMORTGAGE_FEE = 1000;
export const FIXED_PERIOD_OPTIONS = [2, 3, 5, 10];
// Stress scenario: every remortgage is at today's rate plus 1.5 points. A
// flat uplift, not cumulative (6% at each remortgage from 4.5%, not 6%,
// 7.5%, 9%...).
export const STRESS_REMORTGAGE_UPLIFT = 1.5;
const MAX_TERM_YEARS = 40;

// Capital and interest repayment that clears `principal` over `months`.
export function monthlyPayment(principal, annualRatePct, months) {
  if (!(principal > 0) || !(months > 0)) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return principal * r / (1 - Math.pow(1 + r, -months));
}

// One row per year. The rate is fixed for `fixedYears`; at the end of each
// fixed period the buyer remortgages onto a new deal and the payment is
// recalculated over the remaining term. Moderate remortgages at the same
// rate; stress at the rate plus STRESS_REMORTGAGE_UPLIFT. The remortgage fee
// (paid in cash, not added to the loan) is charged in the first year of
// each new deal, so a buyer who sells at the end of a fixed period doesn't
// pay it.
export function mortgageSchedule({ loan, termYears, fixedYears, ratePct, remortgageFee, scenario = "moderate" }) {
  const totalMonths = termYears * 12;
  let balance = Math.max(0, loan);
  let rate = ratePct, payment = 0;
  const years = [];
  for (let year = 1; year <= termYears; year++) {
    const newDeal = (year - 1) % fixedYears === 0;
    const remortgage = newDeal && year > 1 && balance > 0.005;
    if (newDeal) {
      rate = remortgage && scenario === "stress" ? ratePct + STRESS_REMORTGAGE_UPLIFT : ratePct;
      payment = monthlyPayment(balance, rate, totalMonths - (year - 1) * 12);
    }
    let interest = 0, capital = 0;
    for (let month = 0; month < 12; month++) {
      const monthInterest = balance * rate / 100 / 12;
      const monthCapital = Math.min(balance, payment - monthInterest);
      interest += monthInterest;
      capital += monthCapital;
      balance -= monthCapital;
    }
    years.push({ year, ratePct: rate, monthlyPayment: payment, interest, capital, fee: remortgage ? remortgageFee : 0, remortgage, balance: Math.max(0, balance) });
  }
  return {
    years,
    totalInterest: years.reduce((s, y) => s + y.interest, 0),
    totalFees: years.reduce((s, y) => s + y.fee, 0),
    remortgages: years.filter(y => y.remortgage).length,
  };
}

const filled = v => v !== "" && v !== null && v !== undefined && !isNaN(+v);

// Builds the schedule's input from Candid's saved inputs (`d`) and the loan
// from the borrowing check, falling back to the defaults for anything blank.
export function mortgageInputs(d, loan) {
  const term = filled(d.propertyMortgageTerm) ? Math.round(+d.propertyMortgageTerm) : 0;
  return {
    loan,
    termYears: term >= 1 ? Math.min(MAX_TERM_YEARS, term) : DEFAULT_MORTGAGE_TERM_YEARS,
    fixedYears: FIXED_PERIOD_OPTIONS.includes(+d.propertyFixedYears) ? +d.propertyFixedYears : DEFAULT_FIXED_YEARS,
    ratePct: filled(d.propertyMortgageRate) ? +d.propertyMortgageRate : DEFAULT_MORTGAGE_RATE_PCT,
    remortgageFee: filled(d.propertyRemortgageFee) ? +d.propertyRemortgageFee : DEFAULT_REMORTGAGE_FEE,
  };
}

// The figures the mortgage step shows: the payment on the first deal, what
// it would be from the first remortgage under stress, and the fees.
export function mortgageSummary(input) {
  const moderate = mortgageSchedule(input);
  const stress = mortgageSchedule({ ...input, scenario: "stress" });
  const firstRemortgage = stress.years.find(y => y.remortgage) || null;
  return {
    monthlyPayment: moderate.years[0]?.monthlyPayment ?? 0,
    stressPayment: firstRemortgage ? firstRemortgage.monthlyPayment : null,
    stressRatePct: firstRemortgage ? firstRemortgage.ratePct : null,
    firstRemortgageYear: firstRemortgage ? firstRemortgage.year : null,
    remortgages: moderate.remortgages,
    totalFees: moderate.totalFees,
    totalInterest: moderate.totalInterest,
  };
}
