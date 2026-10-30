import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { ISA_ALLOWANCE, CGT_ANNUAL_ALLOWANCE, DIVIDEND_ALLOWANCE } from "./tax.js";
import {
  buildProgressSnapshot, targetRows, annualGoals, netWorthPicture, incomeBands, incomePosition,
  goalVaults, withVault, withoutVault, poundsInput, loanOverpaidAfter, newlyReachedGoals, markGoalsSeen, goalsToCelebrate, sortGoals,
  withAllowanceGoal,
} from "./progressTracker.js";

const answered = keys => ({ selectedModules: keys, answeredModules: keys });
const base = {
  name: "Sam", employmentStatus: "employed", salary: "55000", monthlyExpenses: "2000",
  cashTiers: [{ amount: "12000", rate: "4.5" }], cashSavings: "12000", savingsRate: "4.5",
  premiumBonds: "0", isaThisYearSS: "8000", isaThisYearCash: "2000", isaPrevSS: "15000",
  hasPension: "yes", myContribution: "5", employerMatch: "5", employerContributionType: "match",
  potValue: "40000", potValue2: "0", pensionType: "sacrifice",
  studentLoan: "none", hasMortgage: "no", hasPersonalLoan: "no",
  hasInvestments: "yes", unwrappedValue: "3000", propertyBuyingMode: "alone",
  financialGoals: [], higherBuffer: "no",
  ...answered(["cash", "investments", "pension"]),
};
const loan = { ...base, studentLoan: "plan2", loanBalance: "30000", ...answered(["cash", "investments", "pension", "studentLoan"]) };
const rowsOf = (d, statuses = {}) => targetRows(d, calcMetrics(d), statuses);
const rowOf = (d, id, statuses) => rowsOf(d, statuses).find(r => r.id === id);
const idsOf = (d, statuses) => rowsOf(d, statuses).map(r => r.id);

test("every row shows, locked until its module's questions are answered", () => {
  const openIds = d => rowsOf(d).filter(r => !r.locked).map(r => r.id);
  // No investments outside an ISA, so no capital gains or dividends rows.
  const none = { ...base, unwrappedValue: "0", ...answered([]) };
  assert.deepEqual(idsOf(none), ["isa", "pension", "emergency", "studentLoan", "cashInterest"]);
  assert.deepEqual(openIds(none), []);
  // Locked rows count for nothing in the headline.
  assert.deepEqual(annualGoals(rowsOf(none)), { pct: 0, hits: 0, total: 0, locked: 5 });
  // Opened and skipped isn't answered.
  assert.deepEqual(openIds({ ...none, selectedModules: ["cash", "pension"], answeredModules: [] }), []);
  assert.deepEqual(openIds({ ...none, ...answered(["pension"]) }), ["pension"]);
  // Cash & savings asks this year's ISA payments too, so it unlocks the ISA row.
  assert.deepEqual(openIds({ ...none, ...answered(["cash"]) }), ["isa", "emergency", "cashInterest"]);
  assert.deepEqual(openIds({ ...none, ...answered(["investments"]) }), ["isa"]);
  assert.deepEqual(openIds({ ...loan, unwrappedValue: "0", ...answered(["studentLoan"]) }), ["studentLoan"]);
  // A locked row names the modules that unlock it, and the one to open.
  const isa = rowsOf(none).find(r => r.id === "isa");
  assert.equal(isa.unlock, "Cash & savings or Investments");
  assert.equal(isa.module, "investments");
  assert.equal(isa.moduleTitle, "Investments");
  assert.equal(isa.tracked, false);
});

test("once its module is answered, a row that doesn't fit the answers goes", () => {
  // Student loan answered with no loan: nothing to overpay.
  assert.equal(rowOf({ ...base, ...answered(["studentLoan"]) }, "studentLoan"), undefined);
  // Cash & savings answered with no cash: no interest to optimise.
  assert.equal(rowOf({ ...base, cashTiers: [], cashSavings: "0" }, "cashInterest"), undefined);
});

