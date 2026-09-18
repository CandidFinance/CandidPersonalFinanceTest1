// Shared onboarding step definitions and field caps — pure logic, no
// CandidApp.jsx imports, so both the desktop wizard (OnboardingScreen/
// OnboardingStep) and the mobile wizard (MobileOnboardingScreen) read from a
// single source of truth and can never disagree on which steps exist or what
// a field's hard cap is.

export const ALL_STEP_DEFS = [
  { id:"modules",     label:"Focus",           shortLabel:"Focus",       mobileLabel:"Focus", always:true },
  { id:"name",        label:"Name",            shortLabel:"Name",        mobileLabel:"Name",  always:true },
  { id:"email",       label:"Email",           shortLabel:"Email",       mobileLabel:"Email", always:true },
  { id:"about",       label:"About you",       shortLabel:"Income",      mobileLabel:"Inc.",  always:true },
  { id:"cash",        label:"Cash & savings",  shortLabel:"Savings",     mobileLabel:"Sav.",  moduleKey:"cash" },
  { id:"investments", label:"Investments",     shortLabel:"Invest.",     mobileLabel:"Inv.",  moduleKey:"investments" },
  { id:"pension",     label:"Pension",         shortLabel:"Pension",     mobileLabel:"Pension", moduleKey:"pension" },
  { id:"studentLoan", label:"Student loan",    shortLabel:"Student loan", mobileLabel:"Loan", moduleKey:"studentLoan" },
];

export function getActiveSteps(d) {
  const selected = new Set(d.selectedModules || []);
  return ALL_STEP_DEFS.filter(s => s.always || selected.has(s.moduleKey));
}

// Hard caps — silently clamp value, no message shown
export const FIELD_CAPS = {
  salary:1000000, bonusAmount:5000000, otherIncome:1000000, dividendIncome:5000000,
  monthlyExpenses:50000,
  savingsRate:10, premiumBonds:50000,
  isaThisYearCash:20000, isaThisYearSS:20000, isaThisYearLISA:4000, isaThisYearOther:20000,
  isaPrevCash:500000, isaPrevSS:500000, isaPrevLISA:500000, isaPrevOther:500000,
  unwrappedValue:10000000, unrealisedGains:5000000,
  myContribution:60, employerMatch:20,
  potValue:10000000, potValue2:10000000, niYears:35,
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

// The £20,000 annual ISA allowance is one shared pot across Cash ISA (asked
// in the Cash & Savings step) and S&S/LISA/Other (asked in Investments) — so
// both steps need the same combined total to warn consistently.
export function isaThisYearTotal(d) {
  return (+d.isaThisYearCash||0) + (+d.isaThisYearSS||0) + (+d.isaThisYearLISA||0) + (+d.isaThisYearOther||0);
}
