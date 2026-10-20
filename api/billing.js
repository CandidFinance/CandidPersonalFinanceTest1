import crypto from "crypto";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { ALLOWED_HOSTNAMES, allowedOrigin, clientIp, safeEqual, rateLimiter, redis } from "../server/http.js";
import { cleanEmail, makeToken, readToken } from "../server/tokens.js";
import { accessFor } from "../server/access.js";
import { referralLink, codeIsValid } from "../server/referrals.js";

// Subscriptions: the first module's answer is free, every one after it needs
// a subscription (src/lib/unlock.js). One function for all of it, routed by
// ?action=, to stay inside Vercel's function limit:
//   checkout  POST {plan, module, email?}  -> { url } of Stripe's hosted checkout
//   confirm   POST {sessionId}             -> { active, email, token } after checkout
//   status    POST {token}                 -> { active, email, plan, periodEnd, token }
//   restore   POST {email}                 -> emails a sign-in link if subscribed
//   portal    POST {token}                 -> { url } of Stripe's billing portal
//   save      POST {token, state}          -> keeps a subscriber's answers, for
//                                             signing in on another device
//   account   POST {token}                 -> { passkeys, password }: what's set up
//   passkey-enrol-options / passkey-enrol  -> adds a passkey (signed in)
//   passkey-login-options / passkey-login  -> signs in with a passkey
//   password-set   POST {token, password}  -> sets or changes the password
//   password-login POST {email, password}  -> signs in with them
//   referral-link  POST {email}            -> { confirmed, code, earned, cap }:
//                                             their invite link's code
//   referral-check POST {code}             -> { valid }: a ?ref= code is real
//                                             (server/referrals.js)
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
const MAIL_FROM = process.env.BILLING_MAIL_FROM || "Candid <admin@candid-finance.co.uk>";
// Where replies to Candid's emails go: the address in the terms and privacy policy.
const MAIL_REPLY_TO = "admin@candid-finance.co.uk";

// The live site and local dev, plus any hostnames in BILLING_EXTRA_HOSTS
// (comma-separated), for trying checkout on a Vercel preview in test mode.
const BILLING_HOSTNAMES = [...ALLOWED_HOSTNAMES,
  ...(process.env.BILLING_EXTRA_HOSTS || "").split(",").map(h => h.trim()).filter(Boolean)];
const ACCESS_TTL_MS = 30 * 24 * 3600 * 1000;
const RESTORE_TTL_MS = 20 * 60 * 1000;
// The app's inputs are a few kB; this is a ceiling, not a target.
const MAX_STATE_CHARS = 200000;

const limiter = rateLimiter(30, "10 m", "ratelimit:billing");
const restoreLimiter = rateLimiter(3, "1 h", "ratelimit:billing-restore");
const restoreEmailLimiter = rateLimiter(5, "1 d", "ratelimit:billing-restore-email");

const configured = () => !!(STRIPE_KEY && WEBHOOK_SECRET && PRICES.monthly && PRICES.yearly && TOKEN_SECRET && SUPA_URL && SERVICE_KEY);

// The site the request came from, if it's ours: where checkout returns to.
const ourOrigin = req => allowedOrigin(req, BILLING_HOSTNAMES);

