import crypto from "crypto";
import { safeEqual } from "./http.js";
import { checkEmail } from "../src/lib/emailCheck.js";
import { rewardReferral } from "./referrals.js";

// The link that confirms an email address is someone's: signed, and good
// for LINK_DAYS. Made by api/email.js (the confirmation email) and
// api/alerts.js (the reminder for one not yet confirmed); opened on
// api/email.js ?action=confirm. recordConfirmed is what opening it does,
// shared with Google sign-in (server/google.js), which has verified the
// address itself.

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN_SECRET = process.env.ALERTS_TOKEN_SECRET || process.env.STRIPE_BILLING_TOKEN_SECRET;
const SITE = "https://www.candid-finance.co.uk";
export const LINK_DAYS = 14;

const key = email => email.toLowerCase();
const sign = payload => crypto.createHmac("sha256", TOKEN_SECRET).update(`email-confirm:${payload}`).digest("base64url");

export function confirmUrl(email) {
  const payload = `${Buffer.from(key(email)).toString("base64url")}.${Date.now().toString(36)}`;
  return `${SITE}/api/email?action=confirm&t=${payload}.${sign(payload)}`;
}

export function emailFromConfirmToken(t) {
  if (!TOKEN_SECRET || typeof t !== "string") return null;
  const [e, issued, sig] = t.split(".");
  if (!e || !issued || !safeEqual(sig, sign(`${e}.${issued}`))) return null;
  if (Date.now() - parseInt(issued, 36) > LINK_DAYS * 86400000) return null;
  const { email } = checkEmail(Buffer.from(e, "base64url").toString());
  return email ? key(email) : null;
}

// The address confirmed, the first time, in `email_verifications`, and
// whoever invited them given their free month. A failed reward is logged
// and left on the referral to give by hand; the confirmation stands.
export async function recordConfirmed(rawEmail) {
  const email = key(rawEmail);
  const url = `${SUPA_URL}/rest/v1/email_verifications`;
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
  const got = await fetch(`${url}?select=verified_at&email=eq.${encodeURIComponent(email)}`, { headers });
  if (!got.ok) throw new Error(`Supabase ${got.status}: ${await got.text()}`);
  const [row] = await got.json();
  if (row?.verified_at) return;
  const put = await fetch(`${url}?on_conflict=email`, {
    method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ email, verified_at: new Date().toISOString() }),
  });
  if (!put.ok) throw new Error(`Supabase ${put.status}: ${await put.text()}`);
  try { await rewardReferral(email); }
  catch (e) { console.error("[confirmLink] referral reward failed:", e.message); }
}
