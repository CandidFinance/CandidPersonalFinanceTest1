import { isAllowedOrigin, rateLimiter, checkAdminPassword } from "../server/http.js";

// service_role — never VITE_-prefixed, so it's never bundled to the client.
// The `test` table's RLS now denies SELECT to everyone except service_role
// (see migration lock_down_test_table_rls), so this route is the only way to
// read feedback at all — there's no anon-key path that could leak it.
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.FEEDBACK_ADMIN_PASSWORD;

// Brute-force guard on the shared password: this gates real users'
// free-text opinions, so a tight window.
const attemptLimiter = rateLimiter(20, "10 m", "ratelimit:feedback-admin");

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  if (!ADMIN_PASSWORD || !SUPA_URL || !SERVICE_KEY) {
    // Fails closed: missing config should never silently serve feedback data
    // unprotected, or fall back to a key that can't actually read it.
    console.error("[api/feedback] FEEDBACK_ADMIN_PASSWORD / SUPABASE_SERVICE_ROLE_KEY not configured — refusing to serve");
    return res.status(503).json({ error: "Service temporarily unavailable" });
  }

  // Only our own site (or local dev) may call this route.
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const auth = await checkAdminPassword(req, ADMIN_PASSWORD, attemptLimiter, "api/feedback");
  if (auth === 429) return res.status(429).json({ error: "Too many attempts — try again shortly" });
  if (auth === 401) return res.status(401).json({ error: "Unauthorized" });

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
