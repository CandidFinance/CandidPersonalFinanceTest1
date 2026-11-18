// Test profiles: saved answers for a spread of users, seeded into
// localStorage as `candid_inputs`. Used by the screen check
// (scripts/screen-check.js) and the screen capture for reviews
// (scripts/screen-capture.mjs). Add a profile here when a change brings in a
// new kind of user or answer, and to KEY_PROFILES if it's a core user.

export const ALL_MODULES = ["pension", "cash", "investments", "studentLoan", "kids", "taxTrap"];
const done = { selectedModules: ALL_MODULES, answeredModules: ALL_MODULES, unlockedModules: ALL_MODULES, goalsAsked: true, confidenceAsked: true, email: "check@example.com",
  employmentAsked: true, hasExtraIncome: "no", extraIncomeKinds: ["none"] };
const rich = { ...done, name: "Sam", age: "38", employmentStatus: "employed", scottishTaxpayer: "no", salary: "110000", hasPension: "yes", pensionStatus: "yes",
  pensionKind: "dc", pensionType: "sacrifice", myContribution: "5", employerMatch: "5", employerContributionType: "match", potValue: "85000", retirementAge: "67",
  retirementTarget: "32700", childBenefitChildren: "2", cbHigherEarner: "yes", hasKids: "yes", numKids: "2", monthlyExpenses: "3000",
  cashTiers: [{ name: "Old", amount: "25000", rate: "1" }], hasInvestments: "yes", unwrappedValue: "30000", unrealisedGains: "8000",
  studentLoan: "plan2", slPlanAnswer: "plan2", loanBalance: "45000", bonusAmount: "15000", hasBonus: "yes", bonusMonth: "3", inputsTaxYear: 2025,
  ukNation: "england", kidsPreschool: "1", kidsSchool: "1", childcareMonthly: "1500", partnerOver100k: "no" };
