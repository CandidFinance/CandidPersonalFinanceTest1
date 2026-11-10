// Net worth on Progress: each account, grouped three ways (Category,
// Account, Access), and its line over time. Pure, unit tested in
// netWorthView.test.js.
//
// The figures are netWorthPicture's (progressTracker.js), so they agree with
// Home: each category's accounts add up to its part, and the assets less the
// debts are the headline. The home counts at its full value, with the
// mortgage among the debts.
//
// The line: saved months behind Now (netWorthHistory.js), the projection
// ahead (calcNetWorthTrajectory, yearly, read month by month). The projection
// is moved to start from today's figures, so Now on the line is the headline.
// An account's projection is its category's, scaled by its share today.

import { netWorthPicture } from "./progressTracker.js";
import { calcNetWorthTrajectory } from "./forecast.js";
import { calcStudentLoanScenario, resolveSlRate, slFirstDueYear, slFirstDueYearStated } from "./studentLoan.js";
import { pensionAccessAge } from "./pension.js";
import { statePensionPlan } from "./drawdown.js";
import { taxFreeInterest, ISA_ALLOWANCE, CGT_ANNUAL_ALLOWANCE } from "./tax.js";
import { calcAnnualAllowanceRoomBeforeTopUps, isPensionContributing } from "./pension.js";
import { employerPct } from "./employer.js";
import { PB_RATE } from "./cash.js";
import { premiumBondsRow, topRate } from "./savingsRates.js";
import { nonCashIsaThisYear, itemisedNonCashIsa } from "./isa.js";
import { taxYearOf, taxYearShort } from "./taxYear.js";
import { fmt } from "./format.js";
import { providerFromName } from "./providers.js";

