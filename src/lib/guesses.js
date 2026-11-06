import { cashOpportunity } from "./assist.js";
import { calcStudentLoanScenario } from "./studentLoan.js";
import { taxTrap, thisTaxYear } from "./taxTrap.js";
import { childcareSupport, kidsSituation } from "./childcare.js";
import { childBenefitCharge, finalSalaryScheme, inRetirement } from "./pension.js";
import { affordableMaxPrice } from "./monthlyBudget.js";
import { hasEmployerMatch } from "./appEntry.js";
import { legalMinimumMetrics } from "./moduleReveal.js";

// The entry's guesses: what someone thinks a figure is, before Candid works
// it out, and the two side by side once it has. Pure, unit tested in
// guesses.test.js. Stored in `d.guesses` by question id, as the band's label;
// only a band counts ("No idea" and "Doesn't apply" store nothing).

const band = (label, lo, hi) => ({ label, lo, hi });

// `better`: which way is good news for this figure; null for neither (a low
// student loan total can just mean a write-off), which gets no verdict.
// `na`: also offers "Doesn't apply".
export const GUESS_QUESTIONS = {
  cash: [
    { id: "cash:0", ask: "How much more could your cash be earning a year?", better: "lower",
      bands: [band("Under £100", 0, 100), band("£100 to £250", 100, 250), band("£250 to £500", 250, 500), band("Over £500", 500)] },
    { id: "cash:1", ask: "How much will your cash earn this year?", better: "higher",
      bands: [band("Under £100", 0, 100), band("£100 to £500", 100, 500), band("£500 to £1k", 500, 1000), band("Over £1k", 1000)] },
  ],
  investments: [
    { id: "investments:0", ask: "How much tax-free ISA allowance are you leaving spare?", better: "lower",
      bands: [band("Under £5k", 0, 5000), band("£5k to £10k", 5000, 10000), band("£10k to £20k", 10000, 20000), band("All of it", 20000)] },
    { id: "investments:1", ask: "How much tax on your gains could you avoid this year?", better: "lower", na: true,
      bands: [band("Under £100", 0, 100), band("£100 to £300", 100, 300), band("£300 to £500", 300, 500), band("Over £500", 500)] },
  ],
  pension: [
    { id: "pension:0", ask: "What will your pension pot be when you stop work?", better: "higher",
      bands: [band("Under £250k", 0, 250000), band("£250k to £500k", 250000, 500000), band("£500k to £1m", 500000, 1000000), band("Over £1m", 1000000)] },
    { id: "pension:1", ask: "How much employer money are you leaving behind a year?", better: "lower", na: true,
      bands: [band("Under £500", 0, 500), band("£500 to £1.5k", 500, 1500), band("£1.5k to £3k", 1500, 3000), band("Over £3k", 3000)] },
  ],
  studentLoan: [
    { id: "studentLoan:0", ask: "How fast is your loan growing each year?", better: "lower",
      bands: [band("Under £1k", 0, 1000), band("£1k to £2.5k", 1000, 2500), band("£2.5k to £5k", 2500, 5000), band("Over £5k", 5000)] },
    { id: "studentLoan:1", ask: "How much will you repay on your loan in total?", better: null,
      bands: [band("Under £30k", 0, 30000), band("£30k to £60k", 30000, 60000), band("£60k to £100k", 60000, 100000), band("Over £100k", 100000)] },
  ],
  taxTrap: [
    { id: "taxTrap:0", ask: "What's the £100k trap costing you?", better: "lower",
      bands: [band("Under £1k", 0, 1000), band("£1k to £5k", 1000, 5000), band("£5k to £10k", 5000, 10000), band("Over £10k", 10000)] },
  ],
  kids: [
    { id: "kids:0", ask: "How much childcare help are you missing?", better: "lower", na: true,
      bands: [band("Under £1k", 0, 1000), band("£1k to £3k", 1000, 3000), band("£3k to £7k", 3000, 7000), band("Over £7k", 7000)] },
    { id: "kids:1", ask: "How much Child Benefit are you paying back a year?", better: "lower", na: true,
      bands: [band("Under £500", 0, 500), band("£500 to £1k", 500, 1000), band("£1k to £2k", 1000, 2000), band("Over £2k", 2000)] },
  ],
  property: [
    { id: "property:0", ask: "How much home could you really afford?", better: "higher",
      bands: [band("Under £250k", 0, 250000), band("£250k to £400k", 250000, 400000), band("£400k to £600k", 400000, 600000), band("Over £600k", 600000)] },
  ],
};

