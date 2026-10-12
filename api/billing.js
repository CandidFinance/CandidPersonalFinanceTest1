import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Subscriptions: the first module's answer is free, every one after it needs
// a subscription (src/lib/unlock.js). One function for all of it, routed by
// ?action=, to stay inside Vercel's function limit:
//   checkout  POST {plan, module, email?}  -> { url } of Stripe's hosted checkout
//   confirm   POST {sessionId}             -> { active, email, token } after checkout
//   status    POST {token}                 -> { active, email, plan, periodEnd, token }
//   restore   POST {email}                 -> emails a sign-in link if subscribed
//   portal    POST {token}                 -> { url } of Stripe's billing portal
//   webhook   Stripe's events, signature-checked, keep `subscriptions` current
//
// Stripe is called over its REST API (no SDK). Who has paid lives in the
// Supabase `subscriptions` table, which only service_role can read or write
// (migration add_subscriptions_table). The browser holds a signed token
// naming the email (STRIPE_BILLING_TOKEN_SECRET); every check goes back to that
// table, so a cancelled subscription stops at the next check.
//
// Fails closed: with any setting missing, every action answers 503 and
// nothing is unlocked.

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PRICES = { monthly: process.env.STRIPE_PRICE_MONTHLY, yearly: process.env.STRIPE_PRICE_YEARLY };
const TOKEN_SECRET = process.env.STRIPE_BILLING_TOKEN_SECRET;
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.BILLING_MAIL_FROM || "Candid <hello@candid-finance.co.uk>";

// The live site and local dev, plus any hostnames in BILLING_EXTRA_HOSTS
// (comma-separated), for trying checkout on a Vercel preview in test mode.
const ALLOWED_HOSTNAMES = ["candid-finance.co.uk", "www.candid-finance.co.uk", "localhost", "127.0.0.1",
  ...(process.env.BILLING_EXTRA_HOSTS || "").split(",").map(h => h.trim()).filter(Boolean)];
// Statuses that keep access: past_due while Stripe retries a failed payment.
const ACTIVE = ["active", "trialing", "past_due"];
const ACCESS_TTL_MS = 30 * 24 * 3600 * 1000;
const RESTORE_TTL_MS = 20 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;
const limiter = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "10 m"), prefix: "ratelimit:billing" });
const restoreLimiter = redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "1 h"), prefix: "ratelimit:billing-restore" });

const configured = () => !!(STRIPE_KEY && WEBHOOK_SECRET && PRICES.monthly && PRICES.yearly && TOKEN_SECRET && SUPA_URL && SERVICE_KEY);

function clientIp(req) {
  const f = req.headers["x-forwarded-for"];
  return f ? f.split(",")[0].trim() : req.socket?.remoteAddress || "unknown";
}
// The site the request came from, if it's ours: where checkout returns to.
function ourOrigin(req) {
  const value = req.headers.origin || req.headers.referer;
  if (!value) return null;
  try {
    const u = new URL(value);
    return ALLOWED_HOSTNAMES.includes(u.hostname) ? u.origin : null;
  } catch { return null; }
}
const cleanEmail = e => typeof e === "string" && EMAIL_RE.test(e.trim()) ? e.trim().toLowerCase() : null;

// ── Tokens: base64url(JSON) + "." + HMAC ─────────────────────────────────
const b64 = s => Buffer.from(s).toString("base64url");
const sign = body => crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
function makeToken(email, kind, ttl) {
  const body = b64(JSON.stringify({ e: email, k: kind, x: Date.now() + ttl }));
  return `${body}.${sign(body)}`;
}
function readToken(token, kind) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = sign(body);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString());
    return t.k === kind && t.x > Date.now() ? cleanEmail(t.e) : null;
  } catch { return null; }
}

