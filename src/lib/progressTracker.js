// The Progress tab (src/components/dashboard/ProgressTrackerDashboard.jsx):
// this tax year's allowances and targets, net worth by what it's made of,
// goal pots, and where income sits against the tax bands. Pure, unit tested
// in progressTracker.test.js.
//
// Every figure is one the app already works out (calcMetrics, the Annual
// Allowance, the Cash module's £, the £100k trap), so Progress agrees with
// Home and the modules. A row unlocks once its module's questions are
// answered (appEntry.js moduleAnswered); until then it shows greyed out, so
// nothing is measured from answers not yet given. The user's own targets
// are optional saved inputs (BLANK_DATA): a pension target (without one,
// the Annual Allowance) and the overpayments'.

import {
  ISA_ALLOWANCE, PERSONAL_ALLOWANCE, HIGHER_RATE_THRESHOLD, PA_TAPER_START, ADDITIONAL_RATE_THRESHOLD,
  INCOME_TAX_RATES, SCOTTISH_BANDS, SCOTTISH_ADVANCED, SCOTTISH_TOP, CGT_ANNUAL_ALLOWANCE, DIVIDEND_ALLOWANCE,
} from "./tax.js";
import { calcAnnualAllowanceRoomBeforeTopUps } from "./pension.js";
import { bankedFor, MODULE_META, HIDE_MVP_MODULES, HIDDEN_MVP_MODULE_KEYS } from "./moduleStatus.js";
import { moduleAnswered } from "./appEntry.js";
import { borrowingInputs } from "./borrowing.js";
import { readinessMissing } from "./propertyReadiness.js";
import { taxTrap, thisTaxYear, TRAP_NEAR, TRAP_EDGE } from "./taxTrap.js";
import { fmt } from "./format.js";

const n = v => Math.max(0, +v || 0);

// Progress in whole per cent, and 100 only once the target is reached, so a
// bar never looks full before it is.
function measured(current, target) {
  const c = Math.round(n(current)), t = Math.round(n(target));
  const hit = t > 0 && c >= t;
  return { current: c, target: t, hit, pct: hit ? 100 : t > 0 ? Math.min(99, Math.floor((c / t) * 100)) : 0 };
}

// ── This tax year's allowances and targets ─────────────────────────────
// Each row: what's in so far against its target, with a short label and a
// note giving the figures in full (the tab shows them in £k). `locked`: its module isn't
// answered yet (targetRows), so it shows greyed out, naming the module that
// unlocks it (`unlock`) and the one to open (`module`, `moduleTitle`).
// `tracked`: unlocked, with a target to measure against (one without
// offers to set one). `own`: the target is the user's. `editable`, `field`
// (and `paidField`): what an edit can change, and the saved inputs it
// writes. `limit`: the most an own target can be. `allowance`: measured
// against a tax-free allowance (marked with an icon on the tab). `addable`:
// shown before it's tracked, with "Add" to give the figure it needs.
// `warnAt`: a limit rather than a goal (gains, dividends): past it, tax is
// due, so reaching it warns (`usedTitle`, `usedLine`) and it stays out of
// the headline average.

// The £20,000 allowance (buying a home together, Property: the household's
// two, with the partner's ISA payments this year) against what's been paid
// into ISAs since 6 April.
function isaRow(d, m) {
  const joint = d.propertyBuyingMode === "together";
  const limit = joint ? ISA_ALLOWANCE * 2 : ISA_ALLOWANCE;
  const used = n(m.isaUsedThisYear) + (joint ? n(d.partnerIsaThisYear) : 0);
  return {
    id: "isa", label: joint ? "ISA, together" : "ISA", allowance: true,
    ...measured(used, limit), tracked: true, own: false, editable: false,
    note: joint ? `${fmt(used)} of your ${fmt(limit)} allowance together (${fmt(ISA_ALLOWANCE)} each), shared by every ISA you pay into.`
      : `${fmt(used)} of the ${fmt(limit)} allowance, shared by every ISA you pay into this tax year.`,
  };
}

