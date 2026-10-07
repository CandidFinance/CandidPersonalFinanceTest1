import { test } from "node:test";
import assert from "node:assert/strict";
import { cashSources, cashPlan, assistItems, assistHasNews, applyCashMove, nextIsaReset, accountName, accountItems, resolveAccount, trackAccount, addMonths, itemsForPage, savingsTax } from "./assist.js";
import { isaUsedThisYear } from "./isa.js";

test("picking a capped account offers a second for the rest, compared with one account for all of it", () => {
  const d5 = { cashTiers: [{ name: "Old Bank", amount: "5000", rate: "1" }] };
  const m5 = { cash: 5000, isaHeadroom: 0, savingsRate: 1 };
  const capped = [
    { provider_name: "Cahoot", product_name: "Sunny Day Saver", account_type: "Easy access", rate_aer: "5.00", max_balance: 3000, is_isa: false },
    { provider_name: "Cahoot", product_name: "Simple Saver", account_type: "Easy access", rate_aer: "4.52", is_isa: false },
    { provider_name: "Chase", product_name: null, account_type: "Easy access", rate_aer: "4.50", is_isa: false },
  ];
  const first = cashPlan(d5, m5, capped);
  const sunny = first.savings.options.find(o => o.product === "Sunny Day Saver");
  const picked = cashPlan(d5, m5, capped, { savingsChoice: sunny.id });
  assert.equal(picked.savings.leftover, 2000);
  assert.deepEqual(picked.savings.secondOptions.map(o => [o.provider, o.product, o.amount]), [["Cahoot", "Simple Saver", 2000], ["Chase", null, 2000]]);
  const both = cashPlan(d5, m5, capped, { savingsChoice: sunny.id, savingsChoice2: picked.savings.secondOptions[0].id });
  assert.equal(Math.round(both.savings.split.together), Math.round(3000 * 0.04 + 2000 * 0.0352));
  assert.equal(both.savings.split.single.product, "Simple Saver");
  assert.equal(Math.round(both.savings.split.extra), Math.round(3000 * 0.0048)); // £14 a year: not much for a second account
  assert.equal(both.picks.length, 2);
  // An uncapped pick takes everything, so there's no second choice.
  const simple = first.savings.options.find(o => o.product === "Simple Saver");
  assert.equal(cashPlan(d5, m5, capped, { savingsChoice: simple.id }).savings.secondOptions.length, 0);
});

const bonusRow = { id: "r-chip", provider_name: "Chip", product_name: "Smart Cash ISA", account_type: "Easy access ISA", rate_aer: "4.72", bonus_rate: "1.22", bonus_months: 12, is_isa: true };

test("an account opened through Assist remembers when its bonus ends and what it drops to", () => {
  const plan = cashPlan({ cashTiers: [{ amount: "10000", rate: "1" }] }, { cash: 10000, isaHeadroom: 20000, savingsRate: 1 }, [bonusRow]);
  const a = trackAccount(plan.isa.options[0], new Date("2026-10-07T12:00:00Z"));
  assert.deepEqual([a.rateId, a.name, a.isa, a.amount, a.ratePct, a.openedAt, a.bonusEndsAt, a.rateAfterBonus],
    ["r-chip", "Chip Smart Cash ISA", true, 10000, 4.72, "2026-10-07", "2027-10-07", 3.5]);
  assert.equal(addMonths("2026-01-31", 1), "2026-03-03");
});

