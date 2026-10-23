import { test } from "node:test";
import assert from "node:assert/strict";
import { entryGoals, pickedModules, appUnlocked, moduleDone, moduleOrder, DEFAULT_FIRST_MODULE, START_MODULES, ENTRY_QUESTIONS, CONFIDENCE_QUESTION, readingMs,
  doneModules, scoreUnlocked, goalsWith, unfinishedPicks, notStarted, firstPick, modulePath, modulesInView, dormantModules, isNewModule, worthALookShown } from "./appEntry.js";

test("entry picks set the goals they imply", () => {
  assert.deepEqual(entryGoals(["cash", "pension", "property"]), ["emergency_fund", "buy_house"]);
  assert.deepEqual(entryGoals(["investments"]), []);
  assert.deepEqual(entryGoals(["exploring"]), ["exploring"]);
});

test("the entry asks one question, interests, with a short reason (name comes with the email, confidence after the first answer)", () => {
  assert.deepEqual(ENTRY_QUESTIONS.map(q => q.id), ["interests"]);
  for (const q of ENTRY_QUESTIONS) assert.ok(q.why().split(/\s+/).length <= 15, q.id);
  assert.deepEqual(ENTRY_QUESTIONS[0].also(["property"]), { financialGoals: ["buy_house"] });
  assert.equal(firstPick({ interests: ["cash", "retirement"] }), "pension");
  // Just exploring goes to Cash & savings, the tour module.
  assert.equal(firstPick({ interests: ["exploring"] }), "cash");
  assert.equal(modulePath("property"), "/app/property");
  assert.equal(CONFIDENCE_QUESTION.ask({ d: { name: " Sam " } }), "How confident do you feel about your finances, Sam?");
});

test("each message waits for the one before to be read, at 330 words a minute", () => {
  assert.equal(readingMs("one two three four five six seven eight nine ten"), 300 + 1818);
});

test("the score appears once every pick is answered; for just exploring, after the first module", () => {
  assert.equal(scoreUnlocked({ interests: ["cash", "pension"], selectedModules: ["cash"] }), false);
  assert.equal(scoreUnlocked({ interests: ["cash", "pension"], selectedModules: ["cash", "pension"] }), true);
  // Property isn't scored, so a Property pick never holds the score back.
  assert.equal(scoreUnlocked({ interests: ["cash", "property"], selectedModules: ["cash"] }), true);
  assert.equal(scoreUnlocked({ interests: ["cash", "pension", "property"], selectedModules: ["cash"] }, true), false);
  assert.equal(scoreUnlocked({ interests: ["exploring"], selectedModules: [] }), false);
  assert.equal(scoreUnlocked({ interests: ["exploring"], selectedModules: ["investments"] }), true);
  assert.deepEqual(doneModules({ selectedModules: ["studentLoan", "cash"] }, true), ["cash", "studentLoan", "property"]);
});

test("Property alone doesn't unlock the score: it isn't scored, so it would read 100 with nothing behind it", () => {
  assert.equal(scoreUnlocked({ interests: ["property"], selectedModules: [] }, true), false);
  assert.equal(scoreUnlocked({ interests: ["property"], selectedModules: ["pension"] }, true), true);
  assert.equal(scoreUnlocked({ interests: ["exploring"], selectedModules: [] }, true), false);
});

test("picks not answered yet stay on home until they are", () => {
  const d = { interests: ["cash", "studentLoan", "property"], selectedModules: ["cash"] };
  assert.deepEqual(unfinishedPicks(d), ["studentLoan", "property"]);
  assert.deepEqual(unfinishedPicks(d, true), ["studentLoan"]);
  assert.deepEqual(unfinishedPicks({ ...d, selectedModules: ["cash", "studentLoan"] }, true), []);
});

test("the Modules tab lists every module not answered, picks first", () => {
  assert.deepEqual(notStarted({ interests: ["studentLoan"], selectedModules: ["pension"] }), ["studentLoan", "cash", "investments", "kids", "property"]);
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

test("the app opens with a report, or after the entry", () => {
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
    ["cash", "studentLoan", "pension", "investments", "kids", "property"]);
});

test("just exploring leads with Cash & savings", () => {
  const order = moduleOrder({ interests: ["exploring"] });
  assert.equal(order[0], DEFAULT_FIRST_MODULE);
  assert.equal(DEFAULT_FIRST_MODULE, "cash");
  // The £100k tax trap only near or over £100,000.
  assert.deepEqual([...order].sort(), START_MODULES.filter(k => k !== "taxTrap").sort());
});

test("the £100k tax trap is offered near or over £100,000, or heading there, and once answered", () => {
  assert.ok(!modulesInView({ salary: "60000" }).includes("taxTrap"));
  assert.ok(modulesInView({ salary: "92000" }).includes("taxTrap"));
  assert.ok(modulesInView({ salary: "80000", bonusAmount: "15000" }).includes("taxTrap"));
  // £92,000 growing 5% a year passes £100,000 within three years.
  assert.ok(modulesInView({ salary: "87000", salaryTrajectory: "moderate" }).includes("taxTrap"));
  assert.ok(modulesInView({ salary: "60000", selectedModules: ["taxTrap"] }).includes("taxTrap"));
  // Not in view: shown greyed instead, until it is.
  assert.deepEqual(dormantModules({ salary: "60000" }), ["taxTrap"]);
  assert.deepEqual(dormantModules({ salary: "95000" }), []);
});

test("New modules wear their star for six weeks after launch", () => {
  assert.equal(isNewModule("taxTrap", new Date("2026-10-21")), true);
  assert.equal(isNewModule("taxTrap", new Date("2026-12-05")), false);
  assert.equal(isNewModule("cash", new Date("2026-10-21")), false);
});

test("Worth a look, dismissed, comes back only for a module it didn't hold", () => {
  assert.equal(worthALookShown({}, ["pension"]), true);
  assert.equal(worthALookShown({ worthALookDismissed: ["pension", "kids"] }, ["pension"]), false);
  assert.equal(worthALookShown({ worthALookDismissed: ["pension"] }, ["pension", "taxTrap"]), true);
});

test("Property never locks the score: picked at the entry, or set by a shared Property link", () => {
  // Two modules done, neither Property.
  assert.equal(scoreUnlocked({ interests: ["pension", "cash", "property"], selectedModules: ["pension", "cash"] }), true);
  // A shared Property link picks Property: the first scored module unlocks it.
  assert.equal(scoreUnlocked({ interests: ["property"], selectedModules: ["pension"] }), true);
  assert.equal(scoreUnlocked({ interests: ["property"], selectedModules: [] }), false);
  // Property is still left to do on home, just not in the score's way.
  assert.deepEqual(unfinishedPicks({ interests: ["pension", "cash", "property"], selectedModules: ["pension", "cash"] }), ["property"]);
});

test("retirement planning leads to the Pension module", () => {
  assert.deepEqual(pickedModules(["retirement", "cash"]), ["pension", "cash"]);
  assert.equal(moduleOrder({ interests: ["retirement"] })[0], "pension");
  assert.deepEqual(entryGoals(["retirement"]), ["retirement"]);
});
