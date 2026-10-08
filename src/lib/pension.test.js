import { test } from "node:test";
import assert from "node:assert/strict";
import { calcMetrics } from "./metrics.js";
import { calcPensionTaperSaving, calcAnnualAllowanceRoom, calcBonusSacrificePotential } from "./pension.js";

const person = overrides => ({
  salary: "0", bonusAmount: "0", otherIncome: "0", dividendIncome: "0", monthlyExpenses: "2000",
  hasPension: "yes", myContribution: "5", employerMatch: "5", pensionType: "sacrifice",
  studentLoan: "none", cashTiers: [],
  ...overrides,
});

// £118k salary + £25k bonus, 8% sacrifice: £133,560 adjusted net income
const bonusEarner = person({ salary: "118000", bonusAmount: "25000", myContribution: "8", employerMatch: "8" });
// £250k + £100k bonus + £15k dividends: Annual Allowance tapered to the £10k floor
const veryHighEarner = person({ salary: "250000", bonusAmount: "100000", dividendIncome: "15000", myContribution: "4", employerMatch: "4" });

test("the bonus counts toward adjusted net income and the tax band", () => {
  const m = calcMetrics(bonusEarner);
  assert.equal(m.adjustedNetIncome, 133560);
  assert.equal(m.taxBandLabel, "additional");
});

test("the bonus is left out of the monthly surplus", () => {
  const withBonus = calcMetrics(bonusEarner);
  const withoutBonus = calcMetrics({ ...bonusEarner, bonusAmount: "0" });
  assert.equal(withBonus.monthlySurplus, withoutBonus.monthlySurplus);
});

test("taper: inside £100k–£125,140, sacrifice back to £100k at an effective 60%", () => {
  const t = calcPensionTaperSaving(calcMetrics(person({ salary: "114000" })));
  assert.equal(t.inTaper, true);
  assert.equal(t.recoverable, true);
  assert.equal(t.taperSacrificeNeeded, 8300);
  assert.equal(t.taperTaxSaving, 4980);
  assert.equal(t.taperTotalSaving, 4980 + 166);
});

test("taper: above £125,140, recovery saves 45% on the top slice and 60% beneath it", () => {
  const t = calcPensionTaperSaving(calcMetrics(bonusEarner));
  assert.equal(t.aboveTaper, true);
  assert.equal(t.recoverable, true);
  assert.equal(t.taperSacrificeNeeded, 33560);
  assert.equal(t.taperTaxSaving, 18873); // £8,420 at 45% + £25,140 at 60%
  assert.equal(t.taperTotalSaving, 18873 + 671);
});

test("taper: not recoverable when the sacrifice won't fit in the Annual Allowance room", () => {
  const t = calcPensionTaperSaving(calcMetrics(bonusEarner), 10000);
  assert.equal(t.recoverable, false);
});

test("Annual Allowance room: tapered allowance already exceeded by regular contributions", () => {
  const aa = calcAnnualAllowanceRoom(veryHighEarner, calcMetrics(veryHighEarner));
  assert.equal(aa.approxAA, 10000);
  assert.equal(aa.currentInputs, 20000);
  assert.equal(aa.room, 0);
  assert.equal(aa.excess, 10000);
});

test("bonus sacrifice: nothing to suggest when there's no allowance room", () => {
  const b = calcBonusSacrificePotential(veryHighEarner, calcMetrics(veryHighEarner));
  assert.equal(b.standalone, 0);
  assert.equal(b.beyondTaper, 0);
});

test("bonus sacrifice: valued band by band, and not double counted with the taper recovery", () => {
  const b = calcBonusSacrificePotential(bonusEarner, calcMetrics(bonusEarner));
  // £133,560 → £108,560: £8,420 at 45%, £16,580 at 60%
  assert.equal(b.standalone, 13737);
  // the whole bonus is already inside the £33,560 taper recovery
  assert.equal(b.beyondTaper, 0);
});

test("tax-free cash: 25% of the pot, capped at £268,275", async () => {
  const { calcTaxFreeCash, pastRetirementAge, calcPensionGrowthTrajectory } = await import("./pension.js");
  assert.deepEqual(calcTaxFreeCash({ potValue: "1000000" }), { pot: 1000000, quarter: 250000, taxFree: 250000, capped: false, overCap: 0 });
  assert.deepEqual(calcTaxFreeCash({ potValue: "1100000" }), { pot: 1100000, quarter: 275000, taxFree: 268275, capped: true, overCap: 6725 });
  assert.equal(pastRetirementAge({ age: "69" }), true);
  assert.equal(pastRetirementAge({ age: "69", retirementAge: "70" }), false);
  // No growth chart "to age 65" for a 69-year-old.
  const d = person({ age: "69", potValue: "1100000", myContribution: "0", employerMatch: "0" });
  assert.equal(calcPensionGrowthTrajectory(d, calcMetrics(d)).showTrajectory, false);
});
