// Student loan's quick start: four one-tap questions in bands (plan, salary,
// balance, when the course finished) that give a first answer from the
// middle of each band, before any exact figures. Pure logic, unit tested in
// studentLoanQuick.test.js; the screens are the quick-start engine's
// (mobile/QuickStart.jsx), with STUDENT_LOAN_QUICK below.
//
// The answer is worked out by the usual calculations from the figures these
// write. `slEstimate` keeps the bands chosen and the figures written for
// them, so the answer page can say which figures are estimates, and stops
// saying so for any the user has since changed (estimatedNow).
import { studentLoanPlanFrom, slFinishYearRange } from "./studentLoan.js";
import { SALARY_BANDS, SALARY_DEFAULT, MEDIAN_BANDS } from "./quickStart.js";

export const PLAN_CHOICES = [
  { value:"plan1", label:"Plan 1" },
  { value:"plan2", label:"Plan 2" },
  { value:"plan4", label:"Plan 4", sub:"Scotland" },
  { value:"plan5", label:"Plan 5" },
  { value:"postgrad", label:"Postgraduate" },
  { value:"unsure", label:"Not sure" },
];

// "Not sure": one question, by GOV.UK's rules (studentLoanPlanFrom). Each
// choice is the answers the full plan helper would have had.
export const PLAN_HELPER_CHOICES = [
  { value:"pre2012", label:"Before September 2012", answers:{ slCountry:"england", slCourse:"undergrad", slStart:"pre2012" } },
  { value:"2012to2023", label:"September 2012 to July 2023", answers:{ slCountry:"england", slCourse:"undergrad", slStart:"2012to2023" } },
  { value:"2023on", label:"August 2023 or later", answers:{ slCountry:"england", slCourse:"undergrad", slStart:"2023on" } },
  { value:"postgrad", label:"A Master's or PhD loan", answers:{ slCountry:"england", slCourse:"postgrad", slStart:"" } },
  { value:"scotland", label:"I applied from Scotland", answers:{ slCountry:"scotland", slCourse:"", slStart:"" } },
  { value:"ni", label:"I applied from Northern Ireland", answers:{ slCountry:"ni", slCourse:"", slStart:"" } },
];
export const helperChoicePlan = value => {
  const c = PLAN_HELPER_CHOICES.find(o => o.value === value);
  return c ? studentLoanPlanFrom({ country: c.answers.slCountry, course: c.answers.slCourse, start: c.answers.slStart }) : null;
};

export const BALANCE_BANDS = [
  { value:"u10", label:"Under £10k", figure:6000 },
  { value:"10-20", label:"£10k to £20k", figure:15000 },
  { value:"20-40", label:"£20k to £40k", figure:30000 },
  { value:"40-60", label:"£40k to £60k", figure:50000 },
  { value:"60-80", label:"£60k to £80k", figure:70000 },
  { value:"80+", label:"£80k or more", figure:90000 },
  { value:"unsure", label:"Not sure" },
];

// When the course finished: only the bands the plan allows, each one's
// year kept inside the plan's range.
export function finishBands(plan, year = new Date().getFullYear()) {
  const { min, max } = slFinishYearRange(plan, year);
  return [
    { value:"pre2015", label:"Before 2015", from:1990, to:2014, figure:2010 },
    { value:"2015-19", label:"2015 to 2019", from:2015, to:2019, figure:2017 },
    { value:"2020-23", label:"2020 to 2023", from:2020, to:2023, figure:2022 },
    { value:"2024on", label:`2024 to ${year}`, from:2024, to:year, figure:year - 1 },
    { value:"studying", label:"Still studying", from:year + 1, to:year + 5, figure:year + 1 },
  ].filter(b => b.to >= min && b.from <= max)
   .map(b => ({ ...b, figure: Math.min(max, Math.max(min, b.figure)) }));
}

// Which questions to ask: only what Candid doesn't have yet.
export function quickQuestions(d) {
  return [
    (!d.studentLoan || d.studentLoan === "none") && "plan",
    !(+d.salary > 0) && "salary",
    !(+d.loanBalance > 0) && d.slBalanceEstimate !== "yes" && "balance",
    !(+d.slFinishYear > 0) && "finish",
  ].filter(Boolean);
}

