import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { worthAccounts, worthGroups, worthGroupByKey } from "./netWorthView.js";
import { editFieldsOf, editPatch, editProblem, removePatch, hidePatch } from "./worthEdit.js";

const base = {
  age: "34", employmentStatus: "employed", salary: "62000", monthlyExpenses: "2200",
  cashTiers: [{ amount: "12000", rate: "4.25", name: "Easy access" }, { amount: "8000", rate: "4.6" }, { amount: "500", rate: "0" }],
  premiumBonds: "4500",
  isaPrevSS: "15000", isaThisYearSS: "2100", isaPrevLISA: "6000", isaThisYearLISA: "1000",
  unwrappedValue: "14300", unrealisedGains: "3100",
  potValue: "71200", potValue2: "17200",
  studentLoan: "plan2", loanBalance: "41200",
  hasPersonalLoan: "yes", personalLoanBalance: "3000", personalLoanRate: "7.9", personalLoanMonthly: "150",
};
const worthOf = d => worthAccounts(d, calcMetrics(d));
const acct = (d, id) => worthOf(d).accounts.find(a => a.id === id);
const apply = (d, patch) => ({ ...d, ...patch });
const values = (d, id) => Object.fromEntries(editFieldsOf(d, acct(d, id)).fields.map(f => [f.key, f.value]));

test("a cash account's name, balance and rate edit its own tier", () => {
  const a = acct(base, "cash-1");
  assert.deepEqual(editFieldsOf(base, a).fields.map(f => f.key), ["name", "amount", "rate"]);
  const d = apply(base, editPatch(base, a, { ...values(base, "cash-1"), amount: 9500, rate: 5.1 }));
  assert.equal(d.cashTiers[1].amount, "9500");
  assert.equal(d.cashTiers[1].rate, "5.1");
  assert.equal(d.cashTiers[0].amount, "12000");
  assert.equal(acct(d, "cash-1").value, 9500);
});

test("an investment outside an ISA: its value and gains, and gains can't pass the value", () => {
  const a = acct(base, "unwrapped");
  const d = apply(base, editPatch(base, a, { amount: 16000, gains: 4000 }));
  assert.equal(acct(d, "unwrapped").value, 16000);
  assert.equal(d.unrealisedGains, "4000");
  assert.ok(editProblem(base, a, { amount: 1000, gains: 2000 }));
});

test("an ISA's value keeps what's paid in this year, and earlier years take the rest", () => {
  const a = acct(base, "isa-ss");
  const d = apply(base, editPatch(base, a, { value: 20000, paid: 2100 }));
  assert.equal(d.isaPrevSS, "17900");
  assert.equal(acct(d, "isa-ss").value, 20000);
  assert.ok(editProblem(base, a, { value: 1000, paid: 2100 }));
});

test("ISAs given as one earlier total: only paid in is offered, so the total isn't lost", () => {
  const old = { ...base, isaPrevSS: "", isaPrevLISA: "", isaPreviousBalance: "20000" };
  assert.deepEqual(editFieldsOf(old, acct(old, "isa-ss")).fields.map(f => f.key), ["paid"]);
});

test("the student loan's plan rate stays unsaved when left as shown", () => {
  const a = acct(base, "studentLoan");
  assert.deepEqual(editPatch(base, a, values(base, "studentLoan")), { loanBalance: "41200" });
  assert.deepEqual(editPatch(base, a, { ...values(base, "studentLoan"), rate: 5 }), { loanBalance: "41200", studentLoanRate: "5" });
});

test("removing a cash account takes its tier out, and hidden accounts after it keep their place", () => {
  const d0 = { ...base, worthHidden: ["cash-2", "cash-0"] };
  const d = apply(d0, removePatch(d0, acct(d0, "cash-0")));
  assert.equal(d.cashTiers.length, 2);
  assert.equal(d.cashTiers[0].amount, "8000");
  assert.deepEqual(d.worthHidden, ["cash-1"]);
});

test("removing an account clears its answers; a loan is answered no", () => {
  assert.equal(apply(base, removePatch(base, acct(base, "pension-other"))).potValue2, "0");
  assert.equal(apply(base, removePatch(base, acct(base, "personalLoan"))).hasPersonalLoan, "no");
  const d = apply(base, removePatch(base, acct(base, "studentLoan")));
  assert.equal(worthOf(d).accounts.some(a => a.id === "studentLoan"), false);
});

test("a hidden account leaves its row for Hidden at the foot, and the tile still adds up", () => {
  const d = apply(base, hidePatch(base, "pension-other", true));
  const m = calcMetrics(d), worth = worthAccounts(d, m);
  for (const by of ["type", "account", "access"]) {
    const { assets } = worthGroups(d, m, worth, by);
    assert.equal(assets.reduce((s, g) => s + g.value, 0), worth.assetsTotal, by);
    const last = assets[assets.length - 1];
    assert.equal(last.key, "hidden-assets", by);
    assert.deepEqual(last.accounts.map(a => a.id), ["pension-other"], by);
  }
  // Its own page is still there, from the Hidden row.
  assert.equal(worthGroupByKey(d, m, worth, "acc-pension-other").accounts[0].id, "pension-other");
  assert.deepEqual(apply(d, hidePatch(d, "pension-other", false)).worthHidden, []);
});

test("removing a cash account moves later accounts' saved months with them", () => {
  const d0 = { ...base, netWorthHistory: { "2026-08": { total: 1, cats: {}, accts: { "cash-0": 11000, "cash-1": 7000, "cash-2": 400 } } } };
  const d = apply(d0, removePatch(d0, acct(d0, "cash-0")));
  assert.deepEqual(d.netWorthHistory["2026-08"].accts, { "cash-0": 7000, "cash-1": 400 });
});