// The order of the entry's module tiles, and so of its questions.
export const GUESS_ORDER = ["cash", "investments", "pension", "studentLoan", "taxTrap", "kids", "property"];
const MAX_QUESTIONS = 3;

const inOrder = picks => GUESS_ORDER.filter(k => picks.includes(k));
const withKey = (key, q) => ({ ...q, module: key });

// Which questions they get: one module, both its questions; several, each
// one's first, topped up with second questions to three in all.
export function guessQuestions(picks) {
  const keys = inOrder(picks || []);
  if (keys.length === 1) return GUESS_QUESTIONS[keys[0]].map(q => withKey(keys[0], q));
  const list = keys.slice(0, MAX_QUESTIONS).map(k => withKey(k, GUESS_QUESTIONS[k][0]));
  for (const k of keys) {
    if (list.length >= MAX_QUESTIONS) break;
    if (GUESS_QUESTIONS[k][1]) list.push(withKey(k, GUESS_QUESTIONS[k][1]));
  }
  return list;
}

// What the entry saves when it's finished. Goals are the tiles they tapped,
// plus buying a home if they picked that module (windfall.js reads it).
// Only answers to questions still asked count: picks can change on the way back.
export const GOAL_VALUES = { "Buy a home": "buy_house", "Retire early": "retirement", "Safety net": "emergency_fund", "Clear my loan": "clear_loan",
  "See the world": "see_world", "Get married": "get_married", "Start a family": "start_family", "Grow my money": "grow_money" };
export function entryPatch({ worries = [], goals = [], other = false, nosy = false, picks = [], exploring = false, answers = {} }) {
  const interests = exploring ? ["exploring"] : inOrder(picks);
  const chosen = goals.map(g => GOAL_VALUES[g]).filter(Boolean);
  if (other) chosen.push("other");
  if (nosy) chosen.push("exploring");
  if (picks.includes("property") && !chosen.includes("buy_house")) chosen.push("buy_house");
  const guesses = {};
  for (const q of guessQuestions(exploring ? [] : picks)) if (answers[q.id]) guesses[q.id] = { band: answers[q.id] };
  return { interests, financialGoals: chosen, entryWorries: worries, guesses: Object.keys(guesses).length ? guesses : null };
}

// The figure a question guessed at, the same one the module's answer goes on
// to show (moduleReveal.js), or null when there isn't one yet.
export function guessFigure(id, d, m, { marketRates = {} } = {}) {
  switch (id) {
    case "cash:0": { const o = cashOpportunity(d, m, marketRates.rows); return o ? o.gain : null; }
    case "cash:1": { const o = cashOpportunity(d, m, marketRates.rows); return o ? o.currentKept + o.bondsPrize : null; }
    case "investments:0": return m.isaHeadroom ?? null;
    case "investments:1": return m.cgtSaving ?? null;
    case "pension:0": {
      if (finalSalaryScheme(d) || inRetirement(d)) return null;
      if (m.pensionStatus !== "unknown") return m.projectedPot ?? null;
      return d.employmentStatus === "employed" && m.salary > 0 && +d.age > 0 ? legalMinimumMetrics(d, m).projectedPot : null;
    }
    case "pension:1": return hasEmployerMatch(d) && m.pensionStatus !== "unknown" ? m.missedMatch ?? null : null;
    // Growth, as the question asks: interest less repayments, nothing if it's falling.
    case "studentLoan:0": return m.loanBal > 0 ? Math.max(0, calcStudentLoanScenario(d, m).netAnnualChange) : null;
    case "studentLoan:1": return m.loanBal > 0 ? calcStudentLoanScenario(d, m).totalRepaidProjected : null;
    case "taxTrap:0": { const y = thisTaxYear(d, m); const t = taxTrap(y.d, y.m); return t ? t.amount : null; }
    case "kids:0": {
      if (kidsSituation(d) === "no") return null;
      const y = thisTaxYear(d, m); const c = childcareSupport(y.d, y.m);
      if (!c) return null;
      return c.state === "lost" || c.state === "partner" ? c.atStake : c.unclaimed;
    }
    case "kids:1": {
      if (kidsSituation(d) === "no") return null;
      const y = thisTaxYear(d, m); const c = childBenefitCharge(y.d, y.m);
      return c ? c.charge : null;
    }
    case "property:0": { const a = affordableMaxPrice(d, m); return a ? a.price : null; }
    default: return null;
  }
}

