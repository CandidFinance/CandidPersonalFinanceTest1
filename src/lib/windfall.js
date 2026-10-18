// A lump sum, and where it could go: redundancy pay, a bonus, an
// inheritance, a sale, a gift. From what Candid already knows (ISA room, the
// pension, cash against the emergency fund, the student loan, a home to buy)
// and what the user says about the money, each place it could go, with what
// it's worth in £ and what it costs in access. Ranked by £, guaranteed
// figures before assumed growth, by what each £ placed adds in the first
// year; the user splits the money themselves.
// Guidance, not advice: nothing here says what to do first.
//
// Pure, unit tested in windfall.test.js; the conversation around it is
// src/mobile/windfall/WindfallChat.jsx.
//
// `w`, the user's answers: { amount, arrived, source, earmark, when }.
//   arrived: true (in their account) or false (on its way)
//   source:  "redundancy" | "bonus" | "inheritance" | "sale" | "gift" | "other"
//   earmark: "home" | "children" | "purchase" | "none"
//   when:    "soon" (under 2 years) | "mid" (2 to 5) | "later" (5+), for a home or purchase
//   parts:   for redundancy, the settlement's parts, before tax (settlementTax)
//   earnedBefore: for redundancy, pay this tax year before leaving, before tax
//
// The money placed is take-home: for a redundancy settlement, what's left
// after tax and National Insurance.

import { fmt } from "./format.js";
import { ISA_ALLOWANCE, cashIsaLimit, taxFreeInterest, calcIncomeTax, savingsTaxRates, HIGHER_RATE_THRESHOLD, NI_PRIMARY_THRESHOLD, NI_UPPER_EARNINGS_LIMIT, NI_MAIN_RATE, NI_RATE_ABOVE_UEL, REDUNDANCY_TAX_FREE } from "./tax.js";
import { daysToTaxYearEnd } from "./metrics.js";
import { GROWTH_NOMINAL_PCT } from "./growth.js";
import { calcAnnualAllowanceRoom, calcBonusSacrificePotential, inRetirement, pensionAccessAge, NON_EARNER_PENSION_NET, PENSION_RELIEF_MAX_AGE } from "./pension.js";
import { calcStudentLoanScenario } from "./studentLoan.js";
import { PA_TAPER_START, ADDITIONAL_RATE_THRESHOLD } from "./tax.js";

export const WINDFALL_SOURCES = [
  { value: "redundancy", label: "Redundancy pay" },
  { value: "bonus", label: "A bonus" },
  { value: "inheritance", label: "An inheritance" },
  { value: "sale", label: "Selling something" },
  { value: "gift", label: "A gift" },
  { value: "other", label: "Something else" },
];
export const WINDFALL_EARMARKS = [
  { value: "home", label: "A home" },
  { value: "children", label: "Children" },
  { value: "purchase", label: "A big purchase" },
  { value: "none", label: "Nothing yet" },
];
export const WINDFALL_WHEN = [
  { value: "soon", label: "Within 2 years" },
  { value: "mid", label: "2 to 5 years" },
  { value: "later", label: "5 years or more" },
];

export { REDUNDANCY_TAX_FREE };
// A Lifetime ISA: up to £4,000 a year, opened from 18 to 39, with 25% added.
export const LISA_LIMIT = 4000, LISA_BONUS = 0.25;
// A Junior ISA: up to £9,000 a year per child.
export const JISA_LIMIT = 9000;

