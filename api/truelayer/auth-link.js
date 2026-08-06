import crypto from "crypto";

// Sandbox only — see truelayer/callback.js for the corresponding exchange.
const AUTH_BASE = "https://auth.truelayer-sandbox.com";
const SCOPES = ["accounts", "balance", "transactions", "offline_access"];
const STATE_COOKIE = "tl_state";
const STATE_TTL_SECONDS = 600;
const MAX_EMAIL_LEN = 254;

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const clientId = process.env.TRUELAYER_SANDBOX_CLIENT_ID;
  const redirectUri = process.env.TRUELAYER_SANDBOX_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "TrueLayer is not configured" });
  }

  // CSRF nonce — stored in a short-lived HttpOnly cookie rather than a server-side
  // session store, since this app has none; validated against on the callback.
  const nonce = crypto.randomBytes(16).toString("hex");
  res.setHeader(
    "Set-Cookie",
    `${STATE_COOKIE}=${nonce}; Max-Age=${STATE_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`
  );

  // The callback route runs server-side with no access to the browser's app state,
  // so the email (needed to key refresh_token storage for the quarterly re-fetch)
  // is threaded through `state` alongside the CSRF nonce. Low-sensitivity, and
  // state round-trips through TrueLayer's own redirect regardless.
  const email = typeof req.query.email === "string" ? req.query.email.slice(0, MAX_EMAIL_LEN) : "";
  const state = Buffer.from(JSON.stringify({ nonce, email })).toString("base64url");

  // providers=uk-cs-mock restricts the hosted consent screen to TrueLayer's Sandbox
  // Mock Bank — this integration is Sandbox-only for now.
  const query = [
    "response_type=code",
    `client_id=${encodeURIComponent(clientId)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    `scope=${SCOPES.join("%20")}`,
    "providers=uk-cs-mock",
    `state=${state}`,
  ].join("&");

  const location = `${AUTH_BASE}/?${query}`;
  // Temporary diagnostic — compare redirectUri character-for-character against
  // what's registered in TrueLayer Console. Remove once the mismatch is found.
  console.log("[truelayer/auth-link] redirect_uri (raw env value):", JSON.stringify(redirectUri));
  console.log("[truelayer/auth-link] full auth URL sent to TrueLayer:", location);

  res.writeHead(302, { Location: location });
  res.end();
}
