import { ON_TRACK_FLOOR, COSTS_MISSING } from "../lib/moduleStatus.js";

// Shared status label wording for mobile module tiles/headers — one place so
// Modules list rows and deep-dive headers never say something different for
// the same status.
// `elsewhere`: what would be "On track" is another module's to show (Kids &
// family's childcare, stopped by income over £100k, is the £100k tax
// trap's), so it says where (ELSEWHERE), with a neutral dot.
// Reviewed isn't a label here: it's its own mark, a tick by the module's
// name (ReviewedMark.jsx), so the label always says where the module stands.
// "On track" only by `mm.onTrack` (moduleStatus.js isOnTrack).
// "Action needed" only with a £ saving at stake (£50 a year or more).
// Something open with no £ to it (an emergency fund short of its target,
// ISA allowance unused) is "Worth a look", its `reason` saying what; Cash
// without its monthly costs is "Find out", as an unanswered module is.
export const ELSEWHERE = { taxTrap: { figure: "Childcare stops", label: "See the £100k tax trap" } };
export function statusLabel(mm) {
  if (mm.elsewhere && ELSEWHERE[mm.elsewhere]) return ELSEWHERE[mm.elsewhere].label;
  if (mm.onTrack) return "On track";
  if (mm.status === "na") return "Not applicable";
  if (mm.status === "unknown") return "Find out";
  // The £100k tax trap, under it but heading there (moduleStatus.js).
  if (mm.status === "edge" || mm.status === "watch") return "Approaching £100k";
  if ((mm.amount || 0) >= ON_TRACK_FLOOR) return "Action needed";
  return mm.reason === COSTS_MISSING ? "Find out" : "Worth a look";
}
// The label, with its reason when there's no £ figure to show it
// (moduleStatus.js `reason`).
export const statusLine = mm => {
  const label = statusLabel(mm);
  return mm.reason && (label === "Worth a look" || label === "Find out") ? `${label} · ${mm.reason}` : label;
};