// ── A redundancy settlement, part by part (GOV.UK, "Tax on redundancy";
// HMRC's post-employment notice pay rules from April 2018):
//   notice:       pay in lieu of notice (PILON): taxed in full, with NI
//   bonus:        a bonus, pro-rated or not: taxed in full, with NI
//   holiday:      holiday pay owed: taxed in full, with NI
//   other:        anything else from the job: taxed in full, with NI
//   compensation: statutory redundancy pay and non-contractual (ex-gratia)
//                 payments, such as a thank-you: the first £30,000 together
//                 is tax-free; above it, income tax but no NI for the employee
// The taxed parts are paid in one pay period after leaving, so NI is on
// that month's thresholds, not the year's.
export const SETTLEMENT_PARTS = [
  { key: "notice", label: "Notice pay (PILON)" },
  { key: "bonus", label: "Bonus" },
  { key: "holiday", label: "Holiday pay" },
  { key: "compensation", label: "Redundancy pay and any thank-you" },
  { key: "other", label: "Anything else" },
];
const monthlyNi = pay => NI_MAIN_RATE * Math.max(0, Math.min(pay, NI_UPPER_EARNINGS_LIMIT / 12) - NI_PRIMARY_THRESHOLD / 12)
  + NI_RATE_ABOVE_UEL * Math.max(0, pay - NI_UPPER_EARNINGS_LIMIT / 12);

// The settlement's tax, given what else is earned this tax year (pay before
// leaving, other income). `intoPension` (£, before tax) is paid straight
// into a pension by the employer instead, out of the taxed parts first:
// it's neither taxed nor NI'd.
export function settlementTax(parts = {}, baseIncome = 0, intoPension = 0, scottish = false) {
  const n = k => Math.max(0, +parts[k] || 0);
  const earnings = n("notice") + n("bonus") + n("holiday") + n("other");
  const compensation = n("compensation");
  const taxFree = Math.min(compensation, REDUNDANCY_TAX_FREE);
  let excess = compensation - taxFree;
  const fromEarnings = Math.min(earnings, intoPension);
  const fromExcess = Math.min(excess, intoPension - fromEarnings);
  const taxedEarnings = earnings - fromEarnings;
  excess -= fromExcess;
  const incomeThisYear = baseIncome + taxedEarnings + excess;
  const incomeTax = calcIncomeTax(incomeThisYear, scottish) - calcIncomeTax(baseIncome, scottish);
  const ni = Math.round(monthlyNi(taxedEarnings));
  const gross = earnings + compensation;
  return {
    gross, earnings, compensation, taxFree, taxed: taxedEarnings + excess, incomeTax, ni,
    intoPension: fromEarnings + fromExcess,
    net: Math.round(gross - (fromEarnings + fromExcess) - incomeTax - ni),
    incomeThisYear,
    // Pay that counts for personal pension relief this tax year: earnings,
    // not the compensation.
    relevantEarnings: baseIncome + earnings,
  };
}
export const settlementGross = parts => SETTLEMENT_PARTS.reduce((t, p) => t + Math.max(0, +parts?.[p.key] || 0), 0);

// What the settlement comes to, in Candid's words.
export function settlementLines(w, m = {}) {
  const t = settlementTax(w.parts, w.earnedBefore != null ? +w.earnedBefore || 0 : (m.earnedEarlierThisYear || 0), 0, m.scottish);
  return [
    t.taxFree > 0
      ? `Of your ${fmt(t.gross)}, ${fmt(t.taxFree)} is tax-free: the first ${fmt(REDUNDANCY_TAX_FREE)} of redundancy and thank-you payments together.`
      : `None of your ${fmt(t.gross)} is tax-free: only redundancy and thank-you payments are, up to ${fmt(REDUNDANCY_TAX_FREE)}.`,
    t.taxed > 0
      ? `The other ${fmt(t.taxed)} is taxed like pay: about ${fmt(t.incomeTax)} of income tax${t.ni > 0 ? ` and ${fmt(t.ni)} of National Insurance` : ""}. So about ${fmt(t.net)} lands in your account.`
      : `So all ${fmt(t.gross)} lands in your account.`,
    t.taxed > 0 ? "Payments after your P45 are often taxed at a flat emergency rate at first, so you may get some back: HMRC refunds it after the tax year, or sooner with form P50 if you're not working." : null,
  ].filter(Boolean);
}

