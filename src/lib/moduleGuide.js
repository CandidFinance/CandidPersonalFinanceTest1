// Each module's guided walk-through: the questions asked the first time a
// module is opened, after which the module's own screen shows its answer.
// Same question fields and walk-through as Property (src/lib/propertyGuide.js,
// GuidedFlow); unit tested in moduleGuide.test.js. Spec:
// docs/onboarding-guided-questions.md.
//
// Every module starts with the shared figures it needs (sharedQuestions.js),
// each asked only if Candid doesn't have it yet, so the first module asks a
// few more questions than later ones.

import { fmt } from "./format.js";
import { ISA_ALLOWANCE } from "./tax.js";
import { CGT_ALLOWANCE } from "./rentVsBuy.js";
import { FIELD_CAPS } from "./onboarding.js";
import { itemisedNonCashIsa } from "./isa.js";
import { estimatePensionPot, LUMP_SUM_ALLOWANCE, hasStartedDrawing } from "./pension.js";
import { STATE_PENSION_FULL } from "./tax.js";
import { workingPastRetirementAge } from "./metrics.js";
import { resolveSlRate, studentLoanPlanFrom, estimateSlBalance, slEstimateReady, PG_WITH_PLANS, slFinishYearRange } from "./studentLoan.js";
import { ABOUT_YOU, AGE_QUESTION, SPENDING_QUESTION, NATION_OPTIONS, nationAlso, EMPLOYMENT_QUESTION, NOT_WORKING_QUESTION, EARNED_THIS_YEAR_QUESTION, SALARY_QUESTION } from "./sharedQuestions.js";
import { CHILDCARE_INCOME_LIMIT, kidsSituation } from "./childcare.js";

const YES_NO = [{ value:"yes", label:"Yes" }, { value:"no", label:"No" }];
const LEAVE_BLANK = { label:"I'm not sure" };
const NONE = { label:"None", value:"" };
const filled = v => v !== "" && v !== null && v !== undefined && !isNaN(+v);
const is = (field, value) => ({ d }) => d[field] === value;
// The Lifetime ISA's 25% bonus on up to the yearly limit Candid caps it at.
const LISA_LIMIT = FIELD_CAPS.isaThisYearLISA;
const LISA_BONUS = LISA_LIMIT * 0.25;

const CASH_QUESTIONS = [
  ...ABOUT_YOU,
  SPENDING_QUESTION,
  {
    // Each account's balance and rate, on one screen (MobileCashTiersList).
    id:"cashAccounts", field:"cashTiers", kind:"custom", render:"cashAccounts", required:true,
    ask: () => "How much is in your savings, and what rate does it pay?",
    why: () => "Shows what your cash earns against the best rates available.",
    note: () => "Add each account. Leave the rate blank if you're not sure.",
    answered: ({ d }) => (d.cashTiers || []).some(t => +t.amount > 0),
    // Asked once: on the short route from Student loan, say, after which
    // this walk-through skips it.
    ifMissing: ({ d }) => !(d.cashTiers || []).some(t => +t.amount > 0),
    notSure: () => ({ label:"I don't have any savings", value:[{ amount:"", rate:"" }] }),
  },
  {
    id:"hasPremiumBonds", field:"hasPremiumBonds", kind:"choice",
    ask: () => "Do you have Premium Bonds?",
    why: () => "Their prize rate can beat or trail a savings account.",
    options: () => YES_NO,
    ifMissing: () => true, // asked once: on the short route from Student loan, say
  },
  {
    id:"premiumBonds", field:"premiumBonds", kind:"money", label:"Premium Bonds", cap:"premiumBonds", required:true,
    ask: () => "How much is in Premium Bonds?",
    why: () => "Counted alongside your savings, and compared with savings rates.",
    showIf: is("hasPremiumBonds", "yes"),
    ifMissing: () => true, // asked once: on the short route from Student loan, say
  },
  {
    id:"hasCashIsa", field:"hasCashIsaThisYear", kind:"choice",
    ask: () => "Have you paid into a Cash ISA since 6 April?",
    why: () => `Your ${fmt(ISA_ALLOWANCE)} allowance is lost if it's not used by 5 April.`,
    options: () => YES_NO,
    ifMissing: () => true, // asked once: on the short route from Student loan, say
  },
  {
    id:"cashIsaThisYear", field:"isaThisYearCash", kind:"money", label:"Paid in since 6 April", cap:"isaThisYearCash", required:true,
    ask: () => "How much have you paid in since 6 April?",
    why: () => "Counts towards this year's allowance, shared across all your ISAs.",
    showIf: is("hasCashIsaThisYear", "yes"),
    ifMissing: () => true, // asked once: on the short route from Student loan, say
  },
  {
    // Stocks and shares, Lifetime and other ISAs use the same allowance.
    // Investments asks for each; until then, one total here, so the cash
    // figures don't assume allowance that's already been used.
    id:"otherIsa", field:"hasOtherIsaThisYear", kind:"choice",
    ask: () => "Have you paid into any other kind of ISA since 6 April?",
    why: () => `Stocks and shares, Lifetime and other ISAs share the same ${fmt(ISA_ALLOWANCE)} allowance.`,
    options: () => YES_NO,
    showIf: ({ d }) => itemisedNonCashIsa(d) === 0,
    ifMissing: () => true, // asked once: on the short route from Student loan, say
  },
  {
    id:"otherIsaThisYear", field:"isaThisYearOtherTypes", kind:"money", label:"Paid in since 6 April", cap:"isaThisYearOther", required:true,
    ask: () => "How much, across those ISAs?",
    why: () => "So Candid knows how much allowance is left for cash.",
    showIf: ({ d }) => itemisedNonCashIsa(d) === 0 && d.hasOtherIsaThisYear === "yes",
    ifMissing: () => true, // asked once: on the short route from Student loan, say
  },
  {
    id:"cashIsaEarlier", field:"isaPrevCash", kind:"money", label:"From earlier years", cap:"isaPrevCash", required:true,
    ask: () => "And how much is in Cash ISAs from earlier years?",
    why: () => "Interest on it is never taxed.",
    notSure: () => NONE,
  },
  {
    id:"cashAccess", field:"cashAccessType", kind:"choice",
    ask: () => "Could you get to your savings within a few days?",
    why: () => "Emergency money needs to be reachable quickly.",
    options: () => [{ value:"yes", label:"Yes, instant access" }, { value:"partial", label:"Some of it" }, { value:"no", label:"No" }],
  },
];

