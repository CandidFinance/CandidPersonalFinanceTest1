import posthog from "posthog-js";
import { mergeAnswers, mergeCompleted } from "./mergeAnswers.js";
import { startAuthentication, startRegistration, browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, WebAuthnAbortService } from "@simplewebauthn/browser";
import { reportStorageFailure } from "./storage.js";
import { getConsent } from "./consent.js";

// Whether this browser is signed in to a Candid account, and whether that
// account has a subscription (api/billing.js). Accounts are for anyone,
// free or paid (Harvey, 30 Oct 2026). Kept in localStorage, never in the
// user's inputs (`d`, which is synced to their row): a signed token naming
// their email, and what the server last said about it. Checked with the
// server whenever the app opens, and a subscription stands until the paid
// period ends. A "candid-access" event tells the app to redraw when it
// changes.

const KEY = "candid_access";

// Display only: the prices themselves are set in Stripe, and these must
// match them. Monthly first; the annual saving is worked out from the two.
// Subscribers from before 21 Oct 2026 stay on £2.99 a month or £24 a year.
export const PLANS = {
  monthly: { label: "Monthly",  amount: 7.99,  price: "£7.99",  per: "a month", note: "Cancel any time" },
  yearly:  { label: "Annually", amount: 49.99, price: "£49.99", per: "a year", note: "About £4.17 a month" },
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
// Signed in to an account, subscribed or not.
export const signedIn = () => !!read()?.token;

// The subscriber features (Add a goal, Scenario modelling) a subscriber has
// used, kept in their answers (d.subscriberFeaturesUsed). A used one goes
// back to the standard style, a crown in place of its blue "Subscribers"
// pill, marking what the subscription adds (Harvey, 30 Oct 2026). Anyone
// else keeps the blue.
export const featureUsed = (d, id) => hasAccess() && Array.isArray(d.subscriberFeaturesUsed) && d.subscriberFeaturesUsed.includes(id);
export const withFeatureUsed = (d, id) => [...new Set([...(Array.isArray(d.subscriberFeaturesUsed) ? d.subscriberFeaturesUsed : []), id])];

async function call(action, body) {
  const res = await fetch(`/api/billing?action=${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}
const save = r => write(r.token ? { active: !!r.active, email: r.email, plan: r.plan, periodEnd: r.periodEnd, cancelling: r.cancelling, token: r.token } : null);

// To Stripe's checkout; it comes back to the module's page.
export async function startCheckout(plan, module, email) {
  const { url } = await call("checkout", { plan, module, email, token: read()?.token });
  window.location.assign(url);
}

// On opening the app: back from checkout (?checkout=success&session_id=)
// or from a sign-in link (?restore=), then a check of what's held. Returns
// "paid", "restored" (signed in, subscribed or not), "check-email" (paid
// with the email of an account already there, which is sent a sign-in link
// rather than opened here), "cancelled" or null, and tidies the address bar.
export async function checkAccessOnLoad() {
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get("session_id"), restoreToken = url.searchParams.get("restore"), back = url.searchParams.get("checkout");
  let outcome = null;
  if (sessionId || restoreToken || back) {
    ["session_id", "restore", "checkout"].forEach(p => url.searchParams.delete(p));
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  try {
    if (sessionId) { const r = await call("confirm", { sessionId }); if (r.token) save(r); outcome = r.linkSent ? "check-email" : r.active && r.token ? "paid" : null; }
    else if (restoreToken) { const r = await call("status", { token: restoreToken }); save(r); outcome = r.token ? "restored" : null; }
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

// `app`: asked from inside the app, so the link opens the app's sign-in
// (/app/signin) rather than the website's.
export async function requestRestore(email, { app = false } = {}) { return call("restore", { email, app }); }

// An account's answers, saved to it a moment after they stop changing, so
// signing in on another device brings them back.
let saveTimer = null, pendingSave = null;
export function saveStateSoon(state) {
  const token = read()?.token;
  if (!token) return;
  clearTimeout(saveTimer);
  pendingSave = { token, state };
  saveTimer = setTimeout(() => { pendingSave = null; call("save", { token, state }).catch(() => {}); }, 3000);
}

// An account's visits linked up in PostHog on every device they sign in
// on, under a pseudonymous id: a salted SHA-256 hash of their email, never
// the email itself. Only with analytics cookies accepted ("granted"), since
// linking needs PostHog to keep its id on the device. Called on opening the
// app, on accepting cookies and after paying; signing out resets PostHog
// (SignInSetup switchAccount), so the next account isn't joined to this one.
export async function analyticsIdFor(email) {
  const bytes = new TextEncoder().encode(`candid-analytics:${String(email).trim().toLowerCase()}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `sub_${[...digest.slice(0, 16)].map(b => b.toString(16).padStart(2, "0")).join("")}`;
}
export async function identifySubscriber() {
  try {
    const info = read();
    if (!posthog.__loaded || getConsent() !== "granted" || !info?.token || !info.email) return;
    const id = await analyticsIdFor(info.email);
    if (posthog.get_distinct_id() !== id) posthog.identify(id);
  } catch { /* analytics never gets in the way of the app */ }
}

// Signing out, to sign in as someone else: any change not yet saved goes to
// the account first, then this browser forgets the account and the answers
// that came with it (they come back on signing in again), so they can't be
// saved into the next account. Device settings stay: the
// cookie choice, where they came from, whether a passkey is here.
const KEEP_ON_SIGN_OUT = ["candid_cookie_choice", "candid_acquisition", "candid_passkey_here", "candid_dev_custom_presets"];
export async function signOut() {
  clearTimeout(saveTimer);
  if (pendingSave) { const p = pendingSave; pendingSave = null; await call("save", p).catch(() => {}); }
  forgetThisDevice("sign_out");
}
function forgetThisDevice(why) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("candid_") && !KEEP_ON_SIGN_OUT.includes(k)) localStorage.removeItem(k);
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("candid_")) sessionStorage.removeItem(k);
  } catch (e) { reportStorageFailure(why, e); }
  write(null);
}

