import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses, calcCandidScore } from "./moduleStatus.js";

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
  const s = statusesFor({ salary: "23000", monthlyExpenses: "1650", cashTiers: [{ amount: "300", rate: "0" }] });
  assert.equal(s.cash.status, "critical");
  assert.equal(s.cash.impactLabel, "£9,600 short of your 6-month emergency fund");
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
  assert.equal(s.investments.impactLabel, "£20,000 ISA headroom unused");
});

test("score: not knowing your pension costs points, but less than a critical gap", () => {
  assert.equal(calcCandidScore({ pension: { status: "ok" } }), 100);
  assert.equal(calcCandidScore({ pension: { status: "unknown" } }), 92);
  assert.equal(calcCandidScore({ pension: { status: "critical" } }), 82);
  assert.equal(calcCandidScore({ pension: { status: "na" } }), 100);
});
