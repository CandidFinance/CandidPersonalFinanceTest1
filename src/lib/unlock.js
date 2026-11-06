// Free and premium (freemium since 6 Nov 2026). Every module's answer is free:
// free tells them where they stand. Premium plans what-ifs and keeps track
// (src/lib/entitlement.js, api/billing.js). Pure, unit tested in unlock.test.js.
//
// `unlockGate`, set at the app's entry, marks who's held to premiumOpen: anyone
// from before the gate shipped keeps what they had. UNLOCK_GATE_ON stays on,
// because off would hand every new user the premium features. `paid` is for
// tests; in the app it's this browser's subscription.

import { moduleAnswered, loanVerdictReady } from "./appEntry.js";
import { hasAccess } from "./entitlement.js";
import { validEmailShape } from "./emailCheck.js";

export const UNLOCK_GATE_ON = true;

// The local dev server (`npm run dev`) skips the gate, so premium features can
// be worked on without paying. Production builds and the tests never see
// import.meta.env.DEV. VITE_DEV_PAYWALL=1 in .env.local puts the gate back
// locally, to work on the paywall itself.
const DEV_UNGATED = !!import.meta.env?.DEV && import.meta.env.VITE_DEV_PAYWALL !== "1";

// Its shape only; the email forms check more (emailCheck.js).
export const validEmail = validEmailShape;

// A premium feature: subscribers, and anyone from before the gate.
export function premiumOpen(d, paid = hasAccess()) {
  return DEV_UNGATED || paid || d.unlockGate !== true;
}

// A module answered with nothing to improve, so its answer also gives a
// national figure (OnTrackReward.jsx). `st` is its status (moduleStatus.js):
// "ok", and not one whose figure is counted elsewhere (Kids & family's
// childcare under the £100k tax trap), nor Student loan before its verdict
// is ready.
export function onTrack(d, key, st) {
  if (st?.status !== "ok" || st.elsewhere || !moduleAnswered(key, d)) return false;
  return key !== "studentLoan" || loanVerdictReady(d);
}
