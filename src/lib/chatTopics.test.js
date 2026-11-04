import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { MODULE_META, HIDDEN_MVP_MODULE_KEYS } from "./moduleStatus.js";
import {
  TOPICS, WINDFALL, starters, matchTopic, wantsLead, answerParts, topicFigures,
  ratesFigures, impactFigures, childcareFigures, boldRuns, greeting,
} from "./chatTopics.js";

const RICH = {
  salary: "110000", myContribution: "5", pensionType: "sacrifice", employmentStatus: "employed", ukNation: "england",
  kidsStatus: "yes", kidsCount: "2", kidsPreschool: "1", kidsSchool: "1", childcareMonthly: "1500",
};

test("every follow-up and starter leads somewhere", () => {
  const ids = new Set([...Object.keys(TOPICS), WINDFALL]);
  for (const [id, t] of Object.entries(TOPICS)) {
    for (const [label, next] of t.next) assert.ok(ids.has(next), `${id}: "${label}" -> ${next}`);
  }
  for (const [, id] of starters({})) assert.ok(ids.has(id), id);
});

test("module buttons go to modules that exist and aren't hidden", () => {
  for (const [id, t] of Object.entries(TOPICS)) {
    if (!t.module) continue;
    assert.ok(MODULE_META.some(mm => mm.key === t.module), `${id}: ${t.module}`);
    assert.ok(!HIDDEN_MVP_MODULE_KEYS.includes(t.module), `${id}: ${t.module} is hidden`);
  }
});

test("typed questions find their topic", () => {
  assert.equal(matchTopic("what is the £100k tax trap"), "taper");
  assert.equal(matchTopic("how can I avoid the tax trap"), "lowers");
  assert.equal(matchTopic("Show me how a £350/mo pension contribution changes my take-home pay"), "impact");
  assert.equal(matchTopic("salary sacrifice vs personal pension contributions?"), "versus");
  assert.equal(matchTopic("Do I lose 30 hours childcare?"), "childcare");
  assert.equal(matchTopic("I've just inherited some money"), WINDFALL);
  assert.equal(matchTopic("what's the weather"), "fallback");
  // Specific topics before the general "what lowers it".
  assert.equal(matchTopic("Will £350 a month reduce my take-home?"), "impact");
  assert.equal(matchTopic("Does salary sacrifice lower my tax?"), "versus");
  assert.equal(matchTopic("How do I reduce childcare costs"), "childcare");
  assert.equal(matchTopic("my heartbeat and flowers"), "fallback");
  assert.ok(wantsLead("how can I avoid the tax trap"));
  assert.ok(!wantsLead("what lowers it?"));
});

test("the avoid question opens with the neutral line, then the list and the module", () => {
  const parts = answerParts("lowers", topicFigures(RICH, calcMetrics(RICH)), { lead: true });
  assert.equal(parts[0].text, TOPICS.lowers.lead);
  assert.deepEqual(parts[1], { visual: "lowers" });
  assert.deepEqual(parts.at(-1), { module: "pension" });
});

test("figures use the user's own pay, or a marked example without one", () => {
  const m = calcMetrics(RICH);
  const rates = ratesFigures(RICH, m);
  assert.equal(rates.example, false);
  assert.deepEqual(rates.bars.map(b => b.pence), [28, 42, 62, 47]);
  assert.equal(rates.band, 2);
  assert.equal(rates.trapKeeps, 38);

  const impact = impactFigures(RICH, m, 350);
  assert.equal(impact.example, false);
  assert.equal(impact.takeHomeMonthly, 133);
  assert.equal(impact.allowanceBack, 2100);

  const cc = childcareFigures(RICH, m);
  assert.equal(cc.example, false);
  assert.equal(cc.over, true);
  assert.equal(cc.gap, 4500);

  const empty = {};
  const me = calcMetrics(empty);
  assert.equal(ratesFigures(empty, me).example, true);
  assert.equal(impactFigures(empty, me, 350).salary, 110000);
  assert.equal(childcareFigures(empty, me).gap, 10000);
});

test("no children told: childcare shows the example, marked", () => {
  const noKids = { ...RICH, kidsStatus: "no" };
  assert.equal(childcareFigures(noKids, calcMetrics(noKids)).example, true);
});

test("Scotland's bands make a different trap rate", () => {
  const sc = { ...RICH, ukNation: "scotland", scottishTaxpayer: "yes" };
  assert.ok(ratesFigures(sc, calcMetrics(sc)).trapKeeps < 38);
});

test("the highlighted bar is the rate they pay, or none", () => {
  const sc = { ...RICH, salary: "45000", myContribution: "0", ukNation: "scotland", scottishTaxpayer: "yes" };
  const f = ratesFigures(sc, calcMetrics(sc));
  assert.ok(f.own > 40, `Scottish higher rate at £45k: ${f.own}p`);
  assert.ok(f.band === -1 || f.bars[f.band].pence === f.own);
  const low = { ...RICH, salary: "10000", myContribution: "0" };
  const g = ratesFigures(low, calcMetrics(low));
  assert.equal(g.own, 0);
  assert.equal(g.band, -1);
});

test("the self-employed see a personal contribution, not salary sacrifice", () => {
  const se = { ...RICH, employmentStatus: "self_employed" };
  const f = impactFigures(se, calcMetrics(se), 350);
  assert.equal(f.route, "relief");
  assert.match(answerParts("impact", topicFigures(se, calcMetrics(se)))[0].text, /personal pension/);
  assert.equal(impactFigures(RICH, calcMetrics(RICH), 350).route, "sacrifice");
});

test("funded hours are England's rule only", () => {
  const wales = { ...RICH, ukNation: "wales" };
  assert.equal(childcareFigures(wales, calcMetrics(wales)).hoursRule, false);
  assert.equal(childcareFigures(RICH, calcMetrics(RICH)).hoursRule, true);
});

test("a lump sum is picked up only where WindfallChat would welcome them back", () => {
  assert.equal(starters({ windfall: { amount: 20000, earmark: "none", split: { isa: 1000 } } }).at(-1)[0], "Pick up your lump sum");
  assert.equal(starters({ windfall: { amount: 20000, split: {} } }).at(-1)[0], "I've got a lump sum");
  assert.equal(starters({}).at(-1)[0], "I've got a lump sum");
});

test("copy stays guidance: no directive or advice words", () => {
  const f = topicFigures(RICH, calcMetrics(RICH));
  const words = [...greeting({ name: "Sam Smith" })];
  for (const id of Object.keys(TOPICS)) {
    for (const p of answerParts(id, f, { lead: true })) if (p.text) words.push(p.text);
    if (TOPICS[id].plain) words.push(TOPICS[id].plain);
    for (const [label] of TOPICS[id].next) words.push(label);
  }
  for (const w of words) assert.doesNotMatch(w, /\b(should|advice|advise|recommend|tailored|action plan)\b/i, w);
});

test("bold markers become runs", () => {
  assert.deepEqual(boldRuns("Above **£100,000**, it shrinks"), [
    { text: "Above ", bold: false }, { text: "£100,000", bold: true }, { text: ", it shrinks", bold: false },
  ]);
});

test("the opening says hello by first name, or without one", () => {
  assert.equal(greeting({ name: "Sam Smith" })[0], "Hello, Sam.");
  assert.equal(greeting({})[0], "Hello.");
  assert.match(greeting({}).at(-1), /^Ask me a question about/);
});
