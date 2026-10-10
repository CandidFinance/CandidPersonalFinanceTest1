// Unlocking module answers. A new user answers every module's questions and
// sees the £ each is worth, but each module's answer (its reveal, its page,
// and what Assist says about it) stays hidden until they unlock it: the
// first with their email, each one after with a one-tap feedback question.
// They choose which to unlock, so the order never depends on which is
// biggest. Pure, unit tested in unlock.test.js.
//
// Only users who came in after the gate shipped are gated (`unlockGate`,
// set at the app's entry), so no one loses an answer they could already see.
// UNLOCK_GATE_ON switches it off for everyone.

import { SCORED_MODULES } from "./appEntry.js";

export const UNLOCK_GATE_ON = true;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validEmail = email => typeof email === "string" && EMAIL_RE.test(email.trim());

export function isLocked(d, key) {
  if (!UNLOCK_GATE_ON || d.unlockGate !== true || !SCORED_MODULES.includes(key)) return false;
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

// What unlocking the next module asks for: their email first ("email"),
// then the next feedback question not yet answered, or nothing once they're
// all answered ({ kind: "free" }).
export function unlockAsk(d) {
  if (!validEmail(d.email) || !d.unlockEmailGiven) return { kind: "email" };
  const answered = d.unlockFeedback || {};
  const q = UNLOCK_QUESTIONS.find(x => !(x.id in answered));
  return q ? { kind: "question", question: q } : { kind: "free" };
}

// The patch that unlocks `key`, given what was asked and the answer.
export function unlockPatch(d, key, ask, answer) {
  const unlockedModules = [...new Set([...(d.unlockedModules || []), key])];
  if (ask.kind === "email") return { unlockedModules, email: answer.email.trim(), unlockEmailGiven: true, unlockCallOk: !!answer.callOk };
  if (ask.kind === "question") return { unlockedModules, unlockFeedback: { ...(d.unlockFeedback || {}), [ask.question.id]: answer } };
  return { unlockedModules };
}