// Tokens (access, and sign-in links): server/tokens.js. The passkey
// challenges below are signed the same way, with these.
const b64 = s => Buffer.from(s).toString("base64url");
const sign = body => crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");

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
  return header.split(",").filter(p => p.startsWith("v1=")).some(p => safeEqual(p.slice(3), expected));
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
  // A sign-in link's token (restore) is swapped for an access token here,
  // and brings their saved answers with it, for a new device.
  const signIn = readToken(token, "restore");
  const email = readToken(token, "access") || signIn;
  if (!email) return res.status(200).json({ active: false, email: null, token: null });
  const row = await rowFor(email);
  const access = accessFor(row);
  return res.status(200).json({
    ...access, token: access.active ? makeToken(email, "access", ACCESS_TTL_MS) : null,
    ...(signIn && access.active ? { state: row.saved_state || null } : {}),
  });
}
// A subscriber's answers, saved as they change, so a sign-in elsewhere
// brings them back.
async function saveState(body, res) {
  const email = readToken(body.token, "access");
  if (!email) return res.status(401).json({ error: "Not signed in" });
  const { state } = body;
  if (!state || typeof state !== "object" || Array.isArray(state)) return res.status(400).json({ error: "Bad request" });
  if (JSON.stringify(state).length > MAX_STATE_CHARS) return res.status(413).json({ error: "Too large" });
  if (!accessFor(await rowFor(email)).active) return res.status(403).json({ error: "No subscription" });
  await supa("PATCH", `?email=eq.${encodeURIComponent(email)}`, { saved_state: state, saved_state_at: new Date().toISOString() });
  return res.status(200).json({ ok: true });
}
async function restore(req, body, res, origin) {
  const email = cleanEmail(body.email);
  if (!email) return res.status(400).json({ error: "Enter a valid email address" });
  if (restoreLimiter) {
    const { success } = await restoreLimiter.limit(`${clientIp(req)}:${email}`);
    if (!success) return res.status(429).json({ error: "Too many requests. Try again later." });
  }
  if (restoreEmailLimiter) {
    const { success } = await restoreEmailLimiter.limit(email);
    if (!success) return res.status(429).json({ error: "Too many requests. Try again later." });
  }
  const access = accessFor(await rowFor(email));
  // The same answer either way, so the form doesn't reveal who subscribes.
  if (access.active && RESEND_KEY) {
    const link = `${origin}/signin?restore=${encodeURIComponent(makeToken(email, "restore", RESTORE_TTL_MS))}`;
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: MAIL_FROM, reply_to: MAIL_REPLY_TO, to: [email], subject: "Your Candid sign-in link",
        text: `Open this link on the device you want to use Candid on. It works for 20 minutes.\n\n${link}\n\nIf you didn't ask for this, you can ignore it.`,
      }),
    });
    if (!sent.ok) console.error("Resend failed", sent.status, await sent.text());
  }
  return res.status(200).json({ ok: true });
}
// ── Signing in: a passkey (Face ID, Touch ID, Windows Hello, a phone's
// screen lock) or an email and password, both for subscribers, set up once
// signed in (account, passkey-enrol, password-set). The emailed link
// (restore) stays, for a forgotten password or a device without a passkey.
// Every sign-in answers like a sign-in link: an access token and the
// subscriber's saved answers (signedIn).
//
// Passkeys live in the Supabase `passkeys` table (service_role only), one row
// per credential; a password is a scrypt hash in subscriptions.password_hash.
// A passkey challenge is sealed into a short-lived signed token, so no
// server state is needed to check it, and marked used in Redis (when set up)
// so a captured response can't be replayed. A sign-in challenge lasts
// longer: the sign-in page asks for it on opening, for the keyboard's
// passkey suggestion, which may not be tapped straight away.
const CHALLENGE_TTL_MS = 5 * 60 * 1000, LOGIN_CHALLENGE_TTL_MS = 15 * 60 * 1000;
const PASSWORD_MIN = 10, PASSWORD_MAX = 200;
const passwordLimiter = rateLimiter(10, "1 h", "ratelimit:billing-password");
const enc = encodeURIComponent;

// The passkey's site: the parent domain on the live site, so one passkey
// works on www and the bare domain; the host itself anywhere else.
const rpIdFor = origin => {
  const host = new URL(origin).hostname;
  return host === "candid-finance.co.uk" || host.endsWith(".candid-finance.co.uk") ? "candid-finance.co.uk" : host;
};

function sealChallenge(kind, challenge, email = null, ttl = CHALLENGE_TTL_MS) {
  const body = b64(JSON.stringify({ k: kind, c: challenge, e: email, x: Date.now() + ttl }));
  return `${body}.${sign(body)}`;
}
function openChallenge(token, kind) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  if (!safeEqual(mac, sign(body))) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString());
    return t.k === kind && t.x > Date.now() && typeof t.c === "string" ? t : null;
  } catch { return null; }
}
// True the first time a challenge is used, false after.
async function firstUse(challenge) {
  if (!redis) return true;
  return (await redis.set(`passkey-challenge:${challenge}`, 1, { nx: true, ex: 600 })) === "OK";
}

