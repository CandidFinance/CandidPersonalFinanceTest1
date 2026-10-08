import { test } from "node:test";
import assert from "node:assert/strict";
import { READINESS_QUESTIONS, MORTGAGE_QUESTIONS, RENT_VS_BUY_QUESTIONS, neededAtStart, visibleQuestions, guideStarts, whyLine, STEP_GUIDES } from "./propertyGuide.js";
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
    ["buyingMode", "region", "firstTimeBuyer", "soleProperty", "ukResident", "cashAvailable", "price"]);
});

test("a first-time buyer isn't asked about keeping another home", () => {
  assert.deepEqual(ids({ ...base, propertyRegion: "london", propertyFirstTimeBuyer: "yes" }),
    ["buyingMode", "region", "firstTimeBuyer", "ukResident", "cashAvailable", "price"]);
});

test("Scotland and Wales skip the stamp duty questions", () => {
  for (const region of ["scotland", "wales"]) {
    assert.deepEqual(ids({ ...base, propertyRegion: region }), ["buyingMode", "region", "cashAvailable", "price"]);
  }
});

test("buying together adds the partner's questions, the checks led by one line", () => {
  const ctx = ctxFor({ ...base, propertyRegion: "london", propertyBuyingMode: "together" });
  const qs = visibleQuestions(READINESS_QUESTIONS, ctx, neededAtStart(READINESS_QUESTIONS, ctx));
  assert.deepEqual(qs.map(q => q.id), [
    "buyingMode", "partnerSalary", "partnerOtherIncome", "region", "firstTimeBuyer", "partnerFirstTimeBuyer",
    "soleProperty", "ukResident", "cashAvailable", "price", "partnerMyContribution", "partnerEmployerMatch", "partnerIsa",
  ]);
  assert.deepEqual(qs.filter(q => q.lead).map(q => q.id), ["partnerMyContribution"]);
});

test("figures Candid lacks are asked once, and stay asked after they're answered", () => {
  const start = { ...base, propertyRegion: "london", propertyFirstTimeBuyer: "yes", myContribution: "", employerMatch: "", monthlyExpenses: "" };
  const needed = neededAtStart(READINESS_QUESTIONS, ctxFor(start));
  const visible = d => visibleQuestions(READINESS_QUESTIONS, ctxFor(d), needed).map(q => q.id);
  const expected = ["buyingMode", "region", "firstTimeBuyer", "ukResident", "expenses", "cashAvailable", "price", "myContribution", "employerMatch"];
  assert.deepEqual(visible(start), expected);
  assert.deepEqual(visible({ ...start, myContribution: "5", employerMatch: "5", monthlyExpenses: "2000" }), expected);
});

test("not sure of the price offers the most they could afford, then the region's average", () => {
  const price = READINESS_QUESTIONS.find(q => q.id === "price");
  // 4.5 x 50,000 = 225,000 loan plus 30,000 cash less 6,000 kept back
  // and 2,500 fees, with no stamp duty for a first-time buyer.
  assert.deepEqual(price.notSure(ctxFor({ ...base, propertyRegion: "north_east", propertyFirstTimeBuyer: "yes" })), [
    { label: "Use the most I could afford, £246,000", value: "246000" },
    { label: "Use the North East average, £167,000", value: "167000" },
  ]);
  assert.equal(price.notSure({ ...ctxFor({ ...base, propertyRegion: "wales" }), regionalRows: [{ region: "wales", average_price: 220000 }] })[1].value, "220000");
  // No income, no figure to offer: just the average.
  assert.deepEqual(price.notSure(ctxFor({ ...base, salary: "", propertyRegion: "north_east" })).map(o => o.value), ["167000"]);
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
  // Then rent, for what they'd have left each month; spending too if it's missing.
  assert.deepEqual(stepIds(MORTGAGE_QUESTIONS, purchased), ["term", "rate", "fixedYears", "budgetRent"]);
  assert.deepEqual(stepIds(MORTGAGE_QUESTIONS, { ...purchased, monthlyExpenses: "" }), ["term", "rate", "fixedYears", "budgetSpending", "budgetRent"]);
  assert.deepEqual(stepIds(MORTGAGE_QUESTIONS, { ...purchased, propertyMonthlyRent: "0" }), ["term", "rate", "fixedYears"]);
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

test("question ids are unique across the steps, so the full view's reasons find the right one", () => {
  const ids = [...READINESS_QUESTIONS, ...MORTGAGE_QUESTIONS, ...RENT_VS_BUY_QUESTIONS].map(q => q.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(whyLine("tenure", ctxFor(purchased)), "Leasehold adds ground rent and a service charge every year.");
  assert.equal(whyLine("nope", ctxFor(purchased)), null);
});

test("a held result card waits for a question the step actually asks", () => {
  for (const g of Object.values(STEP_GUIDES)) {
    const hold = g.holdResultUntil;
    assert.ok(hold === null || hold === "end" || g.questions.some(q => q.id === hold), String(hold));
  }
});

test("each walk-through starts by itself only on a blank step not yet walked through", () => {
  const m = calcMetrics(purchased);
  assert.equal(guideStarts("readiness", purchased, m), false); // already complete
  assert.equal(guideStarts("readiness", { ...purchased, propertyPrice: "" }, m), true);
  assert.equal(guideStarts("readiness", { ...purchased, propertyPrice: "", propertyGuideReadinessDone: true }, m), false);
  assert.equal(guideStarts("mortgage", purchased, m), true);
  assert.equal(guideStarts("mortgage", { ...purchased, propertyFixedYears: "2" }, m), false);
  assert.equal(guideStarts("rentVsBuy", purchased, m), true);
  // Rent alone may have come from step 2: still its own walk-through, which
  // then doesn't ask the rent again.
  assert.equal(guideStarts("rentVsBuy", { ...purchased, propertyMonthlyRent: "0" }, m), true);
  assert.deepEqual(stepIds(RENT_VS_BUY_QUESTIONS, { ...purchased, propertyMonthlyRent: "900" })[0], "horizon");
  assert.equal(guideStarts("rentVsBuy", { ...purchased, propertyMonthlyRent: "0", propertyHorizonYears: "5" }, m), false);
  assert.equal(guideStarts("rentVsBuy", { ...purchased, propertyGuideRentVsBuyDone: true }, m), false);
});

test("buying together: asked whether spending covers both of them, and the rent is the whole rent", () => {
  const couple = { ...purchased, propertyBuyingMode: "together", partnerSalary: "40000", partnerFirstTimeBuyer: "yes" };
  assert.deepEqual(stepIds(MORTGAGE_QUESTIONS, couple), ["term", "rate", "fixedYears", "spendingScope", "budgetRent"]);
  assert.deepEqual(stepIds(MORTGAGE_QUESTIONS, { ...couple, propertySpendingScope: "household" }), ["term", "rate", "fixedYears", "budgetRent"]);
  const scope = MORTGAGE_QUESTIONS.find(q => q.id === "spendingScope");
  assert.equal(scope.ask(ctxFor(couple)), "Is the £2,000 a month you spend just yours, or both of you together?");
  const rent = MORTGAGE_QUESTIONS.find(q => q.id === "budgetRent");
  assert.equal(rent.ask(ctxFor(couple)), "What do you both pay in rent each month?");
  assert.equal(rent.ask(ctxFor(purchased)), "What do you pay in rent each month?");
});
