import { test } from "node:test";
import assert from "node:assert/strict";
import { guessQuestions, GUESS_QUESTIONS, guessOutcome, guessBars, bandPoint, inBand, guessMoney, entryPatch, pendingComparisons, guessFigure, markShown, moduleGuess } from "./guesses.js";
import { modulesInView } from "./appEntry.js";
import { mergeAnswers } from "./mergeAnswers.js";
import { calcMetrics } from "./metrics.js";

const ids = picks => guessQuestions(picks).map(q => q.id);
const q = id => Object.values(GUESS_QUESTIONS).flat().find(x => x.id === id);
const bandIn = (id, label) => q(id).bands.find(b => b.label === label);

test("one module asks both its questions; several ask firsts, topped up to three", () => {
  assert.deepEqual(ids([]), []);
  assert.deepEqual(ids(["cash"]), ["cash:0", "cash:1"]);
  assert.deepEqual(ids(["property"]), ["property:0"]);
  assert.deepEqual(ids(["pension", "cash"]), ["cash:0", "pension:0", "cash:1"]);
  assert.deepEqual(ids(["property", "taxTrap"]), ["taxTrap:0", "property:0"]);
  assert.deepEqual(ids(["cash", "pension", "kids"]), ["cash:0", "pension:0", "kids:0"]);
  assert.deepEqual(ids(["property", "kids", "pension", "cash"]), ["cash:0", "pension:0", "kids:0"]);
});

test("bands run on from each other, and every question has four", () => {
  for (const x of Object.values(GUESS_QUESTIONS).flat()) {
    assert.equal(x.bands.length, 4, x.id);
    assert.equal(x.bands[0].lo, 0, x.id);
    assert.equal(x.bands[3].hi, undefined, x.id);
    for (let i = 1; i < 4; i++) assert.equal(x.bands[i].lo, x.bands[i - 1].hi, x.id);
  }
});

test("a band draws at its midpoint, or its lower limit when open-ended", () => {
  assert.equal(bandPoint({ lo: 100, hi: 250 }), 175);
  assert.equal(bandPoint({ lo: 500 }), 500);
  assert.ok(inBand({ lo: 500 }, 5000));
  assert.ok(inBand({ lo: 100, hi: 250 }, 100));
  assert.ok(!inBand({ lo: 100, hi: 250 }, 250));
});

test("the heading says the size; the question's direction says good or bad", () => {
  const lower = q("cash:0"), higher = q("pension:0");
  assert.deepEqual(guessOutcome(lower, bandIn("cash:0", "£100 to £250"), 180), { head: "About what you thought.", tone: "same" });
  assert.deepEqual(guessOutcome(lower, bandIn("cash:0", "£100 to £250"), 400), { head: "Bigger than you thought.", tone: "worse" });
  assert.deepEqual(guessOutcome(lower, bandIn("cash:0", "£100 to £250"), 40), { head: "Smaller than you thought.", tone: "better" });
  assert.deepEqual(guessOutcome(higher, bandIn("pension:0", "Under £250k"), 400000), { head: "Bigger than you thought.", tone: "better" });
  assert.deepEqual(guessOutcome(higher, bandIn("pension:0", "Over £1m"), 400000), { head: "Smaller than you thought.", tone: "worse" });
  // Open-ended: anything above the limit is what they said.
  assert.equal(guessOutcome(lower, bandIn("cash:0", "Over £500"), 9000).tone, "same");
});

test("the student loan total gets no verdict either way", () => {
  const total = q("studentLoan:1");
  assert.deepEqual(guessOutcome(total, bandIn("studentLoan:1", "Under £30k"), 61000), { head: "Bigger than you thought.", tone: "same" });
  assert.deepEqual(guessOutcome(total, bandIn("studentLoan:1", "Over £100k"), 61000), { head: "Smaller than you thought.", tone: "same" });
});

