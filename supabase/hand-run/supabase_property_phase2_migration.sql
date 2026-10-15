-- Property module, phase 2: stamp duty and mortgage inputs on the report row
-- in `test`, alongside the phase 1 columns (supabase_property_migration.sql).
-- Additive only: new nullable columns, nothing renamed, dropped or changed,
-- and no existing rows are touched.
--
-- property_stamp_duty (phase 1) now holds the calculated figure for England
-- and Northern Ireland, or the user's own figure for Scotland and Wales.

-- 1. New columns -------------------------------------------------------------
alter table public.test
  add column if not exists property_region text,
  add column if not exists property_first_time_buyer boolean,
  add column if not exists partner_first_time_buyer boolean,
  add column if not exists property_sole_property boolean,
  add column if not exists property_mortgage_term_years integer,
  add column if not exists property_mortgage_fixed_years integer,
  add column if not exists property_mortgage_rate numeric,
  add column if not exists property_remortgage_fee integer,
  add column if not exists property_monthly_repayment integer;

-- 2. Column grants for anon (run in the SQL editor) -----------------------------
-- Every column in the Property screen's PATCH needs one, or PostgREST
-- rejects the whole update, including the phase 1 fields.
grant update (
  property_region, property_first_time_buyer, partner_first_time_buyer,
  property_sole_property, property_mortgage_term_years, property_mortgage_fixed_years,
  property_mortgage_rate, property_remortgage_fee, property_monthly_repayment
) on public.test to anon;
