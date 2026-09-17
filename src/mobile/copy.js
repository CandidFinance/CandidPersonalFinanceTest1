import { fmtCompact } from "../lib/format.js";

// Short-copy variants for the mobile Home screen — plain English, single
// clauses, compact currency. Desktop's own inline strings in CandidApp.jsx
// are untouched; these exist alongside them, not as a replacement.

// Desktop (CandidApp.jsx HomeScreen): `${d.name ? `Hi ${d.name},` : "Hi,"} here's your Candid report.`
export function mobileGreeting(d) {
  return `Hi${d.name ? " " + d.name.split(" ")[0] : ""}.`;
}

// Desktop (lib/moduleStatus.js computeModuleStatuses, "too much cash" case):
// `${fmt(cashImpact)}/yr in tax-efficiency gain available — ${fmt(excess)} of it sits above your buffer`
export function mobileCashLabel(cashImpact, excess) {
  return `${fmtCompact(cashImpact)}/yr available — ${fmtCompact(excess)} sits idle`;
}