test("a bonus ending is raised 4 weeks before, with alternatives on the lower rate", () => {
  const a = { id: "a1", rateId: "r-chip", provider: "Chip", product: "Smart Cash ISA", name: "Chip Smart Cash ISA", isa: true, amount: 10000, ratePct: 4.72, openedAt: "2026-10-07", bonusEndsAt: "2027-10-07", rateAfterBonus: 3.5 };
  const others = [bonusRow, { id: "r-plum", provider_name: "Plum", product_name: "Cash ISA", account_type: "Easy access ISA", rate_aer: "4.68", is_isa: true }];
  assert.deepEqual(accountItems({ assistAccounts: [a] }, others, new Date("2027-09-08T12:00:00Z")), []);
  const [item] = accountItems({ assistAccounts: [a] }, others, new Date("2027-09-10T12:00:00Z"));
  assert.equal(item.kind, "bonus");
  assert.equal(item.daysLeft, 27);
  assert.equal(Math.round(item.loss), 122);
  assert.deepEqual(item.options.map(o => [o.provider, o.amount]), [["Plum", 10000]]); // not Chip itself
  assert.equal(Math.round(item.options[0].gain), Math.round(10000 * 0.0118));
});

test("a rate period ending is raised even when the page doesn't say what it drops to", () => {
  const row = { id: "r-cahoot", provider_name: "Cahoot", product_name: "Simple Saver", account_type: "Easy access", rate_aer: "4.52", bonus_months: 12, rate_after: null, is_isa: false };
  const plan = cashPlan({ cashTiers: [{ amount: "6000", rate: "1" }] }, { cash: 6000, isaHeadroom: 0, savingsRate: 1 }, [row]);
  const a = trackAccount(plan.savings.options[0], new Date("2026-10-07T12:00:00Z"));
  assert.deepEqual([a.bonusEndsAt, a.rateAfterBonus], ["2027-10-07", null]);
  const chase = { id: "r-chase", provider_name: "Chase", product_name: null, account_type: "Easy access", rate_aer: "4.50", is_isa: false };
  const [item] = accountItems({ assistAccounts: [a] }, [row, chase], new Date("2027-09-20T12:00:00Z"));
  assert.deepEqual([item.kind, item.toRate, item.loss], ["bonus", null, null]);
  assert.equal(Math.round(item.options[0].gain), 270); // a full year's interest at 4.50%
  // Kept: the rate stays until the user updates it, and it's not raised again.
  const kept = resolveAccount({ assistAccounts: [a], cashTiers: [{ name: "Cahoot Simple Saver", amount: "6000", rate: "4.52" }] }, item);
  assert.equal(kept.cashTiers[0].rate, "4.52");
  assert.deepEqual(accountItems({ assistAccounts: kept.assistAccounts }, [row, chase], new Date("2027-09-20T12:00:00Z")), []);
});

test("a rate cut on an Assist account is raised, and settles when kept or moved", () => {
  const a = { id: "a2", rateId: "r-cahoot", provider: "Cahoot", product: "Simple Saver", name: "Cahoot Simple Saver", isa: false, amount: 6000, ratePct: 4.52, openedAt: "2026-10-07", bonusEndsAt: null, rateAfterBonus: null };
  const live = [
    { id: "r-cahoot", provider_name: "Cahoot", product_name: "Simple Saver", account_type: "Easy access", rate_aer: "4.20", is_isa: false },
    { id: "r-chase", provider_name: "Chase", product_name: null, account_type: "Easy access", rate_aer: "4.50", is_isa: false },
  ];
  const dd = { assistAccounts: [a], cashTiers: [{ name: "Cahoot Simple Saver", amount: "6000", rate: "4.52" }] };
  const [item] = accountItems(dd, live);
  assert.equal(item.kind, "cut");
  assert.equal(item.toRate, 4.2);
  // Kept: the account and the user's cash both move to the new rate, and it's no longer raised.
  const kept = resolveAccount(dd, item);
  assert.equal(kept.cashTiers[0].rate, "4.2");
  assert.deepEqual(accountItems({ ...dd, ...kept }, live), []);
  // Moved: the cash account becomes the new one, which is now the one tracked.
  const moved = resolveAccount(dd, item, item.options[0], new Date("2026-11-01T12:00:00Z"));
  assert.deepEqual(moved.cashTiers, [{ name: "Chase", amount: "6000", rate: "4.5" }]);
  assert.deepEqual(moved.assistAccounts.map(x => [x.name, x.rateId, x.openedAt]), [["Chase", "r-chase", "2026-11-01"]]);
});

