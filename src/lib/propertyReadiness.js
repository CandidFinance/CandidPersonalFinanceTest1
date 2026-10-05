// What's still needed before the Property module's second step (the
// mortgage) unlocks. Step 1 is complete once every visible waterfall check
// has its figures and the borrowing check has what it needs to work out the
// loan, including stamp duty. Being complete is about having the figures,
// not about every check being green. Unit tested in propertyReadiness.test.js.
import { runWaterfall, waterfallInputs, VISIBLE_CHECKS } from "./waterfall.js";
import { regionNation } from "./regions.js";
import { sdltApplies } from "./stampDuty.js";

// First-time buyer status only changes stamp duty, which Candid works out
// for England and Northern Ireland only, so it isn't needed in Scotland or
// Wales. Still needed while no location is set.
export function firstTimeBuyerNeeded(d) {
  return !d.propertyRegion || sdltApplies(regionNation(d.propertyRegion));
}

export function readinessMissing(d, m) {
  const missing = [];
  const checks = runWaterfall(waterfallInputs(d, m)).filter(c => VISIBLE_CHECKS.includes(c.key));
  // Per person, not just each check's combined state: a check reads as
  // "attention" when one buyer needs a look even if the other's figures
  // are still missing.
  if (checks.some(c => c.state === "missing" || (c.people || []).some(p => p.state === "missing"))) missing.push("checks");
  if (!(+d.propertyPrice > 0)) missing.push("price");
  if (!d.propertyRegion) missing.push("region");
  const answered = v => v === "yes" || v === "no";
  if (firstTimeBuyerNeeded(d)) {
    if (!answered(d.propertyFirstTimeBuyer)) missing.push("firstTimeBuyer");
    if (d.propertyBuyingMode === "together" && !answered(d.partnerFirstTimeBuyer)) missing.push("partnerFirstTimeBuyer");
  }
  return missing;
}
