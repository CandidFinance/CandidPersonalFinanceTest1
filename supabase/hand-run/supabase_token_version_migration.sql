-- Sign-ins that can be ended (api/billing.js sessionFrom, endSessions).
-- Run once in the Supabase SQL editor, BEFORE the code that uses it is
-- deployed: a password change writes this column and fails without it.
-- `subscriptions` stays service_role only, so no grants.

-- Counts up when every sign-in to the account is ended (a new password,
-- "Sign out everywhere"). An access token carries the number it was made
-- under and stops working once the account's has moved on.
alter table public.subscriptions
  add column if not exists token_version integer not null default 0;
