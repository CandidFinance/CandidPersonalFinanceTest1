import { isAllowedOrigin, clientIp, safeEqual, rateLimiter, checkAdminPassword } from "../server/http.js";
import { alertsDue, alertEmail, inputsFromRow, isFounding, FREE_RATES_DELAY_DAYS } from "../src/lib/alerts.js";
import { weeklyWeek, weeklyEmail, welcomeEmail, cleanIssue, PAID_PLANS, REFERRAL_MONTHS } from "../src/lib/weekly.js";
import { confirmedWelcomeEmail } from "../src/lib/accountEmails.js";
import { unsubscribeUrl, optInUrl, emailFromToken, sendMail, sendOnce, TOKEN_SECRET } from "../server/alertMail.js";
import { referralLink } from "../server/referrals.js";

// Candid's emails between visits (src/lib/alerts.js decides what's due),
// subscribers' welcome and the Sunday email (src/lib/weekly.js). One route:
//  - Vercel Cron, daily at 04:00 UTC (vercel.json; Vercel may start it
//    any time in that hour), so emails arrive before 6am UK time, after
//    api/rates has refreshed the rates at 03:00. Authorised by CRON_SECRET: works out
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
//  - A free user's welcome goes the day after they confirm their email
//    (alert_sends key "confirmed"): rate alerts to turn on, free for
//    founding users, and their invite link (confirmedWelcomes).
//  - ?action=unsubscribe&t=…, the link in every email (and its one-click
//    List-Unsubscribe header): adds the email to `alert_optouts`.
//  - ?action=optin&t=…, the welcome's link: a tick box that turns on rate
//    alerts for that address.
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
// A confirmation older than this gets no welcome: a missed run catches up,
// but no one who confirmed long ago gets one out of the blue.
const WELCOME_LOOKBACK_DAYS = 4;
const DAY_MS = 86400000;
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
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// The date in the UK, as YYYY-MM-DD.
const ukDay = d => new Date(d).toLocaleDateString("en-CA", { timeZone: "Europe/London" });

// Someone's rows in `test`, newest first. Rows keep the address as typed,
// so it's matched without case, then exactly.
async function rowsFor(email, columns) {
  const rows = await db(`test?select=email,${columns}&email=ilike.${encodeURIComponent(email)}&order=id.desc&limit=50`);
  return (rows || []).filter(r => cleanEmail(r.email) === email);
}

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

// The day after a free user confirms their email (by UK date), their
// welcome, once. Not for subscribers, who have their own. Their name, and
// whether they've asked for emails already, from their latest row. Invite
// codes are made only when `makeCodes` (a live run), so a preview never
// makes one.
async function confirmedWelcomes(today, { verified, people, out, sentBy, codeOf, makeCodes }, notes) {
  const subscribers = new Set(people.filter(p => p.who === "subscriber").map(p => p.email));
  const due = (verified || []).filter(v => {
    const email = cleanEmail(v.email);
    return email && ukDay(v.verified_at) < ukDay(today) && today - new Date(v.verified_at) < WELCOME_LOOKBACK_DAYS * DAY_MS
      && !out.has(email) && !subscribers.has(email) && !(sentBy.get(email) || []).some(s => s.alert_key === "confirmed");
  });
  const emails = await Promise.all(due.map(async v => {
    const email = cleanEmail(v.email);
    try {
      const rows = await rowsFor(email, "name,alerts_opt_in,unlock_call_ok");
      const code = codeOf.get(email) || (makeCodes ? (await referralLink(email)).code : null) || null;
      const mail = confirmedWelcomeEmail({
        name: rows[0]?.name, founding: isFounding(v.verified_at), optedIn: rows.some(r => r.alerts_opt_in || r.unlock_call_ok),
        optInUrl: optInUrl(email), inviteCode: code, cap: REFERRAL_MONTHS, unsubscribeUrl: unsubscribeUrl(email),
      });
      return { to: email, who: "free", kind: "confirmed", key: "confirmed", detail: null, ...mail };
    } catch (e) {
      notes.push(`couldn't write the welcome for one confirmed free user: ${e.message}`);
      return null;
    }
  }));
  return emails.filter(Boolean);
}

