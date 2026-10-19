import test from "node:test";
import assert from "node:assert/strict";
import { childcareSupport, nationOf, FUNDED_HOURS_VALUE } from "./childcare.js";
import { calcMetrics } from "./metrics.js";

const parent = { employmentStatus: "employed", salary: "104000", ukNation: "england", kidsPreschool: "1", kidsSchool: "0", childcareMonthly: "1500", partnerOver100k: "no",
  hasPension: "yes", myContribution: "0", employerMatch: "0" };
const run = d => childcareSupport(d, calcMetrics(d));

test("the funded hours: 1,140 hours at Coram's average price", () => {
  assert.equal(FUNDED_HOURS_VALUE, 8290); // 30 x 38 x £7.27
});

test("England, £104k, a toddler: Tax-Free Childcare and the hours lost, and a £4,000 pension payment gets them back", () => {
  const c = run(parent);
  assert.equal(c.state, "lost");
  assert.equal(c.tfc, 2000); // 20% of £18,000, capped at £2,000
  assert.equal(c.hours, 8290);
  assert.equal(c.atStake, 10290);
  assert.equal(c.payInNeeded, 4000);
  assert.equal(c.recoverable, true);
});

test("Tax-Free Childcare is 20% of the bill under the cap; not sure of the bill counts preschool children at the cap", () => {
  assert.equal(run({ ...parent, childcareMonthly: "500" }).tfc, 1200);
  assert.equal(run({ ...parent, kidsPreschool: "1", kidsSchool: "1", childcareMonthly: "" }).tfc, 2000);
  assert.equal(run({ ...parent, kidsPreschool: "2", childcareMonthly: "3000" }).tfc, 4000);
});

test("by nation: Scotland and Wales have no hours at stake; Tax-Free Childcare is UK-wide", () => {
  for (const ukNation of ["scotland", "wales", "ni"]) {
    const c = run({ ...parent, ukNation });
    assert.equal(c.hours, 0, ukNation);
    assert.equal(c.tfc, 2000, ukNation);
  }
  assert.equal(nationOf({ scottishTaxpayer: "yes" }), "scotland");
  assert.equal(nationOf({ scottishTaxpayer: "no" }), null);
});

test("a partner over £100,000: lost whatever they earn; nothing to recover", () => {
  const c = run({ ...parent, salary: "60000", partnerOver100k: "yes" });
  assert.equal(c.state, "partner");
  assert.equal(c.recoverable, false);
});

test("near the line, fine below it, and not working", () => {
  assert.equal(run({ ...parent, salary: "95000" }).state, "near");
  assert.equal(run({ ...parent, salary: "95000" }).headroom, 5000);
  assert.equal(run({ ...parent, salary: "60000" }).state, "fine");
  assert.equal(run({ ...parent, employmentStatus: "not_working", salary: "" }).state, "notWorking");
  assert.equal(run({ ...parent, kidsPreschool: "0", kidsSchool: "0" }), null);
});

test("eligible, paying for childcare and not using Tax-Free Childcare: what it would add", () => {
  assert.equal(run({ ...parent, salary: "60000", tfcClaiming: "no", childcareMonthly: "800" }).unclaimed, 1920);
  assert.equal(run({ ...parent, salary: "60000", tfcClaiming: "yes" }).unclaimed, 0);
  assert.equal(run({ ...parent, tfcClaiming: "no" }).unclaimed, 0); // over £100k: not eligible
});

test("over £100,000 by more than this year's pension allowance: lost, not recoverable", () => {
  const c = run({ ...parent, salary: "200000", myContribution: "20", employerMatch: "10" });
  assert.equal(c.state, "lost");
  assert.equal(c.recoverable, false);
});
