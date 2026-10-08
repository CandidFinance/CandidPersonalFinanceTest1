import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULE_GUIDES, moduleGuideStarts } from "./moduleGuide.js";
import { READINESS_QUESTIONS, MORTGAGE_QUESTIONS, RENT_VS_BUY_QUESTIONS, neededAtStart, visibleQuestions, countSettled } from "./propertyGuide.js";
import { calcMetrics } from "./metrics.js";

// Straight from the two-question entry: a blank profile with a name.
const fresh = { name: "Sam", appEntered: true, interests: ["pension"], selectedModules: [], employmentStatus: "employed", retirementAge: "65",
  hasInvestments: "no", hasPension: "no", studentLoan: "none", cashTiers: [{ amount: "", rate: "" }] };
const ctxFor = d => ({ d, m: calcMetrics(d), regionalRows: null });
const ids = (key, d, needAt = d) => {
  const questions = MODULE_GUIDES[key].questions;
  return visibleQuestions(questions, ctxFor(d), neededAtStart(questions, ctxFor(needAt))).map(q => q.id);
};
const aboutYou = ["employment", "salary", "extraIncome"];

test("the first module asks about you first, led by one line", () => {
  const ctx = ctxFor(fresh);
  const qs = visibleQuestions(MODULE_GUIDES.pension.questions, ctx, neededAtStart(MODULE_GUIDES.pension.questions, ctx));
  assert.deepEqual(qs.slice(0, 4).map(q => q.id), [...aboutYou, "age"]);
  assert.deepEqual(qs.filter(q => q.lead).map(q => q.id), ["employment"]);
});

test("a later module doesn't ask about you again", () => {
  const answered = { ...fresh, employmentAsked: true, salary: "45000", hasExtraIncome: "no", age: "31" };
  assert.deepEqual(ids("investments", answered), ["hasInvestments"]);
  assert.deepEqual(ids("pension", answered), ["pensionStatus"]);
});

test("other income opens its three questions only when there is some", () => {
  const yes = { ...fresh, hasExtraIncome: "yes" };
  assert.deepEqual(ids("studentLoan", yes, fresh).slice(0, 6), [...aboutYou, "bonus", "dividends", "otherIncome"]);
});

test("someone not working isn't asked for a salary", () => {
  assert.ok(!ids("cash", { ...fresh, employmentStatus: "not_working" }, fresh).includes("salary"));
});

test("cash asks spending, accounts, then gated bonds and ISA amounts", () => {
  const known = { ...fresh, employmentAsked: true, salary: "45000", hasExtraIncome: "no" };
  assert.deepEqual(ids("cash", known), ["spending", "cashAccounts", "hasPremiumBonds", "hasCashIsa", "otherIsa", "cashIsaEarlier", "cashAccess"]);
  assert.deepEqual(ids("cash", { ...known, hasPremiumBonds: "yes", hasCashIsaThisYear: "yes", hasOtherIsaThisYear: "yes" }, known),
    ["spending", "cashAccounts", "hasPremiumBonds", "premiumBonds", "hasCashIsa", "cashIsaThisYear", "otherIsa", "otherIsaThisYear", "cashIsaEarlier", "cashAccess"]);
});

test("cash only asks about other ISAs when Investments hasn't itemised them", () => {
  const known = { ...fresh, employmentAsked: true, salary: "45000", hasExtraIncome: "no", isaThisYearSS: "6000" };
  assert.ok(!ids("cash", known).includes("otherIsa"));
});

test("investments: no investments ends after one question; outside an ISA opens gains", () => {
  const known = { ...fresh, employmentAsked: true, salary: "45000", hasExtraIncome: "no" };
  assert.deepEqual(ids("investments", known), ["hasInvestments"]);
  assert.deepEqual(ids("investments", { ...known, hasInvestments: "yes", hasUnwrapped: "yes", hasSoldAssetsOutsideWrapper: "yes" }, known), [
    "hasInvestments", "ssIsaEarlier", "ssIsaThisYear", "hasLisa", "hasUnwrapped", "unwrappedValue", "unrealisedGains", "soldThisYear", "realisedGains",
  ]);
});

test("pension: the match question is skipped for the self-employed, or if Property already asked it", () => {
  const known = { ...fresh, employmentAsked: true, salary: "45000", hasExtraIncome: "no", age: "31", pensionStatus: "yes" };
  assert.ok(ids("pension", known).includes("pensionMatch"));
  assert.ok(!ids("pension", { ...known, employmentStatus: "self_employed" }).includes("pensionMatch"));
  assert.ok(!ids("pension", { ...known, myContribution: "5", employerMatch: "5" }).includes("pensionMatch"));
});

test("pension 'not sure' keeps the unknown flag the module reads; yes and no set hasPension", () => {
  const status = MODULE_GUIDES.pension.questions.find(q => q.id === "pensionStatus");
  assert.deepEqual(status.also("unsure"), { pensionUnknown: true });
  assert.deepEqual(status.also("yes"), { pensionUnknown: false, hasPension: "yes" });
});

