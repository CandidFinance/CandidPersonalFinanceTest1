// What's still needed before the Property module's second step (the
// mortgage) unlocks. Step 1 is complete once every visible waterfall check
// has its figures and the borrowing check has what it needs to work out the
// loan, including stamp duty. Being complete is about having the figures,
// not about every check being green. Unit tested in propertyReadiness.test.js.
import { runWaterfall, waterfallInputs, VISIBLE_CHECKS } from "./waterfall.js";

export function readinessMissing(d, m) {
  const missing = [];
  const checks = runWaterfall(waterfallInputs(d, m)).filter(c => VISIBLE_CHECKS.includes(c.key));
  // Per person, not just each check's combined state: a check reads as
  // "attention" when one buyer needs a look even if the other's figures
  // are still missing.
  if (checks.some(c => c.state === "missing" || (c.people || []).some(p => p.state === "missing"))) missing.push("checks");
  if (!(+d.propertyPrice > 0)) missing.push("price");
  if (!d.propertyRegion) missing.push("region");
  if (d.propertyFirstTimeBuyer !== "yes" && d.propertyFirstTimeBuyer !== "no") missing.push("firstTimeBuyer");
  if (d.propertyBuyingMode === "together" && d.partnerFirstTimeBuyer !== "yes" && d.partnerFirstTimeBuyer !== "no") missing.push("partnerFirstTimeBuyer");
  return missing;
}
