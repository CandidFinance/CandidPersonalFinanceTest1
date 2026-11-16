// Sign-ins that can be ended (api/billing.js, server/tokens.js): an access
// token stops working when the account's token_version moves on, when the
// sign-in behind it is too old, and it takes a recent sign-in to change how
// an account is signed in to. Supabase is a pair of in-memory tables here.
import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

Object.assign(process.env, {
  STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_PRICE_MONTHLY: "price_m", STRIPE_PRICE_YEARLY: "price_y",
  STRIPE_BILLING_TOKEN_SECRET: "test-secret", VITE_SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "service",
});
delete process.env.UPSTASH_REDIS_REST_URL;

const db = { subscriptions: [], passkeys: [] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, { method = "GET", body } = {}) => {
  const u = new URL(url);
  const name = u.pathname.split("/").pop();
  const rows = db[name];
  const answer = (json, status = 200) => ({ ok: status < 400, status, json: async () => json, text: async () => JSON.stringify(json) });
  if (u.host !== "db.test" || !rows) return answer([]);
  const email = (u.searchParams.get("email") || "").replace(/^eq\./, "");
  const match = r => !email || r.email === email;
  if (method === "GET") return answer(rows.filter(match));
  if (method === "PATCH") { rows.filter(match).forEach(r => Object.assign(r, JSON.parse(body))); return answer(null); }
  if (method === "DELETE") { db[name] = rows.filter(r => !match(r)); return answer(null); }
  return answer(null);
};
test.after(() => { globalThis.fetch = realFetch; });

const { makeToken, readSession, SESSION_MAX_MS } = await import("../server/tokens.js");
const { default: handler } = await import("../api/billing.js");

const MIN = 60 * 1000, DAY = 24 * 60 * MIN, TTL = 30 * DAY;
const tokenFor = (email, extra) => makeToken(email, "access", TTL, extra);
const payload = token => JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());

async function call(action, body) {
  const req = Object.assign(Readable.from([JSON.stringify(body)]), {
    method: "POST", query: { action }, headers: { origin: "https://candid-finance.co.uk" }, socket: {},
  });
  const out = {};
  const res = { status(s) { out.status = s; return this; }, json(j) { out.json = j; return this; }, end() { return this; } };
  await handler(req, res);
  return out;
}
const account = (email, more = {}) => { db.subscriptions = [{ email, status: "none", ...more }]; db.passkeys = []; return db.subscriptions[0]; };

test("a token from before versions reads as version 0 with no sign-in time", () => {
  assert.deepEqual(readSession(tokenFor("a@x.com")), { email: "a@x.com", version: 0, since: null });
});

test("a sign-in older than the maximum is refused, however fresh the token", () => {
  assert.equal(readSession(tokenFor("a@x.com", { v: 0, s: Date.now() - SESSION_MAX_MS - MIN })), null);
  assert.ok(readSession(tokenFor("a@x.com", { v: 0, s: Date.now() - SESSION_MAX_MS + MIN })));
});

test("renewing keeps the sign-in time and the version", async () => {
  account("a@x.com", { token_version: 3 });
  const since = Date.now() - 5 * DAY;
  const r = await call("status", { token: tokenFor("a@x.com", { v: 3, s: since }) });
  assert.deepEqual([payload(r.json.token).v, payload(r.json.token).s], [3, since]);
});

test("an old-style token is renewed as a sign-in that isn't recent", async () => {
  account("a@x.com", { password_hash: "scrypt$1$1$1$a$b" });
  const r = await call("status", { token: tokenFor("a@x.com") });
  assert.ok(r.json.token);
  assert.equal((await call("password-set", { token: r.json.token, password: "a-new-password" })).status, 403);
});

test("signing out everywhere ends every token for the account", async () => {
  account("a@x.com");
  const token = tokenFor("a@x.com", { v: 0, s: Date.now() });
  assert.equal((await call("sign-out-everywhere", { token })).status, 200);
  assert.equal((await call("status", { token })).json.token, null);
  for (const action of ["account", "save", "portal", "alerts-set", "passkey-enrol-options", "password-set", "sign-out-everywhere"]) {
    assert.equal((await call(action, { token, on: true, state: {}, password: "a-new-password" })).status, 401, action);
  }
  assert.equal((await call("delete-account", { token, confirm: "DELETE" })).status, 401);
  assert.equal(db.subscriptions.length, 1);
});

test("a new password ends the other sign-ins and keeps this one", async () => {
  account("a@x.com");
  const here = tokenFor("a@x.com", { v: 0, s: Date.now() }), elsewhere = tokenFor("a@x.com", { v: 0, s: Date.now() - DAY });
  const r = await call("password-set", { token: here, password: "a-new-password" });
  assert.equal(r.status, 200);
  assert.equal((await call("account", { token: r.json.token })).status, 200);
  assert.equal((await call("account", { token: elsewhere })).status, 401);
  assert.equal((await call("account", { token: here })).status, 401);
});

test("an account with a way to sign in needs a recent sign-in to change it or be deleted", async () => {
  const stale = { v: 0, s: Date.now() - 31 * MIN }, fresh = { v: 0, s: Date.now() - 29 * MIN };
  for (const setUp of [{ password_hash: "scrypt$1$1$1$a$b" }, { google_sub: "g1" }, { passkey: true }]) {
    account("a@x.com", setUp.passkey ? {} : setUp);
    if (setUp.passkey) db.passkeys = [{ id: "cred1", email: "a@x.com" }];
    const old = tokenFor("a@x.com", stale);
    for (const [action, body] of [["password-set", { password: "a-new-password" }], ["passkey-enrol-options", {}], ["delete-account", { confirm: "DELETE" }]]) {
      const r = await call(action, { token: old, ...body });
      assert.deepEqual([r.status, r.json.reauth], [403, true], `${action} ${Object.keys(setUp)}`);
    }
    assert.equal(db.subscriptions.length, 1);
    assert.equal((await call("delete-account", { token: tokenFor("a@x.com", fresh), confirm: "DELETE" })).status, 200);
    assert.equal(db.subscriptions.length, 0);
  }
});

test("an account with no way to sign in yet sets its first with an older sign-in", async () => {
  account("a@x.com");
  const r = await call("password-set", { token: tokenFor("a@x.com", { v: 0, s: Date.now() - 20 * DAY }), password: "a-new-password" });
  assert.equal(r.status, 200);
  assert.ok(db.subscriptions[0].password_hash);
  assert.equal(db.subscriptions[0].token_version, 1);
});
