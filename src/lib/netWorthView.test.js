import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { netWorthPicture } from "./progressTracker.js";
import { calcNetWorthTrajectory } from "./forecast.js";
import {
  worthAccounts, worthGroups, worthGroupByKey, worthTimeline, seriesOf, netSeries, changeOver12,
  debtSplit, studentLoanSplit, homeShare, monthKey, GROUPINGS,
} from "./netWorthView.js";
import { withThisMonth, mergeHistory } from "./netWorthHistory.js";
import { mergeAnswers } from "./mergeAnswers.js";

// The test clock is 8 Oct 2026.
const base = {
  age: "34", employmentStatus: "employed", salary: "62000", monthlyExpenses: "2200",
  cashTiers: [{ amount: "12000.4", rate: "4.25", name: "Easy access" }, { amount: "8000.3", rate: "4.6" }, { amount: "500", rate: "0" }],
  premiumBonds: "4500",
  isaPrevSS: "15000", isaThisYearSS: "2100", isaPrevLISA: "6000", isaThisYearLISA: "1000", isaPrevCash: "3000",
  unwrappedValue: "14300.6", unrealisedGains: "3100",
  hasPension: "yes", myContribution: "5", employerMatch: "5", employerContributionType: "match", potValue: "71200", potValue2: "17200", pensionType: "sacrifice",
  studentLoan: "plan2", loanBalance: "41200",
  hasMortgage: "yes", mortgageBalance: "268000", propertyEquity: "142000", mortgageRate: "4.45", monthlyMortgage: "1420",
  hasPersonalLoan: "yes", personalLoanBalance: "3000", personalLoanRate: "7.9", personalLoanMonthly: "150",
};
const setUp = (d = base) => { const m = calcMetrics(d); return { d, m, worth: worthAccounts(d, m) }; };
const total = list => list.reduce((s, x) => s + x.value, 0);

test("each category's accounts add up to its part, and assets less debts is the headline", () => {
  const { d, m, worth } = setUp();
  const pic = netWorthPicture(d, m);
  for (const p of pic.parts) {
    const cat = worth.assets.find(c => c.key === p.id);
    assert.equal(total(cat.accounts), cat.value, p.id);
    assert.ok(Math.abs(cat.value - p.value) <= 5, p.id);
  }
  for (const x of pic.debts) assert.equal(worth.debts.find(c => c.key === x.id).value, x.value);
  assert.equal(worth.netWorth, pic.netWorth);
  assert.equal(worth.assetsTotal - worth.debtsTotal, worth.netWorth);
});

test("cash tiers each an account, unnamed ones numbered, Premium Bonds their own", () => {
  const { worth } = setUp();
  const cash = worth.assets.find(c => c.key === "cash").accounts;
  assert.deepEqual(cash.map(a => a.label), ["Premium Bonds", "Easy access", "Savings account 1", "Savings account 2"]);
  assert.equal(cash[1].note, "4.25%");
  assert.equal(cash[2].note, "4.6%");
  assert.equal(cash[3].note, null);
  const single = setUp({ ...base, cashTiers: [{ amount: "5000", rate: "4" }], premiumBonds: "0" }).worth;
  assert.deepEqual(single.assets.find(c => c.key === "cash").accounts.map(a => a.label), ["Savings"]);
});

test("ISAs by type, held and paid in this year together, and investments outside an ISA", () => {
  const { worth } = setUp();
  const inv = worth.assets.find(c => c.key === "investments").accounts;
  const by = Object.fromEntries(inv.map(a => [a.id, a.value]));
  assert.equal(by["isa-ss"], 17100);
  assert.equal(by["isa-lisa"], 7000);
  assert.equal(by["isa-cash"], 3000);
  assert.equal(inv.find(a => a.id === "isa-ss").note, "£2,100 paid in, 26/27");
  assert.equal(inv.find(a => a.id === "unwrapped").note, "£3,100 of it gains");
});

