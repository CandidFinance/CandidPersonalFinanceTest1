-- The rate a product drops to once its headline rate ends (a bonus, an
-- introductory rate, or a rate "for 12 months"), when the page says.
-- Candid Assist uses it to warn before the drop. Applied 7 Oct 2026.
alter table public.savings_rates add column rate_after numeric(5,2);
