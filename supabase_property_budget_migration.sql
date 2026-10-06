-- The Property module's monthly budget check (src/lib/monthlyBudget.js) on
-- the user's row: what they'd have left each month once they own the home,
-- and the most they could afford with the budget as a limit alongside 4.5x
-- income and a 5% deposit. Written by the Property screen's save
-- (propertyPatch in CandidApp.jsx) with the other property_ columns.
--
-- Additive only: seven new nullable columns, nothing renamed, dropped or
-- changed, and no existing rows touched. anon's table-level INSERT covers the
-- new columns; UPDATE needs its own column grant, or every PATCH that
-- includes them is refused (401).

alter table public.test
  add column if not exists property_take_home integer,                    -- £ a month, household
  add column if not exists property_other_spending integer,               -- £ a month, spending other than rent
  add column if not exists property_budget_left integer,                  -- £ a month after mortgage and upkeep; negative is short
  add column if not exists property_budget_left_if_rates_rise integer,    -- the same, rates 1.5 points higher after the fix
  add column if not exists property_budget_status text,                   -- 'ok' | 'tight' | 'short'
  add column if not exists property_max_price integer,                    -- the most they could afford
  add column if not exists property_max_price_limit text;                 -- 'income' | 'deposit' | 'budget'

grant update (
  property_take_home, property_other_spending, property_budget_left, property_budget_left_if_rates_rise,
  property_budget_status, property_max_price, property_max_price_limit
) on public.test to anon;
