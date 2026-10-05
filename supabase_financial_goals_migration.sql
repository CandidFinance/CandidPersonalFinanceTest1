-- The user's goals on their row: what the app's entry picks imply (an
-- emergency fund, buying a home) plus those asked before the first report (a
-- big purchase, future generations, bringing money together). Stored as a
-- comma-separated list, like `interests`. See onboarding-guided-questions.md.
--
-- Additive only: one new nullable column, nothing renamed, dropped or
-- changed, and no existing rows touched. anon's table-level INSERT covers the
-- new column; UPDATE needs its own column grant, or every PATCH that
-- includes it is refused (401).

alter table public.test add column if not exists financial_goals text;

grant update (financial_goals) on public.test to anon;
