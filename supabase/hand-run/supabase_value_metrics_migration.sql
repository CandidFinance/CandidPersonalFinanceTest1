-- The value Candid has driven, on the user's row (src/lib/valueMetrics.js):
-- the £ a year of changes they say they made, and the either/or answers
-- they've seen (rent or buy, overpay the student loan or leave it), with the
-- £ between the two choices over the period each covers. PATCHed on their
-- own by CandidApp's banking effect and useDecisionLog, never in the insert,
-- so a missing column can't stop rows being created.
--
-- Additive only: new nullable columns, nothing renamed, dropped or changed,
-- and no existing rows touched. anon's table-level INSERT covers the new
-- columns; UPDATE needs its own column grant, or every PATCH that includes
-- them is refused (401). Run this before the app starts sending them.

alter table public.test add column if not exists gained_per_year_gbp integer;   -- £ a year of changes made (moduleStatus.js gainedSoFar)
alter table public.test add column if not exists gained_so_far_gbp integer;     -- £ those changes have added up to so far
alter table public.test add column if not exists rent_vs_buy_result text;       -- 'buy' or 'rent', whichever came out ahead, or 'even'
alter table public.test add column if not exists rent_vs_buy_gap_gbp integer;   -- £ between them at the horizon
alter table public.test add column if not exists student_loan_result text;      -- 'overpay', 'lumpSum' or 'leave'
alter table public.test add column if not exists student_loan_gap_gbp integer;  -- £ between overpaying and leaving it, over the loan's life

grant update (
  gained_per_year_gbp, gained_so_far_gbp, rent_vs_buy_result, rent_vs_buy_gap_gbp,
  student_loan_result, student_loan_gap_gbp
) on public.test to anon;
