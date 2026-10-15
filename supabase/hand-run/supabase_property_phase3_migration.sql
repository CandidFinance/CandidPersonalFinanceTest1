-- Property module, phase 3: rent vs buy.
--   A. A new table of regional growth figures, read by the app and updated
--      by hand with each ONS release (like savings_rates).
--   B. Rent vs buy inputs and results on the report row in `test`.
-- Additive only: nothing existing is renamed, dropped or changed.

-- ── Step 1 (applied by Claude once approved) ───────────────────────────────

-- A. Regional rates. RLS on, with public read only: nobody can write with
-- the anon key; you update rows in the Table Editor, which bypasses RLS.
create table if not exists public.property_regional_rates (
  region text primary key,            -- matches PROPERTY_REGIONS values in src/lib/regions.js
  rent_growth_pct numeric not null,   -- annual private rent growth (ONS PIPR)
  house_price_growth_pct numeric not null, -- annual house price growth (ONS / UK HPI)
  rent_period text,
  house_price_period text,
  source_url text,
  updated_at timestamptz not null default now()
);
alter table public.property_regional_rates enable row level security;
create policy "allow_public_read" on public.property_regional_rates
  for select to anon using (true);

insert into public.property_regional_rates (region, rent_growth_pct, house_price_growth_pct, rent_period, house_price_period, source_url) values
  ('london',           3.5, -3.3, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('south_east',       3.0,  0.2, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('east_of_england',  3.5,  0.5, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('south_west',       4.4, -0.2, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('east_midlands',    3.7,  1.9, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('west_midlands',    4.9,  1.5, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('yorkshire_humber', 4.9,  3.0, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('north_west',       5.8,  4.4, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('north_east',       5.8,  4.9, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('northern_ireland', 1.6,  9.2, '12 months to June 2026',   'Q2 2026 on Q2 2025',     'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('scotland',         1.1,  2.3, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026'),
  ('wales',            4.3,  2.6, '12 months to August 2026', '12 months to July 2026', 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/september2026')
on conflict (region) do nothing;

-- B. Rent vs buy on the report row.
alter table public.test
  add column if not exists property_monthly_rent integer,
  add column if not exists property_horizon_years integer,
  add column if not exists property_tenure text,
  add column if not exists property_ground_rent integer,
  add column if not exists property_ground_rent_growth numeric,
  add column if not exists property_service_charge integer,
  add column if not exists property_house_price_growth numeric,
  add column if not exists property_rent_growth numeric,
  add column if not exists property_investment_return numeric,
  add column if not exists property_dividend_yield numeric,
  add column if not exists property_breakeven_year integer,
  add column if not exists property_wealth_gap integer;

-- ── Step 2 (run in the SQL Editor) ─────────────────────────────────────────
grant update (
  property_monthly_rent, property_horizon_years, property_tenure, property_ground_rent,
  property_ground_rent_growth, property_service_charge, property_house_price_growth,
  property_rent_growth, property_investment_return, property_dividend_yield,
  property_breakeven_year, property_wealth_gap
) on public.test to anon;
