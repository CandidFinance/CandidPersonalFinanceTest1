// One customer's life, a tax year at a time, with or without Candid
// (investor-personas.md). `simulate` runs an archetype (archetypes.js) on an
// economic path with a set of Candid's levers switched on; with none, it's
// the life without Candid (inertia).
//
// Where the app decides something, the model asks the app: the cash moves are
// the app's own Assist plan (cashOpportunity) on that year's best rates, and
// whether to overpay a student loan is the app's calcStudentLoanScenario.
// The money that results (pay, tax, interest, growth) is worked out here with
// each year's rules (rules.js).
//
// All amounts in an archetype are in today's (2026/27) money; the model
// inflates them by prices (costs) or pay (salaries). Results come back in
// today's money too.

import { calcMetrics } from "../../src/lib/metrics.js";
import { cashOpportunity, MIN_ASSIST_GAIN } from "../../src/lib/assist.js";
import { calcStudentLoanScenario } from "../../src/lib/studentLoan.js";
import { calcStampDuty } from "../../src/lib/stampDuty.js";
import * as R from "./rules.js";

// Candid's levers. "today" levers are in the app now (or partly); "roadmap"
// levers aren't built yet (investor-personas.md, section 1).
export const LEVERS = {
  cash:          { group: "today",   label: "Better savings rates, after tax" },
  pensionMatch:  { group: "today",   label: "Full employer pension match" },
  taxTraps:      { group: "today",   label: "£100k trap, Child Benefit charge, bonus into pension" },
  selfPension:   { group: "today",   label: "Self-employed pension and tax relief" },
  studentLoan:   { group: "today",   label: "Whether to overpay a student loan" },
  investments:   { group: "today",   label: "ISA allowance and tax-free gains" },
  lisa:          { group: "today",   label: "Lifetime ISA for a first home" },
  debt:          { group: "today",   label: "Paying off expensive borrowing" },
  remortgage:    { group: "roadmap", label: "Remortgage timing, avoiding the SVR" },
  childcare:     { group: "roadmap", label: "Tax-Free Childcare" },
  drawdown:      { group: "roadmap", label: "Retirement income, tax-efficiently" },
  partner:       { group: "roadmap", label: "A partner's ISA and allowance" },
  ni:            { group: "roadmap", label: "Voluntary NI in a career break" },
  sharia:        { group: "roadmap", label: "Sharia-compliant savings" },
};
export const TODAY = Object.keys(LEVERS).filter(k => LEVERS[k].group === "today");
export const ALL = Object.keys(LEVERS);

const annuity = (balance, ratePct, years) => {
  if (years <= 0) return balance;
  const r = ratePct / 100;
  return r === 0 ? balance / years : balance * r / (1 - Math.pow(1 + r, -years));
};
const clone = x => JSON.parse(JSON.stringify(x));
const sum = (list, f = x => x) => list.reduce((t, x) => t + f(x), 0);

