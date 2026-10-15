import crypto from "crypto";
import * as tlSigning from "truelayer-signing";
import { isAllowedOrigin, clientIp, redis, rateLimiter } from "../../server/http.js";

// Sandbox only — stages a mock bank-transfer pay-in via TrueLayer's Payments
// API v3 and hands back a hosted payment page URL for the human to complete
// (or abandon) themselves. This never moves real money: both the auth and API
// hosts below are TrueLayer's sandbox environment, and provider_selection is
// pinned to their mock bank so a live provider can never be reached.
const AUTH_BASE = "https://auth.truelayer-sandbox.com";
const API_BASE = "https://api.truelayer-sandbox.com";
const HOSTED_PAGE_BASE = "https://payment.truelayer-sandbox.com/payments";
const PAYMENTS_PATH = "/v3/payments";
const APP_ORIGIN = "https://candid-finance.co.uk";

// Fixed staging amount per spec — deliberately not accepted from the client,
// since there's no legitimate reason for a payment amount to be client-supplied
// even in sandbox.
const STAGE_AMOUNT_MINOR = 250000; // £2,500.00
const STAGE_CURRENCY = "GBP";

// Well-formed but arbitrary sandbox values — TrueLayer's mock provider doesn't
// validate them against a real bank, it just needs a structurally valid UK
// account identifier to complete the simulated consent flow.
const MOCK_BENEFICIARY = {
  type: "external_account",
  account_holder_name: "Candid Sandbox Beneficiary",
  account_identifier: { type: "sort_code_account_number", sort_code: "040075", account_number: "37397677" },
  reference: "Candid sandbox", // TrueLayer caps this field at 18 characters
};
const MOCK_USER = { name: "Candid Sandbox User", email: "sandbox-user@candid-finance.co.uk" };

const IP_LIMIT = 5;
const IP_WINDOW = "10 m";

const ipLimiter = rateLimiter(IP_LIMIT, IP_WINDOW, "ratelimit:truelayer-payment:ip");

// TrueLayer env vars store the PEM with literal "\n" (real newlines don't
// survive most env var UIs) — decode back to a real multi-line PEM here.
function loadSigningKey() {
  const kid = process.env.TRUELAYER_PAYMENTS_KID;
  const rawPem = process.env.TRUELAYER_PAYMENTS_PRIVATE_KEY;
  if (!kid || !rawPem) return null;
  return { kid, privateKeyPem: rawPem.replace(/\\n/g, "\n") };
}

async function fetchAccessToken() {
  const clientId = process.env.TRUELAYER_SANDBOX_CLIENT_ID;
  const clientSecret = process.env.TRUELAYER_SANDBOX_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TrueLayer is not configured (missing TRUELAYER_SANDBOX_CLIENT_ID/SECRET)");
  }
  const res = await fetch(`${AUTH_BASE}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "payments",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "TrueLayer token request failed");
  return data.access_token;
}

function buildHostedPaymentUrl(paymentId, resourceToken, returnUri) {
  const params = new URLSearchParams({
    payment_id: paymentId,
    resource_token: resourceToken,
    return_uri: returnUri,
  });
  return `${HOSTED_PAGE_BASE}#${params.toString()}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: "Forbidden" });

  if (!redis) {
    // Fails closed: this stages a (mock) payment, so missing config should
    // never silently disable the guard.
    console.error("[truelayer/stage-payment] UPSTASH_REDIS_REST_URL/TOKEN not configured — refusing to serve without rate limiting");
    return res.status(503).json({ error: "Service temporarily unavailable" });
  }

  const ip = clientIp(req);
  try {
    const { success } = await ipLimiter.limit(ip);
    if (!success) return res.status(429).json({ error: "Too many requests" });
  } catch (e) {
    console.error("[truelayer/stage-payment] rate-limit check failed, allowing request through:", e?.message);
  }

  const signingKey = loadSigningKey();
  if (!signingKey) {
    return res.status(500).json({
      error: "TrueLayer payment signing is not configured",
      detail: "Set TRUELAYER_PAYMENTS_KID and TRUELAYER_PAYMENTS_PRIVATE_KEY (a signing key registered against your TrueLayer sandbox app).",
    });
  }

  let accessToken;
  try {
    accessToken = await fetchAccessToken();
  } catch (e) {
    console.error("[truelayer/stage-payment] token request failed:", e);
    return res.status(502).json({ error: "Could not authenticate with TrueLayer" });
  }

  const returnUri = process.env.TRUELAYER_PAYMENTS_RETURN_URI || `${APP_ORIGIN}/?truelayer_payment=return`;
  const idempotencyKey = crypto.randomUUID();
  const body = JSON.stringify({
    amount_in_minor: STAGE_AMOUNT_MINOR,
    currency: STAGE_CURRENCY,
    payment_method: {
      type: "bank_transfer",
      provider_selection: { type: "user_selected", filter: { providers: ["mock-payments-gb-redirect"] } },
      beneficiary: MOCK_BENEFICIARY,
    },
    user: MOCK_USER,
  });

  let signature;
  try {
    signature = tlSigning.sign({
      kid: signingKey.kid,
      privateKeyPem: signingKey.privateKeyPem,
      method: "POST",
      path: PAYMENTS_PATH,
      headers: { "Idempotency-Key": idempotencyKey },
      body,
    });
  } catch (e) {
    console.error("[truelayer/stage-payment] request signing failed:", e);
    return res.status(500).json({ error: "Could not sign TrueLayer request", detail: "Check TRUELAYER_PAYMENTS_KID/PRIVATE_KEY are a matching, valid pair." });
  }

  let data;
  try {
    const apiRes = await fetch(`${API_BASE}${PAYMENTS_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Idempotency-Key": idempotencyKey,
        "Tl-Signature": signature,
      },
      body,
    });
    data = await apiRes.json();
    if (!apiRes.ok) {
      // v3 errors come back as RFC7807 problem+json — `errors` (when present)
      // is a field->messages map with the actually-useful validation detail.
      const validation = data.errors && Object.entries(data.errors).map(([field, msgs]) => `${field}: ${msgs.join(", ")}`).join("; ");
      throw new Error(validation || data.detail || data.error_description || data.error || `TrueLayer returned ${apiRes.status}`);
    }
  } catch (e) {
    console.error("[truelayer/stage-payment] payment staging failed:", e);
    return res.status(502).json({ error: "Could not stage payment with TrueLayer" });
  }

  const { id: paymentId, resource_token: resourceToken, status } = data;
  if (!paymentId || !resourceToken) {
    console.error("[truelayer/stage-payment] unexpected TrueLayer response shape:", data);
    return res.status(502).json({ error: "TrueLayer response missing payment_id/resource_token" });
  }

  return res.status(200).json({
    paymentId,
    resourceToken,
    status: status || null,
    hostedPaymentUrl: buildHostedPaymentUrl(paymentId, resourceToken, returnUri),
  });
}
