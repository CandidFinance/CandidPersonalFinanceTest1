-- Buying together: whether the monthly spending figure the budget check used
-- is the household's or the user's own (propertySpendingScope, asked in the
-- Property mortgage step; see spendingShared in src/lib/rentVsBuy.js).
-- 'household' | 'mine', or null when buying alone or not answered.
--
-- Additive only: one new nullable column, nothing renamed, dropped or
-- changed, and no existing rows touched. anon's table-level INSERT covers the
-- new column; UPDATE needs its own column grant, or every PATCH that
-- includes it is refused (401).

alter table public.test add column if not exists property_spending_scope text;

grant update (property_spending_scope) on public.test to anon;