const n = v => Math.max(0, +v || 0);
const sum = list => list.reduce((s, a) => s + a.value, 0);
const rate = v => `${(+v).toFixed(2).replace(/\.?0+$/, "")}%`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Time, in months: year * 12 + month (0-11) ─────────────────────────
export const AHEAD = 240; // 20 years of projection
export const monthT = date => date.getFullYear() * 12 + date.getMonth();
export const keyOfT = t => `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
const tOfKey = key => { const [y, mo] = key.split("-").map(Number); return y * 12 + mo - 1; };
export const labelOfT = t => `${MON[t % 12]} ${String(Math.floor(t / 12)).slice(2)}`;
export const monthKey = date => keyOfT(monthT(date));
// Months of this tax year begun before this one (April's is 0 until May).
const taxMonthsDone = now => Math.min(12, monthT(now) - (taxYearOf(now) * 12 + 3));
// The NS&I limit on Premium Bonds held.
export const PB_LIMIT = 50000;
// A year's Lifetime ISA payments that earn the 25% government bonus.
const LISA_LIMIT = 4000;
const signed = v => (v > 0 ? `+${fmt(v)}` : v < 0 ? `(${fmt(v)})` : fmt(0));

// ── Categories ────────────────────────────────────────────────────────
// `module`: the module a row page opens.
export const ASSET_CATS = [
  { key: "cash", label: "Cash", module: "cash" },
  { key: "home", label: "Home", module: null },
  { key: "investments", label: "Investments", module: "investments" },
  { key: "pension", label: "Pension", module: "pension" },
];
export const DEBT_CATS = [
  { key: "mortgage", label: "Mortgage", module: null },
  { key: "studentLoan", label: "Student loan", module: "studentLoan" },
  { key: "personalLoan", label: "Personal loan", module: null },
];

// Rounds each account and gives the category's last one any difference, so
// the accounts add up to the category's figure exactly. With nothing listed
// but a figure to show (an older answer), one account under the category's
// own name.
function fitTo(list, total, fallback) {
  const out = list.filter(a => a.raw > 0).map(({ raw, ...a }) => ({ ...a, value: Math.round(raw) }));
  if (!out.length) return total > 0 ? [{ ...fallback, value: total }] : [];
  out[out.length - 1].value += total - sum(out);
  return out;
}

function cashAccounts(d, part) {
  const tiers = (Array.isArray(d.cashTiers) ? d.cashTiers : []).map((t, i) => ({ t, i })).filter(({ t }) => +t.amount > 0);
  const tiersTotal = tiers.reduce((s, { t }) => s + (+t.amount || 0), 0);
  const unnamed = tiers.filter(({ t }) => !String(t.name || "").trim()).length;
  let k = 0;
  const list = tiersTotal > 0
    ? tiers.map(({ t, i }) => {
        const name = String(t.name || "").trim();
        const label = name || (unnamed > 1 ? `Savings account ${++k}` : "Savings");
        return { id: `cash-${i}`, label, raw: +t.amount, ratePct: +t.rate > 0 ? +t.rate : null, provider: providerFromName(name) };
      })
    : [{ id: "cash-0", label: "Savings", raw: n(d.cashSavings), ratePct: +d.savingsRate > 0 ? +d.savingsRate : null }];
  // First, so any rounding falls on an account's balance, not the bonds'
  // whole pounds.
  list.unshift({ id: "premiumBonds", label: "Premium Bonds", raw: n(d.premiumBonds), ratePct: null, provider: providerFromName("NS&I") });
  return fitTo(list.map(a => ({ ...a, note: a.ratePct ? rate(a.ratePct) : null })), part, { id: "cash-0", label: "Cash", note: null });
}

function investmentAccounts(d, part) {
  const prev = f => n(d[`isaPrev${f}`]), now = f => n(d[`isaThisYear${f}`]);
  const prevAll = prev("Cash") + prev("SS") + prev("LISA") + prev("Other");
  // Declared in Cash as one total for the non-cash ISAs, beyond what's
  // itemised (isa.js): counted with the other ISAs.
  const declared = Math.max(0, nonCashIsaThisYear(d) - itemisedNonCashIsa(d));
  const paidIn = v => (v > 0 ? `${fmt(v)} paid in, ${taxYearShort(taxYearOf(new Date()))}` : null);
  return fitTo([
    { id: "isa-cash", label: "Cash ISA", raw: prev("Cash") + now("Cash"), note: paidIn(now("Cash")) },
    { id: "isa-ss", label: "Stocks and shares ISA", raw: prev("SS") + now("SS"), note: paidIn(now("SS")) },
    { id: "isa-lisa", label: "Lifetime ISA", raw: prev("LISA") + now("LISA"), note: paidIn(now("LISA")) },
    { id: "isa-other", label: "Other ISAs", raw: prev("Other") + now("Other") + declared, note: paidIn(now("Other") + declared) },
    { id: "isa-earlier", label: "ISAs", raw: prevAll > 0 ? 0 : n(d.isaPreviousBalance), note: null },
    { id: "unwrapped", label: "Outside an ISA", raw: n(d.unwrappedValue), note: n(d.unrealisedGains) > 0 ? `${fmt(d.unrealisedGains)} of it gains` : null },
  ], part, { id: "isa-earlier", label: "Investments", note: null });
}

function pensionAccounts(d, part) {
  return fitTo([
    { id: "pension-current", label: "Current pension", raw: n(d.potValue), note: null },
    { id: "pension-other", label: "Other pensions", raw: n(d.potValue2), note: null },
  ], part, { id: "pension-current", label: "Pension", note: null });
}

// Every account, by category, in netWorthPicture's figures. `netWorth`:
// assets less debts as listed. Any rounding left between that and the
// headline (a pound or two) goes to the largest asset other than the home
// (whose figure is as entered), so the screen tallies and matches Home.
export function worthAccounts(d, m) {
  const pic = netWorthPicture(d, m);
  const part = id => pic.parts.find(p => p.id === id)?.value || 0;
  const debt = id => pic.debts.find(p => p.id === id)?.value || 0;
  const mortRate = +d.mortgageRate > 0 ? rate(d.mortgageRate) : null;
  const slRate = n(m.loanBal) > 0 ? resolveSlRate(d, +m.salary || +d.salary || 0) * 100 : 0;
  const byCat = {
    cash: cashAccounts(d, part("cash")),
    home: part("home") > 0 ? [{ id: "home", label: "Home", value: part("home"), note: null }] : [],
    investments: investmentAccounts(d, part("investments")),
    pension: pensionAccounts(d, part("pension")),
    mortgage: debt("mortgage") > 0 ? [{ id: "mortgage", label: "Mortgage", value: debt("mortgage"), note: mortRate }] : [],
    studentLoan: debt("studentLoan") > 0 ? [{ id: "studentLoan", label: "Student loan", value: debt("studentLoan"), note: slRate > 0 ? rate(slRate) : null, provider: providerFromName("Student Loans Company") }] : [],
    personalLoan: debt("personalLoan") > 0 ? [{ id: "personalLoan", label: "Personal loan", value: debt("personalLoan"), note: +d.personalLoanRate > 0 ? rate(d.personalLoanRate) : null }] : [],
  };
  const make = (c, debtCat) => {
    const accounts = byCat[c.key].map(a => ({ ...a, cat: c.key, debt: debtCat }));
    return { ...c, debt: debtCat, accounts, value: sum(accounts) };
  };
  const assets = ASSET_CATS.map(c => make(c, false));
  const debts = DEBT_CATS.map(c => make(c, true));
  let assetsTotal = assets.reduce((s, c) => s + c.value, 0);
  const debtsTotal = debts.reduce((s, c) => s + c.value, 0);
  const residual = pic.netWorth - (assetsTotal - debtsTotal);
  if (residual !== 0 && Math.abs(residual) <= 5) {
    const top = [...assets].filter(c => c.value > 0 && c.key !== "home").sort((a, b) => b.value - a.value)[0];
    if (top) {
      const last = top.accounts[top.accounts.length - 1];
      last.value += residual;
      top.value += residual;
      assetsTotal += residual;
    }
  }
  const all = [...assets, ...debts].flatMap(c => c.accounts);
  return { assets, debts, accounts: all, assetsTotal, debtsTotal, netWorth: assetsTotal - debtsTotal };
}

// ── Details: facts for each row's page, label and value ───────────────
// Short labels, and what the figure alone doesn't say (Harvey, 10 Nov 2026).
const ty = (now = new Date()) => taxYearShort(taxYearOf(now));
// Days left in this tax year, 5 April included.
const daysToYearEnd = now => Math.max(0, Math.round((new Date(taxYearOf(now) + 1, 3, 6) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5));
// Details that Open Banking will fill in.
export const SOON = "Coming soon";
const of = (v, limit) => `${fmt(v)} / ${fmt(limit)}`;

function catFacts(key, d, m, worth, now = new Date()) {
  const facts = [];
  const cat = [...worth.assets, ...worth.debts].find(c => c.key === key);
  if (key === "cash") {
    const cash = n(m.cash), bonds = n(m.bonds);
    const earn = Math.round(cash * n(m.effectiveSavingsRate) / 100), gap = Math.round(n(m.annualYieldGap));
    if (cash > 0) facts.push(["Interest/yr", fmt(earn)]);
    if (cash > 0 && gap >= 50) facts.push(["At best rates/yr", fmt(earn + gap)]);
    if (bonds > 0) facts.push(["In Premium Bonds", fmt(bonds)]);
  } else if (key === "investments") {
    facts.push(...investmentFacts(d, m, cat, now));
  } else if (key === "pension") {
    facts.push(...pensionFacts(d, m, worth, now));
  } else if (key === "home") {
    if (m.ltv != null) facts.push(["Yours", `${100 - m.ltv}%`], ["On mortgage", `${m.ltv}%`]);
    else if (n(m.propertyEquity) > 0) facts.push(["Owned", "Outright"]);
    facts.push(["Turns into cash", "By selling or remortgaging"]);
  } else if (key === "mortgage") {
    if (+d.mortgageRate > 0) facts.push(["Rate", rate(d.mortgageRate)]);
    if (d.fixExpiryMonth && d.fixExpiryYear && m.daysToFixExpiry > 0) facts.push(["Fix ends", `${MON[+d.fixExpiryMonth - 1]} ${d.fixExpiryYear}`]);
    if (n(d.monthlyMortgage) > 0) facts.push(["Payment/mo", fmt(d.monthlyMortgage)]);
  } else if (key === "studentLoan") {
    facts.push(...studentLoanFacts(d, m, now));
  } else if (key === "personalLoan") {
    if (+d.personalLoanRate > 0) facts.push(["Rate", rate(d.personalLoanRate)]);
    if (n(d.personalLoanMonthly) > 0) facts.push(["Payment/mo", fmt(d.personalLoanMonthly)]);
    const months = m.personalLoanPayoffMonths;
    if (months > 0) facts.push(["Cleared in", `${months} ${months === 1 ? "month" : "months"}`]);
  }
  return facts;
}

// Investments: this tax year's ISA allowance used and left (every kind of
// ISA shares it), and outside an ISA, the gains, the capital gains
// allowance used and the days left to use the rest.
function investmentFacts(d, m, cat, now) {
  const facts = [];
  const unwrapped = cat.accounts.find(a => a.id === "unwrapped")?.value || 0;
  const inIsa = cat.value - unwrapped;
  const used = Math.round(n(m.isaUsedThisYear));
  facts.push([`ISA allowance used, ${ty(now)}`, of(used, ISA_ALLOWANCE)]);
  if (inIsa > 0 && unwrapped > 0) facts.push(["In ISAs", fmt(inIsa)], ["Outside ISAs", fmt(unwrapped)]);
  if (unwrapped > 0) facts.push(...giaFacts(d, m, now));
  return facts;
}

function giaFacts(d, m, now) {
  const gains = n(d.unrealisedGains), left = Math.round(n(m.remainingCgtAllowance));
  const facts = [];
  if (gains > 0) facts.push(["Unrealised gains", fmt(gains)], ["Taxable if sold today", fmt(Math.max(0, gains - left))]);
  facts.push([`CGT allowance used, ${ty(now)}`, of(CGT_ANNUAL_ALLOWANCE - left, CGT_ANNUAL_ALLOWANCE)]);
  if (left > 0) facts.push(["Days left to use it", String(daysToYearEnd(now))]);
  return facts;
}

// What goes into the current pension: you and your employer, as a % of
// salary and in £, how, this tax year so far with any lump sums (the £100k
// trap's top-ups), and the employer match.
function pensionPayments(d, m, now) {
  const salary = n(m.salary);
  const myPct = isPensionContributing(d) ? n(d.myContribution) : 0;
  const empPct = employerPct(d, myPct);
  const mine = Math.round(salary * myPct / 100), employer = Math.round(salary * empPct / 100);
  const taxYear = taxYearOf(now);
  const lumps = (Array.isArray(d.trapTopUps) ? d.trapTopUps : []).filter(u => +u.taxYear === taxYear).reduce((s, u) => s + n(u.amount), 0);
  return { myPct, empPct, mine, employer, lumps };
}

function currentPotFacts(d, m, now) {
  const facts = [["Provider", SOON]];
  if (d.pensionKind === "db") return facts;
  const p = pensionPayments(d, m, now);
  if (p.mine || p.employer) {
    facts.push(["You pay in", `${rate(p.myPct)} · ${fmt(p.mine)}/yr`], ["Employer pays in", `${rate(p.empPct)} · ${fmt(p.employer)}/yr`]);
    if (p.mine && (d.pensionType === "sacrifice" || d.pensionType === "relief")) facts.push(["Paid by", d.pensionType === "sacrifice" ? "Salary sacrifice" : "Relief at source"]);
    facts.push([`Paid in, ${ty(now)} (est.)`, fmt(Math.round((p.mine + p.employer) * taxMonthsDone(now) / 12) + p.lumps)]);
  }
  if (p.lumps > 0) facts.push([`Lump sums, ${ty(now)}`, fmt(p.lumps)]);
  if (n(m.missedMatch) > 0) facts.push(["Employer match unclaimed/yr", fmt(Math.round(m.missedMatch))]);
  else if (p.employer > 0 && d.employerContributionType === "match") facts.push(["Employer match", "Fully claimed"]);
  return facts;
}

// Pensions overall: the Annual Allowance used across them, the pot
// projected, when it opens, and the State Pension.
function pensionFacts(d, m, worth, now) {
  const facts = [];
  const age = +d.age || 0, retireAge = age + (+m.years || 0);
  const db = d.pensionKind === "db";
  if (db && n(d.dbPensionIncome) > 0) facts.push(["Final salary pension", `${fmt(d.dbPensionIncome)}/yr`]);
  const p = pensionPayments(d, m, now);
  if (!db && (p.mine || p.employer || p.lumps)) {
    const aa = calcAnnualAllowanceRoomBeforeTopUps(d, m);
    facts.push([`Annual allowance use, ${ty(now)} (forecast)`, of(Math.min(aa.approxAA, aa.currentInputs + p.lumps), aa.approxAA)]);
  }
  if (!db && age > 0 && retireAge > age && n(m.projectedPot) > 0) facts.push([`Projected at ${retireAge}`, `${fmt(m.projectedPot)} (today's £)`]);
  facts.push(...accessFacts("pension", d, m, worth));
  // An income, not a pot, so not in net worth: here as a fact beside it.
  const sp = statePensionPlan(d, m);
  if (sp.amount > 0) facts.push(["State Pension (est.)", sp.started ? `${fmt(sp.amount)}/yr, in payment` : `${fmt(sp.amount)}/yr from ${sp.fromAge}`]);
  return facts;
}

