// The app's two-question entry, and what the home screen offers a user who
// hasn't had a report yet. Pure logic, unit tested in appEntry.test.js.
// Spec: onboarding-guided-questions.md.
//
// The entry's picks are saved as `interests`, never `selectedModules`: the
// calculations read `selectedModules` as "this module's figures are in"
// (e.g. the Property checks treat cash as known once Cash & savings is
// selected), so a module joins it only once its questions are answered.

// The modules a user can start from, in the order offered when nothing
// else decides it. "property" isn't in MODULE_META yet (see
// MobilePropertyScreen) but is offered the same way.
export const START_MODULES = ["pension", "cash", "investments", "studentLoan", "property"];

// One line per module on the home screen, saying what the user gets.
export const MODULE_PITCH = {
  pension:     "Check you're getting all the money your employer will add.",
  cash:        "See how long your savings would last, and what they could earn.",
  investments: "Make the most of your tax-free allowances.",
  studentLoan: "Find out whether paying it off early is worth it.",
  property:    "See what you could borrow, and whether buying beats renting.",
};

// Suggested first for "Just exploring": the module most people open first.
// PostHog module_opened, first module per person, 90 days to 5 Oct 2026:
// Pension 20, Cash 19, Investments 12, Student loan 7. Close enough that
// this is one setting, to change as more data comes in.
export const DEFAULT_FIRST_MODULE = "pension";

// E1's answers. `goal` is the financialGoals entry the pick also sets.
export const ENTRY_CHOICES = [
  { value:"cash",        label:"Savings and emergency cash", goal:"emergency_fund" },
  { value:"investments", label:"Investing and ISAs" },
  { value:"pension",     label:"Pension" },
  { value:"retirement",  label:"Retirement planning", goal:"retirement" },
  { value:"studentLoan", label:"Student loan" },
  { value:"property",    label:"Buying a home", goal:"buy_house" },
  { value:"exploring",   label:"Just exploring", exclusive:true },
];

// The modules the entry's picks lead to. "Retirement planning" is the
// Pension module, which covers retirement income as well as saving.
const PICK_MODULE = { retirement: "pension" };
export function pickedModules(interests) {
  const chosen = (interests || []).map(v => PICK_MODULE[v] || v);
  return START_MODULES.filter(k => chosen.includes(k));
}

// The goals E1's picks imply. The Goals step's other options (a big
// purchase, future generations, consolidating) only shape the overall
// report, so they're asked when it's made.
export function entryGoals(interests) {
  if ((interests || []).includes("exploring")) return ["exploring"];
  return ENTRY_CHOICES.filter(c => c.goal && (interests || []).includes(c.value)).map(c => c.goal);
}

// The entry's two questions, run by the same walk-through as the modules
// (GuidedFlow; question fields as in src/lib/propertyGuide.js). `also`
// gives the other saved inputs an answer sets alongside its own field.
export const ENTRY_QUESTIONS = [
  {
    id:"interests", field:"interests", kind:"multi", required:true,
    ask: () => "What would you like help with?",
    why: () => "We'll start with these. You can add the rest any time.",
    options: () => ENTRY_CHOICES,
    note: () => "Pick as many as you like.",
    also: value => ({ financialGoals: entryGoals(value) }),
  },
  {
    // What's useful to have to hand for the topics picked, said before the
    // questions start (testers asked to know up front). Information only:
    // nothing is uploaded, and every figure can be rough or skipped.
    id:"toHand", field:"toHand", kind:"info",
    ask: () => "Good to have to hand",
    why: () => "Rough figures are fine, and you can skip anything you don't know.",
    list: ({ d }) => toHandFor(d.interests),
  },
  {
    id:"name", field:"name", kind:"text", label:"First name", required:true,
    ask: () => "What should we call you?",
    why: () => "Only used to talk to you in the app.",
  },
];

// What's good to have to hand: salary always; then each picked topic's
// figures, rough is fine. Savings and investments share one line (where
// the money sits). "Just exploring" gets the pension and the money lines.
const TO_HAND = {
  pension:     [{ what:"An idea of your pension", where:"What you pay in, what your employer pays in, and what the pot's worth." }],
  money:       [{ what:"An idea of where your money sits", where:"Savings accounts, ISAs, investments, Premium Bonds, or cash under the mattress." }],
  studentLoan: [{ what:"Your student loan plan and balance", where:"Not sure? We can work it out with you." }],
  property:    [{ what:"What you've saved towards a deposit" },
                { what:"Roughly what you'd like to spend on a home" }],
};
const TO_HAND_TOPIC = { pension:"pension", cash:"money", investments:"money", studentLoan:"studentLoan", property:"property" };
export function toHandFor(interests) {
  const exploring = (interests || []).includes("exploring") || !(interests || []).length;
  const topics = exploring ? ["pension", "money"] : [...new Set(pickedModules(interests).map(k => TO_HAND_TOPIC[k]))];
  return [{ what:"Your salary" }, ...topics.flatMap(t => TO_HAND[t] || [])];
}

