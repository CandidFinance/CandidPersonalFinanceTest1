// The browser's calls to Supabase: its REST API with the anon key, no SDK.
// Every failure goes to the reporter main.jsx sets (PostHog), the only
// production view of them: fetch() doesn't throw on an HTTP error, so a
// refused read or write would otherwise fail silently (this is how an RLS
// gap and an AI-report failure once went undetected).
const SUPA_URL = import.meta.env?.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
// No writes from automated browsers (Playwright test runs), so they don't add
// rows that look like users.
const SUPA_WRITES = typeof navigator === "undefined" || !navigator.webdriver;

let onFailure = () => {};
// `report({ table, operation, error_message, status })` is called on each failure.
export function setSupabaseFailureReporter(report) { onFailure = report; }

function reportFailure(table, operation, errorMessage, status) {
  if (import.meta.env?.DEV) console.warn(`[Candid] Supabase ${operation} on "${table}" failed:`, errorMessage, status ? `(HTTP ${status})` : "(network error)");
  onFailure({ table, operation, error_message: errorMessage, status: status ?? null });
}

// Inserts a row and returns its id, or null if it wasn't written.
export async function insertRow(table, row) {
  if (!SUPA_URL || !SUPA_KEY || !SUPA_WRITES) return null;
  try {
    // ?select=id: anon only has column-level SELECT on `id` (lock_down_test_table_rls),
    // so returning the full row makes PostgREST reject the whole insert with a 401.
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?select=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify(row),
    });
    const data = await res.json();
    // A non-2xx response (e.g. an RLS rejection or an unknown table) never throws —
    // fetch() resolves normally, so this must be checked explicitly or it silently
    // falls through to the Array.isArray check below and returns null unreported.
    if (!res.ok) {
      reportFailure(table, "insert", data?.message || JSON.stringify(data), res.status);
      return null;
    }
    return Array.isArray(data) && data[0]?.id ? data[0].id : null;
  } catch(e) {
    reportFailure(table, "insert", e?.message || String(e));
    return null;
  }
}

// The rows `query` selects (a PostgREST query string, from "?"), or null.
export async function selectRows(table, query = "") {
  if (!SUPA_URL || !SUPA_KEY) return null;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}${query}`, {
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      reportFailure(table, "select", data?.message || `HTTP ${res.status}`, res.status);
      return null;
    }
    return await res.json();
  } catch(e) {
    reportFailure(table, "select", e?.message || String(e));
    return null;
  }
}

// PATCH one row by id. Every column in the patch needs its own anon
// column-level UPDATE grant on `test`, or PostgREST rejects the whole update.
// Returns "ok", "missing" (no row with that id: a PATCH that matches nothing
// still succeeds, so it's checked via the returned ids, which anon can read),
// "failed" or "skipped" (no Supabase config).
export async function updateRow(table, rowId, patch) {
  if (!SUPA_URL || !SUPA_KEY || !SUPA_WRITES) return "skipped";
  if (!rowId) return "missing";
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(rowId)}&select=id`, {
      method: "PATCH",
      headers: { "Content-Type":"application/json", "apikey":SUPA_KEY, "Authorization":`Bearer ${SUPA_KEY}`, "Prefer":"return=representation" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      reportFailure(table, "update", data?.message || `HTTP ${res.status}`, res.status);
      return "failed";
    }
    const rows = await res.json().catch(() => null);
    return Array.isArray(rows) && rows.length === 0 ? "missing" : "ok";
  } catch(e) {
    reportFailure(table, "update", e?.message || String(e));
    return "failed";
  }
}