const investing = is("hasInvestments", "yes");
const unwrapped = is("hasUnwrapped", "yes");

const INVESTMENTS_QUESTIONS = [
  ...ABOUT_YOU,
  {
    id:"hasInvestments", field:"hasInvestments", kind:"choice",
    ask: () => "Do you have any investments?",
    why: () => "Shares and funds all count, in an ISA or not.",
    options: () => YES_NO,
  },
  {
    id:"ssIsaEarlier", field:"isaPrevSS", kind:"money", label:"Before 6 April", cap:"isaPrevSS", required:true,
    ask: () => "How much did you have in Stocks and Shares ISAs before 6 April?",
    why: () => "Growth inside an ISA is never taxed.",
    notSure: () => NONE, showIf: investing,
  },
  {
    id:"ssIsaThisYear", field:"isaThisYearSS", kind:"money", label:"Paid in since 6 April", cap:"isaThisYearSS", required:true,
    ask: () => "And how much have you paid in since 6 April?",
    why: () => `Your ${fmt(ISA_ALLOWANCE)} allowance is shared across all your ISAs.`,
    notSure: () => NONE, showIf: investing,
  },
  {
    id:"hasLisa", field:"hasLisa", kind:"choice",
    ask: () => "Do you have a Lifetime ISA?",
    why: () => `The government adds 25% to what you pay in, up to ${fmt(LISA_BONUS)} a year.`,
    options: () => YES_NO, showIf: investing,
  },
  {
    id:"lisaEarlier", field:"isaPrevLISA", kind:"money", label:"Before 6 April", cap:"isaPrevLISA", required:true,
    ask: () => "How much was in it before 6 April?",
    why: () => "It counts towards a first home or retirement, with the bonus added.",
    notSure: () => NONE, showIf: ctx => investing(ctx) && ctx.d.hasLisa === "yes",
  },
  {
    id:"lisaThisYear", field:"isaThisYearLISA", kind:"money", label:"Paid in since 6 April", cap:"isaThisYearLISA", required:true,
    ask: () => "And how much have you paid in since 6 April?",
    why: () => `You can pay in up to ${fmt(LISA_LIMIT)} a year and still get the bonus.`,
    notSure: () => NONE, showIf: ctx => investing(ctx) && ctx.d.hasLisa === "yes",
  },
  {
    id:"hasUnwrapped", field:"hasUnwrapped", kind:"choice",
    ask: () => "Any investments outside an ISA or pension?",
    why: () => "Gains and dividends there can be taxed.",
    options: () => YES_NO, showIf: investing,
  },
  {
    id:"unwrappedValue", field:"unwrappedValue", kind:"money", label:"Worth now", cap:"unwrappedValue", required:true,
    ask: () => "Roughly how much are they worth?",
    why: () => "Shows how much could move into an ISA over time.",
    showIf: ctx => investing(ctx) && unwrapped(ctx),
  },
  {
    id:"unrealisedGains", field:"unrealisedGains", kind:"money", label:"Profit so far", cap:"unrealisedGains", required:true,
    ask: () => "Roughly how much of that is profit?",
    why: () => `Shows how much of the ${fmt(CGT_ALLOWANCE)} tax-free gains allowance you'd use.`,
    notSure: () => LEAVE_BLANK, showIf: ctx => investing(ctx) && unwrapped(ctx),
  },
  {
    id:"soldThisYear", field:"hasSoldAssetsOutsideWrapper", kind:"choice",
    ask: () => "Have you sold any of those since 6 April?",
    why: () => `Profits from sales count against the same ${fmt(CGT_ALLOWANCE)} allowance.`,
    options: () => YES_NO, showIf: ctx => investing(ctx) && unwrapped(ctx),
  },
  {
    id:"realisedGains", field:"realisedCgtGains", kind:"money", label:"Profit made", cap:"realisedCgtGains", required:true,
    ask: () => "Roughly how much profit did you make?",
    why: () => "So Candid can track what's left of your allowance this year.",
    notSure: () => LEAVE_BLANK,
    showIf: ctx => investing(ctx) && unwrapped(ctx) && ctx.d.hasSoldAssetsOutsideWrapper === "yes",
  },
];

const paying = is("pensionStatus", "yes");
// A final salary or career average scheme (NHS, teachers, civil service,
// police, university): it pays a set income, so there's no pot to ask about.
const finalSalary = is("pensionStatus", "db");
// A pot they no longer pay into (retired, or from an old job) still counts:
// "No" to paying in isn't "no pension".
const hasPot = ctx => paying(ctx) || (ctx.d.pensionStatus === "no" && ctx.d.hasPensionPot === "yes");
const totalPot = d => (+d.potValue || 0) + (+d.potValue2 || 0);

