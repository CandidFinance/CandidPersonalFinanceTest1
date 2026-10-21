// ── Repayment plans for a student loan (subscribers' scenario modelling) ───
// A plan is one-off payments in the years chosen and monthly payments over a
// run of years, saved with their answers (d.slPlans, up to MAX_PLANS; the
// one drawn on the chart is d.slPlanShown). Run year by year on the same
// figures as the module's own projection (studentLoan.js
// calcStudentLoanScenario's schedule: each year's rate and repayment), and
// the same way as a lump sum today (calcOverpaymentScenarios), which is a
// plan of one payment now.
//
// Payments land on the year boundaries the projection steps on: index 0 is
// now, index k the start of tax year taxYear + k (the end of year k). A
// one-off in April Y lands at Y - taxYear; a year of monthly payments in tax
// year Y, totalled, at its end, Y - taxYear + 1. Once the loan is cleared
// nothing more is paid in. Shapes:
//   plan  { id, name, items: [{ id, kind: "once", amount, year }
//                             | { id, kind: "monthly", amount, from, to }] }
//   `to` "" for until it's cleared (or written off).

export const MAX_PLANS = 3;
export const PLAN_NAMES = ["Plan A", "Plan B", "Plan C"];

// Each index's payment in, from now (0) to the loan's write-off.
export function planExtras(plan, taxYear, writeOffYr) {
  const extras = Array(writeOffYr + 1).fill(0);
  for (const it of plan?.items || []) {
    const amount = +it.amount || 0;
    if (!(amount > 0)) continue;
    if (it.kind === "once") {
      const at = Math.max(0, (+it.year || taxYear) - taxYear);
      if (at <= writeOffYr) extras[at] += amount;
    } else if (it.kind === "monthly") {
      const from = Math.max(taxYear, +it.from || taxYear);
      const to = +it.to > 0 ? +it.to : taxYear + writeOffYr;
      for (let y = from; y <= to; y++) {
        const at = y - taxYear + 1;
        if (at >= 1 && at <= writeOffYr) extras[at] += amount * 12;
      }
    }
  }
  return extras;
}

// The loan year by year with `extras` paid in: its balance (path), the
// repayments from pay each year, what each payment in actually went on
// (absorbed: no more than was owed), and in all, and valued as of today at
// the module's savings rate (paidToday), as calcOverpaymentScenarios does.
export function projectPlan(m, sl, extras = []) {
  const disc = 1 + (sl.cashRate || 0) / 100;
  let bal = Math.max(0, m.loanBal);
  const absorbed = Array(Math.max(1, sl.writeOffYr + 1)).fill(0);
  absorbed[0] = Math.min(extras[0] || 0, bal);
  bal -= absorbed[0];
  const repayments = [];
  const path = [{ yr: 0, bal: Math.round(bal) }];
  let clearYr = bal <= 0 ? 0 : null, writeOffBal = 0;
  for (let yr = 1; yr <= sl.writeOffYr && bal > 0; yr++) {
    const { rate = sl.slInterestRate, repayment = sl.annualRep } = sl.schedule?.[yr - 1] || {};
    bal *= 1 + rate;
    const paid = Math.min(repayment, bal);
    bal -= paid;
    repayments.push(paid);
    if (bal > 0 && extras[yr] > 0) {
      absorbed[yr] = Math.min(extras[yr], bal);
      bal -= absorbed[yr];
    }
    path.push({ yr, bal: Math.round(Math.max(0, bal)) });
    if (bal <= 0) { clearYr = yr; break; }
    if (yr === sl.writeOffYr) writeOffBal = bal;
  }
  const paidIn = absorbed.reduce((t, a) => t + a, 0);
  const totalPaid = paidIn + repayments.reduce((t, p) => t + p, 0);
  const paidToday = absorbed.reduce((t, a, k) => t + a / Math.pow(disc, k), 0)
    + repayments.reduce((t, p, i) => t + p / Math.pow(disc, i + 1), 0);
  return { path, repayments, absorbed, paidIn: Math.round(paidIn), totalPaid: Math.round(totalPaid), paidToday: Math.round(paidToday), clearYr, writeOffBal: Math.round(writeOffBal) };
}

// A plan run against the loan as it is: its projection, and the base's.
export function runPlan(m, sl, plan) {
  const taxYear = sl.writeOffTaxYear - sl.writeOffYr;
  const run = projectPlan(m, sl, planExtras(plan, taxYear, sl.writeOffYr));
  return { ...run, base: projectPlan(m, sl, []) };
}

// The plan's payments in, as they were actually made: [{ at, amount }].
export const planEvents = run => run.absorbed.map((amount, at) => ({ at, amount })).filter(e => e.amount > 0);

// A new plan, named for the first free letter.
export function newPlan(plans = []) {
  const name = PLAN_NAMES.find(n => !plans.some(p => p.name === n)) || `Plan ${plans.length + 1}`;
  return { id: `p${Date.now().toString(36)}`, name, items: [] };
}