test("the mortgage row waits for the Mortgage module to be back, whatever's been answered", () => {
  const d = { ...base, hasMortgage: "yes", mortgageBalance: "150000", mortgageOverpayTarget: "6000", mortgageOverpaidThisYear: "1500",
    ...answered(["cash", "investments", "pension", "mortgage"]) };
  assert.equal(rowOf(d, "mortgage"), undefined);
});

test("the ISA row is this year's payments against the £20,000 allowance, with no target of its own", () => {
  const isa = rowOf(base, "isa");
  assert.equal(isa.target, ISA_ALLOWANCE);
  assert.equal(isa.current, 10000);
  assert.equal(isa.pct, 50);
  assert.equal(isa.editable, false);
  assert.equal(isa.own, false);
  // The tab shows £k; the note has the figures in full.
  assert.equal(isa.label, "ISA");
  assert.match(isa.note, /^£10,000 of the £20,000 allowance/);
});

test("buying together, the ISA row is the household's two allowances with the partner's payments", () => {
  const isa = rowOf({ ...base, propertyBuyingMode: "together", partnerIsaThisYear: "5000" }, "isa");
  assert.equal(isa.target, ISA_ALLOWANCE * 2);
  assert.equal(isa.current, 15000);
  assert.match(isa.label, /together/);
});

test("the pension row is this year's contributions against the Annual Allowance, or the user's target", () => {
  const p = rowOf(base, "pension");
  assert.equal(p.current, 5500);
  assert.equal(p.target, 60000);
  assert.equal(p.hit, false);
  const own = rowOf({ ...base, pensionTarget: "5000" }, "pension");
  assert.equal(own.target, 5000);
  assert.equal(own.hit, true);
  assert.equal(own.pct, 100);
  // A target can't be more than the allowance.
  assert.equal(rowOf({ ...base, pensionTarget: "90000" }, "pension").target, 60000);
});

test("a bar is only full once its target is reached", () => {
  const nearly = rowOf({ ...base, isaThisYearSS: "17950", isaThisYearCash: "2000" }, "isa");
  assert.equal(nearly.current, 19950);
  assert.equal(nearly.hit, false);
  assert.equal(nearly.pct, 99);
});

test("the emergency fund is cash and Premium Bonds against the chosen months of spending", () => {
  const em = rowOf(base, "emergency");
  assert.equal(em.target, 12000);
  assert.equal(em.current, 12000);
  assert.equal(em.hit, true);
  assert.equal(rowOf({ ...base, emergencyMonths: "3" }, "emergency").target, 6000);
  // No spending entered: not tracked yet, rather than measured against £0.
  const unsized = rowOf({ ...base, monthlyExpenses: "" }, "emergency");
  assert.equal(unsized.tracked, false);
  assert.equal(unsized.target, 0);
});

test("student loan overpayments are tracked once a target is set, and shown without one", () => {
  const untracked = rowOf(loan, "studentLoan");
  assert.equal(untracked.tracked, false);
  assert.equal(untracked.note, "No target set for this tax year.");
  const paidOnly = rowOf({ ...loan, studentLoanOverpaidThisYear: "750" }, "studentLoan");
  assert.equal(paidOnly.tracked, false);
  assert.match(paidOnly.note, /£750 overpaid this tax year/);
  const tracked = rowOf({ ...loan, studentLoanOverpayTarget: "2000", studentLoanOverpaidThisYear: "500" }, "studentLoan");
  assert.equal(tracked.tracked, true);
  assert.equal(tracked.pct, 25);
  assert.equal(tracked.paidField, "studentLoanOverpaidThisYear");
});

test("an overpayment typed in by hand in Student loan adds to this tax year's overpaid figure", () => {
  assert.equal(loanOverpaidAfter({ studentLoanOverpaidThisYear: "" }, 1200), "1200");
  assert.equal(loanOverpaidAfter({ studentLoanOverpaidThisYear: "500" }, 250), "750");
  assert.equal(loanOverpaidAfter({}, 0), "0");
});

