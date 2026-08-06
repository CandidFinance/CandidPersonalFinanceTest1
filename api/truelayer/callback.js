// Sandbox only — exchanges the code from auth-link.js, pulls accounts/balance/
// transactions from the Data API, and maps what's mappable onto Candid's
// onboarding fields. No request signing here: TrueLayer's ES512/kid signing is
// a Payments API concept and doesn't apply to Data API calls, which just use a
// Bearer access token from a standard OAuth code exchange.
const AUTH_BASE = "https://auth.truelayer-sandbox.com";
const DATA_BASE = "https://api.truelayer-sandbox.com";
const STATE_COOKIE = "tl_state";
const DATA_COOKIE = "tl_data";
const APP_ORIGIN = "https://candid-finance.co.uk";
const TRANSACTION_LOOKBACK_DAYS = 90;

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").filter(Boolean).map(pair => {
      const idx = pair.indexOf("=");
      return [pair.slice(0, idx).trim(), decodeURIComponent(pair.slice(idx + 1).trim())];
    })
  );
}

function redirectWithError(res, reason, extraCookies = []) {
  res.setHeader("Set-Cookie", [
    `${STATE_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
    ...extraCookies,
  ]);
  res.writeHead(302, { Location: `${APP_ORIGIN}/?truelayer=error&reason=${encodeURIComponent(reason)}` });
  res.end();
}

async function exchangeCodeForToken(code) {
  const res = await fetch(`${AUTH_BASE}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.TRUELAYER_SANDBOX_CLIENT_ID,
      client_secret: process.env.TRUELAYER_SANDBOX_CLIENT_SECRET,
      redirect_uri: process.env.TRUELAYER_SANDBOX_REDIRECT_URI,
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Token exchange failed");
  return { accessToken: data.access_token, refreshToken: data.refresh_token || null };
}

async function fetchResults(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || `Request failed: ${url}`);
  return data.results || [];
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

// Stores the refresh_token for the quarterly re-fetch feature, keyed by email
// (the only durable identity this app has — it's already what the "quarterly
// check-ins" opt-in on the PDF modal is built around). Requires a Supabase
// service-role key — this table must NEVER be reachable with the anon key,
// unlike report_pdf_requests/test, since a leaked refresh_token is live
// read access to someone's bank data. Until SUPABASE_SERVICE_ROLE_KEY is
// configured, this safely no-ops rather than storing it insecurely or
// failing the whole connect flow.
async function persistRefreshToken(email, refreshToken) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supaUrl = process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !supaUrl) {
    console.warn("[truelayer/callback] refresh_token issued but not persisted — SUPABASE_SERVICE_ROLE_KEY not configured yet");
    return;
  }
  if (!email) {
    console.warn("[truelayer/callback] refresh_token issued but no email to key it by — not persisted");
    return;
  }
  const res = await fetch(`${supaUrl}/rest/v1/truelayer_connections?on_conflict=email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ email, refresh_token: refreshToken, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) console.error("[truelayer/callback] failed to persist refresh_token:", res.status, await res.text());
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { code, state, error } = req.query;
  const cookies = parseCookies(req);

  if (error) return redirectWithError(res, String(error));

  let nonce, email;
  try {
    ({ nonce, email } = JSON.parse(Buffer.from(String(state), "base64url").toString("utf8")));
  } catch {
    return redirectWithError(res, "invalid_state");
  }
  if (!code || !nonce || nonce !== cookies[STATE_COOKIE]) {
    return redirectWithError(res, "invalid_state");
  }

  try {
    const { accessToken, refreshToken } = await exchangeCodeForToken(code);
    const accounts = await fetchResults(`${DATA_BASE}/data/v1/accounts`, accessToken);

    let cashSavings = 0;
    const cashTiers = [];
    let totalDebits = 0;

    const to = dateOnly(new Date());
    const from = dateOnly(new Date(Date.now() - TRANSACTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000));

    for (const account of accounts) {
      const [balance] = await fetchResults(`${DATA_BASE}/data/v1/accounts/${account.account_id}/balance`, accessToken);
      const amount = balance?.available ?? balance?.current ?? 0;

      if (account.account_type === "SAVINGS" || account.account_type === "BUSINESS_SAVINGS") {
        cashSavings += amount;
        cashTiers.push({ amount: String(Math.round(amount)), rate: "" });
      }

      if (account.account_type === "TRANSACTION" || account.account_type === "BUSINESS_TRANSACTION") {
        const transactions = await fetchResults(
          `${DATA_BASE}/data/v1/accounts/${account.account_id}/transactions?from=${from}&to=${to}`,
          accessToken
        );
        for (const tx of transactions) {
          if (tx.transaction_type === "DEBIT") totalDebits += Math.abs(tx.amount);
        }
      }
    }

    if (refreshToken) {
      try { await persistRefreshToken(email, refreshToken); }
      catch (e) { console.error("[truelayer/callback] persistRefreshToken threw:", e); }
    }

    const payload = {
      accountsConnected: accounts.length,
      cashSavings: cashTiers.length ? Math.round(cashSavings) : undefined,
      cashTiers: cashTiers.length ? cashTiers : undefined,
      // Estimated monthly spend, averaged over the lookback window — not authoritative.
      monthlyExpenses: totalDebits > 0 ? Math.round(totalDebits / (TRANSACTION_LOOKBACK_DAYS / 30)) : undefined,
    };

    // Handed to the client only via an authenticated same-origin fetch to
    // /api/truelayer/session-data — never via the redirect URL, so it can't leak
    // through browser history, server access logs, or Referer headers.
    const dataCookie = `${DATA_COOKIE}=${Buffer.from(JSON.stringify(payload)).toString("base64")}; Max-Age=120; Path=/; HttpOnly; Secure; SameSite=Lax`;
    res.setHeader("Set-Cookie", [
      `${STATE_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
      dataCookie,
    ]);
    res.writeHead(302, { Location: `${APP_ORIGIN}/?truelayer=success` });
    res.end();
  } catch (e) {
    console.error("[truelayer/callback] failed:", e);
    redirectWithError(res, "fetch_failed");
  }
}
