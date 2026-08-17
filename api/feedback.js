import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── Layer 1: only our own site (or local dev) may call this route ────────────
const ALLOWED_HOSTNAMES = ["candid-finance.co.uk", "www.candid-finance.co.uk", "localhost", "127.0.0.1"];

// service_role — never VITE_-prefixed, so it's never bundled to the client.
// The `test` table's RLS now denies SELECT to everyone except service_role
// (see migration lock_down_test_table_rls), so this route is the only way to
// read feedback at all — there's no anon-key path that could leak it.
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.FEEDBACK_ADMIN_PASSWORD;

// ── Layer 2: durable brute-force guard on the shared password ────────────────
// This gates real users' free-text opinions, not just AI spend like
// api/claude.js's limiter — tighter window, same durable-Redis pattern so it
// isn't reset by every cold start / bypassed across concurrent instances.
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

const attemptLimiter = redis && new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "10 m"),
  prefix: "ratelimit:feedback-admin",
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

  if (!ADMIN_PASSWORD || !SUPA_URL || !SERVICE_KEY) {
    // Fails closed: missing config should never silently serve feedback data
    // unprotected, or fall back to a key that can't actually read it.
    console.error("[api/feedback] FEEDBACK_ADMIN_PASSWORD / SUPABASE_SERVICE_ROLE_KEY not configured — refusing to serve");
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
      console.error("[api/feedback] rate-limit check failed, allowing through:", e?.message);
    }
  }

  if (!passwordMatches(req.headers["x-admin-password"], ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const columns = "id,session_id,created_at,confidence_score,post_feedback_knew_something,post_feedback_useful_text,post_feedback_would_change,post_feedback_change_details";
    const r = await fetch(
      `${SUPA_URL}/rest/v1/test?select=${columns}&feedback_submitted=eq.true&order=created_at.desc&limit=500`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (!r.ok) {
      const errBody = await r.json().catch(() => null);
      console.error("[api/feedback] Supabase select failed:", r.status, errBody);
      return res.status(502).json({ error: "Failed to fetch feedback" });
    }
    const rows = await r.json();
    return res.status(200).json({ rows });
  } catch (e) {
    console.error("[api/feedback] fetch failed:", e?.message);
    return res.status(502).json({ error: "Failed to fetch feedback" });
  }
}
