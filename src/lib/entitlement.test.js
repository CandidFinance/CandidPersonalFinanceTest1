import { test } from "node:test";
import assert from "node:assert/strict";
import { analyticsIdFor } from "./entitlement.js";

test("a subscriber's analytics id is a stable hash of their email, never the email itself", async () => {
  const id = await analyticsIdFor("Sam.Smith@Example.com ");
  assert.match(id, /^sub_[0-9a-f]{32}$/);
  // The same person whatever the case or spacing they signed in with.
  assert.equal(await analyticsIdFor("sam.smith@example.com"), id);
  // Different people, different ids.
  assert.notEqual(await analyticsIdFor("someone.else@example.com"), id);
  assert.ok(!id.includes("sam") && !id.includes("example"));
});
