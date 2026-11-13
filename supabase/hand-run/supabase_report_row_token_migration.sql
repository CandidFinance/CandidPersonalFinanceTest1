-- The report table (`test`): a browser can read and change only the row it
-- made (security audit, 13 Nov 2026, finding 1). Before this, the anon
-- policies were USING (true): anyone with the anon key could list every
-- row's id and overwrite any row, including its email.
--
-- Each row carries a secret `edit_token`, set by the browser at the insert
-- and sent with every write in the x-edit-token header (src/lib/supabase.js).
-- anon can't read the column or change it once set.
--
-- Run in two steps, in the Supabase SQL editor.
--   STEP A  before the client that sends tokens is deployed. Changes nothing
--           for the client that's live now.
--   STEP B  once that client is live on candid-finance.co.uk. From then, a
--           browser still running the old client can't save until it reloads.

-- ── STEP A ───────────────────────────────────────────────────────────────────
alter table public.test add column if not exists edit_token uuid;
grant insert (edit_token) on public.test to anon;

-- ── STEP B ───────────────────────────────────────────────────────────────────
-- The policies before (13 Nov 2026: allow_anon_insert, allow_anon_select_id_only
-- and allow_anon_update_feedback, all for anon) and after:
--   select policyname, cmd, roles, qual, with_check from pg_policies
--   where schemaname = 'public' and tablename = 'test';
begin;

-- A row from before tokens takes the token of the browser holding its id,
-- once: only an empty token is ever filled. Made in the same step that stops
-- ids being listed, so the id is what proves the row is theirs. (Ids listed
-- before this step could still be used on rows nobody has come back to.)
create or replace function public.claim_report_row(p_row_id uuid, p_token uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with claimed as (
    update public.test set edit_token = p_token
    where id = p_row_id and edit_token is null and p_token is not null
    returning 1
  )
  select exists (select 1 from claimed);
$$;
revoke all on function public.claim_report_row(uuid, uuid) from public, authenticated;
grant execute on function public.claim_report_row(uuid, uuid) to anon;

drop policy if exists allow_anon_select_id_only on public.test;
drop policy if exists allow_anon_update_feedback on public.test;
drop policy if exists allow_anon_insert on public.test;

create policy anon_select_own_row on public.test for select to anon
  using (edit_token::text = (current_setting('request.headers', true)::json ->> 'x-edit-token'));
create policy anon_insert_own_row on public.test for insert to anon
  with check (edit_token::text = (current_setting('request.headers', true)::json ->> 'x-edit-token'));
create policy anon_update_own_row on public.test for update to anon
  using (edit_token::text = (current_setting('request.headers', true)::json ->> 'x-edit-token'))
  with check (edit_token::text = (current_setting('request.headers', true)::json ->> 'x-edit-token'));
commit;

-- To check afterwards (the first two return [], the insert is refused):
--   curl "$SUPA_URL/rest/v1/test?select=id" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   curl -X PATCH "$SUPA_URL/rest/v1/test?id=not.is.null&select=id" -H "apikey: $ANON" \
--     -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
--     -H "Prefer: return=representation" -d '{"returned":true}'
--   curl -X POST "$SUPA_URL/rest/v1/test?select=id" -H "apikey: $ANON" \
--     -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
--     -H "Prefer: return=representation" -d '{"returned":false}'
