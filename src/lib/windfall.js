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

import { fmt } from "./format.js";
import { ISA_ALLOWANCE, cashIsaLimit, taxFreeInterest } from "./tax.js";
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

// GOV.UK: the first £30,000 of a redundancy payment is tax-free.
export const REDUNDANCY_TAX_FREE = 30000;
// A Lifetime ISA: up to £4,000 a year, opened from 18 to 39, with 25% added.
export const LISA_LIMIT = 4000, LISA_BONUS = 0.25;
// A Junior ISA: up to £9,000 a year per child.
export const JISA_LIMIT = 9000;

// What the tax rules say about money from this source, in a line or two.
export function sourceNote(w, d) {
  const amount = +w.amount || 0;
  if (w.source === "redundancy") {
    return amount <= REDUNDANCY_TAX_FREE
      ? `The first ${fmt(REDUNDANCY_TAX_FREE)} of redundancy pay is tax-free, so all of yours is.`
      : `The first ${fmt(REDUNDANCY_TAX_FREE)} of redundancy pay is tax-free; the other ${fmt(amount - REDUNDANCY_TAX_FREE)} is taxed like pay. Notice pay and holiday pay are taxed in full.`;
  }
  if (w.source === "bonus") {
    if (!w.arrived && d.employmentStatus === "employed") return "Good timing: a bonus that hasn't been paid yet can go straight into your pension, before tax and National Insurance, if your employer allows it.";
    return "A bonus is taxed as pay, so what's arrived is already after tax.";
  }
  if (w.source === "inheritance") return "There's no tax for you on an inheritance: any Inheritance Tax is settled by the estate first.";
  if (w.source === "sale") return "If it's from selling shares, or a home you didn't live in, Capital Gains Tax may be due on the profit.";
  if (w.source === "gift") return "Gifts aren't taxed for you.";
  return null;
}

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
  const amount = Math.max(0, Math.round(+w.amount || 0));
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

  // Pension: tax relief at their rate (60% on income in the £100k trap),
  // or for no earnings, on up to £2,880. Locked until the access age.
  if (age > 0 && age < PENSION_RELIEF_MAX_AGE && !inRetirement(d)) {
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

  // A savings account for any of it: after tax on interest beyond what's
  // tax-free for them (the Personal Savings Allowance and starting rate).
  const freeLeft = Math.max(0, taxFreeInterest(m.nonSavingsIncome || 0, m.taxBandLabel) - (m.totalLiquid || 0) * ((m.effectiveSavingsRate || 0) / 100));
  options.push({
    key: "savings", title: "A savings account", cap: amount, guaranteed: true,
    value: c => {
      const gross = c * savingsRate;
      return { figure: Math.round(gross - Math.max(0, gross - freeLeft) * (m.savingsTr || 0)), per: "a year in interest, after tax" };
    },
    detail: `At ${(savingsRate * 100).toFixed(2)}%, today's highest easy-access rate.${(m.savingsTr || 0) >= 0.4 ? " Premium Bonds' prizes are tax-free, which can suit higher-rate taxpayers." : ""}`,
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
