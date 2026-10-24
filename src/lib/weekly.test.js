import test from "node:test";
import assert from "node:assert/strict";
import { weeklyWeek, nextSunday, weeklyEmail, welcomeEmail, cleanIssue, IMPACTS, shortMoney } from "./weekly.js";
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
  assert.match(text, /^Hi Alex,\n\nA quiet week, bar the Budget talk\.\n\nYOUR WEEK ON CANDID\n- Rates: against today's best rates/);
  assert.match(text, /\[Confirmed\] Cash ISA limit to fall\nThe limit for cash in an ISA falls to £12k a year\.\nFor you: You've put £7k into a cash ISA this tax year, within a £12k limit from April 2027\.\nSource: GOV\.UK \(https:\/\/www\.gov\.uk\/x\)/);
  // £65,000 × 6% = £3,900 sacrificed; NI at 2% on the £1,900 over the cap.
  assert.match(text, /For you: You sacrifice about £3\.9k a year\. Under a £2k cap from April 2029, National Insurance would be due on £1\.9k of it: about £38 a year\./);
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
  const { subject, text } = welcomeEmail({ name: "Alex Jones", plan: "monthly", amountPence: 299, periodEnd: "2026-11-20T17:59:52Z", inviteCode: "abcd2345", unsubscribeUrl: "https://u" });
  assert.equal(subject, "Welcome to Candid");
  assert.match(text, /^Hi Alex,/);
  assert.match(text, /sign in \(https:\/\/www\.candid-finance\.co\.uk\/signin\?utm_source=candid-email&utm_medium=email&utm_campaign=welcome\) with this email address\./);
  assert.match(text, /Your plan: £2\.99 a month, renewing on 20 November 2026\n\nTo manage your subscription, go to Edit inputs/);
  assert.match(text, /up to 12 months\.\n\nYour invite link: https:\/\/www\.candid-finance\.co\.uk\/app\/start\?ref=abcd2345/);
  assert.doesNotMatch(text, /cancel/i);
  // No code yet (email not confirmed): where the link is instead.
  assert.match(welcomeEmail({ plan: "monthly", unsubscribeUrl: "https://u" }).text, /up to 12 months\. Your link is in Candid, under Edit inputs\./);
});

test("An issue from the editor keeps only known fields, and a safe link", () => {
  const clean = cleanIssue({ subject: " Hi ", items: [{ title: "T", body: "B", status: "odd", url: "javascript:x", impact: { kind: "nope" } }, { title: "", body: "" }] });
  assert.deepEqual(clean, { subject: "Hi", intro: "", items: [{ title: "T", status: "news", body: "B", source: "", url: "", impact: null }] });
  assert.deepEqual(cleanIssue({ items: [{ title: "T", body: "B", impact: { kind: "cashIsaLimit", limit: 12000, from: "April 2027", extra: "x" } }] }).items[0].impact,
    { kind: "cashIsaLimit", limit: "12000", from: "April 2027" });
});

test("the Sunday email: confirmed first, then news, then rumours, and a button under their week", () => {
  const issue = { items: [
    { title: "R1", status: "rumour", body: "b" }, { title: "N1", status: "news", body: "b" },
    { title: "C1", status: "confirmed", body: "b" }, { title: "N2", status: "news", body: "b" },
  ] };
  const d = { name: "Sam", salary: "48000", monthlyExpenses: "2000", cashTiers: [{ amount: "30000", rate: "1.0" }], inputsTaxYear: 2026 };
  const { text } = weeklyEmail(issue, d, { today: new Date("2026-10-25T04:00:00Z"), rows: [], unsubscribeUrl: "u" });
  const at = t => text.indexOf(`] ${t}\n`);
  assert.ok(at("C1") < at("N1") && at("N1") < at("N2") && at("N2") < at("R1"));
  assert.match(text, /\[Confirmed\] C1\n/);
  assert.ok(text.indexOf("Fix with Candid:") > text.indexOf("YOUR WEEK ON CANDID") && text.indexOf("Fix with Candid:") < text.indexOf("WHAT'S HAPPENING THIS WEEK"));
});

test("inflation and Bank Rate lines: real terms on their cash, and their mortgage or its fix", () => {
  const today = new Date("2026-10-25T04:00:00Z");
  const d = { salary: "60000", cashTiers: [{ amount: "30000", rate: "3.0" }], hasMortgage: "yes", mortgageBalance: "180000", mortgageRate: "4.5", inputsTaxYear: 2026 };
  const m = calcMetrics(d);
  assert.equal(IMPACTS.inflation.line(d, m, { rate: "3.5" }), "Your cash earns about 3% on average, below 3.5% inflation, so it's losing spending power: about £150 a year in real terms on your £30,000, before tax.");
  assert.match(IMPACTS.inflation.line({ ...d, cashTiers: [{ amount: "30000", rate: "4.5" }] }, calcMetrics({ ...d, cashTiers: [{ amount: "30000", rate: "4.5" }] }), { rate: "3.5" }), /above 3\.5% inflation, so it's growing in real terms/);
  assert.equal(IMPACTS.inflation.line({}, calcMetrics({}), { rate: "3.5" }), null);
  const line = IMPACTS.bankRate.line(d, m, { change: "0.25" }, today);
  assert.match(line, /On your £30,000 in cash, a 0\.25 point rise would mean about £75 a year more interest/);
  assert.match(line, /On your £180,000 mortgage, if your rate followed it, that would mean about £38 a month more in interest\./);
  const fixed = { ...d, fixExpiryMonth: "3", fixExpiryYear: "2027" };
  assert.match(IMPACTS.bankRate.line(fixed, calcMetrics(fixed), { change: "0.25" }, today), /Your mortgage is fixed until March 2027, so its payments wouldn't change before then\./);
  const { text } = weeklyEmail({ items: [] }, fixed, { today, rows: [], unsubscribeUrl: "u" });
  assert.match(text, /Coming up: your mortgage fix ends in March 2027\./);
  assert.doesNotMatch(weeklyEmail({ items: [] }, { ...fixed, fixExpiryYear: "2028" }, { today, rows: [], unsubscribeUrl: "u" }).text, /mortgage fix ends/);
});

test("skimmable: £k figures, a bold-led summary list, and a subject with their name", () => {
  assert.equal(shortMoney("£30,000, £180,000, £2,400, £621, £1,250,000 and £8.4bn."), "£30k, £180k, £2.4k, £621, £1.3m and £8.4bn.");
  const { subject, text, html } = weeklyEmail({ subject: "Cuppa and a yap, {first}?", intro: "- **Inflation rose to 3.5%** (ONS).\n- **Budget** on Wednesday.", items: [] },
    { name: "Sam Smith", cashTiers: [{ amount: "30000", rate: "1.0" }], inputsTaxYear: 2026 }, { today: new Date("2026-10-25T04:00:00Z"), rows: [], unsubscribeUrl: "u" });
  assert.equal(subject, "Cuppa and a yap, Sam?");
  assert.match(text, /^Hi Sam,\n\n- Inflation rose to 3\.5% \(ONS\)\.\n- Budget on Wednesday\./);
  assert.match(html, /<strong[^>]*>Inflation rose to 3\.5%<\/strong> \(ONS\)\./);
  assert.equal(weeklyEmail({ subject: "Cuppa and a yap, {first}?", items: [] }, {}, { today: new Date("2026-10-25T04:00:00Z"), rows: [], unsubscribeUrl: "u" }).subject, "Cuppa and a yap?");
});
