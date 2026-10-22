import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { outsideEvent, EVENTS, EVENT_AHEAD_DAYS, EVENT_SHOW_DAYS } from "./outsideEvents.js";

const d = { salary: "55000", monthlyExpenses: "2000", cashTiers: [{ amount: "30000", rate: "4.0" }], inputsTaxYear: 2026 };
const m = calcMetrics(d);
const on = iso => new Date(`${iso}T09:00:00Z`);
const boe = { id: "boe-x", kind: "bankRate", date: "2026-11-05", from: 3.75 };
const next = { id: "boe-y", kind: "bankRate", date: "2026-12-17" };

test("coming up: shown the week before, with the date, and not after the day passes unannounced", () => {
  const e = outsideEvent(d, m, { today: on("2026-10-30"), events: [boe] });
  assert.equal(e.phase, "scheduled");
  assert.equal(e.title, "Bank Rate decision on Thursday 5 November");
  assert.equal(e.text, "Bank Rate is 3.75% now. What the decision means for your savings shows here once it's announced.");
  assert.equal(outsideEvent(d, m, { today: on("2026-11-05"), events: [boe] }).title, "Bank Rate decision today");
  assert.equal(outsideEvent(d, m, { today: on("2026-11-06"), events: [boe] }), null);
  const tooEarly = new Date(on("2026-11-05").getTime() - EVENT_AHEAD_DAYS * 86400000);
  assert.equal(outsideEvent(d, m, { today: tooEarly, events: [boe] }), null);
});

test("a Bank Rate cut: what it would mean for their cash, and the next decision", () => {
  const e = outsideEvent(d, m, { today: on("2026-11-06"), events: [{ ...boe, to: 3.5 }, next] });
  assert.equal(e.phase, "announced");
  assert.equal(e.kicker, "Bank of England · 5 November");
  assert.equal(e.title, "Bank Rate cut to 3.5%");
  assert.equal(e.lines[0].text, "if your savings rates follow it, the £30,000 you hold would earn about £75 a year less, before tax.");
  assert.match(e.lines[1].text, /The next decision is on 17 December\.$/);
  // Gone after EVENT_SHOW_DAYS.
  const later = new Date(on("2026-11-05").getTime() + EVENT_SHOW_DAYS * 86400000);
  assert.equal(outsideEvent(d, m, { today: later, events: [{ ...boe, to: 3.5 }] }), null);
});

test("a hold: nothing changes; no cash line for someone with no cash", () => {
  const held = outsideEvent(d, m, { today: on("2026-11-05"), events: [{ ...boe, to: 3.75 }, next] });
  assert.equal(held.title, "Bank Rate held at 3.75%");
  assert.deepEqual(held.lines, [{ label: "Your figures", text: "nothing changes from this. The next decision is on 17 December." }]);
  const noCash = { salary: "30000" };
  const raised = outsideEvent(noCash, calcMetrics(noCash), { today: on("2026-11-05"), events: [{ ...boe, to: 4 }] });
  assert.equal(raised.title, "Bank Rate raised to 4%");
  assert.deepEqual(raised.lines.map(l => l.label), ["Savings rates"]);
});

test("a Budget: only the changes that touch their figures, or a line saying none do", () => {
  const budget = { id: "b", kind: "budget", date: "2026-10-28", changes: [
    { label: "ISA", text: "the allowance stays at £20,000.", applies: () => true },
    { label: "Student loans", text: "Plan 2 repayments start at a new threshold.", applies: dd => dd.studentLoan === "plan2" },
    { label: "Your cash", text: (dd, mm) => `on your ${mm.cash > 0 ? "savings" : "nothing"}.` },
  ] };
  const e = outsideEvent(d, m, { today: on("2026-10-29"), events: [budget] });
  assert.equal(e.kicker, "The Budget · 28 October");
  assert.deepEqual(e.lines.map(l => l.label), ["ISA", "Your cash"]);
  assert.equal(e.lines[1].text, "on your savings.");
  const none = outsideEvent(d, m, { today: on("2026-10-29"), events: [{ ...budget, changes: [{ label: "x", text: "y", applies: () => false }] }] });
  assert.equal(none.lines[0].text, "nothing announced changes what you've told Candid.");
});

test("closed stays closed, a phase at a time; the announced one comes back after closing the reminder", () => {
  const closed = ["boe-x:scheduled"];
  assert.equal(outsideEvent(d, m, { today: on("2026-11-01"), events: [boe], closed }), null);
  assert.equal(outsideEvent(d, m, { today: on("2026-11-05"), events: [{ ...boe, to: 3.5 }], closed }).phase, "announced");
});

test("the real list: the Budget is coming up this week, nothing announced is invented", () => {
  const e = outsideEvent(d, m, { today: on("2026-10-22"), events: EVENTS });
  assert.equal(e.title, "The Budget is on Wednesday 28 October");
});