test("every grouping adds up to the same assets and debts", () => {
  const { d, m, worth } = setUp();
  for (const by of GROUPINGS) {
    const g = worthGroups(d, m, worth, by);
    assert.equal(total(g.assets), worth.assetsTotal, by);
    assert.equal(total(g.debts), worth.debtsTotal, by);
    for (const row of [...g.assets, ...g.debts]) assert.equal(total(row.accounts), row.value, `${by} ${row.key}`);
    assert.deepEqual(g.assets.map(r => r.value), [...g.assets.map(r => r.value)].sort((a, b) => b - a));
  }
  const access = worthGroups(d, m, worth, "access").assets;
  assert.equal(access.find(r => r.key === "access-lisa").value, 7000);
  assert.ok(access.find(r => r.key === "access-now").accounts.every(a => a.id !== "isa-lisa"));
  assert.equal(worthGroupByKey(d, m, worth, "acc-isa-lisa").label, "Lifetime ISA");
  assert.equal(worthGroupByKey(d, m, worth, "nope"), null);
});

test("facts are label and value pairs, from the old notes", () => {
  const { d, m, worth } = setUp({ ...base, fixExpiryMonth: "3", fixExpiryYear: "2028" });
  const facts = key => Object.fromEntries(worthGroupByKey(d, m, worth, key).facts);
  assert.equal(facts("home")["Yours"], `${100 - m.ltv}%`);
  assert.equal(facts("mortgage")["Fix ends"], "Mar 2028");
  assert.equal(facts("mortgage")["Payment/mo"], "£1,420");
  assert.equal(facts("investments")["Outside ISAs"], "£14,301");
  assert.ok(facts("studentLoan")["Repayments/yr"]);
  assert.equal(facts("access-lisa")["Accessible from"], "60, or for a first home");
  assert.match(facts("access-pension")["Accessible from"], /^57, in 23 yrs$/);
});

test("a cash account's rate and interest, Premium Bonds against the best easy access rate, the student loan in full, the State Pension", () => {
  const { d, m, worth } = setUp();
  const rates = [
    { account_type: "Premium Bonds", rate_aer: "4.00", is_isa: false },
    { account_type: "Easy access", rate_aer: "5.00", is_isa: false, access: "easy" },
  ];
  const facts = key => Object.fromEntries(worthGroupByKey(d, m, worth, key, { rates }).facts);
  const easy = facts("acc-cash-0");
  assert.equal(easy["Rate"], "4.25%");
  assert.equal(easy["Interest forecast, 26/27"], "£510");
  // April to September begun by 8 Oct: half the year.
  assert.equal(easy["Interest to date (est.)"], "£255");
  const bonds = facts("acc-premiumBonds");
  assert.equal(bonds["Prize fund rate"], "4%");
  assert.equal(bonds["Avg. prizes/yr"], "£180");
  assert.equal(bonds["Limit used"], "£4,500 / £50,000");
  assert.ok(bonds["vs. best easy access rate, after tax"]);
  assert.match(bonds["Tax saved vs. savings interest"], /^£[\d,]+\/yr$/);
  const sl = facts("studentLoan");
  assert.equal(sl["Balance"], "£41,200");
  assert.match(sl["Repayments began"], /^Apr \d{4} \(est\.\)$/);
  assert.ok(sl["Interest forecast, 26/27"]);
  assert.ok(sl["Repayments left, 26/27"]);
  assert.ok(sl["Still to repay (est.)"]);
  const pension = facts("pension");
  assert.match(pension["State Pension (est.)"], /^£[\d,]+\/yr from \d+$/);
  assert.equal(pension["Annual allowance use, 26/27 (forecast)"], "£6,200 / £60,000");
  // Two pots: what's paid in sits on the current pot's page, not Pension's.
  assert.equal(pension["You pay in"], undefined);
  const pot = facts("acc-pension-current");
  assert.equal(pot["Provider"], "Coming soon");
  assert.equal(pot["You pay in"], "5% · £3,100/yr");
  assert.equal(pot["Employer pays in"], "5% · £3,100/yr");
  assert.equal(pot["Paid by"], "Salary sacrifice");
  // Half the tax year begun by 8 Oct.
  assert.equal(pot["Paid in, 26/27 (est.)"], "£3,100");
  assert.equal(pot["Employer match"], "Fully claimed");
  assert.equal(pot["Annual allowance use, 26/27 (forecast)"], undefined);
  const inv = facts("investments");
  assert.equal(inv["ISA allowance used, 26/27"], "£3,100 / £20,000");
  assert.equal(inv["ISA allowance left"], undefined);
  assert.equal(inv["Unrealised gains"], "£3,100");
  assert.equal(inv["Taxable if sold today"], "£100");
  assert.equal(inv["CGT allowance used, 26/27"], "£0 / £3,000");
  assert.equal(inv["Days left to use it"], "180");
  const lisa = facts("acc-isa-lisa");
  assert.equal(lisa["Paid in, 26/27"], "£1,000");
  assert.equal(lisa["Govt bonus, 25%"], "£250");
});

