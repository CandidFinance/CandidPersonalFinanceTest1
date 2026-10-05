// The Property module's guided first pass: one plain-English question per
// screen, each with a one-line "why it matters", the first time someone opens
// a step. Afterwards the step shows its usual inputs. Pure definitions with
// no React (the screens are in src/mobile/property/GuidedFlow.jsx), unit
// tested in propertyGuide.test.js. Spec: property-guided-onboarding.md.
//
// Every question writes to the same saved input the step's own inputs use,
// so the two views can never disagree. Figures quoted in the copy are read
// from the modules that use them, never typed in.
//
// A question:
//   id, field          the saved input it writes (`d[field]`)
//   kind               "choice" (tap an answer, moves on), "money", "percent"
//                      or "years"
//   ask(ctx), why(ctx) the question and its "why it matters" line
//   options(ctx)       choice answers, [{ value, label }]
//   label              the pill's caption (money and percent)
//   prefill(ctx)       the figure shown while the field is blank
//   cap                FIELD_CAPS key the answer is clamped to
//   notSure(ctx)       { label, value } for the "not sure" button, or a list
//                      of them: `value` is written, or the field left as it
//                      is when undefined
//   required           Continue stays off until there's an answer
//   note(ctx)          an extra caption under the input
//   group              questions sharing a group share a lead line (GROUP_LEADS)
//   showIf(ctx)        asked given the answers so far; checked live
//   ifMissing(ctx)     asked only when Candid lacks the figure at the start;
//                      checked once, so answering it doesn't skip it
// `ctx` is { d, m, regionalRows }.

import { fmt } from "./format.js";
import { PROPERTY_REGIONS, regionNation } from "./regions.js";
import { sdltApplies, FIRST_TIME_BUYER_NIL_BAND, ADDITIONAL_PROPERTY_SURCHARGE } from "./stampDuty.js";
import { EMERGENCY_KEEP_BACK_MONTHS, suggestedCashAvailable, cashIsaBalance, borrowingInputs, calcBorrowingCheck } from "./borrowing.js";
import { affordableMaxPrice } from "./monthlyBudget.js";
import { mortgageInputs, monthlyPayment, FIXED_PERIOD_OPTIONS, DEFAULT_MORTGAGE_TERM_YEARS, DEFAULT_MORTGAGE_RATE_PCT } from "./mortgage.js";
import { DEFAULT_HORIZON_YEARS } from "./rentVsBuy.js";
import { runWaterfall, waterfallInputs } from "./waterfall.js";
import { regionalAveragePrice } from "./regionalRates.js";
import { firstTimeBuyerNeeded, readinessMissing } from "./propertyReadiness.js";
import { ISA_ALLOWANCE } from "./tax.js";
import { SALARY_QUESTION, SPENDING_QUESTION } from "./sharedQuestions.js";

const together = ({ d }) => d.propertyBuyingMode === "together";
const sdlt = ({ d }) => sdltApplies(regionNation(d.propertyRegion));
// "Have you ever owned a home?" Yes means not a first-time buyer.
const OWNED_BEFORE = [{ value:"no", label:"Yes" }, { value:"yes", label:"No" }];
// "Will you still own another home?" Yes means this isn't the sole property.
const KEEPING_ANOTHER = [{ value:"no", label:"Yes" }, { value:"yes", label:"No" }];
const LEAVE_BLANK = { label:"I'm not sure" };

// Whether your own employer match is still missing for the deposit checks.
function matchMissing({ d, m }) {
  const match = runWaterfall(waterfallInputs(d, m)).find(c => c.key === "match");
  return match.people[0].state === "missing";
}
function expensesMissing({ d, m }) {
  const emergency = runWaterfall(waterfallInputs(d, m)).find(c => c.key === "emergency");
  return emergency.state === "missing" && emergency.missing === "expenses";
}

export const GROUP_LEADS = {
  checks: "Before you put money into a deposit",
  // The figures several modules share (src/lib/sharedQuestions.js).
  you: "First, a bit about you",
};

