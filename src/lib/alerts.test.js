import test from "node:test";
import assert from "node:assert/strict";
import { alertsDue, alertEmail, inputsFromRow, RATES_MIN_DAYS } from "./alerts.js";

const day = s => new Date(`${s}T08:00:00`);
const trap = {
  name: "Sam Smith", age: "38", employmentStatus: "employed", salary: "110000", hasPension: "yes", pensionType: "sacrifice",
  myContribution: "5", employerMatch: "5", employerContributionType: "match", potValue: "85000", inputsTaxYear: 2026,
};
const kinds = list => list.map(a => a.key);
const ROWS = [
  { id: "a", provider_name: "Bank A", product_name: "Easy Saver", account_type: "Easy access", rate_aer: "4.6", is_isa: false, max_balance: null },
  { id: "b", provider_name: "Bank B", product_name: "Cash ISA", account_type: "Easy access", rate_aer: "4.4", is_isa: true, max_balance: null },
];

test("before 5 April: early March, then a final reminder from 26 March, each sent once", () => {
  const early = alertsDue(trap, { today: day("2027-03-02") });
  assert.deepEqual(kinds(early), ["taxYearEnd:2026:early"]);
  assert.match(early[0].subject, /^Before 5 April: £[\d,]+ of tax you could save$/);
  assert.match(early[0].items[0], /a pension payment of £4,500 \(including the tax relief added\) before 5 April would bring your income back to £100,000/);
  // ISA allowance comes after the tax figures.
  assert.match(early[0].items[early[0].items.length - 1], /ISA allowance left/);

  const sent = [{ alert_key: "taxYearEnd:2026:early", kind: "taxYearEnd", sent_at: "2027-03-02T08:00:00Z" }];
  assert.deepEqual(kinds(alertsDue(trap, { today: day("2027-03-03"), sent })), []);
  const final = alertsDue(trap, { today: day("2027-03-26"), sent });
  assert.deepEqual(kinds(final), ["taxYearEnd:2026:final"]);
  assert.match(final[0].subject, /^10 days to 5 April/);
  assert.deepEqual(kinds(alertsDue(trap, { today: day("2027-04-06") })).filter(k => k.startsWith("taxYearEnd")), []);
  assert.deepEqual(alertsDue(trap, { today: day("2026-10-18") }), []);
});

test("before 5 April: nothing to use, no email", () => {
  const modest = { employmentStatus: "employed", salary: "40000", isaThisYearCash: "20000", inputsTaxYear: 2026 };
  assert.deepEqual(alertsDue(modest, { today: day("2027-03-02") }), []);
});

test("bonus: the month before it's paid, February when the month isn't known", () => {
  const d = { ...trap, salary: "80000", bonusAmount: "20000", hasBonus: "yes", bonusMonth: "6" };
  assert.deepEqual(kinds(alertsDue(d, { today: day("2027-05-10") })), ["bonus:2027-6"]);
  assert.deepEqual(alertsDue(d, { today: day("2027-06-10") }).filter(a => a.kind === "bonus"), []);
  const unknown = { ...d, bonusMonth: "" };
  const feb = alertsDue(unknown, { today: day("2027-02-10") });
  assert.deepEqual(kinds(feb), ["bonus:2027-3"]);
  assert.match(feb[0].items[0], /^Paying your £20,000 bonus into your pension could save up to £[\d,]+ in tax\./);
  // January's bonus: reminded in December, for the next year's January.
  assert.deepEqual(kinds(alertsDue({ ...d, bonusMonth: "1" }, { today: day("2026-12-05") })), ["bonus:2027-1"]);
});

test("new tax year: 10 to 30 April, asking whether pay is still the same", () => {
  const april = alertsDue({ ...trap, salary: "60000" }, { today: day("2027-04-12") });
  assert.deepEqual(kinds(april), ["newTaxYear:2027"]);
  assert.equal(april[0].subject, "New tax year: is your pay still £60,000?");
  assert.deepEqual(alertsDue({ ...trap, salary: "60000" }, { today: day("2027-04-08") }), []);
  assert.deepEqual(alertsDue({ employmentStatus: "not_working", notWorkingReason: "retired" }, { today: day("2027-04-12") }), []);
});