export async function plan(today = new Date(), { drafts = false, makeCodes = false } = {}) {
  const notes = [];
  const since = new Date(today - SENT_LOOKBACK_DAYS * 86400000).toISOString();
  const week = weeklyWeek(today);
  const [people, optouts, verified, sent, rates, issues, codes] = await Promise.all([
    recipients(notes),
    optional("alert_optouts?select=email", notes, "alert_optouts"),
    optional("email_verifications?select=email,verified_at&verified_at=not.is.null", notes, "email_verifications"),
    optional(`alert_sends?select=email,alert_key,kind,sent_at,detail&sent_at=gte.${since}`, notes, "alert_sends"),
    db(`savings_rates?select=${RATE_COLUMNS}&order=rate_aer.desc`),
    week ? optional(`weekly_issues?select=week,subject,intro,items,approved_at&week=eq.${week}`, notes, "weekly_issues") : [],
    optional("referral_codes?select=email,code", notes, "referral_codes"),
  ]);
  // Invite links for the welcome: read only, so a preview never makes one.
  const codeOf = new Map((codes || []).map(c => [cleanEmail(c.email), c.code]));
  // This week's Sunday email: approved, or for the preview, a draft.
  const issue = issues?.[0] && (issues[0].approved_at || drafts) ? issues[0] : null;
  if (issues?.[0] && !issues[0].approved_at) notes.push(`The issue for ${week} isn't approved${drafts ? ": shown here, but it won't go out" : ", so it won't go out"}`);
  const out = new Set((optouts || []).map(o => cleanEmail(o.email)));
  const verifiedAt = new Map((verified || []).map(v => [cleanEmail(v.email), v.verified_at]));
  const sentBy = new Map();
  for (const s of sent || []) {
    const e = cleanEmail(s.email);
    if (!sentBy.has(e)) sentBy.set(e, []);
    sentBy.get(e).push(s);
  }
  const emails = [];
  for (const p of people) {
    if (out.has(p.email) || (p.who === "free" && !verifiedAt.has(p.email))) continue;
    const done = new Set((sentBy.get(p.email) || []).map(s => s.alert_key));
    const unsubscribe = unsubscribeUrl(p.email);
    if (p.who === "subscriber" && PAID_PLANS.includes(p.sub.plan) && !done.has("welcome") && new Date(p.sub.created_at) > new Date(since)) {
      const mail = welcomeEmail({ name: p.d?.name, plan: p.sub.plan, amountPence: p.sub.amount_pence, periodEnd: p.sub.current_period_end, inviteCode: codeOf.get(p.email) || null, unsubscribeUrl: unsubscribe });
      emails.push({ to: p.email, who: p.who, kind: "welcome", key: "welcome", detail: null, ...mail });
    }
    if (!p.d) continue;
    if (issue && p.who === "subscriber" && !done.has(`weekly:${issue.week}`)) {
      try {
        const mail = weeklyEmail(issue, p.d, { today, rows: rates || [], unsubscribeUrl: unsubscribe });
        emails.push({ to: p.email, who: p.who, kind: "weekly", key: `weekly:${issue.week}`, detail: null, ...mail });
      } catch (e) { notes.push(`couldn't write the Sunday email for one subscriber: ${e.message}`); }
    }
    // A free user's better rates: founding users only, from a few days
    // after they confirm, so the first never lands with their welcome.
    const confirmedAt = verifiedAt.get(p.email);
    const ratesFrom = p.who !== "free" ? null : isFounding(confirmedAt) ? new Date(new Date(confirmedAt).getTime() + FREE_RATES_DELAY_DAYS * DAY_MS) : false;
    let due;
    try { due = alertsDue(p.d, { who: p.who, today, sent: sentBy.get(p.email) || [], rows: rates || [], ratesFrom }); }
    catch (e) { notes.push(`couldn't work out alerts for one ${p.who}: ${e.message}`); continue; }
    for (const a of due) {
      const mail = alertEmail(a, { name: p.d.name, free: p.who === "free", asOf: p.asOf, unsubscribeUrl: unsubscribe });
      emails.push({ to: p.email, who: p.who, kind: a.kind, key: a.key, detail: a.detail || null, ...mail });
    }
  }
  emails.push(...await confirmedWelcomes(today, { verified, people, out, sentBy, codeOf, makeCodes }, notes));
  return { emails, notes, people: people.length, ready: optouts !== null && sent !== null };
}

