// The user's profile, as the account-opening agent uses it: which answers it
// holds, the forms they're typed in (dates, phone numbers, monthly income),
// and how a profile value is matched to an option on a provider's form.
// Pure, unit tested in profile.test.js.

const YES_NO = ["Yes", "No"];

// What the user can enter, in Candid's tiles or profile.local.json. `optional`
// fields aren't asked for before a run; the agent still uses them.
export const PROFILE_INPUTS = [
  { key: "title", label: "Title", kind: "choice", options: ["Mr", "Mrs", "Miss", "Ms", "Mx", "Dr"] },
  { key: "firstName", label: "First name", kind: "text" },
  { key: "middleNames", label: "Middle names", kind: "text", optional: true },
  { key: "lastName", label: "Last name", kind: "text" },
  { key: "gender", label: "Gender", kind: "choice", options: ["Male", "Female"] },
  { key: "dateOfBirth", label: "Date of birth", kind: "date" },
  { key: "email", label: "Email", kind: "email" },
  { key: "mobile", label: "Mobile number", kind: "tel" },
  { key: "addressLine1", label: "Address line 1", kind: "text", hint: "House number or name and street, as on your post" },
  { key: "addressLine2", label: "Address line 2", kind: "text", optional: true },
  { key: "town", label: "Town or city", kind: "text" },
  { key: "county", label: "County", kind: "text", optional: true },
  { key: "postcode", label: "Postcode", kind: "text" },
  { key: "yearsAtAddress", label: "Years at this address", kind: "number" },
  { key: "nationality", label: "Nationality", kind: "text", hint: "For example, British" },
  { key: "countryOfBirth", label: "Country of birth", kind: "text" },
  { key: "employmentStatus", label: "Employment status", kind: "choice", options: ["Employed", "Self-employed", "Retired", "Student", "Unemployed", "Not working"] },
  { key: "occupation", label: "Occupation", kind: "text" },
  { key: "industry", label: "Industry you work in", kind: "text", hint: "For example, Healthcare" },
  { key: "annualIncome", label: "Annual income before tax (£)", kind: "number" },
  { key: "incomeSource", label: "Where your income comes from", kind: "choice", options: ["Employment", "Self-employment", "Pension", "Benefits", "Property", "Investments", "Inheritance"] },
  { key: "incomeCountry", label: "Country your income comes from", kind: "text", hint: "For example, United Kingdom" },
  { key: "taxResidency", label: "Tax residency", kind: "choice", options: ["UK only", "UK and another country", "Another country only"] },
  { key: "usPerson", label: "US citizen or US tax resident", kind: "choice", options: YES_NO },
  { key: "politicallyExposed", label: "Politically exposed person", kind: "choice", options: YES_NO },
  { key: "sourceOfFunds", label: "Where the money you'll pay in comes from", kind: "choice", options: ["Savings", "Salary", "Inheritance", "Gift", "Property sale", "Investments", "Pension"] },
  { key: "fundsFromOverseas", label: "Does any of the money you'll pay in come from outside the UK?", kind: "choice", options: YES_NO },
  { key: "contactPreference", label: "How you'd like providers to contact you", kind: "choice", options: ["Email", "Text", "Phone", "Post"] },
];
export const INPUT_KEYS = PROFILE_INPUTS.map(f => f.key);

// Every value the agent may use, by key, with how it's described to the
// model. Beyond what the user enters: the forms it's worked out into.
export const PROFILE_FIELDS = {
  ...Object.fromEntries(PROFILE_INPUTS.map(f => [f.key, f.label])),
  dateOfBirth: "Date of birth (one field; typed in the format the field shows)",
  dobDay: "Day of birth", dobMonth: "Month of birth", dobYear: "Year of birth",
  mobile: "Mobile number starting 07 (a field that takes the whole UK number)",
  mobileInternational: "Mobile number starting +44 (a field expecting the international form)",
  mobileWithoutCode: "Mobile number without +44 or the leading 0 (when +44 is shown or picked separately)",
  mobileCountryCode: "Country code of the mobile (+44), for a separate code dropdown",
  fullName: "Full name (first, middle and last)",
  accountHolderName: "Linked account holder's name (first and last name)",
  addressSearch: "Address line 1 and postcode together, for a type-ahead address search box",
  annualIncome: "Annual income before tax, £",
  monthlyIncome: "Monthly income before tax, £ (annual ÷ 12)",
  depositAmount: "Amount to pay in (from Candid)",
};

const digits = s => String(s ?? "").replace(/\D/g, "");
const money = s => {
  const m = /^\s*£?\s*([\d,]+(?:\.\d+)?)\s*(k)?\s*$/i.exec(String(s ?? ""));
  return m ? Number(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1) : null;
};