const PENSION_QUESTIONS = [
  ...ABOUT_YOU,
  AGE_QUESTION,
  {
    // "Not sure" is an answer here, as before: the module then explains how
    // to find out.
    id:"pensionStatus", field:"pensionStatus", kind:"choice",
    ask: () => "Do you pay into a workplace or personal pension?",
    why: () => "Pensions get tax relief, and often money from your employer too.",
    options: () => [
      { value:"yes", label:"Yes" },
      { value:"db", label:"Yes, a final salary or career average scheme (such as NHS, teachers or civil service)" },
      { value:"no", label:"No" }, { value:"unsure", label:"Not sure" },
    ],
    also: value => value === "unsure" ? { pensionUnknown: true, pensionKind: "" }
      : value === "db" ? { pensionUnknown: false, hasPension: "yes", pensionKind: "db" }
      : { pensionUnknown: false, hasPension: value, pensionKind: value === "yes" ? "dc" : "" },
    // Asked once: on the short route from Student loan, say.
    ifMissing: () => true,
    // Below a "Yes", on the same screen (GuidedFlow.jsx `follow`): what they
    // pay in (already there if Property's checks asked it, same field), and
    // how. Either can be left blank.
    follow: [
      { field:"myContribution", kind:"percent", inputLabel:"Your contribution", cap:"myContribution",
        label: ({ d }) => d.employmentStatus === "self_employed" ? "What percentage of your earnings do you pay in?" : "What percentage of your salary do you pay in?",
        note: ({ d }) => d.pensionStatus === "db" ? "It's on your payslip. Leave it blank if you're not sure." : "Leave it blank if you're not sure.",
        showIf: ctx => paying(ctx) || finalSalary(ctx) },
      { field:"pensionType", kind:"choice", label:"How do you pay in?",
        options: () => [
          { value:"sacrifice", label:"Before tax", sub:"Salary sacrifice" },
          { value:"relief", label:"Take-home pay", sub:"Relief at source" },
          { value:"", label:"Not sure" },
        ],
        note: () => "Your payslip shows it: before tax is taken off means salary sacrifice.",
        showIf: paying },
    ],
  },
  {
    id:"pensionPotNotPaying", field:"hasPensionPot", kind:"choice",
    ask: () => "Do you have a pension you no longer pay into?",
    why: () => "One you've retired from, or from an old job, still counts.",
    options: () => YES_NO,
    also: value => ({ hasPension: value === "yes" ? "yes" : "no" }),
    showIf: is("pensionStatus", "no"),
  },
  {
    // Most employers match what you pay up to a cap; some pay a set % (a
    // match you can't miss: employer.js). The percentage below it, on the
    // same screen. Skipped if Property's checks already had both.
    id:"employerType", field:"employerContributionType", kind:"choice",
    ask: () => "Does your employer match what you pay in, or pay a set amount?",
    why: () => "A match pays more when you pay more. A set amount doesn't.",
    options: () => [{ value:"match", label:"Matches what I pay, up to a limit" }, { value:"fixed", label:"Pays a set percentage, whatever I pay" }, { value:"", label:"Not sure" }],
    showIf: ctx => paying(ctx) && ctx.d.employmentStatus !== "self_employed",
    ifMissing: ({ d }) => d.employerContributionType == null || !filled(d.employerMatch),
    follow: [
      { field:"employerMatch", kind:"percent", inputLabel:"Employer pays", cap:"employerMatch",
        label: ({ d }) => d.employerContributionType === "fixed" ? "What percentage of your salary does your employer pay in?" : "Up to what percentage will your employer match it?",
        note: () => "It's in your contract, or ask HR. Leave it blank if you're not sure." },
    ],
  },
  {
    id:"pensionPot", field:"potValue", kind:"money", label:"Pension now", cap:"potValue", required:true,
    ask: ({ d }) => d.pensionStatus === "yes" ? "Roughly how much is in your pension now?" : "Roughly how much is in your pensions altogether?",
    why: () => "Sets where your retirement income starts from.",
    notSure: ({ d }) => {
      const estimate = estimatePensionPot(d);
      return estimate > 0 ? { label:`Estimate it for me (about ${fmt(estimate)})`, value:String(estimate) } : LEAVE_BLANK;
    },
    showIf: hasPot,
  },
  {
    id:"dbIncome", field:"dbPensionIncome", kind:"money", label:"Pension a year", cap:"salary",
    ask: () => "Roughly how much will it pay you a year when you retire?",
    why: () => "Your scheme's latest annual statement shows it.",
    notSure: () => LEAVE_BLANK, showIf: finalSalary,
  },
  {
    id:"hasOldPensions", field:"hasOldPensions", kind:"choice",
    ask: () => "Any pensions from old jobs?",
    why: () => "Old pots still count, and are easy to lose track of.",
    options: () => YES_NO, showIf: ctx => paying(ctx) || finalSalary(ctx),
  },
  {
    id:"oldPensions", field:"potValue2", kind:"money", label:"Old pensions", cap:"potValue2", required:true,
    ask: () => "Roughly how much is in them altogether?",
    why: () => "Added to your main pot for your retirement picture.",
    notSure: () => LEAVE_BLANK, showIf: ctx => (paying(ctx) || finalSalary(ctx)) && ctx.d.hasOldPensions === "yes",
  },
  {
    // From 55, the earliest a pension can be taken (57 from April 2028).
    id:"pensionAccess", field:"pensionAccess", kind:"choice",
    ask: () => "Have you started taking money from your pension?",
    why: () => "Tax-free cash already taken, and any income drawn, change your limits.",
    options: () => [{ value:"none", label:"Not yet" }, { value:"taxFreeOnly", label:"Only tax-free cash" }, { value:"income", label:"Yes, an income or lump sums" }],
    showIf: ctx => hasPot(ctx) && +ctx.d.age >= 55,
  },
  {
    id:"taxFreeCashTaken", field:"taxFreeCashTaken", kind:"money", label:"Tax-free cash taken", cap:"taxFreeCashTaken", required:true,
    ask: () => "Roughly how much tax-free cash have you taken so far?",
    why: () => `It counts towards the ${fmt(LUMP_SUM_ALLOWANCE)} that can be taken tax-free in all.`,
    notSure: () => LEAVE_BLANK,
    showIf: ctx => hasPot(ctx) && +ctx.d.age >= 55 && hasStartedDrawing(ctx.d),
  },
  {
    // Only matters once 25% of the pot could pass the limit.
    id:"pensionProtection", field:"pensionProtection", kind:"choice",
    ask: () => "Do you hold a Fixed or Individual Protection?",
    why: () => `Protections from 2012 to 2016 allow more than ${fmt(LUMP_SUM_ALLOWANCE)} of tax-free cash.`,
    note: () => "HMRC sent a certificate with a reference number. Your pension provider will know too.",
    options: () => [
      { value:"none", label:"No" }, { value:"fp2012", label:"Fixed Protection 2012" },
      { value:"fp2014", label:"Fixed Protection 2014" }, { value:"ip2014", label:"Individual Protection 2014" },
      { value:"fp2016", label:"Fixed Protection 2016" }, { value:"ip2016", label:"Individual Protection 2016" },
      { value:"", label:"Not sure" },
    ],
    showIf: ctx => hasPot(ctx) && totalPot(ctx.d) >= 1000000,
  },
  {
    // Individual Protection: 25% of the protected amount, up to £375,000
    // (2014) or £312,500 (2016).
    id:"pensionProtectedAmount", field:"pensionProtectedAmount", kind:"money", label:"Protected amount", cap:"pensionProtectedAmount",
    ask: () => "What's your protected amount?",
    why: () => "Individual Protection allows 25% of it as tax-free cash.",
    note: () => "It's on your protection certificate from HMRC.",
    notSure: () => LEAVE_BLANK,
    showIf: ctx => hasPot(ctx) && (ctx.d.pensionProtection === "ip2014" || ctx.d.pensionProtection === "ip2016"),
  },
  {
    id:"statePension", field:"statePensionAmount", kind:"money", label:"State Pension a year", cap:"statePensionAmount",
    ask: () => "How much State Pension do you get a year?",
    why: () => "It's taxed as income, so it sets the tax on pension withdrawals.",
    prefill: () => STATE_PENSION_FULL,
    note: ({ d }) => filled(d.statePensionAmount) ? null : "That's the full new State Pension. Use your own figure if it's different.",
    // At 66, whether they've reached State Pension age depends on their date
    // of birth: "I don't get it yet" tells us (metrics pastStatePensionAge).
    notSure: () => ({ label:"I don't get it yet", value:"0" }),
    showIf: ctx => +ctx.d.age >= 66,
  },
  {
    // Still earning at or past it: when they'll stop, an age after today
    // (metrics retirementAgeFor assumes 75 until they say).
    id:"retirementAge", field:"retirementAge", kind:"years", label:"Retire at", required:true,
    ask: ({ d }) => workingPastRetirementAge(d) ? "When do you plan to stop working?" : "When would you like to retire?",
    why: ({ d }) => workingPastRetirementAge(d) ? "Your pension grows until then, and you draw on it after." : d.pensionKind === "db" ? "Your scheme's own pension age is on your statement." : "Sets how many years your pension has to grow.",
    min: ({ d }) => workingPastRetirementAge(d) ? (+d.age || 0) + 1 : null,
    minNote: () => "Pick an age after the one you are now.",
    showIf: ctx => (hasPot(ctx) || finalSalary(ctx) || workingPastRetirementAge(ctx.d)) && !hasStartedDrawing(ctx.d),
    // What they'd like to live on, below it: the Retirement Living
    // Standards (Pensions UK, 2025), what a year costs one person, after
    // tax, owning their home outright.
    follow: [
      { field:"retirementTarget", kind:"choice", label:"What would you like to live on in retirement, a year?", columns:2,
        options: () => [
          { value:"13900", label:"Minimum", sub:"£13,900" }, { value:"32700", label:"Moderate", sub:"£32,700" },
          { value:"45400", label:"Comfortable", sub:"£45,400" }, { value:"", label:"Not sure" },
        ],
        note: () => "So Candid can say whether you're on course for it. In today's money, after tax, for one person who owns their home: Pensions UK's standards.",
        showIf: ctx => paying(ctx) || finalSalary(ctx) },
    ],
  },
];

