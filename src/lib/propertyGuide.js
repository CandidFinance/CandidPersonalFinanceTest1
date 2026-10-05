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
//   kind               "choice" (tap an answer, moves on), "money" or "percent"
//   ask(ctx), why(ctx) the question and its "why it matters" line
//   options(ctx)       choice answers, [{ value, label }]
//   label              the pill's caption (money and percent)
//   prefill(ctx)       the figure shown while the field is blank
//   cap                FIELD_CAPS key the answer is clamped to
//   notSure(ctx)       { label, value } for the "not sure" button: `value`
//                      is written, or the field left as it is when undefined
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
import { EMERGENCY_KEEP_BACK_MONTHS, suggestedCashAvailable, cashIsaBalance, borrowingInputs } from "./borrowing.js";
import { runWaterfall, waterfallInputs } from "./waterfall.js";
import { regionalAveragePrice } from "./regionalRates.js";
import { firstTimeBuyerNeeded } from "./propertyReadiness.js";
import { ISA_ALLOWANCE } from "./tax.js";

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
};

export const READINESS_QUESTIONS = [
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
    id:"price", field:"propertyPrice", kind:"money", label:"Price", required:true,
    ask: () => "Roughly what price are you looking at?",
    why: ctx => sdlt(ctx) ? "Sets your stamp duty and how much you'd need to borrow." : "Sets how much you'd need to borrow.",
    notSure: ({ d, regionalRows }) => {
      const average = regionalAveragePrice(d.propertyRegion, regionalRows);
      const region = PROPERTY_REGIONS.find(r => r.value === d.propertyRegion);
      return average && region ? { label:`Use the ${region.label} average, ${fmt(average)}`, value:String(average) } : null;
    },
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
