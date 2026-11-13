// Signed tokens naming an email: base64url(JSON) + "." + HMAC, signed with
// STRIPE_BILLING_TOKEN_SECRET. `kind` says what one is for ("access", held
// by the browser; "restore", a sign-in link), and each expires. Made and
// read by api/billing.js; server/referrals.js makes sign-in links with them.
// Kept outside api/ so it's bundled into each function, not deployed alone.
import crypto from "crypto";
import { safeEqual } from "./http.js";

const SECRET = process.env.STRIPE_BILLING_TOKEN_SECRET;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanEmail = e => typeof e === "string" && EMAIL_RE.test(e.trim()) ? e.trim().toLowerCase() : null;

const b64 = s => Buffer.from(s).toString("base64url");
const sign = body => crypto.createHmac("sha256", SECRET).update(body).digest("base64url");

export function makeToken(email, kind, ttl) {
  const body = b64(JSON.stringify({ e: email, k: kind, x: Date.now() + ttl }));
  return `${body}.${sign(body)}`;
}
// For a token readToken has accepted: a Redis key naming it, and the seconds
// until it expires, to mark it used for the rest of its life. From the
// signed part alone: readToken ignores anything after the signature, so the
// whole string could be varied to look like a new token.
export function tokenUse(token) {
  const body = token.split(".")[0];
  const { x } = JSON.parse(Buffer.from(body, "base64url").toString());
  return {
    key: crypto.createHash("sha256").update(body).digest("base64url"),
    seconds: Math.max(60, Math.ceil((x - Date.now()) / 1000) + 60),
  };
}
export function readToken(token, kind) {
  if (!SECRET || typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  if (!safeEqual(mac, sign(body))) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString());
    return t.k === kind && t.x > Date.now() ? cleanEmail(t.e) : null;
  } catch { return null; }
}
