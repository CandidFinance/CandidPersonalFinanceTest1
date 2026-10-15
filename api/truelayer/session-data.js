// Reads the one-time HttpOnly cookie set by callback.js and hands the mapped
// TrueLayer data back to the app via an authenticated same-origin fetch —
// never via a URL param, so it can't leak through browser history, server
// access logs, or Referer headers.
import { parseCookies, isAllowedOrigin, COOKIE_DOMAIN } from "../../server/http.js";

const DATA_COOKIE = "tl_data";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden" });

  const raw = parseCookies(req)[DATA_COOKIE];
  if (!raw) return res.status(404).json({ error: "No pending TrueLayer data" });

  // Single-use — clear it immediately regardless of parse outcome.
  res.setHeader("Set-Cookie", `${DATA_COOKIE}=; Max-Age=0; Path=/; Domain=${COOKIE_DOMAIN}; HttpOnly; Secure; SameSite=Lax`);

  try {
    const payload = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    return res.status(200).json(payload);
  } catch {
    return res.status(400).json({ error: "Corrupt TrueLayer data" });
  }
}
