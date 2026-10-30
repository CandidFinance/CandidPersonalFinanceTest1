import { test } from "node:test";
import assert from "node:assert/strict";
import { finishBands, quickQuestions, quickPatch, estimatedNow, estimateLine, helperChoicePlan } from "./studentLoanQuick.js";
import { calcMetrics } from "./metrics.js";
import { rollLoanBalances } from "./loanBalance.js";

test("asks only what Candid doesn't have yet", () => {
  assert.deepEqual(quickQuestions({}), ["plan", "salary", "balance", "finish"]);
  assert.deepEqual(quickQuestions({ studentLoan: "none", loanBalance: "" }), ["plan", "salary", "balance", "finish"]);
  assert.deepEqual(quickQuestions({ studentLoan: "plan2", salary: "40000" }), ["balance", "finish"]);
  assert.deepEqual(quickQuestions({ slBalanceEstimate: "yes" }), ["plan", "salary", "finish"]);
});

test("finish bands stay inside the plan's years", () => {
  const plan2 = finishBands("plan2", 2026);
  assert.ok(!plan2.some(b => b.value === "pre2015"), "Plan 2 started with 2012 courses");
  for (const b of plan2) assert.ok(b.figure >= 2015 && b.figure <= 2029);
  const plan5 = finishBands("plan5", 2026).map(b => b.value);
  assert.deepEqual(plan5, ["2024on", "studying"]);
  assert.equal(finishBands("plan5", 2026)[0].figure, 2025);
});

test("the plan helper follows GOV.UK's rules", () => {
  assert.equal(helperChoicePlan("pre2012"), "plan1");
  assert.equal(helperChoicePlan("2012to2023"), "plan2");
  assert.equal(helperChoicePlan("2023on"), "plan5");
  assert.equal(helperChoicePlan("scotland"), "plan4");
  assert.equal(helperChoicePlan("ni"), "plan1");
  assert.equal(helperChoicePlan("postgrad"), "postgrad");
});

test("bands become the figures the calculations read", () => {
  const p = quickPatch({}, { plan: "plan2", salary: "35-45", balance: "40-60", finish: "2015-19" }, 2026);
  assert.equal(p.studentLoan, "plan2");
  assert.equal(p.salary, "40000");
  assert.equal(p.loanBalance, "50000");
  assert.equal(p.slFinishYear, "2017");
  assert.equal(p.slFirstDueYear, "2018");
  assert.equal(p.employmentStatus, "employed");
  assert.equal(p.salaryTrajectory, "moderate");
  const m = calcMetrics({ ...p, studentLoan: "plan2" });
  assert.ok(m.loanBal > 0);
});

test("answers already given aren't overwritten by assumptions", () => {
  const p = quickPatch({ employmentStatus: "self_employed", salaryTrajectory: "high" }, { plan: "plan1" }, 2026);
  assert.equal(p.employmentStatus, undefined);
  assert.equal(p.salaryTrajectory, undefined);
});

test("not sure of the balance uses Candid's estimate from a typical course", () => {
  const p = quickPatch({}, { plan: "unsure", helper: "2012to2023", salary: "25-35", balance: "unsure", finish: "2020-23" }, 2026);
  assert.equal(p.studentLoan, "plan2");
  assert.equal(p.slBalanceEstimate, "yes");
  assert.equal(p.slStudyYears, "3");
  assert.equal(p.loanBalance, "");
});

test("the estimate line names the bands still in use, and drops any changed since", () => {
  const p = quickPatch({}, { plan: "plan2", salary: "35-45", balance: "40-60", finish: "2015-19" }, 2026);
  assert.equal(estimateLine(p), "Based on estimates: £35k to £45k salary, £40k to £60k owed, finished 2015 to 2019.");
  const edited = { ...p, salary: "41250" };
  assert.deepEqual(estimatedNow(edited).map(e => e.key), ["balance", "finish"]);
  assert.equal(estimateLine({ ...edited, loanBalance: "47000", slFinishYear: "2018" }), null);
  assert.equal(estimateLine({}), null);
});

test("a band balance rolled on by payday stays an estimate until the user types one", () => {
  const p = quickPatch({}, { plan: "plan2", salary: "35-45", balance: "40-60", finish: "2015-19" }, 2026);
  const start = { ...p, ...rollLoanBalances(p, new Date(2026, 9, 15)) };
  const rolled = { ...start, ...rollLoanBalances(start, new Date(2026, 11, 5)) };
  assert.notEqual(rolled.loanBalance, p.loanBalance);
  assert.ok(estimatedNow(rolled).some(e => e.key === "balance"));
  // Typed in since: theirs from now on, and the next roll leaves it so.
  const typed = { ...rolled, loanBalance: "47000" };
  const next = { ...typed, ...rollLoanBalances(typed, new Date(2026, 11, 6)) };
  assert.ok(!estimatedNow(next).some(e => e.key === "balance"));
  const later = { ...next, ...rollLoanBalances(next, new Date(2027, 1, 5)) };
  assert.ok(!estimatedNow(later).some(e => e.key === "balance"));
});
