import posthog from "posthog-js";
import { reportStorageFailure } from "./storage.js";

// Analytics cookies, only with consent. Until someone chooses, PostHog keeps
// everything in memory (no cookies, no local or session storage), so a visit
// is still counted but nothing is stored on the device. "granted" lets it
// store its id and recognise a returning browser; "denied" stops it capturing.
// The choice itself is kept in local storage, as the privacy policy says.
const KEY = "candid_cookie_choice";
export const CONSENT_RESET_EVENT = "candid-cookie-choice-reset";

export function getConsent() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch (e) {
    reportStorageFailure("read_cookie_choice", e);
    return null;
  }
}

// PostHog's storage for a choice (or none yet), at init and on a change.
export function analyticsPersistence(choice) {
  return choice === "granted" ? "localStorage+cookie" : "memory";
}

export function setConsent(choice) {
  const before = getConsent();
  try { localStorage.setItem(KEY, choice); } catch (e) { reportStorageFailure("save_cookie_choice", e); }
  if (!posthog.__loaded) return;
  if (choice === "granted") {
    posthog.set_config({ persistence: analyticsPersistence(choice) });
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing({ captureEventName: false });
  } else {
    // Changing a yes to a no: clear what PostHog stored under the yes.
    if (before === "granted") posthog.reset();
    posthog.set_config({ persistence: analyticsPersistence(choice) });
    posthog.opt_out_capturing();
  }
}

// "Cookie settings" in the site footer: ask again.
export function askConsentAgain() {
  try { localStorage.removeItem(KEY); } catch (e) { reportStorageFailure("clear_cookie_choice", e); }
  window.dispatchEvent(new Event(CONSENT_RESET_EVENT));
}
