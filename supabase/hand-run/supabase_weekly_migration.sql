-- The Sunday email (api/alerts.js, src/lib/weekly.js).
--
--  - weekly_issues: one row per week, keyed by the Sunday it goes out:
--    the subject, intro and news items, written on /admin/alerts. Only an
--    approved issue (approved_at set) is sent; saving it again clears the
--    approval.
--
-- Sends are recorded in alert_sends (key "weekly:<the Sunday>", and
-- "welcome" for the welcome email), and anyone in alert_optouts gets
-- neither, as with the alerts.
--
-- service_role only, like alert_sends: RLS on, with no policies, and
-- nothing granted to anon or authenticated.
--
-- Additive only: nothing renamed, dropped or changed, no existing rows
-- touched.

create table if not exists public.weekly_issues (
  week date primary key,
  subject text not null default '',
  intro text not null default '',
  items jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.weekly_issues enable row level security;
revoke all on public.weekly_issues from anon, authenticated;
