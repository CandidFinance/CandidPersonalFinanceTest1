import { isAllowedOrigin, clientIp, safeEqual, rateLimiter } from "../server/http.js";
import { alertsDue, alertEmail, inputsFromRow } from "../src/lib/alerts.js";
import { weeklyWeek, weeklyEmail, welcomeEmail, cleanIssue, PAID_PLANS } from "../src/lib/weekly.js";
import { unsubscribeUrl, emailFromToken, sendMail, sendOnce, TOKEN_SECRET } from "../server/alertMail.js";

// Candid's emails between visits (src/lib/alerts.js decides what's due),
// subscribers' welcome and the Sunday email (src/lib/weekly.js). One route:
//  - Vercel Cron, daily (vercel.json), authorised by CRON_SECRET: works out
//    what's due for everyone who can get emails and, when sending is on,
//    sends it. Each send is recorded in `alert_sends` first (unique per
//    person and alert), so a second run the same day never sends twice;
//    a failed send is taken back off, to go the next day.
//  - The /admin/alerts page, authorised by FEEDBACK_ADMIN_PASSWORD: a
//    preview of what would go out on any date, and one of them sent to an
//    address of your choosing as a test; and the Sunday email's issue for
//    each week, written, saved and approved there (weekly_issues). Only an
//    approved issue goes out; the preview shows a draft too.
//  - The welcome goes to each paid subscriber once (alert_sends key
//    "welcome"): from api/billing.js as they subscribe, and from the daily
//    run for anyone that missed it.
//  - ?action=unsubscribe&t=…, the link in every email (and its one-click
//    List-Unsubscribe header): adds the email to `alert_optouts`.
//
// A free user gets emails only once they've confirmed their address (its
// link, api/email.js, sets `email_verifications.verified_at`). Subscribers
// gave theirs to Stripe and sign in with it, so theirs needs no link.
// Before that table is there, no free user is emailed; subscribers still are.
//
// Sending is off until VITE_ALERTS_LIVE=1 (the same setting shows the emails
// on the paywall's list of what a subscription adds). Until then the cron
// is a dry run: nothing is sent or recorded.
//
// Everything goes through the service-role key; `alert_sends` and
// `alert_optouts` can't be read or written with the anon key
// (supabase/hand-run/supabase_alerts_migration.sql).

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.FEEDBACK_ADMIN_PASSWORD;
const CRON_SECRET = process.env.CRON_SECRET;
const RESEND_KEY = process.env.RESEND_API_KEY;
const LIVE = process.env.VITE_ALERTS_LIVE === "1";
const SITE = "https://www.candid-finance.co.uk";
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

const ACTIVE = ["active", "trialing", "past_due"];
const SENT_LOOKBACK_DAYS = 400;
const RUN_BUDGET_MS = 50000;
const CONCURRENCY = 3;
const PREVIEW_MAX = 300;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROW_COLUMNS = "id,created_at,email,name,age,employment_status,salary,other_income,monthly_expenses,cash_savings,savings_rate,premium_bonds,has_pension,pension_my_pct,pension_employer_pct,pension_pot,has_bonus,bonus_amount,has_kids,num_kids,isa_this_year,student_loan_plan,student_loan_balance";
const RATE_COLUMNS = "id,provider_name,product_name,account_type,rate_aer,max_balance,bonus_rate,bonus_months,rate_after,app_only,product_url,updated_at,is_isa";

const adminLimiter = rateLimiter(20, "10 m", "ratelimit:alerts-admin");
const unsubscribeLimiter = rateLimiter(30, "10 m", "ratelimit:alerts-unsubscribe");

// ── Supabase (service role) ──────────────────────────────────────────────────
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
// Every row, a page at a time (PostgREST stops at 1,000 by default).
async function all(path) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await db(`${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${offset}`);
    out.push(...(page || []));
    if (!page || page.length < 1000) return out;
  }
}

const cleanEmail = e => (typeof e === "string" && EMAIL_RE.test(e.trim())) ? e.trim().toLowerCase() : null;

