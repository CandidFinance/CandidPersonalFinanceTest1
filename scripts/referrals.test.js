import test from "node:test";
import assert from "node:assert/strict";
import { accessFor } from "../server/access.js";
import { CODE_RE } from "../server/referrals.js";

const now = Date.parse("2026-10-20T12:00:00Z");

test("a free month from invites gives access until it ends, then none", () => {
  const row = { email: "a@b.co", status: "active", plan: "referral", current_period_end: "2026-11-19T12:00:00Z" };
  assert.equal(accessFor(row, now).active, true);
  assert.equal(accessFor(row, Date.parse("2026-11-19T12:00:01Z")).active, false);
  assert.equal(accessFor({ ...row, current_period_end: null }, now).active, false);
});

test("paid and hand-given plans aren't cut off by the date", () => {
  // past_due runs past the period end while Stripe retries.
  assert.equal(accessFor({ status: "past_due", plan: "monthly", current_period_end: "2026-10-01T00:00:00Z" }, now).active, true);
  assert.equal(accessFor({ status: "active", plan: "comp", current_period_end: null }, now).active, true);
  assert.equal(accessFor({ status: "canceled", plan: "yearly" }, now).active, false);
  assert.equal(accessFor(null, now).active, false);
});

test("invite codes: eight characters, none easily misread", () => {
  assert.ok(CODE_RE.test("abcd2345"));
  for (const bad of ["abcd234", "abcd23456", "abcd2340", "abcd234l", "abcd234i", "abcd234o", "ABCD2345", "abcd-234"]) assert.ok(!CODE_RE.test(bad), bad);
});

test("one inbox, however it's spelt: + tags, and Gmail's dots and googlemail", async () => {
  const { inboxOf } = await import("../server/referrals.js");
  assert.equal(inboxOf("Sam+candid@Example.co.uk"), "sam@example.co.uk");
  assert.equal(inboxOf("s.a.m+2@gmail.com"), "sam@gmail.com");
  assert.equal(inboxOf("sam@googlemail.com"), "sam@gmail.com");
  // Dots matter elsewhere.
  assert.equal(inboxOf("s.am@outlook.com"), "s.am@outlook.com");
  assert.equal(inboxOf("not an email"), null);
});
