import crypto from "crypto";
import { safeEqual } from "./http.js";
import { cleanEmail } from "./tokens.js";

// Sending Candid's emails between visits, shared by api/alerts.js (the
// daily run) and api/billing.js (the welcome, sent as someone subscribes):
// the signed unsubscribe link every email carries, Resend, and the record
// in `alert_sends` written before each send, unique per person and key, so
// whichever caller's insert lands is the one that sends.

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
export const TOKEN_SECRET = process.env.ALERTS_TOKEN_SECRET || process.env.STRIPE_BILLING_TOKEN_SECRET;
const MAIL_FROM = process.env.ALERTS_MAIL_FROM || process.env.BILLING_MAIL_FROM || "Candid <admin@candid-finance.co.uk>";
const MAIL_REPLY_TO = "admin@candid-finance.co.uk";
const SITE = "https://www.candid-finance.co.uk";

export const mailReady = () => !!(RESEND_KEY && TOKEN_SECRET && SUPA_URL && SERVICE_KEY);

// ── Unsubscribing and turning on rate alerts: a signed link per email and
// purpose, with no expiry ────────────────────────────────────────────────────
const sign = (email, purpose) => crypto.createHmac("sha256", TOKEN_SECRET).update(`alerts-${purpose}:${email}`).digest("base64url");
const token = (email, purpose) => `${Buffer.from(email).toString("base64url")}.${sign(email, purpose)}`;
export function unsubscribeUrl(email) {
  if (!TOKEN_SECRET) return `${SITE}/privacy.html`;
  return `${SITE}/api/alerts?action=unsubscribe&t=${token(email, "unsubscribe")}`;
}
export function optInUrl(email) {
  if (!TOKEN_SECRET) return `${SITE}/app/home`;
  return `${SITE}/api/alerts?action=optin&t=${token(email, "optin")}`;
}
export function emailFromToken(t, purpose = "unsubscribe") {
  if (!TOKEN_SECRET || typeof t !== "string") return null;
  const [e, sig] = t.split(".");
  const email = cleanEmail(Buffer.from(e || "", "base64url").toString());
  return email && safeEqual(sig, sign(email, purpose)) ? email : null;
}

export async function sendMail(to, subject, text, unsubscribe, html = null) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM, reply_to: MAIL_REPLY_TO, to: [to], subject, text, ...(html ? { html } : {}),
      ...(unsubscribe ? { headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

async function sends(path, init = {}) {
  const res = await fetch(`${SUPA_URL}/rest/v1/alert_sends${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Supabase alert_sends ${init.method || "GET"} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

// Recorded first: only the caller whose insert lands sends it. A failed
// send is taken back off, to go next time.
export async function sendOnce(e) {
  const inserted = await sends("?on_conflict=email,alert_key", {
    method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ email: e.to, alert_key: e.key, kind: e.kind, detail: e.detail || null }),
  });
  if (!inserted?.length) return "duplicate";
  try {
    await sendMail(e.to, e.subject, e.text, unsubscribeUrl(e.to), e.html);
    return "sent";
  } catch (err) {
    await sends(`?email=eq.${encodeURIComponent(e.to)}&alert_key=eq.${encodeURIComponent(e.key)}`, { method: "DELETE" }).catch(() => {});
    console.error("[alertMail] send failed:", err.message);
    return "failed";
  }
}