async function passkeys(method, query, body) {
  const res = await fetch(`${SUPA_URL}/rest/v1/passkeys${query}`, {
    method,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json",
      Prefer: method === "POST" ? "resolution=merge-duplicates,return=minimal" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase passkeys ${res.status}: ${await res.text()}`);
  return method === "GET" ? res.json() : null;
}

// scrypt, from Node itself: "scrypt$N$r$p$salt$key", the cost stored with
// the hash so it can be raised later without breaking older ones.
const SCRYPT = { N: 16384, r: 8, p: 1 };
const scrypt = (password, salt, { N, r, p }) => new Promise((ok, fail) =>
  crypto.scrypt(password.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 }, (e, key) => e ? fail(e) : ok(key)));
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
async function passwordMatches(password, stored) {
  const [alg, N, r, p, salt, key] = String(stored || "").split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const got = await scrypt(password, Buffer.from(salt, "base64url"), { N: +N, r: +r, p: +p });
  const want = Buffer.from(key, "base64url");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
// Hashed against when there's no account, so a wrong email takes as long as
// a wrong password and the form doesn't reveal who has one.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

// Signed in: the same answer as a sign-in link (status with a restore token).
async function signedIn(email, res) {
  const row = await rowFor(email);
  const access = accessFor(row);
  return res.status(200).json({
    ...access, token: access.active ? makeToken(email, "access", ACCESS_TTL_MS) : null,
    ...(access.active ? { state: row.saved_state || null } : {}),
  });
}
// The signed-in subscriber's email, or null.
async function subscriberFrom(token) {
  const email = readToken(token, "access");
  return email && accessFor(await rowFor(email)).active ? email : null;
}

// What's set up for signing in, for the account section.
async function account(body, res) {
  const email = await subscriberFrom(body.token);
  if (!email) return res.status(401).json({ error: "Not signed in" });
  const [row, keys] = await Promise.all([rowFor(email), passkeys("GET", `?email=eq.${enc(email)}&select=id`)]);
  return res.status(200).json({ passkeys: keys.length, password: !!row?.password_hash });
}

async function passkeyEnrolOptions(body, res, origin) {
  const email = await subscriberFrom(body.token);
  if (!email) return res.status(401).json({ error: "Not signed in" });
  const existing = await passkeys("GET", `?email=eq.${enc(email)}&select=id,transports`);
  const options = await generateRegistrationOptions({
    rpName: "Candid", rpID: rpIdFor(origin), userName: email, userDisplayName: email,
    attestationType: "none",
    // One per device: a device that already has one isn't offered another.
    excludeCredentials: existing.map(c => ({ id: c.id, transports: c.transports || undefined })),
    // Saved on this phone or computer (iCloud Keychain, Google Password
    // Manager), unlocked with Face ID, a fingerprint or the screen lock:
    // without this, a phone may offer "another device" (a QR code) first.
    preferredAuthenticatorType: "localDevice",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  return res.status(200).json({ options, challengeToken: sealChallenge("enrol", options.challenge, email) });
}
async function passkeyEnrol(body, res, origin) {
  const email = await subscriberFrom(body.token);
  const ch = openChallenge(body.challengeToken, "enrol");
  if (!email || !ch || ch.e !== email) return res.status(400).json({ error: "That took too long. Please try again." });
  if (!await firstUse(ch.c)) return res.status(400).json({ error: "That took too long. Please try again." });
  const result = await verifyRegistrationResponse({
    response: body.response, expectedChallenge: ch.c, expectedOrigin: origin, expectedRPID: rpIdFor(origin), requireUserVerification: true,
  }).catch(() => null);
  if (!result?.verified || !result.registrationInfo) return res.status(400).json({ error: "That passkey couldn't be added. Please try again." });
  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
  const now = new Date().toISOString();
  await passkeys("POST", "?on_conflict=id", {
    id: credential.id, email, public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter, transports: credential.transports || null,
    device_type: credentialDeviceType, backed_up: credentialBackedUp, created_at: now, last_used_at: now,
  });
  return res.status(200).json({ ok: true });
}

async function passkeyLoginOptions(res, origin) {
  // No list of credentials: the device offers whichever Candid passkeys it holds.
  const options = await generateAuthenticationOptions({ rpID: rpIdFor(origin), userVerification: "required" });
  return res.status(200).json({ options, challengeToken: sealChallenge("login", options.challenge, null, LOGIN_CHALLENGE_TTL_MS) });
}
async function passkeyLogin(body, res, origin) {
  const ch = openChallenge(body.challengeToken, "login");
  const id = body.response?.id;
  if (!ch || typeof id !== "string" || !/^[A-Za-z0-9_-]{8,1400}$/.test(id)) return res.status(400).json({ error: "That took too long. Please try again." });
  if (!await firstUse(ch.c)) return res.status(400).json({ error: "That took too long. Please try again." });
  const [cred] = await passkeys("GET", `?id=eq.${enc(id)}&select=*`);
  if (!cred) return res.status(401).json({ error: "That passkey isn't linked to a Candid subscription. Sign in with your email and password, or a link." });
  const result = await verifyAuthenticationResponse({
    response: body.response, expectedChallenge: ch.c, expectedOrigin: origin, expectedRPID: rpIdFor(origin), requireUserVerification: true,
    credential: { id: cred.id, publicKey: Buffer.from(cred.public_key, "base64url"), counter: Number(cred.counter) || 0, transports: cred.transports || undefined },
  }).catch(() => null);
  if (!result?.verified) return res.status(401).json({ error: "That passkey didn't work. Please try again." });
  await passkeys("PATCH", `?id=eq.${enc(cred.id)}`, { counter: result.authenticationInfo.newCounter, last_used_at: new Date().toISOString() });
  return signedIn(cred.email, res);
}

async function passwordSet(body, res) {
  const email = await subscriberFrom(body.token);
  if (!email) return res.status(401).json({ error: "Not signed in" });
  const { password } = body;
  if (typeof password !== "string" || password.length < PASSWORD_MIN) return res.status(400).json({ error: `Use at least ${PASSWORD_MIN} characters.` });
  if (password.length > PASSWORD_MAX) return res.status(400).json({ error: `Use at most ${PASSWORD_MAX} characters.` });
  await supa("PATCH", `?email=eq.${enc(email)}`, { password_hash: await hashPassword(password), password_set_at: new Date().toISOString() });
  return res.status(200).json({ ok: true });
}
async function passwordLogin(req, body, res) {
  const email = cleanEmail(body.email);
  const { password } = body;
  if (!email || typeof password !== "string" || !password || password.length > PASSWORD_MAX) return res.status(400).json({ error: "Enter your email and password." });
  if (passwordLimiter) {
    const { success } = await passwordLimiter.limit(email);
    if (!success) return res.status(429).json({ error: "Too many attempts. Try again in an hour, or email yourself a sign-in link." });
  }
  const row = await rowFor(email);
  const ok = await passwordMatches(password, row?.password_hash || DUMMY_HASH);
  if (!ok || !row?.password_hash) return res.status(401).json({ error: "That email and password don't match." });
  return signedIn(email, res);
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
    // Saving follows their typing, so it's left out of the per-IP limit; it
    // needs a signed token for a live subscription anyway.
    if (limiter && action !== "save") {
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
    if (action === "save") return await saveState(body, res);
    if (action === "account") return await account(body, res);
    if (action === "passkey-enrol-options") return await passkeyEnrolOptions(body, res, returnTo);
    if (action === "passkey-enrol") return await passkeyEnrol(body, res, returnTo);
    if (action === "passkey-login-options") return await passkeyLoginOptions(res, returnTo);
    if (action === "passkey-login") return await passkeyLogin(body, res, returnTo);
    if (action === "password-set") return await passwordSet(body, res);
    if (action === "password-login") return await passwordLogin(req, body, res);
    if (action === "referral-link") return res.status(200).json(await referralLink(body.email));
    if (action === "referral-check") return res.status(200).json({ valid: await codeIsValid(body.code) });
    return res.status(404).json({ error: "Unknown action" });
  } catch (e) {
    console.error("billing", action, e);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
