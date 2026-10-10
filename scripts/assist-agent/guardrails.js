// The rules the account-opening agent can't break, enforced here in code
// rather than left to the model. Pure, unit tested in guardrails.test.js.
//
//  - It only types or picks values from the user's own profile, by key. It
//    never makes an answer up, so every question it answers is one the
//    user answered in advance (profile.local.json).
//  - It never ticks a checkbox. Declarations, terms and marketing consents
//    are the user's to agree to.
//  - It never presses a button that agrees, declares, submits an
//    application, signs in, or moves money.
//  - It stops and hands over as soon as a page asks for a password, a
//    one-time code, a file (ID), card details, or shows an identity check.

// What the agent may fill, and how each is described to the user. Anything
// else on a form (NI number, bank details, passwords) is left to the user.
export const PROFILE_FIELDS = {
  title: "Title",
  firstName: "First name",
  middleNames: "Middle names",
  lastName: "Last name",
  dateOfBirth: "Date of birth (YYYY-MM-DD)",
  dobDay: "Day of birth",
  dobMonth: "Month of birth",
  dobYear: "Year of birth",
  email: "Email",
  mobile: "Mobile number",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  town: "Town or city",
  county: "County",
  postcode: "Postcode",
  yearsAtAddress: "Years at this address",
  nationality: "Nationality",
  countryOfBirth: "Country of birth",
  employmentStatus: "Employment status",
  occupation: "Occupation",
  annualIncome: "Annual income",
  taxResidency: "Tax residency",
  usPerson: "US citizen or US tax resident",
  politicallyExposed: "Politically exposed person",
  sourceOfFunds: "Where the money comes from",
  depositAmount: "Amount to pay in (from Candid)",
};

// The profile's values by key, with the date of birth also split into parts.
export function profileValues(profile, extra = {}) {
  const v = { ...profile, ...extra };
  const dob = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.dateOfBirth || "");
  if (dob) { v.dobYear ??= dob[1]; v.dobMonth ??= dob[2]; v.dobDay ??= dob[3]; }
  const out = {};
  for (const k of Object.keys(PROFILE_FIELDS)) if (v[k] != null && String(v[k]).trim() !== "") out[k] = String(v[k]).trim();
  return out;
}

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
