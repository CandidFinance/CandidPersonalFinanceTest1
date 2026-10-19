// Checking an email address before it unlocks an answer, as it's typed in:
// its shape, a throwaway or made-up domain, and a likely typo of a common
// one ("gmial.com"). The same check runs again on the server
// (api/email.js), which also looks up the domain's mail servers and sends
// the link that confirms the address is theirs. Pure, unit tested in
// emailCheck.test.js, apart from requestEmailCheck at the end.

const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_RE = /^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

// The domains most UK addresses are on. One that's a near miss of these
// gets a "did you mean"; one of these exactly never does.
export const COMMON_DOMAINS = [
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "live.co.uk", "msn.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "aol.com", "aol.co.uk", "icloud.com", "me.com", "mac.com",
  "btinternet.com", "btopenworld.com", "sky.com", "virginmedia.com", "ntlworld.com", "blueyonder.co.uk", "talktalk.net",
  "tiscali.co.uk", "plus.com", "mail.com", "gmx.com", "gmx.co.uk", "proton.me", "protonmail.com", "pm.me",
  "fastmail.com", "hey.com", "zoho.com",
];

// Throwaway inboxes: gone in minutes, so no one can be contacted on them.
export const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "temp-mail.org", "temp-mail.io", "tempmail.com", "tempmail.net", "tempmailo.com",
  "tempinbox.com", "tempr.email", "throwawaymail.com", "yopmail.com", "yopmail.net", "yopmail.fr", "trashmail.com", "trashmail.de",
  "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mailnesia.com", "mintemail.com", "mohmal.com", "fakeinbox.com",
  "emailondeck.com", "spamgourmet.com", "mytemp.email", "burnermail.io", "mailcatch.com", "inboxkitten.com", "moakt.com",
  "tmpmail.org", "tmpmail.net", "discard.email", "emailfake.com", "fakemail.net", "mailpoof.com", "spambox.us", "mail.tm",
  "armyspy.com", "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com",
  "superrito.com", "teleworm.us", "byom.de",
]);

// Domains that are never anyone's inbox: placeholders and reserved names.
const PLACEHOLDER_DOMAINS = new Set(["example.com", "example.org", "example.net", "example.co.uk", "test.com", "domain.com", "email.co.uk"]);
const RESERVED_TLDS = new Set(["test", "example", "invalid", "localhost", "local"]);

// Top-level domains typed wrong, on any domain ("acme.con").
const TLD_TYPOS = { con: "com", cmo: "com", cpm: "com", ocm: "com", vom: "com", xom: "com", comm: "com", coom: "com" };
const UK_TYPOS = { "co.uj": "co.uk", "co.ik": "co.uk", "co.yk": "co.uk", "co.ul": "co.uk", "co.ukk": "co.uk", "co.uk.uk": "co.uk" };

export const EMAIL_PROBLEMS = {
  format: "Enter a valid email address",
  placeholder: "Enter your own email address",
  disposable: "Use an email address you'll keep. Temporary inboxes can't be used.",
  domain: "We couldn't find that email's domain. Check it's typed correctly.",
};

// Edit distance, counting a swap of two neighbouring letters as one.
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// The domain they probably meant, or null.
export function suggestDomain(domain) {
  if (COMMON_DOMAINS.includes(domain)) return null;
  const limit = domain.length >= 9 ? 2 : 1;
  let best = null, bestD = Infinity;
  for (const c of COMMON_DOMAINS) {
    const dd = distance(domain, c);
    if (dd < bestD) { best = c; bestD = dd; }
  }
  if (bestD <= limit) return best;
  for (const [typo, fix] of Object.entries(UK_TYPOS)) if (domain.endsWith(`.${typo}`)) return domain.slice(0, -typo.length) + fix;
  const dot = domain.lastIndexOf(".");
  const fix = TLD_TYPOS[domain.slice(dot + 1)];
  return fix ? `${domain.slice(0, dot + 1)}${fix}` : null;
}

// Their address, tidied (trimmed, the domain lower-cased), or the reason it
// can't be used. `suggestion` is a whole address they probably meant; it
// never blocks the address as typed.
export function checkEmail(raw) {
  const email = typeof raw === "string" ? raw.trim().replace(/\.$/, "") : "";
  const at = email.lastIndexOf("@");
  if (email.length > 254 || at < 1) return { email: null, problem: "format", suggestion: null };
  const local = email.slice(0, at), domain = email.slice(at + 1).toLowerCase();
  const labels = domain.split(".");
  if (local.length > 64 || !LOCAL_RE.test(local) || labels.length < 2 || !labels.every(l => LABEL_RE.test(l)) || !TLD_RE.test(labels.at(-1))) {
    return { email: null, problem: "format", suggestion: null };
  }
  const tidy = `${local}@${domain}`;
  if (PLACEHOLDER_DOMAINS.has(domain) || RESERVED_TLDS.has(labels.at(-1)) || /^no-?reply$/i.test(local)) return { email: null, problem: "placeholder", suggestion: null };
  if (DISPOSABLE_DOMAINS.has(domain) || DISPOSABLE_DOMAINS.has(labels.slice(-2).join("."))) return { email: null, problem: "disposable", suggestion: null };
  const fix = suggestDomain(domain);
  return { email: tidy, problem: null, suggestion: fix ? `${local}@${fix}` : null };
}

export const validEmailShape = raw => checkEmail(raw).problem !== "format";

// The server's check (api/email.js): the domain takes email, and, with
// `confirm`, a link to confirm it is sent to it. Resolves to the problem
// ("domain", "disposable", ...) or null. Anything that stops the check
// itself (offline, a timeout, a server error) resolves to null, so the
// answer is never held up by it.
export async function requestEmailCheck(email, { confirm = null } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch("/api/email", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ action: "check", email, confirm }),
    });
    if (res.status !== 422) return null;
    const body = await res.json().catch(() => ({}));
    return EMAIL_PROBLEMS[body.problem] ? body.problem : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
