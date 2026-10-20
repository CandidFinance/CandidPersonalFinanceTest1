// Shared status label wording for mobile module tiles/headers — one place so
// Modules list rows and deep-dive headers never say something different for
// the same status.
// `elsewhere`: what would be "On track" is another module's to show (Kids &
// family's childcare, stopped by income over £100k, is the £100k tax
// trap's), so it says where (ELSEWHERE), with a neutral dot.
export const ELSEWHERE = { taxTrap: { figure: "Childcare stops", label: "See the £100k tax trap" } };
export function statusLabel(mm, reviewed) {
  if (reviewed) return "Reviewed";
  if (mm.elsewhere && ELSEWHERE[mm.elsewhere]) return ELSEWHERE[mm.elsewhere].label;
  if (mm.status === "ok") return "On track";
  if (mm.status === "na") return "Not applicable";
  if (mm.status === "unknown") return "Find out";
  return "Action needed";
}