test("not sure of the plan: the helper asks only what it needs, then the loan questions follow", () => {
  const known = { ...fresh, employmentAsked: true, salary: "45000", hasExtraIncome: "no" };
  const unsure = { ...known, slPlanAnswer: "unsure" };
  assert.deepEqual(ids("studentLoan", unsure, known), ["studentLoanPlan", "slCountry"]);
  assert.deepEqual(ids("studentLoan", { ...unsure, slCountry: "scotland", studentLoan: "plan4" }, known),
    ["studentLoanPlan", "slCountry", "slPlanResult", "loanBalance", "loanRate"]);
  assert.deepEqual(ids("studentLoan", { ...unsure, slCountry: "england", slCourse: "undergrad", slStart: "2023on", studentLoan: "plan5" }, known),
    ["studentLoanPlan", "slCountry", "slCourse", "slStart", "slPlanResult", "loanBalance", "loanRate"]);
});

test("each helper answer sets the plan once there's enough to tell, and the result says which", () => {
  const qs = MODULE_GUIDES.studentLoan.questions;
  const q = id => qs.find(x => x.id === id);
  assert.deepEqual(q("slCountry").also("ni", { d: {} }), { studentLoan: "plan1" });
  assert.deepEqual(q("slCountry").also("england", { d: {} }), {});
  assert.deepEqual(q("slStart").also("2012on", { d: { slCountry: "wales", slCourse: "undergrad" } }), { studentLoan: "plan2" });
  assert.deepEqual(q("studentLoanPlan").also("unsure"), {});
  assert.deepEqual(q("studentLoanPlan").also("plan2"), { studentLoan: "plan2" });
  assert.equal(q("slPlanResult").ask(ctxFor({ ...fresh, slCountry: "england", slCourse: "postgrad" })), "You're on the Postgraduate Loan plan.");
});

test("the question count shows only once no answer still to come can change it", () => {
  const known = { ...fresh, employmentAsked: true, salary: "45000", hasExtraIncome: "no" };
  const settled = (key, d, id) => {
    const qs = MODULE_GUIDES[key].questions;
    return countSettled(qs, ctxFor(d), neededAtStart(qs, ctxFor(known)), id);
  };
  // The plan question decides whether the helper and loan questions come.
  assert.equal(settled("studentLoan", known, "studentLoanPlan"), false);
  // On plan 2: balance and rate always follow, so it's settled.
  assert.equal(settled("studentLoan", { ...known, slPlanAnswer: "plan2", studentLoan: "plan2" }, "loanBalance"), true);
  // Cash: the Premium Bonds and Cash ISA yes/nos are still to come.
  assert.equal(settled("cash", known, "spending"), false);
  assert.equal(settled("cash", { ...known, hasPremiumBonds: "no", hasCashIsaThisYear: "yes" }, "cashIsaEarlier"), true);
});

test("student loan rate shows the rate the calculations would use", () => {
  const rate = MODULE_GUIDES.studentLoan.questions.find(q => q.id === "loanRate");
  assert.equal(rate.prefill(ctxFor({ ...fresh, studentLoan: "plan2", salary: "29385" })), 4.1);
  assert.equal(rate.prefill(ctxFor({ ...fresh, studentLoan: "postgrad", salary: "40000" })), 6);
});

test("a module's walk-through starts until the module is selected", () => {
  assert.equal(moduleGuideStarts("cash", fresh), true);
  assert.equal(moduleGuideStarts("cash", { ...fresh, selectedModules: ["cash"] }), false);
  assert.equal(moduleGuideStarts("property", fresh), false);
});

test("every question has a short reason, and ids are unique across every walk-through", () => {
  const all = [...Object.values(MODULE_GUIDES).flatMap(g => g.questions), ...READINESS_QUESTIONS, ...MORTGAGE_QUESTIONS, ...RENT_VS_BUY_QUESTIONS];
  const ctx = ctxFor({ ...fresh, propertyRegion: "london", propertyPrice: "300000" });
  for (const q of all) assert.ok(q.why(ctx).split(/\s+/).length <= 15, `${q.id}: ${q.why(ctx)}`);
  const unique = new Map(all.map(q => [q.id, q]));
  for (const q of all) assert.equal(unique.get(q.id), q, `duplicate id ${q.id}`);
});

// Not paying in isn't "no pension": a pot from retiring or an old job counts.
const known = { ...fresh, employmentAsked: true, employmentStatus: "not_working", hasExtraIncome: "no" };
test("pension: not paying in asks about a pot, then retirement for those 55 and over", () => {
  const noPot = { ...known, age: "69", pensionStatus: "no" };
  // From 66 the State Pension question is asked with or without a pot.
  assert.deepEqual(ids("pension", noPot), ["pensionStatus", "pensionPotNotPaying", "statePension"]);
  const pot = { ...noPot, hasPensionPot: "yes", potValue: "500000" };
  assert.deepEqual(ids("pension", pot), ["pensionStatus", "pensionPotNotPaying", "pensionPot", "pensionAccess", "statePension", "retirementAge"]);
  const drawing = { ...pot, pensionAccess: "taxFreeOnly" };
  assert.deepEqual(ids("pension", drawing), ["pensionStatus", "pensionPotNotPaying", "pensionPot", "pensionAccess", "taxFreeCashTaken", "statePension"]);
  // From £1m, the protection question.
  assert.ok(ids("pension", { ...pot, potValue: "1200000" }).includes("pensionProtection"));
  // Under 55: no retirement questions.
  assert.deepEqual(ids("pension", { ...pot, age: "40" }), ["pensionStatus", "pensionPotNotPaying", "pensionPot", "retirementAge"]);
  const q = MODULE_GUIDES.pension.questions.find(x => x.id === "pensionPotNotPaying");
  assert.deepEqual(q.also("yes"), { hasPension: "yes" });
  assert.deepEqual(q.also("no"), { hasPension: "no" });
});
