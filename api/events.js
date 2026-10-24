import { isAllowedOrigin, safeEqual, rateLimiter, checkAdminPassword } from "../server/http.js";
import { EVENTS, EVENT_SHOW_DAYS } from "../src/lib/outsideEvents.js";
import { DRAFT_TOOL, draftSystem, draftPrompt, draftFromTool, cleanEventDraft, flagEmail } from "../src/lib/eventEmails.js";
import { WEEKLY_DRAFT_TOOL, WEEKLY_DRAFT_DAY, WEEKLY_SEARCHES, weeklyDraftSystem, weeklyDraftPrompt, weeklyDraftFromTool, weeklyFlagEmail } from "../src/lib/weeklyDraft.js";
import { nextSunday } from "../src/lib/weekly.js";
import { sendOnce } from "../server/alertMail.js";

// Outside events' emails (src/lib/eventEmails.js): a Bank Rate decision or
// a Budget, drafted by Claude, approved by a person. One route:
//  - Vercel Cron, daily at 15:00 UTC (vercel.json), after the Bank of
//    England's noon announcement and the Budget speech. Authorised by
//    CRON_SECRET. On an event's day (or the day after, if the first try
//    found nothing), Claude searches for what was announced and drafts the
//    email; the draft is saved unapproved in `event_emails` and flagged by
//    email to EVENTS_FLAG_TO. Nothing goes to subscribers from here:
//    api/alerts.js sends an approved one at its next daily run.
//    On Saturdays the same run has Claude draft the next day's Sunday email
//    (src/lib/weeklyDraft.js) into `weekly_issues`, if nothing is there yet,
//    and flags it the same way; api/alerts.js sends it once approved.
//  - The /admin/alerts page, authorised by FEEDBACK_ADMIN_PASSWORD: the
//    events and their drafts, saved, approved, or drafted again by Claude;
//    and the Sunday email drafted again by Claude (the rest of its editing
//    is in api/alerts.js, whose time limit is too short for a draft).
//  - A plain GET, for the app: what each recent event announced, approved
//    emails only (Home's outside event, outsideEvents.js withApproved).
//
// Everything goes through the service-role key; `event_emails` can't be read
// or written with the anon key (supabase/hand-run/supabase_event_emails_migration.sql).

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.FEEDBACK_ADMIN_PASSWORD;
const CRON_SECRET = process.env.CRON_SECRET;
const FLAG_TO = process.env.EVENTS_FLAG_TO || "admin@candid-finance.co.uk";

const MODEL = "claude-opus-5-5";
// Pauses in Claude's search loop (stop_reason "pause_turn") resumed at most
// this many times.
const MAX_CONTINUATIONS = 3;
const CLAUDE_TIMEOUT_MS = 240000;
// The run stops asking Claude this long after it starts, inside the
// function's 300s (vercel.json), so a slow Saturday still saves the flag.
const RUN_BUDGET_MS = 270000;
// Less than this left, and the Sunday draft isn't started.
const WEEKLY_MIN_MS = 90000;
const DAY_MS = 86400000;
// The admin page lists events from this long ago to this far ahead.
const LIST_BACK_DAYS = 30;
const LIST_AHEAD_DAYS = 60;
const COLUMNS = "event_id,outcome,subject,intro,items,note,drafted_by,drafted_at,approved_at,updated_at";

const adminLimiter = rateLimiter(20, "10 m", "ratelimit:events-admin");

async function db(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw Object.assign(new Error(`Supabase ${method} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`), { status: res.status });
  return res.status === 204 ? null : res.json().catch(() => null);
}

// The date in the UK, as YYYY-MM-DD.
const ukDay = d => new Date(d).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const between = (iso, from, to) => iso >= from && iso <= to;
const rowsFor = ids => ids.length ? db(`event_emails?select=${COLUMNS}&event_id=in.(${ids.map(encodeURIComponent).join(",")})`) : [];

// ── Claude's draft ───────────────────────────────────────────────────────────
// Claude searches the web, then calls `tool`. Returns the tool's input.
async function askClaude({ system, prompt, tool, searches = 6, deadline = Infinity }) {
  const body = {
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "high" },
    // A declined request is re-run on Anthropic's recommended fallback.
    fallbacks: "default",
    system,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: searches }, tool],
    messages: [{ role: "user", content: prompt }],
  };
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const left = Math.min(CLAUDE_TIMEOUT_MS, deadline - Date.now());
    if (left < 1000) throw new Error("It ran out of time.");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-beta": "server-side-fallback-2026-07-01" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(left),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message || `Claude returned ${res.status}`);
    if (data.stop_reason === "refusal") throw new Error("Claude declined to draft it.");
    const call = (data.content || []).find(c => c.type === "tool_use" && c.name === tool.name);
    if (call) return call.input;
    if (data.stop_reason !== "pause_turn") throw new Error(`Claude stopped without a draft (${data.stop_reason}).`);
    // Paused mid-search: sent back as it is, and it carries on.
    body.messages = [body.messages[0], { role: "assistant", content: data.content }];
  }
  throw new Error("Claude was still searching after several tries.");
}

