-- Whether a provider's accounts can only be opened in its app, set by a
-- person on /admin/rates. Null: follow what the feed reads off the page.
-- When set, it's copied onto the source's savings_rates rows and the
-- weekly feed doesn't overwrite it. Applied 7 Oct 2026.
alter table public.rate_sources add column app_only boolean;
