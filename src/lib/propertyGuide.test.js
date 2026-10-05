import { test } from "node:test";
import assert from "node:assert/strict";
import { READINESS_QUESTIONS, neededAtStart, visibleQuestions } from "./propertyGuide.js";
import { calcMetrics } from "./metrics.js";

// Someone who did core onboarding with Cash & savings and Pension.
const base = {
  selectedModules: ["cash", "pension"],
  salary: "50000", monthlyExpenses: "2000", cashTiers: [{ amount: "30000", rate: "4" }],
  hasPension: "yes", myContribution: "5", employerMatch: "5",
  propertyBuyingMode: "alone", propertySoleProperty: "yes",
};
const ctxFor = d => ({ d, m: calcMetrics(d), regionalRows: null });
const ids = d => {
  const ctx = ctxFor(d);
  return visibleQuestions(READINESS_QUESTIONS, ctx, neededAtStart(READINESS_QUESTIONS, ctx)).map(q => q.id);
};

test("buying alone in England with figures already in: only the purchase questions", () => {
  assert.deepEqual(ids({ ...base, propertyRegion: "london" }),
    ["buyingMode", "region", "firstTimeBuyer", "soleProperty", "price", "cashAvailable"]);
});

test("a first-time buyer isn't asked about keeping another home", () => {
  assert.deepEqual(ids({ ...base, propertyRegion: "london", propertyFirstTimeBuyer: "yes" }),
    ["buyingMode", "region", "firstTimeBuyer", "price", "cashAvailable"]);
});

test("Scotland and Wales skip the stamp duty questions", () => {
  for (const region of ["scotland", "wales"]) {
    assert.deepEqual(ids({ ...base, propertyRegion: region }), ["buyingMode", "region", "price", "cashAvailable"]);
  }
});

test("buying together adds the partner's questions, the checks led by one line", () => {
  const ctx = ctxFor({ ...base, propertyRegion: "london", propertyBuyingMode: "together" });
  const qs = visibleQuestions(READINESS_QUESTIONS, ctx, neededAtStart(READINESS_QUESTIONS, ctx));
  assert.deepEqual(qs.map(q => q.id), [
    "buyingMode", "partnerSalary", "partnerOtherIncome", "region", "firstTimeBuyer", "partnerFirstTimeBuyer",
    "soleProperty", "price", "cashAvailable", "partnerMyContribution", "partnerEmployerMatch", "partnerIsa",
  ]);
  assert.deepEqual(qs.filter(q => q.lead).map(q => q.id), ["partnerMyContribution"]);
});

test("figures Candid lacks are asked once, and stay asked after they're answered", () => {
  const start = { ...base, propertyRegion: "london", propertyFirstTimeBuyer: "yes", myContribution: "", employerMatch: "", monthlyExpenses: "" };
  const needed = neededAtStart(READINESS_QUESTIONS, ctxFor(start));
  const visible = d => visibleQuestions(READINESS_QUESTIONS, ctxFor(d), needed).map(q => q.id);
  const expected = ["buyingMode", "region", "firstTimeBuyer", "price", "expenses", "cashAvailable", "myContribution", "employerMatch"];
  assert.deepEqual(visible(start), expected);
  assert.deepEqual(visible({ ...start, myContribution: "5", employerMatch: "5", monthlyExpenses: "2000" }), expected);
});

test("not sure of the price offers the region's average", () => {
  const price = READINESS_QUESTIONS.find(q => q.id === "price");
  assert.deepEqual(price.notSure(ctxFor({ ...base, propertyRegion: "north_east" })), { label: "Use the North East average, £167,000", value: "167000" });
  assert.equal(price.notSure({ ...ctxFor({ ...base, propertyRegion: "wales" }), regionalRows: [{ region: "wales", average_price: 220000 }] }).value, "220000");
});

test("the why lines quote the figures the calculations use", () => {
  const why = id => READINESS_QUESTIONS.find(q => q.id === id).why(ctxFor({ ...base, propertyRegion: "london" }));
  assert.equal(why("firstTimeBuyer"), "If not, you could pay no stamp duty on the first £300,000.");
  assert.equal(why("soleProperty"), "Keeping another home adds 5% stamp duty on the whole price.");
  assert.equal(why("partnerIsa"), "Their £20,000 allowance is lost if it's not used by 5 April.");
});

test("every why line is one sentence of 15 words or fewer", () => {
  const ctx = ctxFor({ ...base, propertyRegion: "london" });
  for (const q of READINESS_QUESTIONS) {
    const words = q.why(ctx).split(/\s+/).length;
    assert.ok(words <= 15, `${q.id}: ${words} words`);
  }
});
