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

// The overall "what to do first" report is offered once this many modules
// are done, and the Candid score waits for it.
export const REPORT_AFTER_MODULES = 2;

// E1's answers. `goal` is the financialGoals entry the pick also sets.
export const ENTRY_CHOICES = [
  { value:"cash",        label:"Savings and emergency cash", goal:"emergency_fund" },
  { value:"investments", label:"Investing and ISAs" },
  { value:"pension",     label:"Pension" },
  { value:"studentLoan", label:"Student loan" },
  { value:"property",    label:"Buying a home", goal:"buy_house" },
  { value:"exploring",   label:"Just exploring", exclusive:true },
];

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
    id:"name", field:"name", kind:"text", label:"First name", required:true,
    ask: () => "What should we call you?",
    why: () => "Only used to talk to you in the app.",
  },
];

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

// The home screen's module order for a user without a report: their picks
// first, in the order offered, then the rest. With no picks ("Just
// exploring"), DEFAULT_FIRST_MODULE leads.
export function moduleOrder(d) {
  const picked = START_MODULES.filter(k => (d.interests || []).includes(k));
  const first = picked.length ? picked : [DEFAULT_FIRST_MODULE];
  return [...first, ...START_MODULES.filter(k => !first.includes(k))];
}
