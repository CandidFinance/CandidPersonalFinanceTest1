// Best savings rates Candid tracks — the hand-maintained `savings_rates` table
// in Supabase (public read). The app fetches the rows itself (CandidApp.jsx,
// via supaSelect); the public calculator pages use fetchSavingsRates below.

// Highest-rate row for a given ISA/non-ISA category — returns the whole row
// (not just the number) so display keeps the DB's own "X.XX" string formatting
// rather than reformatting a coerced float. Null if no row of that category.
export function topRate(rows, isIsa) {
  const filtered = (rows || []).filter(r => r.is_isa === isIsa);
  if (!filtered.length) return null;
  return filtered.reduce((best, r) => (!best || +r.rate_aer > +best.rate_aer) ? r : best, null);
}

// All rows, or null if Supabase isn't configured or the request fails — the
// caller keeps its own fallback figure in that case.
export async function fetchSavingsRates() {
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/savings_rates?select=provider_name,rate_aer,updated_at,is_isa`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}