export function simulate(arch, { path = "base", levers = [], actionRate = 0, membership = null } = {}) {
  const on = new Set(levers);
  const spans = membership ?? arch.member;
  const isMember = t => on.size > 0 && spans.some(([a, b]) => t >= a && t <= b);
  const idx = R.indices(path);
  const hpi = [1];
  for (let t = 1; t <= R.YEARS; t++) {
    const e = R.economy(path, t);
    hpi.push(hpi[t - 1] * (1 + (arch.region === "london_se" ? e.housePricesLondonSE : e.housePrices) / 100));
  }

  // ── State ──
  const people = arch.people.map(p => ({
    ...clone(p),
    workFactor: p.workFactor ?? 1,
    pension: { own: 0, employer: 0, matchUpTo: null, pot: 0, sacrifice: false, type: "none", ...clone(p.pension || {}) },
    extraSacrificePct: 0,     // Candid: salary sacrificed to stay under a tax trap
    selfPensionPct: 0,        // Candid: self-employed standing pension payment
    sl: p.sl ? { ...clone(p.sl), overpay: p.sl.overpay || 0 } : null,
    lisa: 0, lisaOpen: false, lisaAmount: 0,
    isaSS: p.isaSS || 0,
    gia: p.gia ? clone(p.gia) : { value: 0, basis: 0 },
    retired: p.employment === "retired",
    drawdown: null,
    lostStatePension: 0,
  }));
  const accounts = arch.cash.map(a => ({ ...clone(a) }));
  const inflow = () => accounts[arch.inflow ?? 0];
  let pb = arch.premiumBonds || 0;
  let cashShare = clone(arch.cashShare || [1]);
  let property = arch.housing.type === "rent" ? null : { value: arch.housing.value };
  let mortgage = arch.housing.balance ? {
    balance: arch.housing.balance, ratePct: arch.housing.ratePct ?? null, fixEnd: arch.housing.fixEnd ?? null,
    termEnd: 1 + (arch.housing.termYears ?? 25), svr: arch.housing.type === "svr",
  } : null;
  let rent = arch.housing.type === "rent" ? arch.housing.rent : 0;
  let spending = arch.spending;
  const debts = (arch.debts || []).map(d => ({ ...d }));
  const children = clone(arch.children || []);
  let tfcClaimed = false;
  let fees = 0, feesReal = 0;
  let prevSurplus = 0;
  const rows = [];

  const realOf = (v, t) => v / idx.cpi[t];

  // Cash rates in year t; Candid's accounts are kept at the best rate while
  // the person is a member, and drift to mid-market once they leave.
  const rateOf = (a, e, member) => {
    switch (a.kind) {
      case "current": return 0;
      case "bigbank": return e.bigBank;
      case "legacy": return Math.max(0.1, e.bankRate + a.spread);
      case "best": return member ? e.bestEasyAccess : e.midMarket;
      case "bestIsa": return member ? e.bestCashIsa : e.midMarket;
      case "diy": return e.bestEasyAccess;       // someone who keeps their own savings on top rates
      case "diyIsa": return e.bestCashIsa;
      case "sharia": return member ? e.shariaExpectedProfit : e.shariaExpectedProfit - 0.75;
      default: return 0;
    }
  };

  // Takes money out: ordinary accounts lowest rate first, then Premium Bonds,
  // ISAs, investments, and finally a credit card.
  const withdraw = (amount, e, member) => {
    let left = amount;
    const order = accounts.map((a, i) => ({ a, i })).filter(x => !x.a.isa)
      .sort((x, y) => rateOf(x.a, e, member) - rateOf(y.a, e, member));
    for (const { a } of order) { const take = Math.min(left, Math.max(0, a.amount)); a.amount -= take; left -= take; if (left <= 0) return; }
    const fromPb = Math.min(left, pb); pb -= fromPb; left -= fromPb; if (left <= 0) return;
    for (const a of accounts.filter(a => a.isa)) { const take = Math.min(left, Math.max(0, a.amount)); a.amount -= take; left -= take; if (left <= 0) return; }
    for (const p of people) { const take = Math.min(left, p.isaSS); p.isaSS -= take; left -= take; if (left <= 0) return; }
    for (const p of people) {
      if (p.gia.value <= 0) continue;
      const take = Math.min(left, p.gia.value);
      p.gia.basis -= p.gia.basis * take / p.gia.value; p.gia.value -= take; left -= take; if (left <= 0) return;
    }
    let card = debts.find(d => d.name === "Credit card (shortfall)");
    if (!card) { card = { name: "Credit card (shortfall)", balance: 0, ratePct: 24, payment: 0 }; debts.push(card); }
    card.balance += left;
  };
  const liquid = () => sum(accounts.filter(a => !a.isa), a => Math.max(0, a.amount)) + pb;
  const addCash = amount => { inflow().amount += amount; };
  const account = (kind, isa) => {
    let a = accounts.find(x => x.kind === kind && !!x.isa === !!isa);
    if (!a) { a = { name: kind, amount: 0, kind, isa: !!isa }; accounts.push(a); }
    return a;
  };

  const owns = () => property != null;

  for (let t = 1; t <= R.YEARS; t++) {
    const e = R.economy(path, t), th = R.thresholds(path, t), y = R.yearOf(t);
    const prices = idx.cpi[t - 1], pay = idx.pay[t - 1];
    const member = isMember(t);
    const a = member ? actionRate : 0;
    const lever = k => member && on.has(k);
    let oneOff = 0, cashIn = 0, livingFactor = 1;
    const flags = [];

    // ── Life events ──
    const yearIncome = people.map(() => ({ factor: 1, bonus: null, taxFreeLump: 0, taxableLump: 0 }));
    for (const ev of arch.events?.[t] || []) {
      const p = people[ev.person ?? 0], yi = yearIncome[ev.person ?? 0];
      switch (ev.type) {
        case "salary":
          // Half of a pay rise goes on spending (after tax, roughly 60% of it).
          if (ev.creep !== false && p.employment !== "retired") spending += Math.max(0, ev.to - (p.salary || 0)) * 0.6 * (arch.creep ?? 0.5);
          p.salary = ev.to;
          if (ev.pension) Object.assign(p.pension, ev.pension);
          if (ev.employment) { p.employment = ev.employment; p.retired = ev.employment === "retired"; }
          if (ev.bonus != null) p.bonus = ev.bonus;
          break;
        case "bonus": yi.bonus = ev.amount; break;
        case "monthsOut": yi.factor = (12 - ev.months) / 12; break;
        case "redundancy": yi.factor = (12 - ev.monthsOut) / 12; yi.taxFreeLump += Math.min(30000, ev.payout) * prices; yi.taxableLump += Math.max(0, ev.payout - 30000) * prices; break;
        case "break": yi.factor = 0; oneOff += (ev.cost || 0) * prices; if (ev.niGap) p.niGapYear = t; livingFactor = ev.livingFactor ?? 1; break;
        case "partTime": p.workFactor = ev.factor; break;
        case "retire": p.retired = true; p.employment = "retired"; p.dbIncome = ev.dbIncome || 0; cashIn += (ev.lumpSum || 0) * prices; if (ev.drawdown) p.drawdown = { plan: ev.drawdown, start: t }; break;
        case "baby": children.push({ born: y }); break;
        case "inheritance": cashIn += ev.amount * prices; break;
        case "gift": oneOff += ev.amount * prices; break;
        case "spend": spending += ev.amount; break;
        case "oneOff": oneOff += ev.amount * prices; break;
        case "rent": rent = ev.to; break;
        case "downsize": { const release = property.value - ev.newValue * hpi[t - 1]; property.value = ev.newValue * hpi[t - 1]; cashIn += release - (ev.costs || 0) * prices; break; }
        case "buy": p._buy = ev; break;
        default: throw new Error(`Unknown event ${ev.type}`);
      }
    }
    if (cashIn) addCash(cashIn);

    // ── House purchase (start of year) ──
    const buyer = people.find(p => p._buy);
    if (buyer) {
      const ev = buyer._buy; delete buyer._buy;
      const price = ev.price * hpi[t - 1];
      const firstTime = !owns();
      const sdlt = calcStampDuty({ price, nation: "england", firstTimeBuyers: people.filter(p => p.buying !== false).map(() => firstTime) }).total || 0;
      const lisaUse = price <= R.LISA_PRICE_CAP ? sum(people, p => p.lisa) : 0;
      for (const p of people) if (price <= R.LISA_PRICE_CAP) { p.lisa = 0; p.lisaOpen = false; p.lisaAmount = 0; }
      const buffer = (spending * pay + rent * pay) / 4;
      const costs = sdlt + 2500 * prices;
      const available = Math.max(0, liquid() + sum(accounts.filter(x => x.isa), x => x.amount) - buffer - costs);
      const deposit = Math.min(price * (ev.maxDepositPct ?? 0.25), available + lisaUse);
      const fromCash = Math.max(0, deposit - lisaUse) + costs;
      withdraw(fromCash, e, member);
      property = { value: price };
      mortgage = { balance: price - deposit, ratePct: e.avgFix, fixEnd: t + 2, termEnd: t + (ev.termYears ?? 30), svr: false };
      rent = 0;
      flags.push(`buys at ${Math.round(price)}`);
    }

    // ── Habits: some already fill a Stocks and Shares ISA every year ──
    const ssSubs = people.map(() => 0);
    for (const [i, p] of people.entries()) {
      if (!p.isaHabit) continue;
      const spare = Math.max(0, liquid() - (spending * pay + rent * pay) / 4);
      const put = Math.min(p.isaHabit * prices, spare, R.ISA_ALLOWANCE);
      withdraw(put, e, member); p.isaSS += put; ssSubs[i] = put;
    }

    // ── Candid: Lifetime ISA, from savings, for a first home within reach ──
    const lisaSubs = people.map(() => 0);
    const buyAhead = Object.entries(arch.events || {}).find(([k, evs]) => +k > t && evs.some(ev => ev.type === "buy"));
    for (const [i, p] of people.entries()) {
      const age = p.age + t - 1;
      if (lever("lisa") && !arch.noLisa && !p.lisaOpen && !owns() && buyAhead && p.buying !== false && age < 40) {
        const buyEv = buyAhead[1].find(ev => ev.type === "buy");
        if (buyEv.price * hpi[+buyAhead[0] - 1] <= R.LISA_PRICE_CAP) { p.lisaOpen = true; p.lisaAmount = R.LISA_LIMIT * a; }
      }
      if (p.lisaOpen && !owns() && age < 50) {
        const spare = Math.max(0, liquid() - (spending * pay + rent * pay) / 4);
        const pay_in = Math.min(p.lisaAmount, spare);
        withdraw(pay_in, e, member);
        p.lisa = (p.lisa + pay_in * 1.25) ;
        lisaSubs[i] = pay_in;
      }
    }

    // ── Incomes, before Candid's pension levers ──
    const incomeOf = (p, i) => {
      const yi = yearIncome[i];
      const working = !p.retired && (p.employment === "employed" || p.employment === "self");
      const gross = working ? p.salary * pay * p.workFactor * yi.factor : 0;
      const bonus = working ? (yi.bonus ?? p.bonus ?? 0) * pay : 0;
      const age = p.age + t - 1;
      const statePension = age >= (p.spa ?? 67) ? R.STATE_PENSION_2026 * Math.pow(1 + R.STATE_PENSION_GROWTH / 100, t - 1) - p.lostStatePension : 0;
      const db = (p.dbIncome || 0) * prices;
      return { working, gross, bonus, statePension, db, age };
    };
    const inc = people.map(incomeOf);

    // Pension contributions and the levers that change them.
    for (const [i, p] of people.entries()) {
      const x = inc[i];
      const dc = p.pension.type === "dc" && x.working && p.employment === "employed";
      if (dc && i === 0 && lever("pensionMatch") && p.pension.matchUpTo != null && p.pension.own < p.pension.matchUpTo) {
        p.pension.own += a * (p.pension.matchUpTo - p.pension.own);
        flags.push("raises pension to the match");
      }
      x.own = dc ? x.gross * p.pension.own / 100 : 0;
      x.employer = dc ? x.gross * (p.pension.matchUpTo != null ? Math.min(p.pension.own, p.pension.matchUpTo) : p.pension.employer) / 100 : 0;
      x.taxableLump = yearIncome[i].taxableLump;
      x.taxFreeLump = yearIncome[i].taxFreeLump;
      // Adjusted net income before any extra sacrifice.
      x.aniBefore = x.gross + x.bonus + x.taxableLump - x.own + x.db + x.statePension;
      // Candid: sacrifice to stay under the £100k trap, and under the Child
      // Benefit charge, as far as the household's spare money allows (what
      // it costs in take-home pay: about 40p in the pound under the trap,
      // 58p under the charge). Reset each year while a member; after they
      // leave, the last percentage stays in place, paused in a year after
      // one that ran short.
      if (dc && i === 0 && lever("taxTraps")) {
        const cb = children.some(c => y - c.born < 18);
        const salaryAni = x.aniBefore - x.bonus - x.taxableLump;
        let target = 0, netCost = 0.4;
        if (salaryAni > R.CHILDCARE_INCOME_LIMIT) target = salaryAni - R.CHILDCARE_INCOME_LIMIT;
        else if (cb && salaryAni > R.HICBC_START) { target = Math.min(salaryAni, R.HICBC_END) - R.HICBC_START; netCost = 0.58; }
        target = Math.min(target, Math.max(0, prevSurplus) / netCost);
        p.extraSacrificePct = a * target / Math.max(1, x.gross) * 100;
      }
      x.extra = dc && prevSurplus >= 0 ? x.gross * p.extraSacrificePct / 100 : 0;
      // Candid: a bonus (or taxable redundancy pay) into the pension. All of
      // the part taxed at 60%, half of the part taxed at 40% or 45%.
      x.bonusSacrifice = 0;
      const lump = x.bonus + x.taxableLump;
      if (dc && i === 0 && lever("taxTraps") && lump > 0) {
        const top = x.aniBefore - x.extra, bottom = top - lump;
        const overlap = (lo, hi) => Math.max(0, Math.min(top, hi) - Math.max(bottom, lo));
        const zone60 = overlap(R.CHILDCARE_INCOME_LIMIT, th.additional);
        const zone40 = overlap(th.hrt, R.CHILDCARE_INCOME_LIMIT) + overlap(th.additional, Infinity);
        x.bonusSacrifice = a * (zone60 + 0.5 * zone40);
        if (x.bonusSacrifice > 0) flags.push("bonus into pension");
      }
      // Self-employed: a standing 5% of profit, plus the profit taxed at 40%
      // while a member, as cash allows. Paused in a year after one that ran
      // short, as people do when money's tight.
      x.selfPension = 0;
      if (p.employment === "self" && x.working && i === 0 && prevSurplus >= 0) {
        if (lever("selfPension")) p.selfPensionPct = Math.max(p.selfPensionPct, 5 * a);
        x.selfPension = x.gross * p.selfPensionPct / 100;
        if (lever("selfPension")) x.selfPension += a * Math.min(Math.max(0, x.gross - th.hrt), Math.max(0, prevSurplus));
      }
      // Cap at the annual allowance.
      const room = Math.max(0, R.PENSION_ANNUAL_ALLOWANCE - x.own - x.employer);
      x.extra = Math.min(x.extra, room);
      x.bonusSacrifice = Math.min(x.bonusSacrifice, Math.max(0, room - x.extra));
      x.selfPension = Math.min(x.selfPension, R.PENSION_ANNUAL_ALLOWANCE);
    }

    // Retirement income from a pension pot (Gareth). Without Candid: the 25%
    // tax-free lump all at once (into the bank), then the rest evenly over ten
    // years. With it (roadmap): a set amount each year, a quarter of each
    // payment tax-free, keeping within the basic-rate band.
    for (const [i, p] of people.entries()) {
      const x = inc[i];
      x.drawTaxable = 0; x.drawFree = 0;
      if (!p.drawdown || p.pension.pot <= 0) continue;
      if (lever("drawdown")) p.drawdown.phased = true;
      if (p.drawdown.phased) {
        const take = Math.min(p.pension.pot, p.drawdown.plan.annual * prices);
        p.pension.pot -= take;
        x.drawFree = take * 0.25; x.drawTaxable = take * 0.75;
      } else {
        if (!p.drawdown.lumpTaken) { x.drawFree = p.pension.pot * 0.25; p.pension.pot -= x.drawFree; p.drawdown.lumpTaken = true; }
        const yearsLeft = Math.max(1, p.drawdown.start + 10 - t);
        x.drawTaxable = p.pension.pot / yearsLeft; p.pension.pot -= x.drawTaxable;
      }
    }

    // ── Tax, NI, student loan, by person ──
    for (const [i, p] of people.entries()) {
      const x = inc[i];
      const sacrificed = (p.pension.sacrifice ? x.own : 0) + x.extra + x.bonusSacrifice;
      const niFree = Math.min(sacrificed, R.sacrificeNiFree(t));
      x.ani = x.gross + x.bonus + x.taxableLump - x.own - x.extra - x.bonusSacrifice - x.selfPension + x.db + x.statePension + x.drawTaxable;
      x.incomeTax = R.incomeTax(x.ani, th);
      const earnings = x.gross + x.bonus + x.taxableLump;
      x.ni = p.employment === "self" ? R.class4NI(x.gross, th) : x.working ? R.employeeNI(earnings - niFree, th) : 0;
      // Student loan: on earnings after salary sacrifice.
      x.slRepay = 0; x.slOverpay = 0;
      if (p.sl && p.sl.balance > 0) {
        const slEarnings = earnings - (p.pension.sacrifice ? x.own : 0) - x.extra - x.bonusSacrifice;
        x.slRepay = Math.min(p.sl.balance, 0.09 * Math.max(0, slEarnings - R.slThreshold(p.sl.plan, path, t)));
        // Candid: the app's verdict on overpaying, with this year's figures.
        if (lever("studentLoan") && i === 0) {
          const d = { studentLoan: p.sl.plan, loanBalance: String(Math.round(p.sl.balance)), salary: String(Math.round(x.gross)), salaryTrajectory: "stable" };
          const m = calcMetrics(d, { isaRate: e.bestCashIsa, nonIsaRate: e.bestEasyAccess });
          const verdict = calcStudentLoanScenario(d, { ...m, bestSavingsRate: e.bestCashIsa });
          p.sl.candidOverpay = verdict.worthOverpaying;
          if (!verdict.worthOverpaying && p.sl.overpay > 0) { p.sl.overpay *= 1 - a; flags.push("stops overpaying the student loan"); }
        }
        x.slOverpay = Math.min(Math.max(0, p.sl.balance - x.slRepay), p.sl.overpay * prices);
      }
      x.net = x.gross + x.bonus + x.taxableLump + x.taxFreeLump + x.db + x.statePension + x.drawTaxable + x.drawFree
        - x.own - x.extra - x.bonusSacrifice - x.selfPension
        - x.incomeTax - x.ni - x.slRepay;
    }

    // ── Household costs ──
    const cbKids = children.filter(c => y - c.born >= 0 && y - c.born < 18);
    const cbGross = cbKids.length ? (R.CHILD_BENEFIT_2026.eldest + (cbKids.length - 1) * R.CHILD_BENEFIT_2026.other) * prices : 0;
    const topAni = Math.max(...inc.map(x => x.ani));
    const hicbc = cbGross * Math.min(1, Math.max(0, (topAni - R.HICBC_START) / (R.HICBC_END - R.HICBC_START)));
    // Paid childcare only when every adult works; otherwise a parent at home
    // looks after the children.
    const allWorking = inc.every(x => x.working);
    const childcareEligible = allWorking && inc.every(x => x.ani <= R.CHILDCARE_INCOME_LIMIT);
    let childcare = 0, tfc = 0;
    if (lever("childcare")) tfcClaimed = true;
    for (const c of children) {
      const age = y - c.born;
      const cost = !allWorking ? 0 : age >= 1 && age <= 4 ? R.NURSERY_COST : age >= 5 && age <= 11 && arch.wraparound !== false ? R.WRAPAROUND_COST : 0;
      if (!cost) continue;
      const funded = age >= 1 && age <= 4 && childcareEligible ? R.FUNDED_HOURS_VALUE : 0;
      const net = (cost - funded) * prices;
      childcare += net;
      if (tfcClaimed && childcareEligible) tfc += Math.min(net * 0.2, R.TFC_MAX);
    }
    if (children.length && !childcareEligible && children.some(c => y - c.born >= 1 && y - c.born <= 4)) flags.push("loses childcare support");

    // Mortgage: a new fix when the old one ends. Without Candid, two months
    // on the lender's standard variable rate, then the lender's own deal;
    // with it (roadmap), the best rate on time.
    let housing = rent * pay;
    if (mortgage && mortgage.balance > 0) {
      const yearsLeft = Math.max(1, mortgage.termEnd - t);
      let extraInterest = 0;
      if (mortgage.svr) {
        mortgage.ratePct = e.svr;
        if (lever("remortgage")) {
          const spare = Math.max(0, liquid() - (spending * pay) / 2);
          const pay_off = a * Math.min(mortgage.balance, spare);
          withdraw(pay_off, e, member); mortgage.balance -= pay_off;
          if (pay_off > 0) flags.push("pays off the SVR mortgage from savings");
        }
      } else if (mortgage.fixEnd != null && t >= mortgage.fixEnd) {
        if (lever("remortgage")) mortgage.ratePct = e.bestFix;
        else { mortgage.ratePct = e.avgFix; extraInterest = mortgage.balance * (e.svr - e.avgFix) / 100 * 2 / 12; }
        mortgage.fixEnd = t + 2;
      }
      const payment = Math.min(mortgage.balance * (1 + mortgage.ratePct / 100), annuity(mortgage.balance, mortgage.ratePct, yearsLeft));
      const interest = mortgage.balance * mortgage.ratePct / 100;
      mortgage.balance = Math.max(0, mortgage.balance + interest - payment);
      housing += payment + extraInterest;
    }

    // Debts: Candid pays expensive ones off from savings above a month's spending.
    let debtPayments = 0;
    for (const dbt of debts) {
      if (dbt.balance <= 0) continue;
      if (lever("debt") && dbt.ratePct >= 8) {
        const spare = Math.max(0, liquid() - spending * pay / 12);
        const pay_off = a * Math.min(dbt.balance, spare);
        withdraw(pay_off, e, member); dbt.balance -= pay_off;
        if (pay_off > 0) flags.push(`pays off ${dbt.name}`);
      }
      const interest = dbt.balance * dbt.ratePct / 100;
      const paid = Math.min(dbt.balance + interest, Math.max(dbt.payment * prices, dbt.name.startsWith("Credit card (shortfall)") ? (dbt.balance + interest) / 3 : 0));
      dbt.balance = dbt.balance + interest - paid;
      debtPayments += paid;
    }

    // Voluntary NI for a gap year (roadmap): about £960 keeps a year of state pension.
    for (const p of people) {
      if (p.niGapYear === t) {
        if (lever("ni")) { oneOff += 18.40 * 52 * prices; flags.push("pays voluntary NI"); }
        else p.lostStatePension = R.STATE_PENSION_2026 / 35;
      }
    }

    const subscription = member ? R.annualPrice(t) : 0;
    fees += subscription; feesReal += subscription / prices;

    // ── Candid: cash moves, the app's own Assist plan on this year's rates ──
    const shariaOnly = arch.sharia === true;
    const rowsFor = () => {
      if (shariaOnly) {
        if (!lever("sharia")) return [];
        return [
          { provider_name: "Sharia bank A", product_name: "Expected profit ISA", account_type: "Easy access ISA", rate_aer: e.shariaExpectedProfit + 0.1, is_isa: true },
          { provider_name: "Sharia bank B", product_name: "Expected profit ISA", account_type: "Easy access ISA", rate_aer: e.shariaExpectedProfit, is_isa: true },
          { provider_name: "Sharia bank A", product_name: "Expected profit saver", account_type: "Easy access", rate_aer: e.shariaExpectedProfit, is_isa: false },
          { provider_name: "Sharia bank B", product_name: "Expected profit saver", account_type: "Easy access", rate_aer: e.shariaExpectedProfit - 0.1, is_isa: false },
        ];
      }
      return [
        { provider_name: "Best ISA", product_name: "Easy access ISA", account_type: "Easy access ISA", rate_aer: e.bestCashIsa, is_isa: true },
        { provider_name: "Second ISA", product_name: "Easy access ISA", account_type: "Easy access ISA", rate_aer: e.bestCashIsa - 0.1, is_isa: true },
        { provider_name: "Best saver", product_name: "Easy access", account_type: "Easy access", rate_aer: e.bestEasyAccess, is_isa: false },
        { provider_name: "Second saver", product_name: "Easy access", account_type: "Easy access", rate_aer: e.bestEasyAccess - 0.1, is_isa: false },
        { provider_name: "NS&I", product_name: "Premium Bonds", account_type: "Premium Bonds", rate_aer: e.premiumBonds, is_isa: false },
      ];
    };
    const cashSubs = people.map(() => 0);
    const moveCash = (i, isaOnly) => {
      const p = people[i], x = inc[i];
      const tiers = accounts.map((acc, k) => ({ acc, k })).filter(({ acc }) => !acc.isa);
      const d = {
        salary: String(Math.round(x.ani)), age: String(x.age), inputsTaxYear: y,
        cashTiers: tiers.map(({ acc }) => ({ name: acc.name, amount: String(Math.max(0, Math.round(acc.amount))), rate: String(rateOf(acc, e, member)) })),
        premiumBonds: String(Math.round(pb)), isaThisYearCash: String(Math.round(cashSubs[i])), isaThisYearLISA: String(Math.round(lisaSubs[i])),
        isaThisYearSS: String(Math.round(ssSubs[i])),
        assistSkipPb: shariaOnly || arch.noPremiumBonds === true,
        monthlyExpenses: String(Math.round(spending * pay / 12)),
      };
      // Old Cash ISAs on poor rates: Assist's note to transfer them in.
      if (!isaOnly) for (const acc of accounts.filter(x => x.isa && x.kind === "legacy" && x.amount > 0)) {
        const amt = acc.amount * a; acc.amount -= amt; account(shariaOnly ? "sharia" : "bestIsa", true).amount += amt;
        flags.push("transfers an old Cash ISA");
      }
      const rowList = rowsFor();
      const m = calcMetrics(d, { rows: rowList });
      const opp = cashOpportunity(d, m, rowList);
      if (!opp || opp.gain < MIN_ASSIST_GAIN) return;
      for (const line of opp.lines) {
        if (isaOnly && line.section !== "Cash ISA") continue;
        const o = line.option;
        const dest = line.section === "Cash ISA" ? account(shariaOnly ? "sharia" : "bestIsa", true)
          : line.section === "Premium Bonds" ? null : account(shariaOnly ? "sharia" : "best", false);
        let moved = 0;
        for (const f of o.from) {
          const amt = f.amount * a;
          if (f.index === "pb") pb -= amt;
          else tiers[f.index].acc.amount -= amt;
          moved += amt;
        }
        if (dest) dest.amount += moved; else pb += moved;
        if (line.section === "Cash ISA") cashSubs[i] += moved;
      }
      flags.push(isaOnly ? "partner's Cash ISA" : "moves cash");
    };
    if (shariaOnly ? lever("sharia") : lever("cash")) moveCash(0, false);
    if (lever("partner") && people.length > 1) { moveCash(1, true); cashShare = people.map(() => 1 / people.length); }

    // ── Candid: investments into the ISA, and the year's tax-free gains ──
    const realised = people.map(() => 0);
    for (const [i, p] of people.entries()) {
      if (!lever("investments") || p.gia.value <= 0) continue;
      const room = Math.max(0, R.ISA_ALLOWANCE - cashSubs[i] - lisaSubs[i] - ssSubs[i]);
      const move = a * Math.min(p.gia.value, room);
      if (move > 0) {
        const basisShare = p.gia.basis * move / p.gia.value;
        realised[i] += move - basisShare;
        p.gia.basis -= basisShare; p.gia.value -= move; p.isaSS += move;
      }
      const gainLeft = Math.max(0, p.gia.value - p.gia.basis);
      const harvest = a * Math.min(gainLeft, Math.max(0, R.CGT_ALLOWANCE - realised[i]));
      p.gia.basis += harvest; realised[i] += harvest;
      if (move > 0 || harvest > 0) flags.push("ISA and tax-free gains");
    }

    // ── Interest, prizes and investment returns ──
    const surplusBeforeInterest = sum(inc, x => x.net) + cbGross - hicbc + tfc - spending * pay * livingFactor - housing * (rent > 0 ? livingFactor : 1) - childcare - debtPayments
      - sum(inc, x => x.slOverpay) - oneOff - subscription;
    let taxableInterest = 0, taxFree = 0;
    for (const acc of accounts) {
      const flowShare = acc === inflow() ? surplusBeforeInterest / 2 : 0;
      const r = rateOf(acc, e, member) / 100;
      const interest = Math.max(0, acc.amount + flowShare) * r;
      if (acc.isa) taxFree += interest; else taxableInterest += interest;
      acc.amount += interest;
    }
    const prizes = pb * e.premiumBonds / 100; pb += prizes; taxFree += prizes;
    for (const p of people) { const g = p.lisa * (member ? e.bestCashIsa : e.midMarket) / 100; p.lisa += g; }
    let savingsTaxTotal = 0, dividendTaxTotal = 0, cgtTotal = 0;
    for (const [i, p] of people.entries()) {
      const x = inc[i];
      const mine = taxableInterest * (cashShare[i] || 0);
      savingsTaxTotal += R.savingsTax(mine, x.ani, th, t);
      const divs = p.gia.value * 0.02;
      dividendTaxTotal += R.dividendTax(divs, x.ani + mine, th, t);
      p.gia.value *= 1.06; p.gia.basis += divs; // dividends reinvested
      p.isaSS *= 1 + e.equity / 100;
      cgtTotal += Math.max(0, realised[i] - R.CGT_ALLOWANCE) * R.cgtRate(R.bandOf(x.ani, th));
      // Pension pot.
      const contrib = x.own + x.employer + x.extra + x.bonusSacrifice + x.selfPension;
      p.pension.pot = p.pension.pot * (1 + e.equity / 100) + contrib * (1 + e.equity / 200);
      // Student loan balance.
      if (p.sl && p.sl.balance > 0) {
        const rate = R.slRate(p.sl.plan, x.gross + x.bonus, path, t);
        p.sl.balance = p.sl.balance * (1 + rate / 100) - x.slRepay - x.slOverpay;
        if (p.sl.candidOverpay && lever("studentLoan") && i === 0) {
          // Only from cash beyond a year's outgoings: a big cost may be coming.
          const spare = Math.max(0, liquid() - (spending * pay + housing));
          const extra = a * Math.min(spare, p.sl.balance);
          withdraw(extra, e, member); p.sl.balance -= extra;
          if (extra > 0) flags.push("overpays the student loan");
        }
        if (y >= p.sl.writeOffYear || p.sl.balance < 1) p.sl.balance = 0;
      }
    }

    // ── The year's cash flow lands in the usual account ──
    const surplus = surplusBeforeInterest - savingsTaxTotal - dividendTaxTotal - cgtTotal;
    if (surplus >= 0) addCash(surplus); else withdraw(-surplus, e, member);
    prevSurplus = surplus;

    // ── Net worth, after tax, in today's money ──
    const cashTotal = sum(accounts, x => x.amount) + pb;
    const latentCgt = sum(people, p => Math.max(0, p.gia.value - p.gia.basis - R.CGT_ALLOWANCE) * 0.2);
    const pensions = sum(people, p => pensionAfterTax(p.pension.pot / idx.cpi[t]) * idx.cpi[t]);
    const slLiability = people.reduce((s, p) => s + (p.sl && p.sl.balance > 0 ? studentLoanOwed(p, (p.salary || 0) * pay * p.workFactor, path, t) : 0), 0);
    const debt = sum(debts, d => Math.max(0, d.balance));
    const statePensionLost = sum(people, p => p.lostStatePension) * 15;
    const netWorth = cashTotal + sum(people, p => p.lisa + p.isaSS + p.gia.value) - latentCgt + pensions
      + (property ? property.value * hpi[t] / hpi[t - 1] : 0) - (mortgage ? mortgage.balance : 0) - slLiability - debt - statePensionLost * prices;
    if (property) property.value *= hpi[t] / hpi[t - 1];

    rows.push({
      t, year: y, member,
      netWorth: realOf(netWorth, t),
      cash: realOf(cashTotal, t), pensions: realOf(pensions, t),
      investments: realOf(sum(people, p => p.isaSS + p.gia.value + p.lisa) - latentCgt, t),
      property: realOf(property ? property.value : 0, t), mortgage: realOf(mortgage ? mortgage.balance : 0, t),
      studentLoan: realOf(slLiability, t), debt: realOf(debt, t),
      income: realOf(sum(inc, x => x.gross + x.bonus + x.db + x.statePension), t),
      takeHome: realOf(sum(inc, x => x.net) + cbGross - hicbc, t),
      surplus: realOf(surplus, t),
      tax: realOf(sum(inc, x => x.incomeTax + x.ni) + savingsTaxTotal + dividendTaxTotal + cgtTotal + hicbc, t),
      fee: subscription, feeReal: subscription / prices,
      flags,
    });
  }
  return { rows, fees, feesReal };
}

