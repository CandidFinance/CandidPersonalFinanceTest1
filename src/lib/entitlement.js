import posthog from "posthog-js";
import { mergeAnswers, mergeCompleted } from "./mergeAnswers.js";
import { startAuthentication, startRegistration, browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, WebAuthnAbortService } from "@simplewebauthn/browser";
import { reportStorageFailure } from "./storage.js";

// Whether this browser has a Candid subscription (api/billing.js). Kept in
// localStorage, never in the user's inputs (`d`, which is synced to their
// row): a signed token naming their email, and what the server last said
// about it. Checked with the server whenever the app opens, and the answer
// stands until the paid period ends. A "candid-access" event tells the app
// to redraw when it changes.

const KEY = "candid_access";

// Display only: the prices themselves are set in Stripe, and these must
// match them. Monthly first; the annual saving is worked out from the two.
export const PLANS = {
  monthly: { label: "Monthly",  amount: 2.99, price: "£2.99", per: "a month", note: "Cancel any time" },
  yearly:  { label: "Annually", amount: 24,   price: "£24",   per: "a year",  note: "£2 a month" },
};
export const ANNUAL_SAVING_PCT = Math.round((1 - PLANS.yearly.amount / (PLANS.monthly.amount * 12)) * 100);

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { reportStorageFailure("read_subscription", e); return null; }
}
function write(v) {
  try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { reportStorageFailure("save_subscription", e); }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("candid-access", { detail: v }));
}

// Subscribed, as the server last said, and the paid period not over.
export function hasAccess() {
  const a = read();
  if (!a?.active) return false;
  return !a.periodEnd || new Date(a.periodEnd).getTime() > Date.now();
}
export const accessInfo = () => read();

