// The email when an outside event lands (src/lib/outsideEvents.js EVENTS):
// a Bank Rate decision or a Budget. Pure, unit tested in
// eventEmails.test.js; api/events.js drafts and flags it, api/alerts.js
// sends it.
//
// How it goes:
//  1. On the event's day, the afternoon run (api/events.js) asks Claude to
//     find what was announced and draft the email (DRAFT_TOOL): a subject,
//     an intro and the changes as items, each with an `impact` from
//     weekly.js IMPACTS where one fits, worked out on each subscriber's own
//     figures. Saved unapproved in `event_emails`, with Claude's note on
//     anything to check, and flagged by email (flagEmail).
//  2. On /admin/alerts it's checked, edited, previewed and approved.
//  3. Approved, it goes to subscribers at the next daily run, until
//     EVENT_EMAIL_DAYS after the event (alert_sends key "event:<id>"), and
//     its outcome shows in the app (outsideEvents.js withApproved).
//
// Information, not instruction (Candid is guidance, not advice): what was
// announced and what it would mean on their figures, never what to do.

import { calcMetrics } from "./metrics.js";
import { rollTaxYear } from "./taxYear.js";
import { IMPACTS, STATUSES, cleanIssue, shortMoney } from "./weekly.js";
import { renderEmail, SITE } from "./emailLayout.js";

export const EVENT_EMAIL_DAYS = 3;
const DAY_MS = 86400000;
const firstName = name => (name || "").trim().split(/\s+/)[0] || "";
const dayNum = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export const eventName = e => e.kind === "bankRate" ? "Bank Rate decision" : "Budget";

// Whether an event's email can go on `ukToday` (YYYY-MM-DD): from its day
// to EVENT_EMAIL_DAYS after, so a late approval doesn't send stale news.
export function eventEmailDue(event, ukToday) {
  const days = Math.round((dayNum(ukToday) - dayNum(event.date)) / DAY_MS);
  return days >= 0 && days <= EVENT_EMAIL_DAYS;
}

// An event email as saved or drafted: the issue's fields (weekly.js
// cleanIssue) and, for Bank Rate, the new rate.
export function cleanEventDraft(raw) {
  const to = raw?.outcome?.to;
  const rate = to === "" || to == null ? null : +to;
  return { outcome: Number.isFinite(rate) && rate >= 0 && rate <= 20 ? { to: rate } : null, ...cleanIssue(raw) };
}

// ── Claude's draft ───────────────────────────────────────────────────────────
// Every field is required (strict tool use); unused impact fields are "".
const IMPACT_FIELDS = [...new Set(Object.values(IMPACTS).flatMap(i => i.fields.map(f => f.key)))];
export const DRAFT_TOOL = {
  name: "draft_event_email",
  description: "Save the drafted email for Candid's subscribers. Call it once, after searching, with found=false if the announcement can't be found yet.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["found", "new_bank_rate", "subject", "intro", "items", "note"],
    properties: {
      found: { type: "boolean", description: "Whether the announcement was found in reliable sources." },
      new_bank_rate: { type: ["number", "null"], description: "Bank Rate decisions only: the new Bank Rate in percent (e.g. 3.5). Null for a Budget." },
      subject: { type: "string", description: "Email subject, under 70 characters." },
      intro: { type: "string", description: "One or two sentences saying what was announced." },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "status", "body", "source", "url", "impact"],
          properties: {
            title: { type: "string" },
            status: { type: "string", enum: Object.keys(STATUSES) },
            body: { type: "string", description: "Two or three sentences: what changes and from when. No figures about the reader." },
            source: { type: "string", description: "e.g. Bank of England, GOV.UK, OBR" },
            url: { type: "string", description: "https:// link to the source, or empty" },
            impact: {
              type: "object",
              additionalProperties: false,
              required: ["kind", ...IMPACT_FIELDS],
              properties: {
                kind: { type: "string", enum: ["none", ...Object.keys(IMPACTS)] },
                ...Object.fromEntries(IMPACT_FIELDS.map(k => [k, { type: "string" }])),
              },
            },
          },
        },
      },
      note: { type: "string", description: "For the person approving it: sources used, anything uncertain or worth checking. Not sent." },
    },
  },
};

// Shared with the Sunday email's draft (weeklyDraft.js).
export const impactKinds = () => Object.entries(IMPACTS).map(([k, v]) => `- ${k} (${v.label})${v.fields.length ? `: ${v.fields.map(f => `${f.key} = ${f.label}`).join("; ")}` : ""}`).join("\n");
export const HOW_CANDID_WRITES = `- Information, not instruction. Say what was announced and what changes, never what the reader should do. No "you should", "consider", "now's the time", no recommendations.
- UK English, plain words, short sentences. No emoji, no exclamation marks, no hype.`;