const hasLoan = ({ d }) => d.studentLoan && d.studentLoan !== "none";
// metrics.js SALARY_GROWTH_RATES, in words.
export const PAY_GROWTH_OPTIONS = [
  { value:"stable", label:"In line with prices (about 2% a year)" },
  { value:"moderate", label:"Steady pay rises (about 5% a year)" },
  { value:"high", label:"Fast, with promotions (about 10% a year)" },
];
const estimating = ctx => hasLoan(ctx) && ctx.d.slBalanceEstimate === "yes";

// The plan helper, for "Not sure which plan": up to three questions, then the
// plan (studentLoanPlanFrom, src/lib/studentLoan.js, GOV.UK's rules). Each
// answer sets studentLoan as soon as there's enough to tell, so the questions
// after it (balance, rate) follow on.
const PLAN_LABELS = { plan1:"Plan 1", plan2:"Plan 2", plan4:"Plan 4", plan5:"Plan 5", postgrad:"the Postgraduate Loan plan" };
const unsurePlan = ({ d }) => d.slPlanAnswer === "unsure";
const helperPlan = (d, patch = {}) => studentLoanPlanFrom({ country: d.slCountry, course: d.slCourse, start: d.slStart, ...patch });
const setPlan = key => (value, { d }) => {
  const plan = helperPlan(d, { [key]: value });
  return plan ? { studentLoan: plan } : {};
};
const englandOrWales = ({ d }) => d.slCountry === "england" || d.slCountry === "wales";

