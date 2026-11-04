import { test } from "node:test";
import assert from "node:assert/strict";
import { answerState, aboutState, tileCounts, firstGap, modulesUsing, estimatedFields } from "./inputState.js";
import { MODULE_GUIDES, flatQuestions } from "./moduleGuide.js";
import { calcMetrics } from "./metrics.js";

const q = (module, field) => flatQuestions(MODULE_GUIDES[module].questions).find(x => x.field === field);
const state = (module, field, d) => answerState(q(module, field), { d, m: calcMetrics(d) }, estimatedFields(d));

test("a quick-start band is an estimate until they change it", () => {
  const d = { pensionStatus: "yes", potValue: "30000", quickEstimates: { pension: { items: [{ phrase: "£30k", field: "potValue", value: "30000" }] } } };
  assert.equal(state("pension", "potValue", d), "estimate");
  assert.equal(state("pension", "potValue", { ...d, potValue: "31000" }), "actual");
});

test("empty is a blank, and 0 is an answer", () => {
  const d = { pensionStatus: "yes", potValue: "" };
  assert.equal(state("pension", "potValue", d), "empty");
  assert.equal(state("pension", "potValue", { ...d, potValue: "0" }), "actual");
  assert.equal(state("pension", "potValue", { ...d, potValue: 0 }), "actual");
});

test("a default shown in the field is an estimate", () => {
  assert.equal(state("pension", "statePensionAmount", { age: "67", statePensionAmount: "" }), "estimate");
  assert.equal(state("pension", "statePensionAmount", { age: "67", statePensionAmount: "9000" }), "actual");
});

test("a loan balance left to Candid is an estimate", () => {
  assert.equal(state("studentLoan", "loanBalance", { loanBalance: "", slBalanceEstimate: "yes" }), "estimate");
  assert.equal(state("studentLoan", "loanBalance", { loanBalance: "" }), "empty");
});

test("None saves a blank, and that's their answer", () => {
  assert.equal(state("cash", "isaPrevCash", { isaPrevCash: "" }), "actual");
});

test("cash accounts: empty until one has money in and a rate", () => {
  const cq = flatQuestions(MODULE_GUIDES.cash.questions).find(x => x.render === "cashAccounts");
  const at = d => answerState(cq, { d, m: calcMetrics(d) }, estimatedFields(d));
  assert.equal(at({ cashTiers: [{ name: "", amount: "" }] }), "empty");
  assert.equal(at({ cashTiers: [{ name: "Easy access", amount: "5000", rate: "4" }] }), "actual");
  assert.equal(at({ cashTiers: [{ name: "Easy access", amount: "5000", rate: "" }] }), "empty", "money in, no rate");
});

test("tile counts and the first gap", () => {
  const d = { pensionStatus: "yes", potValue: "", myContribution: "5", employerMatch: "3", quickEstimates: { pension: { items: [{ phrase: "5%", field: "myContribution", value: "5" }] } } };
  const ctx = { d, m: calcMetrics(d) };
  const counts = tileCounts("pension", ctx);
  assert.ok(counts.estimate >= 1 && counts.empty >= 1);
  assert.equal(firstGap("pension", ctx), "myContribution");
});

test("About you: employment shown as Employed until they say", () => {
  const none = new Set();
  assert.equal(aboutState("employmentStatus", {}, none), "estimate");
  assert.equal(aboutState("employmentStatus", { employmentAsked: true }, none), "actual");
  assert.equal(aboutState("salary", {}, none), "empty");
  assert.equal(aboutState("salary", { employmentStatus: "not_working" }, none), "actual");
  assert.equal(aboutState("bonusAmount", {}, none), "actual");
  assert.equal(aboutState("salary", { salary: "40000" }, new Set(["salary"])), "estimate");
});

test("salary is used by every module that asks it, and only those on screen", () => {
  assert.deepEqual(modulesUsing("salary", ["cash", "pension", "studentLoan"]), ["cash", "pension", "studentLoan"]);
  assert.deepEqual(modulesUsing("age", ["cash", "pension"]), ["pension"]);
  assert.deepEqual(modulesUsing("monthlyExpenses", ["pension"]), []);
});

test("About you: counts and the first gap, as far as each field shows", () => {
  const d = { name: "Jo", email: "jo@example.com", employmentAsked: true, employmentStatus: "employed", salary: "40000", age: "", ukNation: "england", salaryTrajectory: "stable", monthlyExpenses: "1500" };
  const ctx = { d, m: calcMetrics(d) };
  assert.deepEqual(tileCounts("about", ctx), { estimate: 0, empty: 1 });
  assert.equal(firstGap("about", ctx), "age");
});

test("every answer on Edit inputs has a short label", async () => {
  const { SHORT_LABELS } = await import("./inputLabels.js");
  const missing = Object.values(MODULE_GUIDES).flatMap(({ questions }) => flatQuestions(questions))
    .filter(q => q.group !== "you" && q.kind !== "info" && !SHORT_LABELS[q.field]).map(q => q.field);
  assert.deepEqual([...new Set(missing)], []);
});
