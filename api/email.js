import { promises as dns } from "dns";
import { isAllowedOrigin, clientIp, rateLimiter } from "../server/http.js";
import { confirmUrl, emailFromConfirmToken, LINK_DAYS } from "../server/confirmLink.js";
import { checkEmail } from "../src/lib/emailCheck.js";
import { recordReferral, rewardReferral } from "../server/referrals.js";
import { confirmEmail } from "../src/lib/accountEmails.js";

// Checking and confirming the emails people leave for their first answer or
// for rate alerts (src/lib/emailCheck.js, MobileUnlock.jsx).
//  - POST { action: "check", email, confirm }: the address's shape and
//    domain (src/lib/emailCheck.js), then whether the domain takes email
//    (its MX records). A problem is a 422 with { problem }; everything else
//    is a 200, including a lookup that couldn't finish, so the answer is
//    never held up. With `confirm` ({ module, amount }, both optional), a
//    link to confirm the address is theirs is emailed, unless it's
//    confirmed already or one went out in the last few minutes. With
//    `confirm.ref`, the code of the friend's link they arrived on, a
//    referral is recorded, and confirming rewards it (server/referrals.js).
//  - POST { action: "status", email }: whether that address is confirmed
//    ({ confirmed: true | false }), for Edit inputs to offer a link for one
//    that isn't. It says no more than "check" does with `confirm`.
//  - ?action=confirm&t=…, that link: a page with one button, which POSTs
//    and records `verified_at`. A GET only asks, so a mail scanner opening
//    the link can't confirm anyone.
//
// Who has confirmed is in `email_verifications`, service-role only
// (supabase/hand-run/supabase_email_verification_migration.sql). Only a
// confirmed address that asked for emails gets them (api/alerts.js), and
// `crm_contacts` lists exactly those.

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const TOKEN_SECRET = process.env.ALERTS_TOKEN_SECRET || process.env.STRIPE_BILLING_TOKEN_SECRET;
const MAIL_FROM = process.env.ALERTS_MAIL_FROM || process.env.BILLING_MAIL_FROM || "Candid <admin@candid-finance.co.uk>";
const MAIL_REPLY_TO = "admin@candid-finance.co.uk";
const SITE = "https://www.candid-finance.co.uk";

const DNS_TIMEOUT_MS = 2500;
const RESEND_AFTER_MS = 10 * 60 * 1000;
const MAX_SENDS = 5;
const MODULE_TITLES = { cash: "Cash & savings", investments: "Investments", pension: "Pension", studentLoan: "Student loan", kids: "Kids & family" };

const checkLimiter = rateLimiter(15, "10 m", "ratelimit:email-check");
const confirmLimiter = rateLimiter(30, "10 m", "ratelimit:email-confirm");
const statusLimiter = rateLimiter(30, "10 m", "ratelimit:email-status");

async function db(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

const key = email => email.toLowerCase();

// Whether the domain takes email: "no" when it doesn't exist or has no mail
// servers (or a null MX, RFC 7505), "unknown" when the lookup didn't finish.
async function takesMail(domain) {
  try {
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), DNS_TIMEOUT_MS)),
    ]);
    return mx.some(r => r.exchange && r.exchange !== ".") ? "yes" : "no";
  } catch (e) {
    return e.code === "ENOTFOUND" || e.code === "ENODATA" ? "no" : "unknown";
  }
}

// The confirmation email (src/lib/accountEmails.js), with the answer they
// just got when there is one.
function confirmMail(email, { module, amount, name } = {}) {
  const figure = Number.isFinite(amount) && amount > 0 && amount < 10_000_000 ? `£${Math.round(amount).toLocaleString("en-GB")}` : null;
  return confirmEmail({ name, title: MODULE_TITLES[module] || null, figure, url: confirmUrl(email), days: LINK_DAYS });
}

// Sends the link unless the address is confirmed, one went out a few
// minutes ago, or it's had MAX_SENDS already. Recorded before sending, so
// two quick submits send once.
async function sendConfirmation(email, confirm) {
  if (!RESEND_KEY || !TOKEN_SECRET) return "not configured";
  const k = key(email);
  const [row] = await db(`email_verifications?select=verified_at,last_sent_at,sends&email=eq.${encodeURIComponent(k)}`) || [];
  if (row?.verified_at) return "confirmed already";
  if (row?.last_sent_at && Date.now() - new Date(row.last_sent_at) < RESEND_AFTER_MS) return "sent recently";
  if ((row?.sends || 0) >= MAX_SENDS) return "sent enough";
  await db("email_verifications?on_conflict=email", {
    method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
    body: { email: k, last_sent_at: new Date().toISOString(), sends: (row?.sends || 0) + 1 },
  });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, reply_to: MAIL_REPLY_TO, to: [email], ...confirmMail(email, confirm) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return "sent";
}

