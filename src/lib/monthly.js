// The monthly check-in: each subscriber's email at the start of the month,
// worked out on their own saved figures the same way the app does, with
// nothing written by hand. Pure, unit tested in monthly.test.js;
// api/alerts.js sends it.
//
// What it says:
//  - Your figures: net worth, and how it's moved since last month's
//    check-in (each send keeps its figures in alert_sends.detail); what
//    the changes they've made have captured this tax year (Gains on Home);
//    this year's goals and the ISA allowance (Progress); their goal pots.
//  - Worth knowing: the Sunday email's "Your week" (weekly.js): today's
//    best rates against their accounts, the ISA allowance left, dates
//    coming up.
//  - A way back in: their progress, and their figures to update.
//
// It goes on the 1st, or up to MONTHLY_GRACE_DAYS after if a run doesn't
// get through everyone; `alert_sends` (key "monthly:YYYY-MM") stops anyone
// getting it twice. Not to someone who subscribed in the last
// MONTHLY_NEW_DAYS: their welcome has only just gone.
//
// Information, not instruction (Candid is guidance, not advice): where
// their figures stand, never what to do about them.

import { calcMetrics } from "./metrics.js";
import { rollTaxYear } from "./taxYear.js";
import { computeModuleStatuses, gainedSoFar, taxYearStart } from "./moduleStatus.js";
import { buildProgressSnapshot } from "./progressTracker.js";
import { yourWeek } from "./weekly.js";
import { fmt } from "./format.js";
import { renderEmail, SITE } from "./emailLayout.js";

export const MONTHLY_GRACE_DAYS = 3;
export const MONTHLY_NEW_DAYS = 7;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_MS = 86400000;
const MAX_POTS = 3;

const firstName = name => (name || "").trim().split(/\s+/)[0] || "";
const monthOf = key => MONTHS[+key.slice(5, 7) - 1];

// The month whose check-in is due on `today` ("YYYY-MM"): from the 1st to
// the MONTHLY_GRACE_DAYS after it. Null on other days.
export function monthlyMonth(today = new Date()) {
  if (today.getUTCDate() > 1 + MONTHLY_GRACE_DAYS) return null;
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Days from `today` to 5 April, the end of the tax year.
function daysTo5April(today) {
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const after = today.getUTCMonth() > 3 || (today.getUTCMonth() === 3 && today.getUTCDate() > 5);
  return Math.round((Date.UTC(today.getUTCFullYear() + (after ? 1 : 0), 3, 5) - day) / DAY_MS);
}

// "up £1,200 since your October check-in", from the last check-in's figures.
function moved(now, sent) {
  const last = (sent || []).filter(s => s.kind === "monthly" && s.detail && Number.isFinite(+s.detail.netWorth))
    .sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)))[0];
  if (!last) return null;
  const was = Math.round(+last.detail.netWorth), diff = now - was;
  const since = `since your ${monthOf(last.alert_key.slice(8)) || "last"} check-in`;
  return diff === 0 ? `the same as ${since.replace("since ", "at ")}` : `${diff > 0 ? "up" : "down"} ${fmt(Math.abs(diff))} ${since}`;
}

// The check-in due for one subscriber on `today`, or null. `rows`:
// savings_rates. `sent`: their alert_sends rows.
export function monthlyCheckIn(rawD, { today = new Date(), rows = [], sent = [] } = {}) {
  const month = monthlyMonth(today);
  if (!month) return null;
  const key = `monthly:${month}`;
  if ((sent || []).some(s => s.alert_key === key)) return null;
  const d = rollTaxYear(rawD || {}, today);
  const m = calcMetrics(d);
  const statuses = computeModuleStatuses(d, m, { rows });
  const snap = buildProgressSnapshot(d, m, statuses, today);
  const netWorth = snap.netWorth.netWorth;
  const gained = gainedSoFar(d, today, taxYearStart(today));
  const change = moved(netWorth, sent);

  const figures = [];
  figures.push({ label: "Net worth", text: `${netWorth < 0 ? "−" : ""}${fmt(netWorth)}${change ? `, ${change}` : ""}.` });
  if (gained.count > 0) {
    figures.push({ label: "Saved", text: `${fmt(gained.total)} so far this tax year, from changes worth ${fmt(gained.perYear)} a year.` });
  }
  if (snap.annual.total > 0) {
    figures.push({ label: "This year's goals", text: `${snap.annual.pct}% of the way, ${snap.annual.hits} of ${snap.annual.total} reached.` });
  }
  const isa = snap.rows.find(r => r.id === "isa" && !r.locked);
  if (isa) {
    const days = daysTo5April(today);
    figures.push({ label: "ISA", text: `${fmt(isa.current)} of the ${fmt(isa.target)} allowance used, with ${days} ${days === 1 ? "day" : "days"} to 5 April.` });
  }
  for (const pot of snap.vaults.slice(0, MAX_POTS)) {
    figures.push({ label: pot.name, text: pot.target > 0 ? `${fmt(pot.saved)} of ${fmt(pot.target)}.` : `${fmt(pot.saved)} saved.` });
  }

  return {
    key, kind: "monthly", month,
    subject: `Your ${MONTHS[+month.slice(5) - 1]} check-in`,
    preheader: `Net worth ${netWorth < 0 ? "−" : ""}${fmt(netWorth)}${change ? `, ${change}` : ""}.`,
    figures,
    // The ISA is already in their figures when its row is open.
    worthKnowing: yourWeek(d, m, today, rows).filter(l => !(isa && l.label === "ISA")),
    detail: { netWorth, captured: gained.total },
  };
}

// The email, as HTML and plain text (emailLayout.js).
export function monthlyEmail(checkIn, { name = "", unsubscribeUrl }) {
  const first = firstName(name);
  const line = l => [{ b: l.label }, `: ${l.text}`];
  return renderEmail({ campaign: "monthly",
    subject: checkIn.subject, preheader: checkIn.preheader,
    greeting: first ? `Hi ${first},` : "Hi,",
    blocks: [
      { p: `Where your figures stand at the start of ${MONTHS[+checkIn.month.slice(5) - 1]}, worked out from what you've told Candid.` },
      { h: "Your figures" },
      { list: checkIn.figures.map(line) },
      ...(checkIn.worthKnowing.length ? [{ h: "Worth knowing" }, { list: checkIn.worthKnowing.map(line) }] : []),
      { p: "Saved more, paid something off or had a pay rise? Updating your figures keeps all of this right." },
      { button: { label: "Update your figures", href: `${SITE}/app/inputs` } },
      { p: ["Or ", { a: "see your progress", href: `${SITE}/app/progress` }, " in Candid."] },
    ],
    note: "Candid works out where your figures stand from what you've told it, with no stake in what you choose. It's guidance, not advice.",
    unsubscribeUrl,
  });
}
