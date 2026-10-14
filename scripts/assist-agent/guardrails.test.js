import test from "node:test";
import assert from "node:assert/strict";
import { clickBlocked, fillBlocked, pageHandoff, tickBlocked } from "./guardrails.js";

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
  assert.equal(fillBlocked({ type: "text", label: "Account holder's name" }), null);
  assert.equal(fillBlocked({ type: "text", label: "First name" }), null);
});

test("hands over for passwords, codes, uploads, cards and ID checks", () => {
  assert.ok(pageHandoff({ flags: { password: true } }));
  assert.ok(pageHandoff({ flags: { frames: ["https://sdk.onfido.com/x"] } }));
  assert.ok(pageHandoff({ flags: {}, text: "Now take a selfie" }));
  assert.equal(pageHandoff({ flags: { frames: ["https://www.google.com/recaptcha"] }, text: "Your details" }), null);
});

test("ticks answer boxes only, never declarations, consents or marketing", () => {
  for (const item of [
    { type: "checkbox", label: "Please confirm these statements are true" },
    { type: "checkbox", label: "I have read and understood the terms" },
    { type: "checkbox", label: "Email", group: "Would you like to hear about our offers?" },
    { type: "checkbox", label: "Yes", group: "Can we contact you about promotions?" },
    { type: "checkbox", label: "I declare that the information is correct" },
  ]) assert.ok(tickBlocked(item), `${item.label} / ${item.group}`);
  for (const item of [
    { type: "checkbox", label: "Savings", group: "Where does the money come from? Tick all that apply" },
    { type: "checkbox", label: "Email", group: "Preferred method of communication" },
    { type: "checkbox", label: "No", group: "Do any funds come from outside the UK/EU, US or CANZAK?" },
  ]) assert.equal(tickBlocked(item), null, `${item.label} / ${item.group}`);
});
