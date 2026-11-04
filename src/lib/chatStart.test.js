import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses } from "./moduleStatus.js";
import { TOPICS, WINDFALL } from "./chatTopics.js";
import {
  chatStart, opening, nextReplies, elseReplies, answeredRows, resultParts, moduleIntro, nextQuestion,
  answerLabel, areasPicked, listOf, CHAT_QUICK, CHAT_AREAS, parseFigure, bandFor, chatPatch, questionParts, lastWord, tileLabel, picksParts, periodOf, tileFor, pickReplies,
} from "./chatStart.js";
import { estimateLineFor } from "./quickStart.js";
import { makeVoice, VOICE } from "./chatVoice.js";

const statuses = d => computeModuleStatuses(d, calcMetrics(d));
const open = (d, locked) => opening(d, calcMetrics(d), statuses(d), locked);
const ids = new Set([...Object.keys(TOPICS), WINDFALL, "else", "ask"]);
const leads = id => ids.has(id) || /^go:/.test(id);
// Everything Candid says, as one string, for the copy checks.
const said = parts => parts.filter(p => p.text).map(p => p.text).join(" ");

const ANSWERED = {
  salary: "75000", employmentStatus: "employed", employmentAsked: true, age: "35", monthlyExpenses: "2000",
  cashTiers: [{ name: "", amount: "40000", rate: "1" }], hasCashSavings: "yes",
  pensionStatus: "yes", hasPension: "yes", pensionKind: "dc", myContribution: "5", employerMatch: "3",
  selectedModules: ["cash", "pension"], answeredModules: ["cash", "pension"], interests: ["cash", "pension", "studentLoan"],
};

test("the way in: answered modules, then picks, then nothing", () => {
  assert.equal(chatStart({}), "scratch");
  assert.equal(chatStart({ interests: ["cash"] }), "picked");
  assert.equal(chatStart({ interests: ["exploring"] }), "scratch");
  assert.equal(chatStart(ANSWERED), "returning");
});

test("from scratch: the areas, the tax trap among them", () => {
  const o = open({});
  assert.equal(o.replies.kind, "areas");
  assert.ok(CHAT_AREAS.some(c => c.value === "taxTrap"));
  assert.equal(CHAT_AREAS[CHAT_AREAS.length - 1].value, "exploring");
});

