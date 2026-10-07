import { test } from "node:test";
import assert from "node:assert/strict";
import { cashMove, assistItems, assistHasNews, applyCashMove, nextIsaReset } from "./assist.js";

const rows = [
  { provider_name: "Chip", product_name: "Smart Cash ISA", account_type: "Easy access ISA", rate_aer: "4.72", is_isa: true },
  { provider_name: "Bonus Bank", product_name: "Saver", account_type: "Easy access", rate_aer: "7.00", max_balance: 4000, is_isa: false },
  { provider_name: "Cahoot", product_name: "Simple Saver", account_type: "Easy access", rate_aer: "4.52", is_isa: false },
];
const m = { cash: 30000, bonds: 2000, isaHeadroom: 20000, taxBandLabel: "basic", savingsRate: 1, tr: 0.2 };

test("the cash walkthrough spreads cash only across accounts that beat the current rate", () => {
  const move = cashMove(m, rows);
  assert.deepEqual(move.lines.map(l => [l.provider, l.amount, l.isa]), [["Chip", 20000, true], ["Bonus Bank", 4000, false], ["Cahoot", 6000, false]]);
  assert.equal(Math.round(move.gain), Math.round(20000 * 0.0372 + 4000 * 0.06 + 6000 * 0.0352));
  assert.equal(cashMove({ ...m, savingsRate: 5 }, rows).lines.map(l => l.provider).join(), "Bonus Bank");
  assert.equal(cashMove({ ...m, cash: 0 }, rows), null);
  assert.equal(cashMove(m, []), null);
});

test("Assist raises cash worth £50 a year or more, and not while snoozed on the same figures", () => {
  const today = new Date(2026, 9, 7);
  const [item] = assistItems({}, m, rows, today);
  assert.equal(item.id, "cash");
  assert.equal(item.isaNote, null); // October: 5 April is months away
  assert.deepEqual(assistItems({ assistSnoozed: { cash: item.signature } }, m, rows, today), []);
  // A rate change gives new figures, so it's raised again.
  const moved = rows.map(r => r.provider_name === "Chip" ? { ...r, rate_aer: "4.80" } : r);
  assert.equal(assistItems({ assistSnoozed: { cash: item.signature } }, m, moved, today).length, 1);
  assert.deepEqual(assistItems({}, { ...m, savingsRate: 4.6 }, rows.slice(0, 1), today), []);
});

test("the ISA reset is mentioned in the last 8 weeks before 5 April", () => {
  const [item] = assistItems({}, m, rows, new Date(2027, 2, 1));
  assert.match(item.isaNote, /resets on 5 April, in 35 days/);
  assert.equal(nextIsaReset(new Date(2027, 3, 5)).getFullYear(), 2028);
  assert.equal(nextIsaReset(new Date(2027, 3, 4)).getDate(), 5);
});

test("the dot shows only for figures the user hasn't opened Assist to see", () => {
  const items = assistItems({}, m, rows, new Date(2026, 9, 7));
  assert.equal(assistHasNews(items, []), true);
  assert.equal(assistHasNews(items, [items[0].signature]), false);
  assert.equal(assistHasNews([], []), false);
});

test("updating Candid moves ISA money out of cash and records the new accounts", () => {
  const move = cashMove(m, rows);
  const patch = applyCashMove({ isaThisYearCash: "500" }, m, move.lines.filter(l => l.provider !== "Cahoot"));
  assert.deepEqual(patch.cashTiers, [{ amount: "4000", rate: "7" }, { amount: "6000", rate: "1" }]);
  assert.equal(patch.isaThisYearCash, "20000"); // capped at the allowance
  assert.deepEqual(applyCashMove({}, m, move.lines.filter(l => !l.isa)).cashTiers, [{ amount: "4000", rate: "7" }, { amount: "6000", rate: "4.52" }, { amount: "20000", rate: "1" }]);
});