// A date the user typed (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) as YYYY-MM-DD.
export function isoDate(s) {
  const t = String(s ?? "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

// A UK mobile however it was typed (07…, +44 7…, 0044…, +44 (0)7…), in its
// three forms. A non-UK number is left as typed.
export function phoneForms(s) {
  const raw = String(s ?? "").trim();
  if (!raw) return {};
  let d = digits(raw.replace(/\(0\)/, ""));
  if (raw.startsWith("+") || raw.startsWith("00")) {
    if (raw.startsWith("00")) d = d.slice(2);
    if (!d.startsWith("44")) return { mobile: raw, mobileInternational: raw };
    d = d.slice(2);
  } else if (d.startsWith("0")) d = d.slice(1);
  return { mobile: "0" + d, mobileInternational: "+44" + d, mobileWithoutCode: d, mobileCountryCode: "+44" };
}

// The profile's values by key, plus the forms worked out from them. Blanks
// and unknown keys are dropped.
export function profileValues(profile, extra = {}) {
  const v = { ...profile, ...Object.fromEntries(Object.entries(extra).filter(([, x]) => x != null)) };
  const dob = isoDate(v.dateOfBirth);
  if (dob) { v.dateOfBirth = dob; const [y, m, d] = dob.split("-"); v.dobYear ??= y; v.dobMonth ??= m; v.dobDay ??= d; }
  Object.assign(v, phoneForms(v.mobile));
  const annual = money(v.annualIncome);
  if (annual != null) { v.annualIncome = String(annual); v.monthlyIncome ??= String(Math.round(annual / 12)); }
  if (v.addressLine1 && v.postcode) v.addressSearch ??= `${v.addressLine1}, ${v.postcode}`;
  if (String(v.firstName ?? "").trim() && String(v.lastName ?? "").trim()) {
    v.fullName ??= [v.firstName, v.middleNames, v.lastName].filter(x => String(x ?? "").trim()).join(" ");
    v.accountHolderName ??= `${v.firstName} ${v.lastName}`;
  }
  const out = {};
  for (const k of Object.keys(PROFILE_FIELDS)) if (v[k] != null && String(v[k]).trim() !== "") out[k] = String(v[k]).trim();
  return out;
}

// Which fields the user still needs to fill in before a run.
export const missingInputs = profile => PROFILE_INPUTS.filter(f => !f.optional && !String(profile?.[f.key] ?? "").trim());

// ── Typing a value into a particular field ───────────────────────────────────

// A YYYY-MM-DD date in the format a field shows (its placeholder or label,
// e.g. DD/MM/YYYY or MM-DD-YY), or DD/MM/YYYY if it doesn't say. Date inputs
// take YYYY-MM-DD.
export function formatDate(iso, item = {}) {
  const [y, m, d] = iso.split("-");
  if (item.type === "date") return iso;
  const hint = `${item.placeholder || ""} ${item.label || ""}`;
  const f = /\b(dd|mm|yyyy|yy)([/\-. ])(dd|mm|yyyy|yy)\2(dd|mm|yyyy|yy)\b/i.exec(hint);
  if (!f) return `${d}/${m}/${y}`;
  const part = p => ({ dd: d, mm: m, yyyy: y, yy: y.slice(2) })[p.toLowerCase()];
  return [part(f[1]), part(f[3]), part(f[4])].join(f[2]);
}

// What to type for `key` into this field.
export function valueFor(key, values, item = {}) {
  const v = values[key];
  if (key === "dateOfBirth" && v) return formatDate(v, item);
  if (key === "mobile" || key === "mobileInternational" || key === "mobileWithoutCode") {
    const p = (item.placeholder || "").trim();
    if (values.mobileWithoutCode && (item.maxlength === 10 || /^7/.test(p))) return values.mobileWithoutCode;
    if (values.mobileInternational && /^\+44/.test(p)) return values.mobileInternational;
  }
  return v;
}

// ── Matching a value to one of a form's options ──────────────────────────────

const norm = s => String(s ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9£+]+/g, " ").trim();
const ABBR = { st: "street", rd: "road", ave: "avenue", av: "avenue", ln: "lane", dr: "drive", ct: "court", pl: "place", sq: "square", cres: "crescent", gdns: "gardens", tce: "terrace", cl: "close", hse: "house", apt: "flat", apartment: "flat" };
const addrTokens = s => norm(s).split(" ").filter(Boolean).map(t => ABBR[t] || t);
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const UK = ["united kingdom", "uk", "great britain", "gb", "british", "united kingdom of great britain and northern ireland", "england", "scotland", "wales", "northern ireland"];
const SYNONYMS = {
  male: ["male", "man", "m"], female: ["female", "woman", "f"],
  yes: ["yes", "y"], no: ["no", "n"],
  "uk only": ["uk only", "united kingdom only", "only the uk", "uk"],
  employment: ["employment", "salary", "employed", "wages", "salary or wages", "earnings"],
  "self employment": ["self employment", "self employed", "business income"],
  pension: ["pension", "retirement", "retirement income"],
  property: ["property", "rental income", "rent", "property income"],
  "property sale": ["property sale", "sale of property", "house sale"],
  investments: ["investments", "investment income", "dividends"],
  savings: ["savings", "existing savings", "savings from income", "my savings"],
  email: ["email", "e mail"], text: ["text", "sms", "text message"], phone: ["phone", "telephone", "phone call", "call"], post: ["post", "letter", "mail by post"],
};
const COUNTRY_KEYS = new Set(["nationality", "countryOfBirth", "incomeCountry"]);
const NUMERIC_KEYS = new Set(["annualIncome", "monthlyIncome", "depositAmount", "yearsAtAddress"]);

// A band like "£50,000 - £74,999", "Up to £25k", "Over £150,000" or
// "3+ years" as [low, high], or null. Months count as twelfths of a year.
function band(text) {
  const t = text.toLowerCase().replace(/,/g, "");
  const nums = [...t.matchAll(/£?\s*(\d+(?:\.\d+)?)(?:\s*(k|m)(?![a-z]))?(\s*months?\b)?/g)].map(m => Number(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1) / (m[3] ? 12 : 1));
  if (!nums.length) return null;
  if (/\b(up to|less than|under|below|fewer than)\b/.test(t)) return [0, nums[0]];
  if (/\b(over|more than|above|or more|and over|plus)\b|\+/.test(t)) return [nums[0], Infinity];
  if (nums.length >= 2) return [nums[0], nums[1]];
  return [nums[0], nums[0]];
}

function addressMatch(line1, options) {
  const want = addrTokens(line1);
  if (!want.length) return null;
  const house = want.find(t => /\d/.test(t));
  const hits = options.filter(o => {
    const got = addrTokens(o);
    return want.every(t => got.includes(t)) && (!house || got.includes(house));
  });
  if (hits.length <= 1) return hits[0] ?? null;
  // "1 Example Street" also sits inside "Flat 1, 1 Example Street": prefer
  // the one that starts with line 1.
  const starts = hits.filter(o => addrTokens(o).slice(0, want.length).join(" ") === want.join(" "));
  return starts.length === 1 ? starts[0] : null;
}

// The option that matches `value`, or null if none does or it's ambiguous
// (then the agent asks the user rather than guess).
export function matchOption(value, options, key) {
  const opts = (options || []).filter(o => o && !/^(please )?(select|choose)\b|^-+$/i.test(o.trim()));
  if (value == null || !opts.length) return null;
  if (key === "addressLine1") return addressMatch(value, opts);
  const want = norm(value);
  const exact = opts.filter(o => norm(o) === want);
  if (exact.length === 1) return exact[0];

  if (key === "dobMonth" || key === "dobDay" || /^\d+$/.test(want)) {
    const n = Number(want);
    const byNum = opts.filter(o => /^\d+$/.test(norm(o)) && Number(norm(o)) === n);
    if (byNum.length === 1) return byNum[0];
    if (key === "dobMonth" && n >= 1 && n <= 12) {
      const byName = opts.filter(o => { const t = norm(o); return t === MONTHS[n - 1] || t === MONTHS[n - 1].slice(0, 3); });
      if (byName.length === 1) return byName[0];
    }
  }

  const group = COUNTRY_KEYS.has(key) && UK.includes(want) ? UK : (SYNONYMS[want] || []);
  for (const alt of group) {
    const hit = opts.filter(o => norm(o) === alt);
    if (hit.length === 1) return hit[0];
  }

  if (NUMERIC_KEYS.has(key)) {
    const n = money(value) ?? Number(digits(value));
    const inBand = opts.filter(o => { const b = band(o); return b && n >= b[0] && n <= b[1]; });
    if (inBand.length === 1) return inBand[0];
    // On a shared edge ("1-3 years", "3+ years") the upper band wins.
    const strict = inBand.filter(o => n < band(o)[1]);
    if (strict.length === 1) return strict[0];
  }

  const words = [want, ...group].filter(Boolean);
  const wordIn = (w, s) => new RegExp(`(^| )${w.replace(/[+]/g, "\\+")}( |$)`).test(s);
  const contains = opts.filter(o => { const t = norm(o); return words.some(w => wordIn(w, t) || (t.length > 2 && wordIn(t, w))); });
  return contains.length === 1 ? contains[0] : null;
}

// An answer to one of the profile's choice fields, put in its own words
// ("Woman" on a form is saved as "Female").
export function canonicalAnswer(key, answer) {
  const field = PROFILE_INPUTS.find(f => f.key === key);
  if (!field?.options) return answer;
  return field.options.find(o => matchOption(o, [answer], key) === answer) ?? answer;
}
