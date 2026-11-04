import { ENTRY_CHOICES, START_MODULES, pickedModules, pitchFor, doneModules, moduleDone, modulesInView, unfinishedPicks } from "./appEntry.js";
import { MODULE_META, getModuleSummary, isOnTrack } from "./moduleStatus.js";
import { questionOrder, askFor, estimateLineFor } from "./quickStart.js";
import { CASH_QUICK } from "./cashQuick.js";
import { PENSION_QUICK } from "./pensionQuick.js";
import { STUDENT_LOAN_QUICK } from "./studentLoanQuick.js";
import { TAX_TRAP_QUICK } from "./taxTrapQuick.js";
import { starters } from "./chatTopics.js";
import { makeVoice } from "./chatVoice.js";

// Where the Chat tab's conversation starts, and the module questions it
// asks along the way. Pure logic, unit tested in chatStart.test.js; the
// conversation itself is mobile/chat/useChatStart.js.
//
// Three ways in, worked out again each time the tab opens (chatStart):
// - "returning": modules answered already. Their figures, largest £ first.
// - "picked": areas picked at the entry, none answered yet.
// - "scratch": nothing yet. The areas to pick from.
// With several areas picked, the user says which comes first: Candid never
// says where to start (CLAUDE.md, "a calculator, not an adviser"). Each
// module with a quick start is asked in the conversation, in bands, and
// writes the same fields as its quick start, so Edit inputs and the module
// page have the answers, marked as estimates.

// The modules whose questions the chat asks itself. The rest (Investments,
// Kids & family, Buying a home) hand over to their own walk-through.
export const CHAT_QUICK = {
  cash: CASH_QUICK,
  pension: PENSION_QUICK,
  studentLoan: STUDENT_LOAN_QUICK,
  taxTrap: TAX_TRAP_QUICK,
};

// The entry's areas, with the £100k tax trap too (the entry offers it only
// near £100,000; here someone can say it's what they came for).
export const CHAT_AREAS = [
  ...ENTRY_CHOICES.filter(c => !c.exclusive),
  { value: "taxTrap", label: "£100k tax trap" },
  ...ENTRY_CHOICES.filter(c => c.exclusive),
];

export const titleOf = key => key === "property" ? "Buying a home" : MODULE_META.find(mm => mm.key === key)?.title || key;

const firstName = d => (d?.name ? String(d.name).trim().split(/\s+/)[0] : "");
// "A, B and C".
export const listOf = items => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
const bold = s => `**${s}**`;

export function chatStart(d) {
  if (doneModules(d).length) return "returning";
  if (pickedModules(d.interests).length) return "picked";
  return "scratch";
}

// A module's line in a list of answers: its £ (none while it's locked, so
// the chat doesn't get round the paywall), and the line its card shows.
export function moduleRow(d, m, statuses, key, locked = false) {
  const mm = MODULE_META.find(x => x.key === key);
  if (!mm) return { key, title: titleOf(key), amount: null, line: null, locked };
  const s = getModuleSummary(mm, d, m, statuses);
  if (locked) return { key, title: mm.title, amount: null, line: "Your answer is ready in the module.", locked: true };
  return {
    key, title: mm.title,
    amount: s.amount > 0 && !isOnTrack(s) ? s.amount : null,
    lumpSum: s.amountIsLumpSum,
    onTrack: isOnTrack(s),
    line: s.status === "na" ? s.impactLabel || null : s.summary,
    locked: false,
  };
}

// Every answered module, largest £ first, locked ones last.
export function answeredRows(d, m, statuses, locked = () => false) {
  // £ a year first, largest first; one-off sums (by 18) after them, as they
  // can't be set against a yearly figure; then those with no figure.
  const rank = r => (r.locked ? -3 : r.amount == null ? -2 : r.lumpSum ? -1 - 1 / (1 + r.amount) : r.amount);
  return doneModules(d).filter(k => MODULE_META.some(mm => mm.key === k))
    .map(k => moduleRow(d, m, statuses, k, locked(k)))
    .sort((a, b) => rank(b) - rank(a));
}

