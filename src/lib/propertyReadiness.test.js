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

test("complete once the purchase details are in", () => {
  assert.deepEqual(missing(complete), []);
});

test("checks needing attention still count as complete", () => {
  // Unclaimed match and unused ISA allowance are both "attention", not missing.
  assert.deepEqual(missing({ ...complete, myContribution: "1", isaThisYearSS: "" }), []);
});

test("the before-a-deposit checks don't block step 2, even with no figures (a shared link straight to Property)", () => {
  assert.deepEqual(missing({ ...complete, selectedModules: [], employerMatch: "", cashTiers: [] }), []);
});

test("price, location and first-time buyer status are each needed", () => {
  assert.deepEqual(missing({ ...complete, propertyPrice: "", propertyRegion: "", propertyFirstTimeBuyer: "" }), ["price", "region", "firstTimeBuyer"]);
});

test("first-time buyer status isn't needed in Scotland or Wales", () => {
  assert.deepEqual(missing({ ...complete, propertyRegion: "wales", propertyFirstTimeBuyer: "" }), []);
  assert.deepEqual(missing({ ...complete, propertyRegion: "scotland", propertyBuyingMode: "together", partnerEmployerMatch: "4", partnerIsaThisYear: "0", propertyFirstTimeBuyer: "" }), []);
  assert.deepEqual(missing({ ...complete, propertyRegion: "northern_ireland", propertyFirstTimeBuyer: "" }), ["firstTimeBuyer"]);
});

test("buying together also needs the partner's first-time buyer status", () => {
  const d = { ...complete, propertyBuyingMode: "together" };
  assert.deepEqual(missing(d), ["partnerFirstTimeBuyer"]);
  assert.deepEqual(missing({ ...d, partnerFirstTimeBuyer: "no" }), []);
});