// What the tax rules say about money from this source, in a line or two.
// (Redundancy has its own lines, once its parts are known: settlementLines.)
export function sourceNote(w, d) {
  if (w.source === "redundancy") return null;
  if (w.source === "bonus") {
    if (!w.arrived && d.employmentStatus === "employed") return "Good timing: a bonus that hasn't been paid yet can go straight into your pension, before tax and National Insurance, if your employer allows it.";
    return "A bonus is taxed as pay, so what's arrived is already after tax.";
  }
  if (w.source === "inheritance") return "There's no tax for you on an inheritance: any Inheritance Tax is settled by the estate first.";
  if (w.source === "sale") return "If it's from selling shares, or a home you didn't live in, Capital Gains Tax may be due on the profit.";
  if (w.source === "gift") return "Gifts aren't taxed for you.";
  return null;
}

// The band an income falls in, for the Personal Savings Allowance.
const bandOf = income => income > ADDITIONAL_RATE_THRESHOLD ? "additional" : income > HIGHER_RATE_THRESHOLD ? "higher" : "basic";

const goalLabel = { home: "your home", purchase: "your purchase", children: "your children" };
const needsSoon = w => (w.earmark === "home" || w.earmark === "purchase") && w.when !== "later";

// How each option sits with what the money is for: one line, or null.
function fitFor(key, w, d) {
  const goal = goalLabel[w.earmark];
  if (!goal) return null;
  const soon = needsSoon(w);
  switch (key) {
    case "pension":
    case "bonusSacrifice":
    case "employerPension":
      return soon || w.earmark === "children" ? `Not reachable for ${goal}.` : null;
    case "lisa":
      return w.earmark === "home" ? "Made for a first home, with 25% added." : null;
    case "stocksIsa":
      return soon ? `Shares can fall, and ${w.when === "soon" ? "under 2" : "2 to 5"} years is a short time to wait for them to recover.` : w.earmark === "children" ? "Can be given to them later." : null;
    case "cashIsa":
    case "savings":
      return soon ? `Reachable when ${goal === "your home" ? "you buy" : "you need it"}.` : null;
    case "studentLoan":
      return soon ? `So not there for ${goal}.` : null;
    case "jisa":
      return "Theirs at 18.";
    default:
      return null;
  }
}

/**
 * Where the money could go. Each option: { key, title, cap (most that can go
 * in, £), value(c) → { figure (£), per } for £c placed, guaranteed, access,
 * fit, group?, detail }. `group: "isa"` options share the ISA allowance left.
 * Returns { amount, safety, options (ranked), leftOut, groups }.
 */
