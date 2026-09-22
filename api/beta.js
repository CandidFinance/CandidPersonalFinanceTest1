import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Same two-layer pattern as api/feedback.js (own-origin check + durable
// brute-force limiter) — this now gates the entire product app, not just an
// internal admin view, so it gets the same treatment.
const ALLOWED_HOSTNAMES = ["candid-finance.co.uk", "www.candid-finance.co.uk", "localhost", "127.0.0.1"];

const BETA_PASSWORD = process.env.BETA_TESTER_PASSWORD;

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

const attemptLimiter = redis && new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "10 m"),
  prefix: "ratelimit:beta-gate",
});

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function isAllowedOrigin(req) {
  const value = req.headers.origin || req.headers.referer;
  if (!value) return false;
  try {
    return ALLOWED_HOSTNAMES.includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

// Constant-time compare so a wrong-but-close guess can't be distinguished
// from a wrong guess by response timing.
function passwordMatches(supplied, expected) {
  if (typeof supplied !== "string") return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  if (!BETA_PASSWORD) {
    // Fails closed: missing config should never silently let everyone in.
    console.error("[api/beta] BETA_TESTER_PASSWORD not configured — refusing to unlock");
    return res.status(503).json({ error: "Service temporarily unavailable" });
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const ip = getClientIp(req);
  if (attemptLimiter) {
    try {
      const { success } = await attemptLimiter.limit(ip);
      if (!success) return res.status(429).json({ error: "Too many attempts — try again shortly" });
    } catch (e) {
      console.error("[api/beta] rate-limit check failed, allowing through:", e?.message);
    }
  }

  if (!passwordMatches(req.headers["x-beta-password"], BETA_PASSWORD)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.status(200).json({ ok: true });
}
