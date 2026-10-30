import test from "node:test";
import assert from "node:assert/strict";
import { accountState } from "../server/access.js";

const now = Date.parse("2026-10-30T12:00:00Z");
const future = "2026-12-01T00:00:00Z", past = "2026-10-01T00:00:00Z";

test("a free account is signed in, with no subscription and nothing to cancel", () => {
  const a = accountState({ email: "a@b.co", status: "none", plan: null }, now);
  assert.deepEqual([a.signedIn, a.active, a.paidLive], [true, false, false]);
});

test("a paid plan still running blocks deleting until it's cancelled", () => {
  const live = { email: "a@b.co", status: "active", plan: "monthly", current_period_end: future, cancel_at_period_end: false };
  assert.equal(accountState(live, now).paidLive, true);
  assert.equal(accountState({ ...live, cancel_at_period_end: true }, now).paidLive, false);
  assert.equal(accountState({ ...live, status: "canceled" }, now).paidLive, false);
  assert.equal(accountState({ ...live, status: "past_due", plan: "yearly" }, now).paidLive, true);
});

test("comp and referral months have nothing to cancel", () => {
  assert.equal(accountState({ email: "a@b.co", status: "active", plan: "comp" }, now).paidLive, false);
  const referral = accountState({ email: "a@b.co", status: "active", plan: "referral", current_period_end: future }, now);
  assert.deepEqual([referral.active, referral.paidLive], [true, false]);
  assert.equal(accountState({ email: "a@b.co", status: "active", plan: "referral", current_period_end: past }, now).active, false);
});

test("no row: not signed in", () => {
  assert.deepEqual([accountState(null, now).signedIn, accountState(null, now).active], [false, false]);
});
