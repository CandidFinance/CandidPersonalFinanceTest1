// Coming up on Home: the next few dates that touch this user's money, nearest
// first. Pure, unit tested in comingUp.test.js; Home shows it
// (src/mobile/ComingUp.jsx).
//  - Payday, for someone employed with a salary: d.payday (set in Inputs),
//    else the 28th, said as assumed.
//  - Bank Rate decisions and Budgets (EVENTS, kept by hand), always listed:
//    Home's card for an event (OutsideEvent) shows only one at a time and can
//    be closed, so leaving one out here could leave it nowhere.
//  - The tax year's end, with the ISA allowance left once they've told us
//    what they've paid in this year.
// Information only: dates and figures, never what to do before them.

import { paydayOf, DEFAULT_PAYDAY } from "./taxTrap.js";
import { EVENTS } from "./outsideEvents.js";
import { ISA_ALLOWANCE } from "./tax.js";
import { isaUsedThisYear } from "./isa.js";
import { fmt } from "./format.js";

export const COMING_UP_COUNT = 3;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86400000;
const dayNo = (y, mo, day) => Date.UTC(y, mo, day) / DAY_MS;
const ISA_KEYS = ["isaThisYearCash", "isaThisYearSS", "isaThisYearLISA", "isaThisYearOther", "isaThisYearOtherTypes"];
const answered = v => v !== undefined && v !== null && v !== "";

function inDays(n) {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `In ${n} days`;
}

// Their next payday on or after today (the month's last day in a short month).
function nextPayday(payday, y, mo, todayNo) {
  for (let k = 0; k < 2; k++) {
    const yy = y + Math.floor((mo + k) / 12), mm = (mo + k) % 12;
    const day = Math.min(payday, new Date(yy, mm + 1, 0).getDate());
    if (dayNo(yy, mm, day) >= todayNo) return { y: yy, mo: mm, day };
  }
  return null;
}

// [{ key, mon, day, title, sub, amount? }], nearest first, at most `count`.
export function comingUp(d, { today = new Date(), events = EVENTS, count = COMING_UP_COUNT } = {}) {
  const y = today.getFullYear(), mo = today.getMonth();
  const todayNo = dayNo(y, mo, today.getDate());
  const items = [];
  const add = (key, yy, mm, day, title, sub, amount) => {
    const no = dayNo(yy, mm, day);
    items.push({ key, no, mon: MONTHS[mm], day: String(day), title, sub, ...(amount ? { amount } : {}) });
  };

  if (d.employmentStatus === "employed" && +d.salary > 0) {
    const p = nextPayday(paydayOf(d), y, mo, todayNo);
    const n = dayNo(p.y, p.mo, p.day) - todayNo;
    add("payday", p.y, p.mo, p.day, "Payday", answered(d.payday) ? inDays(n) : `${inDays(n)}, assuming the ${DEFAULT_PAYDAY}th`);
  }

  for (const e of events) {
    const [ey, em, ed] = e.date.split("-").map(Number);
    const n = dayNo(ey, em - 1, ed) - todayNo;
    if (n < 0) continue;
    add(e.id, ey, em - 1, ed, e.kind === "bankRate" ? "Bank Rate decision" : "Budget", "What it means for your figures shows here on the day");
  }

  // The tax year ends on 5 April: this year's if it's still to come.
  const endY = todayNo <= dayNo(y, 3, 5) ? y : y + 1;
  if (ISA_KEYS.some(k => answered(d[k]))) {
    const left = Math.max(0, ISA_ALLOWANCE - isaUsedThisYear(d));
    if (left > 0) add("taxYearEnd", endY, 3, 5, "Tax year ends", "ISA allowance left", fmt(left));
    else add("taxYearEnd", endY, 3, 5, "Tax year ends", "ISA allowance used in full");
  } else {
    add("taxYearEnd", endY, 3, 5, "Tax year ends", "Allowances start again on 6 April");
  }

  return items.sort((a, b) => a.no - b.no).slice(0, count).map(({ no, ...rest }) => rest);
}
