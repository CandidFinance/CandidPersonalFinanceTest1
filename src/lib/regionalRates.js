// Regional growth figures for the rent vs buy engine: annual private rent
// growth and annual house price growth for each PROPERTY_REGIONS region.
//
// The live figures come from the Supabase table property_regional_rates,
// updated by hand with each ONS release (like savings_rates). This snapshot
// is the fallback while that loads, or if it can't be read.
//
// Source: ONS, Private rent and house prices, UK: September 2026.
// Rents: 12 months to August 2026 (Northern Ireland: to June 2026).
// House prices: 12 months to July 2026 (Northern Ireland: Q2 2026).
export const REGIONAL_RATES_SNAPSHOT = {
  london:           { rentGrowthPct: 3.5, housePriceGrowthPct: -3.3 },
  south_east:       { rentGrowthPct: 3.0, housePriceGrowthPct: 0.2 },
  east_of_england:  { rentGrowthPct: 3.5, housePriceGrowthPct: 0.5 },
  south_west:       { rentGrowthPct: 4.4, housePriceGrowthPct: -0.2 },
  east_midlands:    { rentGrowthPct: 3.7, housePriceGrowthPct: 1.9 },
  west_midlands:    { rentGrowthPct: 4.9, housePriceGrowthPct: 1.5 },
  yorkshire_humber: { rentGrowthPct: 4.9, housePriceGrowthPct: 3.0 },
  north_west:       { rentGrowthPct: 5.8, housePriceGrowthPct: 4.4 },
  north_east:       { rentGrowthPct: 5.8, housePriceGrowthPct: 4.9 },
  northern_ireland: { rentGrowthPct: 1.6, housePriceGrowthPct: 9.2 },
  scotland:         { rentGrowthPct: 1.1, housePriceGrowthPct: 2.3 },
  wales:            { rentGrowthPct: 4.3, housePriceGrowthPct: 2.6 },
};

// Average house price for each region, offered as the price when someone
// isn't sure yet. Source: UK House Price Index (HM Land Registry, ONS), July
// 2026, Northern Ireland Q2 2026: the same release as the growth figures
// above, rounded to the nearest £1,000 as published.
export const REGIONAL_AVERAGE_PRICES = {
  london: 550000, south_east: 381000, east_of_england: 338000, south_west: 302000,
  east_midlands: 242000, west_midlands: 251000, yorkshire_humber: 209000,
  north_west: 221000, north_east: 167000, northern_ireland: 202000,
  scotland: 196000, wales: 215000,
};

// From the table's average_price when it has one, else the snapshot. Null
// for an unknown or unset region.
export function regionalAveragePrice(region, rows) {
  const row = Array.isArray(rows) ? rows.find(r => r.region === region) : null;
  if (row && +row.average_price > 0) return +row.average_price;
  return REGIONAL_AVERAGE_PRICES[region] ?? null;
}

// The region's figures from the table rows when they're loaded, else the
// snapshot. Null for an unknown or unset region.
export function regionalRates(region, rows) {
  const row = Array.isArray(rows) ? rows.find(r => r.region === region) : null;
  if (row && row.rent_growth_pct != null && row.house_price_growth_pct != null) {
    return { rentGrowthPct: +row.rent_growth_pct, housePriceGrowthPct: +row.house_price_growth_pct, source: "table" };
  }
  const snap = REGIONAL_RATES_SNAPSHOT[region];
  return snap ? { ...snap, source: "snapshot" } : null;
}
