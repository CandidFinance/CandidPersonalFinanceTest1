import { test } from "node:test";
import assert from "node:assert/strict";
import { runWaterfall, waterfallInputs, checkEmployerMatch, checkHighInterestDebt, checkEmergencyFund, checkIsaAllowance, ISA_ALLOWANCE } from "./waterfall.js";
import { calcMetrics } from "./metrics.js";

const byKey = checks => Object.fromEntries(checks.map(c => [c.key, c]));

test("checks run in the spec's order", () => {
  const checks = runWaterfall({ buyers: [], debts: [], emergency: { known: false } });
  assert.deepEqual(checks.map(c => c.key), ["match", "debt", "emergency", "isa"]);
});

test("employer match: contributing below the cap flags the unclaimed amount", () => {
  const r = checkEmployerMatch({ who: "you", salary: 50000, pension: { known: true, myPct: 3, employerPct: 5 } });
  assert.equal(r.state, "attention");
  assert.equal(r.unclaimedPct, 2);
  assert.equal(r.unclaimedAnnual, 1000);
});

test("employer match: a zero employer match has nothing to claim", () => {
  const r = checkEmployerMatch({ who: "you", salary: 50000, pension: { known: true, myPct: 0, employerPct: 0 } });
  assert.equal(r.state, "ok");
  assert.equal(r.unclaimedAnnual, 0);
});

test("employer match: contributing at or above the cap is ok", () => {
  assert.equal(checkEmployerMatch({ who: "you", salary: 50000, pension: { known: true, myPct: 5, employerPct: 5 } }).state, "ok");
  assert.equal(checkEmployerMatch({ who: "you", salary: 50000, pension: { known: true, myPct: 8, employerPct: 5 } }).state, "ok");
});

test("employer match: unknown figures are missing, not ok", () => {
  assert.equal(checkEmployerMatch({ who: "you", salary: 50000, pension: { known: false } }).state, "missing");
});

test("debt: no debts at all is ok", () => {
  const r = checkHighInterestDebt([]);
  assert.equal(r.state, "ok");
  assert.equal(r.highInterestBalance, 0);
});

test("debt: no debts input is missing, not ok", () => {
  assert.equal(checkHighInterestDebt(undefined).state, "missing");
});

test("debt: only debt above 6% APR is flagged", () => {
  const r = checkHighInterestDebt([
    { balance: 3000, apr: 22.9 },
    { balance: 8000, apr: 6 },
    { balance: 5000, apr: 4.5 },
  ]);
  assert.equal(r.state, "attention");
  assert.equal(r.highInterest.length, 1);
  assert.equal(r.highInterestBalance, 3000);
});

test("debt: a cleared high-rate debt isn't flagged", () => {
  assert.equal(checkHighInterestDebt([{ balance: 0, apr: 29.9 }]).state, "ok");
});

test("emergency fund: below 3 months is flagged with the shortfall to 3 months", () => {
  const r = checkEmergencyFund({ known: true, cash: 4000, monthlyExpenses: 2000, targetMonths: 6 });
  assert.equal(r.state, "attention");
  assert.equal(r.months, 2);
  assert.equal(r.shortfall, 2000);
});

test("emergency fund: exactly 3 months is ok", () => {
  assert.equal(checkEmergencyFund({ known: true, cash: 6000, monthlyExpenses: 2000, targetMonths: 3 }).state, "ok");
});

test("emergency fund: above 3 months but under the user's own target is ok, and noted", () => {
  const r = checkEmergencyFund({ known: true, cash: 8000, monthlyExpenses: 2000, targetMonths: 9 });
  assert.equal(r.state, "ok");
  assert.equal(r.belowOwnTarget, true);
});

test("emergency fund: missing cash or expenses can't be checked", () => {
  assert.deepEqual(checkEmergencyFund({ known: false }), { state: "missing", missing: "cash" });
  assert.deepEqual(checkEmergencyFund({ known: true, cash: 5000, monthlyExpenses: 0 }), { state: "missing", missing: "expenses" });
});

test("ISA: a fully used allowance is ok", () => {
  const r = checkIsaAllowance({ who: "you", isa: { known: true, usedThisYear: ISA_ALLOWANCE } });
  assert.equal(r.state, "ok");
  assert.equal(r.headroom, 0);
});

test("ISA: unused allowance is flagged with the headroom", () => {
  const r = checkIsaAllowance({ who: "you", isa: { known: true, usedThisYear: 8000 } });
  assert.equal(r.state, "attention");
  assert.equal(r.headroom, 12000);
});

test("joint buyers: match and ISA are checked for each person separately", () => {
  const checks = byKey(runWaterfall({
    buyers: [
      { who: "you", salary: 60000, pension: { known: true, myPct: 5, employerPct: 5 }, isa: { known: true, usedThisYear: 20000 } },
      { who: "partner", salary: 40000, pension: { known: true, myPct: 2, employerPct: 6 }, isa: { known: true, usedThisYear: 5000 } },
    ],
    debts: [],
    emergency: { known: true, cash: 12000, monthlyExpenses: 2000, targetMonths: 6 },
  }));
  assert.deepEqual(checks.match.people.map(p => [p.who, p.state]), [["you", "ok"], ["partner", "attention"]]);
  assert.equal(checks.match.people[1].unclaimedAnnual, 1600);
  assert.equal(checks.match.state, "attention");
  assert.deepEqual(checks.isa.people.map(p => [p.who, p.state, p.headroom]), [["you", "ok", 0], ["partner", "attention", 15000]]);
  assert.equal(checks.isa.state, "attention");
});