function accessFacts(key, d, m, worth) {
  const age = +d.age || 0;
  if (key === "now") {
    const now = worth.assets.filter(c => c.key === "cash" || c.key === "investments").flatMap(c => c.accounts).filter(a => a.id !== "isa-lisa");
    const runway = n(d.monthlyExpenses) > 0 ? Math.floor(sum(now) / n(d.monthlyExpenses)) : 0;
    return runway >= 1 ? [["Months of spending", String(runway)]] : [];
  }
  if (key === "pension") {
    const from = pensionAccessAge(d);
    if (!age) return [["Accessible from", `Age ${from}`]];
    if (age >= from) return [["Accessible from", "Now, 25% tax-free"]];
    return [["Accessible from", `${from}, in ${from - age} ${from - age === 1 ? "yr" : "yrs"}`]];
  }
  if (key === "lisa") return [["Accessible from", age >= 60 ? "Now" : "60, or for a first home"]];
  return [];
}

// ── Groupings ─────────────────────────────────────────────────────────
// Each row: { key, label, kind (its colour and icon), module, debt,
// accounts, value, facts }. Largest first.
const ACCESS = [
  { key: "access-now", id: "now", label: "Available now", kind: "now" },
  { key: "access-pension", id: "pension", label: "Pension", kind: "pension" },
  { key: "access-lisa", id: "lisa", label: "Lifetime ISA", kind: "lisa" },
  { key: "access-home", id: "home", label: "Home", kind: "home" },
];
export const GROUPINGS = ["type", "account", "access"];

