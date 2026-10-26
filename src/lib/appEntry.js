import { trapInView } from "./taxTrap.js";

// The app's entry, and what the home screen offers a user who
// hasn't had a report yet. Pure logic, unit tested in appEntry.test.js.
// Spec: docs/onboarding-guided-questions.md.
//
// The entry's picks are saved as `interests`, never `selectedModules`: the
// calculations read `selectedModules` as "this module's figures are in"
// (e.g. the Property checks treat cash as known once Cash & savings is
// selected), so a module joins it only once its questions are answered.

// The modules a user can start from, in the order offered when nothing
// else decides it. "property" isn't in MODULE_META yet (see
// MobilePropertyScreen) but is offered the same way. The £100k tax trap
// (taxTrap.js) is only offered near or over £100,000 (modulesInView), though
// a link straight to it always opens it.
export const START_MODULES = ["pension", "cash", "investments", "studentLoan", "kids", "taxTrap", "property"];

// One line per module on the home screen, saying what the user gets.
export const MODULE_PITCH_SELF_EMPLOYED = { pension: "See the tax relief on what you pay in, and where it's heading." };
export const pitchFor = (key, d) => (d?.employmentStatus === "self_employed" && MODULE_PITCH_SELF_EMPLOYED[key]) || MODULE_PITCH[key];
export const MODULE_PITCH = {
  pension:     "Check you're getting all the money your employer will add.",
  cash:        "See how long your savings would last, and what low rates cost you.",
  investments: "Make the most of your tax-free allowances.",
  studentLoan: "Find out whether paying it off early is worth it.",
  kids:        "See the childcare help you could get, and what £100,000 costs a parent.",
  taxTrap:     "See what crossing £100k costs you, and the ways back under it.",
  property:    "See what you could borrow, and whether buying beats renting.",
};

// Where "Just exploring" goes, and what leads Home with no picks: Cash &
// savings, the module the onboarding tour is built around (Harvey, 23 Oct
// 2026). Before that it was Pension, the module most people opened first
// (PostHog, 90 days to 5 Oct 2026: Pension 20, Cash 19).
export const DEFAULT_FIRST_MODULE = "cash";

// E1's answers. `goal` is the financialGoals entry the pick also sets.
// `tint`: the tile's fill once picked, each its own colour from the theme
// (Harvey's six, plus dusty blue and terracotta); `ink`, its text there.
// `lines`: the label as the tile shows it, two words or more over two lines.
export const ENTRY_CHOICES = [
  { value:"cash",        label:"Cash & Savings", lines:"Cash &\nSavings", goal:"emergency_fund", tint:"#A9BF95", ink:"#162f24" },
  { value:"investments", label:"Investing", tint:"#7A8A5E", ink:"#ffffff" },
  { value:"pension",     label:"Pension", tint:"#D9C2A7", ink:"#162f24" },
  { value:"retirement",  label:"Retirement", goal:"retirement", tint:"#7A5235", ink:"#ffffff" },
  { value:"studentLoan", label:"Student loan", lines:"Student\nloan", tint:"#A7BCCB", ink:"#162f24" },
  { value:"kids",        label:"Family finances", lines:"Family\nfinances", tint:"#EDB9B2", ink:"#162f24" },
  { value:"property",    label:"Buying a home", lines:"Buying\na home", goal:"buy_house", tint:"#D49A7A", ink:"#162f24" },
  { value:"exploring",   label:"Just exploring", lines:"Just\nexploring", exclusive:true, tint:"#F3DC8C", ink:"#162f24" },
];

// The modules the entry's picks lead to. "Retirement" is the
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

const firstName = d => (d.name || "").trim();

// The entry's one question, run by the same walk-through as the modules
// (GuidedFlow; question fields as in src/lib/propertyGuide.js). `also` gives
// the other saved inputs an answer sets alongside its own field. The first
// name is asked with the email (SaveFiguresOffer), not here.
export const ENTRY_QUESTIONS = [
  {
    // The picks set which modules Home offers first, and which the score
    // waits for (scorePicks).
    id:"interests", field:"interests", kind:"multi", required:true,
    ask: () => "Where might you be losing money?",
    why: () => "We'll set you up based on this. Add more later.",
    options: () => ENTRY_CHOICES, layout: "wrap",
    note: () => "Pick as many as you like.",
    also: value => ({ financialGoals: entryGoals(value) }),
  },
];

// The first module picked at the entry, which the app opens straight after
// it, and where it lives; DEFAULT_FIRST_MODULE for "Just exploring".
export const firstPick = d => pickedModules(d.interests)[0] || DEFAULT_FIRST_MODULE;
export const modulePath = key => key === "property" ? "/app/property" : `/app/module/${key}`;

