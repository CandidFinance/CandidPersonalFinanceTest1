import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyMonth, monthlyCheckIn, monthlyEmail, MONTHLY_GRACE_DAYS } from "./monthly.js";

const answered = keys => ({ selectedModules: keys, answeredModules: keys });
const d = {
  name: "Sam Smith", employmentStatus: "employed", salary: "55000", monthlyExpenses: "2000",
  cashTiers: [{ amount: "12000", rate: "1.5" }], premiumBonds: "0",
  isaThisYearSS: "8000", isaThisYearCash: "2000", isaPrevSS: "15000",
  hasPension: "yes", myContribution: "5", employerMatch: "5", employerContributionType: "match", potValue: "40000",
  studentLoan: "none", hasInvestments: "yes", inputsTaxYear: 2026,
  goalVaults: [{ id: "trip", name: "Holiday", target: "3000", saved: "1200", date: "" }],
  moduleBaselines: { cash: { amount: 300, answers: "", banked: 240, changes: [{ perYear: 240, on: "2026-10-01" }] } },
  ...answered(["cash", "investments", "pension"]),
};
const nov1 = new Date(Date.UTC(2026, 10, 1, 4));
const rows = [{ provider: "Best Bank", product: "Easy Saver", rate_aer: 4.6, is_isa: false, access: "easy", min_deposit: 1 }];

test("the check-in is due on the 1st and the few days after, and nowhere else in the month", () => {
  assert.equal(monthlyMonth(nov1), "2026-11");
  assert.equal(monthlyMonth(new Date(Date.UTC(2026, 10, 1 + MONTHLY_GRACE_DAYS))), "2026-11");
  assert.equal(monthlyMonth(new Date(Date.UTC(2026, 10, 2 + MONTHLY_GRACE_DAYS))), null);
  assert.equal(monthlyMonth(new Date(Date.UTC(2026, 10, 15))), null);
});

test("their figures: net worth, what's been captured, this year's goals, the ISA and their pots", () => {
  const c = monthlyCheckIn(d, { today: nov1, rows });
  assert.equal(c.key, "monthly:2026-11");
  assert.equal(c.subject, "Your November check-in");
  const byLabel = Object.fromEntries(c.figures.map(f => [f.label, f.text]));
  assert.match(byLabel["Net worth"], /^£\d/);
  assert.match(byLabel.Captured, /so far this tax year, from changes worth £240 a year\./);
  assert.match(byLabel["This year's goals"], /% of the way, \d of \d reached\./);
  assert.match(byLabel.ISA, /^£10,000 of the £20,000 allowance used, with 155 days to 5 April\.$/);
  assert.equal(byLabel.Holiday, "£1,200 of £3,000.");
  // The ISA once, in their figures, not again under what's worth knowing.
  assert.ok(!c.worthKnowing.some(l => l.label === "ISA"));
  assert.equal(c.detail.netWorth, Math.round(c.detail.netWorth));
});

test("net worth is compared with last month's check-in, and the same month never goes twice", () => {
  const first = monthlyCheckIn(d, { today: nov1, rows });
  const sent = [{ alert_key: "monthly:2026-10", kind: "monthly", sent_at: "2026-10-01T04:00:00Z", detail: { netWorth: first.detail.netWorth - 1200 } }];
  const c = monthlyCheckIn(d, { today: nov1, rows, sent });
  assert.match(c.figures[0].text, /, up £1,200 since your October check-in\.$/);
  assert.match(c.preheader, /up £1,200 since your October check-in/);
  const same = monthlyCheckIn(d, { today: nov1, rows, sent: [{ ...sent[0], detail: { netWorth: first.detail.netWorth } }] });
  assert.match(same.figures[0].text, /the same as at your October check-in/);
  assert.equal(monthlyCheckIn(d, { today: nov1, rows, sent: [{ alert_key: "monthly:2026-11", kind: "monthly" }] }), null);
});

test("a check-in with nothing answered still gives net worth, and leaves out what it can't say", () => {
  const bare = { name: "Al", salary: "30000", inputsTaxYear: 2026 };
  const c = monthlyCheckIn(bare, { today: nov1, rows });
  assert.deepEqual(c.figures.map(f => f.label), ["Net worth"]);
});

test("the email: their figures, what's worth knowing, a way back in; tagged as the monthly campaign", () => {
  const c = monthlyCheckIn(d, { today: nov1, rows });
  const { html, text } = monthlyEmail(c, { name: d.name, unsubscribeUrl: "https://www.candid-finance.co.uk/api/alerts?action=unsubscribe&t=x" });
  assert.match(text, /^Hi Sam,/);
  assert.match(text, /YOUR FIGURES\n- Net worth: £/);
  assert.match(text, /- Holiday: £1,200 of £3,000\./);
  // Updating their figures is the button; their progress a link under it.
  assert.match(text, /Update your figures: https:\/\/www\.candid-finance\.co\.uk\/app\/inputs\?utm_source=candid-email&utm_medium=email&utm_campaign=monthly/);
  assert.match(html, /background:#0071E3;"><a href="https:\/\/www\.candid-finance\.co\.uk\/app\/inputs\?utm_source=candid-email[^"]*"[^>]*>Update your figures<\/a>/);
  assert.match(text, /Or see your progress \(https:\/\/www\.candid-finance\.co\.uk\/app\/progress\?utm_source=candid-email/);
  assert.match(text, /guidance, not advice/);
  assert.match(html, /Your figures/);
  // Information, not instruction.
  assert.doesNotMatch(text, /\byou should\b|\brecommend/i);
});