test("better rates: £100 a year or more, then at most every 30 days and only when it's moved", () => {
  const d = { employmentStatus: "employed", salary: "40000", cashTiers: [{ name: "Old account", amount: "20000", rate: "1" }], inputsTaxYear: 2026 };
  const now = day("2026-10-18");
  const [a] = alertsDue(d, { today: now, rows: ROWS });
  assert.equal(a.key, "rates:2026-10-18");
  assert.ok(a.detail.gain >= 100);
  assert.match(a.items[0], /Bank /);

  const recent = [{ alert_key: "rates:2026-10-01", kind: "rates", sent_at: "2026-10-01T08:00:00Z", detail: { gain: 1, top: "x" } }];
  assert.deepEqual(alertsDue(d, { today: now, rows: ROWS, sent: recent }), []);
  const old = new Date(now - (RATES_MIN_DAYS + 5) * 86400000).toISOString();
  assert.deepEqual(alertsDue(d, { today: now, rows: ROWS, sent: [{ alert_key: "rates:old", kind: "rates", sent_at: old, detail: a.detail }] }), []);
  assert.equal(alertsDue(d, { today: now, rows: ROWS, sent: [{ alert_key: "rates:old", kind: "rates", sent_at: old, detail: { ...a.detail, gain: a.detail.gain + 80 } }] }).length, 1);

  const small = { ...d, cashTiers: [{ amount: "2000", rate: "4" }] };
  assert.deepEqual(alertsDue(small, { today: now, rows: ROWS }), []);
});

test("free users: the 5 April reminder and rates only, and rates only when their row says what their savings pay", () => {
  const row = { email: "a@b.co", name: "Alex", employment_status: "employed", salary: 110000, has_pension: true, pension_my_pct: 5, pension_employer_pct: 5,
    cash_savings: 20000, savings_rate: null, isa_this_year: 5000, created_at: "2026-09-01T10:00:00Z" };
  const d = inputsFromRow(row);
  assert.equal(d.inputsTaxYear, 2026);
  assert.equal(d.salary, "110000");
  assert.deepEqual(alertsDue(d, { who: "free", today: day("2026-10-18"), rows: ROWS }), []);
  assert.equal(alertsDue(inputsFromRow({ ...row, savings_rate: 1 }), { who: "free", today: day("2026-10-18"), rows: ROWS }).length, 1);
  assert.deepEqual(alertsDue(d, { who: "free", today: day("2027-04-12") }), []); // no new-tax-year email for free users
  assert.deepEqual(kinds(alertsDue(d, { who: "free", today: day("2027-03-02") })), ["taxYearEnd:2026:early"]);
  // A row from last tax year: its ISA payments no longer count against this one.
  const old = inputsFromRow({ ...row, isa_this_year: 20000, created_at: "2025-09-01T10:00:00Z" });
  assert.match(alertsDue(old, { who: "free", today: day("2027-03-02") })[0].items.join(" "), /£20,000 of ISA allowance left/);
});

test("the email: greeting, items, the link, guidance, unsubscribe and company details; free users told when the figures are from", () => {
  const [a] = alertsDue(trap, { today: day("2027-03-02") });
  const { subject, text } = alertEmail(a, { name: "Sam Smith", unsubscribeUrl: "https://x/u" });
  assert.equal(subject, a.subject);
  assert.match(text, /^Hi Sam,\n/);
  assert.match(text, /\n- £/);
  assert.match(text, /See it in Candid: https:\/\/www\.candid-finance\.co\.uk\/app\/home/);
  assert.match(text, /guidance, not advice/);
  assert.match(text, /Stop these emails: https:\/\/x\/u\nCandid Personal Finance Ltd · Company no\. 17383565/);
  assert.doesNotMatch(text, /you should|we recommend|start with/i);
  const free = alertEmail(a, { free: true, asOf: new Date("2026-09-01"), unsubscribeUrl: "https://x/u" }).text;
  assert.match(free, /^Hi,\n/);
  assert.match(free, /from what you told Candid in September 2026/);
  assert.match(free, /A subscription keeps every module's figures current/);
});