// On this tax year's figures (taxTrap.js thisTaxYear), as the £100k module
// has them: the regular % on the salary before any top-ups, then the
// top-ups on top, against the allowance.
function pensionRow(d, m) {
  const year = thisTaxYear(d, m);
  const aa = calcAnnualAllowanceRoomBeforeTopUps(year.d, year.m);
  const topUps = Math.round(n(year.m.topUpsTotal));
  const inputs = aa.currentInputs + topUps;
  const own = Math.min(n(d.pensionTarget), aa.approxAA);
  const allowance = aa.mpaa ? "Money Purchase Annual Allowance" : aa.inAATaper ? "tapered Annual Allowance" : "Annual Allowance";
  const paid = topUps > 0 ? `${fmt(inputs)} this tax year, yours and your employer's, including ${fmt(topUps)} of top-ups`
    : `${fmt(aa.currentInputs)} a year, yours and your employer's`;
  return {
    id: "pension", label: "Pension", allowance: !own,
    ...measured(inputs, own || aa.approxAA), tracked: true, own: own > 0,
    editable: true, field: "pensionTarget", limit: aa.approxAA,
    note: own ? `${paid}, against your ${fmt(own)} target. Your ${allowance} is ${fmt(aa.approxAA)}.`
      : `${paid}, against your ${fmt(aa.approxAA)} ${allowance}.`,
  };
}

// Gains and dividends from investments outside an ISA or pension, each
// against its tax-free allowance. Gains show only to someone with such
// investments (Investments), dividends also to someone with dividends
// (About you), and each is tracked once
// added on Progress (`d.allowanceGoals`). Gains are Investments' own answer
// (profit on sales since 6 April), so a walk-through that asked it counts as
// added; dividends this tax year are asked only here. Both start again on
// 6 April (rollTaxYear).
export const holdsUnwrapped = d => d.hasInvestments === "yes" && d.hasUnwrapped !== "no" && n(d.unwrappedValue) > 0;
const getsDividends = d => holdsUnwrapped(d) || n(d.dividendIncome) > 0;
const allowanceAdded = (d, id) => Array.isArray(d.allowanceGoals) && d.allowanceGoals.includes(id);
export const withAllowanceGoal = (d, id) => [...new Set([...(Array.isArray(d.allowanceGoals) ? d.allowanceGoals : []), id])];

function cgtRow(d) {
  const added = allowanceAdded(d, "cgt") || (moduleAnswered("investments", d) && d.hasUnwrapped === "yes");
  const gains = d.hasSoldAssetsOutsideWrapper === "yes" ? n(d.realisedCgtGains) : 0;
  return {
    id: "cgt", label: "Capital gains", allowance: true, addable: true, warnAt: true,
    usedTitle: "Capital gains allowance used",
    usedLine: `Gains above ${fmt(CGT_ANNUAL_ALLOWANCE)} this tax year are taxed.`,
    ...measured(gains, CGT_ANNUAL_ALLOWANCE), tracked: added, own: false, editable: true,
    note: added ? `${fmt(gains)} of gains on sales this tax year, against the ${fmt(CGT_ANNUAL_ALLOWANCE)} capital gains allowance.`
      : `Gains on sales outside an ISA or pension count against a ${fmt(CGT_ANNUAL_ALLOWANCE)} tax-free allowance each tax year.`,
  };
}

function dividendRow(d) {
  const added = allowanceAdded(d, "dividends");
  const paid = n(d.dividendsThisYear);
  return {
    id: "dividends", label: "Dividends", allowance: true, addable: true, warnAt: true,
    usedTitle: "Dividend allowance used",
    usedLine: `Dividends above ${fmt(DIVIDEND_ALLOWANCE)} this tax year are taxed.`,
    ...measured(paid, DIVIDEND_ALLOWANCE), tracked: added, own: false, editable: true,
    note: added ? `${fmt(paid)} of dividends this tax year, against the ${fmt(DIVIDEND_ALLOWANCE)} dividend allowance.`
      : `Dividends from investments outside an ISA or pension count against a ${fmt(DIVIDEND_ALLOWANCE)} tax-free allowance each tax year.`,
  };
}

// The emergency fund the app already sizes (calcMetrics): the months of
// spending chosen (3, 6 or 9) at their monthly spending, in cash and
// Premium Bonds.
function emergencyRow(m) {
  const sized = n(m.expenses) > 0;
  return {
    id: "emergency", label: "Emergency fund",
    ...measured(m.emergencyFund, sized ? m.emergencyBuffer : 0), tracked: sized, own: false, editable: true,
    note: sized ? `${fmt(m.emergencyFund)} in cash and Premium Bonds, against ${m.bufferMonths} months of spending at ${fmt(m.expenses)} a month.`
      : "Sized from your monthly spending, which isn't entered yet.",
  };
}

