import test from "node:test";
import assert from "node:assert/strict";
import { clickBlocked, fillBlocked, pageHandoff } from "./guardrails.js";

test("never presses agree, declare, submit, sign in or money buttons, nor ticks boxes", () => {
  for (const text of ["I agree", "Accept and continue", "Submit application", "Confirm and open account", "Log in", "Fund your account", "Make a deposit", "I declare that"]) {
    assert.ok(clickBlocked({ tag: "button", text }), text);
  }
  assert.ok(clickBlocked({ tag: "input", type: "checkbox", label: "Marketing emails" }));
  for (const text of ["Continue", "Next", "Apply now", "Open an account", "Find address", "Back"]) {
    assert.equal(clickBlocked({ tag: "button", text }), null, text);
  }
});

test("never fills passwords, files, codes, NI numbers or bank details", () => {
  assert.ok(fillBlocked({ type: "password" }));
  assert.ok(fillBlocked({ type: "file" }));
  assert.ok(fillBlocked({ type: "text", autocomplete: "one-time-code" }));
  assert.ok(fillBlocked({ type: "text", label: "National Insurance number" }));
  assert.ok(fillBlocked({ type: "text", label: "Sort code" }));
  assert.equal(fillBlocked({ type: "text", label: "First name" }), null);
});

test("hands over for passwords, codes, uploads, cards and ID checks", () => {
  assert.ok(pageHandoff({ flags: { password: true } }));
  assert.ok(pageHandoff({ flags: { frames: ["https://sdk.onfido.com/x"] } }));
  assert.ok(pageHandoff({ flags: {}, text: "Now take a selfie" }));
  assert.equal(pageHandoff({ flags: { frames: ["https://www.google.com/recaptcha"] }, text: "Your details" }), null);
});
