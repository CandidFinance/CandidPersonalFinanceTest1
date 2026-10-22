// "Since your last visit" on Home: what's changed for this user since they
// were last here, so coming back opens on what's new rather than the same
// page as before. Each visit leaves a small snapshot on the device (Home
// records it once a session, once the rates are in); the next visit is
// compared with it. Pure, unit tested in sinceLastVisit.test.js.
//
// What counts as a change, each a line:
//  - An account opened through Assist whose rate has been cut, or whose
//    bonus rate is ending, not raised at the last visit (assist.js
//    accountItems).
//  - Today's best rates adding at least RATES_MOVE_MIN a year more or less
//    to their cash than at the last visit, or a new highest rate for them.
//  - What the changes they've made have captured since (Gains on Home).
//  - A new tax year since, with a fresh ISA allowance.
// With at least one of those, dates coming up join them (weekly.js
// comingUp): 5 April, their bonus month.
//
// Information, not instruction (Candid is guidance, not advice): what's
// changed, never what to do about it.

import { cashOpportunity, accountItems, accountName, MIN_ASSIST_GAIN } from "./assist.js";
import { gainedSoFar } from "./moduleStatus.js";
import { comingUp } from "./weekly.js";
import { ISA_ALLOWANCE } from "./tax.js";
import { fmt } from "./format.js";

export const RATES_MOVE_MIN = 50;
const DAY_MS = 86400000;

// What the next visit is compared with. `rows`: savings_rates, or null
// while they load (no rate figures then).
export function visitSnapshot(d, m, rows, today = new Date()) {
  const opp = rows?.length ? cashOpportunity(d, m, rows) : null;
  const top = opp?.lines[0]?.option;
  return {
    at: today.toISOString(),
    gain: opp ? Math.round(opp.gain) : null,
    top: top ? [top.provider, top.product || "", top.ratePct].join("|") : null,
    captured: gainedSoFar(d, today).total,
    taxYear: m.taxYear,
    seen: rows?.length ? accountItems(d, rows, today).map(i => i.signature) : [],
  };
}

// "3 days ago", "yesterday", "earlier today".
export function agoLabel(at, today = new Date()) {
  const startOf = t => { const x = new Date(t); return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()); };
  const days = Math.round((startOf(today) - startOf(at)) / DAY_MS);
  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

// The changes since `prev` (a visitSnapshot), or null when there are none.
// { ago, lines: [{ label, text }], rates } (`rates`: a line is about their
// cash and the rates).
export function sinceLastVisit(prev, d, m, rows, today = new Date()) {
  if (!prev?.at) return null;
  const now = visitSnapshot(d, m, rows, today);
  const lines = [];
  let rates = false;

  for (const item of rows?.length ? accountItems(d, rows, today) : []) {
    if ((prev.seen || []).includes(item.signature)) continue;
    const name = accountName(item.account);
    rates = true;
    if (item.kind === "cut") {
      lines.push({ label: "Rate cut", text: `${name} now pays ${item.toRate}%, down from ${item.fromRate}%${item.loss ? `: ${fmt(Math.round(item.loss))} a year less on your ${fmt(item.account.amount)}` : ""}.` });
    } else {
      lines.push({ label: "Bonus rate", text: item.daysLeft > 0 ? `${name}'s bonus rate ends in ${item.daysLeft} ${item.daysLeft === 1 ? "day" : "days"}.` : `${name}'s bonus rate has ended.` });
    }
  }

  if (now.gain != null && prev.gain != null && Math.abs(now.gain - prev.gain) >= RATES_MOVE_MIN) {
    rates = true;
    lines.push({ label: "Rates", text: `today's best rates would add ${fmt(now.gain)} a year to your cash, ${now.gain > prev.gain ? "up" : "down"} from ${fmt(prev.gain)}.` });
  } else if (now.top && prev.top && now.top !== prev.top && now.gain >= MIN_ASSIST_GAIN) {
    const [provider, product, rate] = now.top.split("|");
    rates = true;
    lines.push({ label: "Rates", text: `a new highest rate for you: ${provider}${product ? ` ${product}` : ""} at ${rate}%.` });
  }

  const captured = now.captured - (prev.captured || 0);
  if (captured >= 1) lines.push({ label: "Captured", text: `${fmt(captured)} more from the changes you've made.` });

  if (prev.taxYear && m.taxYear > prev.taxYear) {
    lines.push({ label: "New tax year", text: `it started on 6 April, with a fresh ${fmt(ISA_ALLOWANCE)} ISA allowance.` });
  }

  if (!lines.length) return null;
  for (const text of comingUp(d, m, today)) lines.push({ label: "Coming up", text });
  return { ago: agoLabel(prev.at, today), lines, rates };
}
