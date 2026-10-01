// Where a property is being bought: the 12 ONS regions (ITL1), so the rent
// vs buy engine can use regional rent and house price data later. `nation`
// decides which purchase tax applies: SDLT in England and Northern Ireland,
// LBTT in Scotland, LTT in Wales.
export const PROPERTY_REGIONS = [
  { value:"london",           label:"London",                   nation:"england" },
  { value:"south_east",       label:"South East",               nation:"england" },
  { value:"east_of_england",  label:"East of England",          nation:"england" },
  { value:"south_west",       label:"South West",               nation:"england" },
  { value:"east_midlands",    label:"East Midlands",            nation:"england" },
  { value:"west_midlands",    label:"West Midlands",            nation:"england" },
  { value:"yorkshire_humber", label:"Yorkshire and the Humber", nation:"england" },
  { value:"north_west",       label:"North West",               nation:"england" },
  { value:"north_east",       label:"North East",               nation:"england" },
  { value:"northern_ireland", label:"Northern Ireland",         nation:"northern_ireland" },
  { value:"scotland",         label:"Scotland",                 nation:"scotland" },
  { value:"wales",            label:"Wales",                    nation:"wales" },
];

export function regionNation(region) {
  return PROPERTY_REGIONS.find(r => r.value === region)?.nation ?? null;
}
