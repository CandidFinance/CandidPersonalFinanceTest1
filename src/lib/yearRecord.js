// The year-end record: "Your years with Candid" on Home
// (src/components/dashboard/YourYears.jsx). Each tax year's saved, against
// what was still open, by module.
//  - Saved: worked out each time from the dated changes (gainedSoFar), up
//    to 5 April for a year that's over. Never stored: the changes are the
//    record.
//  - Still open: each module's £ a year still on the table, kept in
//    `d.yearRecords` under today's tax year. CandidApp refreshes this
//    year's entry as the figures change; from 6 April it writes the next
//    year's, so last year's stays as it was on the last open before then
//    (`asOf`).
import { gainedSoFar, getModuleBreakdown, bankedChanges } from "./moduleStatus.js";
import { taxYearOf } from "./taxYear.js";

const isoDay = t => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
const sum = obj => Object.values(obj).reduce((s, v) => s + v, 0);

// Each module's £ a year still on the table: the modules Home counts in
// Still left (getModuleBreakdown's totalOpp), lump sums left out.
export function stillOpenNow(d, m, statuses) {
  return Object.fromEntries(getModuleBreakdown(d, m, statuses).modulesWithRec
    .filter(mm => !mm.amountIsLumpSum).map(mm => [mm.key, Math.round(mm.amount)]));
}

// `d.yearRecords` with this tax year's entry brought up to date, or null if
// it already is: the same figures, already dated today.
export function yearRecordPatch(d, m, statuses, now = new Date()) {
  const year = String(taxYearOf(now));
  const records = d.yearRecords || {};
  const stillOpen = stillOpenNow(d, m, statuses);
  const asOf = isoDay(now);
  const was = records[year];
  if (was && was.asOf === asOf && JSON.stringify(was.stillOpen) === JSON.stringify(stillOpen)) return null;
  return { ...records, [year]: { stillOpen, asOf } };
}

// What the changes made have saved in tax year `year` (the calendar year it
// starts in): to 5 April once it's over, else to today. `perYear`: what the
// changes still going on that day are worth a year (Home's hero Saved, for
// this year), by module too.
export function savedInYear(d, year, now = new Date()) {
  const end = new Date(year + 1, 3, 5);
  const g = gainedSoFar(d, now < end ? now : end, `${year}-04-06`);
  return { total: g.total, byModule: Object.fromEntries(g.byModule.filter(mm => mm.gained > 0).map(mm => [mm.key, mm.gained])),
    perYear: g.perYear, perYearByModule: Object.fromEntries(g.byModule.filter(mm => mm.perYear > 0).map(mm => [mm.key, mm.perYear])) };
}

// This tax year's saved so far at the end of each month (today, for this
// month), April to March, from the first month anything counted. Empty if
// nothing has yet. 1 to 5 April, the year's last days, count in March's.
export function monthsThisYear(d, now = new Date()) {
  const year = taxYearOf(now);
  const months = [];
  for (let t = new Date(year, 3, 1); t <= now && t < new Date(year + 1, 3, 1); t = new Date(t.getFullYear(), t.getMonth() + 1, 1)) {
    const monthEnd = t.getMonth() === 2 ? new Date(year + 1, 3, 5) : new Date(t.getFullYear(), t.getMonth() + 1, 0);
    const total = gainedSoFar(d, monthEnd < now ? monthEnd : now, `${year}-04-06`).total;
    if (total > 0 || months.length) months.push({ month: isoDay(t).slice(0, 7), total });
  }
  return months;
}

// One row per tax year, newest first: this one back to the first with a
// record kept or a change made (the years between count what earlier
// changes saved in them).
export function yearsWithCandid(d, now = new Date()) {
  const current = taxYearOf(now);
  const records = d.yearRecords || {};
  const changed = bankedChanges(d).map(c => taxYearOf(new Date(c.on + "T12:00:00")));
  const first = Math.min(current, ...Object.keys(records).map(Number), ...changed);
  const years = Array.from({ length: current - first + 1 }, (_, i) => current - i);
  return years.map(year => {
    const saved = savedInYear(d, year, now);
    const rec = records[year] || { stillOpen: {}, asOf: null };
    return { year, closed: year < current, saved: saved.total, savedByModule: saved.byModule,
      savedPerYear: saved.perYear, savedPerYearByModule: saved.perYearByModule,
      stillOpen: sum(rec.stillOpen), stillOpenByModule: rec.stillOpen, asOf: rec.asOf };
  });
}