// A pension pot as money in hand: a quarter tax-free and the rest taxed when
// drawn, at 20% on the first £500,000 (in today's money: an income within the
// basic-rate band), at 40% above it.
export function pensionAfterTax(potToday) {
  const first = Math.min(potToday, 500000), rest = Math.max(0, potToday - 500000);
  return first * (0.25 + 0.75 * 0.8) + rest * (0.25 + 0.75 * 0.6);
}

// What's still to be repaid on a student loan, in today's money: the
// remaining repayments to the write-off date, with pay rising 1% a year
// above inflation and the threshold and interest at today's real values.
// `earnings`: their usual pay (not a break year's), in this year's money.
function studentLoanOwed(p, earnings, path, t) {
  let balance = p.sl.balance, owed = 0;
  const threshold = R.slThreshold(p.sl.plan, path, t);
  const realRate = (R.slRate(p.sl.plan, earnings, path, t) - 2) / 100;
  for (let k = 1; R.yearOf(t) + k <= p.sl.writeOffYear && balance > 0; k++) {
    const pay = 0.09 * Math.max(0, earnings * Math.pow(1.01, k) - threshold);
    balance = balance * (1 + realRate);
    const r = Math.min(balance, pay);
    balance -= r; owed += r;
  }
  return owed;
}