// Voluntary overpayments this tax year (rollTaxYear clears them on 6 April)
// against the user's own target. A student loan's include each lower
// balance typed in by hand in Student loan (loanOverpaidAfter).
function overpaymentRow(id, label, target, paid, field, paidField) {
  const t = n(target), p = Math.round(n(paid));
  return {
    id, label, ...measured(p, t), tracked: t > 0, own: t > 0,
    editable: true, field, paidField,
    note: t > 0 ? `${fmt(p)} overpaid this tax year, against your ${fmt(t)} target.`
      : p > 0 ? `${fmt(p)} overpaid this tax year. No target set.`
      : "No target set for this tax year.",
  };
}

// The extra interest a year from changes made in Cash & savings (banked,
// as on Modules), against that plus what's still on the table there at
// today's rates (the module's £, as on Home).
function cashRow(d, m, statuses) {
  const banked = bankedFor(d, "cash");
  const left = Math.round(n(statuses?.cash?.amount));
  const made = banked > 0 ? `${fmt(banked)} a year extra from changes you've made. ` : "";
  const row = {
    id: "cashInterest", label: "Cash interest",
    ...measured(banked, banked + left), tracked: true, own: false,
    editable: false, perYear: true,
    note: made + (left > 0 ? `${fmt(left)} a year more at today's best rates.` : "Your cash earns at or near the best rates available today."),
  };
  // Nothing banked and nothing left on the table: already on the best rates.
  if (banked + left === 0) Object.assign(row, { hit: true, pct: 100 });
  return row;
}

const titleOf = key => MODULE_META.find(mm => mm.key === key)?.title || key;

// Every row, in a fixed order. Each unlocks once one of its modules is
// answered: the ISA allowance with Cash & savings or Investments (both ask
// this year's ISA payments), the rest with their own. Until then it's
// locked and counts for nothing. Once answered, a row that doesn't fit the
// answers (no student loan, no cash) goes. Mortgage only shows once its
// module is back (HIDE_MVP_MODULES). Capital gains and dividends never lock:
// they show only to someone they apply to (holdsUnwrapped, getsDividends).
export function targetRows(d, m, statuses = {}) {
  const mortgageLive = !(HIDE_MVP_MODULES && HIDDEN_MVP_MODULE_KEYS.includes("mortgage"));
  const hasStudentLoan = (!!d.studentLoan && d.studentLoan !== "none") || n(m.loanBal) > 0;
  const unlockedBy = (row, keys, fits = true) => {
    const answered = keys.some(k => moduleAnswered(k, d));
    const module = keys[keys.length - 1];
    return {
      ...row, locked: !answered, shown: !answered || fits, tracked: answered && row.tracked,
      module, moduleTitle: titleOf(module), unlock: keys.map(titleOf).join(" or "),
    };
  };
  return [
    unlockedBy(isaRow(d, m), ["cash", "investments"]),
    ...[holdsUnwrapped(d) && cgtRow(d), getsDividends(d) && dividendRow(d)].filter(Boolean).map(r => ({ ...r, locked: false, shown: true })),
    unlockedBy(pensionRow(d, m), ["pension"]),
    unlockedBy(emergencyRow(m), ["cash"]),
    ...(mortgageLive ? [unlockedBy(overpaymentRow("mortgage", "Mortgage",
      d.mortgageOverpayTarget, d.mortgageOverpaidThisYear, "mortgageOverpayTarget", "mortgageOverpaidThisYear"), ["mortgage"], d.hasMortgage === "yes")] : []),
    unlockedBy(overpaymentRow("studentLoan", "Student loan",
      d.studentLoanOverpayTarget, d.studentLoanOverpaidThisYear, "studentLoanOverpayTarget", "studentLoanOverpaidThisYear"), ["studentLoan"], hasStudentLoan),
    unlockedBy(cashRow(d, m, statuses), ["cash"], n(m.cash) > 0),
  ].filter(r => r.shown);
}