test("a new user's line starts at Now, at the headline, with the projection from today's figures", () => {
  const { d, m, worth } = setUp();
  const tl = worthTimeline(d, m, worth, {});
  assert.equal(tl.nowIndex, 0);
  assert.equal(tl.points[0].label, "Oct 26");
  assert.equal(tl.points.length, 241);
  const net = netSeries(tl, worth);
  assert.equal(Math.round(net[0]), worth.netWorth);
  // The projection's own year 0 is the same net worth (calcMetrics').
  assert.equal(calcNetWorthTrajectory(d, m, 1)[0].netWorth, Math.round(m.netWorth));
  // A year on, the projection's change in net worth, as Forecast's.
  const rows = calcNetWorthTrajectory(d, m, 20);
  assert.ok(Math.abs((net[12] - net[0]) - (rows[1].netWorth - rows[0].netWorth)) <= 5);
  assert.equal(changeOver12(tl, net), null);
  // Accounts' lines add up to their category's at every point.
  const cash = worth.assets.find(c => c.key === "cash");
  const viaAccounts = seriesOf(tl, cash.accounts);
  assert.ok(Math.abs(viaAccounts[0] - cash.value) < 0.01);
});

test("saved months come before Now, gaps filled in a straight line, and the last 12 months' change", () => {
  const { d, m, worth } = setUp();
  const history = {
    "2025-10": { total: 100000, cats: { cash: 20000 }, accts: { "cash-0": 10000 } },
    "2026-04": { total: 120000, cats: { cash: 22000 }, accts: { "cash-0": 11000 } },
    "2026-10": { total: 1, cats: {}, accts: {} }, // this month: Now is today's figures
    junk: 5,
  };
  const tl = worthTimeline(d, m, worth, history);
  assert.equal(tl.nowIndex, 12);
  assert.equal(tl.points[0].label, "Oct 25");
  assert.equal(tl.acct["cash-0"][0], 10000);
  assert.equal(tl.acct["cash-0"][3], 10500);
  assert.equal(tl.acct["cash-0"][6], 11000);
  assert.equal(tl.acct["cash-0"][12], worth.accounts.find(a => a.id === "cash-0").value);
  // Saved by account without it: £0 then, not a share of the category.
  assert.equal(tl.acct.premiumBonds[0], 0);
  // A month saved without accounts: the category's figure at today's share.
  const cash = worth.assets.find(c => c.key === "cash");
  const bonds = cash.accounts.find(a => a.id === "premiumBonds");
  const old = worthTimeline(d, m, worth, { "2025-10": { total: 1, cats: { cash: 20000 } } });
  assert.ok(Math.abs(old.acct.premiumBonds[0] - 20000 * bonds.value / cash.value) < 0.01);
  const net = netSeries(tl, worth);
  assert.equal(changeOver12(tl, net), Math.round(net[12] - net[0]));
});

