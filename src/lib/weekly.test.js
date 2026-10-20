import test from "node:test";
import assert from "node:assert/strict";
import { weeklyWeek, nextSunday, weeklyEmail, welcomeEmail, cleanIssue, IMPACTS } from "./weekly.js";
import { calcMetrics } from "./metrics.js";

const day = s => new Date(`${s}T08:00:00Z`);
const saver = {
  name: "Alex Jones", age: "27", employmentStatus: "employed", salary: "65000", ukNation: "england", scottishTaxpayer: "no",
  hasPension: "yes", pensionType: "sacrifice", myContribution: "6", employerMatch: "6", inputsTaxYear: 2026,
  cashTiers: [{ name: "Cash ISA", amount: "20000", rate: "3.45" }], hasCashIsaThisYear: "yes", isaThisYearCash: "7000",
  monthlyExpenses: "2000", selectedModules: ["cash"],
};
const ROWS = [
  { id: "a", provider_name: "Bank A", product_name: "Easy ISA", account_type: "Easy access ISA", rate_aer: "4.75", is_isa: true, max_balance: null },
  { id: "b", provider_name: "Bank B", product_name: "Saver", account_type: "Easy access", rate_aer: "4.5", is_isa: false, max_balance: null },
];
const issue = {
  week: "2026-10-25", subject: "", intro: "A quiet week, bar the Budget talk.",
  items: [
    { title: "Cash ISA limit to fall", status: "confirmed", body: "The limit for cash in an ISA falls to £12,000 a year.", source: "GOV.UK", url: "https://www.gov.uk/x", impact: { kind: "cashIsaLimit", limit: "12000", from: "April 2027" } },
    { title: "Salary sacrifice cap", status: "rumour", body: "Reports say the cap could come in sooner.", source: "FT", impact: { kind: "salarySacrificeCap", cap: "2000", from: "April 2029" } },
  ],
};

test("The Sunday email is due on the Sunday and the two days after, for that Sunday's issue", () => {
  assert.equal(weeklyWeek(day("2026-10-25")), "2026-10-25");
  assert.equal(weeklyWeek(day("2026-10-27")), "2026-10-25");
  assert.equal(weeklyWeek(day("2026-10-28")), null);
  assert.equal(nextSunday(day("2026-10-21")), "2026-10-25");
  assert.equal(nextSunday(day("2026-10-25")), "2026-10-25");
});

test("The Sunday email: their week on their figures, then the news, each with what it means for them", () => {
  const { subject, text } = weeklyEmail(issue, saver, { today: day("2026-10-25"), rows: ROWS, unsubscribeUrl: "https://u" });
  assert.equal(subject, "This week: Cash ISA limit to fall");
  assert.match(text, /^Hi Alex,\n\nA quiet week, bar the Budget talk\.\n\nYOUR WEEK\n- Rates: at today's best rates/);
  assert.match(text, /Cash ISA limit to fall \(Confirmed\)\nThe limit for cash in an ISA falls to £12,000 a year\.\nFor you: You've put £7,000 into a cash ISA this tax year, within a £12,000 limit from April 2027\.\nSource: GOV\.UK \(https:\/\/www\.gov\.uk\/x\)/);
  // £65,000 × 6% = £3,900 sacrificed; NI at 2% on the £1,900 over the cap.
  assert.match(text, /For you: You sacrifice about £3,900 a year\. Under a £2,000 cap from April 2029, National Insurance would be due on £1,900 of it: about £38 a year\./);
  assert.match(text, /Stop these emails: https:\/\/u/);
  assert.doesNotMatch(text, /you should/i);
});

test("An impact that doesn't apply to them leaves the item without a 'For you' line", () => {
  const noSacrifice = { ...saver, pensionType: "relief" };
  const { text } = weeklyEmail(issue, noSacrifice, { today: day("2026-10-25"), rows: ROWS, unsubscribeUrl: "https://u" });
  assert.equal((text.match(/For you:/g) || []).length, 1);
});

test("Savings rate moves are worked out on their cash", () => {
  const m = calcMetrics(saver);
  assert.equal(IMPACTS.savingsRate.line(saver, m, { change: "-0.25" }), "On your £20,000 in cash, a 0.25 point fall would mean about £50 a year less interest, if your accounts follow it.");
  assert.equal(IMPACTS.savingsRate.line(saver, m, { change: "" }), null);
});

test("Coming up: 5 April within six weeks, and a bonus month", () => {
  const { text } = weeklyEmail({ items: [] }, { ...saver, bonusAmount: "10000", bonusMonth: "3" }, { today: day("2026-03-01"), rows: [], unsubscribeUrl: "https://u" });
  assert.match(text, /Coming up: the tax year ends on 5 April, in 35 days\./);
  assert.match(text, /Coming up: your bonus is usually paid in March\./);
});

test("The welcome says what they get, how to sign in elsewhere and what they pay", () => {
  const { subject, text } = welcomeEmail({ name: "Alex Jones", plan: "monthly", amountPence: 299, periodEnd: "2026-11-20T17:59:52Z", unsubscribeUrl: "https://u" });
  assert.equal(subject, "Welcome to Candid");
  assert.match(text, /^Hi Alex,/);
  assert.match(text, /sign in with this email address: https:\/\/www\.candid-finance\.co\.uk\/signin/);
  assert.match(text, /Your plan: £2\.99 a month, renewing on 20 November 2026\./);
});

test("An issue from the editor keeps only known fields, and a safe link", () => {
  const clean = cleanIssue({ subject: " Hi ", items: [{ title: "T", body: "B", status: "odd", url: "javascript:x", impact: { kind: "nope" } }, { title: "", body: "" }] });
  assert.deepEqual(clean, { subject: "Hi", intro: "", items: [{ title: "T", status: "news", body: "B", source: "", url: "", impact: null }] });
  assert.deepEqual(cleanIssue({ items: [{ title: "T", body: "B", impact: { kind: "cashIsaLimit", limit: 12000, from: "April 2027", extra: "x" } }] }).items[0].impact,
    { kind: "cashIsaLimit", limit: "12000", from: "April 2027" });
});