test("cash interest optimised is what changes have banked against that plus what the Cash module still shows", () => {
  const banked = { ...base, moduleBaselines: { cash: { amount: 180, answers: "", banked: 120 } } };
  const cash = rowOf(banked, "cashInterest", { cash: { amount: 180 } });
  assert.equal(cash.current, 120);
  assert.equal(cash.target, 300);
  assert.equal(cash.pct, 40);
  assert.equal(cash.editable, false);
  // Nothing banked and nothing on the table: on the best rates already.
  const best = rowOf(base, "cashInterest", { cash: { amount: 0 } });
  assert.equal(best.hit, true);
  assert.equal(best.pct, 100);
});

test("annual goals average the tracked rows, and read 100% only when every one is reached", () => {
  const rows = [
    { tracked: true, hit: true, pct: 100 }, { tracked: true, hit: true, pct: 100 },
    { tracked: true, hit: false, pct: 99 }, { tracked: false, hit: false, pct: 0 },
  ];
  assert.deepEqual(annualGoals(rows), { pct: 99, hits: 2, total: 3, locked: 0 });
  assert.deepEqual(annualGoals(rows.slice(0, 2)), { pct: 100, hits: 2, total: 2, locked: 0 });
  assert.deepEqual(annualGoals([]), { pct: 0, hits: 0, total: 0, locked: 0 });
});

test("net worth is gross assets less total debt, the same figure as Home's", () => {
  const d = { ...base, studentLoan: "plan2", loanBalance: "25000" };
  const m = calcMetrics(d);
  const nw = netWorthPicture(d, m);
  const byId = Object.fromEntries(nw.parts.map(p => [p.id, p.value]));
  assert.equal(byId.cash, 12000);
  assert.equal(byId.investments, 10000 + 15000 + 3000);
  assert.equal(byId.pension, 40000);
  assert.equal(byId.home, 0);
  assert.equal(nw.netWorth, Math.round(m.netWorth));
  assert.equal(nw.grossAssets - nw.totalDebt, nw.netWorth);
  assert.equal(nw.parts.reduce((s, p) => s + p.value, 0), nw.grossAssets);
  assert.deepEqual(nw.debts.map(x => x.id), ["studentLoan"]);
});

test("with a mortgage, the home counts at its full value and the mortgage is a debt, so it isn't taken off twice", () => {
  const d = { ...base, hasMortgage: "yes", mortgageBalance: "180000", propertyEquity: "70000" };
  const m = calcMetrics(d);
  const nw = netWorthPicture(d, m);
  assert.equal(nw.parts.find(p => p.id === "home").value, 250000);
  assert.equal(nw.totalDebt, 180000);
  assert.equal(nw.netWorth, Math.round(m.netWorth));
  assert.equal(nw.grossAssets - nw.totalDebt, nw.netWorth);
});

test("the bands put the 60% trap between £100,000 and £125,140; in Scotland the trap is 67.5%", () => {
  const uk = incomeBands(false);
  assert.deepEqual(uk.map(b => [b.from, b.rateLabel]), [[0, "0%"], [12570, "20%"], [50270, "40%"], [100000, "60%"], [125140, "45%"]]);
  const scot = incomeBands(true);
  assert.deepEqual(scot.map(b => [b.from, b.rateLabel]), [[0, "0%"], [12570, "19–21%"], [43662, "42%"], [75000, "45%"], [100000, "67.5%"], [125140, "48%"]]);
});

test("income position names the band and the distance to the next line", () => {
  const higher = incomePosition(base, calcMetrics(base));
  assert.equal(higher.band.name, "Higher rate");
  assert.equal(higher.trap, null);
  const low = { ...base, salary: "40000", myContribution: "0", employerMatch: "0" };
  const lowPos = incomePosition(low, calcMetrics(low));
  assert.equal(lowPos.band.name, "Basic rate");
  assert.match(lowPos.context, /£10,270 below the higher rate/);
});

