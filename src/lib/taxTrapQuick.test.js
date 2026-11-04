import { test } from "node:test";
import assert from "node:assert/strict";
import { questionOrder, estimateLineFor } from "./quickStart.js";
import { TAX_TRAP_QUICK } from "./taxTrapQuick.js";
import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses } from "./moduleStatus.js";

const order = (d, a = {}) => questionOrder(TAX_TRAP_QUICK, { d, m: calcMetrics(d), a, direct: true });
const apply = (d, a) => ({ ...d, ...TAX_TRAP_QUICK.patch(d, calcMetrics(d), a) });

test("tax trap: from nothing, pay, bonus, pension and children; follow-ups only where they apply", () => {
  assert.deepEqual(order({}), ["employment", "salary", "bonus", "payIn", "under12"]);
  assert.deepEqual(order({}, { payIn: "yes" }), ["employment", "salary", "bonus", "payIn", "mine", "route", "under12"]);
  assert.ok(!order({}, { employment: "self_employed", payIn: "yes" }).includes("route"), "the self-employed pay from take-home");
  assert.ok(order({}, { under12: "2" }).includes("preschool"));
  assert.ok(!order({}, { under12: "0" }).includes("preschool"));
});

test("tax trap: nothing another module has answered is asked again", () => {
  const d = { employmentStatus: "employed", employmentAsked: true, salary: "105000", hasExtraIncome: "no", pensionStatus: "yes", myContribution: "5", pensionType: "sacrifice", kidsStatus: "no" };
  assert.deepEqual(order(d), []);
});

test("tax trap: the answers write the module's own fields, marked as estimates", () => {
  const d = apply({}, { employment: "employed", salary: "110-125", bonus: "5-15", payIn: "yes", mine: "unsure", route: "sacrifice", under12: "2", preschool: "no" });
  assert.equal(d.salary, "117500");
  assert.equal(d.bonusAmount, "10000");
  assert.deepEqual(d.extraIncomeKinds, ["bonus"]);
  assert.equal(d.myContribution, "5");
  assert.equal(d.pensionType, "sacrifice");
  assert.equal(d.hasPension, "yes");
  assert.deepEqual([d.kidsStatus, d.kidsCount, d.kidsPreschool, d.kidsSchool], ["yes", "2", "1", "1"]);
  assert.ok(d.askedFields.includes("pensionStatus"));
  const line = estimateLineFor(d, "taxTrap");
  assert.match(line, /£110k to £125k salary/);
  assert.match(line, /legal minimum/);
});

test("tax trap: in the trap, the module gives a figure from the chat's answers", () => {
  const d = { ...apply({}, { employment: "employed", salary: "110-125", bonus: "none", payIn: "no", under12: "0" }), selectedModules: ["taxTrap"] };
  const s = computeModuleStatuses(d, calcMetrics(d));
  assert.ok(s.taxTrap.amount > 0, JSON.stringify(s.taxTrap));
});

test("tax trap: a final salary scheme is written as one, with no percentage or route asked", () => {
  assert.deepEqual(order({}, { payIn: "db" }), ["employment", "salary", "bonus", "payIn", "under12"]);
  const d = apply({}, { employment: "employed", salary: "100-110", bonus: "none", payIn: "db", under12: "0" });
  assert.deepEqual([d.pensionStatus, d.hasPension, d.pensionKind], ["db", "yes", "db"]);
});
