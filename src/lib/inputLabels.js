// Edit inputs (MobileInputsScreen) names each answer in a word or two, not
// the walk-through's full question (moduleGuide.js `ask`): a page of every
// answer reads faster as labels. Keyed by field, as a field is one answer
// wherever it's asked. A field not here falls back to its input label, then
// to the question.
export const SHORT_LABELS = {
  // Cash & savings
  hasCashSavings: "Cash savings",
  cashTiers: "Accounts and rates",
  hasPremiumBonds: "Premium Bonds",
  premiumBonds: "In Premium Bonds",
  hasCashIsaThisYear: "Cash ISA this tax year",
  isaThisYearCash: "Cash ISA paid in",
  hasOtherIsaThisYear: "Other ISAs this tax year",
  isaThisYearOtherTypes: "Other ISAs paid in",
  isaPrevCash: "Cash ISAs, earlier years",
  cashAccessType: "Access to savings",
  // Investments
  hasInvestments: "Investments",
  hasSsIsa: "Stocks and Shares ISA",
  isaPrevSS: "In it before 6 April",
  isaThisYearSS: "Paid in since 6 April",
  hasLisa: "Lifetime ISA",
  isaPrevLISA: "In it before 6 April",
  isaThisYearLISA: "Paid in since 6 April",
  hasUnwrapped: "Outside an ISA or pension",
  unwrappedValue: "Worth now",
  unrealisedGains: "Profit so far",
  hasSoldAssetsOutsideWrapper: "Sold since 6 April",
  realisedCgtGains: "Profit made",
  // Pension
  pensionStatus: "Paying in",
  myContribution: "Your contribution",
  pensionType: "How you pay in",
  hasPensionPot: "Pension not paid into",
  employerContributionType: "Employer contribution",
  employerMatch: "Employer pays",
  potValue: "Pension pot",
  dbPensionIncome: "Pension a year",
  hasOldPensions: "Pensions from old jobs",
  potValue2: "Old pensions",
  pensionAccess: "Taking money out",
  taxFreeCashTaken: "Tax-free cash taken",
  pensionProtection: "Pension protection",
  pensionProtectedAmount: "Protected amount",
  statePensionAmount: "State Pension a year",
  retirementAge: "Retirement age",
  retirementTarget: "Retirement income",
  // Student loan
  salaryTrajectory: "Salary growth",
  loanBalance: "Still owed",
  slPlanAnswer: "Plan",
  slFinishYear: "Course finished",
  studentLoanRate: "Interest rate",
  slCountry: "Applied from",
  slCourse: "Course type",
  slStart: "Course started",
  slStudyYears: "Course length",
  slTuition: "Tuition fee loan",
  slMaintenance: "Maintenance loan",
  hasPgLoan: "Postgraduate loan",
  pgLoanBalance: "Postgraduate still owed",
  // Kids & family, £100k tax trap
  kidsStatus: "Children",
  kidsCount: "Number of children",
  kidsPreschool: "Not yet at school",
  kidsSchool: "At school, 11 or under",
  childcareMonthly: "Childcare a month",
  partnerOver100k: "Partner earns over £100k",
  partnerIncome: "Partner's income",
  tfcClaiming: "Tax-Free Childcare",
  childBenefitChildren: "Child Benefit",
  cbHigherEarner: "Higher earner",
  payday: "Payday",
};

export function shortLabel(q, ctx) {
  if (SHORT_LABELS[q.field]) return SHORT_LABELS[q.field];
  if (q.label) return q.label;
  return typeof q.ask === "function" ? q.ask(ctx) : q.ask;
}