// ── Who can get emails, and what's due for each ──────────────────────────────
// Subscribers, on their saved answers; free users who asked for emails, on
// their latest row. Anyone who has unsubscribed is left out. `notes` says
// what couldn't be read (a missing table, before the SQL is run): in a live
// run that stops everything, so no one who unsubscribed is ever emailed.
async function recipients(notes) {
  const subs = await all(`subscriptions?select=email,status,plan,amount_pence,current_period_end,created_at,saved_state&status=in.(${ACTIVE.join(",")})`);
  let rows;
  try {
    rows = await all(`test?select=${ROW_COLUMNS}&or=(unlock_call_ok.is.true,alerts_opt_in.is.true)&email=not.is.null&order=id.desc`);
  } catch (e) {
    // alerts_opt_in not added yet: the unlock tick box only.
    notes.push("test.alerts_opt_in is missing, so only the unlock tick box counts");
    rows = await all(`test?select=${ROW_COLUMNS}&unlock_call_ok=is.true&email=not.is.null&order=id.desc`);
  }
  const people = new Map();
  for (const s of subs) {
    const email = cleanEmail(s.email);
    // Saved as { inputs, completedModules } (entitlement.js saveStateSoon).
    const d = s.saved_state?.inputs;
    // Paid, before their answers are saved: the welcome still goes.
    if (email && (d && typeof d === "object" || PAID_PLANS.includes(s.plan))) people.set(email, { email, who: "subscriber", d: d && typeof d === "object" ? d : null, sub: s });
  }
  // Newest row first, so the first one seen for an email is their latest.
  for (const r of rows) {
    const email = cleanEmail(r.email);
    if (email && !people.has(email)) people.set(email, { email, who: "free", d: inputsFromRow(r), asOf: r.created_at ? new Date(r.created_at) : null });
  }
  return [...people.values()];
}

async function optional(path, notes, label) {
  try { return await all(path); }
  catch (e) { notes.push(`${label} couldn't be read (${e.status || "error"})`); return null; }
}

export async function plan(today = new Date(), { drafts = false } = {}) {
  const notes = [];
  const since = new Date(today - SENT_LOOKBACK_DAYS * 86400000).toISOString();
  const week = weeklyWeek(today);
  const [people, optouts, verified, sent, rates, issues] = await Promise.all([
    recipients(notes),
    optional("alert_optouts?select=email", notes, "alert_optouts"),
    optional("email_verifications?select=email&verified_at=not.is.null", notes, "email_verifications"),
    optional(`alert_sends?select=email,alert_key,kind,sent_at,detail&sent_at=gte.${since}`, notes, "alert_sends"),
    db(`savings_rates?select=${RATE_COLUMNS}&order=rate_aer.desc`),
    week ? optional(`weekly_issues?select=week,subject,intro,items,approved_at&week=eq.${week}`, notes, "weekly_issues") : [],
  ]);
  // This week's Sunday email: approved, or for the preview, a draft.
  const issue = issues?.[0] && (issues[0].approved_at || drafts) ? issues[0] : null;
  if (issues?.[0] && !issues[0].approved_at) notes.push(`The issue for ${week} isn't approved${drafts ? ": shown here, but it won't go out" : ", so it won't go out"}`);
  const out = new Set((optouts || []).map(o => cleanEmail(o.email)));
  const confirmed = new Set((verified || []).map(v => cleanEmail(v.email)));
  const sentBy = new Map();
  for (const s of sent || []) {
    const e = cleanEmail(s.email);
    if (!sentBy.has(e)) sentBy.set(e, []);
    sentBy.get(e).push(s);
  }
  const emails = [];
  for (const p of people) {
    if (out.has(p.email) || (p.who === "free" && !confirmed.has(p.email))) continue;
    const done = new Set((sentBy.get(p.email) || []).map(s => s.alert_key));
    const unsubscribe = unsubscribeUrl(p.email);
    if (p.who === "subscriber" && PAID_PLANS.includes(p.sub.plan) && !done.has("welcome") && new Date(p.sub.created_at) > new Date(since)) {
      const mail = welcomeEmail({ name: p.d?.name, plan: p.sub.plan, amountPence: p.sub.amount_pence, periodEnd: p.sub.current_period_end, unsubscribeUrl: unsubscribe });
      emails.push({ to: p.email, who: p.who, kind: "welcome", key: "welcome", detail: null, ...mail });
    }
    if (!p.d) continue;
    if (issue && p.who === "subscriber" && !done.has(`weekly:${issue.week}`)) {
      try {
        const mail = weeklyEmail(issue, p.d, { today, rows: rates || [], unsubscribeUrl: unsubscribe });
        emails.push({ to: p.email, who: p.who, kind: "weekly", key: `weekly:${issue.week}`, detail: null, ...mail });
      } catch (e) { notes.push(`couldn't write the Sunday email for one subscriber: ${e.message}`); }
    }
    let due;
    try { due = alertsDue(p.d, { who: p.who, today, sent: sentBy.get(p.email) || [], rows: rates || [] }); }
    catch (e) { notes.push(`couldn't work out alerts for one ${p.who}: ${e.message}`); continue; }
    for (const a of due) {
      const mail = alertEmail(a, { name: p.d.name, free: p.who === "free", asOf: p.asOf, unsubscribeUrl: unsubscribe });
      emails.push({ to: p.email, who: p.who, kind: a.kind, key: a.key, detail: a.detail || null, ...mail });
    }
  }
  return { emails, notes, people: people.length, ready: optouts !== null && sent !== null };
}