// `ctx`: { rates (the savings rate rows, for Premium Bonds' prize rate and
// the best easy access rate), now }.
// A category's lines an account's own repeat, left out of its page.
const OWN_LINES = ["Interest/yr", "Unrealised gains", "Taxable if sold today", "CGT allowance used", "Days left to use it"];
export function worthGroups(d, m, worth, by, ctx = {}) {
  const now = ctx.now || new Date();
  const byDesc = list => [...list].filter(g => g.value !== 0).sort((a, b) => b.value - a.value);
  // A category that's one account: the account's own facts, then the
  // category's overall ones (less any its own repeat). Several: the
  // category's overall ones, each account's on its own page.
  const oneAccount = (c, a) => {
    const own = accountFacts(a, d, m, worth, ctx.rates, now);
    return [...own, ...catFacts(c.key, d, m, worth, now).filter(([k]) => !(own.length && OWN_LINES.includes(k.replace(/, \d\d\/\d\d$/, ""))))];
  };
  const fromCat = c => ({ key: c.key, label: c.label, kind: c.key, module: c.module, debt: c.debt, accounts: c.accounts, value: c.value,
    facts: c.accounts.length === 1 ? oneAccount(c, c.accounts[0]) : catFacts(c.key, d, m, worth, now) });
  const perAccount = c => c.accounts.map(a => ({
    key: `acc-${a.id}`, label: a.label, kind: c.key, module: c.module, debt: c.debt, accounts: [a], value: a.value,
    facts: c.accounts.length === 1 ? oneAccount(c, a) : accountFacts(a, d, m, worth, ctx.rates, now),
  }));
  const debts = by === "account" ? byDesc(worth.debts.flatMap(perAccount)) : byDesc(worth.debts.map(fromCat));
  let assets;
  if (by === "account") assets = byDesc(worth.assets.flatMap(perAccount));
  else if (by === "access") {
    const accts = worth.assets.flatMap(c => c.accounts);
    const pick = {
      now: accts.filter(a => (a.cat === "cash" || a.cat === "investments") && a.id !== "isa-lisa"),
      pension: accts.filter(a => a.cat === "pension"),
      lisa: accts.filter(a => a.id === "isa-lisa"),
      home: accts.filter(a => a.cat === "home"),
    };
    assets = byDesc(ACCESS.map(g => ({
      key: g.key, label: g.label, kind: g.kind, module: g.id === "lisa" ? "investments" : g.id === "pension" ? "pension" : null, debt: false,
      accounts: pick[g.id], value: sum(pick[g.id]),
      facts: g.id === "home" ? catFacts("home", d, m, worth, now) : accessFacts(g.id, d, m, worth),
    })));
  } else assets = byDesc(worth.assets.map(fromCat));
  return { assets, debts };
}

