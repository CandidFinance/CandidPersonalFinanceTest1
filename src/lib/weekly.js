// Subscribers' emails beyond the alerts (src/lib/alerts.js): the welcome,
// as someone subscribes, and the Sunday email. Pure, unit tested in
// weekly.test.js; api/alerts.js sends them.
//
// The Sunday email has two parts:
//  - Your week: worked out on their own figures, the same way the app does
//    (today's best rates against their accounts, the ISA allowance left,
//    and dates coming up that apply to them).
//  - This week: the news, written for the week (rate changes, Budget
//    rumours) and approved on /admin/alerts before it goes. Each item can
//    carry an `impact`, worked out on their figures: "For you: ...". An
//    item whose impact doesn't apply to them goes without the line.
//
// An issue (the weekly_issues table): { week (the Sunday, YYYY-MM-DD),
// subject, intro, items: [{ title, status, body, source, url, impact }],
// approved_at }. `status`: "rumour", "confirmed" or "news". `impact`:
// { kind, ...its figures }, a kind from IMPACTS, or null.
//
// Information, not instruction (Candid is guidance, not advice): what each
// change would mean on their figures, never what to do about it.

import { calcMetrics, isaFillable } from "./metrics.js";
import { rollTaxYear } from "./taxYear.js";
import { cashOpportunity } from "./assist.js";
import { calcBonusSacrificePotential } from "./pension.js";
import { fmt } from "./format.js";

export const SITE = "https://www.candid-finance.co.uk";
const COMPANY = "Candid Personal Finance Ltd · Company no. 17383565 · 66 Paul Street, London, EC2A 4NA";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_MS = 86400000;
// The Sunday email can still go on the two days after, if a run doesn't
// get through everyone (alert_sends stops anyone getting it twice).
export const WEEKLY_GRACE_DAYS = 2;
// Dates within this many days make "Coming up".
const SOON_DAYS = 42;
// Better rates are only worth a line from this much a year.
const RATES_LINE_MIN = 50;
// Above this, National Insurance on pay is 2%; below, 8% (2026/27).
const NI_UPPER = 50270;
export const PAID_PLANS = ["monthly", "yearly"];
// The most free months invites can earn (server/referrals.js REFERRAL_CAP).
export const REFERRAL_MONTHS = 12;
export const STATUSES = { rumour: "Rumour", confirmed: "Confirmed", news: "News" };

const firstName = name => (name || "").trim().split(/\s+/)[0] || "";
const iso = date => date.toISOString().slice(0, 10);

// The Sunday this week's email belongs to, when it's due on `today`: on
// the Sunday or up to WEEKLY_GRACE_DAYS after. Null on other days.
export function weeklyWeek(today = new Date()) {
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const since = day.getUTCDay();
  return since <= WEEKLY_GRACE_DAYS ? iso(new Date(day - since * DAY_MS)) : null;
}
// The next Sunday from `today` (today, if it's a Sunday): the week an
// issue being written is for.
export function nextSunday(today = new Date()) {
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return iso(new Date(+day + ((7 - day.getUTCDay()) % 7) * DAY_MS));
}

