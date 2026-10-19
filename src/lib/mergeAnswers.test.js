import test from "node:test";
import assert from "node:assert/strict";
import { mergeAnswers, mergeCompleted } from "./mergeAnswers.js";

test("signing in keeps answers given on this device that the account doesn't have", () => {
  const account = { name: "Harvey", employmentStatus: "employed", employmentAsked: true, age: "30", salary: "", askedFields: ["scottishTaxpayer"], answeredModules: ["cash"] };
  const device = { salary: "55000", myContribution: "5", askedFields: ["salary", "age"], answeredModules: ["pension"] };
  const merged = mergeAnswers(account, device);
  assert.equal(merged.salary, "55000");
  assert.equal(merged.myContribution, "5");
  assert.deepEqual(merged.askedFields, ["scottishTaxpayer", "salary", "age"]);
  assert.deepEqual(merged.answeredModules, ["cash", "pension"]);
  assert.equal(merged.name, "Harvey");
});

test("where both have an answer, the account's stands", () => {
  assert.equal(mergeAnswers({ salary: "60000" }, { salary: "55000" }).salary, "60000");
  // An answer of "no" or 0 is an answer, not a gap.
  assert.equal(mergeAnswers({ hasPension: "no" }, { hasPension: "yes" }).hasPension, "no");
  assert.equal(mergeAnswers({ childBenefitChildren: "0" }, { childBenefitChildren: "2" }).childBenefitChildren, "0");
});

test("nothing on one side: the other as it is", () => {
  const a = { salary: "1" };
  assert.equal(mergeAnswers(a, null), a);
  assert.deepEqual(mergeAnswers(null, a), a);
  assert.deepEqual(mergeCompleted(["cash"], ["pension", "cash"]), ["cash", "pension"]);
  assert.deepEqual(mergeCompleted(null, undefined), []);
});
