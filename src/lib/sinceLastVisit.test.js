import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { visitSnapshot, sinceLastVisit, agoLabel, RATES_MOVE_MIN } from "./sinceLastVisit.js";

const rows = [
  { id: "a", provider_name: "Bank A", product_name: "Easy Saver", account_type: "Easy access", rate_aer: "4.6", is_isa: false, max_balance: null },
  { id: "b", provider_name: "Bank B", product_name: "Cash ISA", account_type: "Easy access", rate_aer: "4.4", is_isa: true, max_balance: null },
];
const d = { salary: "55000", monthlyExpenses: "2000", cashTiers: [{ amount: "30000", rate: "1.0" }], inputsTaxYear: 2026 };
const m = calcMetrics(d);
const today = new Date("2026-10-08T12:00:00Z");
const daysBefore = n => new Date(today.getTime() - n * 86400000);

test("the first visit has nothing to compare with", () => {
  assert.equal(sinceLastVisit(null, d, m, rows, today), null);
});

test("nothing changed since the last visit: no strip", () => {
  const prev = visitSnapshot(d, m, rows, daysBefore(3));
  assert.equal(sinceLastVisit(prev, d, m, rows, today), null);
});

test("best rates moving by £50 a year or more, against the last visit", () => {
  const prev = { ...visitSnapshot(d, m, rows, daysBefore(3)) };
  const now = visitSnapshot(d, m, rows, today);
  const s = sinceLastVisit({ ...prev, gain: now.gain - RATES_MOVE_MIN - 10 }, d, m, rows, today);
  assert.equal(s.ago, "3 days ago");
  assert.equal(s.rates, true);
  assert.match(s.lines[0].text, /^today's best rates would add £[\d,]+ a year to your cash, up from £[\d,]+\.$/);
  // A smaller move isn't news.
  assert.equal(sinceLastVisit({ ...prev, gain: now.gain - 20 }, d, m, rows, today), null);
});

test("a new highest rate for them", () => {
  const prev = { ...visitSnapshot(d, m, rows, daysBefore(1)), top: "Old Bank|Saver|4.1" };
  const s = sinceLastVisit(prev, d, m, rows, today);
  assert.match(s.lines[0].text, /^a new highest rate for you: Bank [AB] .* at 4\.[46]%\.$/);
});

test("an account opened through Assist having its rate cut, once", () => {
  const acct = { id: "x1", rateId: "a", provider: "Bank A", product: "Easy Saver", name: "Bank A Easy Saver", isa: false, amount: 10000, ratePct: 5.1, openedAt: "2026-09-01" };
  const withAcct = { ...d, assistAccounts: [acct] };
  const mm = calcMetrics(withAcct);
  const before = { ...visitSnapshot(withAcct, mm, rows, daysBefore(2)), seen: [] };
  const s = sinceLastVisit(before, withAcct, mm, rows, today);
  const cut = s.lines.find(l => l.label === "Rate cut");
  assert.equal(cut.text, "Bank A Easy Saver now pays 4.6%, down from 5.1%: £50 a year less on your £10,000.");
  // Seen at the last visit: not raised again.
  const seenNow = visitSnapshot(withAcct, mm, rows, daysBefore(1));
  assert.equal(sinceLastVisit(seenNow, withAcct, mm, rows, today), null);
});

test("what changes have captured since, and a new tax year", () => {
  const banked = { ...d, moduleBaselines: { cash: { amount: 0, answers: "", banked: 365, changes: [{ perYear: 365, on: "2026-09-01" }] } } };
  const mb = calcMetrics(banked);
  const prev = visitSnapshot(banked, mb, rows, daysBefore(4));
  const s = sinceLastVisit(prev, banked, mb, rows, today);
  assert.deepEqual(s.lines.map(l => l.label), ["Saved"]);
  assert.equal(s.lines[0].text, "£4 more from the changes you've made.");
  const lastYear = { ...visitSnapshot(d, m, rows, daysBefore(200)), taxYear: 2025 };
  const ny = sinceLastVisit(lastYear, d, m, rows, today);
  assert.equal(ny.lines.find(l => l.label === "New tax year").text, "it started on 6 April, with a fresh £20,000 ISA allowance.");
  assert.equal(ny.ago, "7 months ago");
});

test("how long ago, in words", () => {
  assert.equal(agoLabel(today.toISOString(), today), "earlier today");
  assert.equal(agoLabel(daysBefore(1).toISOString(), today), "yesterday");
  assert.equal(agoLabel(daysBefore(20).toISOString(), today), "3 weeks ago");
});
