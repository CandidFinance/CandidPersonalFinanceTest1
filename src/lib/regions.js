// Where a property is being bought: the 12 ONS regions (ITL1), so the rent
// vs buy engine can use regional rent and house price data later. `nation`
// decides which purchase tax applies: SDLT in England and Northern Ireland,
// LBTT in Scotland, LTT in Wales.
//
// `short` is for tight spaces (the location pill beside the alone/together
// toggle); pickers list the full `label`.
export const PROPERTY_REGIONS = [
  { value:"london",           label:"London",                   short:"London",       nation:"england" },
  { value:"south_east",       label:"South East",               short:"South East",   nation:"england" },
  { value:"east_of_england",  label:"East of England",          short:"East",         nation:"england" },
  { value:"south_west",       label:"South West",               short:"South West",   nation:"england" },
  { value:"east_midlands",    label:"East Midlands",            short:"E Midlands",   nation:"england" },
  { value:"west_midlands",    label:"West Midlands",            short:"W Midlands",   nation:"england" },
  { value:"yorkshire_humber", label:"Yorkshire and the Humber", short:"Yorkshire",    nation:"england" },
  { value:"north_west",       label:"North West",               short:"North West",   nation:"england" },
  { value:"north_east",       label:"North East",               short:"North East",   nation:"england" },
  { value:"northern_ireland", label:"Northern Ireland",         short:"N Ireland",    nation:"northern_ireland" },
  { value:"scotland",         label:"Scotland",                 short:"Scotland",     nation:"scotland" },
  { value:"wales",            label:"Wales",                    short:"Wales",        nation:"wales" },
];

export function regionNation(region) {
  return PROPERTY_REGIONS.find(r => r.value === region)?.nation ?? null;
}
