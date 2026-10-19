import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULE_GUIDES, moduleGuideStarts, flatQuestions, briefQuestions } from "./moduleGuide.js";
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
const aboutYou = ["employment", "salary", "nation", "extraIncome"];

test("the first module asks about you first, led by one line", () => {
  const ctx = ctxFor(fresh);
  const qs = visibleQuestions(MODULE_GUIDES.pension.questions, ctx, neededAtStart(MODULE_GUIDES.pension.questions, ctx));
  assert.deepEqual(qs.slice(0, 5).map(q => q.id), [...aboutYou, "age"]);
  assert.deepEqual(qs.filter(q => q.lead).map(q => q.id), ["employment"]);
});

test("a later module doesn't ask about you again", () => {
  const answered = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "45000", hasExtraIncome: "no", age: "31" };
  assert.deepEqual(ids("investments", answered), ["hasInvestments"]);
  assert.deepEqual(ids("pension", answered), ["pensionStatus"]);
});

test("other income opens its three questions only when there is some", () => {
  const yes = { ...fresh, hasExtraIncome: "yes" };
  assert.deepEqual(ids("pension", yes, fresh).slice(0, 7), [...aboutYou, "bonus", "dividends", "otherIncome"]);
});

test("someone not working isn't asked for a salary", () => {
  assert.ok(!ids("cash", { ...fresh, employmentStatus: "not_working" }, fresh).includes("salary"));
});

test("cash asks spending, accounts, then gated bonds and ISA amounts", () => {
  const known = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "45000", hasExtraIncome: "no" };
  assert.deepEqual(ids("cash", known), ["spending", "cashAccounts", "hasPremiumBonds", "hasCashIsa", "otherIsa", "cashIsaEarlier", "cashAccess"]);
  assert.deepEqual(ids("cash", { ...known, hasPremiumBonds: "yes", hasCashIsaThisYear: "yes", hasOtherIsaThisYear: "yes" }, known),
    ["spending", "cashAccounts", "hasPremiumBonds", "premiumBonds", "hasCashIsa", "cashIsaThisYear", "otherIsa", "otherIsaThisYear", "cashIsaEarlier", "cashAccess"]);
});

test("cash only asks about other ISAs when Investments hasn't itemised them", () => {
  const known = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "45000", hasExtraIncome: "no", isaThisYearSS: "6000" };
  assert.ok(!ids("cash", known).includes("otherIsa"));
});

test("investments: no investments ends after one question; outside an ISA opens gains", () => {
  const known = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "45000", hasExtraIncome: "no" };
  assert.deepEqual(ids("investments", known), ["hasInvestments"]);
  assert.deepEqual(ids("investments", { ...known, hasInvestments: "yes", hasUnwrapped: "yes", hasSoldAssetsOutsideWrapper: "yes" }, known), [
    "hasInvestments", "ssIsaEarlier", "ssIsaThisYear", "hasLisa", "hasUnwrapped", "unwrappedValue", "unrealisedGains", "soldThisYear", "realisedGains",
  ]);
});

test("pension: the match question is skipped for the self-employed, or if Property already asked it", () => {
  const known = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "45000", hasExtraIncome: "no", age: "31", pensionStatus: "yes" };
  assert.ok(ids("pension", known).includes("pensionMatch"));
  assert.ok(!ids("pension", { ...known, employmentStatus: "self_employed" }).includes("pensionMatch"));
  assert.ok(!ids("pension", { ...known, myContribution: "5", employerMatch: "5" }).includes("pensionMatch"));
});

test("pension 'not sure' keeps the unknown flag the module reads; yes and no set hasPension", () => {
  const status = MODULE_GUIDES.pension.questions.find(q => q.id === "pensionStatus");
  assert.deepEqual(status.also("unsure"), { pensionUnknown: true, pensionKind: "" });
  assert.deepEqual(status.also("yes"), { pensionUnknown: false, hasPension: "yes", pensionKind: "dc" });
  assert.deepEqual(status.also("db"), { pensionUnknown: false, hasPension: "yes", pensionKind: "db" });
});