export const READINESS_QUESTIONS = [
  // Only for someone who hasn't given a salary in another module yet: the
  // borrowing check measures the loan against income. Its own reason here,
  // since what it changes in Property is the borrowing.
  { ...SALARY_QUESTION, id:"borrowingSalary", why: () => "Lenders work out what you could borrow from your income." },
  {
    id:"buyingMode", field:"propertyBuyingMode", kind:"choice",
    ask: () => "Are you buying on your own or with someone?",
    why: () => "Lenders add incomes together, so buying together usually means borrowing more.",
    options: () => [{ value:"alone", label:"On my own" }, { value:"together", label:"With someone" }],
  },
  {
    id:"partnerSalary", field:"partnerSalary", kind:"money", label:"Their salary", cap:"salary",
    ask: () => "What does your partner earn a year, before tax?",
    why: () => "Added to your income to work out what you could borrow.",
    notSure: () => LEAVE_BLANK, required:true,
    showIf: together,
  },
  {
    id:"partnerOtherIncome", field:"partnerOtherIncome", kind:"money", label:"Their other income", cap:"otherIncome",
    ask: () => "Does your partner have any other regular income?",
    why: () => "Regular extra income, like rent from a property, counts towards what you could borrow.",
    notSure: () => ({ label:"No other income", value:"" }), required:true,
    showIf: together,
  },
  {
    id:"region", field:"propertyRegion", kind:"choice",
    ask: () => "Where are you buying?",
    why: () => "Stamp duty and local prices depend on where you buy.",
    options: () => PROPERTY_REGIONS.map(r => ({ value:r.value, label:r.label })),
  },
  {
    id:"firstTimeBuyer", field:"propertyFirstTimeBuyer", kind:"choice",
    ask: () => "Have you ever owned a home, in the UK or abroad?",
    why: () => `If not, you could pay no stamp duty on the first ${fmt(FIRST_TIME_BUYER_NIL_BAND)}.`,
    options: () => OWNED_BEFORE,
    showIf: ({ d }) => firstTimeBuyerNeeded(d),
  },
  {
    id:"partnerFirstTimeBuyer", field:"partnerFirstTimeBuyer", kind:"choice",
    ask: () => "Has your partner ever owned a home?",
    why: () => "First-time buyer relief only applies if neither of you has.",
    options: () => OWNED_BEFORE,
    showIf: ctx => together(ctx) && firstTimeBuyerNeeded(ctx.d),
  },
  {
    id:"soleProperty", field:"propertySoleProperty", kind:"choice",
    ask: ctx => together(ctx) ? "Will either of you still own another home after buying this one?" : "Will you still own another home after buying this one?",
    why: () => `Keeping another home adds ${Math.round(ADDITIONAL_PROPERTY_SURCHARGE * 100)}% stamp duty on the whole price.`,
    options: () => KEEPING_ANOTHER,
    // Only someone who has owned a home before can be keeping one.
    showIf: ctx => sdlt(ctx) && !(ctx.d.propertyFirstTimeBuyer === "yes" && (!together(ctx) || ctx.d.partnerFirstTimeBuyer === "yes")),
  },
  {
    // Before cash available: the emergency fund kept back from it is
    // three months of this.
    id:"expenses", field:"monthlyExpenses", kind:"money", label:"Monthly spending", cap:"monthlyExpenses", required:true,
    ask: () => "What do you spend in a typical month?",
    why: () => `We keep ${EMERGENCY_KEEP_BACK_MONTHS} months of this aside before counting your cash towards a home.`,
    ifMissing: expensesMissing,
  },
  {
    // Shows the suggested figure until it's changed, as the step's own input
    // does, and leaves the field blank so it keeps following their savings.
    id:"cashAvailable", field:"propertyCashAvailable", kind:"money", label:"Cash available",
    ask: () => "How much cash could you put towards buying?",
    why: ctx => sdlt(ctx) ? "It pays the deposit, stamp duty and fees. The mortgage covers the rest." : "It pays the deposit and fees. The mortgage covers the rest.",
    prefill: ({ d, m }) => borrowingInputs(d, m).cashAvailable || null,
    note: ({ d, m }) => {
      const blank = d.propertyCashAvailable === "" || d.propertyCashAvailable == null;
      return blank && suggestedCashAvailable(m.totalLiquid + cashIsaBalance(d), m.expenses) > 0
        ? `Your savings, less ${EMERGENCY_KEEP_BACK_MONTHS} months' spending kept back for emergencies.`
        : null;
    },
  },
  {
    // Last of the purchase questions: the most they could afford needs their
    // income and cash first.
    id:"price", field:"propertyPrice", kind:"money", label:"Price", required:true,
    ask: () => "Roughly what price are you looking at?",
    why: ctx => sdlt(ctx) ? "Sets your stamp duty and how much you'd need to borrow." : "Sets how much you'd need to borrow.",
    notSure: ({ d, m, regionalRows }) => {
      const most = affordableMaxPrice(d, m);
      const average = regionalAveragePrice(d.propertyRegion, regionalRows);
      const region = PROPERTY_REGIONS.find(r => r.value === d.propertyRegion);
      return [
        most?.price > 0 && { label:`Use the most I could afford, ${fmt(most.price)}`, value:String(most.price) },
        average && region && { label:`Use the ${region.label} average, ${fmt(average)}`, value:String(average) },
      ].filter(Boolean);
    },
  },
  {
    id:"myContribution", field:"myContribution", kind:"percent", label:"Your contribution", cap:"myContribution", group:"checks",
    ask: () => "What percentage of your salary do you pay into your workplace pension?",
    why: () => "Your employer may add more if you pay in more.",
    notSure: () => LEAVE_BLANK, required:true,
    ifMissing: matchMissing,
  },
  {
    id:"employerMatch", field:"employerMatch", kind:"percent", label:"Employer match", cap:"employerMatch", group:"checks",
    ask: () => "Up to what percentage will your employer match it?",
    why: () => "An unclaimed match is free money, worth taking before saving a deposit.",
    note: () => "It's in your contract, or ask HR.",
    notSure: () => LEAVE_BLANK, required:true,
    ifMissing: matchMissing,
  },
  {
    id:"partnerMyContribution", field:"partnerMyContribution", kind:"percent", label:"Their contribution", cap:"myContribution", group:"checks",
    ask: () => "What percentage of their salary does your partner pay into their workplace pension?",
    why: () => "Their employer may add more if they pay in more.",
    notSure: () => LEAVE_BLANK, required:true,
    showIf: together,
  },
  {
    id:"partnerEmployerMatch", field:"partnerEmployerMatch", kind:"percent", label:"Their employer match", cap:"employerMatch", group:"checks",
    ask: () => "Up to what percentage will their employer match it?",
    why: () => "An unclaimed match is free money, worth taking before saving a deposit.",
    notSure: () => LEAVE_BLANK, required:true,
    showIf: together,
  },
  {
    id:"partnerIsa", field:"partnerIsaThisYear", kind:"money", label:"Paid into ISAs", cap:"isaThisYearOther", group:"checks",
    ask: () => "How much has your partner paid into ISAs since 6 April?",
    why: () => `Their ${fmt(ISA_ALLOWANCE)} allowance is lost if it's not used by 5 April.`,
    notSure: () => LEAVE_BLANK, required:true,
    showIf: together,
  },
];

