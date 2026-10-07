-- Each provider's app, so Candid Assist can send phone users to the right
-- store. Links are entered on /admin/rates and only reach the app once a
-- person has confirmed them (fake banking apps are a real fraud risk), at
-- which point they're copied onto that source's savings_rates rows, which
-- the app reads. Applied 7 Oct 2026.
alter table public.rate_sources
  add column ios_app_url text,
  add column android_app_url text,
  add column app_links_confirmed_at timestamptz;

alter table public.savings_rates
  add column ios_app_url text,
  add column android_app_url text;
