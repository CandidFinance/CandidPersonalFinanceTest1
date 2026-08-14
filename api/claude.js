import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── Layer 1: only our own site (or local dev) may call this proxy ────────────
const ALLOWED_HOSTNAMES = ["candid-finance.co.uk", "www.candid-finance.co.uk", "localhost", "127.0.0.1"];

// ── Layer 2: only the exact request shape our app sends is forwarded ─────────
const ALLOWED_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS_LIMIT = 2000;
const MAX_MESSAGES = 20;
const MAX_SESSION_ID_LENGTH = 200;

// ── Layer 3: durable rate limiting (Upstash Redis) ────────────────────────────
// Two independent caps, both checked before the Anthropic call ever fires:
//  - per-IP: the real backstop. Durable and shared across every serverless
//    instance (the old version used an in-memory Map, which reset on every
//    cold start and wasn't shared across concurrent instances — effectively
//    no limit at all under real load).
//  - per-session: keyed on the app's existing pseudonymous session id
//    (posthog distinct_id, same one already used against the Supabase `test`
//    table). This is a soft, UX-facing guard, not a security boundary — the
//    id is client-supplied so a determined abuser can just mint new ones.
//    Its job is catching a single runaway *legitimate* browser session, not
//    a distributed attacker; the IP cap is what actually protects spend.
const IP_LIMIT = 10;
const IP_WINDOW = "60 s";
const SESSION_LIMIT = 10;
const SESSION_WINDOW = "1 d";

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

const ipLimiter = redis && new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(IP_LIMIT, IP_WINDOW),
  prefix: "ratelimit:claude:ip",
});

const sessionLimiter = redis && new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(SESSION_LIMIT, SESSION_WINDOW),
  prefix: "ratelimit:claude:session",
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

function isValidBody(body) {
  if (!body || typeof body !== "object") return false;
  if (body.model !== ALLOWED_MODEL) return false;
  if (typeof body.max_tokens !== "number" || body.max_tokens <= 0 || body.max_tokens > MAX_TOKENS_LIMIT) return false;
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) return false;
  // Optional — a stale cached frontend won't send it yet, and that shouldn't
  // 400 the request. Only checked/used if present (see the session-limit gate).
  if (body.session_id != null && (typeof body.session_id !== "string" || body.session_id.length > MAX_SESSION_ID_LENGTH)) return false;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!isValidBody(req.body)) {
    return res.status(400).json({ error: "Invalid request" });
  }

  if (!redis) {
    // Fails closed: missing config should never silently disable rate
    // limiting in production. (A transient Upstash error at request time is
    // handled differently below — logged and allowed through, not this.)
    console.error("[api/claude] UPSTASH_REDIS_REST_URL/TOKEN not configured — refusing to serve without rate limiting");
    return res.status(503).json({ error: "Service temporarily unavailable" });
  }

  const ip = getClientIp(req);
  try {
    const { success } = await ipLimiter.limit(ip);
    if (!success) {
      return res.status(429).json({ error: "Too many requests", reason: "ip_limit" });
    }
  } catch (e) {
    // A transient Upstash/network error here shouldn't take report generation
    // down for everyone — log it and let the request through unlimited for
    // this one call, rather than failing closed on an infra blip.
    console.error("[api/claude] IP rate-limit check failed, allowing request through:", e?.message);
  }

  const { session_id } = req.body;
  if (session_id) {
    try {
      const { success } = await sessionLimiter.limit(session_id);
      if (!success) {
        return res.status(429).json({ error: "Too many requests", reason: "session_limit" });
      }
    } catch (e) {
      console.error("[api/claude] Session rate-limit check failed, allowing request through:", e?.message);
    }
  }

  // Forward only the validated fields — never the raw body — so nothing
  // extra can be smuggled through to Anthropic on our key.
  const { model, max_tokens, messages } = req.body;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({ model, max_tokens, messages }),
  });

  const data = await response.json();
  res.status(response.status).json(data);
}