// Everything the answers write, as one patch. `a`: { plan, helper, salary,
// balance, finish }, each a choice's value (missing for a question not
// asked).
export function quickPatch(d, a, year = new Date().getFullYear()) {
  const patch = {};
  const est = { bands: {}, values: {} };
  if (a.plan) {
    patch.slPlanAnswer = a.plan;
    if (a.plan === "unsure") {
      const c = PLAN_HELPER_CHOICES.find(o => o.value === a.helper);
      if (c) Object.assign(patch, c.answers);
      const plan = helperChoicePlan(a.helper);
      if (plan) patch.studentLoan = plan;
    } else patch.studentLoan = a.plan;
  }
  const plan = patch.studentLoan || d.studentLoan;
  if (!d.employmentStatus) patch.employmentStatus = "employed";
  if (!d.salaryTrajectory) patch.salaryTrajectory = "moderate";
  const salary = SALARY_BANDS.find(b => b.value === a.salary);
  if (salary) {
    patch.salary = String(salary.figure);
    est.bands.salary = salary.label;
    est.values.salary = patch.salary;
  }
  const finish = finishBands(plan, year).find(b => b.value === a.finish);
  if (finish) {
    patch.slFinishYear = String(finish.figure);
    patch.slFirstDueYear = String(finish.figure + 1);
    est.bands.finish = finish.label;
    est.values.slFinishYear = patch.slFinishYear;
  }
  const balance = BALANCE_BANDS.find(b => b.value === a.balance);
  if (balance?.figure) {
    patch.loanBalance = String(balance.figure);
    patch.slBalanceEstimate = "";
    est.bands.balance = balance.label;
    est.values.loanBalance = patch.loanBalance;
  } else if (balance) {
    // Not sure: Candid's own estimate from a typical course (estimateSlBalance).
    Object.assign(patch, { loanBalance: "", slBalanceEstimate: "yes", slStudyYears: plan === "postgrad" ? "1" : "3", slTuition: "full", slMaintenance: "half" });
    est.bands.balance = "estimated from a typical course";
    est.values.slBalanceEstimate = "yes";
  }
  patch.slEstimate = est;
  return patch;
}

// The estimated figures still in use: those the user hasn't changed since.
export function estimatedNow(d) {
  const est = d.slEstimate;
  if (!est?.values) return [];
  const still = { salary: "salary", finish: "slFinishYear", balance: est.values.loanBalance ? "loanBalance" : "slBalanceEstimate" };
  return ["salary", "balance", "finish"]
    .filter(key => est.bands[key] && String(d[still[key]] ?? "") === String(est.values[still[key]] ?? ""))
    .map(key => ({ key, band: est.bands[key] }));
}

// The line under the answer: which figures are estimates, in bands.
export function estimateLine(d) {
  const parts = estimatePhrases(d);
  return parts.length ? `Based on estimates: ${parts.join(", ")}.` : null;
}
export function estimatePhrases(d) {
  return estimatedNow(d).map(({ key, band }) =>
    key === "salary" ? `${band} salary` : key === "balance" ? (band.startsWith("£") ? `${band} owed` : `balance ${band}`) : band === "Still studying" ? "still studying" : `finished ${band}`);
}

// The setup for the quick-start engine (quickStart.js). Its estimates stay
// in slEstimate, as before the engine.
const planFrom = ({ d, a }) => a.plan === "unsure" ? helperChoicePlan(a.helper) : a.plan || d.studentLoan;
export const STUDENT_LOAN_QUICK = {
  module: "studentLoan",
  intro: { title: "Student loan", subtitle: "After a home, it's likely the biggest thing you'll ever buy.", question: "Is paying it off early worth it for you?" },
  order: ["plan", "helper", "salary", "balance", "finish"],
  questions: {
    plan:    { ask: "Which student loan plan are you on?", why: "Your Student Loans Company account shows it.", options: () => PLAN_CHOICES, default: () => MEDIAN_BANDS.slPlan, when: ({ d }) => quickQuestions(d).includes("plan") },
    helper:  { ask: "When did your course start?", why: "That decides your plan, by GOV.UK's rules.", options: () => PLAN_HELPER_CHOICES, when: ({ a }) => a.plan === "unsure" },
    salary:  { ask: "Roughly what do you earn a year, before tax?", why: "Repayments are a share of your pay over a threshold.", options: () => SALARY_BANDS, default: () => SALARY_DEFAULT, when: ({ d }) => quickQuestions(d).includes("salary") },
    balance: { ask: "Roughly how much do you still owe?", why: "Your Student Loans Company account shows it. A band is fine.", options: () => BALANCE_BANDS, default: () => MEDIAN_BANDS.slBalance, when: ({ d }) => quickQuestions(d).includes("balance") },
    finish:  { ask: "When did you finish your course?", why: "Whatever's left is written off a set number of years after.", options: ctx => finishBands(planFrom(ctx)), when: ({ d }) => quickQuestions(d).includes("finish") },
  },
  patch: (d, m, a) => quickPatch(d, a),
  estimateLine,
};
