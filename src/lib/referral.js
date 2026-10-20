// Invites (server/referrals.js). Someone's link is the site with ?ref=<code>.
//  - The friend: the code is kept in this browser when they arrive, if
//    they're new here (nothing unlocked yet), and checked with the server.
//    A real one gives them a second answer free (unlock.js unlockAsk), and
//    goes with their email when they give it (MobileUnlock.jsx), so the
//    person who invited them can be rewarded once it's confirmed.
//  - The person inviting: their link, for a confirmed email, and how many
//    free months it has earned (InviteFriends.jsx).
import { reportStorageFailure } from "./storage.js";

const KEY = "candid_referral";
export const REFERRAL_CAP = 12;
const CODE_RE = /^[a-hjkmnp-z2-9]{8}$/;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { reportStorageFailure("save_referral", e); }
}

async function call(action, body) {
  const res = await fetch(`/api/billing?action=${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}

// On arriving: a code in the address kept, unless they've one already or
// have unlocked an answer here before (they're not new). Then checked with
// the server, once, until it says.
export function captureReferral(search = typeof window !== "undefined" ? window.location.search : "") {
  const code = new URLSearchParams(search).get("ref");
  if (code && CODE_RE.test(code) && !read()) {
    let unlocked = 0;
    try { unlocked = (JSON.parse(localStorage.getItem("candid_inputs") || "{}").unlockedModules || []).length; } catch { /* treated as new */ }
    if (!unlocked) write({ code, valid: null, at: new Date().toISOString() });
  }
  const held = read();
  if (held && held.valid === null) {
    call("referral-check", { code: held.code })
      .then(({ valid }) => { if (typeof valid === "boolean") write({ ...held, valid }); })
      .catch(() => { /* checked again next time */ });
  }
}

// The code they arrived on, for the server to check itself; and whether it's
// been found real, which is what gives the second answer free.
export const referralCode = () => read()?.code || null;
export const hasReferralBonus = () => read()?.valid === true;
// For telling them they were invited: a code kept and not found false (the
// check may still be on its way when the first screen shows).
export const invitedHere = () => { const r = read(); return !!r && r.valid !== false; };

// Their own link: { confirmed: false } until their email is confirmed,
// then { confirmed: true, code, earned, cap }.
export const fetchReferralLink = email => call("referral-link", { email });

// Straight into the app's first questions (/app/start), not the homepage.
// A /?ref= link (the first ones shared) still counts: it's kept on the
// homepage too.
export const inviteUrl = code => `${typeof window !== "undefined" ? window.location.origin : "https://www.candid-finance.co.uk"}/app/start?ref=${code}`;
export const INVITE_SUBJECT = "Try Candid: your second module is unlocked for free";
export const INVITE_TEXT = "I've been using Candid to see what my money could be doing. Start with my link and your second module is unlocked for free:";
const inviteMessage = code => `${INVITE_TEXT}\n${inviteUrl(code)}`;

// The phone's share sheet where there is one, else the link copied. The
// link goes in the text itself, not only as `url`, which some apps (an email
// one, on Windows) drop. Resolves to "shared", "copied", "cancelled" or
// "failed".
export async function shareInvite(code) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try { await navigator.share({ title: INVITE_SUBJECT, text: inviteMessage(code) }); return "shared"; }
    catch (e) { if (e?.name === "AbortError") return "cancelled"; }
  }
  return copyInvite(code);
}
export async function copyInvite(code) {
  try { await navigator.clipboard.writeText(inviteMessage(code)); return "copied"; }
  catch { return "failed"; }
}
// An email with its subject and the link filled in, in their own mail app.
export const inviteMailto = code => `mailto:?subject=${encodeURIComponent(INVITE_SUBJECT)}&body=${encodeURIComponent(`Hi,\n\n${inviteMessage(code)}\n`)}`;