test("over £100,000 the trap's figures come from the tax trap module", () => {
  const d = { ...base, salary: "110000", myContribution: "0", employerMatch: "0" };
  const pos = incomePosition(d, calcMetrics(d));
  assert.equal(pos.band.name, "£100k tax trap");
  assert.equal(pos.trap.over, 10000);
  assert.equal(pos.trap.allowanceLost, 5000);
  assert.equal(pos.trap.tax, 2000);
  assert.equal(pos.trap.needed, 10000);
  assert.equal(pos.trap.route, "sacrifice");
  assert.ok(pos.trap.takeHome > 0 && pos.trap.takeHome < 10000);
  assert.equal(pos.trap.rateLabel, "60%");
});

test("the trap zone: clear, near, within £5,000, in; and what a £10,000 rise would add", () => {
  const at = salary => { const d = { ...base, salary: String(salary), myContribution: "0", employerMatch: "0" }; return incomePosition(d, calcMetrics(d)); };
  const clear = at(60000);
  assert.equal(clear.zone, "clear");
  assert.equal(clear.gap, 40000);
  assert.equal(clear.rise.tax, 0);
  assert.deepEqual(clear.perThousand, { now: 400, trap: 600 });
  assert.equal(at(92000).zone, "near");
  const edge = at(96500);
  assert.equal(edge.zone, "edge");
  assert.equal(edge.gap, 3500);
  // £6,500 past £100,000 withdraws £3,250 of allowance, taxed at 40%.
  assert.equal(edge.rise.tax, 1300);
  assert.equal(at(100000).zone, "edge");
  const over = at(110000);
  assert.equal(over.zone, "in");
  assert.equal(over.gap, null);
  assert.equal(over.rise, null);
  const none = incomePosition({ ...base, salary: "0" }, calcMetrics({ ...base, salary: "0" }));
  assert.equal(none.zone, "none");
});

test("in Scotland each £1,000 past £100,000 costs £675 rather than £450", () => {
  const d = { ...base, salary: "95000", myContribution: "0", employerMatch: "0", scottishTaxpayer: "yes" };
  assert.deepEqual(incomePosition(d, calcMetrics(d)).perThousand, { now: 450, trap: 675 });
});

const property = { propertyPrice: "300000", propertyRegion: "london", propertyFirstTimeBuyer: "yes", propertyCashAvailable: "12000" };

test("buying a home shows as a vault once Property's first step is done, from its cash available", () => {
  // A home goal on its own isn't enough: there's nothing entered behind it yet.
  const goalOnly = { ...base, financialGoals: ["buy_house"], houseTargetAmount: "40000" };
  assert.deepEqual(goalVaults(goalOnly, calcMetrics(goalOnly)), []);

  const d = { ...goalOnly, ...property, houseTimeframe: "1to3" };
  const m = calcMetrics(d);
  const [home] = goalVaults(d, m);
  assert.equal(home.id, "home");
  assert.equal(home.target, 40000);
  assert.equal(home.saved, 12000);
  assert.equal(home.pct, 30);
  assert.equal(home.when, "In 1 to 3 years");
  assert.equal(home.fromGoal, true);

  // The user's own pots come first; their edit of this one replaces it.
  const edited = { ...d, goalVaults: [{ id: "trip", name: "Holiday", target: "3000", saved: "1000", date: "" }, { id: "home", name: "Buying a home", target: "45000", saved: "15000", date: "" }] };
  const vaults = goalVaults(edited, m);
  assert.deepEqual(vaults.map(v => v.id), ["trip", "home"]);
  assert.equal(vaults[1].target, 45000);

  // Removing it leaves a marker, so it doesn't come back.
  const removed = { ...d, goalVaults: withoutVault(d.goalVaults, "home", true) };
  assert.deepEqual(goalVaults(removed, m), []);
});

test("a big purchase shows as a vault once a target's been given for it", () => {
  const picked = { ...base, financialGoals: ["big_purchase"] };
  assert.deepEqual(goalVaults(picked, calcMetrics(picked)), []);
  const withTarget = { ...picked, bigPurchaseTargetAmount: "8000" };
  const [purchase] = goalVaults(withTarget, calcMetrics(withTarget));
  assert.equal(purchase.id, "purchase");
  assert.equal(purchase.target, 8000);
  assert.equal(purchase.saved, 0);
});

