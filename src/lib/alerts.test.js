import test from "node:test";
import assert from "node:assert/strict";
import { alertsDue, alertEmail, inputsFromRow, isFounding, capSends, RATES_MIN_DAYS } from "./alerts.js";

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
  assert.match(early[0].subject, /^Before 5 April: £[\d,]+ of avoidable tax$/);
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
  assert.match(feb[0].items[0], /^Up to £[\d,]+ of tax on your £20,000 bonus is avoidable, if it's paid into your pension\./);
  // January's bonus: reminded in December, for the next year's January.
  assert.deepEqual(kinds(alertsDue({ ...d, bonusMonth: "1" }, { today: day("2026-12-05") })), ["bonus:2027-1"]);
});

test("parents over £100,000: the 5 April and bonus emails say what childcare a pension payment restores", () => {
  const parent = { ...trap, kidsPreschool: "1", kidsSchool: "0", childcareMonthly: "1500", partnerOver100k: "no", ukNation: "england" };
  const [march] = alertsDue(parent, { today: day("2027-03-02") });
  assert.match(march.items[0], /It would also restore £10,290 a year of childcare support\.$/);
  // The subject stays the tax figure: childcare isn't tax.
  assert.equal(march.subject, alertsDue(trap, { today: day("2027-03-02") })[0].subject);
  const bonus = alertsDue({ ...parent, salary: "90000", bonusAmount: "20000", hasBonus: "yes", bonusMonth: "3" }, { today: day("2027-02-10") }).find(a => a.kind === "bonus");
  assert.match(bonus.items[0], /stops £10,290 a year of childcare support; paying £[\d,]+ of it into your pension would keep it\.$/);
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

test("free users' better rates: from ratesFrom (a few days after they confirm), and none when it's false (not a founding user)", () => {
  const d = inputsFromRow({ email: "a@b.co", employment_status: "employed", salary: 50000, cash_savings: 20000, savings_rate: 1, created_at: "2026-10-01T10:00:00Z" });
  const opts = ratesFrom => ({ who: "free", today: day("2026-10-18"), rows: ROWS, ratesFrom });
  assert.deepEqual(alertsDue(d, opts(day("2026-10-19"))), []);
  assert.equal(alertsDue(d, opts(day("2026-10-18"))).length, 1);
  assert.deepEqual(alertsDue(d, opts(false)), []);
  assert.equal(isFounding("2026-10-20T09:00:00Z"), true); // FOUNDING_UNTIL is open
});

test("payday: on their payday, with the £100k trap in view, where the tax year is heading", () => {
  const onPayday = alertsDue(trap, { today: day("2026-10-28") }).filter(a => a.kind === "payday");
  assert.deepEqual(kinds(onPayday), ["payday:2026-10"]);
  assert.match(onPayday[0].items[0], /^On your answers, your income this tax year is heading for £[\d,]+\.$/);
  // Not the day before, and on the day they've said.
  assert.deepEqual(alertsDue(trap, { today: day("2026-10-27") }).filter(a => a.kind === "payday"), []);
  assert.deepEqual(kinds(alertsDue({ ...trap, payday: "15" }, { today: day("2026-10-15") }).filter(a => a.kind === "payday")), ["payday:2026-10"]);
  // Pay to date from the check-in: the year from that.
  const tracked = alertsDue({ ...trap, payToDate: "60000", payToDateOn: "2026-09-28" }, { today: day("2026-10-28") }).find(a => a.kind === "payday");
  assert.match(tracked.items[0], /^On your pay to date \(28 September\)/);
  // Nowhere near £100k: none.
  assert.deepEqual(alertsDue({ ...trap, salary: "50000" }, { today: day("2026-10-28") }).filter(a => a.kind === "payday"), []);
});

test("a bonus that takes income over £100,000: how much of it keeps them at £100,000", () => {
  const b = alertsDue({ ...trap, salary: "90000", bonusAmount: "20000", hasBonus: "yes", bonusMonth: "3" }, { today: day("2027-02-10") }).find(a => a.kind === "bonus");
  assert.match(b.items[0], /paying £[\d,]+ of it into your pension would keep you at £100,000\.$/);
});

test("before 5 April, the £100k trap is on this tax year's figures: recorded top-ups count", () => {
  const up = (amount, month) => ({ id: `sacrifice${month}`, amount, route: "sacrifice", month, taxYear: 2026 });
  const trapLine = d => alertsDue(d, { today: day("2027-03-02") }).flatMap(a => a.items).find(i => /bring your income back to £100,000/.test(i));
  // £104,500 less £4,500 of top-ups: back at £100,000, nothing to say.
  assert.equal(trapLine({ ...trap, trapTopUps: [up(4500, 11)] }), undefined);
  // £2,000 of it done: the payment still to make is the rest (to £1:
  // thisTaxYear rounds the salary).
  assert.match(trapLine({ ...trap, trapTopUps: [up(2000, 11)] }), /a pension payment of £2,50[01] /);
});

test("the bonus email is on this tax year's figures: top-ups use annual allowance the bonus could have", () => {
  const up = amount => ({ id: "sacrifice11", amount, route: "sacrifice", month: 11, taxYear: 2026 });
  const d = { ...trap, bonusAmount: "50000", hasBonus: "yes", bonusMonth: "3" };
  const subject = ups => alertsDue({ ...d, trapTopUps: ups }, { today: day("2027-02-10") }).find(a => a.kind === "bonus")?.subject;
  const saving = ups => +subject(ups).match(/£([\d,]+)/)[1].replace(/,/g, "");
  assert.ok(saving([up(9000)]) < saving([]));
  // The allowance used up: nothing to say.
  assert.equal(subject([up(60000)]), undefined);
});

test("the daily cap: what fits under it today, most time-bound first; the rest waits for the next run", () => {
  const today = new Date("2026-10-29T15:00:00Z");
  const emails = [{ kind: "weekly", to: "a" }, { kind: "event", to: "b" }, { kind: "rates", to: "c" }, { kind: "confirmReminder", to: "d" }, { kind: "event", to: "e" }];
  const sent = [{ sent_at: "2026-10-29T04:01:00Z" }, { sent_at: "2026-10-29T04:02:00Z" }, { sent_at: "2026-10-28T23:59:00Z" }];
  const { now, later, room } = capSends(emails, sent, today, 5);
  assert.equal(room, 3);
  assert.deepEqual(now.map(e => e.to), ["d", "c", "b"]);
  assert.deepEqual(later.map(e => e.to), ["e", "a"]);
  assert.equal(capSends(emails, null, today, 95).now.length, 5);
  assert.equal(capSends(emails, [...sent, ...sent, ...sent], today, 5).room, 0);
});