// A cash account: its rate, and its interest this tax year so far and for
// the whole year, worked out from today's balance. Premium Bonds: the prize
// fund rate, the prizes it would pay on average, against the best easy
// access rate after tax, the limit used, and the tax the same return as
// interest would cost (prizes are tax-free).
function accountFacts(a, d, m, worth, rates, now = new Date()) {
  const facts = [];
  if (a.cat === "cash" && a.id !== "premiumBonds") {
    facts.push(["Provider", a.provider?.name || SOON], ["Account type", SOON], ["Access", SOON]);
  }
  if (a.cat === "cash" && a.id !== "premiumBonds" && a.ratePct) {
    const year = Math.round(a.value * a.ratePct / 100);
    facts.push(["Rate", rate(a.ratePct)]);
    facts.push(["Interest to date (est.)", fmt(Math.round(year * taxMonthsDone(now) / 12))]);
    facts.push([`Interest forecast, ${ty(now)}`, fmt(year)]);
  }
  if (a.id === "premiumBonds") facts.push(...premiumBondFacts(a.value, d, m, rates, now));
  if (a.id === "unwrapped") facts.push(...giaFacts(d, m, now));
  if (a.id === "pension-current") facts.push(...currentPotFacts(d, m, now));
  if (a.id === "pension-other") facts.push(["Provider", SOON], ["Paying in", "No"]);
  const isaField = { "isa-cash": "Cash", "isa-ss": "SS", "isa-lisa": "LISA", "isa-other": "Other" }[a.id];
  if (isaField) {
    const paid = n(d[`isaThisYear${isaField}`]);
    facts.push([`Paid in, ${ty(now)}`, fmt(paid)]);
    facts.push([`ISA allowance used, ${ty(now)}`, of(Math.round(n(m.isaUsedThisYear)), ISA_ALLOWANCE)]);
    if (a.id === "isa-lisa") facts.push(["LISA limit used", of(Math.min(LISA_LIMIT, paid), LISA_LIMIT)], ["Govt bonus, 25%", fmt(Math.round(Math.min(LISA_LIMIT, paid) * 0.25))]);
  }
  return facts;
}

