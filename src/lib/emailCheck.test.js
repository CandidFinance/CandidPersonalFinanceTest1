import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEmail, suggestDomain, validEmailShape, COMMON_DOMAINS } from "./emailCheck.js";

test("an ordinary address passes, tidied", () => {
  assert.deepEqual(checkEmail("  Jo.Bloggs+candid@Gmail.COM "), { email: "Jo.Bloggs+candid@gmail.com", problem: null, suggestion: null });
  assert.equal(checkEmail("someone@candid-finance.co.uk").problem, null);
  assert.equal(checkEmail("someone@nhs.net").suggestion, null);
});

test("anything not shaped like an address is a format problem", () => {
  for (const bad of ["", "nope", "a@b", "a@b.c", "@gmail.com", "jo@", "jo bloggs@gmail.com", "jo..b@gmail.com", ".jo@gmail.com",
    "jo@-gmail.com", "jo@gmail..com", "jo@gmail.c0m", "jo@@gmail.com", null, 42]) {
    assert.equal(checkEmail(bad).problem, "format", String(bad));
  }
  assert.ok(!validEmailShape("nope"));
  assert.ok(validEmailShape("jo@gmail.com"));
});

test("placeholders and throwaway inboxes are turned away", () => {
  assert.equal(checkEmail("me@example.com").problem, "placeholder");
  assert.equal(checkEmail("me@test.com").problem, "placeholder");
  assert.equal(checkEmail("me@box.test").problem, "placeholder");
  assert.equal(checkEmail("noreply@acme.com").problem, "placeholder");
  assert.equal(checkEmail("x@mailinator.com").problem, "disposable");
  assert.equal(checkEmail("x@inbox.mailinator.com").problem, "disposable");
  assert.equal(checkEmail("x@yopmail.com").problem, "disposable");
});

test("a near miss of a common domain gets a suggestion, which doesn't block it", () => {
  assert.deepEqual(checkEmail("jo@gmial.com"), { email: "jo@gmial.com", problem: null, suggestion: "jo@gmail.com" });
  assert.equal(checkEmail("jo@gmail.co").suggestion, "jo@gmail.com");
  assert.equal(checkEmail("jo@hotmial.co.uk").suggestion, "jo@hotmail.co.uk");
  assert.equal(checkEmail("jo@yahooo.co.uk").suggestion, "jo@yahoo.co.uk");
  assert.equal(checkEmail("jo@outlok.com").suggestion, "jo@outlook.com");
  assert.equal(checkEmail("jo@btinternet.con").suggestion, "jo@btinternet.com");
  assert.equal(checkEmail("jo@acme.con").suggestion, "jo@acme.com");
  assert.equal(checkEmail("jo@acme.co.uj").suggestion, "jo@acme.co.uk");
});

test("real domains near a common one aren't 'corrected'", () => {
  for (const c of COMMON_DOMAINS) assert.equal(suggestDomain(c), null, c);
  for (const d of ["gmx.de", "yahoo.fr", "hotmail.fr", "live.ca", "acme.com", "bt.com", "web.de", "ed.ac.uk", "outlook.co.uk"]) {
    assert.equal(suggestDomain(d), null, d);
  }
});
