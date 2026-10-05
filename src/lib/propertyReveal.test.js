import { test } from "node:test";
import assert from "node:assert/strict";
import { readinessReveal, mortgageReveal, rentVsBuyReveal, breakevenLine } from "./propertyReveal.js";
import { calcMetrics } from "./metrics.js";
import { borrowingInputs, calcBorrowingCheck } from "./borrowing.js";
import { mortgageInputs, mortgageSummary } from "./mortgage.js";
import { rentVsBuyInputs, calcRentVsBuy } from "./rentVsBuy.js";

// Step 1 done: £300,000 in London, first-time buyer, £45,000 salary.
const buyer = {
  selectedModules: ["cash", "pension"], salary: "45000", monthlyExpenses: "2000", cashTiers: [{ amount: "30000", rate: "4" }],
  hasPension: "yes", myContribution: "5", employerMatch: "5",
  propertyBuyingMode: "alone", propertyRegion: "london", propertyFirstTimeBuyer: "yes", propertyPrice: "300000", propertyCashAvailable: "30000",
};
const fmtGBP = n => `£${Math.round(n).toLocaleString("en-GB")}`;

test("no price, no readiness answer; no rent, no rent vs buy answer", () => {
  assert.equal(readinessReveal({ ...buyer, propertyPrice: "" }, calcMetrics(buyer)), null);
  assert.equal(rentVsBuyReveal(buyer, calcMetrics(buyer)), null);
});

test("readiness: the loan and times income are the borrowing check's own", () => {
  const m = calcMetrics(buyer);
  const r = calcBorrowingCheck(borrowingInputs(buyer, m));
  const steps = readinessReveal(buyer, m);
  assert.deepEqual(steps.map(s => s.label), ["Your answer", "Why", "What you could do"]);
  assert.equal(steps[0].figure, fmtGBP(r.loanNeeded));
  assert.equal(steps[0].title, `to borrow, ${r.multiple.toFixed(1)}x your income.`);
  // £272,500 on £45,000 is 6.1x: beyond the 5.5x some lenders offer.
  assert.match(steps[2].title, /beyond the 5\.5x some lenders offer higher earners\.$/);
});

test("readiness: what you could do names the price that fits, and 5.5x only in the explanation", () => {
  const steps = d => readinessReveal(d, calcMetrics(d))[2];
  const flat = { ...buyer, monthlyExpenses: "0", propertyFees: "2500" };
  // 4.5 x 45,000 = 202,500 loan plus a 27,500 deposit: £230,000.
  assert.equal(steps(flat).body, "A home up to £230,000 would fit. A bigger deposit or buying with someone would bring it closer.");
  assert.deepEqual(steps({ ...flat, propertyPrice: "245000" }), { label: "What you could do", title: "That's £15,000 more than 4.5x your income.",
    body: "A home up to £230,000 would fit. Some lenders go to 5.5x for higher earners, which would allow up to £275,000." });
  // Followed by the line about this screen's checks, when any need a look.
  assert.ok(steps({ ...flat, propertyPrice: "215000" }).body.startsWith(
    "The most you could afford is about £230,000. Some lenders go to 5.5x for higher earners, which would allow up to £275,000."));
});

test("readiness: a deposit under 5% says how much more is needed", () => {
  const d = { ...buyer, salary: "80000", monthlyExpenses: "0", propertyFees: "2500", propertyCashAvailable: "15000" };
  const step = readinessReveal(d, calcMetrics(d))[2];
  assert.equal(step.title, "Most lenders need a deposit of at least 5%, so you'd need £2,500 more.");
  assert.ok(step.body.startsWith("With the cash you have, a home up to £250,000 would fit."));
});

test("readiness: cash that covers it all needs no mortgage", () => {
  const rich = { ...buyer, propertyCashAvailable: "400000" };
  assert.equal(readinessReveal(rich, calcMetrics(rich))[0].title, "No mortgage needed.");
});

test("mortgage: the repayment and the remortgage range are the step's own", () => {
  const m = calcMetrics(buyer);
  const loan = calcBorrowingCheck(borrowingInputs(buyer, m)).loanNeeded;
  const s = mortgageSummary(mortgageInputs(buyer, loan));
  const steps = mortgageReveal(buyer, m);
  assert.equal(steps[0].figure, `${fmtGBP(s.monthlyPayment)} a month`);
  const payments = s.remortgageOutcomes.map(o => o.monthlyPayment);
  assert.match(steps[2].title, new RegExp(`^Plan for ${fmtGBP(Math.min(...payments))} to ${fmtGBP(Math.max(...payments))} a month from year ${s.firstRemortgageYear}`));
});

test("rent vs buy: the verdict matches the step's result, and break-even comes from the same comparison run longer", () => {
  const reveal = (rent, years) => { const d = { ...buyer, propertyMonthlyRent: rent, propertyHorizonYears: years }; const m = calcMetrics(d); return { steps: rentVsBuyReveal(d, m), result: calcRentVsBuy(rentVsBuyInputs(d, m, null, "moderate", null)) }; };
  // £900 rent over 5 years: buying ahead, from year 3 (the result's own break-even).
  const ahead = reveal("900", "5");
  assert.equal(ahead.steps[0].figure, "Buying");
  assert.equal(ahead.result.breakevenYear, 3);
  assert.equal(ahead.steps[2].title, "Buying pulls ahead from year 3, so moving before then would favour renting.");
  // £700 rent for 1 year: renting ahead, the one-off costs not yet made back.
  const short = reveal("700", "1");
  assert.equal(short.steps[0].figure, "Renting");
  assert.match(short.steps[1].title, /^Buying's one-off costs \(£[\d,]+ in stamp duty, fees and 2% selling costs\) haven't been made back after 1 year\.$/);
  assert.match(short.steps[2].title, /^Buying would come out ahead if you stayed \d+ years or more\.$/);
  // £0 rent: buying never catches up.
  assert.equal(reveal("0", "5").steps[2].title, "On these assumptions, buying doesn't come out ahead even over 40 years.");
});

test("rent vs buy: how much the answer leans on house prices, in a sentence", () => {
  assert.equal(breakevenLine(0.5, true), "Buying needs house prices to rise more than 0.5% a year to stay ahead.");
  assert.equal(breakevenLine(-0.4, true), "Buying stays ahead unless house prices fall more than 0.4% a year.");
  assert.equal(breakevenLine(0, true), "Buying stays ahead as long as house prices don't fall.");
  assert.equal(breakevenLine(4.1, false), "Buying would come out ahead if house prices rose more than 4.1% a year.");
  assert.equal(breakevenLine(null, true), null);
  // The explanation's last step leads with it.
  const d = { ...buyer, propertyMonthlyRent: "900", propertyHorizonYears: "5" };
  assert.match(rentVsBuyReveal(d, calcMetrics(d))[2].body, /^Buying needs house prices to rise more than -?[\d.]+% a year to stay ahead\. Candid assumes house prices rise 3% and rents/);
});
