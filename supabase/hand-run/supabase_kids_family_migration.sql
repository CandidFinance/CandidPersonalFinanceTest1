-- Kids & family's answers on the user's row, and where in the UK they live
-- (src/lib/childcare.js, moduleGuide.js KIDS_QUESTIONS, sharedQuestions.js
-- NATION_QUESTION). Written by rowInputFields (src/lib/reportRow.js).
--
-- Additive only: new nullable columns, nothing renamed, dropped or changed,
-- and no existing rows touched. anon's table-level INSERT covers the new
-- columns; UPDATE needs its own column grant, or every PATCH that includes
-- them is refused (401). Run this before the app starts sending them.

alter table public.test add column if not exists uk_nation text;             -- 'england', 'scotland', 'wales' or 'ni'
alter table public.test add column if not exists kids_preschool integer;     -- children not yet at school (3 = 3 or more)
alter table public.test add column if not exists kids_school integer;        -- at school, 11 or under (3 = 3 or more)
alter table public.test add column if not exists childcare_monthly integer;  -- £ a month paid for childcare, before any help
alter table public.test add column if not exists partner_over_100k text;     -- 'yes', 'no' or 'single'
alter table public.test add column if not exists tfc_claiming text;          -- uses Tax-Free Childcare: 'yes' or 'no'

grant update (
  uk_nation, kids_preschool, kids_school, childcare_monthly, partner_over_100k, tfc_claiming
) on public.test to anon;
