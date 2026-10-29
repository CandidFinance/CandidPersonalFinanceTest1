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
  assert.match(text, /On your £30k in cash, a 0\.25 point fall would mean about £75 a year less interest, if your accounts follow it\./);
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

test("the Budget email: Win and Bites pills, a line on their figures, or a worked example where Candid hasn't the figures", () => {
  const issue = cleanEventDraft({ subject: "Autumn Budget 2026", intro: "Delivered on Wednesday.", items: [
    { title: "Savings interest tax up", status: "confirmed", verdict: "bites", body: "24% / 44% / 49%.", impact: { kind: "savingsTax", from: "April 2027" } },
    { title: "Cash ISA cut scrapped", status: "confirmed", verdict: "win", body: "All £20,000.", impact: { kind: "cashIsaLimit", limit: "20000", from: "April 2027" } },
    { title: "Rental income tax up", status: "confirmed", verdict: "bites", body: "24% / 44% / 49%.", impact: { kind: "propertyTax", from: "April 2027" } },
    { title: "Trading allowance tripled", status: "confirmed", verdict: "win", body: "£3,000.", impact: { kind: "tradingAllowance", allowance: "3000", from: "April 2027" } },
    { title: "LISA charge cut", status: "confirmed", verdict: "nonsense", body: "20%.", impact: { kind: "lisaCharge" } },
  ] });
  assert.equal(issue.items[0].verdict, "bites");
  assert.equal(issue.items[4].verdict, undefined);
  const rows = [{ account_type: "Easy access", is_isa: false, rate_aer: "5.00" }, { account_type: "Easy access ISA", is_isa: true, rate_aer: "6" }];
  const { text, html } = eventEmail(issue, budget, d, { today: new Date("2026-10-29T15:00:00Z"), rows, unsubscribeUrl: "https://u" });
  assert.match(text, /\[Bites\] Savings interest tax up/);
  assert.match(text, /\[Win\] Cash ISA cut scrapped/);
  assert.match(text, /\[Confirmed\] LISA charge cut/);
  assert.match(html, /#9b2c22[^>]*>Bites</);
  // Their cash: £30,000 at 4% is £1,200 a year; over their £1,000 allowance at 20% now, 24% from April 2027.
  assert.match(text, /For you: Your £30k in cash earns about £1\.2k a year\. Over the £1k you can earn tax-free, that's about £48 a year in tax from April 2027, against £40 now\./);
  assert.match(text, /For you: You've put £15k into a cash ISA this tax year\. From April 2027, up to £20k a year can still go into cash\./);
  // No rental or side income in Candid: examples, on their basic rate.
  assert.match(text, /For example: As a basic-rate taxpayer, £10k of rental profit would be taxed £2\.4k from April 2027, against £2k now\./);
  assert.match(text, /For example: £2\.5k of side income is taxed on the £1\.5k over today's £1k allowance: £300 at basic rate\./);
  assert.match(text, /For example: £4k paid in becomes £5k with the bonus\./);
  assert.match(text, /See where these land on your figures: /);
  // Without cash or salary, the savings example uses today's best easy-access rate outside an ISA.
  const blank = eventEmail(issue, budget, { name: "Jo" }, { rows, unsubscribeUrl: "https://u", free: true });
  assert.match(blank.text, /For example: £30k at 5% \(today's best easy-access rate\) earns £1\.5k a year\. The tax on it from April 2027: £120 at basic rate \(£100 now\), £440 at higher rate \(£400 now\)\./);
  assert.match(blank.text, /You're getting this because you gave us your email/);
  // Where Candid could work it out, the example links to adding the figure; not where it can't.
  assert.match(blank.text, /\(£400 now\)\.\nSee yours: add your savings in Candid: https:\/\/www\.candid-finance\.co\.uk\/app\/home\?utm_source=candid-email/);
  assert.match(blank.text, /For example: £20k in a cash ISA at 6% \(today's best easy-access ISA rate\) earns £1\.2k a year, tax-free\. Outside an ISA, a higher-rate taxpayer would pay about £308 a year on it from April 2027\.\nSee yours: add your savings in Candid/);
  assert.doesNotMatch(blank.text, /rental profit[^\n]*\nSee yours/);
  assert.doesNotMatch(text, /For you: [^\n]*\nSee yours/);
  assert.doesNotMatch(text + blank.text, /\byou should\b|\brecommend/i);
});
