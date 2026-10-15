-- Property module, phase 1: store the Property screen's inputs on the report
-- row in `test`, so partner and purchase figures are kept alongside the rest
-- of the report. Additive only: new nullable columns, nothing renamed,
-- dropped or changed, and no existing rows are touched.
--
-- The app writes these with a PATCH on the user's own report row
-- (supaUpdateRow in src/CandidApp.jsx), the same way it already writes
-- modules_completed and the feedback columns.

-- 1. New columns -------------------------------------------------------------
alter table public.test
  add column if not exists property_buying_mode text,
  add column if not exists property_price integer,
  add column if not exists property_cash_available integer,
  add column if not exists property_stamp_duty integer,
  add column if not exists property_fees integer,
  add column if not exists property_loan_needed integer,
  add column if not exists property_income_multiple numeric,
  add column if not exists property_updated_at timestamptz,
  add column if not exists partner_salary integer,
  add column if not exists partner_other_income integer,
  add column if not exists partner_pension_my_pct numeric,
  add column if not exists partner_pension_employer_pct numeric,
  add column if not exists partner_isa_this_year integer;

-- 2. Column grants for anon ---------------------------------------------------
-- anon can only UPDATE columns it has a column-level grant for, and any
-- column it can't update makes PostgREST reject the whole PATCH (401).
-- pension_my_pct and pension_employer_pct already exist (insert-only today);
-- the Property screen can ask for them when the Pension module wasn't chosen.
-- anon's existing table-level INSERT already covers the new columns.
grant update (
  property_buying_mode, property_price, property_cash_available, property_stamp_duty,
  property_fees, property_loan_needed, property_income_multiple, property_updated_at,
  partner_salary, partner_other_income, partner_pension_my_pct,
  partner_pension_employer_pct, partner_isa_this_year,
  pension_my_pct, pension_employer_pct
) on public.test to anon;
