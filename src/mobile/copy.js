import { fmt, fmtCompact } from "../lib/format.js";
import { ISA_ALLOWANCE } from "../lib/tax.js";

// Short-copy variants for the mobile Home screen — plain English, single
// clauses, compact currency.

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

// Short variants of getModuleProducts' cash subheadings (CandidApp.jsx) —
// desktop's two-sentence versions read fine in a wide card; on a narrow
// mobile tile they wrapped to two lines and made the (now-collapsible)
// product tile taller than it needed to be before you'd even opened it.
export function mobileIsaSubheading(m) {
  // The allowance used this tax year, of the full allowance.
  const used = Math.max(0, ISA_ALLOWANCE - (m.isaHeadroom ?? ISA_ALLOWANCE));
  return `Highest rates · ${fmtCompact(used)}/${fmtCompact(ISA_ALLOWANCE)}`;
}
export function mobilePsaSubheading() {
  return "Highest rates";
}