// A final salary or career average member is never asked for a pot or an
// employer match; they're asked what they pay in and what it'll pay.
test("pension, final salary: no pot or match questions, but what it'll pay", () => {
  const d = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "58000", hasExtraIncome: "no", age: "33", pensionStatus: "db", pensionKind: "db", hasPension: "yes" };
  const asked = ids("pension", d);
  for (const id of ["pensionPot", "employerType", "pensionMatch", "pensionType"]) assert.equal(asked.includes(id), false, id);
  for (const id of ["pensionContribution", "dbIncome", "retirementAge"]) assert.ok(asked.includes(id), id);
});

test("not sure of the plan: the helper asks only what it needs, then the loan questions follow", () => {
  const known = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "45000", hasExtraIncome: "no", age: "30" };
  const unsure = { ...known, slPlanAnswer: "unsure" };
  // "Not sure" picked under the balance, then the helper's questions.
  const k = { ...known, askedFields: ["salaryTrajectory"] }, un = { ...unsure, askedFields: ["salaryTrajectory"], loanBalance: "30000" };
  assert.deepEqual(ids("studentLoan", un, k), ["loanBalance", "slCountry"]);
  assert.deepEqual(ids("studentLoan", { ...un, slCountry: "scotland", studentLoan: "plan4" }, k),
    ["loanBalance", "slCountry", "slPlanResult", "loanRate"]);
  assert.deepEqual(ids("studentLoan", { ...un, slCountry: "england", slCourse: "undergrad", slStart: "2023on", studentLoan: "plan5" }, k),
    ["loanBalance", "slCountry", "slCourse", "slStart", "slPlanResult", "loanRate", "hasPgLoan"]);
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
  const known = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "45000", hasExtraIncome: "no" };
  const settled = (key, d, id) => {
    const qs = MODULE_GUIDES[key].questions;
    return countSettled(qs, ctxFor(d), neededAtStart(qs, ctxFor(known)), id);
  };
  // The plan question decides whether the helper and loan questions come.
  assert.equal(settled("studentLoan", known, "studentLoanPlan"), false);
  // On plan 2 the rest is fixed (a Postgraduate loan's balance is below its
  // question, not a question of its own), so the count shows from the balance.
  const plan2 = { ...known, slPlanAnswer: "plan2", studentLoan: "plan2" };
  assert.equal(settled("studentLoan", plan2, "loanBalance"), true);
  // The Postgraduate loan's balance is below its question, not a question
  // of its own, so from the rate on the count is settled.
  assert.equal(settled("studentLoan", { ...plan2, askedFields: ["salaryTrajectory"] }, "loanRate"), true);
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
const known = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", employmentStatus: "not_working", notWorkingReason: "retired", hasExtraIncome: "no" };
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

test("not sure of the balance: the borrowing questions come, then the estimate", () => {
  const known = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "60000", hasExtraIncome: "no", age: "30", slPlanAnswer: "plan2", studentLoan: "plan2" };
  const qs = MODULE_GUIDES.studentLoan.questions;
  const q = id => qs.find(x => x.id === id);
  assert.deepEqual(q("loanBalance").also(""), { slBalanceEstimate: "yes" });
  assert.deepEqual(q("loanBalance").also("12000"), { slBalanceEstimate: "" });
  assert.deepEqual(q("slFinishYear").also("2018"), { slFirstDueYear: "2019" });
  const est = { ...known, loanBalance: "", slBalanceEstimate: "yes" };
  assert.deepEqual(ids("studentLoan", { ...est, askedFields: ["salaryTrajectory"] }, { ...known, askedFields: ["salaryTrajectory"] }),
    ["loanBalance", "slStudyYears", "slTuition", "slMaintenance", "slFinishYear", "loanRate", "hasPgLoan"]);
  // The finish year given under the balance isn't asked again for the estimate.
  assert.ok(!ids("studentLoan", { ...est, slFinishYear: "2018" }, known).includes("slFinishYear"));
  const done = { ...est, slStudyYears: "6", slTuition: "nhs5", slMaintenance: "full", slFinishYear: "2018" };
  assert.ok(ids("studentLoan", done, known).includes("slBalanceResult"));
  // The NHS option only for courses of five years or more.
  assert.ok(q("slTuition").options(ctxFor({ ...done, slStudyYears: "3" })).every(o => o.value !== "nhs5"));
  assert.match(q("slBalanceResult").ask(ctxFor(done)), /^That puts what you still owe at about £\d/);
});