// ── Stripe and Supabase over REST ────────────────────────────────────────
function form(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v == null) continue;
    if (typeof v === "object") out.push(form(v, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.filter(Boolean).join("&");
}
async function stripe(method, path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : form(params || {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${json?.error?.message || res.status}`);
  return json;
}
async function supa(method, query, body) {
  const res = await fetch(`${SUPA_URL}/rest/v1/subscriptions${query}`, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json",
      Prefer: method === "POST" ? "resolution=merge-duplicates,return=minimal" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return method === "GET" ? res.json() : null;
}
async function rowFor(email) {
  const rows = await supa("GET", `?email=eq.${encodeURIComponent(email)}&select=*`);
  return rows[0] || null;
}
async function rowForCustomer(customerId) {
  const rows = await supa("GET", `?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=*`);
  return rows[0] || null;
}
const planOf = sub => {
  const price = sub?.items?.data?.[0]?.price?.id;
  return price === PRICES.yearly ? "yearly" : price === PRICES.monthly ? "monthly" : null;
};
// Records a Stripe subscription against its customer's email.
async function saveSubscription(sub, email) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  let who = email;
  if (!who) who = (await rowForCustomer(customerId))?.email;
  if (!who) who = cleanEmail((await stripe("GET", `/customers/${customerId}`)).email);
  if (!who) throw new Error(`No email for customer ${customerId}`);
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  const price = sub.items?.data?.[0]?.price;
  const iso = s => s ? new Date(s * 1000).toISOString() : null;
  await supa("POST", "?on_conflict=email", {
    email: who, stripe_customer_id: customerId, stripe_subscription_id: sub.id, status: sub.status,
    plan: planOf(sub), current_period_end: iso(periodEnd),
    cancel_at_period_end: !!sub.cancel_at_period_end, updated_at: new Date().toISOString(),
    stripe_price_id: price?.id || null, amount_pence: price?.unit_amount ?? null, currency: price?.currency || null,
    canceled_at: iso(sub.canceled_at), cancellation_reason: sub.cancellation_details?.feedback || null,
    cancellation_comment: sub.cancellation_details?.comment || null,
    ...(sub.metadata?.module ? { signup_module: sub.metadata.module } : {}),
  });
  return who;
}
const accessFor = row => {
  const active = !!row && ACTIVE.includes(row.status);
  return { active, email: row?.email || null, plan: row?.plan || null, periodEnd: row?.current_period_end || null, cancelling: !!row?.cancel_at_period_end };
};

// ── The raw body: Vercel's parser is off (config below) so the webhook can
// check Stripe's signature against the exact bytes; the other actions parse it.
export const config = { api: { bodyParser: false } };
async function rawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString("utf8");
}
function stripeSigned(raw, header) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")).filter(p => p.length === 2).map(([k, v]) => [k, v]));
  const t = +parts.t;
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${raw}`).digest("hex");
  return header.split(",").filter(p => p.startsWith("v1=")).some(p => {
    const v = p.slice(3);
    return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
  });
}
async function webhook(req, res, raw) {
  if (!stripeSigned(raw, req.headers["stripe-signature"])) return res.status(400).json({ error: "Bad signature" });
  const event = JSON.parse(raw);
  const obj = event.data?.object;
  if (event.type === "checkout.session.completed" && obj?.mode === "subscription" && obj.subscription) {
    const sub = await stripe("GET", `/subscriptions/${obj.subscription}`);
    await saveSubscription(sub, cleanEmail(obj.customer_details?.email || obj.customer_email));
  } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    await saveSubscription(obj, null);
  }
  return res.status(200).json({ received: true });
}

// ── The actions the app calls ───────────────────────────────────────────
async function checkout(body, res, origin) {
  const { plan, module, email } = body;
  if (!PRICES[plan]) return res.status(400).json({ error: "Unknown plan" });
  const mod = typeof module === "string" && /^[a-zA-Z]{2,20}$/.test(module) ? module : null;
  const back = mod ? `/app/module/${mod}` : "/app/modules";
  const session = await stripe("POST", "/checkout/sessions", {
    mode: "subscription",
    line_items: { 0: { price: PRICES[plan], quantity: 1 } },
    success_url: `${origin}${back}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${back}?checkout=cancelled`,
    allow_promotion_codes: "true",
    // Candid is the seller, not Stripe (Managed Payments is on for the
    // account): not VAT-registered, so the price is the price, no VAT added.
    managed_payments: { enabled: "false" },
    subscription_data: mod ? { metadata: { module: mod } } : undefined,
    customer_email: cleanEmail(email) || undefined,
  });
  return res.status(200).json({ url: session.url });
}
async function confirm(body, res) {
  const { sessionId } = body;
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return res.status(400).json({ error: "Bad session" });
  const session = await stripe("GET", `/checkout/sessions/${sessionId}`);
  if (session.status !== "complete" || session.mode !== "subscription" || !session.subscription) return res.status(200).json({ active: false });
  // Recorded here as well as by the webhook, so access doesn't wait on it.
  const sub = await stripe("GET", `/subscriptions/${session.subscription}`);
  const email = await saveSubscription(sub, cleanEmail(session.customer_details?.email || session.customer_email));
  const access = accessFor(await rowFor(email));
  return res.status(200).json({ ...access, token: access.active ? makeToken(email, "access", ACCESS_TTL_MS) : null });
}
async function status(body, res) {
  const { token } = body;
  // A sign-in link's token (restore) is swapped for an access token here.
  const email = readToken(token, "access") || readToken(token, "restore");
  if (!email) return res.status(200).json({ active: false, email: null, token: null });
  const access = accessFor(await rowFor(email));
  return res.status(200).json({ ...access, token: access.active ? makeToken(email, "access", ACCESS_TTL_MS) : null });
}
async function restore(req, body, res, origin) {
  const email = cleanEmail(body.email);
  if (!email) return res.status(400).json({ error: "Enter a valid email address" });
  if (restoreLimiter) {
    const { success } = await restoreLimiter.limit(`${clientIp(req)}:${email}`);
    if (!success) return res.status(429).json({ error: "Too many requests. Try again later." });
  }
  const access = accessFor(await rowFor(email));
  // The same answer either way, so the form doesn't reveal who subscribes.
  if (access.active && RESEND_KEY) {
    const link = `${origin}/app/modules?restore=${encodeURIComponent(makeToken(email, "restore", RESTORE_TTL_MS))}`;
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: MAIL_FROM, to: [email], subject: "Your Candid sign-in link",
        text: `Open this link on the device you want to use Candid on. It works for 20 minutes.\n\n${link}\n\nIf you didn't ask for this, you can ignore it.`,
      }),
    });
    if (!sent.ok) console.error("Resend failed", sent.status, await sent.text());
  }
  return res.status(200).json({ ok: true });
}
async function portal(body, res, origin) {
  const email = readToken(body.token, "access");
  const row = email && await rowFor(email);
  if (!row?.stripe_customer_id) return res.status(401).json({ error: "Not signed in" });
  const session = await stripe("POST", "/billing_portal/sessions", { customer: row.stripe_customer_id, return_url: `${origin}/app/inputs` });
  return res.status(200).json({ url: session.url });
}