// A student loan overpayment typed in by hand in Student loan (a lower
// balance: LoanBalanceEditor, and CandidApp's recordLoanOverpayment) counts
// towards this tax year's overpayments: the saved figure after it.
export const loanOverpaidAfter = (d, amount) => String(Math.round(n(d.studentLoanOverpaidThisYear) + n(amount)));

// The headline: the average progress across the unlocked rows with a
// target, and how many are reached (100% only when every one is), and how
// many rows are still locked. A limit (`warnAt`) isn't a goal to reach, so
// it doesn't count.
export function annualGoals(rows) {
  const tracked = rows.filter(r => r.tracked && !r.warnAt);
  const hits = tracked.filter(r => r.hit).length;
  const average = tracked.length ? tracked.reduce((s, r) => s + r.pct, 0) / tracked.length : 0;
  return {
    pct: tracked.length && hits === tracked.length ? 100 : Math.min(99, Math.round(average)),
    hits, total: tracked.length, locked: rows.filter(r => r.locked).length,
  };
}

// ── Net worth by what it's made of ─────────────────────────────────────
// The same totals as Home (calcMetrics netWorth, totalLiabilities), from
// everything entered. The home counts at its full value, with the mortgage
// among the debts, so gross assets less total debt is the net worth
// (calcMetrics nets the mortgage off the equity entered instead). Parts are
// listed in the order the donut draws them, so Home and Pension, whose
// colours are close for red-green colour blindness, never sit side by side.
export function netWorthPicture(d, m) {
  const mortgage = d.hasMortgage === "yes" ? n(d.mortgageBalance) : 0;
  const isaPrev = (+d.isaPrevCash || 0) + (+d.isaPrevSS || 0) + (+d.isaPrevLISA || 0) + (+d.isaPrevOther || 0) || (+d.isaPreviousBalance || 0);
  const parts = [
    { id: "cash", label: "Cash", value: n(m.cash) + n(m.bonds) },
    { id: "home", label: "Home", value: n(m.propertyEquity) + mortgage },
    { id: "investments", label: "Investments", value: n(m.isaUsedThisYear) + n(isaPrev) + n(d.unwrappedValue) },
    { id: "pension", label: "Pension", value: n(d.potValue) + n(d.potValue2) },
  ].map(p => ({ ...p, value: Math.round(p.value) }));
  const debts = [
    { id: "mortgage", label: "Mortgage", value: mortgage },
    { id: "studentLoan", label: "Student loan", value: n(m.loanBal) },
    { id: "personalLoan", label: "Personal loan", value: d.hasPersonalLoan === "yes" ? n(d.personalLoanBalance) : 0 },
  ].map(x => ({ ...x, value: Math.round(x.value) })).filter(x => x.value > 0);
  const netWorth = Math.round(+m.netWorth || 0);
  const totalDebt = Math.round(n(m.totalLiabilities));
  return { parts, debts, netWorth, totalDebt, grossAssets: netWorth + totalDebt };
}

// ── Income against the tax bands ───────────────────────────────────────
// Each band of adjusted net income with the income tax rate on the next £1
// of pay in it (savings and dividends have their own). From £100,000 the
// Personal Allowance goes, £1 for every £2, so the band's rate is half as
// much again (taxTrap.js). Scottish taxpayers have Scotland's bands on pay;
// its starter, basic and intermediate rates show as one band.
const band = (from, to, rate, name, rateLabel = `${Math.round(rate * 1000) / 10}%`) => ({ from, to, rate, name, rateLabel });

