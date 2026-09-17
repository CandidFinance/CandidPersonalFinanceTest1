// ── Helpers ───────────────────────────────────────────────────────────────────
export function fmt(n) {
  return new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format(Math.abs(n||0));
}

// Compact £Xk form for tight mobile columns (chart axis, forecast table) — falls
// back to fmt() below £1,000 so small values don't round down to "£0k".
export function fmtK(n) {
  const abs = Math.abs(n||0);
  return abs >= 1000 ? `£${Math.round(abs/1000)}k` : fmt(n);
}

// One-decimal compact £X.Xk form for mobile headline figures (e.g. "£2.5k/yr") —
// distinct from fmtK's whole-number rounding, which desktop chart axes/tables
// depend on unchanged.
// Comma-grouped digits with no currency symbol or decimals — for live-typing
// inputs that render their own £ prefix separately (e.g. mobile pill inputs).
export function formatThousands(raw) {
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return "";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(n);
}

export function fmtCompact(n) {
  const abs = Math.abs(n || 0);
  if (abs < 1000) return fmt(n);
  const k = abs / 1000;
  const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
  return `£${rounded}k`;
}