// Drafts one event's email and saves it unapproved. Returns
// { draft, note } or { error, note }.
async function draftEvent(event, ukToday) {
  let input;
  try { input = await askClaude({ system: draftSystem(), prompt: draftPrompt(event, ukToday), tool: DRAFT_TOOL }); }
  catch (e) { return { error: e.message, note: "" }; }
  const note = typeof input?.note === "string" ? input.note.trim().slice(0, 2000) : "";
  if (!input?.found) return { error: "It couldn't find the announcement yet.", note };
  const draft = draftFromTool(input);
  if (event.kind === "bankRate" && !draft.outcome) return { error: "Its draft had no new Bank Rate.", note };
  const now = new Date().toISOString();
  await db("event_emails?on_conflict=event_id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
    body: { event_id: event.id, ...draft, note, drafted_by: "claude", drafted_at: now, approved_at: null, updated_at: now } });
  return { draft, note };
}

// Drafts the Sunday email for `week` and saves it unapproved. `replace`:
// over whatever was there (asked for on the admin page); otherwise only if
// nothing has been saved meanwhile. Returns { draft, note } or { error, note }.
async function draftWeekly(week, ukToday, { replace = false, deadline } = {}) {
  let input;
  try { input = await askClaude({ system: weeklyDraftSystem(), prompt: weeklyDraftPrompt(week, ukToday, EVENTS), tool: WEEKLY_DRAFT_TOOL, searches: WEEKLY_SEARCHES, deadline }); }
  catch (e) { return { error: e.message, note: "" }; }
  const note = typeof input?.note === "string" ? input.note.trim().slice(0, 2000) : "";
  const draft = weeklyDraftFromTool(input);
  if (!draft.items.length) return { error: "Its draft had no news items.", note };
  try {
    const saved = await db("weekly_issues?on_conflict=week", { method: "POST", prefer: `resolution=${replace ? "merge" : "ignore"}-duplicates,return=representation`,
      body: { week, ...draft, approved_at: null, updated_at: new Date().toISOString() } });
    if (!saved?.length) return { error: "An issue was saved for that week while Claude drafted, so it was left as it was.", note };
  } catch (e) { return { error: `Its draft couldn't be saved: ${e.message}`, note }; }
  return { draft, note };
}
const weeklyRow = async week => (await db(`weekly_issues?select=week,subject,intro,items,approved_at,updated_at&week=eq.${week}`))?.[0] || null;

// The flag, once per event and outcome (alert_sends), so a second run
// the same day doesn't send it twice.
async function flag(event, result, ukToday) {
  const mail = flagEmail(event, result);
  const key = result.draft ? `event-flag:${event.id}` : `event-flag:${event.id}:missing:${ukToday}`;
  return sendOnce({ to: FLAG_TO, key, kind: "eventFlag", detail: null, subject: mail.subject, text: mail.text, html: null });
}

// The cron: each event on its day, or the day after if that found nothing,
// that has no draft yet; and on Saturday, the next day's Sunday email.
async function run(now = new Date()) {
  const today = ukDay(now), deadline = Date.now() + RUN_BUDGET_MS;
  const results = await runEvents(now);
  if (new Date(`${today}T12:00:00Z`).getUTCDay() === WEEKLY_DRAFT_DAY) {
    results.weekly = await runWeekly(today, deadline).catch(e => ({ error: e.message }));
  }
  return results;
}

// Unless one's there already (written by hand, or drafted earlier): a run
// that fails is flagged once, to be drafted from the alerts page.
async function runWeekly(today, deadline) {
  const week = nextSunday(new Date(`${today}T12:00:00Z`));
  if (await weeklyRow(week)) return { week, drafted: false, existing: true };
  const result = deadline - Date.now() < WEEKLY_MIN_MS
    ? { error: "The run had no time left after the day's event email.", note: "" }
    : await draftWeekly(week, today, { deadline });
  const mail = weeklyFlagEmail(week, result);
  const flagged = await sendOnce({ to: FLAG_TO, key: `weekly-flag:${week}`, kind: "weeklyFlag", detail: null, subject: mail.subject, text: mail.text, html: null })
    .catch(e => `flag failed: ${e.message}`);
  return { week, drafted: !!result.draft, error: result.error || null, flagged };
}

