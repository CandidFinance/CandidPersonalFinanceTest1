import test from "node:test";
import assert from "node:assert/strict";
import { isLocked, unlockAsk, unlockPatch, validEmail, UNLOCK_QUESTIONS } from "./unlock.js";

test("only gated users, and only scored modules, are locked", () => {
  assert.equal(isLocked({}, "cash"), false);
  assert.equal(isLocked({ unlockGate: true }, "cash"), true);
  assert.equal(isLocked({ unlockGate: true }, "property"), false);
  assert.equal(isLocked({ unlockGate: true, unlockedModules: ["cash"] }, "cash"), false);
});

test("email first, then one question per unlock, then free", () => {
  let d = { unlockGate: true };
  assert.equal(unlockAsk(d).kind, "email");
  d = { ...d, ...unlockPatch(d, "cash", unlockAsk(d), { email: " a@b.co ", callOk: true }) };
  assert.equal(d.email, "a@b.co");
  assert.equal(d.unlockCallOk, true);
  assert.equal(isLocked(d, "cash"), false);
  for (const q of UNLOCK_QUESTIONS) {
    const ask = unlockAsk(d);
    assert.equal(ask.question.id, q.id);
    d = { ...d, ...unlockPatch(d, "pension", ask, q.options[0].value) };
  }
  assert.equal(unlockAsk(d).kind, "free");
});

test("an email typed elsewhere in the app doesn't count as the unlock", () => {
  assert.equal(unlockAsk({ email: "a@b.co" }).kind, "email");
  assert.ok(!validEmail("nope"));
});
