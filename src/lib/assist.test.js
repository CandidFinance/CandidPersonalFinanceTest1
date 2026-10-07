import { test } from "node:test";
import assert from "node:assert/strict";
import { cashSources, cashPlan, assistItems, assistHasNews, applyCashMove, nextIsaReset, accountName } from "./assist.js";
import { isaUsedThisYear } from "./isa.js";

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
  assert.deepEqual(assistItems({ cashTiers: [{ amount: "1000", rate: "4.6" }] }, { ...m, cash: 1000 }, rows, today), []);
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
