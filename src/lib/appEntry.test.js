import { test } from "node:test";
import assert from "node:assert/strict";
import { entryGoals, appUnlocked, moduleDone, moduleOrder, DEFAULT_FIRST_MODULE, START_MODULES, ENTRY_QUESTIONS, CONFIDENCE_QUESTION,
  doneModules, scoreUnlocked, goalsWith, unfinishedPicks, notStarted } from "./appEntry.js";

test("entry picks set the goals they imply", () => {
  assert.deepEqual(entryGoals(["cash", "pension", "property"]), ["emergency_fund", "buy_house"]);
  assert.deepEqual(entryGoals(["investments"]), []);
  assert.deepEqual(entryGoals(["exploring"]), ["exploring"]);
});

test("the entry asks two questions, each with a short reason", () => {
  assert.deepEqual(ENTRY_QUESTIONS.map(q => q.id), ["interests", "name"]);
  for (const q of ENTRY_QUESTIONS) assert.ok(q.why().split(/\s+/).length <= 15, q.id);
  assert.deepEqual(ENTRY_QUESTIONS[0].also(["property"]), { financialGoals: ["buy_house"] });
});

test("the score appears once every pick is answered; for just exploring, after the first module", () => {
  assert.equal(scoreUnlocked({ interests: ["cash", "pension"], selectedModules: ["cash"] }), false);
  assert.equal(scoreUnlocked({ interests: ["cash", "pension"], selectedModules: ["cash", "pension"] }), true);
  assert.equal(scoreUnlocked({ interests: ["cash", "property"], selectedModules: ["cash"] }), false);
  assert.equal(scoreUnlocked({ interests: ["cash", "property"], selectedModules: ["cash"] }, true), true);
  assert.equal(scoreUnlocked({ interests: ["exploring"], selectedModules: [] }), false);
  assert.equal(scoreUnlocked({ interests: ["exploring"], selectedModules: ["investments"] }), true);
  assert.deepEqual(doneModules({ selectedModules: ["studentLoan", "cash"] }, true), ["cash", "studentLoan", "property"]);
});

test("picks not answered yet stay on home until they are", () => {
  const d = { interests: ["cash", "studentLoan", "property"], selectedModules: ["cash"] };
  assert.deepEqual(unfinishedPicks(d), ["studentLoan", "property"]);
  assert.deepEqual(unfinishedPicks(d, true), ["studentLoan"]);
  assert.deepEqual(unfinishedPicks({ ...d, selectedModules: ["cash", "studentLoan"] }, true), []);
});

test("the Modules tab lists every module not answered, picks first", () => {
  assert.deepEqual(notStarted({ interests: ["studentLoan"], selectedModules: ["pension"] }), ["studentLoan", "cash", "investments", "property"]);
});

test("goals add to the entry's goals; none of these adds nothing", () => {
  assert.deepEqual(goalsWith(["property"], ["big_purchase"]), ["buy_house", "big_purchase"]);
  assert.deepEqual(goalsWith(["exploring"], ["consolidate"]), ["consolidate"]);
  assert.deepEqual(goalsWith(["cash"], ["none"]), ["emergency_fund"]);
});

test("the confidence check keeps the 1 to 5 scale its saved scores use", () => {
  assert.deepEqual(CONFIDENCE_QUESTION.options().map(o => o.value), ["1", "2", "3", "4", "5"]);
  assert.ok(CONFIDENCE_QUESTION.why().split(/\s+/).length <= 15);
});

test("the app opens with a report, or after the two-question entry", () => {
  assert.equal(appUnlocked({}, null), false);
  assert.equal(appUnlocked({}, { score: 60 }), true);
  assert.equal(appUnlocked({ appEntered: true }, null), true);
});

test("a module is done once it's selected; Property once its first step is complete", () => {
  const d = { selectedModules: ["cash"] };
  assert.equal(moduleDone("cash", d), true);
  assert.equal(moduleDone("pension", d), false);
  assert.equal(moduleDone("property", d), false);
  assert.equal(moduleDone("property", d, true), true);
});

test("picks come first in the order offered, then the rest", () => {
  assert.deepEqual(moduleOrder({ interests: ["studentLoan", "cash"] }),
    ["cash", "studentLoan", "pension", "investments", "property"]);
});

test("just exploring leads with the module most people start with", () => {
  const order = moduleOrder({ interests: ["exploring"] });
  assert.equal(order[0], DEFAULT_FIRST_MODULE);
  assert.deepEqual([...order].sort(), [...START_MODULES].sort());
});