// The confidence check before the entry (/welcome), in the same walk-through
// format but kept apart from it, so it reads as a quick aside rather than
// part of the questions. Saved to localStorage (candid_confidence_score) and
// onto the user's row, not to the inputs.
export const CONFIDENCE_QUESTION = {
  id:"confidence", field:"confidence", kind:"choice",
  ask: () => "How confident are you managing your money?",
  why: () => "There's no wrong answer. It helps us pitch things right for you.",
  options: () => [
    { value:"1", label:"Not at all confident" },
    { value:"2", label:"Not very confident" },
    { value:"3", label:"Fairly confident" },
    { value:"4", label:"Confident" },
    { value:"5", label:"Very confident" },
  ],
};

// Whether the app is open to this user: they've had a report (everyone who
// used Candid before the two-question entry) or they've been through it.
export function appUnlocked(d, insights) {
  return !!insights || !!d.appEntered;
}

// Whether a module's questions have been answered. Property counts once its
// first step is complete; `propertyDone` is passed in rather than worked out
// here, to keep this file free of the Property calculations.
export function moduleDone(key, d, propertyDone = false) {
  return key === "property" ? propertyDone : (d.selectedModules || []).includes(key);
}

// The modules whose questions have been answered, in START_MODULES order.
export function doneModules(d, propertyDone = false) {
  return START_MODULES.filter(k => moduleDone(k, d, propertyDone));
}

// The modules picked at the entry (no "exploring"), in the order offered.
export function picks(d) {
  return pickedModules(d.interests);
}

// The modules the Candid score covers: Property isn't scored (it has no
// status in computeModuleStatuses), so a score from Property alone would read
// 100 with nothing behind it.
export const SCORED_MODULES = START_MODULES.filter(k => k !== "property");

// The picks the score waits for: those it covers. Property isn't scored, so
// it never holds the score back, whether picked at the entry or set by a
// shared Property link.
export function scorePicks(d) {
  return picks(d).filter(k => SCORED_MODULES.includes(k));
}

// When the Candid score appears: once every scored module picked at the
// entry is answered, so it covers everything the user said they cared about
// that it measures. With none picked ("Just exploring", or only Property):
// after their first scored module. Worked out by the code, no AI report
// (score-without-ai-plan.md).
export function scoreUnlocked(d, propertyDone = false) {
  const chosen = scorePicks(d);
  const done = doneModules(d, propertyDone);
  return chosen.length ? chosen.every(k => done.includes(k)) : done.some(k => SCORED_MODULES.includes(k));
}

// Modules picked at the entry but not answered yet, in the order offered:
// what stands between the user and their score, and home's "Still to do",
// each dropping off as it's answered.
export function unfinishedPicks(d, propertyDone = false) {
  return picks(d).filter(k => !moduleDone(k, d, propertyDone));
}

// Every module not answered yet, picks first: the Modules tab's "Not
// started", so a module is never unreachable just because it has no answers.
export function notStarted(d, propertyDone = false) {
  return moduleOrder(d).filter(k => !moduleDone(k, d, propertyDone));
}

// Goals the entry doesn't ask, asked once on home after the score appears
// (a card the user can dismiss), for product insight: nothing in the
// calculations reads them. Added to the goals the entry's picks already set
// (entryGoals), and saved to the user's row (financial_goals).
export const GOAL_CHOICES = [
  { value:"big_purchase",       label:"A big purchase" },
  { value:"future_generations", label:"Money for future generations" },
  { value:"consolidate",        label:"Bringing my money together" },
  { value:"none",               label:"None of these", exclusive:true },
];
export function goalsWith(interests, chosenGoals) {
  const chosen = (chosenGoals || []).filter(v => v !== "none");
  const fromEntry = entryGoals(interests).filter(g => !(chosen.length && g === "exploring"));
  return [...fromEntry, ...chosen];
}

// The home screen's module order for a user without a report: their picks
// first, in the order offered, then the rest. With no picks ("Just
// exploring"), DEFAULT_FIRST_MODULE leads.
export function moduleOrder(d) {
  const picked = pickedModules(d.interests);
  const first = picked.length ? picked : [DEFAULT_FIRST_MODULE];
  return [...first, ...START_MODULES.filter(k => !first.includes(k))];
}