// ── Tax and Premium Bonds ────────────────────────────────────────────────────
const pbRow = { id: "r-pb", provider_name: "NS&I", product_name: "Premium Bonds", account_type: "Premium Bonds", rate_aer: "4.35", is_isa: false };
const taxRows = [
  { provider_name: "Chip", product_name: "Smart Cash ISA", account_type: "Easy access ISA", rate_aer: "4.72", is_isa: true },
  { provider_name: "Cahoot", product_name: "Simple Saver", account_type: "Easy access", rate_aer: "4.52", is_isa: false },
  pbRow,
];
const higher = { cash: 50000, bonds: 0, isaHeadroom: 20000, savingsRate: 1, tr: 0.4, taxBandLabel: "higher" };
const fiftyK = { cashTiers: [{ name: "Old Bank", amount: "50000", rate: "1" }] };

test("savings interest is taxed only above the Personal Savings Allowance", () => {
  const tax = savingsTax({ tr: 0.2, taxBandLabel: "basic" });
  assert.equal(tax.allowance, 1000);
  assert.equal(tax.kept(800), 800);
  assert.equal(tax.kept(1500), 1400);
  assert.equal(savingsTax({ tr: 0.45, taxBandLabel: "additional" }).kept(100), 55);
});

test("a higher-rate payer: ISA, then savings up to the allowance, then Premium Bonds for the rest, all after tax", () => {
  const plan = cashPlan(fiftyK, higher, taxRows);
  // Cash ISA: £20,000 at 4.72% tax-free, less the taxed 1% it was earning.
  assert.equal(plan.isa.options[0].amount, 20000);
  assert.equal(Math.round(plan.isa.options[0].gain), 744);
  // Savings: 4.52% keeps 2.71% after 40% tax, under Premium Bonds' 4.35%, so
  // it takes only what keeps the interest inside the £500 allowance.
  const cahoot = plan.savings.options[0];
  assert.equal(cahoot.amount, 5681);
  assert.equal(Math.round(cahoot.gain), 200);
  // Premium Bonds take the rest, tax-free.
  const pb = plan.pb.options[0];
  assert.deepEqual([pb.provider, pb.product, pb.pb, pb.amount], ["NS&I", "Premium Bonds", true, 24319]);
  assert.equal(Math.round(pb.gain), 815);
  assert.equal(Math.round(plan.upTo), 1759);
});

test("without Premium Bonds the savings account takes everything, and its gain is after tax", () => {
  const plan = cashPlan(fiftyK, higher, taxRows, { skipPb: true });
  assert.equal(plan.pb.options.length, 0);
  assert.equal(plan.savings.options[0].amount, 30000);
  assert.equal(Math.round(plan.savings.options[0].gain), 714); // £1,356 interest, £344 of it taxed at 40%, less the £300 it earned
  // Nor are Premium Bonds offered when the feed doesn't have their rate.
  assert.equal(cashPlan(fiftyK, higher, taxRows.slice(0, 2)).pb.inPlay, false);
});

test("within the allowance a savings account beats Premium Bonds, so they aren't offered", () => {
  const basic = { cash: 8000, bonds: 0, isaHeadroom: 0, savingsRate: 1, tr: 0.2, taxBandLabel: "basic" };
  const plan = cashPlan({ cashTiers: [{ amount: "8000", rate: "1" }] }, basic, taxRows);
  assert.equal(plan.savings.options[0].amount, 8000);
  assert.equal(plan.pb.options.length, 0);
});

test("Premium Bonds stop at £50,000 including what's already held", () => {
  const plan = cashPlan(fiftyK, { ...higher, bonds: 45000 }, taxRows);
  assert.equal(plan.pb.options[0].amount, 5000);
});

