import { test } from "node:test";
import assert from "node:assert/strict";
import { readinessMissing } from "./propertyReadiness.js";
import { calcMetrics } from "./metrics.js";

const complete = {
  selectedModules: ["cash", "investments", "pension"],
  salary: "50000", monthlyExpenses: "2000", cashTiers: [{ amount: "20000", rate: "4" }],
  hasPension: "yes", myContribution: "3", employerMatch: "5", isaThisYearSS: "5000",
  propertyBuyingMode: "alone", propertyPrice: "300000", propertyRegion: "london", propertyFirstTimeBuyer: "yes",
};
const missing = d => readinessMissing(d, calcMetrics(d));

test("complete when every check has figures and the purchase details are in", () => {
  assert.deepEqual(missing(complete), []);
});

test("checks needing attention still count as complete", () => {
  // Unclaimed match and unused ISA allowance are both "attention", not missing.
  assert.deepEqual(missing({ ...complete, myContribution: "1", isaThisYearSS: "" }), []);
});

test("a check without its figures blocks step 2", () => {
  assert.deepEqual(missing({ ...complete, selectedModules: ["pension"] }), ["checks"]);
});

test("price, location and first-time buyer status are each needed", () => {
  assert.deepEqual(missing({ ...complete, propertyPrice: "", propertyRegion: "", propertyFirstTimeBuyer: "" }), ["price", "region", "firstTimeBuyer"]);
});

test("buying together also needs the partner's figures and first-time buyer status", () => {
  const d = { ...complete, propertyBuyingMode: "together" };
  assert.deepEqual(missing(d), ["checks", "partnerFirstTimeBuyer"]);
  assert.deepEqual(missing({ ...d, partnerEmployerMatch: "4", partnerIsaThisYear: "0", partnerFirstTimeBuyer: "no" }), []);
});
