// The rules the account-opening agent can't break, enforced here in code
// rather than left to the model. Pure, unit tested in guardrails.test.js.
//
//  - It only types or picks values from the user's own profile, by key, or
//    answers the user gives in Candid when it asks (ask_user). It never
//    makes an answer up.
//  - It ticks a checkbox only as an answer from the profile (source of
//    funds: Savings; contact by: Email). Declarations, terms, consents and
//    marketing boxes are the user's to tick, judged by the box's label and
//    the question it sits under.
//  - It never presses a button that agrees, declares, submits an
//    application, signs in, or moves money.
//  - It stops and hands over as soon as a page asks for a password, a
//    one-time code, a file (ID), card details, or shows an identity check.

// What the agent may fill, and in what form, is in profile.js.

// Buttons and links the agent must never press, by their label.
const BLOCKED_CLICK = [
  /\b(i\s+)?(agree|accept|consent)\b/i,
  /\bdeclar/i,
  /\bconfirm\b.*\b(submit|open|apply|application|declaration|details)\b/i,
  /\bsubmit\b/i,
  /\b(sign|log)\s*(in|on)\b/i,
  /\b(pay|fund|deposit|transfer|top\s*up|add money)\b/i,
];
export function clickBlocked(item) {
  if (!item) return "That element isn't on the page any more.";
  if (item.type === "checkbox" || item.role === "checkbox") return "Checkboxes are for you to tick: they're usually declarations or consents.";
  const label = `${item.label || ""} ${item.text || ""}`;
  const hit = BLOCKED_CLICK.find(re => re.test(label));
  return hit ? `"${label.trim().slice(0, 60)}" agrees to something, submits the application, signs in or moves money, so it's yours to press.` : null;
}

// Fields the agent must not fill, whatever the model asks.
export function fillBlocked(item) {
  if (!item) return "That field isn't on the page any more.";
  if (item.type === "password") return "Passwords are yours to set.";
  if (item.type === "file") return "Uploading ID is yours to do.";
  if (item.type === "checkbox" || item.role === "checkbox") return "Checkboxes are yours to tick.";
  if (/^cc-/.test(item.autocomplete || "") || item.autocomplete === "one-time-code") return "Card details and one-time codes are yours to enter.";
  if (/national insurance|\bni\b number|sort code|account number|\biban\b/i.test(item.label || "")) return "Your NI number and bank details are yours to enter.";
  return null;
}

// Checkboxes that agree, declare or consent to something, whatever the
// profile says: the user ticks these. Others are answers (a "tick all that
// apply" list) the agent may tick from the profile.
const NOT_AN_ANSWER = /\b(agree|accept|consent|confirm|declar\w*|certify|true|correct|accurate|read|understand|acknowledge|terms|conditions|privacy|policy|marketing|offers?|promotions?|newsletters?|news|updates|keep me|hear (about|from)|third part\w*|partners|remember me|signed in)\b/i;
export function tickBlocked(item) {
  if (!item) return "That box isn't on the page any more.";
  const words = `${item.label || ""} ${item.text || ""} ${item.group || ""}`;
  return NOT_AN_ANSWER.test(words) ? "This box agrees, declares or consents to something, so it's yours to tick." : null;
}

// Whether the page itself means it's the user's turn, before the model is
// asked anything.
const ID_CHECK_FRAMES = /onfido|yoti|jumio|veriff|idnow|mitek|signicat|trulioo|sumsub|persona\.com|socure/i;
export function pageHandoff(snapshot) {
  const f = snapshot.flags || {};
  if (f.password) return "This page asks you to set or enter a password.";
  if (f.otp) return "This page asks for a one-time code.";
  if (f.file) return "This page asks you to upload a document.";
  if (f.card) return "This page asks for card details.";
  if ((f.frames || []).some(src => ID_CHECK_FRAMES.test(src))) return "This page is checking your identity.";
  if (/\b(take a selfie|scan your (passport|driving licence|id))\b/i.test(snapshot.text || "")) return "This page is checking your identity.";
  return null;
}