async function runEvents(now) {
  const today = ukDay(now), yesterday = ukDay(now - DAY_MS);
  const due = EVENTS.filter(e => e.date === today || e.date === yesterday);
  if (!due.length) return { due: 0 };
  const have = new Set((await rowsFor(due.map(e => e.id)) || []).map(r => r.event_id));
  const results = [];
  for (const event of due.filter(e => !have.has(e.id))) {
    const result = await draftEvent(event, today);
    const flagged = await flag(event, result, today).catch(e => `flag failed: ${e.message}`);
    results.push({ event: event.id, drafted: !!result.draft, error: result.error || null, flagged });
  }
  return { due: due.length, results };
}

// ── The route ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!SUPA_URL || !SERVICE_KEY) {
    console.error("[api/events] Supabase service key not configured");
    return res.status(503).json({ error: "Service temporarily unavailable" });
  }

  if (req.method === "GET") {
    // Vercel Cron: GET with the cron secret.
    if (CRON_SECRET && safeEqual(req.headers.authorization, `Bearer ${CRON_SECRET}`)) {
      if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "ANTHROPIC_API_KEY isn't set" });
      try {
        const results = await run();
        console.log("[api/events] cron run:", JSON.stringify(results));
        return res.status(200).json({ results });
      } catch (e) {
        console.error("[api/events] cron run failed:", e);
        return res.status(500).json({ error: "Event run failed" });
      }
    }
    // The app: what recent events announced, approved emails only.
    try {
      const today = ukDay(new Date()), from = ukDay(Date.now() - EVENT_SHOW_DAYS * DAY_MS);
      const ids = EVENTS.filter(e => between(e.date, from, today)).map(e => e.id);
      const rows = ids.length ? await db(`event_emails?select=event_id,outcome,items&approved_at=not.is.null&event_id=in.(${ids.map(encodeURIComponent).join(",")})`) : [];
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({ events: rows || [] });
    } catch (e) {
      console.error("[api/events] read failed:", e);
      return res.status(200).json({ events: [] });
    }
  }

  // Everything else is the admin page.
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "Service temporarily unavailable" });
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden" });
  const auth = await checkAdminPassword(req, ADMIN_PASSWORD, adminLimiter, "api/events");
  if (auth === 429) return res.status(429).json({ error: "Too many attempts, try again shortly" });
  if (auth === 401) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { action, id, draft, approved } = req.body || {};
    const listed = () => {
      const from = ukDay(Date.now() - LIST_BACK_DAYS * DAY_MS), to = ukDay(Date.now() + LIST_AHEAD_DAYS * DAY_MS);
      return EVENTS.filter(e => between(e.date, from, to));
    };
    // The listed events and their drafts, with anything else to say.
    const reply = async (extra = {}) => {
      const events = listed();
      return res.status(200).json({ events, rows: await rowsFor(events.map(e => e.id)) || [], ...extra });
    };
    if (action === "events-load") return await reply();
    if (action === "weekly-draft") {
      const { week } = req.body;
      if (typeof week !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(week) || new Date(`${week}T12:00:00Z`).getUTCDay() !== 0) return res.status(400).json({ error: "Pick a Sunday" });
      if (week < nextSunday(new Date(`${ukDay(new Date())}T12:00:00Z`))) return res.status(400).json({ error: "That Sunday has passed" });
      if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "ANTHROPIC_API_KEY isn't set" });
      const result = await draftWeekly(week, ukDay(new Date()), { replace: true, deadline: Date.now() + RUN_BUDGET_MS });
      return res.status(200).json({ issue: await weeklyRow(week), ...(result.error ? { draftError: result.error } : {}), draftNote: result.note });
    }
    const event = EVENTS.find(e => e.id === id);
    if (!event) return res.status(400).json({ error: "Unknown event" });
    if (action === "event-save") {
      // Saving changes it, so it needs approving again.
      await db("event_emails?on_conflict=event_id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
        body: { event_id: id, ...cleanEventDraft(draft), approved_at: null, updated_at: new Date().toISOString() } });
      return await reply();
    }
    if (action === "event-approve") {
      if (approved && event.kind === "bankRate") {
        const [row] = await rowsFor([id]) || [];
        if (row?.outcome?.to == null) return res.status(400).json({ error: "Add the new Bank Rate before approving" });
      }
      await db(`event_emails?event_id=eq.${encodeURIComponent(id)}`, { method: "PATCH", prefer: "return=minimal", body: { approved_at: approved ? new Date().toISOString() : null } });
      return await reply();
    }
    if (action === "event-draft") {
      if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "ANTHROPIC_API_KEY isn't set" });
      const result = await draftEvent(event, ukDay(new Date()));
      return await reply(result.error ? { draftError: result.error, draftNote: result.note } : {});
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("[api/events] admin action failed:", e);
    return res.status(500).json({ error: "Something went wrong. The details are in the function log." });
  }
}
