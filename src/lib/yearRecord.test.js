import test from "node:test";
import assert from "node:assert/strict";
import { stillOpenNow, yearRecordPatch, savedInYear, monthsThisYear, yearsWithCandid } from "./yearRecord.js";
import { computeModuleStatuses, baselinePatch, getModuleBreakdown } from "./moduleStatus.js";
import { calcMetrics } from "./metrics.js";

const d = { age: "32", salary: "45000", selectedModules: ["pension"], hasPension: "yes", pensionStatus: "yes", myContribution: "3", employerMatch: "5", potValue: "30000", pensionType: "relief" };
const m = calcMetrics(d);
const statuses = computeModuleStatuses(d, m);
// £1,200 a year on pension, made 6 July 2026.
const made = { ...d, moduleBaselines: { pension: { amount: 0, answers: "[]", banked: 1200, changes: [{ perYear: 1200, on: "2026-07-06" }] } } };
const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;

test("saved in a tax year: by the day, stopping at 5 April once it's over", () => {
  const atEnd = Math.round(1200 * days("2026-07-06", "2027-04-05") / 365);
  assert.equal(savedInYear(made, 2026, new Date(2027, 3, 5)).total, atEnd);
  assert.equal(savedInYear(made, 2026, new Date(2028, 0, 1)).total, atEnd);
  assert.deepEqual(savedInYear(made, 2026, new Date(2028, 0, 1)).byModule, { pension: atEnd });
  // The £ a year: what Home's hero calls Saved.
  const soFar = savedInYear(made, 2026, new Date(2026, 9, 8));
  assert.equal(soFar.perYear, 1200);
  assert.deepEqual(soFar.perYearByModule, { pension: 1200 });
  // The next year counts from 6 April.
  assert.equal(savedInYear(made, 2027, new Date(2027, 3, 15)).total, Math.round(1200 * 10 / 365));
  // Before the change: nothing.
  assert.equal(savedInYear(made, 2025, new Date(2028, 0, 1)).total, 0);
  assert.deepEqual(savedInYear(made, 2025, new Date(2028, 0, 1)).byModule, {});
});

test("saved in a tax year: a change that's ended counts only to its end", () => {
  const ended = { moduleBaselines: { taxTrap: { amount: 0, answers: "[]", banked: 3650, changes: [{ perYear: 3650, on: "2026-10-01", until: "2026-10-10" }] } } };
  assert.equal(savedInYear(ended, 2026, new Date(2027, 3, 5)).total, 100);
});

test("still open: the modules in Home's Still left, by module", () => {
  const open = stillOpenNow(d, m, statuses);
  assert.equal(Object.values(open).reduce((s, v) => s + v, 0), Math.round(getModuleBreakdown(d, m, statuses).totalOpp));
  assert.ok(open.pension > 0);
});

test("year record: this tax year's entry kept up to date, last year's left as it was", () => {
  const now = new Date(2026, 9, 8);
  const records = yearRecordPatch({ ...d, inputsTaxYear: 2026 }, m, statuses, now);
  assert.deepEqual(records, { 2026: { stillOpen: stillOpenNow(d, m, statuses), asOf: "2026-10-08" } });
  // Nothing changed the same day: nothing to write.
  assert.equal(yearRecordPatch({ ...d, inputsTaxYear: 2026, yearRecords: records }, m, statuses, now), null);
  // A new day: written again with its date.
  assert.equal(yearRecordPatch({ ...d, inputsTaxYear: 2026, yearRecords: records }, m, statuses, new Date(2026, 9, 9))[2026].asOf, "2026-10-09");
  // From 6 April only the new year is written, even in a session that
  // opened before it (inputs not yet rolled).
  const next = yearRecordPatch({ ...d, inputsTaxYear: 2026, yearRecords: records }, m, statuses, new Date(2027, 3, 7));
  assert.deepEqual(next[2026], records[2026]);
  assert.equal(next[2027].asOf, "2027-04-07");
});

test("this tax year month by month: cumulative, from the first month anything counted, to today", () => {
  const months = monthsThisYear(made, new Date(2026, 9, 8));
  assert.deepEqual(months.map(x => x.month), ["2026-07", "2026-08", "2026-09", "2026-10"]);
  assert.equal(months[0].total, Math.round(1200 * days("2026-07-06", "2026-07-31") / 365));
  assert.equal(months[3].total, savedInYear(made, 2026, new Date(2026, 9, 8)).total);
  assert.ok(months.every((x, i) => !i || x.total >= months[i - 1].total));
  assert.deepEqual(monthsThisYear(d, new Date(2026, 9, 8)), []);
  // 1 to 5 April, the year's last days: still April to March, March to today.
  const end = monthsThisYear(made, new Date(2027, 3, 3));
  assert.equal(end[end.length - 1].month, "2027-03");
  assert.equal(end[end.length - 1].total, savedInYear(made, 2026, new Date(2027, 3, 3)).total);
});

test("years with Candid: each recorded year and this one, newest first", () => {
  const withPast = { ...made, yearRecords: { 2026: { stillOpen: { pension: 500, cash: 200 }, asOf: "2027-03-30" } } };
  const rows = yearsWithCandid(withPast, new Date(2027, 4, 1));
  assert.deepEqual(rows.map(r => [r.year, r.closed]), [[2027, false], [2026, true]]);
  assert.equal(rows[1].stillOpen, 700);
  assert.equal(rows[1].asOf, "2027-03-30");
  assert.equal(rows[1].saved, savedInYear(made, 2026, new Date(2027, 4, 1)).total);
  assert.deepEqual(rows[0].stillOpenByModule, {});
  // Nothing recorded yet: just this year.
  assert.deepEqual(yearsWithCandid(d, new Date(2026, 9, 8)).map(r => r.year), [2026]);
  // A year with a change but no record is listed, and so is each year since.
  const early = yearsWithCandid(made, new Date(2028, 4, 1));
  assert.deepEqual(early.map(r => r.year), [2028, 2027, 2026]);
  assert.equal(early[1].saved, Math.round(1200 * 366 / 365)); // 29 Feb 2028
});

test("baselines from a fresh profile carry no saved yet", () => {
  const fresh = { ...d, moduleBaselines: baselinePatch(d, statuses) };
  assert.equal(savedInYear(fresh, 2026, new Date(2026, 9, 8)).total, 0);
});
