import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { eventEmailDue, cleanEventDraft, draftFromTool, flagEmail, eventEmail, DRAFT_TOOL, draftSystem, draftPrompt, EVENT_EMAIL_DAYS } from "./eventEmails.js";
import { outsideEvent, withApproved } from "./outsideEvents.js";

const boe = { id: "boe-x", kind: "bankRate", date: "2026-11-05", from: 3.75 };
const budget = { id: "budget-x", kind: "budget", date: "2026-10-28" };
const d = { name: "Sam Smith", salary: "48000", monthlyExpenses: "2000", cashTiers: [{ amount: "30000", rate: "4.0" }], isaThisYearCash: "15000", inputsTaxYear: 2026 };
const toolInput = {
  found: true, new_bank_rate: 3.5, subject: "Bank Rate cut to 3.5%", intro: "The Bank of England cut Bank Rate by a quarter point today.",
  items: [{ title: "Bank Rate cut to 3.5%", status: "news", body: "The Monetary Policy Committee voted 6-3 to cut Bank Rate from 3.75% to 3.5%.", source: "Bank of England", url: "https://www.bankofengland.co.uk/x",
    impact: { kind: "savingsRate", change: "-0.25", limit: "", from: "", cap: "" } },
    { title: "Something general", status: "news", body: "No figures for this one.", source: "", url: "", impact: { kind: "none", change: "", limit: "", from: "", cap: "" } }],
  note: "Checked the MPC summary.",
};

test("the email can go from the event's day to a few days after, and not before or later", () => {
  assert.equal(eventEmailDue(boe, "2026-11-04"), false);
  assert.equal(eventEmailDue(boe, "2026-11-05"), true);
  assert.equal(eventEmailDue(boe, `2026-11-0${5 + EVENT_EMAIL_DAYS}`), true);
  assert.equal(eventEmailDue(boe, `2026-11-${String(6 + EVENT_EMAIL_DAYS).padStart(2, "0")}`), false);
});

test("Claude's tool input becomes a clean draft: the new rate, and an impact only where one fits", () => {
  const draft = draftFromTool(toolInput);
  assert.deepEqual(draft.outcome, { to: 3.5 });
  assert.deepEqual(draft.items[0].impact, { kind: "savingsRate", change: "-0.25" });
  assert.equal(draft.items[1].impact, null);
  assert.equal(cleanEventDraft({ outcome: { to: "abc" } }).outcome, null);
  assert.equal(cleanEventDraft({ outcome: { to: "" } }).outcome, null);
});

test("the tool is strict, every property required, and the prompt keeps to information", () => {
  const walk = s => {
    if (s?.type === "object") {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
      Object.values(s.properties).forEach(walk);
    }
    if (s?.items) walk(s.items);
  };
  assert.equal(DRAFT_TOOL.strict, true);
  walk(DRAFT_TOOL.input_schema);
  assert.match(draftSystem(), /never what the reader should do/);
  assert.match(draftPrompt(boe, "2026-11-05"), /before it was 3\.75%/);
});

test("each subscriber's email: the news, a line on their own cash, tagged as the event campaign", () => {
  const { subject, text, html } = eventEmail(draftFromTool(toolInput), boe, d, { today: new Date("2026-11-06T04:00:00Z"), unsubscribeUrl: "https://www.candid-finance.co.uk/api/alerts?action=unsubscribe&t=x" });
  assert.equal(subject, "Bank Rate cut to 3.5%");
  assert.match(text, /^Hi Sam,/);
  assert.match(text, /On your £30,000 in cash, a 0\.25 point fall would mean about £75 a year less interest, if your accounts follow it\./);
  assert.match(html, /utm_campaign=event/);
  assert.doesNotMatch(text, /\byou should\b|\brecommend/i);
});

test("the flag: what's waiting and where to approve it, or that it needs writing", () => {
  const ready = flagEmail(boe, { draft: draftFromTool(toolInput), note: "Checked the MPC summary." });
  assert.equal(ready.subject, "To approve: Claude's draft for the Bank Rate decision");
  assert.match(ready.text, /Nothing goes to subscribers until it's approved\./);
  assert.match(ready.text, /- Bank Rate cut to 3\.5% \[for you: Savings rates move\]/);
  assert.match(ready.text, /Claude's note: Checked the MPC summary\./);
  assert.match(ready.text, /\/admin\/alerts/);
  const missing = flagEmail(budget, { error: "It couldn't find the announcement yet." });
  assert.equal(missing.subject, "The Budget email needs writing");
});

test("approved, it shows in the app: Bank Rate's new rate; a Budget's items where they touch their figures", () => {
  const m = calcMetrics(d);
  const today = new Date("2026-11-06T09:00:00Z");
  const events = withApproved([boe], [{ event_id: "boe-x", outcome: { to: 3.5 }, items: [] }]);
  assert.equal(outsideEvent(d, m, { today, events }).title, "Bank Rate cut to 3.5%");
  const budgetRow = { event_id: "budget-x", outcome: null, items: [
    { title: "Cash ISA limit", body: "The cash limit falls.", impact: { kind: "cashIsaLimit", limit: "12000", from: "April 2027" } },
    { title: "Salary sacrifice", body: "A cap.", impact: { kind: "salarySacrificeCap", cap: "2000", from: "April 2029" } },
    { title: "Fuel duty", body: "Frozen for another year.", impact: null },
  ] };
  const e = outsideEvent(d, m, { today: new Date("2026-10-29T09:00:00Z"), events: withApproved([budget], [budgetRow]) });
  assert.deepEqual(e.lines.map(l => l.label), ["Cash ISA limit", "Fuel duty"]);
  assert.match(e.lines[0].text, /You've put £15,000 into a cash ISA this tax year\. Under a £12,000 limit from April 2027/);
  // Not approved: still only "coming up", and gone after the day.
  assert.equal(outsideEvent(d, m, { today, events: withApproved([boe], []) }), null);
});