// The areas not looked at yet, for "Something else": the tax trap only when
// it's in view (or picked), as on Modules. Buying a home has no answered
// state here, so it isn't offered again.
export function otherAreas(d) {
  const picked = pickedModules(d.interests);
  return START_MODULES.filter(k => k !== "property" && !moduleDone(k, d))
    .filter(k => k !== "taxTrap" || picked.includes(k) || modulesInView(d, [k]).length);
}

const go = key => [titleOf(key), `go:${key}`];
// The areas picked, to say which first, or a question instead.
export const pickReplies = picks => ({ kind: "next", label: "Pick one", items: [...picks.map(go), ASK] });
const ASK = ["Ask a question", "ask"];
const ELSE = ["Something else", "else"];

// What's offered after a module: the next area on their own list (in the
// order they were offered), then anything else, or a question.
export function nextReplies(d, current = null) {
  const next = unfinishedPicks(d).filter(k => k !== current && k !== "property")[0];
  const items = next ? [[`${titleOf(next)} next`, `go:${next}`]] : [];
  if (current === "taxTrap") items.push(["What is the £100k tax trap?", "taper"], ["What lowers it?", "lowers"]);
  return { kind: "next", label: "Next", items: [...items, ELSE, ASK] };
}

export const askReplies = d => ({ kind: "next", label: "Try asking", items: starters(d) });
export const elseReplies = d => ({ kind: "next", label: "Pick one", items: [...otherAreas(d).map(go), ASK] });

// What Candid says when the tab opens, and the replies offered under it.
// `voice` (chatVoice.js) varies the small phrases from one visit to the next.
export function opening(d, m, statuses, locked = () => false, voice = makeVoice()) {
  const branch = chatStart(d);
  const name = firstName(d);
  const hi = pool => `${voice(pool)}${name ? `, ${name}` : ""}.`;
  if (branch === "returning") {
    const rows = answeredRows(d, m, statuses, locked);
    const left = unfinishedPicks(d).filter(k => k !== "property");
    return {
      branch,
      parts: [
        { text: hi("helloAgain") },
        { text: rows.length > 1 ? "Here's what you've checked so far, **largest figure first**." : "Here's what you've checked so far." },
        { rows },
        ...(left.length ? [{ text: `Still on your list: ${listOf(left.map(k => bold(titleOf(k))))}.` }] : []),
      ],
      replies: nextReplies(d),
    };
  }
  if (branch === "picked") {
    const picks = pickedModules(d.interests);
    return {
      branch,
      parts: [
        { text: hi("hello") },
        { text: `You picked ${listOf(picks.map(k => bold(titleOf(k))))} as ${picks.length > 1 ? "the areas" : "the area"} you're here for. ${buildUp(picks.length)}` },
        { text: picks.length > 1 ? voice("whereFirst") : "Ready when you are." },
      ],
      replies: pickReplies(picks),
    };
  }
  return {
    branch,
    parts: [
      { text: hi("hello") },
      { text: "I'll help you see where your money could be working harder, on **your own figures**. A few quick taps per area, and real numbers are a bonus, not a must." },
      { text: "So, what are you here for? Pick as many as you like." },
    ],
    replies: { kind: "areas" },
  };
}

// What happens next, once the areas are known.
const buildUp = n => `I'll ask a few quick questions on ${n > 1 ? "each" : "it"}, to build a picture of where you're at. Then I'll show you where your money could be working harder, and where it might be leaking.`;

// Once areas are picked in the chat: a word back, what Candid looks at in
// each, what happens next and, with more than one, which first.
export function picksParts(d, modules, voice = makeVoice()) {
  return [
    { text: voice("picked") },
    { text: modules.length > 1 ? "Here's what I look at in each:" : "Here's what I look at:" },
    ...pickLines(d, modules),
    { text: buildUp(modules.length) },
    ...(modules.length > 1 ? [{ text: voice("whereFirst") }] : []),
  ];
}

// The picks, saved as at the entry (`interests`), and the modules they
// lead to, in the order offered.
export function areasPicked(values) {
  return { interests: values, modules: values.includes("exploring") ? [] : pickedModules(values) };
}

