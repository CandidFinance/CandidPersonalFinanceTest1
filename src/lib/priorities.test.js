import { test } from "node:test";
import assert from "node:assert/strict";
import { whatToDoFirst, scoreHeadline, onTrackModules } from "./priorities.js";
import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses, getModuleSummary, isOnTrack, onTrackKeys, droppedOffTrack, MODULE_META, ON_TRACK_LINE } from "./moduleStatus.js";

const profile = {
  selectedModules: ["cash", "pension"], salary: "45000", monthlyExpenses: "2000",
  cashTiers: [{ amount: "30000", rate: "1" }], hasPension: "yes", myContribution: "3", employerMatch: "5",
};
const run = d => { const m = calcMetrics(d); return { d, m, statuses: computeModuleStatuses(d, m) }; };

test("what to do first: modules with money to act on, largest first, each with its own line", () => {
  const { d, m, statuses } = run(profile);
  const list = whatToDoFirst(d, m, statuses);
  assert.ok(list.length > 0);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].amount >= list[i].amount);
  for (const p of list) assert.equal(p.line, getModuleSummary(MODULE_META.find(mm => mm.key === p.key), d, m, statuses, null).summary);
  assert.ok(list.some(p => p.key === "pension" && /employer match left on the table/.test(p.line)));
});

test("cash's £ figure comes with its own explanation, an access concern after it", () => {
  // £14,000 at 1% against the default six-month emergency fund (£12,000):
  // enough, not too much, but it could earn more.
  const { statuses } = run({ ...profile, cashTiers: [{ amount: "14000", rate: "1" }], cashAccessType: "partial" });
  assert.match(statuses.cash.impactLabel, /^£[\d,]+\/yr lost to low savings rates. Some of your savings may not be reachable quickly$/);
});

test("the headline names the biggest win, or says all is on track", () => {
  assert.equal(scoreHeadline([{ title: "Pension", amount: 900 }]), "Most left on the table: Pension, £900 a year.");
  assert.equal(scoreHeadline([]), "You're on track across the modules you've answered.");
});

test("a module's status and line come from the code, never a report", () => {
  const { d, m, statuses } = run(profile);
  const cash = MODULE_META.find(mm => mm.key === "cash");
  const fromCode = getModuleSummary(cash, d, m, statuses, null);
  const withReport = getModuleSummary(cash, d, m, statuses, { modules: { cash: { status: "ok", summary: "All fine." } } });
  assert.deepEqual(withReport, fromCode);
});

test("modules with nothing to act on read as on track", () => {
  const { d, m, statuses } = run({ ...profile, myContribution: "5" });
  // Paying in enough to get the whole employer match, on £45,000: on track.
  const pension = getModuleSummary(MODULE_META.find(mm => mm.key === "pension"), d, m, statuses, null);
  assert.equal(pension.status, "ok");
  assert.equal(pension.summary, ON_TRACK_LINE);
  assert.ok(onTrackModules(d, m, statuses).includes("Pension"));
});

test("on track only with under £50 a year left, however much has been banked", () => {
  const { d, m, statuses } = run(profile);
  // Employer match still missed, with a change banked: not on track.
  const acted = { ...d, moduleBaselines: { pension: { amount: 900, answers: "", banked: 300 } } };
  assert.ok(!onTrackModules(acted, m, statuses).includes("Pension"));
  // "ok" with £50+ left isn't on track; under £50 is.
  assert.equal(isOnTrack({ status: "ok", amount: 150 }), false);
  assert.equal(isOnTrack({ status: "ok", amount: 49 }), true);
  // A status from the £ alone (Student loan) is on track under the floor;
  // one with reasons that carry no £ isn't.
  assert.equal(isOnTrack({ status: "attention", amount: 30, amountOnly: true }), true);
  assert.equal(isOnTrack({ status: "attention", amount: 30 }), false);
  assert.equal(isOnTrack({ status: "attention", amount: 0 }), false);
  assert.equal(isOnTrack({ status: "ok", amount: 0, elsewhere: "taxTrap" }), false);
});

test("a module that was on track and isn't now is the one whose reviewed tick goes", () => {
  const onTrack = run({ ...profile, myContribution: "5" });
  const short = run(profile);
  const before = onTrackKeys(onTrack.d, onTrack.m, onTrack.statuses);
  const after = onTrackKeys(short.d, short.m, short.statuses);
  assert.ok(before.includes("pension"));
  assert.deepEqual(droppedOffTrack(before, after), ["pension"]);
  // Nothing recorded yet: nothing dropped.
  assert.deepEqual(droppedOffTrack(undefined, after), []);
});