// Rent, asked in step 2 (for the monthly budget) or step 3, whichever comes
// first; only while Candid doesn't have it. £0 is an answer.
const RENT_QUESTION = ({ id, why }) => ({
  id, field:"propertyMonthlyRent", kind:"money", label:"Monthly rent", required:true,
  ask: () => "What do you pay in rent each month?",
  why,
  notSure: () => ({ label:"I don't pay rent", value:"0" }),
  ifMissing: ({ d }) => blank(d.propertyMonthlyRent),
});

// Step 2. The card above shows the repayment from the start (step 1 is done
// by then), so each answer moves a figure that's already there.
const loanFor = ({ d, m }) => calcBorrowingCheck(borrowingInputs(d, m)).loanNeeded;

export const MORTGAGE_QUESTIONS = [
  {
    id:"term", field:"propertyMortgageTerm", kind:"years", label:"Years",
    ask: () => "How many years do you want the mortgage over?",
    why: () => "Longer lowers the monthly payment but costs more interest overall.",
    prefill: () => DEFAULT_MORTGAGE_TERM_YEARS,
  },
  {
    id:"rate", field:"propertyMortgageRate", kind:"percent", label:"Mortgage rate",
    ask: () => "What interest rate do you expect?",
    // What one point on the rate costs on their own loan and term.
    why: ctx => {
      const loan = loanFor(ctx);
      const { termYears, ratePct } = mortgageInputs(ctx.d, loan);
      const extra = monthlyPayment(loan, ratePct + 1, termYears * 12) - monthlyPayment(loan, ratePct, termYears * 12);
      return extra > 0 ? `Each 1% adds about ${fmt(Math.round(extra / 10) * 10)} a month on this loan.` : "Sets your monthly payment.";
    },
    prefill: () => DEFAULT_MORTGAGE_RATE_PCT,
    note: ({ d }) => d.propertyMortgageRate === "" || d.propertyMortgageRate == null
      ? `${DEFAULT_MORTGAGE_RATE_PCT}% is Candid's starting figure. Use a quote if you have one.`
      : null,
  },
  {
    id:"fixedYears", field:"propertyFixedYears", kind:"choice",
    ask: () => "How long would you fix the rate for?",
    why: () => "Your payment stays the same until the fix ends, then you'd remortgage.",
    options: () => FIXED_PERIOD_OPTIONS.map(y => ({ value:String(y), label:`${y} years` })),
  },
  // What they'd have left each month once they own it (monthlyBudget.js):
  // their spending, which includes rent, and the rent buying replaces. Rent
  // vs buy then doesn't ask the rent again.
  { ...SPENDING_QUESTION, id:"budgetSpending", group:undefined,
    why: () => "Shows what you'd have left each month after the mortgage." },
  RENT_QUESTION({ id:"budgetRent", why: () => "Buying replaces it, so it comes off your spending." }),
];

