// Signed tokens naming an email: base64url(JSON) + "." + HMAC, signed with
// STRIPE_BILLING_TOKEN_SECRET. `kind` says what one is for ("access", held
// by the browser; "restore", a sign-in link), and each expires. Made and
// read by api/billing.js; server/referrals.js makes sign-in links with them.
// An access token also carries `v`, the account's token_version when it was
// made (api/billing.js refuses one the account has moved on from), and `s`,
// when its holder last signed in, which renewing a token never changes.
// Kept outside api/ so it's bundled into each function, not deployed alone.
import crypto from "crypto";
import { safeEqual } from "./http.js";

const SECRET = process.env.STRIPE_BILLING_TOKEN_SECRET;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanEmail = e => typeof e === "string" && EMAIL_RE.test(e.trim()) ? e.trim().toLowerCase() : null;

const b64 = s => Buffer.from(s).toString("base64url");
const sign = body => crypto.createHmac("sha256", SECRET).update(body).digest("base64url");

// However often it's renewed, a sign-in lasts this long at most.
export const SESSION_MAX_MS = 180 * 24 * 3600 * 1000;

export function makeToken(email, kind, ttl, extra = {}) {
  const body = b64(JSON.stringify({ e: email, k: kind, x: Date.now() + ttl, ...extra }));
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
// The signed contents of a token of this kind that hasn't expired, or null.
function open(token, kind) {
  if (!SECRET || typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  if (!safeEqual(mac, sign(body))) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString());
    return t && t.k === kind && t.x > Date.now() && cleanEmail(t.e) ? t : null;
  } catch { return null; }
}
export const readToken = (token, kind) => cleanEmail(open(token, kind)?.e);
// An access token's { email, version, since } (`since`: the sign-in, in ms),
// or null, also once the sign-in is older than SESSION_MAX_MS. A token from
// before these were kept reads as version 0 with no sign-in time.
export function readSession(token) {
  const t = open(token, "access");
  if (!t) return null;
  const since = Number.isFinite(t.s) ? t.s : null;
  if (since !== null && Date.now() - since > SESSION_MAX_MS) return null;
  return { email: cleanEmail(t.e), version: Number.isInteger(t.v) ? t.v : 0, since };
}