export function incomeBands(scottish = false) {
  if (!scottish) return [
    band(0, PERSONAL_ALLOWANCE, 0, "Personal Allowance"),
    band(PERSONAL_ALLOWANCE, HIGHER_RATE_THRESHOLD, INCOME_TAX_RATES.basic, "Basic rate"),
    band(HIGHER_RATE_THRESHOLD, PA_TAPER_START, INCOME_TAX_RATES.higher, "Higher rate"),
    band(PA_TAPER_START, ADDITIONAL_RATE_THRESHOLD, INCOME_TAX_RATES.higher * 1.5, "£100k tax trap"),
    band(ADDITIONAL_RATE_THRESHOLD, Infinity, INCOME_TAX_RATES.additional, "Additional rate"),
  ];
  // Where each Scottish band ends: £16,537, £29,526, £43,662, £75,000.
  const ends = SCOTTISH_BANDS.reduce((e, [width]) => [...e, e[e.length - 1] + width], [PERSONAL_ALLOWANCE]).slice(1);
  return [
    band(0, PERSONAL_ALLOWANCE, 0, "Personal Allowance"),
    band(PERSONAL_ALLOWANCE, ends[2], SCOTTISH_BANDS[2][1], "Starter to intermediate rate",
      `${Math.round(SCOTTISH_BANDS[0][1] * 100)}–${Math.round(SCOTTISH_BANDS[2][1] * 100)}%`),
    band(ends[2], ends[3], SCOTTISH_BANDS[3][1], "Higher rate"),
    band(ends[3], PA_TAPER_START, SCOTTISH_ADVANCED, "Advanced rate"),
    band(PA_TAPER_START, ADDITIONAL_RATE_THRESHOLD, SCOTTISH_ADVANCED * 1.5, "£100k tax trap"),
    band(ADDITIONAL_RATE_THRESHOLD, Infinity, SCOTTISH_TOP, "Top rate"),
  ];
}

export { TRAP_EDGE };
const TRAP_RISE = 10000;

// Where their adjusted net income sits: the band, how far from the next
// line that matters, and, over £100,000, the trap's figures (taxTrap.js):
// the allowance lost and its tax, and what paying into a pension to get
// back to £100,000 would take and cost in take-home pay. On this tax year
// (thisTaxYear: pay to date and one-off top-ups), as the module has it.
export function incomePosition(d, m) {
  ({ d, m } = thisTaxYear(d, m));
  const income = Math.round(n(m.adjustedNetIncome));
  const scottish = !!m.scottish;
  const bands = incomeBands(scottish);
  // Up to and including each band's top: the taper starts above £100,000.
  const current = bands.find(b => income <= b.to);
  const higherFrom = bands.find(b => b.name === "Higher rate").from;
  const context = income < higherFrom ? `${fmt(higherFrom - income)} below the higher rate, which starts at ${fmt(higherFrom)}.`
    : income < PA_TAPER_START ? `${fmt(PA_TAPER_START - income)} below £100,000, where the Personal Allowance starts to go.`
    : income <= PA_TAPER_START ? "At £100,000, where the Personal Allowance starts to go."
    : income < ADDITIONAL_RATE_THRESHOLD ? `${fmt(income - PA_TAPER_START)} over £100,000.`
    : `Over ${fmt(ADDITIONAL_RATE_THRESHOLD)}, where the Personal Allowance is gone.`;
  const t = income > PA_TAPER_START ? taxTrap(d, m) : null;
  const pension = t?.options.find(o => o.key === "pension");
  // How close to the trap: "in" it, "edge" (within TRAP_EDGE of £100,000),
  // "near" (within taxTrap.js's TRAP_NEAR), "clear", or "none" with no
  // income entered.
  // Below it: the gap, the tax on each £1,000 past £100,000 against the
  // rate just below it, and what a £10,000 rise would add from the trap
  // (the allowance lost, £1 for every £2, taxed at that rate).
  const gap = income > 0 && income <= PA_TAPER_START ? PA_TAPER_START - income : null;
  const below = bands.find(b => b.to === PA_TAPER_START).rate;
  const zone = !income ? "none" : gap == null ? "in" : gap <= TRAP_EDGE ? "edge" : gap <= TRAP_NEAR ? "near" : "clear";
  return {
    income, scottish, bands, band: current, context, zone, gap,
    perThousand: { now: Math.round(below * 1000), trap: Math.round(below * 1.5 * 1000) },
    rise: gap == null ? null : { by: TRAP_RISE, tax: Math.round(Math.max(0, TRAP_RISE - gap) / 2 * below) },
    trap: t?.over ? {
      over: Math.round(t.ani - PA_TAPER_START), aboveTaper: t.aboveTaper,
      rateLabel: bands.find(b => b.name === "£100k tax trap").rateLabel,
      allowanceLost: t.allowance.lost, tax: t.allowance.tax, childcareLost: Math.round(t.childcareLost),
      needed: t.needed, fits: t.fits, aaRoom: Math.round(t.aaRoom),
      route: pension?.route ?? null, takeHome: pension?.takeHome ?? null,
    } : null,
  };
}

