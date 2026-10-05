// What's still needed before the Property module's second step (the
// mortgage) unlocks: the purchase details the loan is worked out from, i.e.
// a price, where, and first-time buyer status where it changes stamp duty.
// The "before a deposit" checks (waterfall.js) are advice on the same screen,
// not a gate: two of them need the Cash & savings or Investments modules, and
// someone arriving at Property from a shared link should get through steps
// 1, 2 and 3 without leaving it. Unit tested in propertyReadiness.test.js.
import { regionNation } from "./regions.js";
import { sdltApplies } from "./stampDuty.js";

// First-time buyer status only changes stamp duty, which Candid works out
// for England and Northern Ireland only, so it isn't needed in Scotland or
// Wales. Still needed while no location is set.
export function firstTimeBuyerNeeded(d) {
  return !d.propertyRegion || sdltApplies(regionNation(d.propertyRegion));
}

export function readinessMissing(d) {
  const missing = [];
  if (!(+d.propertyPrice > 0)) missing.push("price");
  if (!d.propertyRegion) missing.push("region");
  const answered = v => v === "yes" || v === "no";
  if (firstTimeBuyerNeeded(d)) {
    if (!answered(d.propertyFirstTimeBuyer)) missing.push("firstTimeBuyer");
    if (d.propertyBuyingMode === "together" && !answered(d.partnerFirstTimeBuyer)) missing.push("partnerFirstTimeBuyer");
  }
  return missing;
}