// How long a message takes to read, so the next one doesn't arrive before
// it's been read (WindfallChat): 330 words a minute (quicker than the 240
// average for silent reading, which felt slow in testing), plus a moment
// to look.
export const READING_WPM = 330;
export function readingMs(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return 300 + Math.round(words * 60000 / READING_WPM);
}

// Whether the app is open to this user: they've had a report (everyone who
// used Candid before the entry) or they've been through it.
export function appUnlocked(d, insights) {
  return !!insights || !!d.appEntered;
}

// Whether a module's questions have been answered: finished, or changed on
// Edit inputs, not just opened and skipped (opening one adds it to
// selectedModules either way, and its figures would then come from blank
// answers: a guess, not an answer). Tracked in `answeredModules` from the
// entry on; for anyone from before, with none recorded, every module with
// figures counts.
export function moduleAnswered(key, d) {
  return (d.selectedModules || []).includes(key) && (!Array.isArray(d.answeredModules) || d.answeredModules.includes(key));
}
// Whether paying a student loan off early comes out ahead depends on their
// savings (what they earn, and what's spare above a buffer) and, for the
// employed, their employer's pension match, which beats any overpayment.
// Until both are in (each module answered, or its questions on the short
// route from Student loan: moduleGuide.js briefQuestions), the Student loan
// module gives what the loan itself costs, not that verdict.
export const loanSavingsIn = d => moduleAnswered("cash", d) || (d.askedFields || []).some(f => f === "cashTiers" || f === "hasCashSavings");
export function loanPensionChecked(d) {
  return moduleAnswered("pension", d) || (d.askedFields || []).includes("pensionStatus");
}
// This year's ISA payments: from Cash & savings or Investments, or the
// short route's ISA questions.
export const loanIsaIn = d => moduleAnswered("cash", d) || moduleAnswered("investments", d) || (d.askedFields || []).includes("hasCashIsaThisYear");
// Only the employed have an employer's pension match to check.
export const hasEmployerMatch = d => d.employmentStatus !== "self_employed" && d.employmentStatus !== "not_working";
export function loanVerdictReady(d) {
  return loanSavingsIn(d) && (!hasEmployerMatch(d) || loanPensionChecked(d));
}
export const withAnswered = (d, key) => ({ answeredModules: [...new Set([...(d.answeredModules || []), key])] });

// Whether a module's questions have been answered. Property counts once its
// first step is complete; `propertyDone` is passed in rather than worked out
// here, to keep this file free of the Property calculations.
export function moduleDone(key, d, propertyDone = false) {
  return key === "property" ? propertyDone : moduleAnswered(key, d);
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
// (docs/score-without-ai-plan.md).
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
  return modulesInView(d, [...first, ...START_MODULES.filter(k => !first.includes(k))]);
}

// The modules offered to this user: the £100k tax trap only when their
// income is near or over £100,000, or heading there (taxTrap.js
// trapInView), or once they've answered it.
export function modulesInView(d, keys = START_MODULES) {
  return keys.filter(k => k !== "taxTrap" || moduleAnswered("taxTrap", d) || trapInView(d));
}
// Not offered yet, but shown greyed on Modules so they know it's there: the
// £100k tax trap below £90,000, with what it's for and when it opens. In
// colour, and to start, once it's in view.
export const dormantModules = d => START_MODULES.filter(k => k === "taxTrap" && !modulesInView(d).includes(k));
export const MODULE_DORMANT_LINE = {
  taxTrap: "Over £100k, each extra £1 can cost 62% and childcare support stops. Opens as your income nears it.",
};

// Modules marked new (a gold star on their icon, ModuleStartRow) for
// NEW_DAYS after they went live.
export const MODULE_LAUNCHED = { property: "2026-10-01", studentLoan: "2026-10-20", taxTrap: "2026-10-20" };
export const NEW_DAYS = 42;
export function isNewModule(key, now = new Date()) {
  const on = MODULE_LAUNCHED[key];
  return !!on && now - Date.parse(on) < NEW_DAYS * 86400000;
}

// Home's "Worth a look", once dismissed, stays away until a module they
// haven't seen in it appears (`worthALookDismissed`: the keys it held).
export const worthALookShown = (d, keys) => keys.some(k => !(d.worthALookDismissed || []).includes(k));

// The scored modules this user is offered, for "N of M areas checked".
export const scoredInView = d => modulesInView(d, SCORED_MODULES);
