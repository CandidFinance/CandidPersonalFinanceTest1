// Stamp Duty Land Tax on a residential purchase in England or Northern
// Ireland. Pure function, unit tested in stampDuty.test.js.
//
// Rates in force from 1 April 2025, as confirmed on 1 October 2026.
// Check against GOV.UK before relying on them after any Budget.
// Not modelled: the 2% surcharge for buyers not resident in the UK.
export const SDLT_RATES_FROM = "2025-04-01";

// [upper limit of the band, rate]
const STANDARD_BANDS = [[125000, 0], [250000, 0.02], [925000, 0.05], [1500000, 0.10], [Infinity, 0.12]];
// First-time buyer relief: only on purchases of £500,000 or less. Above
// that the relief is lost entirely and the standard bands apply.
const FIRST_TIME_BUYER_BANDS = [[300000, 0], [500000, 0.05]];
export const FIRST_TIME_BUYER_MAX_PRICE = 500000;
// The part of the price a first-time buyer pays no stamp duty on.
export const FIRST_TIME_BUYER_NIL_BAND = FIRST_TIME_BUYER_BANDS[0][0];
// Higher rates for additional dwellings: +5 points on every band, on
// purchases of £40,000 or more.
export const ADDITIONAL_PROPERTY_SURCHARGE = 0.05;
export const ADDITIONAL_PROPERTY_MIN_PRICE = 40000;

const SDLT_NATIONS = ["england", "northern_ireland"];
// Whether Candid works out the purchase tax for this nation. Scotland (LBTT)
// and Wales (LTT) have their own taxes Candid doesn't calculate yet.
export function sdltApplies(nation) {
  return SDLT_NATIONS.includes(nation);
}

// `firstTimeBuyers` has one entry per buyer; relief needs every buyer to be
// a first-time buyer. `additionalProperty` is true when the buyer(s) will
// own another home after this purchase.
export function calcStampDuty({ price = 0, nation, firstTimeBuyers = [], additionalProperty = false }) {
  if (!sdltApplies(nation)) return { supported: false, nation };
  const allFirstTime = firstTimeBuyers.length > 0 && firstTimeBuyers.every(Boolean);
  const reliefApplies = allFirstTime && !additionalProperty && price <= FIRST_TIME_BUYER_MAX_PRICE;
  const surcharge = additionalProperty && price >= ADDITIONAL_PROPERTY_MIN_PRICE ? ADDITIONAL_PROPERTY_SURCHARGE : 0;
  const bands = reliefApplies ? FIRST_TIME_BUYER_BANDS : STANDARD_BANDS;

  const breakdown = [];
  let lower = 0;
  for (const [upper, rate] of bands) {
    if (price <= lower) break;
    const top = Math.min(price, upper);
    breakdown.push({ from: lower, to: top, rate: rate + surcharge, tax: (top - lower) * (rate + surcharge) });
    lower = upper;
  }
  return {
    supported: true,
    // HMRC rounds the tax due down to the pound.
    total: Math.floor(breakdown.reduce((s, b) => s + b.tax, 0) + 1e-9),
    breakdown,
    reliefApplies,
    // First-time buyers whose price is over £500,000 lose the relief.
    reliefLostOverCap: allFirstTime && !additionalProperty && price > FIRST_TIME_BUYER_MAX_PRICE,
    // Joint buyers where only one is a first-time buyer get no relief.
    reliefNeedsAllBuyers: firstTimeBuyers.length > 1 && firstTimeBuyers.some(Boolean) && !allFirstTime,
    surcharge,
  };
}