test("joint buyers: one buyer missing figures shows the check as missing when the other is ok", () => {
  const checks = byKey(runWaterfall({
    buyers: [
      { who: "you", salary: 60000, pension: { known: true, myPct: 5, employerPct: 5 }, isa: { known: true, usedThisYear: 20000 } },
      { who: "partner", salary: 40000, pension: { known: false }, isa: { known: false } },
    ],
    debts: [],
    emergency: { known: true, cash: 12000, monthlyExpenses: 2000 },
  }));
  assert.equal(checks.match.state, "missing");
  assert.equal(checks.isa.state, "missing");
});

// ── waterfallInputs: reading Candid's own saved inputs ─────────────────────

const baseInputs = {
  selectedModules: ["cash", "investments", "pension"],
  salary: "50000", monthlyExpenses: "2000",
  cashTiers: [{ amount: "9000", rate: "4" }], premiumBonds: "1000",
  hasPension: "yes", pensionUnknown: false, myContribution: "3", employerMatch: "5",
  isaThisYearCash: "4000", isaThisYearSS: "6000",
};

test("waterfallInputs: reads match, ISA and emergency figures from existing inputs", () => {
  const d = baseInputs;
  const m = calcMetrics(d);
  const checks = byKey(runWaterfall(waterfallInputs(d, m)));
  assert.equal(checks.match.people[0].unclaimedAnnual, m.missedMatch);
  assert.equal(checks.isa.people[0].headroom, m.isaHeadroom);
  assert.equal(checks.emergency.months, 5);
  assert.equal(checks.debt.state, "missing");
});

test("waterfallInputs: pension not chosen and no match entered is missing", () => {
  const d = { ...baseInputs, selectedModules: ["cash"], hasPension: "no", myContribution: "", employerMatch: "" };
  const checks = byKey(runWaterfall(waterfallInputs(d, calcMetrics(d))));
  assert.equal(checks.match.state, "missing");
});

test("waterfallInputs: a match entered on the Property screen counts without the Pension module", () => {
  const d = { ...baseInputs, selectedModules: ["cash"], hasPension: "no", myContribution: "4", employerMatch: "4" };
  const checks = byKey(runWaterfall(waterfallInputs(d, calcMetrics(d))));
  assert.equal(checks.match.state, "ok");
});

test("waterfallInputs: chose Pension and said no pension means nothing to claim", () => {
  const d = { ...baseInputs, hasPension: "no", myContribution: "", employerMatch: "" };
  const r = byKey(runWaterfall(waterfallInputs(d, calcMetrics(d)))).match.people[0];
  assert.equal(r.state, "ok");
  assert.equal(r.noPension, true);
});

test("waterfallInputs: 'not sure' about pension with no match is missing", () => {
  const d = { ...baseInputs, pensionUnknown: true, hasPension: "no", myContribution: "", employerMatch: "" };
  assert.equal(byKey(runWaterfall(waterfallInputs(d, calcMetrics(d)))).match.state, "missing");
});

test("waterfallInputs: ISA and emergency fund are missing when their modules weren't chosen", () => {
  const d = { ...baseInputs, selectedModules: ["pension"] };
  const checks = byKey(runWaterfall(waterfallInputs(d, calcMetrics(d))));
  assert.equal(checks.isa.state, "missing");
  assert.equal(checks.emergency.state, "missing");
});

test("waterfallInputs: buying together adds the partner from the Property inputs", () => {
  const d = {
    ...baseInputs, propertyBuyingMode: "together",
    partnerSalary: "40000", partnerMyContribution: "2", partnerEmployerMatch: "6", partnerIsaThisYear: "20000",
  };
  const checks = byKey(runWaterfall(waterfallInputs(d, calcMetrics(d))));
  assert.deepEqual(checks.match.people.map(p => p.who), ["you", "partner"]);
  assert.equal(checks.match.people[1].unclaimedAnnual, 1600);
  assert.equal(checks.isa.people[1].state, "ok");
});

test("waterfallInputs: buying alone ignores leftover partner inputs", () => {
  const d = { ...baseInputs, propertyBuyingMode: "alone", partnerSalary: "40000", partnerEmployerMatch: "6" };
  assert.equal(waterfallInputs(d, calcMetrics(d)).buyers.length, 1);
});

test("waterfallInputs: a saved debts list is passed through to the debt check", () => {
  const d = { ...baseInputs, debts: [{ balance: 2000, apr: 19.9 }] };
  assert.equal(byKey(runWaterfall(waterfallInputs(d, calcMetrics(d)))).debt.state, "attention");
});