// Where a band draws: its midpoint, or its lower limit when it's open-ended.
export const bandPoint = b => b.hi === undefined ? b.lo : (b.lo + b.hi) / 2;
export const inBand = (b, value) => value >= b.lo && (b.hi === undefined || value < b.hi);

// The headline says the size; `tone` says good or bad (better, worse, same).
export function guessOutcome(q, b, value) {
  if (inBand(b, value)) return { head: "About what you thought.", tone: "same" };
  const bigger = value >= (b.hi === undefined ? b.lo : b.hi);
  const head = bigger ? "Bigger than you thought." : "Smaller than you thought.";
  if (!q.better) return { head, tone: "same" };
  return { head, tone: (q.better === "higher") === bigger ? "better" : "worse" };
}

// The two columns, to one scale. A column of nothing still shows a sliver. A
// figure within an open-ended band is what they said ("Over £500"), so the
// columns match.
const MIN_BAR = 6;
export function guessBars(b, value, tallest = 360) {
  if (b.hi === undefined && inBand(b, value)) return { guess: tallest, figure: tallest };
  const top = Math.max(bandPoint(b), value);
  const of = v => top > 0 ? Math.max(MIN_BAR, Math.round(v * tallest / top)) : MIN_BAR;
  return { guess: of(bandPoint(b)), figure: of(value) };
}

// £1,150; over £100k, £412k; over £1m, £1.2m. `ref` is the final figure, so a
// count-up keeps one format all the way.
export function guessMoney(v, ref = v) {
  if (ref >= 999500) return `£${(Math.round(v / 100000) / 10).toFixed(1)}m`;
  if (ref >= 100000) return `£${Math.round(v / 1000)}k`;
  return `£${Math.round(v).toLocaleString("en-GB")}`;
}

// A module's guesses still to be compared: a stored band, not yet shown, with
// a figure to set it beside. Nobody without guesses (anyone from before the
// new entry) ever gets one.
export function pendingComparisons(key, d, m, ctx) {
  const out = [];
  for (const q of GUESS_QUESTIONS[key] || []) {
    const g = d.guesses?.[q.id];
    if (!g || g.shown) continue;
    const b = q.bands.find(x => x.label === g.band);
    if (!b) continue;
    const value = guessFigure(q.id, d, m, ctx);
    if (value == null || !Number.isFinite(value)) continue;
    out.push({ id: q.id, band: b.label, value: Math.round(value), bars: guessBars(b, value), ...guessOutcome(q, b, value) });
  }
  return out;
}
export const markShown = (guesses, ids) => {
  const out = { ...guesses };
  for (const id of ids) if (out[id]) out[id] = { ...out[id], shown: true };
  return out;
};
// The guess a first-module card shows: the module's first with a band.
export function moduleGuess(key, answers) {
  for (const q of GUESS_QUESTIONS[key] || []) if (answers[q.id]) return answers[q.id];
  return null;
}