export default async function handler(req, res) {
  const action = req.query?.action;
  if (req.method !== "POST") return res.status(405).end();
  if (!configured()) return res.status(503).json({ error: "Subscriptions aren't set up yet." });
  try {
    // Stripe calls the webhook from its own servers, so no origin check:
    // its signature is the check.
    const raw = await rawBody(req);
    if (action === "webhook") return await webhook(req, res, raw);

    const origin = ourOrigin(req);
    if (!origin) return res.status(403).json({ error: "Forbidden" });
    if (limiter) {
      const { success } = await limiter.limit(clientIp(req));
      if (!success) return res.status(429).json({ error: "Too many requests. Try again shortly." });
    }
    // Checkout and sign-in links return to the site they were asked from.
    const returnTo = origin;
    let body;
    try { body = raw ? JSON.parse(raw) : {}; } catch { return res.status(400).json({ error: "Bad request" }); }
    if (!body || typeof body !== "object") body = {};
    if (action === "checkout") return await checkout(body, res, returnTo);
    if (action === "confirm") return await confirm(body, res);
    if (action === "status") return await status(body, res);
    if (action === "restore") return await restore(req, body, res, returnTo);
    if (action === "portal") return await portal(body, res, returnTo);
    return res.status(404).json({ error: "Unknown action" });
  } catch (e) {
    console.error("billing", action, e);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
