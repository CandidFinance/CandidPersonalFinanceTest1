// Outside events on Home: a Bank of England Bank Rate decision or a Budget,
// and what it means for this user's own figures. Pure, unit tested in
// outsideEvents.test.js; Home shows it (src/mobile/OutsideEvent.jsx).
//
// EVENTS is kept by hand: each with its date (and Bank Rate's `from`, the
// rate before). From EVENT_AHEAD_DAYS before, Home says when it is
// ("scheduled"). What was announced comes from its approved email
// (eventEmails.js, served by api/events.js; withApproved), and it becomes
// "announced", shown for EVENT_SHOW_DAYS:
//  - Bank Rate: `to`. A change works out what it would mean for their cash
//    if their savings rates follow it.
//  - Budget: `changes`, each { label, text, applies? }: `text` a string or
//    (d, m) => string, `applies` (d, m) => whether it touches their figures.
//    Only the changes that apply to them are shown.
// A scheduled event whose day has passed with nothing approved stops
// showing, rather than promise what hasn't come.
//
// Information, not instruction (Candid is guidance, not advice): what's
// changed and what it means for their figures, never what to do about it.

import { fmt } from "./format.js";
import { IMPACTS } from "./weekly.js";

export const EVENT_AHEAD_DAYS = 7;
export const EVENT_SHOW_DAYS = 14;
const DAY_MS = 86400000;

export const EVENTS = [
  { id: "budget-2026-10", kind: "budget", date: "2026-10-28" },
  { id: "boe-2026-11", kind: "bankRate", date: "2026-11-05", from: 3.75 },
  { id: "boe-2026-12", kind: "bankRate", date: "2026-12-17" },
];

const dayOf = t => { const x = new Date(t); return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()); };
const onDate = iso => new Date(`${iso}T12:00:00Z`);
const longDate = iso => onDate(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDate = iso => onDate(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const pct = r => `${+(+r).toFixed(2)}%`;
const announced = e => e.kind === "bankRate" ? e.to != null : Array.isArray(e.changes);

// EVENTS with what was announced, from the approved event emails
// ([{ event_id, outcome, items }]): Bank Rate's new rate; a Budget's items
// as its changes, each with an impact only where it touches their figures
// (weekly.js IMPACTS), the line on their figures standing for it.
export function withApproved(events, approved) {
  const byId = new Map((approved || []).map(r => [r.event_id, r]));
  return events.map(e => {
    const r = byId.get(e.id);
    if (!r) return e;
    if (e.kind === "bankRate") return r.outcome?.to != null ? { ...e, to: +r.outcome.to } : e;
    const impactLine = (i, d, m) => IMPACTS[i.impact?.kind]?.line(d, m, i.impact) || null;
    return { ...e, changes: (r.items || []).filter(i => i?.title).map(i => ({
      label: i.title,
      applies: i.impact ? (d, m) => !!impactLine(i, d, m) : null,
      text: i.impact ? (d, m) => impactLine(i, d, m) : i.body,
    })) };
  });
}

// What a Bank Rate decision means for their figures.
function bankRateLines(e, d, m, events) {
  const next = events.find(x => x.kind === "bankRate" && x.date > e.date);
  const nextLine = next ? ` The next decision is on ${shortDate(next.date)}.` : "";
  if (e.from == null || +e.to === +e.from) {
    return [{ label: "Your figures", text: `nothing changes from this.${nextLine}` }];
  }
  const lines = [];
  const cash = +m.cash || 0;
  const move = Math.round(cash * (e.to - e.from) / 100);
  if (cash > 0 && move !== 0) {
    lines.push({ label: "Your cash", text: `if your savings rates follow it, the ${fmt(cash)} you hold would earn about ${fmt(Math.abs(move))} a year ${move < 0 ? "less" : "more"}, before tax.` });
  }
  lines.push({ label: "Savings rates", text: `banks usually change theirs in the weeks after. Candid shows it here when the best rates for you move.${nextLine}` });
  return lines;
}

// The event Home shows on `today`, or null: the latest announced one still
// within EVENT_SHOW_DAYS, else one coming up within EVENT_AHEAD_DAYS.
// `closed`: the ids ("<id>:<phase>") they've closed. Returns
// { key, phase, kind, kicker, title, lines: [{ label, text }] }.
export function outsideEvent(d, m, { today = new Date(), events = EVENTS, closed = [] } = {}) {
  const now = dayOf(today);
  const daysFrom = e => Math.round((now - dayOf(onDate(e.date))) / DAY_MS);
  const open = (e, phase) => !closed.includes(`${e.id}:${phase}`);

  const recent = events
    .filter(e => announced(e) && daysFrom(e) >= 0 && daysFrom(e) < EVENT_SHOW_DAYS && open(e, "announced"))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (recent) {
    const base = { key: `${recent.id}:announced`, phase: "announced", kind: recent.kind };
    if (recent.kind === "bankRate") {
      const verb = recent.from == null || +recent.to === +recent.from ? "held at" : +recent.to < +recent.from ? "cut to" : "raised to";
      return { ...base, kicker: `Bank of England · ${shortDate(recent.date)}`, title: `Bank Rate ${verb} ${pct(recent.to)}`, lines: bankRateLines(recent, d, m, events) };
    }
    const applying = recent.changes.filter(c => !c.applies || c.applies(d, m));
    const lines = applying.length
      ? applying.map(c => ({ label: c.label, text: typeof c.text === "function" ? c.text(d, m) : c.text }))
      : [{ label: "Your figures", text: "nothing announced changes what you've told Candid." }];
    return { ...base, kicker: `The Budget · ${shortDate(recent.date)}`, title: recent.title || "What the Budget means for you", lines };
  }

  const ahead = events
    .filter(e => !announced(e) && daysFrom(e) <= 0 && daysFrom(e) > -EVENT_AHEAD_DAYS && open(e, "scheduled"))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!ahead) return null;
  const when = daysFrom(ahead) === 0 ? "today" : `on ${longDate(ahead.date)}`;
  const base = { key: `${ahead.id}:scheduled`, phase: "scheduled", kind: ahead.kind, lines: [] };
  return ahead.kind === "bankRate"
    ? { ...base, kicker: "Bank of England", title: `Bank Rate decision ${when}`, text: `${ahead.from != null ? `Bank Rate is ${pct(ahead.from)} now. ` : ""}What the decision means for your savings shows here once it's announced.` }
    : { ...base, kicker: "The Budget", title: `The Budget is ${when}`, text: "What it changes for your figures shows here once it's announced." };
}