test("a dated vault works out the monthly amount that reaches it in time", () => {
  // Tests run on 8 October 2026: October to March is 5 months.
  const d = { ...base, goalVaults: [{ id: "car", name: "Car", target: "6000", saved: "1000", date: "2027-03" }] };
  const [car] = goalVaults(d, calcMetrics(d));
  assert.equal(car.when, "By Mar 2027");
  assert.equal(car.perMonth, 1000);
  const past = { ...base, goalVaults: [{ id: "x", name: "Old", target: "6000", saved: "1000", date: "2025-01" }] };
  assert.equal(goalVaults(past, calcMetrics(past))[0].perMonth, 0);
  const bad = { ...base, goalVaults: [{ id: "y", name: "Odd", target: "6000", saved: "0", date: "2027-13" }] };
  assert.equal(goalVaults(bad, calcMetrics(bad))[0].when, "");
});

test("a new vault goes first; saving or removing one keeps the others in order", () => {
  const list = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
  assert.deepEqual(withVault(list, { id: "a", name: "A2" }).map(v => v.name), ["A2", "B"]);
  assert.deepEqual(withVault(list, { id: "c", name: "C" }).map(v => v.id), ["c", "a", "b"]);
  assert.deepEqual(withoutVault(list, "a", false).map(v => v.id), ["b"]);
  assert.deepEqual(withVault(undefined, { id: "a" }), [{ id: "a" }]);
  assert.equal(poundsInput(1234.6), "1235");
  assert.equal(poundsInput(null), "");
  assert.equal(poundsInput(0), "");
});

test("the snapshot puts it all together for the tab", () => {
  const snap = buildProgressSnapshot(base, calcMetrics(base), { cash: { amount: 150 } });
  // Student loan isn't answered, so its row is there but locked.
  assert.deepEqual(snap.rows.map(r => r.id), ["isa", "cgt", "dividends", "pension", "emergency", "studentLoan", "cashInterest"]);
  assert.equal(snap.annual.total, 4);
  assert.equal(snap.annual.hits, 1);
  assert.equal(snap.annual.locked, 1);
});