// ── Goal vaults ────────────────────────────────────────────────────────
// Short and medium-term pots: a name, a target, what's saved and a target
// month ("YYYY-MM", or "" for none). Two show from answers already given:
// buying a home, once Property's first step is done (the cash available
// there is the saved figure, with the goals step's target where given),
// and a big purchase, once a target's been given for it. Editing one saves
// the user's own copy under the same id in `goalVaults`; removing one
// leaves `{ id, removed: true }` so it stays gone. Pots the user adds are
// theirs, newest first, above those two.
export const VAULT_NAMES = ["Buying a home", "Holiday", "School fees", "Car", "Wedding"];
const TIMEFRAME_LABEL = { lt1: "Within a year", "1to3": "In 1 to 3 years", "3to5": "In 3 to 5 years", "5plus": "In 5 years or more" };
const MAX_POUNDS = 10000000;

export const newVaultId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
// A typed £ figure as the saved string: whole pounds, "" for none.
export const poundsInput = v => (n(v) > 0 ? String(Math.min(Math.round(n(v)), MAX_POUNDS)) : "");

function fromAnswers(d, m) {
  const out = [];
  if (readinessMissing(d).length === 0) {
    out.push({ id: "home", name: "Buying a home", target: d.houseTargetAmount, saved: borrowingInputs(d, m).cashAvailable, date: "", timeframe: d.houseTimeframe });
  }
  if (n(d.bigPurchaseTargetAmount) > 0) {
    out.push({ id: "purchase", name: "A big purchase", target: d.bigPurchaseTargetAmount, saved: "", date: "", timeframe: d.bigPurchaseTimeframe });
  }
  return out;
}