async function check(req, res) {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden" });
  if (checkLimiter) {
    const { success } = await checkLimiter.limit(clientIp(req)).catch(() => ({ success: true }));
    if (!success) return res.status(429).json({ error: "Too many requests" });
  }
  const { email, confirm } = req.body || {};
  const checked = checkEmail(email);
  if (checked.problem) return res.status(422).json({ problem: checked.problem });
  const domain = checked.email.slice(checked.email.lastIndexOf("@") + 1);
  if (await takesMail(domain) === "no") return res.status(422).json({ problem: "domain" });
  let sent = null;
  if (confirm && typeof confirm === "object") {
    // Arrived on a friend's link: counted once this address is confirmed
    // (server/referrals.js). Never holds up the answer.
    if (typeof confirm.ref === "string") {
      try { await recordReferral(checked.email, confirm.ref); }
      catch (e) { console.error("[api/email] referral not recorded:", e.message); }
    }
    try { sent = await sendConfirmation(checked.email, { module: confirm.module, amount: Number(confirm.amount), name: confirm.name }); }
    catch (e) { console.error("[api/email] confirmation not sent:", e.message); sent = "failed"; }
  }
  return res.status(200).json({ ok: true, sent });
}

async function status(req, res) {
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden" });
  if (statusLimiter) {
    const { success } = await statusLimiter.limit(clientIp(req)).catch(() => ({ success: true }));
    if (!success) return res.status(429).json({ error: "Too many requests" });
  }
  const { email } = checkEmail(req.body?.email);
  if (!email) return res.status(422).json({ problem: "format" });
  const [row] = await db(`email_verifications?select=verified_at&email=eq.${encodeURIComponent(key(email))}`) || [];
  return res.status(200).json({ confirmed: !!row?.verified_at });
}

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#f8f5ee;color:#1d2b24;font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
main{max-width:420px;text-align:center}h1{font-family:Georgia,serif;color:#162f24;font-size:24px}p{line-height:1.5;color:#4a5a52}
button{background:#162f24;color:#fff;border:0;border-radius:100px;padding:13px 26px;font-size:15px;font-weight:700;cursor:pointer}a{color:#162f24}</style></head>
<body><main>${body}</main></body></html>`;

async function confirmLink(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (confirmLimiter) {
    const { success } = await confirmLimiter.limit(clientIp(req)).catch(() => ({ success: true }));
    if (!success) return res.status(429).send("Too many requests. Try again shortly.");
  }
  const t = String(req.query.t || "");
  const email = emailFromConfirmToken(t);
  if (!email) return res.status(400).send(page("Link not recognised", `<h1>That link isn't working</h1><p>It may be more than ${LINK_DAYS} days old. Enter your email in Candid again and we'll send a new one.</p><p><a href="${SITE}/app/home">Back to Candid</a></p>`));
  if (req.method === "GET") {
    const action = `/api/email?action=confirm&t=${encodeURIComponent(t)}`;
    return res.status(200).send(page("Confirm your email", `<h1>Confirm your email</h1><p>This confirms the address you gave Candid is yours.</p><form method="post" action="${action}"><button type="submit">Confirm my email</button></form>`));
  }
  if (req.method !== "POST") return res.status(405).end();
  const [row] = await db(`email_verifications?select=verified_at&email=eq.${encodeURIComponent(email)}`) || [];
  if (!row?.verified_at) {
    await db("email_verifications?on_conflict=email", {
      method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
      body: { email, verified_at: new Date().toISOString() },
    });
    // Whoever invited them gets their free month. A failure is logged and
    // left on the referral to give by hand; the confirmation stands.
    try { await rewardReferral(email); }
    catch (e) { console.error("[api/email] referral reward failed:", e.message); }
  }
  return res.status(200).send(page("Email confirmed", `<h1>Email confirmed</h1><p>Thanks. Your figures in Candid are unchanged.</p><p><a href="${SITE}/app/home">Back to Candid</a></p>`));
}

export default async function handler(req, res) {
  if (!SUPA_URL || !SERVICE_KEY) {
    console.error("[api/email] Supabase service key not configured");
    return res.status(503).json({ error: "Service temporarily unavailable" });
  }
  try {
    if (req.query?.action === "confirm") return await confirmLink(req, res);
    if (req.method === "POST" && req.body?.action === "check") return await check(req, res);
    if (req.method === "POST" && req.body?.action === "status") return await status(req, res);
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("[api/email] failed:", e);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