async function call(action, body) {
  const res = await fetch(`/api/billing?action=${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}
const save = r => write(r.active ? { active: true, email: r.email, plan: r.plan, periodEnd: r.periodEnd, cancelling: r.cancelling, token: r.token } : null);

// To Stripe's checkout; it comes back to the module's page.
export async function startCheckout(plan, module, email) {
  const { url } = await call("checkout", { plan, module, email });
  window.location.assign(url);
}

// On opening the app: back from checkout (?checkout=success&session_id=)
// or from a sign-in link (?restore=), then a check of what's held. Returns
// "paid", "restored", "cancelled" or null, and tidies the address bar.
export async function checkAccessOnLoad() {
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get("session_id"), restoreToken = url.searchParams.get("restore"), back = url.searchParams.get("checkout");
  let outcome = null;
  if (sessionId || restoreToken || back) {
    ["session_id", "restore", "checkout"].forEach(p => url.searchParams.delete(p));
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  try {
    if (sessionId) { const r = await call("confirm", { sessionId }); save(r); outcome = r.active ? "paid" : null; }
    else if (restoreToken) { const r = await call("status", { token: restoreToken }); save(r); outcome = r.active ? "restored" : null; }
    else {
      if (back === "cancelled") outcome = "cancelled";
      const held = read();
      if (held?.token) save(await call("status", { token: held.token }));
    }
  } catch (e) {
    // Offline or not set up: keep what's held until the next check.
  }
  return outcome;
}

export async function requestRestore(email) { return call("restore", { email }); }

// A subscriber's answers, saved to their subscription a moment after they
// stop changing, so signing in on another device brings them back.
let saveTimer = null, pendingSave = null;
export function saveStateSoon(state) {
  const token = read()?.token;
  if (!token || !hasAccess()) return;
  clearTimeout(saveTimer);
  pendingSave = { token, state };
  saveTimer = setTimeout(() => { pendingSave = null; call("save", { token, state }).catch(() => {}); }, 3000);
}

// Signing out, to sign in as someone else: any change not yet saved goes to
// the subscription first, then this browser forgets the subscription and
// the answers that came with it (they come back on signing in again), so
// they can't be saved into the next account. Device settings stay: the
// cookie choice, where they came from, whether a passkey is here.
const KEEP_ON_SIGN_OUT = ["candid_cookie_choice", "candid_acquisition", "candid_passkey_here", "candid_dev_custom_presets"];
export async function signOut() {
  clearTimeout(saveTimer);
  if (pendingSave) { const p = pendingSave; pendingSave = null; await call("save", p).catch(() => {}); }
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("candid_") && !KEEP_ON_SIGN_OUT.includes(k)) localStorage.removeItem(k);
  } catch (e) { reportStorageFailure("sign_out", e); }
  write(null);
}

// From a sign-in link (/signin?restore=): holds the subscription, and puts
// their saved answers in this browser, where the app reads them on opening.
// Returns "signed-in", "ended" (the link is good but the subscription isn't)
// or "invalid".
export async function signInWithLink(restoreToken) {
  return holdSignIn(await call("status", { token: restoreToken }));
}

// Signing in with a passkey (Face ID, a fingerprint, the screen lock) or an
// email and password: the same outcomes as a link. Throws with a message to
// show when it doesn't work; a passkey prompt the user closes throws
// "cancelled", which needs no message, and a passkey a device couldn't save
// throws "not-saved" (passkeyNotSavedHelp says why). The same on iPhone and
// Android: passkeys are saved on the device itself (iCloud Keychain, Google
// Password Manager), and synced to the user's other devices by them.
export const passkeysSupported = () => browserSupportsWebAuthn();
export const passkeyAutofillSupported = () => browserSupportsWebAuthnAutofill();
// Stops a waiting passkey request, e.g. the keyboard suggestion's on leaving.
export const stopPasskeyRequest = () => WebAuthnAbortService.cancelCeremony();

// What the device calls unlocking a passkey, for buttons.
export function passkeyName() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "Face ID";
  if (/Android/.test(ua)) return "fingerprint or face unlock";
  return "passkey";
}
export function passkeyNotSavedHelp() {
  const name = passkeyName();
  if (name === "Face ID") return "Your iPhone didn't save a passkey. Passkeys need iCloud Keychain on: Settings, your name, iCloud, Passwords and Keychain. Or create a password instead.";
  if (name !== "passkey") return "Your phone didn't save a passkey. Passkeys need a screen lock and Google Password Manager. Or create a password instead.";
  return "Your device didn't save a passkey. Try again, or create a password instead.";
}

// Whether this browser has made or used a Candid passkey: the sign-in page
// offers its button only then, since without one the device offers a
// passkey from another device, by QR code, instead.
const PASSKEY_HERE_KEY = "candid_passkey_here";
export function passkeyHere() {
  try { return !!localStorage.getItem(PASSKEY_HERE_KEY); } catch (e) { reportStorageFailure("read_passkey_here", e); return false; }
}
function markPasskeyHere() {
  try { localStorage.setItem(PASSKEY_HERE_KEY, "1"); } catch (e) { reportStorageFailure("save_passkey_here", e); }
}
// A failed passkey prompt, recorded, as the message to throw.
function passkeyError(e, step) {
  if (e?.name === "AbortError") return new Error("cancelled");
  posthog.capture("passkey_failed", { step, name: e?.name || null, code: e?.code || null });
  if (step === "enrol" && e?.name === "InvalidStateError") return new Error("This device already has a Candid passkey.");
  if (step === "enrol") return new Error("not-saved");
  return new Error(e?.name === "NotAllowedError" ? "cancelled" : "Your device couldn't use a passkey here.");
}

// `autofill`: wait for the passkey to be picked from the keyboard's
// suggestions on the email field (offered only when the device has one),
// rather than asking now.
export async function signInWithPasskey({ autofill = false } = {}) {
  const { options, challengeToken } = await call("passkey-login-options", {});
  let response;
  try { response = await startAuthentication({ optionsJSON: options, useBrowserAutofill: autofill }); }
  catch (e) { throw autofill ? new Error("cancelled") : passkeyError(e, "login"); }
  const outcome = await holdSignIn(await call("passkey-login", { challengeToken, response }));
  markPasskeyHere();
  return outcome;
}
export async function signInWithPassword(email, password) {
  return holdSignIn(await call("password-login", { email, password }));
}

// Signed in already: what's set up ({ passkeys, password }), adding a
// passkey on this device, and setting a password.
export async function accountSignIns() { return call("account", { token: read()?.token }); }
export async function addPasskey() {
  const token = read()?.token;
  const { options, challengeToken } = await call("passkey-enrol-options", { token });
  let response;
  try { response = await startRegistration({ optionsJSON: options }); }
  catch (e) { throw passkeyError(e, "enrol"); }
  await call("passkey-enrol", { token, challengeToken, response });
  markPasskeyHere();
}
export async function setPassword(password) { await call("password-set", { token: read()?.token, password }); }

async function holdSignIn(r) {
  if (!r.email) return "invalid";
  save(r);
  if (!r.active) return "ended";
  if (r.state?.inputs) {
    // Put together with anything answered on this device first, so signing
    // in never loses an answer (mergeAnswers.js).
    try {
      const here = JSON.parse(localStorage.getItem("candid_inputs") || "null");
      const doneHere = JSON.parse(localStorage.getItem("candid_completed_modules") || "null");
      localStorage.setItem("candid_inputs", JSON.stringify(mergeAnswers(r.state.inputs, here)));
      localStorage.setItem("candid_completed_modules", JSON.stringify(mergeCompleted(r.state.completedModules, doneHere)));
    } catch (e) { reportStorageFailure("save_signed_in_answers", e); }
  }
  return "signed-in";
}
export async function openBillingPortal() {
  const { url } = await call("portal", { token: read()?.token });
  window.location.assign(url);
}