async function run(today = new Date()) {
  const started = Date.now();
  const { emails, notes, people, ready } = await plan(today);
  const byKind = emails.reduce((t, e) => ({ ...t, [e.kind]: (t[e.kind] || 0) + 1 }), {});
  if (!LIVE) return { live: false, people, due: emails.length, byKind, notes };
  if (!ready || !RESEND_KEY || !TOKEN_SECRET) return { live: true, stopped: "Not sending: the alert tables, RESEND_API_KEY or a token secret is missing", notes };
  const results = { sent: 0, duplicate: 0, failed: 0, left: 0 };
  const queue = [...emails];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      if (Date.now() - started > RUN_BUDGET_MS) { results.left = queue.length; queue.length = 0; return; }
      results[await sendOnce(queue.shift())]++;
    }
  }));
  return { live: true, people, due: emails.length, byKind, ...results, notes };
}

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#f8f5ee;color:#1d2b24;font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
main{max-width:420px;text-align:center}h1{font-family:Georgia,serif;color:#162f24;font-size:24px}p{line-height:1.5;color:#4a5a52}
button{background:#162f24;color:#fff;border:0;border-radius:100px;padding:13px 26px;font-size:15px;font-weight:700;cursor:pointer}a{color:#162f24}</style></head>
<body><main>${body}</main></body></html>`;

async function unsubscribe(req, res) {
  if (unsubscribeLimiter) {
    const { success } = await unsubscribeLimiter.limit(clientIp(req)).catch(() => ({ success: true }));
    if (!success) return res.status(429).send("Too many requests. Try again shortly.");
  }
  const t = String(req.query.t || "");
  const email = emailFromToken(t);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!email) return res.status(400).send(page("Link not recognised", `<h1>That link isn't working</h1><p>Reply to any Candid email and we'll stop them for you.</p>`));
  // A GET (opening the link) asks first, so a mail scanner opening links
  // can't unsubscribe anyone; the button, and mail apps' one-click
  // unsubscribe, POST.
  if (req.method === "GET") {
    const action = `/api/alerts?action=unsubscribe&t=${encodeURIComponent(t)}`;
    return res.status(200).send(page("Stop Candid's emails", `<h1>Stop Candid's emails?</h1><p>You won't get the Sunday email, reminders or rate alerts at this address any more.</p><form method="post" action="${action}"><button type="submit">Stop the emails</button></form>`));
  }
  if (req.method !== "POST") return res.status(405).end();
  await db("alert_optouts?on_conflict=email", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { email } });
  return res.status(200).send(page("Emails stopped", `<h1>Done</h1><p>You won't get Candid's Sunday email, reminders or rate alerts any more. Your figures in the app are unchanged.</p><p><a href="${SITE}/app/home">Back to Candid</a></p>`));
}

// ── The route ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!SUPA_URL || !SERVICE_KEY) {
    console.error("[api/alerts] Supabase service key not configured");
    return res.status(503).json({ error: "Service temporarily unavailable" });
  }
  if (req.query?.action === "unsubscribe") {
    try { return await unsubscribe(req, res); }
    catch (e) { console.error("[api/alerts] unsubscribe failed:", e); return res.status(500).send("Something went wrong. Reply to any Candid email and we'll stop them for you."); }
  }

  // Vercel Cron: GET with the cron secret.
  if (req.method === "GET" && CRON_SECRET && safeEqual(req.headers.authorization, `Bearer ${CRON_SECRET}`)) {
    try {
      const results = await run();
      console.log("[api/alerts] cron run:", JSON.stringify(results));
      return res.status(200).json({ results });
    } catch (e) {
      console.error("[api/alerts] cron run failed:", e);
      return res.status(500).json({ error: "Alert run failed" });
    }
  }

  // Everything else is the admin page.
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "Service temporarily unavailable" });
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden" });
  if (adminLimiter) {
    try {
      const { success } = await adminLimiter.limit(clientIp(req));
      if (!success) return res.status(429).json({ error: "Too many attempts, try again shortly" });
    } catch (e) {
      console.error("[api/alerts] rate-limit check failed:", e?.message);
    }
  }
  if (!safeEqual(req.headers["x-admin-password"], ADMIN_PASSWORD)) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { action, date, index, to, week, issue } = req.body || {};
    // The Sunday email's issue for a week: read, saved, approved.
    if (action === "weekly-load" || action === "weekly-save" || action === "weekly-approve") {
      if (typeof week !== "string" || !WEEK_RE.test(week) || new Date(`${week}T12:00:00Z`).getUTCDay() !== 0) return res.status(400).json({ error: "Pick a Sunday" });
      if (action === "weekly-save") {
        // Saving changes it, so it needs approving again.
        await db("weekly_issues?on_conflict=week", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
          body: { week, ...cleanIssue(issue), approved_at: null, updated_at: new Date().toISOString() } });
      } else if (action === "weekly-approve") {
        await db(`weekly_issues?week=eq.${week}`, { method: "PATCH", prefer: "return=minimal", body: { approved_at: req.body.approved ? new Date().toISOString() : null } });
      }
      const rows = await db(`weekly_issues?select=week,subject,intro,items,approved_at,updated_at&week=eq.${week}`);
      return res.status(200).json({ issue: rows?.[0] || null });
    }
    const today = date ? new Date(`${date}T08:00:00Z`) : new Date();
    if (isNaN(today)) return res.status(400).json({ error: "Bad date" });
    const preview = await plan(today, { drafts: true });
    if (action === "preview") {
      return res.status(200).json({
        live: LIVE, date: today.toISOString().slice(0, 10), people: preview.people, due: preview.emails.length,
        notes: preview.notes, emails: preview.emails.slice(0, PREVIEW_MAX).map(({ to, who, kind, subject, text }) => ({ to, who, kind, subject, text })),
      });
    }
    if (action === "test") {
      const address = cleanEmail(to);
      const e = preview.emails[+index];
      if (!address) return res.status(400).json({ error: "Enter an email address to send the test to" });
      if (!e) return res.status(400).json({ error: "No email at that position" });
      if (!RESEND_KEY) return res.status(503).json({ error: "RESEND_API_KEY isn't set" });
      // To the address given, not the person: nothing recorded.
      await sendMail(address, `[Test] ${e.subject}`, e.text, null);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("[api/alerts] admin action failed:", e);
    return res.status(500).json({ error: "Something went wrong. The details are in the function log." });
  }
}
