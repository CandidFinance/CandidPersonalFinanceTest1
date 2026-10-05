import { test } from "node:test";
import assert from "node:assert/strict";
import { pensionReveal } from "./moduleReveal.js";
import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses } from "./moduleStatus.js";

const base = { selectedModules: ["pension"], salary: "45000", age: "31", retirementAge: "65", monthlyExpenses: "2000", hasPension: "yes", potValue: "40000" };
const reveal = d => { const m = calcMetrics(d); return { steps: pensionReveal(d, m), m, statuses: computeModuleStatuses(d, m) }; };

test("three steps every time: answer, why, what you could do", () => {
  for (const d of [base, { ...base, myContribution: "3", employerMatch: "5" }, { ...base, hasPension: "no" }, { ...base, pensionUnknown: true }]) {
    assert.deepEqual(reveal(d).steps.map(s => s.label), ["Your answer", "Why", "What you could do"]);
  }
});

test("missing match: the figure is the module's own, and the cost after tax relief is shown", () => {
  const { steps, m, statuses } = reveal({ ...base, myContribution: "3", employerMatch: "5" });
  assert.equal(steps[0].figure, "£900 a year");
  assert.equal(statuses.pension.amount, Math.round(m.missedMatch));
  assert.equal(steps[1].title, "Your employer matches up to 5% of your salary. You pay 3%.");
  // 2% of £45,000 is £900; at 20% relief it costs £720.
  assert.match(steps[2].body, /^It would cost you about £720 a year after tax relief\./);
});

test("not paying in: the tax relief figure matches the module's status", () => {
  const { steps, statuses } = reveal({ ...base, hasPension: "no", employerMatch: "4" });
  assert.equal(steps[0].figure, `£${statuses.pension.amount.toLocaleString("en-GB")} a year`);
  assert.equal(steps[2].title, "Paying in 4% of your salary would start it.");
});

test("on track: the projected pot, and nothing to change without a bonus", () => {
  const { steps } = reveal({ ...base, myContribution: "5", employerMatch: "5" });
  assert.match(steps[0].title, /^projected in your pension by 65\.$/);
  assert.equal(steps[2].title, "Nothing to change right now.");
});

test("£100k tax trap: the saving and the sacrifice needed come from the module's own calculation", () => {
  const { steps } = reveal({ ...base, salary: "110000", myContribution: "5", employerMatch: "5" });
  assert.match(steps[0].title, /^of tax you could save\.$/);
  assert.match(steps[2].title, /through salary sacrifice would bring your income back to £100,000\./);
});

import { cashReveal, investmentsReveal, studentLoanReveal, MODULE_REVEALS } from "./moduleReveal.js";
import { calcCashOptimisation } from "./cash.js";
import { calcStudentLoanScenario } from "./studentLoan.js";

const rates = { isaRate: 4.5, nonIsaRate: 4.6 };
const run = (d, fn) => { const m = calcMetrics(d, rates); return { steps: fn(d, m, { marketRates: rates }), m, statuses: computeModuleStatuses(d, m, rates) }; };
const cashBase = { selectedModules: ["cash"], salary: "45000", monthlyExpenses: "2000" };

test("every module has a reveal of three steps", () => {
  assert.deepEqual(Object.keys(MODULE_REVEALS).sort(), ["cash", "investments", "pension", "studentLoan"]);
});

test("cash: an emergency fund short of target comes first, with the shortfall the screen shows", () => {
  const { steps, m } = run({ ...cashBase, cashTiers: [{ amount: "5000", rate: "4" }] }, cashReveal);
  assert.equal(steps[0].figure, `£${Math.round(m.emergencyShortfall).toLocaleString("en-GB")}`);
  assert.match(steps[0].title, /^short of your 6-month emergency fund\.$/);
});

test("cash: better rates, with the same gain as the screen's own calculation", () => {
  const { steps, m } = run({ ...cashBase, cashTiers: [{ amount: "20000", rate: "1" }] }, cashReveal);
  const opt = calcCashOptimisation(m, rates.isaRate, rates.nonIsaRate);
  assert.equal(steps[0].figure, `£${Math.round(opt.optimisationGain).toLocaleString("en-GB")} a year`);
  assert.match(steps[1].title, /best rates today are 4\.50?% in a Cash ISA/);
});

test("investments: tax-free profit first, the saving matching the module's amount", () => {
  const d = { selectedModules: ["investments"], salary: "60000", hasInvestments: "yes", unwrappedValue: "30000", unrealisedGains: "8000" };
  const { steps, statuses } = run(d, investmentsReveal);
  assert.equal(steps[0].figure, `£${statuses.investments.amount.toLocaleString("en-GB")}`);
  assert.match(steps[2].title, /^Taking £3,000 of that profit before 5 April/);
});

test("investments: no gains, so the ISA allowance", () => {
  const { steps } = run({ selectedModules: ["investments"], salary: "45000", hasInvestments: "yes", isaThisYearSS: "5000" }, investmentsReveal);
  assert.equal(steps[0].figure, "£15,000");
});

test("student loan: none means nothing to explain; otherwise the screen's own scenario", () => {
  assert.equal(run({ selectedModules: ["studentLoan"], salary: "45000", studentLoan: "none" }, studentLoanReveal).steps, null);
  const loan = (salary, loanBalance, studentLoan) => run({ selectedModules: ["studentLoan"], salary, studentLoan, loanBalance }, studentLoanReveal);
  // £50,000 of Plan 2 on £45,000: written off before it's cleared.
  assert.equal(loan("45000", "50000", "plan2").steps[0].title, "You're not expected to clear this loan before it's written off.");
  // £20,000 of Plan 2 on £24,000: below the threshold.
  assert.equal(loan("24000", "20000", "plan2").steps[0].title, "Nothing comes off your pay yet.");
  // £8,000 of Plan 1 on £60,000: clears in 3 years, the same figure as the scenario.
  const { steps, m } = loan("60000", "8000", "plan1");
  assert.equal(calcStudentLoanScenario({ studentLoan: "plan1", loanBalance: "8000", salary: "60000" }, m).clearYr, 3);
  assert.equal(steps[0].figure, "3 years");
});