export function premiumBondFacts(held, d, m, rates, now = new Date()) {
  const row = premiumBondsRow(rates);
  const prizePct = row && +row.rate_aer > 0 ? +row.rate_aer : PB_RATE * 100;
  const prizes = Math.round(held * prizePct / 100);
  // Tax on interest: whatever's over the tax-free allowance for savings, at
  // their savings rate, with their cash interest counted first.
  const free = taxFreeInterest(m.nonSavingsIncome ?? m.adjustedNetIncome, m.taxBandLabel);
  const tr = m.savingsTr ?? m.tr ?? 0;
  const cashInterest = n(m.cash) * n(m.effectiveSavingsRate) / 100;
  const taxOn = extra => Math.round((Math.max(0, cashInterest + extra - free) - Math.max(0, cashInterest - free)) * tr);
  const best = topRate(rates, false);
  const facts = [
    ["Prize fund rate", rate(prizePct)],
    ["Avg. prizes/yr", fmt(prizes)],
    // From the bank account they're paid into, once Open Banking is in.
    [`Prizes won, ${ty(now)}`, SOON],
  ];
  if (best && +best.rate_aer > 0) {
    const interest = held * +best.rate_aer / 100;
    facts.push(["vs. best easy access rate, after tax", signed(Math.round(prizes - (interest - taxOn(interest))))]);
  }
  facts.push(["Limit used", of(Math.min(held, PB_LIMIT), PB_LIMIT)]);
  facts.push(["Tax saved vs. savings interest", `${fmt(taxOn(prizes))}/yr`]);
  return facts;
}