// A question shared between modules is asked once: answered, or left as
// "not sure", it isn't asked again in another module.
test("a shared question asked in one module isn't asked again in another, even left unanswered", () => {
  const d = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", employmentStatus: "not_working", notWorkingReason: "break", hasExtraIncome: "no", earnedThisTaxYear: "" };
  // Not given yet: the cash walk-through asks it.
  assert.ok(ids("cash", d).includes("earnedThisYear"));
  // Asked in Pension and left blank: Cash doesn't ask it again.
  assert.equal(ids("cash", { ...d, askedFields: ["earnedThisTaxYear"] }).includes("earnedThisYear"), false);
});

// The student loan walk-through asks age, which sets when repayments started
// and so the write-off date (without it, this April).
test("student loan: not age, where they live or other income", () => {
  const known = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "45000", hasExtraIncome: "no", slPlanAnswer: "plan2", studentLoan: "plan2" };
  // Only what the answer needs: no age, where they live or other income.
  for (const id of ["age", "nation", "extraIncome"]) assert.ok(!ids("studentLoan", known).includes(id), id);
});

// Other income on one screen: only the kinds picked are asked about.
test("other income: one screen, then only the kinds picked", () => {
  const d = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "60000", age: "30" };
  const after = kinds => ids("pension", { ...d, extraIncomeKinds: kinds, hasExtraIncome: kinds.includes("none") ? "no" : "yes" }, d);
  assert.deepEqual(after(["bonus"]).filter(id => ["bonus", "dividends", "otherIncome"].includes(id)), ["bonus"]);
  assert.deepEqual(after(["none"]).filter(id => ["bonus", "dividends", "otherIncome"].includes(id)), []);
});

test("the bonus month is asked once there's a bonus, straight after it", () => {
  const bonus = { ...fresh, hasExtraIncome: "yes", extraIncomeKinds: ["bonus"], bonusAmount: "10000" };
  const list = ids("pension", bonus, fresh);
  assert.equal(list[list.indexOf("bonus") + 1], "bonusMonth");
  assert.ok(!ids("pension", { ...bonus, bonusAmount: "" }, fresh).includes("bonusMonth"));
  assert.ok(!ids("pension", { ...bonus, bonusMonth: "" }, { ...fresh, bonusMonth: "" }).includes("bonusMonth"));
});

test("student loan: a Postgraduate loan alongside Plans 1, 2 and 5, and pay growth asked once", () => {
  const known = { ...fresh, employmentAsked: true, ukNation: "england", scottishTaxpayer: "no", salary: "45000", hasExtraIncome: "no", age: "30", slPlanAnswer: "plan2", studentLoan: "plan2", loanBalance: "40000" };
  // Its balance is asked below a "Yes", on the same screen.
  assert.equal(ids("studentLoan", { ...known, hasPgLoan: "yes" }, known).slice(-1)[0], "hasPgLoan");
  assert.ok(flatQuestions(MODULE_GUIDES.studentLoan.questions).some(q => q.field === "pgLoanBalance"));
  assert.ok(!ids("studentLoan", { ...known, studentLoan: "plan4", slPlanAnswer: "plan4" }, known).includes("hasPgLoan"));
  // Pay growth, once asked anywhere, isn't asked again.
  assert.ok(!ids("studentLoan", known, { ...known, askedFields: ["salaryTrajectory"] }).includes("payGrowth"));
});

