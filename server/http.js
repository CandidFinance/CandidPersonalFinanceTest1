// Helpers shared by the Vercel functions in api/. Kept outside api/ so this
// file is never deployed as a function of its own; each function bundles it.
import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// The live site and local dev: the only origins the functions answer.
export const ALLOWED_HOSTNAMES = ["candid-finance.co.uk", "www.candid-finance.co.uk", "localhost", "127.0.0.1"];

// Vercel redirects between the apex and www hosts, and a host-scoped cookie
// doesn't survive that hop. Scoping to the parent domain (leading dot) makes
// a cookie valid on both. Clearing a cookie (Max-Age=0) only works with the
// same Domain and Path it was set with, so every cookie uses this one.
export const COOKIE_DOMAIN = ".candid-finance.co.uk";

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
// `window` (e.g. "10 m"), counted under `prefix`.
export const rateLimiter = (requests, window, prefix) =>
  redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix });

// The shared admin password in x-admin-password, behind a brute-force guard:
// 200, 401 or 429. Only wrong guesses use up the limiter, so a signed-in admin
// can approve any number of things; once the guesses run out, even the right
// password waits for the window. A Redis failure lets the check through.
export async function checkAdminPassword(req, password, limiter, tag) {
  const ip = clientIp(req);
  if (limiter) {
    try {
      if ((await limiter.getRemaining(ip)).remaining <= 0) return 429;
    } catch (e) {
      console.error(`[${tag}] rate-limit check failed:`, e?.message);
    }
  }
  if (safeEqual(req.headers["x-admin-password"], password)) return 200;
  if (limiter) await limiter.limit(ip).catch(e => console.error(`[${tag}] rate-limit count failed:`, e?.message));
  return 401;
}
