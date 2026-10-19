-- Kids & family's first answer, how many children, and a partner's income
-- over £100,000 (src/lib/childcare.js); and a Postgraduate loan alongside
-- the main student loan (src/lib/studentLoan.js pgScenario). Written by
-- rowInputFields (src/lib/reportRow.js).
--
-- Additive only: new nullable columns, nothing renamed, dropped or changed,
-- and no existing rows touched. anon's table-level INSERT covers the new
-- columns; UPDATE needs its own column grant, or every PATCH that includes
-- them is refused (401). Run this before the app starts sending them.

alter table public.test add column if not exists kids_status text;          -- 'yes', 'planning' or 'no'
alter table public.test add column if not exists kids_count integer;        -- children (4 = 4 or more)
alter table public.test add column if not exists partner_income integer;    -- £ a year, asked when over £100,000
alter table public.test add column if not exists has_pg_loan boolean;       -- a Postgraduate loan alongside the main plan
alter table public.test add column if not exists pg_loan_balance integer;   -- £ still owed on it

grant update (kids_status, kids_count, partner_income, has_pg_loan, pg_loan_balance) on public.test to anon;
