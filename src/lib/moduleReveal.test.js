import { test } from "node:test";
import assert from "node:assert/strict";
import { pensionReveal, kidsReveal } from "./moduleReveal.js";
import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses } from "./moduleStatus.js";

const base = { selectedModules: ["pension"], salary: "45000", age: "31", retirementAge: "65", monthlyExpenses: "2000", hasPension: "yes", potValue: "40000" };
const reveal = d => { const m = calcMetrics(d); return { steps: pensionReveal(d, m), m, statuses: computeModuleStatuses(d, m) }; };

test("three steps every time: answer, why, what you could do", () => {
  for (const d of [base, { ...base, myContribution: "3", employerMatch: "5" }, { ...base, hasPension: "no" }, { ...base, pensionUnknown: true }]) {
    assert.deepEqual(reveal(d).steps.map(s => s.label), ["Your position", "Why", "What you could do"]);
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
  assert.match(steps[2].body, /^Checked: you get your employer's full match, you're under the £100,000 tax trap and your pot isn't near the limit on tax-free cash\./);
});

// Child Benefit and childcare are Kids & family's: the answer there, never
// counted in Pension's figure as well.
const family = { ...base, selectedModules: ["pension", "kids"], answeredModules: ["pension", "kids"], myContribution: "5", employerMatch: "5", pensionType: "sacrifice", ukNation: "england" };
const kids = d => { const m = calcMetrics(d); return { steps: kidsReveal(d, m), m, statuses: computeModuleStatuses(d, m) }; };

test("Child Benefit charge: Kids & family's answer, and the pension payment that keeps it", () => {
  const d = { ...family, salary: "70000", childBenefitChildren: "2", cbHigherEarner: "yes" };
  const { steps, statuses } = kids(d);
  // £70,000 less £3,500 sacrificed: £66,500, 32% of £2,337 (two children).
  assert.equal(steps[0].figure, "£748 a year");
  assert.match(steps[2].title, /Paying £6,500 more into your pension would bring your income to £60,000/);
  assert.equal(statuses.kids.amount, 748);
  assert.equal(statuses.pension.amount, reveal({ ...d, childBenefitChildren: "0" }).statuses.pension.amount);
  // A partner who earns more pays it instead: nothing here to explain.
  assert.equal(kids({ ...d, cbHigherEarner: "no" }).steps, null);
});

test("over £100,000 with a toddler in England: the childcare that stops, counted by the £100k tax trap", () => {
  const d = { ...family, salary: "110000", kidsPreschool: "1", kidsSchool: "0", childcareMonthly: "1500", partnerOver100k: "no" };
  const { steps, statuses, m } = kids(d);
  // £110,000 less £5,500 sacrificed: £104,500. £2,000 + £8,290.
  assert.equal(steps[0].figure, "£10,290 a year");
  assert.equal(steps[0].title, "of childcare support stops while your income is over £100,000.");
  assert.match(steps[1].title, /^Tax-Free Childcare and the 30 funded hours stop for the whole year once either parent's income is over £100,000\. Yours is £104,500\.$/);
  assert.match(steps[2].title, /^The £100k tax trap shows the ways back under £100,000/);
  // Not Kids & family's figure, nor Pension's: the tax trap's, with the tax.
  // Kids & family says where it is rather than "On track".
  assert.equal(statuses.kids.amount, 0);
  assert.equal(statuses.kids.elsewhere, "taxTrap");
  // £900 of tax on the £2,250 of allowance lost, and the £10,290.
  const trap = taxTrapReveal(d, m);
  assert.equal(trap[0].figure, "£11,190 a year");
  assert.equal(trap[0].title, "is what the £100k trap costs you.");
  assert.match(trap[2].title, /^Paying £4,500 into your pension would bring your income back to £100k\.$/);
  assert.match(trap[2].body, /^It costs £1,710 of take-home, and your pension gains £4,500\. Your childcare support comes back too\.$/);
});

test("Tax-Free Childcare not claimed, a partner over £100,000, and close to the line", () => {
  const unclaimed = kids({ ...family, salary: "60000", kidsPreschool: "0", kidsSchool: "1", childcareMonthly: "400", partnerOver100k: "no", tfcClaiming: "no" });
  assert.equal(unclaimed.steps[0].figure, "£960 a year");
  assert.match(unclaimed.steps[0].title, /Tax-Free Childcare you could claim/);
  // A partner over £100,000 whose income isn't known: the support is still
  // theirs to get, and the answer says what would open it up.
  const partner = kids({ ...family, salary: "60000", kidsPreschool: "1", partnerOver100k: "yes" });
  assert.equal(partner.steps[0].title, "of childcare support you and your partner could get.");
  assert.match(partner.steps[2].title, /A pension payment from your partner that brings their income to £100,000 would open it up/);
  assert.equal(partner.statuses.kids.amount, 0);
  const near = kids({ ...family, salary: "100000", kidsPreschool: "1", partnerOver100k: "no", tfcClaiming: "yes", childcareMonthly: "1500" });
  assert.match(near.steps[1].title, /^You're £5,000 under it\./);
  assert.equal(near.steps[2].title, "Nothing to change right now.");
});

test("Wales: the Childcare Offer isn't counted, and the answer says why", () => {
  const { steps } = kids({ ...family, salary: "110000", ukNation: "wales", kidsPreschool: "1", childcareMonthly: "1500", partnerOver100k: "no" });
  assert.equal(steps[0].figure, "£2,000 a year");
  assert.match(steps[1].body, /tested on gross income/);
});

test("retirement: short of the target says by how much, and roughly what would close it", () => {
  const { steps } = reveal({ ...base, age: "37", salary: "85000", myContribution: "3", employerMatch: "3", potValue: "8000", retirementTarget: "45400" });
  assert.match(steps[0].title, /^short of the £45,400 a year you'd like in retirement\.$/);
  assert.match(steps[2].title, /^Paying in about \d+% more of your salary would close it\.$/);
});

test("£100k tax trap: the cost and the payment needed come from the module's own calculation", () => {
  const d = { ...base, salary: "110000", myContribution: "5", employerMatch: "5", selectedModules: ["taxTrap"] };
  const { steps, statuses } = run(d, taxTrapReveal);
  assert.equal(steps[0].title, "is what the £100k trap costs you.");
  assert.equal(steps[0].figure, `£${statuses.taxTrap.amount.toLocaleString("en-GB")} a year`);
  assert.match(steps[1].title, /so your marginal tax rate is 62%: for every extra £1 you earn, 62p is lost to tax and National Insurance \(60% tax and 2% National Insurance\)\.$/);
  assert.match(steps[2].title, /^Paying £4,500 into your pension would bring your income back to £100k\.$/);
  // Pension no longer counts it.
  assert.equal(reveal(d).statuses.pension.amount, 0);
  // Under £100,000: how far, and the rate past it.
  const near = run({ ...d, salary: "95000" }, taxTrapReveal).steps;
  assert.match(near[0].title, /^under £100k, where your marginal tax rate jumps to 62%\.$/);
});

import { cashReveal, investmentsReveal, studentLoanReveal, taxTrapReveal, MODULE_REVEALS } from "./moduleReveal.js";
import { calcCashOptimisation } from "./cash.js";
import { calcStudentLoanScenario } from "./studentLoan.js";

const rates = { isaRate: 4.5, nonIsaRate: 4.6 };
const run = (d, fn) => { const m = calcMetrics(d, rates); return { steps: fn(d, m, { marketRates: rates }), m, statuses: computeModuleStatuses(d, m, rates) }; };
const cashBase = { selectedModules: ["cash"], salary: "45000", monthlyExpenses: "2000" };

test("every module has a reveal of three steps", () => {
  assert.deepEqual(Object.keys(MODULE_REVEALS).sort(), ["cash", "investments", "kids", "pension", "studentLoan", "taxTrap"]);
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
  assert.match(steps[1].title, /highest rates today are 4\.50?% in a Cash ISA/);
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
  // £50,000 of Plan 2 on £45,000: written off before it's cleared, led by
  // what they'd repay in all, the scenario's own figures.
  const w = loan("45000", "50000", "plan2");
  const wsl = calcStudentLoanScenario({ selectedModules: ["studentLoan"], salary: "45000", studentLoan: "plan2", loanBalance: "50000" }, w.m);
  assert.equal(w.steps[0].figure, `£${wsl.totalRepaidProjected.toLocaleString("en-GB")}`);
  assert.equal(w.steps[0].title, `you're expected to repay in all, before about £${wsl.writeOffBal.toLocaleString("en-GB")} is written off in April ${wsl.writeOffTaxYear}.`);
  assert.match(w.steps[1].title, /^Repayments are 9% of your pay over £29,385, about £1,405 a year now, while interest adds about £3,000\.$/);
  // £20,000 of Plan 2 on £24,000: below the threshold.
  assert.equal(loan("24000", "20000", "plan2").steps[0].title, "Nothing comes off your pay yet.");
  // £8,000 of Plan 1 on £60,000: clears in 3 years, the same figure as the scenario.
  const { steps, m } = loan("60000", "8000", "plan1");
  const p1 = calcStudentLoanScenario({ studentLoan: "plan1", loanBalance: "8000", salary: "60000" }, m);
  assert.equal(p1.clearYr, 3);
  // It leads with what it'll cost in all, against what's owed today.
  assert.equal(steps[0].figure, `£${p1.totalRepaidProjected.toLocaleString("en-GB")}`);
  assert.equal(steps[0].title, "you're expected to repay in all, clearing it in 3 years.");
  assert.match(steps[0].body, /^That's £[\d,]+ of interest on top of the £8,000 you owe today\./);
  // Without their savings and pension match, no verdict: what would give one.
  assert.match(steps[2].title, /needs a few more details/);
});

// Retired, with a pot and no salary: not a gap, and the answer is the
// tax-free cash, capped by the Lump Sum Allowance above £1,073,100.
const retired = { ...base, age: "69", salary: "0", employmentStatus: "not_working", myContribution: "0", employerMatch: "0" };

test("retired with no earnings: not critical, and no £0 of tax relief", () => {
  const { steps, statuses } = reveal({ ...retired, potValue: "1000000" });
  assert.equal(statuses.pension.status, "ok");
  assert.equal(statuses.pension.amount, 0);
  // The answer is the drawdown strategy; the tax-free cash is in the why.
  assert.match(steps[0].figure, /a year$/);
  assert.match(steps[0].title, /^after tax from your pension, drawn over/);
  assert.match(steps[1].body, /^£250,000 can be taken tax-free/);
});

test("retired above £1,073,100: tax-free cash stops at £268,275", () => {
  const { steps, statuses } = reveal({ ...retired, potValue: "2000000" });
  assert.equal(statuses.pension.status, "ok");
  assert.match(statuses.pension.impactLabel, /£268,275: £231,725 less than 25% of your pot/);
  assert.match(steps[1].body, /^£268,275 can be taken tax-free: 25% stops at the Lump Sum Allowance/);
});

test("still earning past retirement age with nothing paid in: the relief gap stands", () => {
  const { statuses } = reveal({ ...retired, salary: "40000", employmentStatus: "employed", potValue: "1100000" });
  assert.equal(statuses.pension.status, "critical");
  // £40,000 plus the full State Pension (£12,548) is a higher-rate income.
  assert.match(statuses.pension.impactLabel, /^Nothing paid in: £800\/yr/);
});

test("no pot and no earnings: nothing to explain", () => {
  assert.equal(reveal({ ...retired, potValue: "0" }).steps, null);
});

test("student loan with a Postgraduate loan: the why says what it adds, and its overpaying counts", () => {
  const d = { selectedModules: ["studentLoan"], answeredModules: ["studentLoan"], salary: "48000", age: "30", studentLoan: "plan2", loanBalance: "45000", hasPgLoan: "yes", pgLoanBalance: "14000" };
  const { steps } = run(d, studentLoanReveal);
  // 6% of £27,000 over £21,000: £1,620 a year.
  assert.match(steps[1].body, /Your Postgraduate loan is repaid at the same time: about £1,620 a year now \(6% of pay over £21,000\)/);
  assert.equal(run({ ...d, hasPgLoan: "no" }, studentLoanReveal).steps[1].body, undefined);
});

test("student loan: below the threshold is 'ok', with nothing to act on", () => {
  const { statuses } = run({ selectedModules: ["studentLoan"], answeredModules: ["studentLoan"], salary: "24000", studentLoan: "plan2", loanBalance: "40000" }, studentLoanReveal);
  assert.equal(statuses.studentLoan.status, "ok");
});

test("a partner over £100,000 with their income known: the payment from them that opens it up, and what it's worth as pay", () => {
  const d = { ...family, salary: "70000", kidsPreschool: "1", kidsSchool: "0", childcareMonthly: "1500", partnerOver100k: "yes", partnerIncome: "112000" };
  const { steps, statuses } = kids(d);
  assert.equal(steps[0].figure, "£10,290 a year");
  assert.equal(steps[0].title, "of childcare support you and your partner could get.");
  // At their 60% rate plus 2% National Insurance: £10,290 / 0.38.
  assert.match(steps[1].body, /^It's worth the same as about £27,080 of pay before tax\./);
  assert.match(steps[2].title, /^A pension payment of £12,000 from your partner \(including the tax relief added\) would bring their income to £100,000\.$/);
  assert.equal(statuses.kids.amount, 10290);
  assert.equal(statuses.kids.status, "critical");
});

test("no children and none planned: nothing to explain, and the module reads 'Not applicable'", () => {
  const { steps, statuses } = kids({ ...family, salary: "110000", kidsStatus: "no", kidsPreschool: "1", childBenefitChildren: "2", cbHigherEarner: "yes" });
  assert.equal(steps, null);
  assert.equal(statuses.kids.status, "na");
  assert.equal(statuses.kids.notApplicable, true);
  assert.equal(statuses.kids.amount, 0);
});

test("planning a child: what they could get once it arrives, not counted as money at stake yet", () => {
  const fine = kids({ ...family, salary: "60000", kidsStatus: "planning", partnerOver100k: "no" });
  assert.equal(fine.steps[0].figure, "£10,290 a year");
  assert.equal(fine.steps[0].title, "of childcare support you could get once your child arrives.");
  assert.equal(fine.statuses.kids.amount, 0);
  const over = kids({ ...family, salary: "110000", kidsStatus: "planning", partnerOver100k: "no" });
  assert.equal(over.steps[0].title, "of childcare support you could get once your child arrives.");
  assert.match(over.steps[2].title, /^A pension payment of £4,500/);
});

test("student loan: a loan worth paying off gives its cost, then the verdict once their savings and pension match are in", () => {
  // A small Plan 2 loan on a high salary: it clears by itself and paying it
  // off comes out ahead, but only once their savings and match are known.
  const d = { selectedModules: ["studentLoan"], answeredModules: ["studentLoan"], salary: "70000", studentLoan: "plan2", loanBalance: "18500", studentLoanRate: "6.4" };
  const before = run(d, studentLoanReveal).steps;
  assert.match(before[2].title, /needs a few more details/);
  // Savings alone isn't enough for someone employed: the match comes first.
  assert.match(run({ ...d, askedFields: ["cashTiers"] }, studentLoanReveal).steps[2].title, /needs a few more details/);
  // Both modules answered, or only their questions on the short route.
  const all = ["studentLoan", "cash", "pension"];
  for (const answered of [{ selectedModules: all, answeredModules: all }, { askedFields: ["cashTiers", "pensionStatus"] }]) {
    const after = run({ ...d, ...answered }, studentLoanReveal).steps;
    assert.doesNotMatch(after[2].title, /needs a few more details/);
  }
  // Self-employed: no match to check, so savings alone.
  assert.doesNotMatch(run({ ...d, employmentStatus: "self_employed", askedFields: ["cashTiers"] }, studentLoanReveal).steps[2].title, /needs a few more details/);
});