test("picks: the user says which comes first, in the order offered, and Candid never does", () => {
  const o = open({ interests: ["taxTrap", "cash"] });
  const go = o.replies.items.filter(([, id]) => id.startsWith("go:")).map(([, id]) => id);
  assert.deepEqual(go, ["go:cash", "go:taxTrap"]);
  assert.match(said(o.parts), /as the areas you're here for/);
  assert.match(said(o.parts), /So, where would you like to start\?/);
  assert.match(said(picksParts({}, ["cash", "taxTrap"])), /where would you like to start\?/);
  for (const parts of [o.parts, open({}).parts, open(ANSWERED).parts]) {
    assert.doesNotMatch(said(parts), /start with|we recommend|you should|advice|plan\b/i);
  }
});

test("returning: answered modules, largest £ first; a locked one shows no £", () => {
  const d = ANSWERED;
  const rows = answeredRows(d, calcMetrics(d), statuses(d));
  assert.deepEqual(rows.map(r => r.key).sort(), ["cash", "pension"]);
  for (let i = 1; i < rows.length; i++) assert.ok((rows[i - 1].amount ?? -1) >= (rows[i].amount ?? -1));
  const locked = answeredRows(d, calcMetrics(d), statuses(d), k => k === "pension");
  const p = locked.find(r => r.key === "pension");
  assert.equal(p.amount, null);
  assert.equal(locked[locked.length - 1].key, "pension");
  const o = open(d);
  assert.ok(o.parts.some(x => x.rows));
  assert.match(said(o.parts), /Still on your list: \*\*Student loan\*\*/);
  assert.deepEqual(o.replies.items[0], ["Student loan next", "go:studentLoan"]);
});

test("every reply offered leads somewhere", () => {
  for (const d of [{}, { interests: ["cash", "kids"] }, ANSWERED]) {
    const r = open(d).replies;
    if (r.kind === "next") for (const [label, id] of r.items) assert.ok(leads(id), `${label} -> ${id}`);
    for (const key of ["cash", "taxTrap", "kids"]) for (const [label, id] of nextReplies(d, key).items) assert.ok(leads(id), `${label} -> ${id}`);
    for (const [label, id] of elseReplies(d).items) assert.ok(leads(id), `${label} -> ${id}`);
  }
});

test("a module without a quick start hands over to its own questions", () => {
  const parts = moduleIntro({}, calcMetrics({}), "investments");
  assert.deepEqual(parts[parts.length - 1], { module: "investments" });
});

test("a question two modules share is asked once", () => {
  const d = {};
  const m = calcMetrics(d);
  // Pension asks pay; once its answers are in, the tax trap doesn't.
  assert.equal(nextQuestion(CHAT_QUICK.pension, d, m, {}), "employment");
  const after = { ...d, ...CHAT_QUICK.pension.patch(d, m, { employment: "employed", salary: "80-100", age: "35-44", payIn: "no" }) };
  const asked = [];
  let q = nextQuestion(CHAT_QUICK.taxTrap, after, calcMetrics(after), {});
  while (q) { asked.push(q); q = nextQuestion(CHAT_QUICK.taxTrap, after, calcMetrics(after), { [q]: "x" }, q); }
  assert.ok(!asked.includes("employment") && !asked.includes("salary") && !asked.includes("payIn"), asked.join());
});

test("the user's reply reads as they'd say it", () => {
  const q = CHAT_QUICK.taxTrap.questions;
  const ctx = { d: {}, m: calcMetrics({}), a: {} };
  assert.equal(answerLabel(q.salary, ctx, "100-110"), "£100k–£110k");
  assert.equal(answerLabel(q.mine, ctx, "8"), "8%");
  assert.equal(answerLabel(q.mine, ctx, "unsure"), "Not sure");
});

test("a module's answer: its row, the way in, and everything once the list is done", () => {
  const d = { ...ANSWERED, interests: ["cash", "pension"] };
  const parts = resultParts(d, calcMetrics(d), statuses(d), "pension");
  assert.ok(parts.some(p => p.module === "pension"));
  assert.equal(parts.filter(p => p.rows).length, 2, "its own row, then all of them");
  const locked = resultParts(d, calcMetrics(d), statuses(d), "pension", k => k === "pension");
  assert.ok(!locked.some(p => p.rows?.some(r => r.key === "pension" && r.amount != null)));
});

test("Just exploring leads to no module", () => {
  assert.deepEqual(areasPicked(["exploring"]).modules, []);
  assert.deepEqual(areasPicked(["retirement", "cash"]).modules, ["pension", "cash"]);
  assert.equal(listOf(["A", "B", "C"]), "A, B and C");
});

test("a typed figure: as people write it, or nothing when it's words", () => {
  assert.equal(parseFigure("£52,000"), 52000);
  assert.equal(parseFigure("52k"), 52000);
  assert.equal(parseFigure("about 1.8k a month"), 1800);
  assert.equal(parseFigure("105k a year before tax"), 105000);
  assert.equal(parseFigure("what is the tax trap?"), null);
  assert.equal(parseFigure("2 kids"), null);
});

test("a typed figure takes its band for what follows, and its own figure for the answer", () => {
  const ctx = { d: {}, m: calcMetrics({}), a: {}, direct: true };
  const q = CHAT_QUICK.taxTrap.questions;
  assert.equal(bandFor(q.salary, ctx, 104000), "100-110");
  assert.equal(bandFor(q.salary, ctx, 60000), "u80");
  assert.equal(bandFor(q.bonus, ctx, 0), "none");
  assert.equal(bandFor(CHAT_QUICK.cash.questions.savings, ctx, 8000), "5-10");
  const d = {};
  const a = { employment: "employed", salary: "100-110", bonus: "none", payIn: "no", under12: "0" };
  const p = { ...d, ...chatPatch(CHAT_QUICK.taxTrap, d, calcMetrics(d), a, { salary: 104000 }) };
  assert.equal(p.salary, "104000");
  // Their own figure isn't an estimate.
  assert.doesNotMatch(estimateLineFor(p, "taxTrap") || "", /salary/);
  const c = { ...d, ...chatPatch(CHAT_QUICK.cash, d, calcMetrics(d), { savings: "5-10", rate: "2-3" }, { savings: 8000 }) };
  assert.equal(c.cashTiers[0].amount, "8000");
  assert.equal(c.cashTiers[0].rate, "2.5");
});

test("the questions read as a conversation: a word back, where they are, and a nudge to type", () => {
  const d = {}, m = calcMetrics(d);
  const q = (qid, a, opts) => questionParts(CHAT_QUICK.cash, qid, d, m, a, opts);
  assert.match(q("rate", { savings: "5-10" }, { prev: "savings" })[0].text, /^Looks like you've been saving well/);
  assert.match(q("costs", { savings: "u1", rate: "2-3" }, { prev: "rate" })[0].text, /^Got it\. /);
  assert.match(q("savings", {})[0].text, /^So, to start: roughly how much/);
  // Costs then the emergency fund: "Nearly there" before the costs, "Last
  // one" on the fund (no ISA question for under £1k).
  assert.match(q("costs", { savings: "u1", rate: "2-3" }, { prev: "rate" })[0].text, /Nearly there\./);
  assert.match(q("buffer", { savings: "u1", rate: "2-3", costs: "1-1.5" }, { prev: "costs" })[0].text, /Last one for Cash & savings: how many months/);
  // Not "Last one" while an answer could still bring a follow-up.
  const trap = questionParts(CHAT_QUICK.taxTrap, "under12", d, m, { employment: "employed", salary: "100-110", bonus: "none", payIn: "no" }, { prev: "payIn" });
  assert.doesNotMatch(trap[0].text, /last one|final question/i);
  const nudged = q("costs", { savings: "u1", rate: "2-3" }, { prev: "rate", nudge: true });
  assert.equal(nudged.length, 3);
  assert.match(nudged[1].text, /actual figure/);
  assert.match(lastWord("pot", "unsure"), /^No problem, I'll estimate it from your age and pay\. That's everything I need\./);
  const intro = said(moduleIntro(d, m, "cash"));
  assert.match(intro, /how much yours could be losing a year/);
  assert.match(intro, /type the real figure in the chat below/);
  for (const key of Object.keys(CHAT_QUICK)) assert.doesNotMatch(said(moduleIntro(d, m, key)), /start with|we recommend|you should|advice/i);
});

test("Candid's phrases cycle, so the same one never comes twice running", () => {
  const say = makeVoice(3);
  const acks = Array.from({ length: VOICE.ack.length * 2 }, () => say("ack"));
  for (let i = 1; i < acks.length; i++) assert.notEqual(acks[i], acks[i - 1]);
  assert.equal(new Set(acks).size, VOICE.ack.length);
  for (const list of Object.values(VOICE)) for (const line of list) assert.doesNotMatch(line, /start with|we recommend|you should|advice|people like you/i);
});

test("band tiles read short: <£1k, £1k–£2.5k, 4%+", () => {
  assert.equal(tileLabel("Under £1k"), "<£1k");
  assert.equal(tileLabel("£1k to £2.5k"), "£1k–£2.5k");
  assert.equal(tileLabel("£100k or more"), "£100k+");
  assert.equal(tileLabel("Over £125k"), "£125k+");
  assert.equal(tileLabel("1% to 2%"), "1%–2%");
  assert.equal(tileLabel("4% or more"), "4%+");
  assert.equal(tileLabel("Not sure"), "Not sure");
  assert.equal(tileLabel("35 to 44"), "35 to 44");
});

test("typed replies: a range isn't a figure, the period is read, and a tile's words answer it", () => {
  assert.equal(parseFigure("£50-60k"), null);
  assert.equal(parseFigure("40k-ish"), 40000);
  assert.equal(periodOf("£4,000 a month"), "month");
  assert.equal(periodOf("52k pa"), "year");
  assert.equal(periodOf("£52,000"), null);
  const ctx = { d: {}, m: calcMetrics({}), a: {}, direct: true };
  assert.equal(tileFor(CHAT_QUICK.pension.questions.payIn, ctx, "Yes"), "yes");
  assert.equal(tileFor(CHAT_QUICK.pension.questions.payIn, ctx, "not sure."), "unsure");
  assert.equal(tileFor(CHAT_QUICK.cash.questions.savings, ctx, "£5k-£10k"), "5-10", "typed with a hyphen, the band");
  assert.equal(tileFor(CHAT_QUICK.cash.questions.savings, ctx, "£5k–£10k"), "5-10");
  assert.equal(tileFor(CHAT_QUICK.pension.questions.payIn, ctx, "my pension"), null);
});

test("a module with nothing left to ask says so, not that questions are coming", () => {
  const d = { employmentStatus: "employed", employmentAsked: true, salary: "105000", hasExtraIncome: "no", pensionStatus: "yes", myContribution: "5", pensionType: "sacrifice", kidsStatus: "no" };
  assert.match(said(moduleIntro(d, calcMetrics(d), "taxTrap")), /already got what I need/);
  assert.deepEqual(pickReplies(["cash", "pension"]).items.map(([, id]) => id), ["go:cash", "go:pension", "ask"]);
});
