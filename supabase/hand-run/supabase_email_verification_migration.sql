-- Confirming the emails people leave (api/email.js), and the list of who
-- Candid can contact (crm_contacts). Run once in the Supabase SQL editor.
--
--  - email_verifications: one row per address (lower-cased) a confirmation
--    link has gone to. `verified_at` is set when its link is used.
--  - crm_contacts: every confirmed address that asked for emails (the
--    unlock tick box, or "Get rate alerts") and hasn't unsubscribed, with
--    when and how they asked. Subscribers aren't in it unless they also
--    ticked a box: their email is a billing address, not a sign-up.
--
-- Service-role only, like alert_sends: RLS on with no policies, nothing
-- granted to anon or authenticated, and the view runs with the reader's
-- rights (security_invoker), so it can't be read through the anon key
-- either.
--
-- Additive only: nothing renamed, dropped or changed, no existing rows
-- touched.

create table if not exists public.email_verifications (
  email text primary key,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  sends integer not null default 0,
  verified_at timestamptz
);
alter table public.email_verifications enable row level security;
revoke all on public.email_verifications from anon, authenticated;

create or replace view public.crm_contacts with (security_invoker = true) as
select
  v.email,
  v.verified_at,
  min(t.created_at) as first_seen,
  max(t.created_at) as last_seen,
  bool_or(t.unlock_call_ok is true) as via_unlock,
  bool_or(t.alerts_opt_in is true) as via_rate_alerts,
  (array_agg(t.name order by t.id desc) filter (where t.name is not null))[1] as name
from public.test t
join public.email_verifications v on v.email = lower(trim(t.email))
where v.verified_at is not null
  and (t.unlock_call_ok is true or t.alerts_opt_in is true)
  and not exists (select 1 from public.alert_optouts o where o.email = v.email)
group by v.email, v.verified_at;
revoke all on public.crm_contacts from anon, authenticated;
