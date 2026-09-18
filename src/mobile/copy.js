import { fmt, fmtCompact } from "../lib/format.js";

// Short-copy variants for the mobile Home screen — plain English, single
// clauses, compact currency. Desktop's own inline strings in CandidApp.jsx
// are untouched; these exist alongside them, not as a replacement.

// Desktop (CandidApp.jsx HomeScreen): `${d.name ? `Hi ${d.name},` : "Hi,"} here's your Candid report.`
export function mobileGreeting(d) {
  return `Hi${d.name ? " " + d.name.split(" ")[0] : ""}.`;
}

// First name only, or null — shared by anywhere that wants to personalise a
// sentence (e.g. calendar reminder text) without repeating the split logic.
export function firstName(d) {
  return d.name ? d.name.split(" ")[0] : null;
}

// Desktop (lib/moduleStatus.js computeModuleStatuses, "too much cash" case):
// `${fmt(cashImpact)}/yr in tax-efficiency gain available — ${fmt(excess)} of it sits above your buffer`
export function mobileCashLabel(cashImpact, excess) {
  return `${fmtCompact(cashImpact)}/yr available — ${fmtCompact(excess)} sits idle`;
}

// One-line variants of getModuleProducts' cash subheadings (CandidApp.jsx) —
// desktop's two-sentence versions read fine in a wide card; on a narrow
// mobile tile they wrapped to two lines and made the (now-collapsible)
// product tile taller than it needed to be before you'd even opened it.
export function mobileIsaSubheading(m) {
  return m.isaHeadroom > 0 ? `${fmt(m.isaHeadroom)} of ISA allowance left — tax-free, permanently.` : "Your ISA allowance is fully used this year.";
}
export function mobilePsaSubheading() {
  return "Tax-free up to your Personal Savings Allowance.";
}
