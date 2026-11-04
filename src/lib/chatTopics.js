import { calcMetrics } from "./metrics.js";
import { rateCurve, pensionPath, allowanceLost } from "./taxTrap.js";
import { childcareSupport, CHILDCARE_INCOME_LIMIT, TFC_CAP_PER_CHILD } from "./childcare.js";
import { MODULE_META, HIDE_MVP_MODULES, HIDDEN_MVP_MODULE_KEYS } from "./moduleStatus.js";

// The Chat tab's questions and answers. Each answer is a few short bubbles,
// at most one visual, then a button into the module that has the user's own
// figures, then "Ask next" follow-ups. Scripted, so every word is approved in
// advance; typed questions are matched to a topic by keyword (matchTopic).
// Guidance, not advice: what things are and what changes them, never what
// to do.
//
// A part is { text } or { visual }. Text can be a function of the figures
// (topicFigures) and marks bold with **…**.

// The figures behind every answer: the user's own when they've given a
// salary, otherwise an example at £110,000 (said as such on screen).
const EXAMPLE_SALARY = 110000;
const EXAMPLE_D = {
  salary: String(EXAMPLE_SALARY), employmentStatus: "employed", ukNation: "england",
  myContribution: "0", pensionType: "sacrifice",
  kidsStatus: "yes", kidsCount: "1", kidsPreschool: "1", kidsSchool: "0",
};
let exampleM = null;
const exampleBasis = () => ({ d: EXAMPLE_D, m: exampleM || (exampleM = calcMetrics(EXAMPLE_D)), example: true });

export function figureBasis(d, m) {
  return +d?.salary > 0 && m && !m.noEarnings ? { d, m, example: false } : exampleBasis();
}

// Tax and NI (not student loan) on the next £1 at a given income, as the
// Tax trap module's chart has it (rateCurve), on the user's own setup
// (Scotland's bands, say).
function rateAt(d, m, income) {
  const r = rateCurve(d, m, income, income)[0];
  return Math.round((r.tax + r.ni) * 100);
}

// One sample income from each stretch, the £100k–£125,140 one included.
export const RATE_SAMPLES = [40000, 75000, 110000, 135000];

// own: the rate at their own income. band: the bar showing that rate, or -1
// when none does (under the allowance, or Scotland's bands between samples).
export function ratesFigures(d, m) {
  const basis = figureBasis(d, m);
  const ani = Math.max(0, Math.round(basis.m.adjustedNetIncome || 0));
  const bars = RATE_SAMPLES.map(income => ({ income, pence: rateAt(basis.d, basis.m, income) }));
  const own = rateAt(basis.d, basis.m, ani);
  return { bars, own, band: bars.findIndex(b => b.pence === own), ani, example: basis.example, trapKeeps: 100 - bars[2].pence };
}

// The self-employed can't use salary sacrifice: theirs is paid from
// take-home, with relief at source.
const routeFor = d => (d.employmentStatus === "self_employed" ? "relief" : "sacrifice");

// £ a month more into a pension: what it costs in take-home and the
// allowance it brings back, at their pay (or the example's).
export function impactFigures(d, m, monthly) {
  const basis = figureBasis(d, m);
  const route = routeFor(basis.d);
  const p = pensionPath(basis.d, basis.m, monthly * 12, route);
  const before = allowanceLost(basis.m.adjustedNetIncome || 0, !!basis.m.scottish).lost;
  const after = allowanceLost(p.ani, !!basis.m.scottish).lost;
  return {
    salary: Math.round(basis.m.salary || EXAMPLE_SALARY),
    takeHomeMonthly: Math.round(p.takeHome / 12),
    allowanceBack: Math.max(0, before - after),
    ani: p.ani,
    route,
    example: basis.example,
  };
}

// The childcare income test at their income, with their children's support
// when they've told Candid about children; otherwise the example's.
export function childcareFigures(d, m) {
  const own = figureBasis(d, m);
  const ownCc = !own.example ? childcareSupport(own.d, own.m) : null;
  const basis = ownCc ? own : exampleBasis();
  const cc = ownCc || childcareSupport(basis.d, basis.m);
  const ani = Math.round(basis.m.adjustedNetIncome || 0);
  return {
    example: !ownCc,
    ani,
    over: ani > CHILDCARE_INCOME_LIMIT,
    gap: Math.abs(ani - CHILDCARE_INCOME_LIMIT),
    partner: cc?.state === "partner",
    // Funded hours stop at £100k in England only; Tax-Free Childcare UK-wide.
    hoursRule: (cc?.nation || "england") === "england",
    atStake: cc?.atStake || 0,
    tfcCap: TFC_CAP_PER_CHILD,
  };
}

const moduleOk = key => MODULE_META.some(mm => mm.key === key) && !(HIDE_MVP_MODULES && HIDDEN_MVP_MODULE_KEYS.includes(key));
export const moduleTitle = key => MODULE_META.find(mm => mm.key === key)?.title || key;
export const MODULE_SUB = {
  taxTrap: "Your salary, bonus and pension against the line",
  pension: "Contributions modelled on your own pay",
  kids: "Childcare support at your income",
};