export function windfallOptions(d, m, w, marketRates = {}) {
  const amount = w.source === "redundancy" && w.parts
    ? settlementTax(w.parts, w.earnedBefore != null ? +w.earnedBefore || 0 : (m.earnedEarlierThisYear || 0), 0, m.scottish).net
    : Math.max(0, Math.round(+w.amount || 0));
  const age = +d.age || 0;
  const options = [];
  const leftOut = [];
  const isaRate = (marketRates.isaRate ?? 4.5) / 100;
  const savingsRate = (marketRates.nonIsaRate ?? 4.5) / 100;

  // The safety net: their emergency fund, or for someone not working, the
  // months of spending it adds. Not a £ return, so it sits apart.
  let safety = null;
  const notWorking = m.noEarnings && !inRetirement(d);
  if (m.expenses > 0 && (notWorking || m.emergencyShortfall > 0)) {
    const monthly = notWorking && m.monthlyShortfall > 0 ? m.monthlyShortfall : m.expenses;
    safety = {
      key: "emergency", title: notWorking ? "Money to live on" : "Your emergency fund",
      cap: notWorking ? amount : Math.min(amount, Math.round(m.emergencyShortfall)),
      monthsFor: c => c / monthly,
      line: notWorking
        ? `Your savings cover about ${Math.round(m.totalLiquid / monthly)} months of spending now.`
        : `${fmt(Math.round(m.emergencyShortfall))} short of your ${m.bufferMonths}-month emergency fund.`,
      access: "Any time, in an easy-access account.",
    };
  }

  // A redundancy settlement: its tax, and this tax year's income with it.
  // Pay before leaving: what they said here, else what Candid has for this
  // tax year (metrics earnedEarlierThisYear).
  const earnedBefore = w.earnedBefore != null ? +w.earnedBefore || 0 : (m.earnedEarlierThisYear || 0);
  const redundancy = w.source === "redundancy" && w.parts ? settlementTax(w.parts, earnedBefore, 0, m.scottish) : null;
  // Already paid into a pension through work this tax year: their old rate
  // on that pay (employee, and the employer's match on it).
  const prevMy = +d.previousMyContribution || 0, prevEmp = Math.min(prevMy, +d.previousEmployerMatch || 0);
  const paidInByThem = d.hasPension === "yes" ? Math.round(earnedBefore * prevMy / 100) : 0;
  const paidInByEmployer = d.hasPension === "yes" ? Math.round(earnedBefore * prevEmp / 100) : 0;

  // Pension, the year of a redundancy: anything up to this tax year's
  // earnings (pay before leaving, notice, bonus, holiday) can go in with
  // relief at their rate, not just £2,880. Paid in from take-home, with the
  // provider adding 20% and any more claimed through Self Assessment.
  if (redundancy && age > 0 && age < PENSION_RELIEF_MAX_AGE && !inRetirement(d)) {
    const income = redundancy.incomeThisYear;
    const reliefOn = gross => Math.max(0.2 * gross, calcIncomeTax(income, m.scottish) - calcIncomeTax(Math.max(0, income - gross), m.scottish));
    // Personal payments count against this year's earnings (a salary
    // sacrifice is the employer's, so it doesn't), and everything against
    // the £60,000 annual allowance.
    const theirs = d.pensionType === "sacrifice" ? 0 : paidInByThem;
    const grossCap = Math.max(0, Math.min(redundancy.relevantEarnings - theirs, 60000 - paidInByThem - paidInByEmployer));
    const cashFor = gross => gross - reliefOn(gross);
    const grossFor = c => { let lo = 0, hi = grossCap; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (cashFor(mid) < c) lo = mid; else hi = mid; } return hi; };
    const cap = Math.floor(cashFor(grossCap));
    if (cap > 0) options.push({
      key: "pension", title: "A personal pension", cap, guaranteed: true,
      value: c => ({ figure: Math.round(grossFor(c) - c), per: "of tax relief added" }),
      detail: `This tax year up to ${fmt(Math.round(grossCap))} can go in with relief: your earnings of ${fmt(Math.round(redundancy.relevantEarnings))}${paidInByThem + paidInByEmployer > 0 ? `, less about ${fmt(paidInByThem + paidInByEmployer)} already paid in through work (your ${prevMy}%${prevEmp > 0 ? ` and your employer's ${prevEmp}%` : ""} on ${fmt(Math.round(earnedBefore))})` : ""}. The provider adds 20%; any more comes through Self Assessment.`,
      access: `Locked until ${pensionAccessAge(d)}.`,
    });
    // Paid in by the employer from the settlement before it's paid (so only
    // while it's on its way): no tax or NI on that part. Counted in
    // take-home given up.
    if (redundancy.taxed > 0 && !w.arrived) {
      const saved = g => { const t = settlementTax(w.parts, earnedBefore, g, m.scottish); return (redundancy.incomeTax + redundancy.ni) - (t.incomeTax + t.ni); };
      const gCap = Math.max(0, Math.min(redundancy.taxed, 60000 - paidInByThem - paidInByEmployer));
      const giveUp = g => g - saved(g);
      const gFor = c => { let lo = 0, hi = gCap; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (giveUp(mid) < c) lo = mid; else hi = mid; } return hi; };
      const eCap = Math.floor(giveUp(gCap));
      if (eCap > 0) options.push({
        key: "employerPension", title: "Paid into your pension by your employer", cap: eCap, guaranteed: true,
        value: c => ({ figure: Math.round(gFor(c) - c), per: "of tax and National Insurance not paid" }),
        detail: `Out of the taxed parts (notice, bonus, holiday pay), before it's paid: ${fmt(Math.round(gCap))} could go in. It has to be in the settlement agreement, so it's for your employer to agree.`,
        access: `Locked until ${pensionAccessAge(d)}.`,
      });
    }
  }

  // Pension: tax relief at their rate (60% on income in the £100k trap),
  // or for no earnings, on up to £2,880. Locked until the access age.
  if (!redundancy && age > 0 && age < PENSION_RELIEF_MAX_AGE && !inRetirement(d)) {
    const tr = m.noEarnings ? 0.2 : (m.tr || 0.2);
    const earnings = (m.salary || 0) + (+d.bonusAmount || 0);
    const grossCap = m.noEarnings
      ? NON_EARNER_PENSION_NET / 0.8
      : Math.max(0, Math.min(calcAnnualAllowanceRoom(d, m).room, earnings - (m.salary || 0) * (+d.myContribution || 0) / 100));
    const taperNeed = Math.max(0, Math.min((m.adjustedNetIncome || 0), ADDITIONAL_RATE_THRESHOLD) - PA_TAPER_START);
    const cap = Math.floor(grossCap * (1 - tr));
    if (cap > 0) {
      options.push({
        key: "pension", title: m.noEarnings ? "A personal pension" : "Your pension", cap, guaranteed: true,
        value: c => {
          const gross = c / (1 - tr);
          return { figure: Math.round(gross - c + Math.min(gross, taperNeed) * 0.2), per: "of tax relief added" };
        },
        detail: m.noEarnings
          ? `Up to ${fmt(NON_EARNER_PENSION_NET)} a year, with 25% added, earnings or not.`
          : taperNeed > 0 ? `Relief at ${Math.round(tr * 100)}%, plus your tax-free allowance won back on income over £100,000.` : `Relief at ${Math.round(tr * 100)}%${tr > 0.2 ? ", the part above 20% claimed through Self Assessment" : ""}.`,
        access: `Locked until ${pensionAccessAge(d)}.`,
      });
    }
  }

  // A bonus not yet paid: paid into the pension by the employer, before tax
  // and National Insurance (the same figure as the Pension module's).
  if (w.source === "bonus" && !w.arrived && d.employmentStatus === "employed" && amount > 0) {
    const forBonus = c => calcBonusSacrificePotential({ ...d, bonusAmount: String(c) }, m).standalone || 0;
    if (forBonus(amount) > 0) {
      options.push({
        key: "bonusSacrifice", title: "Bonus paid into your pension", cap: amount, guaranteed: true,
        value: c => ({ figure: Math.round(forBonus(c)), per: "less tax and National Insurance" }),
        detail: "Arranged with HR or payroll before it's paid.",
        access: `Locked until ${pensionAccessAge(d)}.`,
      });
    }
  }

  // ISAs share what's left of the £20,000 allowance.
  const isaRoom = Math.max(0, Math.round(m.isaHeadroom ?? ISA_ALLOWANCE));
  const ownsHome = d.hasMortgage === "yes" || d.ownsOutright === true || d.ownsOutright === "yes";
  const wantsHome = w.earmark === "home" || (d.financialGoals || []).includes("buy_house");
  if (age >= 18 && age < 40 && wantsHome && !ownsHome) {
    const cap = Math.min(isaRoom, Math.max(0, LISA_LIMIT - (+d.isaThisYearLISA || 0)));
    if (cap > 0) options.push({
      key: "lisa", title: "A Lifetime ISA", cap, group: "isa", guaranteed: true,
      value: c => ({ figure: Math.round(c * LISA_BONUS), per: "added by the government" }),
      detail: `Up to ${fmt(LISA_LIMIT)} a year, for a first home up to £450,000.`,
      access: "For a first home, or from 60. Otherwise a 25% charge.",
    });
  }
  const cashIsaRoom = Math.min(isaRoom, Math.max(0, cashIsaLimit(m.taxYear, age) - (+d.isaThisYearCash || 0)));
  if (cashIsaRoom > 0) options.push({
    key: "cashIsa", title: "A Cash ISA", cap: cashIsaRoom, group: "isa", guaranteed: true,
    value: c => ({ figure: Math.round(c * isaRate), per: "a year in interest, tax-free" }),
    detail: `At ${(isaRate * 100).toFixed(2)}%, today's highest easy-access rate.`,
    access: "Take it out any time.",
  });
  if (isaRoom > 0) options.push({
    key: "stocksIsa", title: "A Stocks and Shares ISA", cap: isaRoom, group: "isa", guaranteed: false,
    value: c => ({ figure: Math.round(c * GROWTH_NOMINAL_PCT / 100), per: `a year at an assumed ${GROWTH_NOMINAL_PCT}% growth` }),
    detail: "Growth and dividends tax-free. The value can fall, sometimes for years.",
    access: "Any time, though it may be worth less.",
  });

  // A Junior ISA, when the money's meant for children.
  if (w.earmark === "children") options.push({
    key: "jisa", title: "A Junior ISA", cap: Math.min(amount, JISA_LIMIT), guaranteed: false,
    value: c => ({ figure: Math.round(c * GROWTH_NOMINAL_PCT / 100), per: `a year at an assumed ${GROWTH_NOMINAL_PCT}% growth` }),
    detail: `Up to ${fmt(JISA_LIMIT)} a year for each child, tax-free.`,
    access: "Locked until they're 18; then it's theirs.",
  });

  // The student loan: only when overpaying comes out ahead (the module's
  // own verdict); otherwise said why it's left out.
  if (d.studentLoan && d.studentLoan !== "none" && m.loanBal > 0) {
    const sl = calcStudentLoanScenario(d, m);
    if (sl.worthOverpaying) options.push({
      key: "studentLoan", title: "Overpaying your student loan", cap: Math.round(m.loanBal), guaranteed: true,
      value: c => ({ figure: Math.round(c * sl.lifeRatePct / 100), per: "a year of interest saved" }),
      detail: `It charges about ${sl.lifeRatePct}% a year over its life.`,
      access: "Can't be taken back.",
    });
    else leftOut.push({ title: "Overpaying your student loan", why: !sl.willClear
      ? "On your figures it's written off before you'd clear it, so overpaying would mostly cut what's written off."
      : `Its ${sl.lifeRatePct}% a year is less than savings or your pension are expected to earn.` });
  }

  // A savings account for any of it, over its first 12 months: the rest of
  // this tax year on this year's income (for a redundancy, with the
  // settlement's taxed parts), then from 6 April on next year's (for
  // someone not working, no earnings). Each year, the interest they already
  // earn (today's balances and rates, all year) uses up the tax-free amount
  // first: the Personal Savings Allowance, and with low other income, the
  // starting rate and any unused Personal Allowance.
  const existing = (m.cash || 0) * ((m.effectiveSavingsRate || 0) / 100);
  const thisIncome = redundancy && !(m.settlementTaxedThisYear > 0)
    ? (m.nonSavingsIncome || 0) - (m.earnedEarlierThisYear || 0) + redundancy.incomeThisYear
    : (m.nonSavingsIncome || 0);
  const nextIncome = d.employmentStatus === "not_working" ? (+d.otherIncome || 0) : (m.nonSavingsIncome || 0);
  const year = (income, taxYear) => {
    const band = bandOf(income);
    const free = taxFreeInterest(income, band);
    return { band, free, freeLeft: Math.max(0, free - existing), over: Math.max(0, existing - free), rate: savingsTaxRates(taxYear)[band] };
  };
  const now = year(thisIncome, m.taxYear), next = year(nextIncome, (m.taxYear || 0) + 1);
  const partThisYear = Math.min(1, daysToTaxYearEnd() / 365);
  // Tax on new interest: whatever's above the tax-free amount left.
  const taxIn = (y, interest) => Math.max(0, interest - y.freeLeft) * y.rate;
  const pctOf = r => `${Math.round(r * 100)}%`;
  options.push({
    key: "savings", title: "A savings account", cap: amount, guaranteed: true,
    value: c => {
      const gross = c * savingsRate;
      const tax = taxIn(now, gross * partThisYear) + taxIn(next, gross * (1 - partThisYear));
      return { figure: Math.round(gross - tax), per: "in its first year, after tax" };
    },
    detail: [
      `At ${(savingsRate * 100).toFixed(2)}%, today's highest easy-access rate.`,
      now.freeLeft > 0
        ? `With what your savings already earn, ${fmt(Math.round(now.freeLeft))} more interest is tax-free this tax year, then it's taxed at ${pctOf(now.rate)}.`
        : `What your savings already earn uses up this tax year's tax-free amount, so more is taxed at ${pctOf(now.rate)}.`,
      d.employmentStatus === "not_working"
        ? `From April, if you're still not working, about ${fmt(Math.round(next.freeLeft))} a year is tax-free.`
        : null,
      (m.savingsTr || 0) >= 0.4 ? "Premium Bonds' prizes are tax-free, which can suit higher-rate taxpayers." : null,
    ].filter(Boolean).join(" "),
    access: "Take it out any time.",
  });

  for (const o of options) o.fit = fitFor(o.key, w, d);
  // Ranked by what each £ placed adds in the first year (25% of relief or
  // bonus at once beats 4.7% interest, however much more fits in an ISA),
  // guaranteed figures before assumed growth. Each card still shows the £
  // on as much as could go in.
  const perPound = o => { const c = Math.min(o.cap, amount) || 1; return o.value(c).figure / c; };
  options.sort((a, b) => (b.guaranteed - a.guaranteed) || (perPound(b) - perPound(a)));
  return { amount, safety, options, leftOut, groups: { isa: isaRoom } };
}

