import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses, calcCandidScore, reviewedDone } from "./moduleStatus.js";

const RATES = { isaRate: 4.5, nonIsaRate: 4.6 };
const statusesFor = overrides => {
  const d = {
    selectedModules: ["cash", "investments", "pension"],
    salary: "55000", bonusAmount: "0", otherIncome: "0", dividendIncome: "0", monthlyExpenses: "2000",
    cashTiers: [], premiumBonds: "0", cashAccessType: "yes",
    hasInvestments: "no", unwrappedValue: "0", unrealisedGains: "0",
    hasPension: "yes", myContribution: "5", employerMatch: "5", pensionType: "sacrifice",
    studentLoan: "none",
    ...overrides,
  };
  return computeModuleStatuses(d, calcMetrics(d, RATES), RATES);
};

test("pension: ok when contributing at the full match with nothing else to act on", () => {
  const s = statusesFor({});
  assert.equal(s.pension.status, "ok");
  assert.equal(s.pension.impactLabel, null);
});

test("pension: a tapered allowance already exceeded is flagged, and no bonus sacrifice is suggested", () => {
  const s = statusesFor({ salary: "250000", bonusAmount: "100000", dividendIncome: "15000", myContribution: "4", employerMatch: "4" });
  assert.equal(s.pension.status, "attention");
  assert.equal(s.pension.potentialAmount, 0);
  assert.match(s.pension.impactLabel, /annual allowance/);
});

test("cash: less than a month of essential costs is critical", () => {
  const s = statusesFor({ salary: "23000", monthlyExpenses: "1500", cashTiers: [{ amount: "300", rate: "0" }] });
  assert.equal(s.cash.status, "critical");
  assert.equal(s.cash.impactLabel, "£8,700 short of your 6-month emergency fund");
});

test("cash: spending more than take-home is critical, and the gap is what's shown", () => {
  const s = statusesFor({ salary: "23000", monthlyExpenses: "1650", cashTiers: [{ amount: "300", rate: "0" }] });
  assert.equal(s.cash.status, "critical");
  assert.equal(s.cash.impactLabel, "£53 a month more going out than coming in");
});

test("cash: not working, savings are measured in months they'd last, not as spare", () => {
  const s = statusesFor({ employmentStatus: "not_working", salary: "0", monthlyExpenses: "2000", cashTiers: [{ amount: "80000", rate: "4.6" }] });
  assert.match(s.cash.impactLabel, /cover about 40 months of spending$/);
  assert.equal(s.cash.status, "ok");
});

test("cash: any other shortfall against the buffer needs attention", () => {
  const s = statusesFor({ salary: "26000", monthlyExpenses: "1300", cashTiers: [{ amount: "1500", rate: "0" }] });
  assert.equal(s.cash.status, "attention");
});

test("investments: unused ISA allowance isn't flagged with nothing to fill it", () => {
  const s = statusesFor({ salary: "23000", monthlyExpenses: "1650", cashTiers: [{ amount: "300", rate: "0" }] });
  assert.equal(s.investments.status, "ok");
  assert.equal(s.investments.impactLabel, null);
});

test("investments: unused ISA allowance is flagged when investments outside an ISA could fill it", () => {
  const s = statusesFor({ selectedModules: ["investments"], salary: "30000", monthlyExpenses: "2500", hasInvestments: "yes", unwrappedValue: "5000" });
  assert.equal(s.investments.status, "attention");
  assert.equal(s.investments.impactLabel, "£20,000 of this year's ISA allowance unused, lost on 5 April");
});

test("score: not knowing your pension costs points, but less than a critical gap", () => {
  assert.equal(calcCandidScore({ pension: { status: "ok" } }), 100);
  assert.equal(calcCandidScore({ pension: { status: "unknown" } }), 92);
  assert.equal(calcCandidScore({ pension: { status: "critical" } }), 82);
  assert.equal(calcCandidScore({ pension: { status: "na" } }), 100);
});

test("cash: with under £50 left, the reason it needs action is given", () => {
  const short = statusesFor({ salary: "50000", monthlyExpenses: "1500", cashTiers: [{ amount: "3000", rate: "5" }] });
  assert.ok(short.cash.amount < 50);
  assert.equal(short.cash.reason, "Below your emergency fund");
  const lots = statusesFor({ monthlyExpenses: "1000", cashTiers: [{ amount: "20000", rate: "5" }] });
  assert.ok(lots.cash.amount < 50);
  assert.equal(lots.cash.reason, "Over twice your emergency fund");
  assert.equal(statusesFor({ cashTiers: [{ amount: "20000", rate: "0" }] }).cash.reason, null);
});

test("reviewedDone: reviewed with under £50 left shows as done, whatever else is open", () => {
  assert.equal(reviewedDone({ status: "attention", amount: 0 }, true), true);
  assert.equal(reviewedDone({ status: "attention", amount: 0 }, false), false);
  assert.equal(reviewedDone({ status: "attention", amount: 120 }, true), false);
  assert.equal(reviewedDone({ status: "unknown", amount: 0 }, true), false);
  assert.equal(reviewedDone({ status: "ok", amount: 0, elsewhere: "taxTrap" }, true), false);
});