// The student loan: its balance, when repayments began, this tax year's
// interest and the repayments still to come in it, worked out from the
// balance and rate, and what's left to repay over the plan.
function studentLoanFacts(d, m, now = new Date()) {
  const facts = [];
  const bal = n(m.loanBal);
  const r = resolveSlRate(d, +m.salary || +d.salary || 0);
  const monthly = n(m.annualRepayment) / 12;
  facts.push(["Balance", fmt(bal)]);
  const began = slFirstDueYear(d);
  if (began) facts.push(["Repayments began", `Apr ${began}${slFirstDueYearStated(d) == null ? " (est.)" : ""}`]);
  if (r > 0) facts.push(["Interest rate", rate(r * 100)]);
  const done = taxMonthsDone(now), left = 12 - done;
  const split = studentLoanSplit(d, m, now);
  if (r > 0) facts.push([`Interest forecast, ${ty(now)}`, fmt(Math.round((split ? split.interest : bal * r / 12 * done) + bal * r / 12 * left))]);
  if (monthly > 0) {
    facts.push([`Repayments left, ${ty(now)}`, fmt(Math.round(monthly * left))]);
    facts.push(["Repayments/yr", fmt(m.annualRepayment)]);
  } else facts.push(["Repayments", "None at this pay"]);
  if (d.studentLoan && d.studentLoan !== "none" && bal > 0) {
    const total = calcStudentLoanScenario(d, m).totalRepaidProjected;
    if (total > 0) facts.push(["Still to repay (est.)", fmt(total)]);
  }
  if (monthly > 0) facts.push(["Outcome", m.willClear ? "Clears before write-off" : "Written off at plan end"]);
  return facts;
}

// Every row's page by its key, across all three groupings.
export function worthGroupByKey(d, m, worth, key, ctx = {}) {
  for (const by of GROUPINGS) {
    const { assets, debts } = worthGroups(d, m, worth, by, ctx);
    const g = [...assets, ...debts].find(x => x.key === key);
    if (g) return g;
  }
  return null;
}

// ── The line over time ────────────────────────────────────────────────
// { points: [{ t, label }], nowIndex, acct: { id: number[] } }. Behind Now,
// the saved months (gaps filled in a straight line); Now, today's figures;
// ahead, the projection. With no saved months, the line starts at Now.
export function worthTimeline(d, m, worth, history = {}, now = new Date()) {
  const nowT = monthT(now);
  const saved = Object.keys(history || {})
    .filter(k => /^\d{4}-\d{2}$/.test(k) && tOfKey(k) < nowT && history[k] && typeof history[k] === "object")
    .map(k => ({ t: tOfKey(k), snap: history[k] }))
    .sort((a, b) => a.t - b.t);
  const start = saved.length ? saved[0].t : nowT;
  const nowIndex = nowT - start;
  const points = Array.from({ length: nowIndex + AHEAD + 1 }, (_, i) => ({ t: start + i, label: labelOfT(start + i) }));

  // The projection by category, a value for each month ahead, moved to start
  // from today's figure.
  const rows = calcNetWorthTrajectory(d, m, AHEAD / 12);
  const sl = d.studentLoan && d.studentLoan !== "none" && m.loanBal > 0 ? calcStudentLoanScenario(d, m).balancePath : [];
  const slAt = yr => (yr === 0 ? n(m.loanBal) : (sl[yr]?.bal ?? 0));
  const yearly = {
    cash: r => r.cash, investments: r => r.investments, pension: r => r.pension,
    home: r => r.propertyEquity + r.mortgageBalance, mortgage: r => r.mortgageBalance,
    studentLoan: r => slAt(r.year), personalLoan: r => Math.max(0, r.debts - slAt(r.year)),
  };
  const ahead = {};
  for (const c of [...worth.assets, ...worth.debts]) {
    const f = yearly[c.key], base = f(rows[0]);
    ahead[c.key] = Array.from({ length: AHEAD }, (_, i) => {
      const k = i + 1, y = Math.floor(k / 12), frac = (k % 12) / 12;
      const a = f(rows[y]), b = rows[y + 1] ? f(rows[y + 1]) : a;
      return Math.max(0, c.value + (a + (b - a) * frac - base));
    });
  }

  const acct = {};
  for (const c of [...worth.assets, ...worth.debts]) {
    for (const a of c.accounts) {
      const share = c.value ? a.value / c.value : 0;
      // A saved month's figure for the account: £0 where the month was saved
      // by account without it (every account over £0 is saved), or its
      // category's at today's share for a month saved without accounts.
      const pastOf = snap => {
        if (snap.accts && typeof snap.accts === "object") { const v = +snap.accts[a.id]; return isFinite(v) ? v : 0; }
        const cv = snap.cats?.[c.key];
        return cv != null && isFinite(+cv) ? +cv * share : 0;
      };
      const known = [...saved.map(s => ({ t: s.t, v: pastOf(s.snap) })), { t: nowT, v: a.value }];
      const past = [];
      for (let j = 0; j < known.length - 1; j++) {
        const p = known[j], q = known[j + 1];
        for (let t = p.t; t < q.t; t++) past.push(p.v + (q.v - p.v) * (t - p.t) / (q.t - p.t));
      }
      acct[a.id] = [...past, a.value, ...ahead[c.key].map(v => v * share)];
    }
  }
  return { points, nowIndex, acct };
}