// Whole months from now to the target month, counting it: October to the
// following March is 5.
function monthsUntil(date, now) {
  const [y, mo] = String(date || "").split("-").map(Number);
  if (!y || !mo) return 0;
  return (y - now.getFullYear()) * 12 + (mo - (now.getMonth() + 1));
}
const monthLabel = date => {
  const [y, mo] = date.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

export function goalVaults(d, m, now = new Date()) {
  const own = (Array.isArray(d.goalVaults) ? d.goalVaults : []).filter(v => v && v.id);
  const ownById = Object.fromEntries(own.map(v => [v.id, v]));
  const derived = fromAnswers(d, m);
  const derivedIds = new Set(derived.map(v => v.id));
  const list = [...own.filter(v => !derivedIds.has(v.id)), ...derived.map(v => ownById[v.id] || v)].filter(v => !v.removed);
  return list.map(v => {
    const { current: saved, target, hit, pct } = measured(v.saved, v.target);
    const date = /^\d{4}-(0[1-9]|1[0-2])$/.test(v.date || "") ? v.date : "";
    const months = monthsUntil(date, now);
    return {
      id: v.id, name: String(v.name || ""), target, saved, hit, pct, date,
      fromGoal: derivedIds.has(v.id),
      when: date ? `By ${monthLabel(date)}` : TIMEFRAME_LABEL[v.timeframe] || "",
      // What a month would reach the target by the end of its month.
      perMonth: !hit && target > 0 && months > 0 ? Math.ceil((target - saved) / months) : 0,
    };
  });
}

// The saved list with one pot saved (in its place, or a new one first) or
// removed.
export function withVault(list, vault) {
  const saved = Array.isArray(list) ? list : [];
  return saved.some(v => v.id === vault.id) ? saved.map(v => (v.id === vault.id ? vault : v)) : [vault, ...saved];
}
export function withoutVault(list, id, fromGoal) {
  return fromGoal ? withVault(list, { id, removed: true }) : (Array.isArray(list) ? list : []).filter(v => v.id !== id);
}

// A goal reached gets a short animation on Progress once
// (`d.goalsReachedSeen`). Keys: "<tax year>:row:<id>" for this tax year's
// goals (they start again each April), "vault:<id>" for a pot. Only a goal
// with something built up counts, so cash already on the best rates
// (reached with nothing banked) isn't marked.
export const rowReached = r => !!(r.tracked && r.hit && r.current > 0);
export const vaultReached = v => !!(v.hit && v.saved > 0);

// The keys of goals reached and not yet seen. A goal that drops back below
// its target and reaches it again isn't shown twice.
export function newlyReachedGoals(rows, vaults, seen, taxYear) {
  const before = Array.isArray(seen) ? seen : [];
  return [
    ...rows.filter(rowReached).map(r => `${taxYear}:row:${r.id}`),
    ...vaults.filter(vaultReached).map(v => `vault:${v.id}`),
  ].filter(k => !before.includes(k));
}

// The orders the Goals list can take on Progress (`d.goalsSort`): as built
// (pots, then this tax year's goals), largest £ target first, or furthest
// along first. Either way a goal with no target comes after those with one,
// and a locked one last; ties keep the order as built.
export const GOAL_SORTS = [
  { key: "default", label: "Default order" },
  { key: "value", label: "Highest value" },
  { key: "complete", label: "Most complete" },
];
// `goals`: [{ target, pct, locked, measured }], `measured` when it has a
// target to measure against.
export function sortGoals(goals, by) {
  const rank = g => (g.locked ? 2 : g.measured ? 0 : 1);
  const key = by === "value" ? g => g.target : by === "complete" ? g => g.pct * 1e9 + g.target : null;
  if (!key) return goals;
  return goals.map((g, i) => [g, i])
    .sort(([a, i], [b, j]) => rank(a) - rank(b) || (rank(a) === 0 ? key(b) - key(a) : 0) || i - j)
    .map(([g]) => g);
}

// The goals reached and not yet seen, for the pop-up (CandidApp,
// GoalReached.jsx): each with its key, name, figures and whether they're £
// a year (cash interest), and for a limit (`warn`) its title and line.
// Only a goal reached by a change made in the app
// is celebrated; one already reached when it's first measured goes in
// `quiet`, to be marked seen without a pop-up: all of them the first time
// this runs (no `d.goalsReachedSeen` yet, as for anyone from before it
// shipped), a goal whose module has just been answered, a pot added at its
// target. A limit (`warn`) is a warning, so past that first time it always
// shows, however it was first measured. `liveBefore`: `live` from the last run (the goals then measured),
// or null on opening the app. `vaults` for markGoalsSeen.
export function goalsToCelebrate(d, m, statuses, taxYear, liveBefore = null, now = new Date()) {
  const rows = targetRows(d, m, statuses);
  const vaults = goalVaults(d, m, now);
  const byKey = Object.fromEntries([
    ...rows.map(r => [`${taxYear}:row:${r.id}`, { label: r.label, current: r.current, target: r.target, perYear: !!r.perYear, pot: false,
      ...(r.warnAt ? { warn: true, usedTitle: r.usedTitle, usedLine: r.usedLine } : {}) }]),
    ...vaults.map(v => [`vault:${v.id}`, { label: v.name, current: v.saved, target: v.target, perYear: false, pot: true }]),
  ]);
  const live = [...rows.filter(r => r.tracked).map(r => `${taxYear}:row:${r.id}`), ...vaults.map(v => `vault:${v.id}`)];
  const goals = newlyReachedGoals(rows, vaults, d.goalsReachedSeen, taxYear).map(key => ({ key, ...byKey[key] }));
  const isQuiet = g => !Array.isArray(d.goalsReachedSeen) || (!g.warn && liveBefore && !liveBefore.includes(g.key));
  return { celebrate: goals.filter(g => !isQuiet(g)), quiet: goals.filter(isQuiet), live, vaults };
}

// `seen` with `keys` added and stale keys dropped (last tax year's, a pot
// since removed), or null when it already has them all.
export function markGoalsSeen(seen, keys, vaults, taxYear) {
  const before = Array.isArray(seen) ? seen : [];
  const add = keys.filter(k => !before.includes(k));
  if (!add.length) return null;
  const pots = new Set(vaults.map(v => `vault:${v.id}`));
  const live = k => k.startsWith(`${taxYear}:row:`) || pots.has(k);
  return [...before.filter(live), ...add];
}

export function buildProgressSnapshot(d = {}, m = {}, statuses = {}, now = new Date()) {
  const rows = targetRows(d, m, statuses);
  return {
    rows,
    annual: annualGoals(rows),
    netWorth: netWorthPicture(d, m),
    vaults: goalVaults(d, m, now),
    income: incomePosition(d, m),
  };
}