// One line per module picked: what Candid looks at there.
export const pickLines = (d, keys) => keys.map(k => ({ text: `${bold(titleOf(k))}: ${pitchFor(k, d)}` }));

// The quick start's questions, as the chat asks them: opened directly, so
// pay, age and work are asked when they're not in yet.
export const chatOrder = (setup, d, m, a) => questionOrder(setup, { d, m, a, direct: true });
export function nextQuestion(setup, d, m, a, current = null) {
  const order = chatOrder(setup, d, m, a);
  return current == null ? order[0] ?? null : order[order.indexOf(current) + 1] ?? null;
}
export const questionText = (setup, qid, d, m, a) => askFor(setup.questions[qid], { d, m, a, direct: true });

// A band's label, short, as the chat's tiles show it: "<£1k",
// "£1k–£2.5k", "4%+". Labels without £ or % stay as they are.
export function tileLabel(label) {
  if (!/[£%]/.test(label)) return label;
  let mt;
  if ((mt = label.match(/^Under (\S+)$/))) return `<${mt[1]}`;
  if ((mt = label.match(/^(\S+) to (\S+)$/))) return `${mt[1]}–${mt[2]}`;
  if ((mt = label.match(/^(?:Over (\S+)|(\S+) or more)$/))) return `${mt[1] || mt[2]}+`;
  return label;
}

// The user's reply as it shows in their bubble.
export function answerLabel(q, ctx, value) {
  if (value === "unsure") return "Not sure";
  if (q.kind === "slider") return `${value}%`;
  const label = q.options(ctx).find(o => o.value === value)?.label;
  return label ? tileLabel(label) : String(value);
}

// The tile offered first (a question's `default`), as QuickStart picks it.
export function suggestedFor(q, ctx) {
  if (!q?.default || q.kind === "slider") return null;
  const value = q.default(ctx);
  return q.options(ctx).some(o => o.value === value) ? value : null;
}

// What's at stake in a module, and what the questions will work out.
const CHAT_INTRO = {
  cash: "Money left in a low-rate account can lose out by hundreds of pounds a year against the leading rates. And if the rate's really low, it may be losing value to inflation every year too. A few quick questions and I'll work out roughly how much yours could be losing a year, against today's leading rates.",
  pension: "Your employer may be paying you more than your salary, through your pension. A few quick questions and I'll show whether you're getting all of it.",
  studentLoan: "After a home, it's likely the biggest thing you'll ever buy. A few quick questions and I'll work out whether paying it off early is worth it on your figures.",
  taxTrap: "Between £100,000 and £125,140, each extra £1 can cost 60p or more in tax. A few quick questions and I'll work out what it costs you a year, and what brings it down.",
};

// Questions that take an exact figure, typed in the message box: what it's
// called, the least taken as that figure (below it, Candid asks again), and
// what it writes over the band's figure once the quick start's patch is in.
// A figure that no longer matches its band's drops off the estimates line
// by itself (estimateItems, estimatedNow).
export const CHAT_EXACT = {
  salary: { noun: "salary", per: "year", example: "£52,000", min: 1000, write: (p, n) => ({ salary: String(n) }) },
  savings: { noun: "savings", example: "£8,000", min: 1, write: (p, n) => ({ cashTiers: [{ ...(p.cashTiers?.[0] || { name: "", rate: "" }), amount: String(n) }] }) },
  costs: { noun: "monthly costs", per: "month", example: "£1,800", min: 50, write: (p, n) => ({ monthlyExpenses: String(n) }) },
  pot: { noun: "pension pot", example: "£40,000", min: 0, write: (p, n) => ({ potValue: n > 0 ? String(n) : "", ...(p.hasPensionPot && { hasPensionPot: n > 0 ? "yes" : "no" }) }) },
  balance: { noun: "balance", example: "£45,000", min: 1, write: (p, n) => ({ loanBalance: String(n), slBalanceEstimate: "" }) },
  bonus: { noun: "bonus", per: "year", example: "£10,000", min: 0, write: (p, n) => (n > 0
    ? { hasExtraIncome: "yes", extraIncomeKinds: ["bonus"], bonusAmount: String(n) }
    : { hasExtraIncome: "no", extraIncomeKinds: ["none"], bonusAmount: "" }) },
};

