// ── Layer 1: only our own site (or local dev) may call this proxy ────────────
const ALLOWED_HOSTNAMES = ["candid-finance.co.uk", "www.candid-finance.co.uk", "localhost", "127.0.0.1"];

// ── Layer 2: only the exact request shape our app sends is forwarded ─────────
const ALLOWED_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS_LIMIT = 2000;
const MAX_MESSAGES = 20;

// ── Layer 3: in-memory per-IP rate limit ─────────────────────────────────────
// Resets on cold start and is per-instance only — won't stop a distributed
// attacker. For production-grade limiting across instances, move this to
// Vercel KV or Upstash Redis.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;
const requestLog = new Map(); // ip -> timestamps[]
let sweepCounter = 0;

function sweepStaleEntries() {
  if (++sweepCounter % 100 !== 0) return;
  const now = Date.now();
  for (const [ip, timestamps] of requestLog) {
    const fresh = timestamps.filter(t => now - t < RATE_WINDOW_MS);
    if (fresh.length === 0) requestLog.delete(ip);
    else requestLog.set(ip, fresh);
  }
}

function isRateLimited(ip) {
  sweepStaleEntries();
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT;
}

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

  if (isRateLimited(getClientIp(req))) {
    return res.status(429).json({ error: "Too many requests" });
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
