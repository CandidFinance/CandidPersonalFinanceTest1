-- Candid's emails between visits (api/alerts.js, src/lib/alerts.js).
--
--  - test.alerts_opt_in: someone asked for emails through the paywall's
--    "Not yet? Get rate alerts" (the unlock tick box is unlock_call_ok,
--    already there). anon's table-level INSERT covers it; UPDATE needs its
--    own column grant, or the PATCH that sends it is refused (401).
--  - alert_sends: one row per email sent, unique per person and alert, so
--    a reminder never goes twice. Written before each send.
--  - alert_optouts: everyone who has used an email's unsubscribe link.
--
-- Both tables are service_role only, like subscriptions: RLS on, with no
-- policies, and nothing granted to anon or authenticated.
--
-- Additive only: nothing renamed, dropped or changed, no existing rows
-- touched.

alter table public.test add column if not exists alerts_opt_in boolean;
grant update (alerts_opt_in) on public.test to anon;

create table if not exists public.alert_sends (
  id bigint generated always as identity primary key,
  email text not null,
  alert_key text not null,
  kind text not null,
  detail jsonb,
  sent_at timestamptz not null default now(),
  unique (email, alert_key)
);
create index if not exists alert_sends_sent_at on public.alert_sends (sent_at);
alter table public.alert_sends enable row level security;
revoke all on public.alert_sends from anon, authenticated;

create table if not exists public.alert_optouts (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.alert_optouts enable row level security;
revoke all on public.alert_optouts from anon, authenticated;
