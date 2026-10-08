// Each module's guided walk-through: the questions asked the first time a
// module is opened, after which the module's own screen shows its answer.
// Same question fields and walk-through as Property (src/lib/propertyGuide.js,
// GuidedFlow); unit tested in moduleGuide.test.js. Spec:
// onboarding-guided-questions.md.
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
import { resolveSlRate, studentLoanPlanFrom } from "./studentLoan.js";
import { ABOUT_YOU, AGE_QUESTION, SPENDING_QUESTION } from "./sharedQuestions.js";

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
    notSure: () => ({ label:"I don't have any savings", value:[{ amount:"", rate:"" }] }),
  },
  {
    id:"hasPremiumBonds", field:"hasPremiumBonds", kind:"choice",
    ask: () => "Do you have Premium Bonds?",
    why: () => "Their prize rate can beat or trail a savings account.",
    options: () => YES_NO,
  },
  {
    id:"premiumBonds", field:"premiumBonds", kind:"money", label:"Premium Bonds", cap:"premiumBonds", required:true,
    ask: () => "How much is in Premium Bonds?",
    why: () => "Counted alongside your savings, and compared with savings rates.",
    showIf: is("hasPremiumBonds", "yes"),
  },
  {
    id:"hasCashIsa", field:"hasCashIsaThisYear", kind:"choice",
    ask: () => "Have you paid into a Cash ISA since 6 April?",
    why: () => `Your ${fmt(ISA_ALLOWANCE)} allowance is lost if it's not used by 5 April.`,
    options: () => YES_NO,
  },
  {
    id:"cashIsaThisYear", field:"isaThisYearCash", kind:"money", label:"Paid in since 6 April", cap:"isaThisYearCash", required:true,
    ask: () => "How much have you paid in since 6 April?",
    why: () => "Counts towards this year's allowance, shared across all your ISAs.",
    showIf: is("hasCashIsaThisYear", "yes"),
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
  },
  {
    id:"otherIsaThisYear", field:"isaThisYearOtherTypes", kind:"money", label:"Paid in since 6 April", cap:"isaThisYearOther", required:true,
    ask: () => "How much, across those ISAs?",
    why: () => "So Candid knows how much allowance is left for cash.",
    showIf: ({ d }) => itemisedNonCashIsa(d) === 0 && d.hasOtherIsaThisYear === "yes",
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
    options: () => [{ value:"yes", label:"Yes" }, { value:"no", label:"No" }, { value:"unsure", label:"Not sure" }],
    also: value => value === "unsure" ? { pensionUnknown: true } : { pensionUnknown: false, hasPension: value },
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
    // Skipped if Property's checks already asked it (same field).
    id:"pensionContribution", field:"myContribution", kind:"percent", label:"Your contribution", cap:"myContribution", required:true,
    ask: () => "What percentage of your salary do you pay in?",
    why: () => "Your employer may add more if you pay in more.",
    notSure: () => LEAVE_BLANK, showIf: paying,
    ifMissing: ({ d }) => !filled(d.myContribution),
  },
  {
    id:"pensionMatch", field:"employerMatch", kind:"percent", label:"Employer match", cap:"employerMatch", required:true,
    ask: () => "Up to what percentage will your employer match it?",
    why: () => "An unclaimed match is free money.",
    note: () => "It's in your contract, or ask HR.",
    notSure: () => LEAVE_BLANK,
    showIf: ctx => paying(ctx) && ctx.d.employmentStatus !== "self_employed",
    ifMissing: ({ d }) => !filled(d.employerMatch),
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
    id:"hasOldPensions", field:"hasOldPensions", kind:"choice",
    ask: () => "Any pensions from old jobs?",
    why: () => "Old pots still count, and are easy to lose track of.",
    options: () => YES_NO, showIf: paying,
  },
  {
    id:"oldPensions", field:"potValue2", kind:"money", label:"Old pensions", cap:"potValue2", required:true,
    ask: () => "Roughly how much is in them altogether?",
    why: () => "Added to your main pot for your retirement picture.",
    notSure: () => LEAVE_BLANK, showIf: ctx => paying(ctx) && ctx.d.hasOldPensions === "yes",
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
    id:"retirementAge", field:"retirementAge", kind:"years", label:"Retire at", required:true,
    ask: () => "When would you like to retire?",
    why: () => "Sets how many years your pension has to grow.",
    showIf: ctx => hasPot(ctx) && !hasStartedDrawing(ctx.d),
  },
  {
    id:"pensionType", field:"pensionType", kind:"choice",
    ask: () => "How do you pay in?",
    why: () => "Changes how you get tax relief, and whether you must claim some yourself.",
    options: () => [
      { value:"sacrifice", label:"From my pay before tax (salary sacrifice)" },
      { value:"relief", label:"From my take-home pay (relief at source)" },
      { value:"", label:"Not sure" },
    ],
    note: () => "Your payslip shows it: before tax is taken off means salary sacrifice.",
    showIf: paying,
  },
];

const hasLoan = ({ d }) => d.studentLoan && d.studentLoan !== "none";

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

const STUDENT_LOAN_QUESTIONS = [
  ...ABOUT_YOU,
  {
    // Its own field, so "Not sure" never reaches studentLoan, which the
    // calculations read as a plan.
    id:"studentLoanPlan", field:"slPlanAnswer", kind:"choice",
    ask: () => "Which student loan plan are you on?",
    why: () => "Each plan has its own repayment threshold and interest rate.",
    options: () => [
      { value:"plan1", label:"Plan 1" }, { value:"plan2", label:"Plan 2" }, { value:"plan4", label:"Plan 4 (Scotland)" },
      { value:"plan5", label:"Plan 5" }, { value:"postgrad", label:"Postgraduate loan" },
      { value:"unsure", label:"Not sure which plan" }, { value:"none", label:"I don't have one" },
    ],
    also: value => value === "unsure" ? {} : { studentLoan: value },
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
    id:"loanBalance", field:"loanBalance", kind:"money", label:"Still owed", cap:"loanBalance", required:true,
    ask: () => "Roughly how much do you still owe?",
    why: () => "Shows whether you'll clear it before it's written off.",
    notSure: () => LEAVE_BLANK, showIf: hasLoan,
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
];

// `emptyText`: the blurred card's line while the questions are asked.
export const MODULE_GUIDES = {
  cash:        { questions: CASH_QUESTIONS,         emptyText: "Answer a few questions below to see how your savings stack up." },
  investments: { questions: INVESTMENTS_QUESTIONS,  emptyText: "Answer a few questions below to see how your investments are set up." },
  pension:     { questions: PENSION_QUESTIONS,      emptyText: "Answer a few questions below to see where your pension stands." },
  studentLoan: { questions: STUDENT_LOAN_QUESTIONS, emptyText: "Answer a few questions below to see whether overpaying is worth it." },
};

// A module's walk-through starts by itself until its questions have been
// answered (or skipped), which is when it joins selectedModules.
export function moduleGuideStarts(key, d) {
  return !!MODULE_GUIDES[key] && !(d.selectedModules || []).includes(key);
}
