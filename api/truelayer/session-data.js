// Reads the one-time HttpOnly cookie set by callback.js and hands the mapped
// TrueLayer data back to the app via an authenticated same-origin fetch —
// never via a URL param, so it can't leak through browser history, server
// access logs, or Referer headers.
const ALLOWED_HOSTNAMES = ["candid-finance.co.uk", "www.candid-finance.co.uk", "localhost", "127.0.0.1"];
const DATA_COOKIE = "tl_data";
// Must match callback.js's Domain exactly — clearing (Max-Age=0) only works if
// Domain (and Path) match what the cookie was originally set with.
const COOKIE_DOMAIN = ".candid-finance.co.uk";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").filter(Boolean).map(pair => {
      const idx = pair.indexOf("=");
      return [pair.slice(0, idx).trim(), decodeURIComponent(pair.slice(idx + 1).trim())];
    })
  );
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
