-- A subscriber's answers (the app's inputs and which modules they've
-- reviewed), saved by api/billing.js so signing in on another device brings
-- them back. Same table, so the same rule: only service_role reads or writes.
alter table public.subscriptions
  add column if not exists saved_state jsonb,
  add column if not exists saved_state_at timestamptz;