// ── What a change would mean on their figures ────────────────────────────────
// Each takes the item's figures and returns a line, or null when it doesn't
// apply to them. `label` and `fields` drive the editor on /admin/alerts.
export const IMPACTS = {
  savingsRate: {
    label: "Savings rates move",
    fields: [{ key: "change", label: "Change, in percentage points (e.g. -0.25)" }],
    line: (d, m, { change }) => {
      const c = +change;
      if (!c || !(m.cash > 0)) return null;
      const year = Math.round(m.cash * Math.abs(c) / 100);
      if (year < 1) return null;
      return `On your ${fmt(m.cash)} in cash, a ${Math.abs(c)} point ${c < 0 ? "fall" : "rise"} would mean about ${fmt(year)} a year ${c < 0 ? "less" : "more"} interest, if your accounts follow it.`;
    },
  },
  cashIsaLimit: {
    label: "Cash ISA limit",
    fields: [{ key: "limit", label: "New yearly limit for cash (£)" }, { key: "from", label: "From (e.g. April 2027)" }],
    line: (d, m, { limit, from }) => {
      const cap = +limit;
      if (!(cap > 0)) return null;
      const when = from ? ` from ${from}` : "";
      const paid = +d.isaThisYearCash || 0;
      if (paid > 0) {
        return paid > cap
          ? `You've put ${fmt(paid)} into a cash ISA this tax year. Under a ${fmt(cap)} limit${when}, ${fmt(paid - cap)} of that would have to go into a stocks and shares ISA, or stay outside an ISA.`
          : `You've put ${fmt(paid)} into a cash ISA this tax year, within a ${fmt(cap)} limit${when}.`;
      }
      return m.cash > cap ? `You hold ${fmt(m.cash)} in cash. Under a ${fmt(cap)} limit${when}, that's the most of it that could go into a cash ISA each year.` : null;
    },
  },
  isaLeft: {
    label: "ISA allowance left",
    fields: [],
    line: (d, m) => m.isaHeadroom > 0 ? `You have ${fmt(m.isaHeadroom)} of this year's £20,000 ISA allowance left, until 5 April.` : null,
  },
  salarySacrificeCap: {
    label: "Salary sacrifice cap",
    fields: [{ key: "cap", label: "Yearly cap before NI is due (£)" }, { key: "from", label: "From (e.g. April 2029)" }],
    line: (d, m, { cap, from }) => {
      const limit = +cap;
      if (!(limit > 0) || d.pensionType !== "sacrifice" || !(m.salary > 0)) return null;
      const sacrificed = Math.round(m.salary * (+d.myContribution || 0) / 100);
      if (!(sacrificed > 0)) return null;
      const when = from ? ` from ${from}` : "";
      if (sacrificed <= limit) return `You sacrifice about ${fmt(sacrificed)} a year, under a ${fmt(limit)} cap${when}, so this wouldn't change what you pay.`;
      const ni = Math.round((sacrificed - limit) * (m.salary > NI_UPPER ? 0.02 : 0.08));
      return `You sacrifice about ${fmt(sacrificed)} a year. Under a ${fmt(limit)} cap${when}, National Insurance would be due on ${fmt(sacrificed - limit)} of it: about ${fmt(ni)} a year.`;
    },
  },
};

// ── Your week ────────────────────────────────────────────────────────────────
function yourWeek(d, m, today, rows) {
  const lines = [];
  const opp = rows?.length ? cashOpportunity(d, m, rows) : null;
  if (opp && opp.gain >= RATES_LINE_MIN) {
    const top = opp.lines[0]?.option;
    lines.push(`Rates: at today's best rates, your cash could earn about ${fmt(Math.round(opp.gain))} a year more after tax${top ? `. Highest for you: ${top.provider}${top.product ? ` ${top.product}` : ""} at ${top.ratePct}%` : ""}.`);
  } else if (m.cash > 0 && opp) {
    lines.push("Rates: your savings are within £50 a year of today's best rates.");
  }
  if (m.isaHeadroom > 0 && isaFillable(d, m, today) > 0) {
    lines.push(`ISA: ${fmt(m.isaHeadroom)} of this year's allowance left, until 5 April.`);
  }
  for (const s of comingUp(d, m, today)) lines.push(s);
  return lines;
}

