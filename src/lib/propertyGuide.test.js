import { test } from "node:test";
import assert from "node:assert/strict";
import { READINESS_QUESTIONS, MORTGAGE_QUESTIONS, RENT_VS_BUY_QUESTIONS, neededAtStart, visibleQuestions, guideStarts } from "./propertyGuide.js";
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
  const ctx = ctxFor({ ...purchased, propertyTenure: "leasehold" });
  for (const q of [...READINESS_QUESTIONS, ...MORTGAGE_QUESTIONS, ...RENT_VS_BUY_QUESTIONS]) {
    const words = q.why(ctx).split(/\s+/).length;
    assert.ok(words <= 15, `${q.id}: ${words} words`);
  }
});

// Step 1 done: a £300,000 London home, £30,000 cash.
const purchased = { ...base, propertyRegion: "london", propertyFirstTimeBuyer: "yes", propertyPrice: "300000", propertyCashAvailable: "30000" };
const stepIds = (questions, d) => {
  const ctx = ctxFor(d);
  return visibleQuestions(questions, ctx, neededAtStart(questions, ctx)).map(q => q.id);
};

test("mortgage: term, rate and fix, the rate's reason priced on their own loan", () => {
  assert.deepEqual(stepIds(MORTGAGE_QUESTIONS, purchased), ["term", "rate", "fixedYears"]);
  const why = MORTGAGE_QUESTIONS.find(q => q.id === "rate").why;
  // A £272,500 loan (£30,000 less £2,500 fees) over 30 years: about £1,381
  // a month at 4.5% and £1,547 at 5.5%, so £170 to the nearest £10.
  assert.equal(why(ctxFor(purchased)), "Each 1% adds about £170 a month on this loan.");
  assert.equal(why(ctxFor({ ...purchased, propertyCashAvailable: "400000" })), "Sets your monthly payment.");
});

test("rent vs buy: leasehold adds ground rent and service charge, and £0 rent is an answer", () => {
  assert.deepEqual(stepIds(RENT_VS_BUY_QUESTIONS, purchased), ["rent", "horizon", "tenure", "renterMoney"]);
  assert.deepEqual(stepIds(RENT_VS_BUY_QUESTIONS, { ...purchased, propertyTenure: "leasehold" }),
    ["rent", "horizon", "tenure", "groundRent", "serviceCharge", "renterMoney"]);
  assert.deepEqual(RENT_VS_BUY_QUESTIONS[0].notSure(), { label: "I don't pay rent", value: "0" });
});

test("each walk-through starts by itself only on a blank step not yet walked through", () => {
  const m = calcMetrics(purchased);
  assert.equal(guideStarts("readiness", purchased, m), false); // already complete
  assert.equal(guideStarts("readiness", { ...purchased, propertyPrice: "" }, m), true);
  assert.equal(guideStarts("readiness", { ...purchased, propertyPrice: "", propertyGuideReadinessDone: true }, m), false);
  assert.equal(guideStarts("mortgage", purchased, m), true);
  assert.equal(guideStarts("mortgage", { ...purchased, propertyFixedYears: "2" }, m), false);
  assert.equal(guideStarts("rentVsBuy", purchased, m), true);
  assert.equal(guideStarts("rentVsBuy", { ...purchased, propertyMonthlyRent: "0" }, m), false);
  assert.equal(guideStarts("rentVsBuy", { ...purchased, propertyGuideRentVsBuyDone: true }, m), false);
});