test("buying Premium Bonds adds to the holding, not to cash accounts, and isn't tracked as an account", () => {
  const plan = cashPlan(fiftyK, higher, taxRows, { pbChoice: cashPlan(fiftyK, higher, taxRows).pb.options[0].id });
  const patch = applyCashMove({ ...fiftyK, premiumBonds: "1000" }, higher, plan, [plan.pb.pick]);
  assert.equal(patch.premiumBonds, "25319");
  assert.equal(patch.hasPremiumBonds, "yes");
  assert.deepEqual(patch.cashTiers, [{ name: "Old Bank", amount: "25681", rate: "1" }]);
  assert.deepEqual(patch.assistAccounts, []);
});

// Harvey's test case: £4,500 at 4%, £4,000 at 1%, £50,000 in Premium Bonds,
// a higher-rate payer (£500 allowance).
const harvey = { cashTiers: [{ amount: "4500", rate: "4" }, { amount: "4000", rate: "1" }] };
const harveyM = { cash: 8500, bonds: 50000, isaHeadroom: 0, savingsRate: 2.59, tr: 0.4, taxBandLabel: "higher" };

test("bonds aren't cashed in to fill the allowance when it's only worth a few pounds", () => {
  const plan = cashPlan(harvey, harveyM, taxRows);
  const cahoot = plan.savings.options[0];
  // The £116 of allowance left would take about £2,560 of bonds, at 0.17% more: about £4 a year.
  assert.equal(cahoot.amount, 8500);
  assert.ok(cahoot.from.every(f => !f.taxFree));
  assert.equal(Math.round(cahoot.gain), 164);
  // At the £50,000 limit, no more bonds to buy either.
  assert.equal(plan.pb.options.length, 0);
});

test("bonds move into a Cash ISA when it adds £25 a year or more", () => {
  const plan = cashPlan(harvey, { ...harveyM, isaHeadroom: 20000 }, taxRows);
  const chip = plan.isa.options[0];
  // Cash first (lowest rate first), then £11,500 of bonds to fill the allowance.
  assert.deepEqual(chip.from.map(f => [f.name, f.amount]), [[null, 4000], [null, 4500], ["Premium Bonds", 11500]]);
  assert.equal(chip.amount, 20000);
  // Bonds: £11,500 at 4.72% instead of 4.35%, both tax-free: about £43 a year.
  const cashOnly = 4000 * 0.0372 + 4500 * 0.0072;
  assert.equal(Math.round(chip.gain), Math.round(cashOnly + 11500 * 0.0037));
  // Updating Candid takes them off the holding.
  const picked = cashPlan(harvey, { ...harveyM, isaHeadroom: 20000 }, taxRows, { isaChoice: chip.id });
  const patch = applyCashMove(harvey, harveyM, picked, [picked.isa.pick]);
  assert.equal(patch.premiumBonds, "38500");
  assert.equal(patch.isaThisYearCash, "20000");
});

test("a basic-rate payer's bonds fill the larger allowance in a savings account when it's worth £25", () => {
  const basic = { cash: 1000, bonds: 50000, isaHeadroom: 0, savingsRate: 1, tr: 0.2, taxBandLabel: "basic" };
  const plan = cashPlan({ cashTiers: [{ amount: "1000", rate: "1" }] }, basic, taxRows);
  const cahoot = plan.savings.options[0];
  const bonds = cahoot.from.find(f => f.taxFree);
  // £1,000 allowance: £1,000 cash plus about £21,100 of bonds keeps the interest at £1,000.
  assert.ok(bonds && bonds.amount > 21000 && bonds.amount < 21200);
  assert.ok(cahoot.amount * 0.0452 <= 1000.01);
});

test("on a module page Assist sees that module's items, with the rest as elsewhere", () => {
  const items = [{ id: "account:a", module: "cash" }, { id: "cash", module: "cash" }, { id: "pension", module: "pension" }];
  assert.deepEqual(itemsForPage(items, null).here.length, 3);
  assert.deepEqual(itemsForPage(items, "cash").here.map(i => i.id), ["account:a", "cash"]);
  assert.deepEqual(itemsForPage(items, "cash").elsewhere.map(i => i.id), ["pension"]);
  assert.deepEqual(itemsForPage(items, "investments").here, []);
  assert.equal(itemsForPage(items, "investments").elsewhere.length, 3);
});

