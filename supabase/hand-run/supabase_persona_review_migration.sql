-- The answers added by the persona UX review build (Oct 2026), on the user's
-- row: Scottish taxpayer, final salary or not, how the employer pays in,
-- Child Benefit, the retirement income they'd like, and which kinds of other
-- income they have. Written by rowInputFields (src/lib/reportRow.js).
--
-- Additive only: new nullable columns, nothing renamed, dropped or changed,
-- and no existing rows touched. anon's table-level INSERT covers the new
-- columns; UPDATE needs its own column grant, or every PATCH that includes
-- them is refused (401). Run this before the app starts sending them.

alter table public.test add column if not exists scottish_taxpayer boolean;          -- sharedQuestions.js SCOTLAND_QUESTION
alter table public.test add column if not exists pension_kind text;                  -- 'db' (final salary / career average) or 'dc'
alter table public.test add column if not exists employer_contribution_type text;    -- 'match' or 'fixed'
alter table public.test add column if not exists db_pension_income integer;          -- £ a year expected from a final salary scheme
alter table public.test add column if not exists child_benefit_children integer;     -- children Child Benefit is claimed for
alter table public.test add column if not exists cb_higher_earner boolean;           -- the higher earner in the household (pays the charge)
alter table public.test add column if not exists retirement_target integer;          -- £ a year after tax: 13900, 32700 or 45400
alter table public.test add column if not exists extra_income_kinds text;            -- comma-separated: bonus, dividends, other, none

grant update (
  scottish_taxpayer, pension_kind, employer_contribution_type, db_pension_income,
  child_benefit_children, cb_higher_earner, retirement_target, extra_income_kinds
) on public.test to anon;