// The plan, offered under the balance (a follow-up) and on its own if they
// weren't sure of the balance. Its own field, so "Not sure" never reaches
// studentLoan, which the calculations read as a plan.
const PLAN_OPTIONS = [
  { value:"plan1", label:"Plan 1" }, { value:"plan2", label:"Plan 2" }, { value:"plan4", label:"Plan 4 (Scotland)" },
  { value:"plan5", label:"Plan 5" }, { value:"postgrad", label:"Postgraduate" }, { value:"unsure", label:"Not sure" },
];
// The years their plan allows for finishing the course (studentLoan.js).
const finishRange = ({ d }) => slFinishYearRange(d.slPlanAnswer === "unsure" ? null : d.slPlanAnswer || d.studentLoan);
const inRange = (v, { min, max }) => v !== "" && v != null && Number.isInteger(+v) && +v >= min && +v <= max;
// A plan that rules out the finish year already given clears it.
const planAlso = (value, ctx) => {
  const patch = value === "unsure" ? {} : { studentLoan: value };
  const year = ctx?.d?.slFinishYear;
  if (year && !inRange(year, slFinishYearRange(value === "unsure" ? null : value))) Object.assign(patch, { slFinishYear: "", slFirstDueYear: "" });
  return patch;
};
// Repayments were first due the April after the course finished, which sets
// when the loan is written off (slFirstDueYear). Only a year the plan allows.
const finishAlso = (value, ctx) => ({ slFirstDueYear: inRange(value, ctx ? finishRange(ctx) : slFinishYearRange(null)) ? String(+value + 1) : "" });
// Pay growth, under the salary (and on its own when the salary's already
// known): what decides most whether a loan is cleared. Asked once.
const PAY_GROWTH_FOLLOW = {
  field:"salaryTrajectory", kind:"choice", label:"How will your pay grow over the next ten years?", once:true,
  options: () => [
    { value:"stable", label:"With prices", sub:"+2%/yr" },
    { value:"moderate", label:"Steady rises", sub:"+5%/yr" },
    { value:"high", label:"Fast", sub:"+10%/yr" },
  ],
};

