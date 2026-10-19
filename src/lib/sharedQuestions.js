// The figures several modules need (employment, salary, other income, age,
// spending), asked by whichever module's walk-through comes first and never
// again. Same question fields as src/lib/propertyGuide.js; unit tested in
// moduleGuide.test.js. Spec: docs/onboarding-guided-questions.md.
//
// "Already asked" can't always be read off the field: employmentStatus
// defaults to "employed" in a blank profile, so answering it also sets
// employmentAsked. The other-income gate (hasExtraIncome) starts unset.

import { fmt } from "./format.js";
import { DIVIDEND_ALLOWANCE } from "./rentVsBuy.js";

const filled = v => v !== "" && v !== null && v !== undefined && !isNaN(+v);
const NONE = { label:"None", value:"" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const extraIncomeUnasked = ({ d }) => d.hasExtraIncome == null && ![d.bonusAmount, d.dividendIncome, d.otherIncome].some(v => +v > 0);
// Which kinds of other income: picked on one screen (extraIncomeKinds); for
// anyone who said "yes" before that existed, all three are asked.
const hasExtra = kind => ({ d }) => d.hasExtraIncome === "yes" && (!Array.isArray(d.extraIncomeKinds) || d.extraIncomeKinds.includes(kind));
const EXTRA_KINDS = [{ value:"bonus", label:"A bonus" }, { value:"dividends", label:"Dividends" }, { value:"other", label:"Rent or other income" }, { value:"none", label:"None of these", exclusive:true }];

export const EMPLOYMENT_QUESTION = {
  id:"employment", field:"employmentStatus", kind:"choice", group:"you",
  ask: () => "Are you employed, self-employed or not working?",
  why: () => "Changes which tax breaks and employer benefits you can use.",
  options: () => [{ value:"employed", label:"Employed" }, { value:"self_employed", label:"Self-employed" }, { value:"not_working", label:"Not working" }],
  also: () => ({ employmentAsked: true }),
  ifMissing: ({ d }) => !d.employmentAsked,
};

// Not working covers retired and between jobs, which want different answers
// about a pension (pension.js inRetirement).
export const NOT_WORKING_QUESTION = {
  id:"notWorking", field:"notWorkingReason", kind:"choice", group:"you",
  ask: () => "Are you retired, or between jobs?",
  why: () => "Retired, your pension is for drawing on now. Otherwise, it's for later.",
  options: () => [{ value:"retired", label:"Retired" }, { value:"break", label:"Between jobs or taking a break" }],
  showIf: ({ d }) => d.employmentStatus === "not_working",
  ifMissing: ({ d }) => d.employmentStatus === "not_working" && !d.notWorkingReason,
};

// Between jobs: what they'd earned this tax year before stopping, which
// still sets this year's tax band (metrics earnedEarlierThisYear). Without
// it, their last salary for the months so far.
export const EARNED_THIS_YEAR_QUESTION = {
  id:"earnedThisYear", field:"earnedThisTaxYear", kind:"money", label:"Earned this tax year", cap:"salary", group:"you",
  ask: () => "What had you earned this tax year before you stopped, before tax?",
  why: () => "It still sets this year's tax band, which decides the tax on your savings interest.",
  note: () => "Your P45 or last payslip shows it as pay to date. A rough figure is fine.",
  showIf: ({ d }) => d.employmentStatus === "not_working" && d.notWorkingReason === "break",
  ifMissing: ({ d }) => d.employmentStatus === "not_working" && d.notWorkingReason === "break" && (d.earnedThisTaxYear === "" || d.earnedThisTaxYear == null),
};

// Scotland has its own income tax rates (tax.js). Asked once of everyone,
// since it changes the tax on pay, pensions and the £100k trap.
export const SCOTLAND_QUESTION = {
  id:"scotland", field:"scottishTaxpayer", kind:"choice", group:"you",
  ask: () => "Do you live in Scotland?",
  why: () => "Scotland has its own income tax rates.",
  options: () => [{ value:"yes", label:"Yes" }, { value:"no", label:"No" }],
  ifMissing: ({ d }) => d.scottishTaxpayer == null || d.scottishTaxpayer === "",
};

export const SALARY_QUESTION = {
  id:"salary", field:"salary", kind:"money", label:"Salary", cap:"salary", required:true, group:"you",
  ask: ({ d }) => d.employmentStatus === "self_employed" ? "What do you earn a year, before tax?" : "What's your salary before tax?",
  why: () => "Sets your tax band, which changes most of what Candid suggests.",
  showIf: ({ d }) => d.employmentStatus !== "not_working",
  ifMissing: ({ d }) => !(+d.salary > 0),
};

export const EXTRA_INCOME_QUESTIONS = [
  {
    id:"extraIncome", field:"extraIncomeKinds", kind:"multi", group:"you", required:true,
    ask: () => "Any income besides your salary?",
    why: () => "Bonuses, dividends and other income can push you into a higher tax band.",
    note: () => "Pick any that apply.",
    options: () => EXTRA_KINDS,
    also: value => ({ hasExtraIncome: (value || []).some(v => v !== "none") ? "yes" : "no" }),
    ifMissing: extraIncomeUnasked,
  },
  {
    id:"bonus", field:"bonusAmount", kind:"money", label:"Bonus a year", cap:"bonusAmount", required:true, group:"you",
    ask: () => "Roughly how much is your yearly bonus?",
    why: () => "A bonus is taxed like salary, at your top rate.",
    notSure: () => ({ label:"No bonus", value:"" }),
    showIf: hasExtra("bonus"), ifMissing: extraIncomeUnasked,
  },
  {
    // Optional: a subscriber's bonus reminder comes the month before
    // (src/lib/alerts.js), or in February when it isn't known.
    id:"bonusMonth", field:"bonusMonth", kind:"choice", group:"you",
    ask: () => "Which month is your bonus usually paid?",
    why: () => "Paying it into a pension has to be arranged before then.",
    options: () => [...MONTHS.map((label, i) => ({ value:String(i + 1), label })), { value:"", label:"Not sure" }],
    showIf: ctx => hasExtra("bonus")(ctx) && +ctx.d.bonusAmount > 0,
    ifMissing: ({ d }) => d.bonusMonth == null,
  },
  {
    id:"dividends", field:"dividendIncome", kind:"money", label:"Dividends a year", cap:"dividendIncome", required:true, group:"you",
    ask: () => "How much do you get in dividends a year?",
    why: () => `Dividends above ${fmt(DIVIDEND_ALLOWANCE)} a year are taxed, unless they're in an ISA.`,
    notSure: () => NONE,
    showIf: hasExtra("dividends"), ifMissing: extraIncomeUnasked,
  },
  {
    id:"otherIncome", field:"otherIncome", kind:"money", label:"Other income a year", cap:"otherIncome", required:true, group:"you",
    ask: () => "Any other income a year, such as rent?",
    why: () => "It's added to your salary when working out your tax band.",
    notSure: () => NONE,
    showIf: hasExtra("other"), ifMissing: extraIncomeUnasked,
  },
];

export const AGE_QUESTION = {
  id:"age", field:"age", kind:"years", label:"Age", required:true, group:"you",
  // ISAs are for 18 and over, and so is Candid.
  min: 18,
  minNote: () => "Candid is for adults: you need to be 18 or over.",
  ask: () => "How old are you?",
  why: () => "Sets how long your money has to grow.",
  ifMissing: ({ d }) => !filled(d.age) || !(+d.age > 0),
};

export const SPENDING_QUESTION = {
  id:"spending", field:"monthlyExpenses", kind:"money", label:"Monthly spending", cap:"monthlyExpenses", required:true, group:"you",
  ask: () => "What do you spend in a typical month on essentials?",
  why: () => "Shows how many months your savings would cover.",
  note: () => "Rent or mortgage, bills, food and getting around.",
  ifMissing: ({ d }) => !(+d.monthlyExpenses > 0),
};

// Employment first, so salary can be skipped for someone not working.
export const ABOUT_YOU = [EMPLOYMENT_QUESTION, NOT_WORKING_QUESTION, EARNED_THIS_YEAR_QUESTION, SALARY_QUESTION, SCOTLAND_QUESTION, ...EXTRA_INCOME_QUESTIONS];
