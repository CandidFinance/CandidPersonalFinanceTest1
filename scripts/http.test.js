import { test } from "node:test";
import assert from "node:assert/strict";

// server/http.js reads its environment once, on import, so each case imports
// a fresh copy (the query string) with the environment it's about.
async function httpWith(env, tag) {
  const keys = ["VERCEL_ENV", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
  const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, env);
  try { return await import(`../server/http.js?${tag}`); }
  finally { for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; } }
}
const from = origin => ({ headers: { origin } });

test("production answers only the live site; local dev is allowed anywhere else", async () => {
  const live = await httpWith({ VERCEL_ENV: "production" }, "live");
  assert.equal(live.allowedOrigin(from("https://www.candid-finance.co.uk")), "https://www.candid-finance.co.uk");
  assert.equal(live.allowedOrigin(from("https://candid-finance.co.uk")), "https://candid-finance.co.uk");
  assert.equal(live.allowedOrigin(from("http://localhost:8080")), null);
  assert.equal(live.allowedOrigin(from("http://127.0.0.1:5173")), null);
  assert.equal(live.allowedOrigin(from("https://www.candid-finance.co.uk.evil.co")), null);

  const dev = await httpWith({}, "dev");
  assert.equal(dev.allowedOrigin(from("http://localhost:5173")), "http://localhost:5173");
  const preview = await httpWith({ VERCEL_ENV: "preview" }, "preview");
  assert.equal(preview.allowedOrigin(from("http://localhost:5173")), "http://localhost:5173");
});

test("the admin password lets nobody in when guesses can't be counted", async () => {
  const req = { headers: { "x-admin-password": "right" }, socket: {} };
  // Production without Redis: no limiter exists, so no entry.
  const live = await httpWith({ VERCEL_ENV: "production" }, "live-no-redis");
  assert.equal(live.limitsReady(), false);
  assert.equal(await live.checkAdminPassword(req, "right", null, "test"), 503);
  // Redis failing: the same, even with the right password.
  const failing = { getRemaining: async () => { throw new Error("down"); }, limit: async () => ({ success: true }) };
  assert.equal(await live.checkAdminPassword(req, "right", failing, "test"), 503);

  // Local dev has no Redis and still works.
  const dev = await httpWith({}, "dev-no-redis");
  assert.equal(dev.limitsReady(), true);
  assert.equal(await dev.checkAdminPassword(req, "right", null, "test"), 200);
  assert.equal(await dev.checkAdminPassword(req, "wrong", null, "test"), 401);

  // A working limiter: in, out, and shut once the guesses are used up.
  const counting = left => ({ getRemaining: async () => ({ remaining: left }), limit: async () => ({ success: true }) });
  assert.equal(await live.checkAdminPassword(req, "right", counting(5), "test"), 200);
  assert.equal(await live.checkAdminPassword(req, "wrong", counting(5), "test"), 401);
  assert.equal(await live.checkAdminPassword(req, "right", counting(0), "test"), 429);
});
