// Shared status label wording for mobile module tiles/headers — one place so
// Modules list rows and deep-dive headers never say something different for
// the same status.
// `elsewhere`: what would be "On track" is another module's to show (Kids &
// family's childcare, stopped by income over £100k, is the £100k tax
// trap's), so it says where (ELSEWHERE), with a neutral dot.
// Reviewed isn't a label here: it's its own mark, a tick by the module's
// name (ReviewedMark.jsx), so the label always says where the module stands.
// "On track" only by `mm.onTrack` (moduleStatus.js isOnTrack): a status of
// "ok" with £50 or more a year still on the module reads "Action needed".
export const ELSEWHERE = { taxTrap: { figure: "Childcare stops", label: "See the £100k tax trap" } };
export function statusLabel(mm) {
  if (mm.elsewhere && ELSEWHERE[mm.elsewhere]) return ELSEWHERE[mm.elsewhere].label;
  if (mm.onTrack) return "On track";
  if (mm.status === "na") return "Not applicable";
  if (mm.status === "unknown") return "Find out";
  return "Action needed";
}