// A typed figure ("£52,000", "52k", "about 1.8k a month"), or null if the
// words are more than a figure (a question, say).
// A range ("50-60k") isn't one figure. The period ("a month", "pa") is
// read separately (periodOf), so a figure in the wrong one is caught.
const FIGURE_WORDS = /-?ish\b|\b(about|around|roughly|approx(imately)?|circa|pounds?|gbp|a|per|year|yr|annum|month|pa|pm|before|tax|gross|total)\b|[~£,/]/g;
export function parseFigure(text) {
  const t = String(text).toLowerCase().replace(FIGURE_WORDS, " ").replace(/\s+/g, "");
  const mt = t.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  return mt ? Math.round(+mt[1] * (mt[2] === "k" ? 1e3 : mt[2] === "m" ? 1e6 : 1)) : null;
}

// "month" or "year" if the words say which, else null.
export function periodOf(text) {
  const t = String(text).toLowerCase();
  if (/\bmonth(ly)?\b|\bpm\b|\/\s*m(onth)?\b|\bpcm\b/.test(t)) return "month";
  if (/\byear(ly)?\b|\bannum\b|\bannual(ly)?\b|\bpa\b|\byr\b|\/\s*y(ea)?r\b/.test(t)) return "year";
  return null;
}

// A typed reply to a question with tiles: the tile whose words it is
// ("yes", "not sure", "£5k-£10k"), or null.
export function tileFor(q, ctx, text) {
  if (q.kind === "slider") return null;
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9£%<+]/g, "");
  const t = norm(text);
  if (!t) return null;
  return q.options(ctx).find(o => norm(o.label) === t || norm(tileLabel(o.label)) === t)?.value ?? null;
}

// The band a typed figure falls in, for the questions that follow (which
// read the band). A band's floor is its own, or read off its label.
const floorOf = o => o.floor ?? (/^under/i.test(o.label) ? 0 : +(o.label.match(/£([\d.]+)k/)?.[1] ?? NaN) * 1000);
export function bandFor(q, ctx, n) {
  const options = q.options(ctx);
  if (n === 0 && options.some(o => o.value === "none")) return "none";
  const bands = options.filter(o => Number.isFinite(floorOf(o)));
  return bands.filter(o => n >= floorOf(o)).pop()?.value ?? bands[0]?.value;
}

// The answers' patch, with any typed figures written over their bands'.
export function chatPatch(setup, d, m, a, exact = {}) {
  const patch = setup.patch(d, m, a);
  for (const [qid, n] of Object.entries(exact)) Object.assign(patch, CHAT_EXACT[qid].write(patch, n));
  return patch;
}

// A word back on an answer, as a person would: a few answers get their own,
// the rest a plain one from the voice. Never on their pay.
const REACT = {
  savings: (v, say) => (["5-10", "10-20"].includes(v) ? say("savedWell") : ["20-50", "50-100", "100+"].includes(v) ? say("savedLots") : null),
  rate: (v, say) => (v === "4+" ? "That's a strong rate already." : v === "unsure" ? `${say("noProblem")}, I'll use the UK average of 2.5% for now.` : null),
  buffer: () => "Good to know.",
  payIn: (v, say) => (v === "db" ? "A final salary pension. Those are valuable." : v === "unsure" ? `${say("noProblem")}, plenty of people aren't sure.` : null),
  mine: (v, say) => (v === "unsure" ? `${say("noProblem")}, I'll use the legal minimum of 5% for now.` : null),
  employer: (v, say) => (v === "unsure" ? `${say("noProblem")}, I'll use the legal minimum of 3% for now.` : null),
  pot: (v, say) => (v === "unsure" ? `${say("noProblem")}, I'll estimate it from your age and pay.` : null),
  plan: (v, say) => (v === "unsure" ? `${say("noProblem")}, one question will work it out.` : null),
  balance: (v, say) => (v === "unsure" ? `${say("noProblem")}, I'll estimate it from a typical course.` : null),
  bonus: v => (v === "none" ? "Okay, no bonus." : null),
};
const lowerFirst = s => s.charAt(0).toLowerCase() + s.slice(1);
export const reaction = (qid, value, voice = makeVoice()) => REACT[qid]?.(value, voice) ?? null;

