// Unlocking module answers. Each module's answer (its reveal, its page, and
// what Assist says about it) stays hidden until it's unlocked. The first
// module's answer is free, with no email asked first (FIRST_ANSWER_FREE; the
// email is offered after the answer, SaveFiguresOffer.jsx); every one after that needs a
// subscription (src/lib/entitlement.js, api/billing.js), which unlocks them
// all. Every module's questions can be answered free, and its £ figure is
// shown (it adds to their total); what's behind the paywall is why, and
// their options and what each is worth. Modules unlocked before
// payments, with an email or a feedback question, stay unlocked.
// They choose which to unlock, so the order never depends on which is
// biggest. Pure, unit tested in unlock.test.js.
//
// Only users who came in after the gate shipped are gated (`unlockGate`,
// set at the app's entry), so no one loses an answer they could already see.
// UNLOCK_GATE_ON switches it off for everyone. `paid` is for tests; in the
// app it's this browser's subscription.

import { SCORED_MODULES, moduleAnswered, loanVerdictReady } from "./appEntry.js";
import { hasAccess } from "./entitlement.js";
import { validEmailShape } from "./emailCheck.js";
import { hasReferralBonus } from "./referral.js";

export const UNLOCK_GATE_ON = true;

// From 23 Oct 2026 the first answer is free outright: asking for an email
// before it felt like being locked out of their own answer. false puts the
// email back in front of it.
export const FIRST_ANSWER_FREE = true;

// The local dev server (`npm run dev`) skips the gate, so every module and
// Assist can be worked on without paying. Production builds and the tests
// never see import.meta.env.DEV. VITE_DEV_PAYWALL=1 in .env.local puts the
// gate back locally, to work on the paywall itself.
const DEV_UNGATED = !!import.meta.env?.DEV && import.meta.env.VITE_DEV_PAYWALL !== "1";

// Its shape only; the unlock form checks more (emailCheck.js).
export const validEmail = validEmailShape;

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

// The first module finished unlocks by itself (with FIRST_ANSWER_FREE off,
// only when Candid already has their email): the patch to apply when a
// gated user with nothing unlocked yet finishes `key`, or null, in which
// case its answer asks for their email (unlockAsk).
export function firstUnlockPatch(d, key, paid = hasAccess()) {
  if (!isLocked(d, key, paid) || (d.unlockedModules || []).length || !(FIRST_ANSWER_FREE || validEmail(d.email))) return null;
  return { unlockedModules: [key] };
}

// What unlocking the next module asks for: the first answer, nothing
// (with FIRST_ANSWER_FREE off, their email, { kind: "email" }, unless
// Candid has it already), then a
// subscription ("pay"). The feedback questions (UNLOCK_QUESTIONS) are no
// longer asked here; unlockPatch still records an answer to one.
// Arriving on a friend's invite (referral.js) makes the second answer free
// too ({ kind: "free", invite: true }), and a module found on track makes
// one more free ({ kind: "free", bonus: <that module> }, onTrackReward).
export function unlockAsk(d, paid = hasAccess(), invited = hasReferralBonus()) {
  if (paid) return { kind: "free" };
  const unlocked = (d.unlockedModules || []).length;
  if (!unlocked) return FIRST_ANSWER_FREE || validEmail(d.email) ? { kind: "free" } : { kind: "email" };
  if (invited && unlocked === 1) return { kind: "free", invite: true };
  if (d.onTrackBonus && !d.onTrackBonusUsed) return { kind: "free", bonus: d.onTrackBonus };
  return { kind: "pay" };
}

// The patch that unlocks `key`, given what was asked and the answer.
export function unlockPatch(d, key, ask, answer) {
  const unlockedModules = [...new Set([...(d.unlockedModules || []), key])];
  if (ask.kind === "email") return { unlockedModules, email: answer.email.trim(), unlockEmailGiven: true, unlockCallOk: !!answer.callOk };
  if (ask.kind === "question") return { unlockedModules, unlockFeedback: { ...(d.unlockFeedback || {}), [ask.question.id]: answer } };
  if (ask.bonus) return { unlockedModules, onTrackBonusUsed: true };
  return { unlockedModules };
}

// A module answered, unlocked and with nothing to improve earns one more
// answer free, once per user, so landing on a module that's already in
// order isn't a wasted answer. `st` is its status (moduleStatus.js): "ok",
// and not one whose figure is counted elsewhere (Kids & family's childcare
// under the £100k tax trap), nor Student loan before its verdict is ready.
// `onTrackBonus` is the module that earned it; unlockAsk then makes the
// next unlock free, and `onTrackBonusUsed` closes it. "bonus" while it's
// there to earn or use; "stat" (a national figure instead, OnTrackReward.jsx)
// for subscribers, once it's used, or with nothing left locked; null when
// there's something to improve.
export function onTrackReward(d, key, st, paid = hasAccess()) {
  if (st?.status !== "ok" || st.elsewhere || !moduleAnswered(key, d) || isLocked(d, key, paid)) return null;
  if (key === "studentLoan" && !loanVerdictReady(d)) return null;
  if (paid || d.onTrackBonusUsed) return "stat";
  return SCORED_MODULES.some(k => k !== key && isLocked(d, k, paid)) ? "bonus" : "stat";
}
