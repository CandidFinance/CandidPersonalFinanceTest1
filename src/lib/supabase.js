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

// The report table (`test`) lets a browser read and change only the row it
// made: each row carries a secret `edit_token`, set at the insert and sent
// with every write in x-edit-token, which the table's RLS policies compare
// (supabase/hand-run/supabase_report_row_token_migration.sql). One token per
// browser, kept beside the row's id; in memory only if storage is blocked,
// as the row's id is then.
const OWNED_TABLE = "test";
const EDIT_TOKEN_KEY = "candid_report_row_token";
let memoryToken = null;
function newToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function editToken() {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = localStorage.getItem(EDIT_TOKEN_KEY);
    if (!memoryToken) {
      localStorage.setItem(EDIT_TOKEN_KEY, newToken());
      // Read back, so two tabs opened at once settle on the same one.
      memoryToken = localStorage.getItem(EDIT_TOKEN_KEY);
    }
  } catch { /* storage blocked: held in memory below */ }
  if (!memoryToken) memoryToken = newToken();
  return memoryToken;
}
const writeHeaders = () => ({
  "Content-Type": "application/json",
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Prefer": "return=representation",
  "x-edit-token": editToken(),
});

// A row from before rows had tokens takes this browser's, once, by its id
// (claim_report_row, which only fills an empty token). True if it did. One
// request per row: writes that find it unclaimed at the same moment all wait
// on the same answer. A request that didn't get through can be tried again.
const claims = new Map();
function claimRow(rowId) {
  if (!claims.has(rowId)) {
    claims.set(rowId, (async () => {
      try {
        const res = await fetch(`${SUPA_URL}/rest/v1/rpc/claim_report_row`, {
          method: "POST", headers: writeHeaders(), body: JSON.stringify({ p_row_id: rowId, p_token: editToken() }),
        });
        return res.ok && (await res.json()) === true;
      } catch { claims.delete(rowId); return false; }
    })());
  }
  return claims.get(rowId);
}

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
      headers: writeHeaders(),
      body: JSON.stringify(table === OWNED_TABLE ? { ...row, edit_token: editToken() } : row),
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
// "failed" or "skipped" (no Supabase config). A row that isn't this
// browser's (its edit token differs) reads as "missing" too; one from before
// rows had tokens is claimed first, then PATCHed.
export async function updateRow(table, rowId, patch, claimed = false) {
  if (!SUPA_URL || !SUPA_KEY || !SUPA_WRITES) return "skipped";
  if (!rowId) return "missing";
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(rowId)}&select=id`, {
      method: "PATCH",
      headers: writeHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      reportFailure(table, "update", data?.message || `HTTP ${res.status}`, res.status);
      return "failed";
    }
    const rows = await res.json().catch(() => null);
    if (!Array.isArray(rows) || rows.length) return "ok";
    if (table === OWNED_TABLE && !claimed && await claimRow(rowId)) return updateRow(table, rowId, patch, true);
    return "missing";
  } catch(e) {
    reportFailure(table, "update", e?.message || String(e));
    return "failed";
  }
}
