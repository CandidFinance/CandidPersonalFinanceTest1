import test from "node:test";
import assert from "node:assert/strict";
import { inviteMessage, inviteMailto, INVITE_SUBJECT } from "./referral.js";

test("the invite says what Candid was used for: the answer given, else the last unlocked, else in general", () => {
  assert.match(inviteMessage("abcd2345", {}, "studentLoan"), /^I've been using Candid to work out whether to pay off my student loan early\. It's a tool that helps people like us work out if we're leaving money on the table./);
  assert.match(inviteMessage("abcd2345", { unlockedModules: ["pension", "cash"] }), /to see if I could be earning more on my savings\./);
  assert.match(inviteMessage("abcd2345", {}), /to see where I could be keeping more of my money\./);
  assert.match(inviteMessage("abcd2345", {}), /\/app\/start\?ref=abcd2345$/);
});

test("the email has its subject and the link in its body", () => {
  const url = inviteMailto(inviteMessage("abcd2345", {}, "cash"));
  assert.ok(url.startsWith(`mailto:?subject=${encodeURIComponent(INVITE_SUBJECT)}&body=`));
  assert.ok(decodeURIComponent(url).includes("ref=abcd2345"));
});