test("account items come before the cash item", () => {
  const a = { id: "a3", rateId: "r-cahoot", provider: "Cahoot", product: "Simple Saver", name: "Cahoot Simple Saver", isa: false, amount: 6000, ratePct: 4.9 };
  const live = [{ id: "r-cahoot", provider_name: "Cahoot", product_name: "Simple Saver", account_type: "Easy access", rate_aer: "4.52", is_isa: false }, ...rows];
  const ids = assistItems({ ...d, assistAccounts: [a] }, m, live, new Date(2026, 9, 7)).map(i => i.id);
  assert.deepEqual(ids, ["account:a3", "cash"]);
});

const rows = [
  { provider_name: "Chip", product_name: "Smart Cash ISA", account_type: "Easy access ISA", rate_aer: "4.72", is_isa: true },
  { provider_name: "Plum", product_name: "Cash ISA", account_type: "Easy access ISA", rate_aer: "4.68", is_isa: true },
  { provider_name: "Leek", product_name: "5 Year Fixed ISA", account_type: "5-year fixed ISA", rate_aer: "4.85", is_isa: true },
  { provider_name: "Bonus Bank", product_name: "Saver", account_type: "Easy access", rate_aer: "7.00", max_balance: 4000, is_isa: false },
  { provider_name: "Cahoot", product_name: "Simple Saver", account_type: "Easy access", rate_aer: "4.52", is_isa: false },
  { provider_name: "Chase", product_name: null, account_type: "Easy access", rate_aer: "4.50", is_isa: false },
];
const d = { cashTiers: [{ name: "Barclays Saver", amount: "12000", rate: "1" }, { amount: "18000", rate: "2.1" }, { name: "Good Bank", amount: "5000", rate: "5" }] };
const m = { cash: 35000, bonds: 2000, isaHeadroom: 20000, savingsRate: 2.37 };

test("sources are the user's own accounts, named where they've named them", () => {
  assert.deepEqual(cashSources(d, m).map(s => [s.name, s.amount, s.ratePct]), [["Barclays Saver", 12000, 1], [null, 18000, 2.1], ["Good Bank", 5000, 5]]);
  assert.deepEqual(cashSources({}, { cash: 8000, savingsRate: 1.5 }).map(s => [s.index, s.amount, s.ratePct]), [[null, 8000, 1.5]]);
});

test("Cash ISAs and savings accounts are separate choices of providers, none picked in advance", () => {
  const plan = cashPlan(d, m, rows);
  assert.deepEqual(plan.isa.options.map(o => o.provider), ["Chip", "Plum"]); // the fixed ISA isn't easy access
  assert.equal(plan.isa.pick, null);
  // ISA money comes from the lowest-paying accounts first.
  assert.deepEqual(plan.isa.options[0].from.map(f => [f.name, f.amount]), [["Barclays Saver", 12000], [null, 8000]]);
  // Savings options work on what's left: £10,000 at 2.1%. Good Bank's 5% beats them all but Bonus Bank.
  assert.deepEqual(plan.savings.options.map(o => [o.provider, o.amount]), [["Bonus Bank", 4000], ["Cahoot", 10000], ["Chase", 10000]]);
  assert.equal(plan.savings.options[0].cap, 4000);
});

test("a capped account only takes up to its cap", () => {
  const plan = cashPlan({ cashTiers: [{ amount: "10000", rate: "1" }] }, { ...m, isaHeadroom: 0 }, rows);
  const bonus = plan.savings.options.find(o => o.provider === "Bonus Bank");
  assert.equal(bonus.amount, 4000);
  assert.equal(Math.round(bonus.gain), 240);
});

test("keeping the ISA allowance for investing leaves only savings accounts", () => {
  const plan = cashPlan(d, m, rows, { skipIsa: true });
  assert.equal(plan.isa.options.length, 0);
  assert.equal(plan.savings.options.find(o => o.provider === "Cahoot").amount, 30000);
});

