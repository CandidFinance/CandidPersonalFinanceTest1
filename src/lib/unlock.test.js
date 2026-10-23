import test from "node:test";
import assert from "node:assert/strict";
import { isLocked, unlockAsk, unlockPatch, firstUnlockPatch, validEmail, UNLOCK_QUESTIONS } from "./unlock.js";

test("only gated users, and only scored modules, are locked", () => {
  assert.equal(isLocked({}, "cash"), false);
  assert.equal(isLocked({ unlockGate: true }, "cash"), true);
  assert.equal(isLocked({ unlockGate: true }, "property"), false);
  assert.equal(isLocked({ unlockGate: true, unlockedModules: ["cash"] }, "cash"), false);
});

test("the first answer is free, with no email asked; it unlocks by itself", () => {
  const d = { unlockGate: true };
  assert.deepEqual(firstUnlockPatch(d, "studentLoan"), { unlockedModules: ["studentLoan"] });
  assert.equal(unlockAsk(d).kind, "free");
  const known = { ...d, email: "sam@example.com" };
  assert.deepEqual(firstUnlockPatch(known, "studentLoan"), { unlockedModules: ["studentLoan"] });
  assert.equal(firstUnlockPatch({ ...known, unlockedModules: ["cash"] }, "pension"), null);
  assert.equal(firstUnlockPatch({}, "cash"), null);
  // An email given to unlock (FIRST_ANSWER_FREE off) unlocks it and keeps the email.
  assert.deepEqual(unlockPatch(d, "cash", { kind: "email" }, { email: " sam@example.com ", callOk: true }),
    { unlockedModules: ["cash"], email: "sam@example.com", unlockEmailGiven: true, unlockCallOk: true });
});

test("after the first, a subscription, which unlocks every module", () => {
  const d = { unlockGate: true, unlockedModules: ["studentLoan"] };
  assert.equal(unlockAsk(d, false).kind, "pay");
  assert.equal(isLocked(d, "cash", false), true);
  assert.equal(unlockAsk(d, true).kind, "free");
  assert.equal(isLocked(d, "cash", true), false);
  assert.equal(isLocked(d, "pension", true), false);
  // Paying doesn't make the first one count as unlocked by itself.
  assert.equal(firstUnlockPatch({ unlockGate: true }, "cash", true), null);
});

test("modules unlocked before payments, by email or a question, stay unlocked", () => {
  const d = { unlockGate: true, unlockedModules: ["cash", "pension"], unlockEmailGiven: true };
  assert.equal(isLocked(d, "pension", false), false);
  assert.equal(isLocked(d, "investments", false), true);
  assert.deepEqual(unlockPatch(d, "investments", { kind: "question", question: UNLOCK_QUESTIONS[0] }, "friend").unlockFeedback, { heard: "friend" });
  assert.ok(!validEmail("nope"));
});

test("arriving on a friend's invite makes the second answer free, and only the second", () => {
  const one = { unlockGate: true, unlockedModules: ["cash"], email: "a@b.co" };
  assert.deepEqual(unlockAsk(one, false, true), { kind: "free", invite: true });
  assert.equal(unlockAsk(one, false, false).kind, "pay");
  assert.equal(unlockAsk({ ...one, unlockedModules: ["cash", "pension"] }, false, true).kind, "pay");
  // The first answer is free either way.
  assert.equal(unlockAsk({ unlockGate: true }, false, true).kind, "free");
});
