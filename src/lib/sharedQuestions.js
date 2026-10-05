// The figures several modules need (employment, salary, other income, age,
// spending), asked by whichever module's walk-through comes first and never
// again. Same question fields as src/lib/propertyGuide.js; unit tested in
// moduleGuide.test.js. Spec: onboarding-guided-questions.md.
//
// "Already asked" can't always be read off the field: employmentStatus
// defaults to "employed" in a blank profile, so answering it also sets
// employmentAsked. The other-income gate (hasExtraIncome) starts unset.

import { fmt } from "./format.js";
import { DIVIDEND_ALLOWANCE } from "./rentVsBuy.js";

const filled = v => v !== "" && v !== null && v !== undefined && !isNaN(+v);
const NONE = { label:"None", value:"" };
const extraIncomeUnasked = ({ d }) => d.hasExtraIncome == null && ![d.bonusAmount, d.dividendIncome, d.otherIncome].some(v => +v > 0);
const hasExtra = ({ d }) => d.hasExtraIncome === "yes";

export const EMPLOYMENT_QUESTION = {
  id:"employment", field:"employmentStatus", kind:"choice", group:"you",
  ask: () => "Are you employed, self-employed or not working?",
  why: () => "Changes which tax breaks and employer benefits you can use.",
  options: () => [{ value:"employed", label:"Employed" }, { value:"self_employed", label:"Self-employed" }, { value:"not_working", label:"Not working" }],
  also: () => ({ employmentAsked: true }),
  ifMissing: ({ d }) => !d.employmentAsked,
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
    id:"extraIncome", field:"hasExtraIncome", kind:"choice", group:"you",
    ask: () => "Any income besides your salary?",
    why: () => "Bonuses, dividends and other income can push you into a higher tax band.",
    options: () => [{ value:"yes", label:"Yes" }, { value:"no", label:"No" }],
    ifMissing: extraIncomeUnasked,
  },
  {
    id:"bonus", field:"bonusAmount", kind:"money", label:"Bonus a year", cap:"bonusAmount", required:true, group:"you",
    ask: () => "Roughly how much is your yearly bonus?",
    why: () => "A bonus is taxed like salary, at your top rate.",
    notSure: () => ({ label:"No bonus", value:"" }),
    showIf: hasExtra, ifMissing: extraIncomeUnasked,
  },
  {
    id:"dividends", field:"dividendIncome", kind:"money", label:"Dividends a year", cap:"dividendIncome", required:true, group:"you",
    ask: () => "How much do you get in dividends a year?",
    why: () => `Dividends above ${fmt(DIVIDEND_ALLOWANCE)} a year are taxed, unless they're in an ISA.`,
    notSure: () => NONE,
    showIf: hasExtra, ifMissing: extraIncomeUnasked,
  },
  {
    id:"otherIncome", field:"otherIncome", kind:"money", label:"Other income a year", cap:"otherIncome", required:true, group:"you",
    ask: () => "Any other income a year, such as rent?",
    why: () => "It's added to your salary when working out your tax band.",
    notSure: () => NONE,
    showIf: hasExtra, ifMissing: extraIncomeUnasked,
  },
];

export const AGE_QUESTION = {
  id:"age", field:"age", kind:"years", label:"Age", required:true, group:"you",
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
export const ABOUT_YOU = [EMPLOYMENT_QUESTION, SALARY_QUESTION, ...EXTRA_INCOME_QUESTIONS];