test("the pension row counts the £100k trap's top-ups this tax year", () => {
  const p = rowOf({ ...base, trapTopUps: [{ id: "sacrifice11", amount: 3000, route: "sacrifice", month: 11, taxYear: 2026 }] }, "pension");
  // The regular 5% + 5% on the salary before the top-up, then the top-up.
  assert.equal(p.current, 8500);
  assert.match(p.note, /^£8,500 this tax year, yours and your employer's, including £3,000 of top-ups/);
});

test("newlyReachedGoals and markGoalsSeen: each reached goal once, stale keys dropped", () => {
  const rows = [
    { id: "isa", tracked: true, hit: true, current: 20000 },
    { id: "pension", tracked: true, hit: false, current: 3000 },
    { id: "cashInterest", tracked: true, hit: true, current: 0 },
    { id: "emergency", tracked: false, hit: false, current: 0 },
  ];
  const vaults = [{ id: "v1", hit: true, saved: 3000 }, { id: "v2", hit: false, saved: 100 }];
  const fresh = newlyReachedGoals(rows, vaults, undefined, 2026);
  assert.deepEqual(fresh, ["2026:row:isa", "vault:v1"]);
  // Shown one at a time, as each scrolls into view.
  const seen = markGoalsSeen(markGoalsSeen(undefined, ["vault:v1"], vaults, 2026), ["2026:row:isa"], vaults, 2026);
  assert.deepEqual(seen, ["vault:v1", "2026:row:isa"]);
  assert.equal(markGoalsSeen(seen, ["vault:v1"], vaults, 2026), null);
  assert.deepEqual(newlyReachedGoals(rows, vaults, seen, 2026), []);
  // The ISA drops below its target and is reached again: not shown twice.
  const dipped = rows.map(r => r.id === "isa" ? { ...r, hit: false } : r.id === "pension" ? { ...r, hit: true } : r);
  assert.deepEqual(newlyReachedGoals(dipped, vaults, seen, 2026), ["2026:row:pension"]);
  assert.deepEqual(newlyReachedGoals(rows, vaults, [...seen, "2026:row:pension"], 2026), []);
  // A new tax year starts the goals again; a removed pot's key goes.
  const pots = [{ id: "v2", hit: true, saved: 100 }];
  assert.deepEqual(newlyReachedGoals(rows, pots, seen, 2027), ["2027:row:isa", "vault:v2"]);
  assert.deepEqual(markGoalsSeen([...seen, "2025:row:pension"], ["2027:row:isa"], pots, 2027), ["2027:row:isa"]);
});

test("goalsToCelebrate: only goals reached by a change in the app are celebrated", () => {
  const d = { ...base, isaThisYearSS: "18000", isaThisYearCash: "2000",
    goalVaults: [{ id: "v1", name: "Holiday", target: "3000", saved: "3000" }, { id: "v2", name: "Car", target: "9000", saved: "100" }] };
  const m = calcMetrics(d);
  // First run (nothing saved yet, as for anyone from before this shipped):
  // every goal already reached is marked seen quietly.
  const first = goalsToCelebrate(d, m, {}, 2026);
  assert.deepEqual(first.celebrate, []);
  assert.deepEqual(first.quiet.find(g => g.key === "2026:row:isa"), { key: "2026:row:isa", label: "ISA", current: ISA_ALLOWANCE, target: ISA_ALLOWANCE, perYear: false, pot: false });
  assert.equal(first.quiet.some(g => g.key === "vault:v2"), false);
  assert.ok(first.live.includes("vault:v2") && first.live.includes("2026:row:isa"));
  const seen = first.quiet.map(g => g.key);
  // The car pot reaches its target: celebrated, on opening the app too.
  const car = { ...d, goalsReachedSeen: seen, goalVaults: [d.goalVaults[0], { ...d.goalVaults[1], saved: "9000" }] };
  assert.deepEqual(goalsToCelebrate(car, m, {}, 2026, first.live).celebrate.map(g => g.key), ["vault:v2"]);
  assert.deepEqual(goalsToCelebrate(car, m, {}, 2026, null).celebrate.map(g => g.key), ["vault:v2"]);
  // A pot added already at its target is quiet.
  const added = { ...d, goalsReachedSeen: seen, goalVaults: [{ id: "v3", name: "Sofa", target: "800", saved: "800" }, ...d.goalVaults] };
  const run = goalsToCelebrate(added, m, {}, 2026, first.live);
  assert.deepEqual([run.celebrate, run.quiet.map(g => g.key)], [[], ["vault:v3"]]);
  assert.deepEqual(goalsToCelebrate({ ...d, goalsReachedSeen: seen }, m, {}, 2026, first.live).quiet, []);
});

test("sortGoals: by £ target or completion, unmeasured then locked last", () => {
  const goals = [
    { id: "a", target: 3000, pct: 100, measured: true },
    { id: "b", target: 0, pct: 0, measured: false },
    { id: "c", target: 20000, pct: 40, measured: true },
    { id: "d", target: 60000, pct: 15, measured: false, locked: true },
    { id: "e", target: 9000, pct: 40, measured: true },
  ];
  const ids = by => sortGoals(goals, by).map(g => g.id).join("");
  assert.equal(ids("default"), "abcde");
  assert.equal(ids("value"), "ceabd");
  assert.equal(ids("complete"), "acebd");
});

test("allowance rows: ISA and the Annual Allowance tagged, a pension target not", () => {
  assert.equal(rowOf(base, "isa").allowance, true);
  assert.equal(rowOf(base, "pension").allowance, true);
  assert.equal(rowOf({ ...base, pensionTarget: "8000" }, "pension").allowance, false);
  assert.ok(!rowOf(base, "emergency").allowance);
});

test("capital gains and dividends show only with investments outside an ISA or dividends, never locked", () => {
  const plain = { ...base, unwrappedValue: "0" };
  assert.equal(rowOf(plain, "cgt"), undefined);
  assert.equal(rowOf(plain, "dividends"), undefined);
  assert.equal(rowOf({ ...base, hasUnwrapped: "no" }, "cgt"), undefined);
  assert.equal(rowOf({ ...base, hasInvestments: "no" }, "dividends"), undefined);
  // Dividends entered in About you are enough for dividends, not for gains.
  assert.ok(rowOf({ ...plain, dividendIncome: "800" }, "dividends"));
  assert.equal(rowOf({ ...plain, dividendIncome: "800" }, "cgt"), undefined);
  // Shown before any module is answered, and not greyed out.
  const cgt = rowOf({ ...base, ...answered([]) }, "cgt");
  assert.equal(cgt.locked, false);
  assert.equal(cgt.tracked, false);
  assert.equal(cgt.addable, true);
  assert.equal(cgt.allowance, true);
});

test("capital gains: tracked once added, or once Investments asked about sales; a limit, not in the average", () => {
  assert.equal(rowOf(base, "cgt").tracked, false);
  // The walk-through asked about sales (investments outside an ISA: yes).
  const asked = rowOf({ ...base, hasUnwrapped: "yes" }, "cgt");
  assert.equal(asked.tracked, true);
  assert.equal(asked.current, 0);
  assert.equal(asked.target, CGT_ANNUAL_ALLOWANCE);
  const added = { ...base, allowanceGoals: withAllowanceGoal(base, "cgt"), hasSoldAssetsOutsideWrapper: "yes", realisedCgtGains: "1200" };
  const row = rowOf(added, "cgt");
  assert.deepEqual([row.tracked, row.current, row.pct], [true, 1200, 40]);
  // Profit only counts when they sold (the module's own rule, metrics.js).
  assert.equal(rowOf({ ...added, hasSoldAssetsOutsideWrapper: "no" }, "cgt").current, 0);
  assert.equal(row.warnAt, true);
  assert.deepEqual(annualGoals(rowsOf(added)), annualGoals(rowsOf(base)));
});

test("dividends: tracked once added, against the £500 allowance", () => {
  assert.equal(rowOf(base, "dividends").tracked, false);
  const d = { ...base, allowanceGoals: ["dividends"], dividendsThisYear: "500" };
  const row = rowOf(d, "dividends");
  assert.deepEqual([row.tracked, row.current, row.target, row.hit], [true, 500, DIVIDEND_ALLOWANCE, true]);
  // Added once only.
  assert.deepEqual(withAllowanceGoal(d, "dividends"), ["dividends"]);
});

test("goalsToCelebrate: a limit reached comes as a warning, with its title and line", () => {
  const seen = [];
  const before = { ...base, allowanceGoals: ["dividends"], dividendsThisYear: "200", goalsReachedSeen: seen };
  const { live } = goalsToCelebrate(before, calcMetrics(before), {}, 2026);
  const after = { ...before, dividendsThisYear: "600" };
  const { celebrate } = goalsToCelebrate(after, calcMetrics(after), {}, 2026, live);
  const g = celebrate.find(x => x.key === "2026:row:dividends");
  assert.equal(g.warn, true);
  assert.equal(g.usedTitle, "Dividend allowance used");
  assert.match(g.usedLine, /above £500/);
});

test("goalsToCelebrate: a limit already past when added still warns; a goal at target when added doesn't pop", () => {
  const before = { ...base, goalsReachedSeen: [] };
  const { live } = goalsToCelebrate(before, calcMetrics(before), {}, 2026);
  const after = { ...before, allowanceGoals: ["dividends"], dividendsThisYear: "800" };
  const { celebrate, quiet } = goalsToCelebrate(after, calcMetrics(after), {}, 2026, live);
  assert.ok(celebrate.some(g => g.key === "2026:row:dividends" && g.warn));
  assert.ok(!quiet.some(g => g.key === "2026:row:dividends"));
  // The very first run is still quiet, warnings included.
  const first = goalsToCelebrate({ ...after, goalsReachedSeen: undefined }, calcMetrics(after), {}, 2026);
  assert.ok(first.quiet.some(g => g.key === "2026:row:dividends"));
});
