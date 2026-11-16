// Helpers shared by the Vercel functions in api/. Kept outside api/ so this
// file is never deployed as a function of its own; each function bundles it.
import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// True only on the live site's deployment (not a preview, not local dev).
export const IS_PRODUCTION = process.env.VERCEL_ENV === "production";

// The only origins the functions answer: the live site, plus local dev
// anywhere but production. Emailed links are built from the caller's origin
// (api/billing.js), so in production it must be one of ours.
export const ALLOWED_HOSTNAMES = ["candid-finance.co.uk", "www.candid-finance.co.uk", ...(IS_PRODUCTION ? [] : ["localhost", "127.0.0.1"])];

// Vercel redirects between the apex and www hosts, and a host-scoped cookie
// doesn't survive that hop. Scoping to the parent domain (leading dot) makes
// a cookie valid on both. Clearing a cookie (Max-Age=0) only works with the
// same Domain and Path it was set with, so every cookie uses this one.
export const COOKIE_DOMAIN = ".candid-finance.co.uk";

// The bank-connect routes in api/truelayer answer only when this is set to "1".
// They are a sandbox trial, not built for real accounts, so they are off
// everywhere by default, production included.
export const TRUELAYER_ENABLED = process.env.TRUELAYER_ENABLED === "1";

// The request's own site (Origin, or Referer when there's no Origin), if it
// is one of `hostnames`, else null.
export function allowedOrigin(req, hostnames = ALLOWED_HOSTNAMES) {
  const value = req.headers.origin || req.headers.referer;
  if (!value) return null;
  try {
    const u = new URL(value);
    return hostnames.includes(u.hostname) ? u.origin : null;
  } catch {
    return null;
  }
}
export const isAllowedOrigin = (req, hostnames) => allowedOrigin(req, hostnames) !== null;

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return forwarded ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress || "unknown";
}

// A cookie that isn't valid percent-encoding keeps its raw value rather than
// failing the whole request.
export function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").filter(Boolean).map(pair => {
      const idx = pair.indexOf("=");
      const value = pair.slice(idx + 1).trim();
      let decoded = value;
      try { decoded = decodeURIComponent(value); } catch {}
      return [pair.slice(0, idx).trim(), decoded];
    })
  );
}

// Constant-time compare, so a near-miss can't be told from a wrong guess by
// response timing. Lengths are compared in bytes, as timingSafeEqual needs:
// equal string lengths can still differ in bytes.
export function safeEqual(supplied, expected) {
  if (typeof supplied !== "string" || typeof expected !== "string" || !expected) return false;
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Upstash Redis, durable across cold starts and concurrent instances, or
// null when it isn't configured.
export const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

// A sliding-window limiter on that Redis (null without it): `requests` per
// `window` (e.g. "10 m"), counted under `prefix`. The library lets a request
// through when Redis hasn't answered in 5 seconds; a `strict` limiter (sign-in
// and admin guesses) waits instead, so a Redis outage fails the request.
export const rateLimiter = (requests, window, prefix, { strict = false } = {}) =>
  redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix, ...(strict ? { timeout: 0 } : {}) });

// Whether guess limits can be kept: always outside production (local dev runs
// without Redis); in production only with Redis set up.
export const limitsReady = () => !IS_PRODUCTION || !!redis;

// The shared admin password in x-admin-password, behind a brute-force guard:
// 200, 401, 429 or 503. Only wrong guesses use up the limiter, so a signed-in
// admin can approve any number of things; once the guesses run out, even the
// right password waits for the window. When the guesses can't be counted (a
// Redis failure, or no Redis in production) nobody gets in: 503.
export async function checkAdminPassword(req, password, limiter, tag) {
  const ip = clientIp(req);
  if (!limiter && !limitsReady()) return 503;
  if (limiter) {
    try {
      if ((await limiter.getRemaining(ip)).remaining <= 0) return 429;
    } catch (e) {
      console.error(`[${tag}] rate-limit check failed:`, e?.message);
      return 503;
    }
  }
  if (safeEqual(req.headers["x-admin-password"], password)) return 200;
  if (limiter) await limiter.limit(ip).catch(e => console.error(`[${tag}] rate-limit count failed:`, e?.message));
  return 401;
}