// A row's line: its accounts' lines added up.
export function seriesOf(timeline, accounts) {
  const len = timeline.points.length;
  return Array.from({ length: len }, (_, i) => accounts.reduce((s, a) => s + (timeline.acct[a.id]?.[i] || 0), 0));
}

// The net worth line: assets less debts at every point.
export function netSeries(timeline, worth) {
  const a = seriesOf(timeline, worth.assets.flatMap(c => c.accounts));
  const b = seriesOf(timeline, worth.debts.flatMap(c => c.accounts));
  return a.map((v, i) => v - b[i]);
}

// The change over the last 12 months, once the line reaches that far back.
export function changeOver12(timeline, net) {
  if (timeline.nowIndex < 12) return null;
  return Math.round(net[timeline.nowIndex] - net[timeline.nowIndex - 12]);
}

// ── More detail ───────────────────────────────────────────────────────
// This tax year's payments on a loan, month by month, worked out from
// today's balance and rate: walked back from today, each payment's
// interest on the balance before it, the rest off the balance. Months
// of the tax year still to come show empty. null with nothing paid yet.
export function debtSplit(balance, annualRate, monthlyPay, now = new Date()) {
  const r = annualRate / 12, pay = n(monthlyPay);
  const startT = taxYearOf(now) * 12 + 3; // April
  const done = Math.min(12, monthT(now) - startT);
  if (!(pay > 0) || !(n(balance) > 0) || done <= 0) return null;
  const months = Array.from({ length: 12 }, (_, i) => ({ label: MON[(startT + i) % 12], interest: 0, principal: 0 }));
  let bal = n(balance);
  for (let i = done - 1; i >= 0; i--) {
    const before = (bal + pay) / (1 + r);
    const interest = Math.round(before * r);
    months[i] = { ...months[i], interest, principal: Math.round(pay) - interest };
    bal = before;
  }
  const total = f => months.reduce((s, x) => s + x[f], 0);
  return { paid: total("interest") + total("principal"), interest: total("interest"), principal: total("principal"), months };
}

export function studentLoanSplit(d, m, now = new Date()) {
  if (!(n(m.loanBal) > 0)) return null;
  return debtSplit(m.loanBal, resolveSlRate(d, +m.salary || +d.salary || 0), n(m.annualRepayment) / 12, now);
}

export function mortgageSplit(d, now = new Date()) {
  if (d.hasMortgage !== "yes") return null;
  return debtSplit(d.mortgageBalance, (+d.mortgageRate || 0) / 100, d.monthlyMortgage, now);
}

// The home less the mortgage, and this tax year's change in it: principal
// repaid, and the change in the home's value since the first month saved in
// this tax year (null without one).
export function homeShare(d, worth, history = {}, now = new Date()) {
  const home = worth.assets.find(c => c.key === "home")?.value || 0;
  const mortgage = worth.debts.find(c => c.key === "mortgage")?.value || 0;
  if (!home) return null;
  const split = mortgageSplit(d, now);
  const startT = taxYearOf(now) * 12 + 3, nowT = monthT(now);
  let valueChange = null;
  for (let t = startT; t < nowT; t++) {
    const v = history?.[keyOfT(t)]?.cats?.home;
    if (v != null && isFinite(+v)) { valueChange = Math.round(home - +v); break; }
  }
  return { share: home - mortgage, home, mortgage, principal: split ? split.principal : 0, valueChange };
}