test("a loan's payments this tax year, worked out from the balance and rate", () => {
  // April to September paid by 8 Oct.
  const split = debtSplit(268000, 0.0445, 1420);
  assert.equal(split.months.length, 12);
  assert.equal(split.months[0].label, "Apr");
  assert.equal(split.months.filter(x => x.interest || x.principal).length, 6);
  assert.equal(split.paid, 6 * 1420);
  assert.equal(split.interest + split.principal, split.paid);
  // The balance it fell from, less principal, is today's.
  assert.ok(split.months[0].interest > split.months[5].interest);
  assert.equal(debtSplit(268000, 0.0445, 0), null);
  assert.equal(debtSplit(268000, 0.0445, 1420, new Date(2026, 3, 20)), null);
  const { d, m } = setUp();
  assert.ok(studentLoanSplit(d, m).paid > 0);
});

test("your share of the home, and this tax year's change in it", () => {
  const { d, worth } = setUp();
  const plain = homeShare(d, worth, {});
  assert.equal(plain.share, 410000 - 268000);
  assert.equal(plain.valueChange, null);
  assert.ok(plain.principal > 0);
  const withHistory = homeShare(d, worth, { "2026-05": { cats: { home: 400000 } } });
  assert.equal(withHistory.valueChange, 10000);
  assert.equal(homeShare({ ...base, hasMortgage: "no" }, setUp({ ...base, hasMortgage: "no" }).worth, {}), null);
});

test("a month is saved once, never over, and not before anything's entered", () => {
  const { worth } = setUp();
  const first = withThisMonth({}, worth);
  assert.deepEqual(Object.keys(first), [monthKey(new Date())]);
  const snap = first["2026-10"];
  assert.equal(snap.total, worth.netWorth);
  assert.equal(snap.cats.home, 410000);
  assert.equal(snap.accts.mortgage, 268000);
  assert.equal(withThisMonth(first, worth), null);
  const empty = setUp({ salary: "40000" }).worth;
  assert.equal(withThisMonth({}, empty), null);
  const next = withThisMonth(first, worth, new Date(2026, 10, 2));
  assert.deepEqual(Object.keys(next), ["2026-10", "2026-11"]);
});

test("signing in keeps every month from both devices, the account's where both have one", () => {
  const account = { "2026-08": { total: 1 }, "2026-09": { total: 2 } };
  const device = { "2026-09": { total: 9 }, "2026-10": { total: 3 } };
  assert.deepEqual(mergeHistory(account, device), { "2026-08": { total: 1 }, "2026-09": { total: 2 }, "2026-10": { total: 3 } });
  const merged = mergeAnswers({ salary: "1", netWorthHistory: account }, { salary: "2", netWorthHistory: device });
  assert.deepEqual(Object.keys(merged.netWorthHistory).sort(), ["2026-08", "2026-09", "2026-10"]);
  assert.equal(merged.salary, "1");
  assert.deepEqual(mergeAnswers({ salary: "1" }, { netWorthHistory: device }).netWorthHistory, device);
});

test("an account's provider, from its name until Open Banking says, and its type and access to come", async () => {
  const { providerFromName } = await import("./providers.js");
  assert.equal(providerFromName("Barclays Everyday Saver").name, "Barclays");
  assert.equal(providerFromName("my natwest isa").domain, "natwest.com");
  assert.equal(providerFromName("Rainy day pot"), null);
  const d = { ...base, cashTiers: [{ amount: "5000", rate: "4", name: "Barclays Everyday Saver" }, { amount: "100", rate: "1", name: "Pot" }] };
  const { m, worth } = setUp(d);
  const facts = key => Object.fromEntries(worthGroupByKey(d, m, worth, key).facts);
  assert.equal(facts("acc-cash-0")["Provider"], "Barclays");
  assert.equal(facts("acc-cash-1")["Provider"], "Coming soon");
  assert.equal(facts("acc-cash-0")["Account type"], "Coming soon");
  assert.equal(facts("acc-premiumBonds")["Prizes won, 26/27"], "Coming soon");
  assert.equal(worth.assets.find(c => c.key === "cash").accounts.find(a => a.id === "cash-0").provider.domain, "barclays.co.uk");
});