// For someone landing here from a link, only what the answer needs, in an
// order that's easy to follow: work, then pay (with its growth below it),
// then the loan (its plan and when the course finished below the balance),
// its rate, and a Postgraduate loan alongside (its balance below a "Yes").
// Questions below another on the same screen are its `follow`
// (GuidedFlow.jsx).
const STUDENT_LOAN_QUESTIONS = [
  EMPLOYMENT_QUESTION, NOT_WORKING_QUESTION, EARNED_THIS_YEAR_QUESTION,
  { ...SALARY_QUESTION, id:"slSalary", follow: [PAY_GROWTH_FOLLOW] },
  {
    // The salary was known already: pay growth on its own.
    id:"payGrowth", field:"salaryTrajectory", kind:"choice",
    ask: () => "How do you expect your pay to grow over the next ten years?",
    why: () => "Repayments come from pay over the threshold, so this decides the most.",
    options: () => PAY_GROWTH_OPTIONS,
    note: () => "After ten years, Candid assumes your pay rises with prices.",
    showIf: ({ d }) => !(d.askedFields || []).includes("salaryTrajectory") && d.employmentStatus !== "not_working",
    ifMissing: ({ d }) => !(d.askedFields || []).includes("salaryTrajectory"),
  },
  {
    id:"loanBalance", field:"loanBalance", kind:"money", label:"Still owed", cap:"loanBalance", required:true,
    ask: () => "Roughly how much do you still owe?",
    why: () => "Your online student loan account shows it.",
    // Not sure: a few questions about what they borrowed, and Candid
    // estimates it (estimateSlBalance). Typing a figure turns that off.
    also: value => ({ slBalanceEstimate: value === "" ? "yes" : "" }),
    notSure: () => ({ label:"I'm not sure, help me estimate it", value:"" }),
    follow: [
      { field:"slPlanAnswer", kind:"choice", label:"Which plan?", required:true, options: () => PLAN_OPTIONS, also: planAlso },
      { field:"slFinishYear", kind:"years", label:"Year you finished your course", yearRange: finishRange, also: finishAlso,
        note: () => "Sets when it's written off. Leave it blank if you're not sure.", showIf: ({ d }) => !!d.slPlanAnswer },
    ],
  },
  {
    // Not sure of the balance, so the plan wasn't asked under it.
    id:"studentLoanPlan", field:"slPlanAnswer", kind:"choice",
    ask: () => "Which student loan plan are you on?",
    why: () => "Each plan has its own repayment threshold and interest rate.",
    options: () => PLAN_OPTIONS.map(o => o.value === "unsure" ? { ...o, label:"Not sure which plan" } : o),
    also: planAlso,
    showIf: ({ d }) => !d.slPlanAnswer,
  },
  {
    id:"slCountry", field:"slCountry", kind:"choice",
    ask: () => "Where did you live when you applied for student finance?",
    why: () => "Each part of the UK lends on its own plans.",
    options: () => [{ value:"england", label:"England" }, { value:"wales", label:"Wales" }, { value:"scotland", label:"Scotland" }, { value:"ni", label:"Northern Ireland" }],
    also: setPlan("country"),
    showIf: unsurePlan,
  },
  {
    id:"slCourse", field:"slCourse", kind:"choice",
    ask: () => "Was the loan for an undergraduate course, or a Master's or PhD?",
    why: () => "Master's and doctoral loans have their own repayment plan.",
    options: () => [{ value:"undergrad", label:"Undergraduate (or PGCE)" }, { value:"postgrad", label:"Master's or PhD" }],
    also: setPlan("course"),
    showIf: ctx => unsurePlan(ctx) && englandOrWales(ctx),
  },
  {
    id:"slStart", field:"slStart", kind:"choice",
    ask: () => "When did your course start?",
    why: () => "The start date decides your plan.",
    options: ({ d }) => d.slCountry === "wales"
      ? [{ value:"pre2012", label:"Before September 2012" }, { value:"2012on", label:"September 2012 or later" }]
      : [{ value:"pre2012", label:"Before September 2012" }, { value:"2012to2023", label:"September 2012 to July 2023" }, { value:"2023on", label:"August 2023 or later" }],
    also: setPlan("start"),
    showIf: ctx => unsurePlan(ctx) && englandOrWales(ctx) && ctx.d.slCourse === "undergrad",
  },
  {
    // The helper's answer, said plainly before the questions carry on.
    id:"slPlanResult", field:"slPlanResult", kind:"info",
    ask: ({ d }) => `You're on ${PLAN_LABELS[helperPlan(d)]}.`,
    why: () => "Worked out from your answers, using GOV.UK's rules.",
    note: () => "More than one loan? Each can be on its own plan. Candid works with one for now.",
    showIf: ctx => unsurePlan(ctx) && !!helperPlan(ctx.d),
  },
  {
    id:"slStudyYears", field:"slStudyYears", kind:"years", label:"Years", required:true, min:1,
    ask: () => "How many years was your course?",
    why: () => "Each year of study added a year of loans.",
    note: () => "Medicine and dentistry are usually 5 or 6 years, counting any intercalated year.",
    showIf: estimating,
  },
  {
    id:"slTuition", field:"slTuition", kind:"choice",
    ask: () => "Did you take a loan for your tuition fees?",
    why: () => "Fees were the biggest part of most loans.",
    options: ({ d }) => [
      { value:"full", label:"Yes, every year" },
      ...(+d.slStudyYears >= 5 ? [{ value:"nhs5", label:"Yes, until the NHS paid them from year 5" }] : []),
      { value:"none", label:"No, they were paid another way" },
    ],
    note: ({ d }) => d.studentLoan === "plan4" ? "Scottish students studying in Scotland usually have their fees paid by SAAS, not a loan." : null,
    showIf: ctx => estimating(ctx) && ctx.d.studentLoan !== "postgrad",
  },
  {
    id:"slMaintenance", field:"slMaintenance", kind:"choice",
    ask: () => "And a maintenance loan for living costs?",
    why: () => "How much you could borrow depended on your household's income.",
    options: () => [
      { value:"full", label:"Yes, the full amount" },
      { value:"half", label:"Yes, about half" },
      { value:"none", label:"No" },
    ],
    showIf: ctx => estimating(ctx) && ctx.d.studentLoan !== "postgrad",
  },
  {
    // Asked under the balance when it's known; here for the estimate.
    id:"slFinishYear", field:"slFinishYear", kind:"years", label:"Year", required:true, yearRange: finishRange,
    ask: () => "What year did you finish the course?",
    why: () => "Interest has built up since, and repayments started the April after.",
    also: finishAlso,
    showIf: ctx => estimating(ctx) && !filled(ctx.d.slFinishYear),
  },
  {
    id:"slBalanceResult", field:"slBalanceResult", kind:"info",
    ask: ({ m }) => `That puts what you still owe at about ${fmt(m.loanBal)}.`,
    why: ({ d, m }) => {
      const est = estimateSlBalance(d, { salary: m.salary, growth: m.salaryGrowthRate });
      return `From roughly ${fmt(est?.borrowed || 0)} borrowed, plus interest, less what your pay would have repaid.`;
    },
    note: () => "An estimate. Your balance is in your Student Loans Company account, and you can change it on the student loan page.",
    showIf: ctx => estimating(ctx) && slEstimateReady(ctx.d),
  },
  {
    // Shows the usual rate for their plan and salary until they change it,
    // the same rate the calculations use when it's left blank.
    id:"loanRate", field:"studentLoanRate", kind:"percent", label:"Interest rate",
    ask: () => "What interest rate is it charging?",
    why: () => "Sets whether paying it off early would save you money.",
    prefill: ({ d }) => Math.round(resolveSlRate(d, +d.salary || 0) * 1000) / 10,
    note: ({ d }) => filled(d.studentLoanRate) ? null : "That's the usual rate for your plan and salary. Use your own if you know it.",
    showIf: hasLoan,
  },
  {
    // GOV.UK: repaid at the same time as the main plan (studentLoan.js
    // pgScenario). Its balance below a "Yes".
    id:"hasPgLoan", field:"hasPgLoan", kind:"choice",
    ask: () => "Do you also have a Postgraduate loan, for a Master's or PhD?",
    why: () => "It's repaid at the same time: another 6% of pay over £21,000.",
    options: () => [{ value:"no", label:"No" }, { value:"yes", label:"Yes" }],
    showIf: ctx => hasLoan(ctx) && PG_WITH_PLANS.includes(ctx.d.studentLoan),
    follow: [
      { field:"pgLoanBalance", kind:"money", label:"Still owed on it", cap:"loanBalance", required:true, showIf: ({ d }) => d.hasPgLoan === "yes" },
    ],
  },
];