// The most questions that could still follow this one, whatever the answer
// (a "Yes" can bring follow-ups), so "Last one" is never said too soon.
function mostAfter(setup, d, m, a, qid) {
  const q = setup.questions[qid];
  const ctx = { d, m, a, direct: true };
  const values = q.kind === "slider" ? ["unsure", String(q.start(ctx))] : q.options(ctx).map(o => o.value);
  return Math.max(0, ...values.map(v => {
    const order = chatOrder(setup, d, m, { ...a, [qid]: v });
    const i = order.indexOf(qid);
    return i < 0 ? order.length : order.length - i - 1;
  }));
}

// Candid's message for a question: a word back on the answer before (if
// any), where they are ("Nearly there", "Last one"), then the question.
// `nudge`: a reminder first that real figures can be typed.
export function questionParts(setup, qid, d, m, a, { prev = null, voice = makeVoice(), nudge = false } = {}) {
  const q = questionText(setup, qid, d, m, a);
  const after = mostAfter(setup, d, m, a, qid);
  const asked = Object.keys(a).length;
  const said = prev ? reaction(prev, a[prev], voice) ?? voice("ack") : null;
  const lead = !prev ? voice("first")
    : after === 0 && asked >= 2 ? voice("lastOne", { module: titleOf(setup.module) })
    : voice("lead");
  const nearly = prev && after === 1 && asked >= 2 ? voice("nearly") : null;
  const body = [nearly, lead ? lead + lowerFirst(q) : q].filter(Boolean).join(" ");
  if (nudge) return [...(said ? [{ text: said }] : []), { text: voice("nudge") }, { text: body }];
  return [{ text: [said, body].filter(Boolean).join(" ") }];
}

// After the last answer, before the module's answer.
export const lastWord = (qid, value, voice = makeVoice()) => `${reaction(qid, value, voice) ?? voice("ack")} ${voice("done")}`;

// Before a module's questions: what's at stake there and what the
// questions work out, how to answer, then the first question.
export function moduleIntro(d, m, key, voice = makeVoice()) {
  const setup = CHAT_QUICK[key];
  if (!setup) {
    return [
      { text: `${bold(titleOf(key))} has its own questions, in the module. They take a minute or two.` },
      { module: key },
    ];
  }
  const order = chatOrder(setup, d, m, {});
  if (!order.length) return [{ text: `I've already got what I need for ${bold(titleOf(key))} from your earlier answers.` }];
  const parts = [{ text: CHAT_INTRO[key] || setup.intro?.subtitle || `A few questions on ${bold(titleOf(key))}.` }];
  if (order.length) parts.push({ text: voice(order.some(q => CHAT_EXACT[q]) ? "howToAnswer" : "tapToAnswer") }, ...questionParts(setup, order[0], d, m, {}, { voice }));
  return parts;
}

// The line naming what's estimated, as under the module's own answer.
export const estimateLine = (d, key) => CHAT_QUICK[key]?.estimateLine?.(d) ?? estimateLineFor(d, key);

// A module's answer in the conversation, once its figures are in `d`: its
// row, what's estimated, the way into the module; then, when it was the
// last on their list and there's more than one, everything so far.
export function resultParts(d, m, statuses, key, locked = () => false, voice = makeVoice()) {
  const row = moduleRow(d, m, statuses, key, locked(key));
  // What's estimated sits in the row, under its line.
  const est = !row.locked && estimateLine(d, key);
  const parts = row.locked
    ? [{ text: `Your answer on ${bold(row.title)} is ready.` }]
    : [{ text: voice("result", { module: row.title }) }, { rows: [{ ...row, note: est || null }] }];
  parts.push({ module: key });
  const rows = answeredRows(d, m, statuses, locked);
  if (!unfinishedPicks(d).filter(k => k !== "property").length && rows.length > 1) {
    parts.push({ text: "Everything you've checked so far, **largest figure first**." }, { rows });
  }
  return parts;
}