// Deletes the account and all Candid holds under its email (api/billing.js
// delete-account), then this browser's copy. Throws the server's message
// when it can't, e.g. a paid subscription still running.
export async function deleteAccount() {
  await call("delete-account", { token: read()?.token, confirm: "DELETE" });
  clearTimeout(saveTimer);
  pendingSave = null;
  forgetThisDevice("delete_account");
}

// From a sign-in link (/signin?restore=), which also opens an account for a
// new email: holds the account, and puts their saved answers in this
// browser, where the app reads them on opening. Returns "signed-in" or
// "invalid".
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
// "Continue with Google" (src/lib/google.js). From a sign-in screen
// (`open`) it signs in, making an account for a new email. From an email ask
// (the Cash tour, rate alerts) it signs in only an account already there,
// and otherwise just gives the email. Returns { outcome, email, name }:
// outcome "signed-in", or "none" with no account. Nothing held is dropped
// with "none".
export async function signInWithGoogle(credential, ref = null, { open = false } = {}) {
  const r = await call("google", { credential, ref, open });
  const outcome = r.token ? await holdSignIn(r) : "none";
  return { outcome, email: r.email, name: r.name || "" };
}

// Signed in already: the account and what's set up ({ email, active, plan,
// periodEnd, cancelling, paidLive, hasStripe, passkeys, password, google }),
// adding a passkey on this device, adding Google, and setting a password.
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
export async function linkGoogle(credential) { await call("google-link", { token: read()?.token, credential }); }
export async function setPassword(password) { await call("password-set", { token: read()?.token, password }); }
// Candid's emails on or off (the Account sheet's Notifications); returns
// whether they're on now.
export async function setEmailAlerts(on) { return (await call("alerts-set", { token: read()?.token, on })).alerts; }

async function holdSignIn(r) {
  if (!r.email || !r.token) return "invalid";
  save(r);
  // Put together with anything answered on this device first, so signing
  // in never loses an answer (mergeAnswers.js). The app saves the result to
  // the account as it opens (saveStateSoon), so a new account starts with
  // what's on this device.
  if (r.state?.inputs) {
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