// Step 3.
const leasehold = ({ d }) => d.propertyTenure === "leasehold";

export const RENT_VS_BUY_QUESTIONS = [
  RENT_QUESTION({ id:"rent", why: () => "Buying is compared against what you'd keep paying in rent." }),
  {
    id:"horizon", field:"propertyHorizonYears", kind:"years", label:"Years",
    ask: () => "How many years would you stay before selling?",
    why: () => "Buying costs come up front, so the longer you stay, the better buying looks.",
    prefill: () => DEFAULT_HORIZON_YEARS,
  },
  {
    id:"tenure", field:"propertyTenure", kind:"choice",
    ask: () => "Will you own the land (freehold) or lease it (leasehold)?",
    why: () => "Leasehold adds ground rent and a service charge every year.",
    options: () => [{ value:"freehold", label:"Freehold" }, { value:"leasehold", label:"Leasehold" }],
    note: () => "Most houses are freehold, and most flats leasehold.",
  },
  {
    id:"groundRent", field:"propertyGroundRent", kind:"money", label:"Ground rent a year", required:true,
    ask: () => "What's the yearly ground rent?",
    why: () => "A yearly cost of owning that a renter doesn't pay.",
    notSure: () => LEAVE_BLANK,
    showIf: leasehold,
  },
  {
    id:"serviceCharge", field:"propertyServiceCharge", kind:"money", label:"Service charge a year", required:true,
    ask: () => "And the yearly service charge?",
    why: () => "Covers the building's upkeep, and usually rises faster than inflation.",
    notSure: () => LEAVE_BLANK,
    showIf: leasehold,
  },
  {
    id:"renterMoney", field:"propertyRenterMoney", kind:"choice",
    ask: () => "If you rented instead, would your spare money sit in savings or be invested?",
    why: () => "Investments usually grow faster than savings, which favours renting.",
    options: () => [{ value:"cash", label:"Savings" }, { value:"invested", label:"Invested" }],
  },
];