// Kids & family (childcare.js): whether they have children or plan to in
// the next year or two, then childcare support, what crossing £100,000
// costs, and the Child Benefit charge (moved here from Pension). "No" ends
// the walk-through there (endIf): nothing else applies, and the module reads
// "Not applicable". The ages can't add up to more children than they have.
const counts = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i).map(n => ({ value: String(n), label: n === 0 ? "None" : String(n) }));
const totalKids = d => +d.kidsCount > 0 ? Math.round(+d.kidsCount) : 4;
const hasChildren = ({ d }) => kidsSituation(d) === "yes";
const kidsInPlay = ({ d }) => ["yes", "planning"].includes(kidsSituation(d));
const under12 = ctx => kidsSituation(ctx.d) === "planning" || (hasChildren(ctx) && (+ctx.d.kidsPreschool || 0) + (+ctx.d.kidsSchool || 0) > 0);
const KIDS_QUESTIONS = [
  {
    id:"kidsStatus", field:"kidsStatus", kind:"choice",
    ask: () => "Do you have children, or are you planning to in the next year or two?",
    why: () => "Childcare help and Child Benefit depend on it.",
    options: () => [{ value:"yes", label:"Yes, I have children" }, { value:"planning", label:"Planning to, in the next year or two" }, { value:"no", label:"No" }],
    endIf: value => value === "no",
  },
  ...ABOUT_YOU,
  {
    // Anyone who answered "No" to the older "Do you live in Scotland?":
    // which of the other three, since childcare help differs. Hidden once
    // answered, so it's never asked twice in one walk-through.
    id:"kidsNation", field:"ukNation", kind:"choice", group:"you",
    ask: () => "Where in the UK do you live?",
    why: () => "Childcare help is different in each nation.",
    options: () => NATION_OPTIONS,
    also: nationAlso,
    showIf: ctx => kidsInPlay(ctx) && !ctx.d.ukNation && ctx.d.scottishTaxpayer !== "yes",
  },
  {
    id:"kidsCount", field:"kidsCount", kind:"choice",
    ask: () => "How many children do you have?",
    why: () => "Each child under 12 can get help with childcare costs.",
    options: () => [...counts(1, 3), { value:"4", label:"4 or more" }],
    showIf: hasChildren,
  },
  {
    id:"kidsPreschool", field:"kidsPreschool", kind:"choice",
    ask: ({ d }) => +d.kidsCount === 1 ? "Has your child started school yet?" : "How many of them haven't started school yet?",
    why: () => "Under-fives get the most help with childcare costs.",
    options: ({ d }) => +d.kidsCount === 1 ? [{ value:"1", label:"Not yet" }, { value:"0", label:"Yes" }] : counts(0, totalKids(d)),
    showIf: hasChildren,
  },
  {
    id:"kidsSchool", field:"kidsSchool", kind:"choice",
    ask: ({ d }) => +d.kidsCount === 1 ? "Are they 11 or under?" : "And how many are at school, aged 11 or under?",
    why: () => "Tax-Free Childcare also covers clubs and holiday care up to 11.",
    options: ({ d }) => +d.kidsCount === 1 ? [{ value:"1", label:"Yes" }, { value:"0", label:"No, 12 or over" }] : counts(0, totalKids(d) - (+d.kidsPreschool || 0)),
    showIf: ctx => hasChildren(ctx) && totalKids(ctx.d) - (+ctx.d.kidsPreschool || 0) > 0,
  },
  {
    id:"childcareBill", field:"childcareMonthly", kind:"money", label:"Childcare a month", cap:"childcareMonthly",
    ask: () => "Roughly what do you pay for childcare a month?",
    why: () => "Tax-Free Childcare adds 20% of it, up to £2,000 a child.",
    note: () => "Nursery, childminder, clubs and holiday care, before any help.",
    notSure: () => ({ label:"Not sure", value:"" }),
    showIf: ctx => hasChildren(ctx) && under12(ctx),
  },
  {
    id:"partnerOver100k", field:"partnerOver100k", kind:"choice",
    ask: () => "Is your partner's income over £100,000?",
    why: () => "Either parent earning over £100,000 ends this help for both.",
    options: () => [{ value:"no", label:"No" }, { value:"yes", label:"Yes" }, { value:"single", label:"I don't have a partner" }],
    // No partner: they're the higher earner, for the Child Benefit charge.
    also: value => value === "single" ? { cbHigherEarner: "yes" } : {},
    showIf: under12,
  },
  {
    // Over £100,000: what a pension payment of theirs would need to be to
    // bring it back (childcare.js partnerPayIn).
    id:"partnerIncome", field:"partnerIncome", kind:"money", label:"Partner's income", cap:"salary",
    ask: () => "Roughly what's your partner's income a year?",
    why: () => "So Candid can work out what would bring it back under £100,000.",
    notSure: () => ({ label:"Not sure", value:"" }),
    showIf: ctx => under12(ctx) && ctx.d.partnerOver100k === "yes",
  },
  {
    // Eligible and paying for childcare: whether they're getting it.
    id:"tfcClaiming", field:"tfcClaiming", kind:"choice",
    ask: () => "Do you use Tax-Free Childcare now?",
    why: () => "It adds £2 for every £8 you pay your provider.",
    options: () => [{ value:"yes", label:"Yes" }, { value:"no", label:"No" }, { value:"", label:"Not sure" }],
    showIf: ctx => hasChildren(ctx) && under12(ctx) && +ctx.d.childcareMonthly > 0 && ctx.d.partnerOver100k !== "yes"
      && (ctx.m?.adjustedNetIncome || 0) <= CHILDCARE_INCOME_LIMIT && !ctx.m?.noEarnings,
  },
  {
    // Only where the charge can apply: income over £60,000.
    id:"childBenefit", field:"childBenefitChildren", kind:"choice",
    ask: () => "How many children do you get Child Benefit for?",
    why: () => "Above £60,000, Child Benefit is clawed back through tax.",
    options: ({ d }) => counts(0, totalKids(d)),
    showIf: ctx => hasChildren(ctx) && (ctx.m?.adjustedNetIncome || 0) > 60000,
    ifMissing: ({ d }) => d.childBenefitChildren == null || d.childBenefitChildren === "",
  },
  {
    id:"cbHigherEarner", field:"cbHigherEarner", kind:"choice",
    ask: () => "Do you earn more than your partner?",
    why: () => "The charge falls on whichever of you earns more.",
    options: () => [{ value:"yes", label:"Yes, or I don't have a partner" }, { value:"no", label:"No, my partner earns more" }],
    // No partner: they're the one who'd pay it.
    showIf: ({ d, m }) => kidsSituation(d) === "yes" && (m?.adjustedNetIncome || 0) > 60000 && +d.childBenefitChildren > 0 && d.partnerOver100k !== "single",
  },
];

