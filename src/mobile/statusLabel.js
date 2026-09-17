// Shared status label wording for mobile module tiles/headers — one place so
// Modules list rows and deep-dive headers never say something different for
// the same status.
export function statusLabel(mm, reviewed) {
  if (reviewed) return "Completed";
  if (mm.status === "ok") return "On track";
  if (mm.status === "unknown") return "Find out";
  return "Action needed";
}
