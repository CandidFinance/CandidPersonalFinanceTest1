// Field caps — pure logic, no CandidApp.jsx imports, so Edit inputs, the
// question flows and the app shell read one source of truth and can never
// disagree on a field's hard cap.

// Hard caps — silently clamp value, no message shown
export const FIELD_CAPS = {
  salary:1000000, bonusAmount:5000000, otherIncome:1000000, dividendIncome:5000000,
  monthlyExpenses:50000, childcareMonthly:10000,
  savingsRate:10, premiumBonds:50000,
  isaThisYearCash:20000, isaThisYearSS:20000, isaThisYearLISA:4000, isaThisYearOther:20000,
  isaPrevCash:500000, isaPrevSS:500000, isaPrevLISA:500000, isaPrevOther:500000,
  unwrappedValue:10000000, unrealisedGains:5000000, realisedCgtGains:5000000,
  houseTargetAmount:5000000, bigPurchaseTargetAmount:1000000,
  myContribution:60, employerMatch:20,
  potValue:10000000, potValue2:10000000, niYears:35,
  taxFreeCashTaken:1000000, statePensionAmount:50000, pensionProtectedAmount:1500000,
  loanBalance:200000, mortgageBalance:5000000, mortgageRate:15,
  personalLoanBalance:500000, personalLoanRate:50,
};

export function capField(field, raw) {
  const v = parseFloat(String(raw).replace(/[£,%,\s]/g,""));
  if (isNaN(v)) return raw;
  const cap = FIELD_CAPS[field];
  if (cap !== undefined && v > cap) return String(cap);
  return raw;
}
