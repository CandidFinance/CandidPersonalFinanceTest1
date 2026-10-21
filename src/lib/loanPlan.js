// ── Repayment plans for a student loan (subscribers' scenario modelling) ───
// A plan is one-off payments in the months chosen and one run of monthly
// payments, saved with their answers (d.slPlans, up to MAX_PLANS; the one
// drawn on the chart is d.slPlanShown). Run year by year on the same
// figures as the module's own projection (studentLoan.js
// calcStudentLoanScenario's schedule: each year's rate and repayment from
// pay, taken at each year's end), and the same way as a lump sum today
// (calcOverpaymentScenarios), which is a plan of one payment now.
//
// Each payment is placed in time, `t` years from now (a month a twelfth),
// so one paid partway through a year saves that year's interest on it for
// the part of the year left. A monthly run pays at the end of each month
// from its start (April of `from`, or now if that's passed) to April after
// `to`, or until the loan's cleared (`to` ""). Once it's cleared nothing more
// is paid in. Shapes:
//   plan  { id, name, items: [{ id, kind: "once", amount, month, year }
//                             | { id, kind: "monthly", amount, from, to }] }
//   `month` 1 to 12 (April when missing, as plans were first saved).

export const MAX_PLANS = 3;
export const PLAN_NAMES = ["Plan A", "Plan B", "Plan C"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Whole months from now (this month 0) to the start of `month` in `year`.
export const monthsFrom = (now, year, month) => (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());

// The plan's payments, [{ t, amount }], earliest first, up to `years` on.
export function planPayments(plan, years, now = new Date()) {
  const out = [];
  for (const it of plan?.items || []) {
    const amount = +it.amount || 0;
    if (!(amount > 0)) continue;
    if (it.kind === "once") {
      const t = Math.max(0, monthsFrom(now, +it.year, +it.month || 4)) / 12;
      if (t < years) out.push({ t, amount });
    } else if (it.kind === "monthly") {
      const start = Math.max(0, monthsFrom(now, +it.from, 4));
      const end = +it.to > 0 ? monthsFrom(now, +it.to + 1, 4) : years * 12;
      for (let k = start; k < Math.min(end, years * 12); k++) out.push({ t: (k + 1) / 12, amount });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

// The loan year by year with `payments` made: its balance (path), the
// repayments from pay each year, what each payment actually went on (paid:
// no more than was owed), and in all, and valued as of today at the module's
// savings rate (paidToday), as calcOverpaymentScenarios does.
export function projectPlan(m, sl, payments = []) {
  const disc = 1 + (sl.cashRate || 0) / 100;
  let bal = Math.max(0, m.loanBal);
  const paid = payments.map(p => ({ t: p.t, amount: 0 }));
  payments.forEach((p, i) => { if (p.t <= 0) { paid[i].amount = Math.min(p.amount, bal); bal -= paid[i].amount; } });
  const repayments = [];
  const path = [{ yr: 0, bal: Math.round(bal) }];
  let clearYr = bal <= 0 ? 0 : null, writeOffBal = 0;
  for (let yr = 1; yr <= sl.writeOffYr && bal > 0; yr++) {
    const { rate = sl.slInterestRate, repayment = sl.annualRep } = sl.schedule?.[yr - 1] || {};
    // The year's end balance, each payment in it taken off with the interest
    // it saves for the rest of the year.
    let end = bal * (1 + rate);
    payments.forEach((p, i) => {
      if (p.t <= yr - 1 || p.t > yr || end <= 0) return;
      const k = Math.pow(1 + rate, yr - p.t);
      paid[i].amount = Math.min(p.amount, end / k);
      end -= paid[i].amount * k;
    });
    const fromPay = Math.min(repayment, Math.max(0, end));
    end -= fromPay;
    repayments.push(fromPay);
    bal = Math.max(0, end);
    path.push({ yr, bal: Math.round(bal) });
    if (bal <= 1e-6) { bal = 0; clearYr = yr; break; }
    if (yr === sl.writeOffYr) writeOffBal = bal;
  }
  const paidIn = paid.reduce((t, p) => t + p.amount, 0);
  const totalPaid = paidIn + repayments.reduce((t, p) => t + p, 0);
  const paidToday = paid.reduce((t, p) => t + p.amount / Math.pow(disc, p.t), 0)
    + repayments.reduce((t, p, i) => t + p / Math.pow(disc, i + 1), 0);
  return { path, repayments, paid, paidIn: Math.round(paidIn), totalPaid: Math.round(totalPaid), paidToday: Math.round(paidToday), clearYr, writeOffBal: Math.round(writeOffBal) };
}

// A plan run against the loan as it is: its projection, and the base's.
export function runPlan(m, sl, plan, now = new Date()) {
  const run = projectPlan(m, sl, planPayments(plan, sl.writeOffYr, now));
  return { ...run, base: projectPlan(m, sl, []) };
}

// The plan's payments as they were actually made: [{ t, amount }].
export const planEvents = run => run.paid.filter(p => p.amount > 0);

// A new plan, named for the first free letter.
export function newPlan(plans = []) {
  const name = PLAN_NAMES.find(n => !plans.some(p => p.name === n)) || `Plan ${plans.length + 1}`;
  return { id: `p${Date.now().toString(36)}`, name, items: [] };
}