test("columns share a scale; nothing still shows a sliver", () => {
  assert.deepEqual(guessBars({ lo: 100, hi: 300 }, 400), { guess: 180, figure: 360 });
  assert.deepEqual(guessBars({ lo: 100, hi: 300 }, 0), { guess: 360, figure: 6 });
  assert.deepEqual(guessBars({ lo: 0, hi: 0 }, 0), { guess: 6, figure: 6 });
  // Within an open-ended band, the columns match the headline.
  assert.deepEqual(guessBars({ lo: 500 }, 9000), { guess: 360, figure: 360 });
  assert.deepEqual(guessBars({ lo: 500 }, 100), { guess: 360, figure: 72 });
});

test("figures read as they do beside each other", () => {
  assert.equal(guessMoney(1150), "£1,150");
  assert.equal(guessMoney(412345), "£412k");
  assert.equal(guessMoney(1234567), "£1.2m");
  assert.equal(guessMoney(999600), "£1.0m");
  assert.equal(guessMoney(600000, 1234567), "£0.6m");
});

test("what the entry saves", () => {
  const p = entryPatch({ worries: ["Tax"], goals: ["Safety net", "See the world"], other: true, picks: ["property", "cash"], answers: { "cash:0": "Over £500", "property:0": "Under £250k", "pension:0": "Over £1m" } });
  assert.deepEqual(p.interests, ["cash", "property"]);
  assert.deepEqual(p.financialGoals, ["emergency_fund", "see_world", "other", "buy_house"]);
  assert.deepEqual(p.entryWorries, ["Tax"]);
  // Pension isn't picked any more, so its answer goes.
  assert.deepEqual(p.guesses, { "cash:0": { band: "Over £500" }, "property:0": { band: "Under £250k" } });
  const e = entryPatch({ nosy: true, exploring: true });
  assert.deepEqual(e.interests, ["exploring"]);
  assert.deepEqual(e.financialGoals, ["exploring"]);
  assert.equal(e.guesses, null);
});

test("no stored guesses, nothing to compare (everyone from before the new entry)", () => {
  const d = { salary: "60000", age: "35", hasPension: "yes", myContribution: "5", employerMatch: "5", potValue: "20000" };
  const m = calcMetrics(d);
  assert.deepEqual(pendingComparisons("pension", d, m), []);
  assert.deepEqual(pendingComparisons("pension", { ...d, guesses: null }, m), []);
});

test("a stored guess compares once, and an unmatched band or missing figure is left out", () => {
  const d = { salary: "60000", age: "35", employmentStatus: "employed", hasPension: "yes", pensionKind: "dc", myContribution: "5", employerMatch: "5", employerContributionType: "fixed", potValue: "20000",
    guesses: { "pension:0": { band: "Under £250k" }, "pension:1": { band: "Gone" } } };
  const m = calcMetrics(d);
  const [c, ...rest] = pendingComparisons("pension", d, m);
  assert.deepEqual(rest, []);
  assert.equal(c.id, "pension:0");
  assert.equal(c.value, Math.round(m.projectedPot));
  const shown = { ...d, guesses: markShown(d.guesses, ["pension:0"]) };
  assert.deepEqual(pendingComparisons("pension", shown, m), []);
  // Rates not loaded: no Cash figure yet.
  assert.equal(guessFigure("cash:0", {}, calcMetrics({})), null);
});

test("a guess survives signing in on another device", () => {
  const device = { guesses: { "cash:0": { band: "Over £500" } } };
  assert.deepEqual(mergeAnswers({ guesses: null, interests: [] }, device).guesses, device.guesses);
});

test("a first-module card shows the module's first guess", () => {
  assert.equal(moduleGuess("cash", { "cash:1": "£500 to £1k" }), "£500 to £1k");
  assert.equal(moduleGuess("cash", {}), null);
});

test("the £100k trap counts as offered once picked, whatever the pay", () => {
  assert.ok(!modulesInView({ salary: "60000" }).includes("taxTrap"));
  assert.ok(modulesInView({ salary: "60000", interests: ["taxTrap"] }).includes("taxTrap"));
});