test("Kids & family: 'No' ends it; the counts offered never add up to more children than they have", () => {
  const qs = MODULE_GUIDES.kids.questions;
  const q = id => qs.find(x => x.id === id);
  assert.equal(qs[0].id, "kidsStatus");
  assert.equal(q("kidsStatus").endIf("no"), true);
  assert.equal(q("kidsStatus").endIf("planning"), false);
  // With "No", none of the module's own questions would show.
  const none = { ...fresh, kidsStatus: "no", salary: "110000" };
  for (const id of ["kidsCount", "kidsPreschool", "kidsSchool", "childcareBill", "partnerOver100k", "childBenefit"]) {
    assert.equal(q(id).showIf ? q(id).showIf(ctxFor(none)) : true, false, id);
  }
  // Two children, one not at school yet: at most one more at school.
  const two = { ...fresh, kidsStatus: "yes", kidsCount: "2", kidsPreschool: "1" };
  assert.deepEqual(q("kidsSchool").options(ctxFor(two)).map(o => o.value), ["0", "1"]);
  assert.deepEqual(q("kidsPreschool").options(ctxFor(two)).map(o => o.value), ["0", "1", "2"]);
  // All of them not at school yet: the school question isn't asked.
  assert.equal(q("kidsSchool").showIf(ctxFor({ ...two, kidsPreschool: "2" })), false);
  // Planning: no ages or bill asked, but the partner question is.
  const planning = { ...fresh, kidsStatus: "planning" };
  assert.equal(q("kidsCount").showIf(ctxFor(planning)), false);
  assert.equal(q("childcareBill").showIf(ctxFor(planning)), false);
  assert.equal(q("partnerOver100k").showIf(ctxFor(planning)), true);
});

test("student loan, from a link: work, then pay with its growth below, then the loan with its plan below", () => {
  const visitor = { name: "", appEntered: true, selectedModules: [], studentLoan: "none" };
  const list = ids("studentLoan", visitor, visitor);
  assert.deepEqual(list.slice(0, 3), ["employment", "slSalary", "payGrowth"]);
  // The plan and when the course finished are below the balance; pay growth below the salary.
  const flat = flatQuestions(MODULE_GUIDES.studentLoan.questions);
  for (const f of ["slSalary.salaryTrajectory", "loanBalance.slPlanAnswer", "loanBalance.slFinishYear", "hasPgLoan.pgLoanBalance"]) assert.ok(flat.some(q => q.id === f), f);
  // A salary from another module: no employment question.
  assert.ok(!ids("studentLoan", { ...visitor, salary: "40000" }, { ...visitor, salary: "40000" }).includes("employment"));
  // The finish year sets when repayments started, and so the write-off.
  assert.deepEqual(flat.find(q => q.id === "loanBalance.slFinishYear").also("2018"), { slFirstDueYear: "2019" });
});

test("from Student loan: only what its answer uses, each asked once so the module's own walk-through skips it", () => {
  assert.equal(briefQuestions("cash", null), null);
  assert.equal(briefQuestions("investments", "studentLoan"), null);
  const slUser = { ...fresh, employmentAsked: true, salary: "70000", studentLoan: "plan2", loanBalance: "18500" };
  const brief = key => { const qs = briefQuestions(key, "studentLoan"); return visibleQuestions(qs, ctxFor(slUser), neededAtStart(qs, ctxFor(slUser))).map(q => q.id); };
  assert.deepEqual(brief("cash"), ["spending", "cashAccounts"]);
  assert.deepEqual(brief("pension"), ["pensionStatus"]);
  const paying = { ...slUser, pensionStatus: "yes", hasPension: "yes" };
  const qs = briefQuestions("pension", "studentLoan");
  assert.deepEqual(visibleQuestions(qs, ctxFor(paying), neededAtStart(qs, ctxFor(slUser))).map(q => q.id), ["pensionStatus", "pensionContribution", "employerType", "pensionMatch"]);
  // Asked there, the full walk-through starts past them.
  const after = { ...slUser, monthlyExpenses: "1500", cashTiers: [{ amount: "8000", rate: "3" }], askedFields: ["monthlyExpenses", "cashTiers", "pensionStatus"] };
  assert.ok(!ids("cash", after).includes("cashAccounts"));
  assert.ok(!ids("cash", after).includes("spending"));
  assert.ok(!ids("pension", after).includes("pensionStatus"));
});