// £100k tax trap (taxTrap.js): pay and other income first (the shared
// questions about them), then how they pay into a pension, which sets what
// each way back to £100,000 costs, then children, for the childcare that
// stops over it. Each is the same question as in Pension or Kids & family,
// and asked only if that module hasn't asked it already.
// Their own ids, as copies (ids are unique across walk-throughs).
const askedOnce = q => ({ ...q, id: `${q.id}Trap`, ifMissing: ({ d }) => d[q.field] == null || d[q.field] === "" });
const TAX_TRAP_QUESTIONS = [
  ...ABOUT_YOU,
  PENSION_QUESTIONS.find(q => q.id === "pensionStatus"),
  ...KIDS_QUESTIONS.filter(q => ["kidsStatus", "kidsCount", "kidsPreschool", "kidsSchool", "childcareBill"].includes(q.id)).map(askedOnce),
];

// A walk-through's questions with each follow-up (a question asked below
// another on the same screen) as one of its own: for Edit inputs, which
// shows every answer as one form, and for anything listing a module's
// fields.
export function flatQuestions(questions) {
  // A follow-up's `label` is its question (a string, or worked out from the
  // answers); `inputLabel`, if any, goes in its field.
  return questions.flatMap(q => [q, ...(q.follow || []).map(f => ({
    id: `${q.id}.${f.field}`, why: () => "", group: q.group, ...f,
    ask: ctx => typeof f.label === "function" ? f.label(ctx) : f.label,
    label: f.inputLabel ?? (typeof f.label === "function" ? "" : f.label),
    showIf: ctx => (!q.showIf || q.showIf(ctx)) && (!f.showIf || f.showIf(ctx)),
  }))]);
}

// `emptyText`: the blurred card's line while the questions are asked.
export const MODULE_GUIDES = {
  cash:        { questions: CASH_QUESTIONS,         emptyText: "Answer a few questions below to see how your savings stack up." },
  investments: { questions: INVESTMENTS_QUESTIONS,  emptyText: "Answer a few questions below to see how your investments are set up." },
  pension:     { questions: PENSION_QUESTIONS,      emptyText: "Answer a few questions below to see where your pension stands." },
  studentLoan: { questions: STUDENT_LOAN_QUESTIONS, emptyText: "Answer a few questions below to see whether overpaying is worth it." },
  kids:        { questions: KIDS_QUESTIONS,         emptyText: "Answer a few questions below to see the childcare help you could get." },
  taxTrap:     { questions: TAX_TRAP_QUESTIONS,     emptyText: "Answer a few questions below to see what crossing £100k costs you." },
};

// The short route from Student loan (?from=studentLoan): only the questions
// its answer uses, each asked once, so the module's own walk-through skips
// them later. Cash & savings: spending (for the buffer), savings with their
// rate, Premium Bonds (money that could go on the loan too) and this year's
// ISA payments (allowance that's use it or lose it, unlike the loan).
// Pension: whether they pay in, and their employer's match.
const LOAN_BRIEF = {
  cash: ["spending", "cashAccounts", "hasPremiumBonds", "premiumBonds", "hasCashIsa", "cashIsaThisYear", "otherIsa", "otherIsaThisYear"],
  pension: ["pensionStatus", "employerType"],
};
const BRIEF_ABOUT = ["employment", "notWorking", "earnedThisYear", "salary"];
export function briefQuestions(key, from) {
  const ids = from === "studentLoan" && LOAN_BRIEF[key];
  if (!ids) return null;
  return MODULE_GUIDES[key].questions.filter(q => BRIEF_ABOUT.includes(q.id) || ids.includes(q.id));
}

// A module's walk-through starts by itself until its questions have been
// answered (or skipped), which is when it joins selectedModules.
export function moduleGuideStarts(key, d) {
  return !!MODULE_GUIDES[key] && !(d.selectedModules || []).includes(key);
}