function comingUp(d, m, today) {
  const out = [];
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const yearEnd = Date.UTC(today.getUTCMonth() > 3 || (today.getUTCMonth() === 3 && today.getUTCDate() > 5) ? today.getUTCFullYear() + 1 : today.getUTCFullYear(), 3, 5);
  const toYearEnd = Math.round((yearEnd - day) / DAY_MS);
  if (toYearEnd <= SOON_DAYS) out.push(`Coming up: the tax year ends on 5 April, in ${toYearEnd} ${toYearEnd === 1 ? "day" : "days"}.`);
  const month = +d.bonusMonth;
  if (d.employmentStatus === "employed" && +d.bonusAmount > 0 && month >= 1 && month <= 12) {
    const y = today.getUTCMonth() + 1 > month ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
    const toBonus = Math.round((Date.UTC(y, month - 1, 1) - day) / DAY_MS);
    if (toBonus >= 0 && toBonus <= SOON_DAYS) {
      const saving = Math.round(calcBonusSacrificePotential(d, m).standalone || 0);
      out.push(`Coming up: your bonus is usually paid in ${MONTHS[month - 1]}.${saving > 0 ? ` Paid into your pension, it could save up to ${fmt(saving)} in tax, if arranged with payroll before it's paid.` : ""}`);
    }
  }
  return out;
}

// ── The emails ───────────────────────────────────────────────────────────────
// The Sunday email for one subscriber. `rows`: savings_rates.
export function weeklyEmail(issue, rawD, { today = new Date(), rows = [], unsubscribeUrl }) {
  const d = rollTaxYear(rawD || {}, today);
  const m = calcMetrics(d);
  const first = firstName(d.name);
  const items = (issue.items || []).filter(i => i && i.title && i.body);
  const mine = yourWeek(d, m, today, rows);
  const lines = [first ? `Hi ${first},` : "Hi,", ""];
  if (issue.intro) lines.push(issue.intro.trim(), "");
  if (mine.length) {
    lines.push("YOUR WEEK", ...mine.map(l => `- ${l}`), "");
  }
  if (items.length) {
    lines.push("THIS WEEK", "");
    for (const i of items) {
      lines.push(`${i.title.trim()}${STATUSES[i.status] ? ` (${STATUSES[i.status]})` : ""}`, i.body.trim());
      const impact = i.impact && IMPACTS[i.impact.kind];
      const forYou = impact ? impact.line(d, m, i.impact) : null;
      if (forYou) lines.push(`For you: ${forYou}`);
      if (i.source) lines.push(`Source: ${i.source.trim()}${i.url ? ` (${i.url.trim()})` : ""}`);
      lines.push("");
    }
  }
  lines.push(
    `Your figures in Candid: ${SITE}/app/home`,
    "",
    `Rumours are just that: nothing changes until it's announced. Candid works out what each change would mean on the figures you've given it, with no stake in what you choose. It's guidance, not advice.`,
    "",
    `Stop these emails: ${unsubscribeUrl}`,
    COMPANY,
  );
  const subject = (issue.subject || "").trim() || `This week: ${items[0]?.title?.trim() || "your money"}`;
  return { subject, text: lines.join("\n") };
}

// The welcome, as someone subscribes. `periodEnd`: when it renews (a date).
// `inviteCode`: their referral code (server/referrals.js), for their invite
// link; without one (email not confirmed yet), where to find it in Candid.
export function welcomeEmail({ name = "", plan, amountPence, periodEnd, inviteCode = null, unsubscribeUrl }) {
  const first = firstName(name);
  const price = amountPence > 0 ? `£${(amountPence / 100).toFixed(2)} a ${plan === "yearly" ? "year" : "month"}` : null;
  const renews = periodEnd && !isNaN(new Date(periodEnd)) ? new Date(periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }) : null;
  const lines = [
    first ? `Hi ${first},` : "Hi,",
    "",
    "Thanks for subscribing to Candid. Every module is now open to you, and your answers are saved to this email address.",
    "",
    "What you'll get:",
    "- Every module's figures, kept current as you update your answers. Open Banking is in testing: in future you'll be able to connect your bank accounts, and your figures will update automatically",
    "- An email roundup on Sunday mornings: rate changes and Budget news, and what each would mean on your figures",
    "- Updates on key dates in the tax calendar that apply to you, from your bonus to 5 April, and whenever a better savings rate appears",
    "",
    `On another phone or computer, sign in with this email address: ${SITE}/signin`,
    "",
    ...(price ? [`Your plan: ${price}${renews ? `, renewing on ${renews}` : ""}.`] : []),
    `To manage your subscription: ${SITE}/app/inputs, then Manage subscription.`,
    "",
    `Know someone who'd find Candid useful? For each friend who joins with your link and completes their first module, you get a month free, up to ${REFERRAL_MONTHS} months.${inviteCode ? "" : " Your link is in Candid, under Edit inputs."}`,
    ...(inviteCode ? [`${SITE}/app/start?ref=${inviteCode}`] : []),
    "",
    "Any questions or feedback, just reply to this email.",
    "",
    "The Candid team",
    "",
    "Candid is guidance, not advice.",
    `Stop Candid's emails: ${unsubscribeUrl}`,
    COMPANY,
  ];
  return { subject: "Welcome to Candid", text: lines.join("\n") };
}

// An issue as saved from the editor, or pasted in as a draft: only the
// known fields, trimmed, with limits so nothing runs away.
export function cleanIssue(raw) {
  const str = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const items = (Array.isArray(raw?.items) ? raw.items : []).slice(0, 8).map(i => {
    const kind = IMPACTS[i?.impact?.kind] ? i.impact.kind : null;
    const impact = kind ? Object.fromEntries([["kind", kind], ...IMPACTS[kind].fields.map(f => [f.key, str(String(i.impact[f.key] ?? ""), 40)])]) : null;
    return { title: str(i?.title, 140), status: STATUSES[i?.status] ? i.status : "news", body: str(i?.body, 1200), source: str(i?.source, 140), url: /^https:\/\//.test(i?.url || "") ? str(i.url, 400) : "", impact };
  }).filter(i => i.title || i.body);
  return { subject: str(raw?.subject, 120), intro: str(raw?.intro, 800), items };
}