export const PROFILES = {
  rich,
  scottish: { ...rich, scottishTaxpayer: "yes", salary: "95000" },
  finalSalary: { ...rich, salary: "60000", pensionStatus: "db", pensionKind: "db", dbPensionIncome: "21000", potValue: "" },
  unsurePension: { ...rich, salary: "40000", pensionStatus: "", hasPension: "", myContribution: "", employerMatch: "" },
  fixedEmployer: { ...rich, salary: "70000", employerContributionType: "fixed", employerMatch: "15", myContribution: "3" },
  selfEmployed: { ...rich, employmentStatus: "self_employed", salary: "55000", employerMatch: "" },
  director: { ...rich, salary: "12570", dividendIncome: "60000", hasExtraIncome: "yes", extraIncomeKinds: ["dividends"] },
  notWorking: { ...rich, employmentStatus: "not_working", notWorkingReason: "between_jobs", salary: "", earnedThisTaxYear: "20000" },
  retired: { ...rich, employmentStatus: "not_working", notWorkingReason: "retired", salary: "", age: "68", potValue: "400000" },
  loanNoAge: { ...rich, age: "", salary: "45000" },
  loanPlan1: { ...rich, studentLoan: "plan1", slPlanAnswer: "plan1", loanBalance: "8000", salary: "38000" },
  loanPostgrad: { ...rich, studentLoan: "postgrad", slPlanAnswer: "postgrad", loanBalance: "12000", salary: "35000" },
  loanUnsure: { ...rich, studentLoan: "none", slPlanAnswer: "unsure", slCountry: "england", loanBalance: "40000", salary: "45000" },
  loanLowPay: { ...rich, salary: "24000" },
  sparse: { ...done, name: "Al", age: "25", employmentStatus: "employed", salary: "30000" },
  familyWales: { ...rich, ukNation: "wales", salary: "105000" },
  familyPartnerOver: { ...rich, salary: "60000", partnerOver100k: "yes" },
  familyNear: { ...rich, salary: "98000", tfcClaiming: "yes" },
  familyUnclaimed: { ...rich, salary: "55000", tfcClaiming: "no", childBenefitChildren: "2", cbHigherEarner: "yes" },
  familyNoKids: { ...rich, kidsPreschool: "0", kidsSchool: "0", childcareMonthly: "" },
  familyNone: { ...rich, kidsStatus: "no" },
  familyPlanning: { ...rich, kidsStatus: "planning", kidsCount: "", kidsPreschool: "", kidsSchool: "", salary: "104000" },
  familyPartnerPays: { ...rich, salary: "70000", kidsCount: "2", partnerOver100k: "yes", partnerIncome: "112000" },
  // £100k trap with a partner over £100k: childcare already stopped, so not
  // counted in the trap (unticked rows, total = the allowance tax alone).
  trapPartnerOver: { ...rich, partnerOver100k: "yes" },
  // £100k trap on pay to date: ahead of their salary, so the module, its card
  // and Home work from the salary it implies (taxTrap.js thisTaxYear). From
  // 6 April 2027 it reads as last year's and the module is on their answers.
  trapPayToDate: { ...rich, salary: "98000", bonusAmount: "", hasBonus: "no", payToDate: "52000", payToDateOn: "2026-09-28" },
  // Paying it off comes out ahead: the opportunity, "Is the money spare?" and a lump sum.
  loanWorthOverpaying: { ...rich, salary: "75000", loanBalance: "18500", studentLoanRate: "6.4", hasPgLoan: "no", isaThisYearCash: "5000", cashTiers: [{ name: "Easy", amount: "40000", rate: "4.5" }] },
  // A balance set months ago: rolled on payday by payday as the app opens.
  loanRolling: { ...rich, loanBalanceSet: "45000", loanBalanceAsOf: "2026-06-10", hasPgLoan: "yes", pgLoanBalance: "9000", pgLoanBalanceSet: "9000" },
  loanWithPostgrad: { ...rich, salary: "48000", hasPgLoan: "yes", pgLoanBalance: "14000" },
  loanFastPay: { ...rich, salary: "34000", age: "25", loanBalance: "55000", salaryTrajectory: "high" },
  loanBelowThreshold: { ...rich, salary: "26000", age: "23", loanBalance: "50000", hasPgLoan: "yes", pgLoanBalance: "12000" },
  // Only Student loan answered, then savings and the pension match on its
  // short route (moduleGuide.js briefQuestions): the rest of Cash
  // and Pension not answered.
  loanOnly: { name: "Jo", appEntered: true, email: "check@example.com", unlockGate: true, unlockedModules: ["studentLoan"], selectedModules: ["studentLoan"], answeredModules: ["studentLoan"],
    goalsAsked: true, confidenceAsked: true, employmentStatus: "employed", employmentAsked: true, salary: "70000", salaryTrajectory: "stable",
    studentLoan: "plan2", slPlanAnswer: "plan2", loanBalance: "18500", studentLoanRate: "6.4", hasPgLoan: "no", monthlyExpenses: "2000",
    cashTiers: [{ amount: "20000", rate: "4" }], hasPremiumBonds: "yes", premiumBonds: "5000", hasCashIsaThisYear: "no", hasOtherIsaThisYear: "no",
    pensionStatus: "yes", hasPension: "yes", myContribution: "3", employerContributionType: "match", employerMatch: "5",
    askedFields: ["employmentStatus", "salary", "salaryTrajectory", "monthlyExpenses", "cashTiers", "hasPremiumBonds", "premiumBonds", "hasCashIsaThisYear", "hasOtherIsaThisYear", "pensionStatus", "myContribution", "employerContributionType", "employerMatch"] },
  // Every new user: all modules answered and open, with the premium features
  // locked (unlock.js premiumOpen). The others come in before the gate.
  freeUser: { ...rich, unlockGate: true },
  // The ICP's cash-rich saver: over 50, a large balance on a poor rate.
  cashRichSaver: { ...rich, age: "58", salary: "48000", studentLoan: "none", slPlanAnswer: "", loanBalance: "", cashTiers: [{ name: "High street", amount: "150000", rate: "1.2" }], potValue: "320000", childBenefitChildren: "", hasKids: "no", kidsStatus: "no" },
};
// The key ICPs (docs/investor-personas.md, ICP): the employed higher-rate
// core with a workplace pension, the same with a student loan worth paying
// off, Student loan alone on its short route, the cash-rich saver, and the
// core again as a new user would have it, with premium locked.
export const KEY_PROFILES = ["rich", "loanWorthOverpaying", "loanOnly", "cashRichSaver", "freeUser"];
