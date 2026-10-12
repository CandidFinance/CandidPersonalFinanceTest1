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
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
function write(v) {
  try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {}
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
let saveTimer = null;
export function saveStateSoon(state) {
  const token = read()?.token;
  if (!token || !hasAccess()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { call("save", { token, state }).catch(() => {}); }, 3000);
}

// From a sign-in link (/signin?restore=): holds the subscription, and puts
// their saved answers in this browser, where the app reads them on opening.
// Returns "signed-in", "ended" (the link is good but the subscription isn't)
// or "invalid".
export async function signInWithLink(restoreToken) {
  const r = await call("status", { token: restoreToken });
  if (!r.email) return "invalid";
  save(r);
  if (!r.active) return "ended";
  if (r.state?.inputs) {
    try {
      localStorage.setItem("candid_inputs", JSON.stringify(r.state.inputs));
      if (Array.isArray(r.state.completedModules)) localStorage.setItem("candid_completed_modules", JSON.stringify(r.state.completedModules));
    } catch {}
  }
  return "signed-in";
}
export async function openBillingPortal() {
  const { url } = await call("portal", { token: read()?.token });
  window.location.assign(url);
}