async function run(today = new Date()) {
  const started = Date.now();
  const { emails, notes, people, ready } = await plan(today, { makeCodes: LIVE });
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
main{max-width:420px;text-align:center}label{display:flex;gap:10px;align-items:flex-start;text-align:left;margin:20px 0;line-height:1.5}input{width:18px;height:18px;margin:2px 0 0;flex:none;accent-color:#162f24}h1{font-family:Georgia,serif;color:#162f24;font-size:24px}p{line-height:1.5;color:#4a5a52}
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

// The welcome's "Turn on rate alerts": opening the link shows the tick box,
// and only the form's POST changes anything, so a mail scanner opening it
// can't sign anyone up. Ticked, it's the same as the app's "Get rate
// alerts" on every row with their address, and takes them off
// `alert_optouts`: asking for alerts outranks stopping emails earlier.
async function optIn(req, res) {
  if (unsubscribeLimiter) {
    const { success } = await unsubscribeLimiter.limit(clientIp(req)).catch(() => ({ success: true }));
    if (!success) return res.status(429).send("Too many requests. Try again shortly.");
  }
  const t = String(req.query.t || "");
  const email = emailFromToken(t, "optin");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!email) return res.status(400).send(page("Link not recognised", `<h1>That link isn't working</h1><p>Reply to any Candid email and we'll turn rate alerts on for you.</p>`));
  if (req.method === "GET") {
    const action = `/api/alerts?action=optin&t=${encodeURIComponent(t)}`;
    return res.status(200).send(page("Turn on rate alerts", `<h1>Rate alerts</h1><p>Free for founding users: an email when a better savings rate could earn you £100+ a year more on your figures, at most once a month.</p><form method="post" action="${action}"><label><input type="checkbox" name="optin" value="1" required><span>Email me rate alerts at ${esc(email)}</span></label><button type="submit">Turn on rate alerts</button></form>`));
  }
  if (req.method !== "POST") return res.status(405).end();
  if (req.body?.optin !== "1") return res.status(400).send(page("Nothing changed", `<h1>Nothing changed</h1><p>Tick the box to turn rate alerts on.</p><p><a href="${SITE}/app/home">Back to Candid</a></p>`));
  const rows = await rowsFor(email, "id");
  if (!rows.length) return res.status(404).send(page("Answers not found", `<h1>We couldn't find your answers</h1><p>Reply to any Candid email and we'll turn rate alerts on for you.</p>`));
  await db(`test?id=in.(${rows.map(r => +r.id).join(",")})`, { method: "PATCH", prefer: "return=minimal", body: { alerts_opt_in: true } });
  await db(`alert_optouts?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" });
  return res.status(200).send(page("Rate alerts on", `<h1>Done</h1><p>We'll email you when a better savings rate could earn you £100+ a year more, at most once a month. You can stop them from any Candid email.</p><p><a href="${SITE}/app/home">Back to Candid</a></p>`));
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
  if (req.query?.action === "optin") {
    try { return await optIn(req, res); }
    catch (e) { console.error("[api/alerts] opt-in failed:", e); return res.status(500).send("Something went wrong. Reply to any Candid email and we'll turn rate alerts on for you."); }
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
  const auth = await checkAdminPassword(req, ADMIN_PASSWORD, adminLimiter, "api/alerts");
  if (auth === 429) return res.status(429).json({ error: "Too many attempts, try again shortly" });
  if (auth === 401) return res.status(401).json({ error: "Unauthorized" });
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
        notes: preview.notes, emails: preview.emails.slice(0, PREVIEW_MAX).map(({ to, who, kind, subject, text, html }) => ({ to, who, kind, subject, text, html })),
      });
    }
    if (action === "test") {
      const address = cleanEmail(to);
      const e = preview.emails[+index];
      if (!address) return res.status(400).json({ error: "Enter an email address to send the test to" });
      if (!e) return res.status(400).json({ error: "No email at that position" });
      if (!RESEND_KEY) return res.status(503).json({ error: "RESEND_API_KEY isn't set" });
      // To the address given, not the person: nothing recorded.
      await sendMail(address, `[Test] ${e.subject}`, e.text, null, e.html);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("[api/alerts] admin action failed:", e);
    return res.status(500).json({ error: "Something went wrong. The details are in the function log." });
  }
}
