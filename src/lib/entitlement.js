// Whether this browser has a Candid subscription (api/billing.js). Kept in
// localStorage, never in the user's inputs (`d`, which is synced to their
// row): a signed token naming their email, and what the server last said
// about it. Checked with the server whenever the app opens, and the answer
// stands until the paid period ends. A "candid-access" event tells the app
// to redraw when it changes.

const KEY = "candid_access";

// Display only: the prices themselves are set in Stripe.
export const PLANS = {
  yearly:  { label: "Yearly",  price: "£24",   per: "a year",  note: "£2 a month" },
  monthly: { label: "Monthly", price: "£2.99", per: "a month", note: "Cancel any time" },
};

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
export async function openBillingPortal() {
  const { url } = await call("portal", { token: read()?.token });
  window.location.assign(url);
}