// What can still go into an option, given what's placed elsewhere: its own
// cap, its group's (the ISA allowance), and the money not yet placed.
export function roomFor(option, split, plan) {
  const placed = Object.values(split).reduce((t, v) => t + (+v || 0), 0);
  const mine = +split[option.key] || 0;
  let room = Math.min(option.cap, plan.amount - placed + mine);
  if (option.group) {
    const inGroup = plan.options.filter(o => o.group === option.group).reduce((t, o) => t + (+split[o.key] || 0), 0);
    room = Math.min(room, plan.groups[option.group] - inGroup + mine);
  }
  return Math.max(0, Math.round(room));
}

const list = parts => parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

// The split, in words: what goes where and what each is worth.
export function describeSplit(split, plan) {
  const all = [...(plan.safety ? [plan.safety] : []), ...plan.options];
  const parts = all.filter(o => (+split[o.key] || 0) > 0).map(o => {
    const c = +split[o.key];
    if (o.key === "emergency") return `${fmt(c)} kept as ${o.title === "Money to live on" ? `money to live on (about ${Math.round(o.monthsFor(c))} months of spending)` : "your emergency fund"}`;
    const v = o.value(c);
    return `${fmt(c)} into ${o.title.replace(/^(A|An|Your) /, m => m === "Your " ? "your " : m.toLowerCase())} (${v.figure > 0 ? `${fmt(v.figure)} ${v.per}` : v.per})`;
  });
  const placed = Object.values(split).reduce((t, v) => t + (+v || 0), 0);
  const left = plan.amount - placed;
  return parts.length ? `That puts ${list(parts)}.${left > 0 ? ` ${fmt(left)} isn't placed yet.` : ""}` : null;
}
