-- Employment on the user's row: employed, self-employed or not working, and
-- for someone not working, whether they're retired or between jobs
-- (src/lib/sharedQuestions.js NOT_WORKING_QUESTION). Written by
-- rowInputFields (src/lib/reportRow.js).
--
-- Additive only: two new nullable columns, nothing renamed, dropped or
-- changed, and no existing rows touched. anon's table-level INSERT covers the
-- new columns; UPDATE needs its own column grant, or every PATCH that
-- includes them is refused (401). Run this before the app starts sending them.

alter table public.test add column if not exists employment_status text;
alter table public.test add column if not exists not_working_reason text;

grant update (employment_status, not_working_reason) on public.test to anon;