test("picks change the figures, and the savings options follow the ISA pick", () => {
  const first = cashPlan(d, m, rows);
  const plum = first.isa.options.find(o => o.provider === "Plum").id;
  const plan = cashPlan(d, m, rows, { isaChoice: plum, savingsChoice: first.savings.options.find(o => o.provider === "Cahoot").id });
  assert.equal(plan.isa.pick.provider, "Plum");
  assert.equal(plan.savings.pick.provider, "Cahoot");
  assert.equal(Math.round(plan.chosenGain), Math.round(12000 * 0.0368 + 8000 * 0.0258 + 10000 * 0.0242));
});

test("Assist raises cash worth £50 a year or more, and not while snoozed on the same figures", () => {
  const today = new Date(2026, 9, 7);
  const [item] = assistItems(d, m, rows, today);
  assert.equal(item.id, "cash");
  assert.equal(item.isaNote, null);
  assert.deepEqual(assistItems({ ...d, assistSnoozed: { cash: item.signature } }, m, rows, today), []);
  const moved = rows.map(r => r.provider_name === "Chip" ? { ...r, rate_aer: "4.80" } : r);
  assert.equal(assistItems({ ...d, assistSnoozed: { cash: item.signature } }, m, moved, today).length, 1);
  assert.deepEqual(assistItems({ cashTiers: [{ amount: "1000", rate: "4.6" }] }, { ...m, cash: 1000, bonds: 0 }, rows, today), []);
});

test("the ISA reset is mentioned in the last 8 weeks before 5 April", () => {
  const [item] = assistItems(d, m, rows, new Date(2027, 2, 1));
  assert.match(item.isaNote, /resets on 5 April, in 35 days/);
  assert.equal(nextIsaReset(new Date(2027, 3, 5)).getFullYear(), 2028);
});

test("the dot shows only for figures the user hasn't opened Assist to see", () => {
  const items = assistItems(d, m, rows, new Date(2026, 9, 7));
  assert.equal(assistHasNews(items, []), true);
  assert.equal(assistHasNews(items, [items[0].signature]), false);
});

test("updating Candid takes each move out of the accounts it came from", () => {
  const first = cashPlan(d, m, rows);
  const plan = cashPlan(d, m, rows, { isaChoice: first.isa.options[0].id, savingsChoice: first.savings.options.find(o => o.provider === "Cahoot").id });
  const patch = applyCashMove({ ...d, isaThisYearCash: "0" }, m, plan, [plan.isa.pick, plan.savings.pick]);
  assert.deepEqual(patch.cashTiers, [{ name: "Good Bank", amount: "5000", rate: "5" }, { name: "Cahoot Simple Saver", amount: "10000", rate: "4.52" }]);
  assert.equal(patch.isaThisYearCash, "20000");
});

test("account names don't repeat the provider", () => {
  assert.equal(accountName({ provider: "Chip", product: "Smart Cash ISA" }), "Chip Smart Cash ISA");
  assert.equal(accountName({ provider: "Cahoot Sunny Day Saver", product: "cahoot Sunny Day Saver" }), "Cahoot Sunny Day Saver");
  assert.equal(accountName({ provider: "Chase", product: null }), "Chase");
});

test("ISA allowance used counts other ISAs once, whichever way they were entered", () => {
  assert.equal(isaUsedThisYear({ isaThisYearCash: "2000", hasOtherIsaThisYear: "yes", isaThisYearOtherTypes: "18000" }), 20000);
  assert.equal(isaUsedThisYear({ isaThisYearCash: "2000", hasOtherIsaThisYear: "no", isaThisYearOtherTypes: "18000" }), 2000);
  assert.equal(isaUsedThisYear({ isaThisYearSS: "15000", isaThisYearLISA: "4000", hasOtherIsaThisYear: "yes", isaThisYearOtherTypes: "18000" }), 19000);
});
