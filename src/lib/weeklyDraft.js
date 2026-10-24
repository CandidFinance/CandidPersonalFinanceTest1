// Claude's draft of the Sunday email's news (weekly.js). Pure, unit
// tested in weeklyDraft.test.js; api/events.js asks for it.
//
// How it goes:
//  1. On Saturday, the afternoon run (api/events.js) asks Claude to search
//     the week's news that touches people's own money and draft the issue
//     for the next day (WEEKLY_DRAFT_TOOL), in the same shape as an event
//     email: a subject, an intro and items, each with an `impact` from
//     weekly.js IMPACTS where one fits. Saved unapproved in
//     `weekly_issues`, unless one is already there, and flagged by email
//     (weeklyFlagEmail) with Claude's note on anything to check.
//  2. On /admin/alerts it's checked, edited, previewed and approved (or
//     drafted again from there).
//  3. Approved, it goes at the 04:00 UTC run on Sunday (api/alerts.js).
//
// Information, not instruction, the same as the event emails.

import { DRAFT_TOOL, draftFromTool, impactKinds, HOW_CANDID_WRITES, eventName } from "./eventEmails.js";
import { IMPACTS } from "./weekly.js";
import { SITE } from "./emailLayout.js";

// Saturday, in the UK: the day the run drafts the next day's issue.
export const WEEKLY_DRAFT_DAY = 6;
// A week's roundup covers more ground than one announcement: rates, the
// Bank, tax. Six searches left it without official sources or rate moves.
export const WEEKLY_SEARCHES = 12;
const DAY_MS = 86400000;
// Events this close either side of the draft go in its prompt.
const EVENTS_BACK_DAYS = 7;
const EVENTS_AHEAD_DAYS = 21;

const dayNum = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const longDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

// The event tool's items, without the Bank Rate field or `found`: a quiet
// week still gets an issue, with fewer items.
const { subject, intro, items, note } = DRAFT_TOOL.input_schema.properties;
export const WEEKLY_DRAFT_TOOL = {
  name: "draft_weekly_email",
  description: "Save the drafted Sunday email for Candid's subscribers. Call it once, after searching.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["subject", "intro", "items", "note"],
    properties: { subject, intro, items, note },
  },
};

export function weeklyDraftSystem() {
  return `You draft the Sunday email for Candid, a UK personal finance app: a short roundup of the past week's news that touches a UK saver or earner's own money. Each subscriber's copy opens with their own week (their rates, ISA allowance, dates coming up) and adds a line worked out on their own figures for any item with an impact, so the items themselves stay general.

Search the past seven days' news in official sources first (bankofengland.co.uk, gov.uk, obr.uk, fca.org.uk), then reputable UK press and savings rate trackers (Moneyfacts and similar). Then call draft_weekly_email once.

What belongs in it:
- Savings rates: notable moves in easy-access and fixed rates, best-buy changes, providers cutting or raising rates. Only what happened this week.
- Bank Rate: a decision this week, or ahead of the next one, what the Bank of England has said and what economists' polls (Reuters and similar) expect.
- Tax and allowances: ISAs, pensions, income tax and National Insurance, student loans, tax on savings and dividends, capital gains. Changes announced, changes taking effect soon, and well-sourced reports of what a coming Budget may contain.
- Leave out business and spending measures, stock market commentary, share tips, crypto and anything that isn't about the reader's own money.

How Candid writes:
${HOW_CANDID_WRITES}
- Each item's status: "news" for what happened this week, "confirmed" for something announced that hasn't taken effect yet, "rumour" for a report of what may be announced. A rumour names who reported it, and is only included when a reputable outlet has.
- Items: up to five, most important first. A quiet week can have one or two; never pad it.
- The intro: one or two sentences on what the week was about. The subject: under 70 characters, about the week's biggest item.
- Give an item an impact when one of these fits, with its fields filled in as plain numbers or short dates; otherwise kind "none":
${impactKinds()}
- Every item has a source, and a link to it where there is one.
- Anything you're unsure of, and the sources to check, goes in the note, not the email.`;
}

// `events`: outsideEvents.js EVENTS, for those either side of the week.
export function weeklyDraftPrompt(week, ukToday, events = []) {
  const ago = e => Math.round((dayNum(week) - dayNum(e.date)) / DAY_MS);
  const past = events.filter(e => ago(e) > 0 && ago(e) <= EVENTS_BACK_DAYS);
  const next = events.filter(e => ago(e) <= 0 && -ago(e) <= EVENTS_AHEAD_DAYS);
  return [
    `Today is ${ukToday}. Draft the Sunday email for ${longDate(week)}, covering the news since ${longDate(new Date(dayNum(week) - 7 * DAY_MS).toISOString().slice(0, 10))}.`,
    ...(past.length ? [`Subscribers had a separate email about ${past.map(e => `the ${eventName(e)} on ${longDate(e.date)}`).join(" and ")}, so keep that to one short item at most.`] : []),
    ...(next.length ? [`Coming up: ${next.map(e => `the ${eventName(e)} on ${longDate(e.date)}`).join(", ")}. Reports of what to expect from it can go in as rumours.`] : []),
  ].join(" ");
}

// The tool's input as an issue (weekly.js cleanIssue's fields).
export function weeklyDraftFromTool(input) {
  const { outcome, ...issue } = draftFromTool({ ...input, new_bank_rate: null });
  return issue;
}

// The flag to whoever approves: a draft is waiting, or Claude couldn't
// write one. Plain text.
export function weeklyFlagEmail(week, { draft = null, note = "", error = "" } = {}) {
  const when = longDate(week);
  const subject = draft ? `To approve: Claude's draft of the Sunday email for ${when}` : `The Sunday email for ${when} needs writing`;
  const lines = draft
    ? [`Claude has drafted the Sunday email for ${when}. Nothing goes to subscribers until it's approved.`, "",
       `Subject: ${draft.subject}`, "", draft.intro, "", ...draft.items.map(i => `- [${i.status}] ${i.title}${i.impact ? ` [for you: ${IMPACTS[i.impact.kind].label}]` : ""}`)]
    : [`Claude couldn't draft the Sunday email for ${when}.${error ? ` ${error}` : ""}`, "", "It can be written on the alerts page, or drafted again from there."];
  const text = [...lines, ...(note ? ["", `Claude's note: ${note}`] : []), "",
    `Check, edit and approve it: ${SITE}/admin/alerts`,
    "Approved before Sunday's 04:00 UTC run, it goes then (before 6am UK time); approved later, at the next daily run, up to Tuesday."].join("\n");
  return { subject, text };
}
