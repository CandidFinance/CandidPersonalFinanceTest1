// Unlocking module answers. Each module's answer (its reveal, its page, and
// what Assist says about it) stays hidden until it's unlocked. The first
// module's answer is theirs for their email; every one after that needs a
// subscription (src/lib/entitlement.js, api/billing.js), which unlocks them
// all, and its frosted answer and the paywall show before its questions, so
// nothing is answered for an answer they can't see. Modules unlocked before
// payments, with an email or a feedback question, stay unlocked.
// They choose which to unlock, so the order never depends on which is
// biggest. Pure, unit tested in unlock.test.js.
//
// Only users who came in after the gate shipped are gated (`unlockGate`,
// set at the app's entry), so no one loses an answer they could already see.
// UNLOCK_GATE_ON switches it off for everyone. `paid` is for tests; in the
// app it's this browser's subscription.

import { SCORED_MODULES } from "./appEntry.js";
import { hasAccess } from "./entitlement.js";

export const UNLOCK_GATE_ON = true;

// The local dev server (`npm run dev`) skips the gate, so every module and
// Assist can be worked on without paying. Production builds and the tests
// never see import.meta.env.DEV. VITE_DEV_PAYWALL=1 in .env.local puts the
// gate back locally, to work on the paywall itself.
const DEV_UNGATED = !!import.meta.env?.DEV && import.meta.env.VITE_DEV_PAYWALL !== "1";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validEmail = email => typeof email === "string" && EMAIL_RE.test(email.trim());

export function isLocked(d, key, paid = hasAccess()) {
  if (!UNLOCK_GATE_ON || DEV_UNGATED || d.unlockGate !== true || !SCORED_MODULES.includes(key) || paid) return false;
  return !(d.unlockedModules || []).includes(key);
}

// One tap each. Each answer goes on the user's row and to PostHog, where
// they answer questions Candid needs answering: how people find it, what
// they'd pay, whether it's clear, and what to build next.
export const UNLOCK_QUESTIONS = [
  { id: "heard", ask: "How did you hear about Candid?", options: [
    { value: "friend", label: "A friend or colleague" }, { value: "linkedin", label: "LinkedIn" },
    { value: "social", label: "Other social media" }, { value: "search", label: "A search engine" },
    { value: "other", label: "Somewhere else" },
  ] },
  { id: "pay", ask: "If Candid kept your figures up to date and told you when something changed, what would that be worth to you?", options: [
    { value: "0", label: "Nothing, I'd only use it free" }, { value: "3", label: "£3 a month" },
    { value: "5", label: "£5 a month" }, { value: "10", label: "£10 a month or more" },
  ] },
  { id: "clear", ask: "How clear has Candid been so far?", options: [
    { value: "very", label: "Very clear" }, { value: "mostly", label: "Mostly clear" },
    { value: "confusing", label: "Some of it confused me" },
  ] },
  { id: "next", ask: "What would you most like Candid to help with next?", options: [
    { value: "open_accounts", label: "Opening better accounts for me" },
    { value: "benefits", label: "Checking for benefits I'm owed" },
    { value: "adviser", label: "Talking it through with an adviser" },
    { value: "self_employed", label: "Tax when self-employed" },
  ] },
];

// The first module finished unlocks by itself only when Candid already has
// their email (a subscriber signing in, say): the patch to apply when a
// gated user with nothing unlocked yet finishes `key`, or null, in which
// case its answer asks for their email (unlockAsk).
export function firstUnlockPatch(d, key, paid = hasAccess()) {
  if (!isLocked(d, key, paid) || (d.unlockedModules || []).length || !validEmail(d.email)) return null;
  return { unlockedModules: [key] };
}

// What unlocking the next module asks for: the first answer, their email
// ({ kind: "email" }; nothing if Candid has it already), then a
// subscription ("pay"). The feedback questions (UNLOCK_QUESTIONS) are no
// longer asked here; unlockPatch still records an answer to one.
export function unlockAsk(d, paid = hasAccess()) {
  if (paid) return { kind: "free" };
  if (!(d.unlockedModules || []).length) return validEmail(d.email) ? { kind: "free" } : { kind: "email" };
  return { kind: "pay" };
}

// The patch that unlocks `key`, given what was asked and the answer.
export function unlockPatch(d, key, ask, answer) {
  const unlockedModules = [...new Set([...(d.unlockedModules || []), key])];
  if (ask.kind === "email") return { unlockedModules, email: answer.email.trim(), unlockEmailGiven: true, unlockCallOk: !!answer.callOk };
  if (ask.kind === "question") return { unlockedModules, unlockFeedback: { ...(d.unlockFeedback || {}), [ask.question.id]: answer } };
  return { unlockedModules };
}
