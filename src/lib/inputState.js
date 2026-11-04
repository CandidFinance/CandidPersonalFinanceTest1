// Each answer's state on Edit inputs (MobileInputsScreen): the user's own
// figure ("actual"), one Candid filled in for them ("estimate": a quick-start
// band, a default shown in the field, an estimated loan balance), or none
// yet ("empty"). One answer, one state, so the field shows one marker.
// Also which modules use a shared About-you figure, from the modules'
// walk-throughs, so the list keeps up with the questions on its own.
import { MODULE_GUIDES, flatQuestions } from "./moduleGuide.js";
import { estimatedFields } from "./workingChecks.js";
import { nationOf } from "./childcare.js";

export { estimatedFields };

const blank = v => v === "" || v == null;
const inRange = (v, { min, max }) => !blank(v) && Number.isInteger(+v) && +v >= min && +v <= max;
const hasCashTiers = d => (d.cashTiers || []).some(t => +t.amount > 0);

// A walk-through question (moduleGuide.js) in a module's tile.
// `estimated`: estimatedFields(d), worked out once per form.
export function answerState(q, ctx, estimated) {
  const { d } = ctx;
  const raw = d[q.field];
  if (q.kind === "info") return "actual";
  if (q.kind === "custom") {
    if (q.render === "cashAccounts") {
      if ([...estimated].some(f => f.startsWith("cashTiers."))) return "estimate";
      const missingRate = (d.cashTiers || []).some(t => +t.amount > 0 && blank(t.rate));
      return hasCashTiers(d) && !missingRate ? "actual" : "empty";
    }
    return !q.answered || q.answered(ctx) ? "actual" : "empty";
  }
  // Left blank, the balance is worked out from what they borrowed.
  if (q.field === "loanBalance" && blank(raw) && d.slBalanceEstimate === "yes") return "estimate";
  if (estimated.has(q.field)) return "estimate";
  if (q.yearRange) return inRange(raw, q.yearRange(ctx)) ? "actual" : "empty";
  if (!blank(raw)) return "actual";
  // A default shown in the field (the full State Pension, the usual loan
  // rate): the figures use it until they type their own.
  if (q.prefill) return "estimate";
  // "None" saves a blank, so a blank there is their answer.
  const notSure = q.notSure ? [q.notSure(ctx)].flat() : [];
  if (notSure.some(o => o?.label === "None")) return "actual";
  return "empty";
}

// The About-you fields (AboutYouFields.jsx), which aren't walk-through
// questions there. Extra income is optional, so blank is an answer.
export function aboutState(field, d, estimated) {
  if (estimated.has(field)) return "estimate";
  const notWorking = d.employmentStatus === "not_working";
  switch (field) {
    // Shown as Employed until they say, so that's Candid's guess.
    case "employmentStatus": return d.employmentAsked || +d.salary > 0 || !blank(d.employmentStatus) ? "actual" : "estimate";
    case "salary": return notWorking || +d.salary > 0 ? "actual" : "empty";
    case "ukNation": return nationOf(d) ? "actual" : "empty";
    case "otherIncome": case "dividendIncome": case "bonusAmount": return "actual";
    default: return blank(d[field]) ? "empty" : "actual";
  }
}

// The About-you tile's fields (AboutYouFields.jsx), as far as each shows.
export const ABOUT_FIELDS = ["name", "age", "email", "ukNation", "employmentStatus", "notWorkingReason", "earnedThisTaxYear", "salary", "otherIncome", "dividendIncome", "bonusAmount", "salaryTrajectory", "monthlyExpenses"];
const aboutShown = d => ABOUT_FIELDS.filter(f =>
  (f !== "notWorkingReason" || d.employmentStatus === "not_working")
  && (f !== "earnedThisTaxYear" || (d.employmentStatus === "not_working" && d.notWorkingReason === "break")));

// The £100k tax trap's walk-through asks Pension's and Kids & family's
// questions again. On Edit inputs, with that module answered too, they're
// in its tile, so the trap's tile links there rather than repeating them.
// `owners`: the modules answered in full (a partly answered one's tile
// holds only some of its questions).
const BORROWS = { taxTrap: ["pension", "kids"] };
// Each module's own answers, as its tile holds them (the shared About-you
// ones are in About you).
const GUIDE_FIELDS = Object.fromEntries(Object.entries(MODULE_GUIDES)
  .map(([k, { questions }]) => [k, new Set(flatQuestions(questions).filter(q => q.group !== "you").map(q => q.field))]));
export const answeredIn = (moduleKey, field, owners = []) =>
  (BORROWS[moduleKey] || []).find(k => owners.includes(k) && GUIDE_FIELDS[k].has(field)) ?? null;

// The answers in `owner`'s tile that `moduleKey` works from: the questions
// both ask, and for the trap Pension's employer part and any income drawn
// too, which set the pension allowance left (pension.js
// calcAnnualAllowanceRoom).
const ALSO_USES = { taxTrap: { pension: ["employerContributionType", "employerMatch", "pensionAccess"] } };
export const usedFrom = (moduleKey, owner) =>
  [...GUIDE_FIELDS[owner]].filter(f => GUIDE_FIELDS[moduleKey]?.has(f)).concat(ALSO_USES[moduleKey]?.[owner] || []);

// A module's questions as its tile shows them (ModuleInputsForm), less any
// answered in another tile (`owners`, answeredIn).
export function tileQuestions(moduleKey, ctx, questions = MODULE_GUIDES[moduleKey]?.questions || [], owners = []) {
  return flatQuestions(questions).filter(q => q.group !== "you" && (!q.showIf || q.showIf(ctx)) && !answeredIn(moduleKey, q.field, owners));
}

// Each field in a tile ("about" or a module) with its state, in order.
function tileStates(key, ctx, questions, owners) {
  const estimated = estimatedFields(ctx.d);
  return key === "about"
    ? aboutShown(ctx.d).map(field => ({ field, state: aboutState(field, ctx.d, estimated) }))
    : tileQuestions(key, ctx, questions, owners).map(q => ({ field: q.field, state: answerState(q, ctx, estimated) }));
}

// Counts for a tile's header line: { estimate, empty }.
export function tileCounts(key, ctx, questions, owners) {
  const counts = { estimate: 0, empty: 0 };
  for (const { state } of tileStates(key, ctx, questions, owners)) if (state !== "actual") counts[state]++;
  return counts;
}

// The first estimate or gap in a tile, to take them to.
export function firstGap(key, ctx, questions, owners) {
  return tileStates(key, ctx, questions, owners).find(f => f.state !== "actual")?.field ?? null;
}

// The modules among `shown` whose walk-through asks this About-you field.
const USED_BY = {};
for (const [key, { questions }] of Object.entries(MODULE_GUIDES)) {
  for (const q of flatQuestions(questions)) {
    if (q.group === "you") (USED_BY[q.field] ||= new Set()).add(key);
  }
}
export const modulesUsing = (field, shown) => shown.filter(k => USED_BY[field]?.has(k));