// Each step's questions, the saved input recording that its walk-through was
// finished or skipped, and when it starts by itself: on arriving at a step
// that's still blank (Readiness: still incomplete), unless already done.
//
// `holdResultUntil`: on a first walk-through, the result card stays blurred
// until this question is answered ("end": until the walk-through is over),
// so the first figure seen is built on the user's own answers, not Candid's
// defaults. Mortgage shows once term and rate are in; the fix only moves the
// remortgage line after that. Rent vs buy's headline is a verdict that later
// answers can flip, so it waits for all of them. Readiness needs no hold:
// its card stays blurred until there's a price anyway. A walk-through rerun
// from "Walk me through it" never hides a result the user has already seen.
const blank = v => v === "" || v == null;
export const STEP_GUIDES = {
  readiness: {
    questions: READINESS_QUESTIONS, doneField: "propertyGuideReadinessDone",
    blank: (d, m) => readinessMissing(d, m).length > 0,
    holdResultUntil: null,
  },
  mortgage: {
    questions: MORTGAGE_QUESTIONS, doneField: "propertyGuideMortgageDone",
    blank: d => ["propertyMortgageTerm", "propertyMortgageRate", "propertyFixedYears"].every(f => blank(d[f])),
    holdResultUntil: "rate",
  },
  rentVsBuy: {
    questions: RENT_VS_BUY_QUESTIONS, doneField: "propertyGuideRentVsBuyDone",
    // Rent may already be in from step 2, so the step counts as blank until
    // its own figures are set.
    blank: d => blank(d.propertyMonthlyRent) || (blank(d.propertyHorizonYears) && blank(d.propertyTenure)),
    holdResultUntil: "end",
  },
};
export function guideStarts(step, d, m) {
  const g = STEP_GUIDES[step];
  return !!g && !d[g.doneField] && g.blank(d, m);
}

// A question's "why it matters" line by its id, for the "?" beside the same
// field in a step's full view, so the reason stays after the walk-through.
const ALL_QUESTIONS = [...READINESS_QUESTIONS, ...MORTGAGE_QUESTIONS, ...RENT_VS_BUY_QUESTIONS];
export function whyLine(id, ctx) {
  const q = ALL_QUESTIONS.find(x => x.id === id);
  return q ? q.why(ctx) : null;
}

// Whether "N of M" can be shown at question `id`: only once M is settled,
// i.e. no choice from here on would change how many questions are asked
// (a yes/no that opens or skips a group, say). Until then the total would
// jump as the user answers, so it isn't shown.
export function countSettled(questions, ctx, needed, id) {
  const visible = visibleQuestions(questions, ctx, needed);
  const total = patch => visibleQuestions(questions, { ...ctx, d: { ...ctx.d, ...patch } }, needed).length;
  return visible.slice(visible.findIndex(q => q.id === id)).every(q => {
    if (q.kind !== "choice") return true;
    const totals = q.options(ctx).map(o => total({ [q.field]: o.value, ...(q.also ? q.also(o.value, ctx) : {}) }));
    return new Set(totals).size <= 1;
  });
}

// The ids of questions to ask this time through, decided once at the start:
// a question with `ifMissing` is dropped when Candid already has its figure.
export function neededAtStart(questions, ctx) {
  return new Set(questions.filter(q => !q.ifMissing || q.ifMissing(ctx)).map(q => q.id));
}

// The questions to show given the answers so far, the first of each group
// carrying its lead line.
export function visibleQuestions(questions, ctx, needed) {
  const seen = new Set();
  return questions
    .filter(q => needed.has(q.id) && (!q.showIf || q.showIf(ctx)))
    .map(q => {
      if (!q.group || seen.has(q.group)) return q;
      seen.add(q.group);
      return { ...q, lead: GROUP_LEADS[q.group] };
    });
}
