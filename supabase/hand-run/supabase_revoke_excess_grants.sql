-- Takes away database rights the browser never uses (16 Nov 2026).
-- Run once in the Supabase SQL editor. No code depends on it, so it can run
-- at any time; nothing needs deploying before or after.
--
-- The browser talks to Supabase as the `anon` role. Row level security
-- already stops it reaching these tables, but the underlying grants were far
-- wider than the policies: one mistaken policy would have opened them. After
-- this, `anon` holds only what the site uses:
--   test                     insert, plus its column-level select and update
--   savings_rates            select
--   property_regional_rates  select
-- `authenticated` (Supabase Auth, which Candid doesn't use) holds nothing.
-- The server uses `service_role`, which is untouched.

begin;

-- Server-only tables: nothing for the browser.
revoke all on table public.rate_sources          from anon, authenticated;
revoke all on table public.savings_rate_reviews  from anon, authenticated;
revoke all on table public.truelayer_connections from anon, authenticated;
revoke all on table public."Sessions"            from anon, authenticated;

-- No page writes to these any more, so the open insert goes too: a script
-- with the public key could fill them with junk rows.
drop policy if exists "allow_anon_insert" on public.waitlist;
drop policy if exists "allow_anon_insert" on public.report_pdf_requests;
revoke all on table public.waitlist            from anon, authenticated;
revoke all on table public.report_pdf_requests from anon, authenticated;

-- Read-only reference tables: select, and nothing else.
revoke all on table public.savings_rates           from anon, authenticated;
revoke all on table public.property_regional_rates from anon, authenticated;
grant select on table public.savings_rates           to anon;
grant select on table public.property_regional_rates to anon;

-- The report table: the browser inserts its own row and updates it with its
-- edit token. It never deletes, and it isn't `authenticated`.
revoke delete, truncate, references, trigger on table public.test from anon;
revoke all on table public.test from authenticated;

-- The trigger function that stamps last_active: a fixed search_path, and no
-- direct calls (a trigger doesn't need the caller to hold EXECUTE).
alter function public.touch_test_last_active() set search_path = public;
revoke execute on function public.touch_test_last_active() from public, anon, authenticated;

commit;

-- Check 1: what anon and authenticated still hold at table level. Expect
-- exactly three rows: anon INSERT on test, anon SELECT on savings_rates,
-- anon SELECT on property_regional_rates.
select grantee, table_name, string_agg(privilege_type, ', ' order by privilege_type) as rights
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by grantee, table_name order by 1, 2;

-- Check 2: expect no rows (the two insert policies are gone).
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('waitlist', 'report_pdf_requests');

-- Optional, separately: the empty table nothing uses (0 rows on 16 Nov).
-- drop table public."Sessions";