export function draftSystem() {
  return `You draft emails for Candid, a UK personal finance app, about announcements that move people's money: Bank of England Bank Rate decisions and UK Budgets. Each subscriber's copy adds a line worked out on their own figures for any item with an impact, so the items themselves stay general.

Search for today's announcement in official sources first (bankofengland.co.uk, gov.uk, obr.uk), then reputable UK press. Then call draft_event_email once.

How Candid writes:
${HOW_CANDID_WRITES}
- Only what was announced and is in your sources. Rumours, commentary and forecasts stay out. Anything you're unsure of goes in the note, not the email.
- Items: the one to five changes most likely to touch a UK saver or earner's own money (savings rates, ISAs, pensions, income tax and National Insurance, student loans, tax on savings and dividends, capital gains). Leave out business and spending measures.
- Give an item an impact when one of these fits, with its fields filled in as plain numbers or short dates; otherwise kind "none":
${impactKinds()}
- For a Bank Rate decision: new_bank_rate is the new rate, and the decision is the first item, status "news", with impact bankRate (its line covers savings and mortgages) and change = new rate minus old rate in percentage points (e.g. -0.25; 0 for a hold).

If the announcement can't be found yet, call the tool with found=false, empty fields, and say what you found in the note.`;
}

export function draftPrompt(event, ukToday) {
  return event.kind === "bankRate"
    ? `Today is ${ukToday}. The Bank of England announced its Bank Rate decision today (${event.date}). Bank Rate before it was ${event.from != null ? `${event.from}%` : "unknown"}. Draft the email about it.`
    : `Today is ${ukToday}. The UK Budget was delivered today (${event.date}). Draft the email about what it changes for people's own money.`;
}

// The tool's input as an event draft.
export function draftFromTool(input) {
  return cleanEventDraft({
    outcome: input?.new_bank_rate != null ? { to: input.new_bank_rate } : null,
    subject: input?.subject, intro: input?.intro,
    items: (Array.isArray(input?.items) ? input.items : []).map(i => {
      const kind = IMPACTS[i?.impact?.kind] ? i.impact.kind : null;
      return { ...i, impact: kind ? { ...i.impact, kind } : null };
    }),
  });
}

// The flag to whoever approves: a draft is waiting, or Claude couldn't
// write one. Plain text.
export function flagEmail(event, { draft = null, note = "", error = "" } = {}) {
  const name = eventName(event);
  const subject = draft ? `To approve: Claude's draft for the ${name}` : `The ${name} email needs writing`;
  const lines = draft
    ? [`Claude has drafted the email for the ${name} (${event.date}). Nothing goes to subscribers until it's approved.`, "",
       `Subject: ${draft.subject}`, "", draft.intro, "", ...draft.items.map(i => `- ${i.title}${i.impact ? ` [for you: ${IMPACTS[i.impact.kind].label}]` : ""}`)]
    : [`Claude couldn't draft the email for the ${name} (${event.date}).${error ? ` ${error}` : ""}`, "", "It can be written on the alerts page, or drafted again from there."];
  const text = [...lines, ...(note ? ["", `Claude's note: ${note}`] : []), "",
    `Check, edit and approve it: ${SITE}/admin/alerts`,
    `Approved within ${EVENT_EMAIL_DAYS} days of the ${name}, it goes at the next daily run (before 6am UK time).`].join("\n");
  return { subject, text };
}

// ── The email ────────────────────────────────────────────────────────────────
// For one subscriber, on their figures. `issue`: the approved draft.
export function eventEmail(issue, event, rawD, { today = new Date(), unsubscribeUrl }) {
  const d = rollTaxYear(rawD || {}, today);
  const m = calcMetrics(d);
  const first = firstName(d.name);
  const items = (issue.items || []).filter(i => i && i.title && i.body);
  const subject = (issue.subject || "").trim() || items[0]?.title?.trim() || `The ${eventName(event)}`;
  return renderEmail({ campaign: "event",
    subject, preheader: issue.intro || items.map(i => i.title).join(" · "),
    greeting: first ? `Hi ${first},` : "Hi,",
    blocks: [
      ...(issue.intro ? [{ p: issue.intro.trim() }] : []),
      ...items.map(i => {
        const impact = i.impact && IMPACTS[i.impact.kind];
        const forYou = impact ? impact.line(d, m, i.impact, today) : null;
        return { news: { title: shortMoney(i.title.trim()), status: i.status, body: shortMoney(i.body.trim()), forYou: forYou && shortMoney(forYou), source: i.source?.trim() || null, url: i.url?.trim() || null } };
      }),
      { button: { label: "Open Candid", href: `${SITE}/app/home` } },
    ],
    note: "Candid works out what each change would mean on the figures you've given it, with no stake in what you choose. It's guidance, not advice.",
    unsubscribeUrl,
  });
}
