import { test } from "node:test";
import assert from "node:assert/strict";
import { comingUp } from "./comingUp.js";

const EVENTS = [
  { id: "budget-2026-10", kind: "budget", date: "2026-10-28" },
  { id: "boe-2026-11", kind: "bankRate", date: "2026-11-05" },
  { id: "boe-2026-12", kind: "bankRate", date: "2026-12-17" },
];
const employed = { employmentStatus: "employed", salary: "85000", payday: "28" };
const at = iso => new Date(`${iso}T12:00:00`);

test("the next three dates, nearest first, payday before an event on the same day", () => {
  const items = comingUp(employed, { today: at("2026-10-08"), events: EVENTS });
  assert.deepEqual(items.map(i => [i.mon, i.day, i.title]), [
    ["Oct", "28", "Payday"], ["Oct", "28", "Budget"], ["Nov", "5", "Bank Rate decision"],
  ]);
  assert.equal(items[0].sub, "In 20 days");
});

test("an event days away, or today, is still listed", () => {
  const items = comingUp(employed, { today: at("2026-10-25"), events: EVENTS });
  assert.ok(items.some(i => i.title === "Budget"));
  assert.equal(items[0].sub, "In 3 days");
  assert.ok(comingUp({}, { today: at("2026-10-28"), events: EVENTS }).some(i => i.key === "budget-2026-10"));
});

test("payday: today, tomorrow, the month's last day, next month once passed, the 28th assumed", () => {
  assert.equal(comingUp(employed, { today: at("2026-10-28"), events: [] })[0].sub, "Today");
  assert.equal(comingUp(employed, { today: at("2026-10-27"), events: [] })[0].sub, "Tomorrow");
  const feb = comingUp({ ...employed, payday: "31" }, { today: at("2027-02-10"), events: [] })[0];
  assert.deepEqual([feb.mon, feb.day], ["Feb", "28"]);
  const next = comingUp(employed, { today: at("2026-10-29"), events: [] })[0];
  assert.deepEqual([next.mon, next.day], ["Nov", "28"]);
  assert.equal(comingUp({ ...employed, payday: "" }, { today: at("2026-10-08"), events: [] })[0].sub, "In 20 days, assuming the 28th");
});

test("no payday for someone not employed or with no salary", () => {
  assert.ok(!comingUp({ employmentStatus: "self-employed", salary: "85000" }, { today: at("2026-10-08"), events: [] }).some(i => i.key === "payday"));
  assert.ok(!comingUp({ employmentStatus: "employed" }, { today: at("2026-10-08"), events: [] }).some(i => i.key === "payday"));
});

test("tax year end: the ISA allowance left once answered; this April or next", () => {
  const end = d => comingUp(d, { today: at("2026-10-08"), events: [] }).find(i => i.key === "taxYearEnd");
  assert.deepEqual([end({ isaThisYearCash: "5000", isaThisYearSS: "9200" }).sub, end({ isaThisYearCash: "5000", isaThisYearSS: "9200" }).amount], ["ISA allowance left", "£5,800"]);
  assert.equal(end({ isaThisYearCash: "20000" }).sub, "ISA allowance used in full");
  assert.equal(end({ isaThisYearCash: "20000" }).amount, undefined);
  assert.equal(end({}).sub, "Allowances start again on 6 April");
  const april = comingUp({}, { today: at("2027-04-05"), events: [] })[0];
  assert.deepEqual([april.mon, april.day], ["Apr", "5"]);
  assert.equal(comingUp({}, { today: at("2027-04-06"), events: [] }).length, 1);
});

test("past events drop off", () => {
  const items = comingUp({}, { today: at("2026-12-18"), events: EVENTS });
  assert.deepEqual(items.map(i => i.key), ["taxYearEnd"]);
});