export const TOPICS = {
  taper: {
    title: "£100k tax trap",
    parts: [
      { text: "Above **£100,000**, the **tax-free allowance** shrinks by **£1 for every £2** earned. At **£125,140** it's gone." },
      { visual: "rates" },
      { text: f => `So in that band, £1 of pay rise keeps about **${f.rates.trapKeeps}p**.` },
    ],
    plain: "The first £12,570 is tax-free. Over £100k, that tax-free slice shrinks, so tax bites harder until it's all gone.",
    next: [["What lowers it?", "lowers"], ["Childcare too?", "childcare"]],
    module: "taxTrap",
  },
  lowers: {
    title: "What lowers adjusted net income",
    parts: [
      { text: "HMRC checks **adjusted net income**, not salary. Three things bring it down:" },
      { visual: "lowers" },
      { text: f => `In the **£100k–£125k band**, £1 into a pension by **salary sacrifice** costs about **${f.rates.trapKeeps}p** of take-home pay.` },
    ],
    lead: "Here's what changes **the figure HMRC checks**.",
    plain: "Money paid into a pension, or given to charity with Gift Aid, comes off the number HMRC checks.",
    next: [["Show £350 a month", "impact"], ["Sacrifice vs personal?", "versus"]],
    module: "pension",
  },
  impact: {
    title: "£350 a month into a pension",
    parts: [
      { text: f => `${f.impact.example ? "On an example £110,000" : "On your pay"}, here's **£350 a month** more ${f.impact.route === "relief" ? "into a **personal pension**" : "by **salary sacrifice**"}. Slide to try other amounts.` },
      { visual: "impact" },
      { text: "**Take-home** falls by less than goes in. The gap is **tax and NI not charged**." },
    ],
    plain: "The money goes into the pension, but pay drops by less, because tax never touches it.",
    next: [["Childcare too?", "childcare"], ["Sacrifice vs personal?", "versus"]],
    module: "pension",
  },
  versus: {
    title: "Salary sacrifice and personal contributions",
    parts: [
      { text: "Both get **tax relief**. The difference is **when it arrives**." },
      { visual: "versus" },
      { text: "**Salary sacrifice** also saves **NI**. Personal contributions don't." },
    ],
    plain: "Sacrifice: your employer pays in before tax. Personal: you pay in after tax and claim it back.",
    next: [["Show £350 a month", "impact"], ["What lowers it?", "lowers"]],
    module: "pension",
  },
  childcare: {
    title: "Childcare and £100k",
    parts: [
      { text: "**Tax-Free Childcare** has a hard line: **£100,000** adjusted net income, per parent. In England, so do the working-parent **funded hours**." },
      { visual: "childcare" },
      { text: "A pound over and it stops. There's **no taper**." },
    ],
    plain: "Under £100k each, the help is there. A pound over, it isn't.",
    next: [["What lowers it?", "lowers"], ["Show £350 a month", "impact"]],
    module: "kids",
  },
  fallback: {
    title: null,
    parts: [{ text: "I can cover the **£100k tax trap**, **pensions**, **childcare** and **lump sums** so far. Try one of these." }],
    plain: null,
    next: [["What is the £100k tax trap?", "taper"], ["£350 a month into my pension?", "impact"]],
    module: null,
  },
};

// Topic ids that aren't scripted answers: they open another conversation.
export const WINDFALL = "windfall";

export function starters(d) {
  return [
    ["What is the £100k tax trap?", "taper"],
    ["£350 a month into my pension?", "impact"],
    ["Salary sacrifice vs personal?", "versus"],
    // As WindfallChat decides whether to welcome them back.
    [d?.windfall?.split && d.windfall.amount > 0 && d.windfall.earmark ? "Pick up your lump sum" : "I've got a lump sum", WINDFALL],
  ];
}

// What Candid says when the tab opens, typed out one message at a time.
export function greeting(d) {
  const name = d?.name ? String(d.name).trim().split(/\s+/)[0] : "";
  return [
    name ? `Hello, ${name}.` : "Hello.",
    "This is **Candid's chat**. Ask how something works and I'll explain it in a few lines, then point you to the module with **your own figures**.",
    "Ask me a question about **tax**, **pensions**, **childcare** or a **lump sum**, or pick one below.",
  ];
}

// A typed question to a topic id; "fallback" when nothing fits.
export function matchTopic(text) {
  const t = String(text || "").toLowerCase();
  // The specific topics first, so "does salary sacrifice lower my tax?"
  // isn't taken for the general "what lowers it".
  if (/lump sum|windfall|\binherit|redundan|cash gift/.test(t)) return WINDFALL;
  if (/\b350\b|take.?home/.test(t)) return "impact";
  if (/sacrifice|relief at source|personal (pension )?contribution/.test(t)) return "versus";
  if (/childcare|nursery|funded hours|30 hours|tax.?free childcare/.test(t)) return "childcare";
  if (/\b(avoid|reduce|lower|beat|escape)\b|get (under|below)/.test(t)) return "lowers";
  if (/100k|100,000|100 000|tax trap|personal allowance|taper|60%|62%/.test(t)) return "taper";
  return "fallback";
}

// "avoid the tax trap" gets a neutral opening line before the list.
export const wantsLead = text => /\b(avoid|beat|escape)\b/.test(String(text || "").toLowerCase());

// The answer's parts with text resolved, ready to show.
export function answerParts(id, figures, { lead = false } = {}) {
  const topic = TOPICS[id] || TOPICS.fallback;
  const parts = topic.parts.map(p => (p.text ? { text: typeof p.text === "function" ? p.text(figures) : p.text } : p));
  if (lead && topic.lead) parts[0] = { text: topic.lead };
  return topic.module && moduleOk(topic.module) ? [...parts, { module: topic.module }] : parts;
}

// Everything the text parts need, worked out once per answer.
export function topicFigures(d, m) {
  return { rates: ratesFigures(d, m), impact: impactFigures(d, m, 350) };
}

// **bold** into [{ text, bold }] runs.
export function boldRuns(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean)
    .map(s => (s.startsWith("**") ? { text: s.slice(2, -2), bold: true } : { text: s, bold: false }));
}
