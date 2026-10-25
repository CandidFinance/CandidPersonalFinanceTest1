-- Signing in with Google, for subscribers (api/billing.js google, google-link).
-- Run once in the Supabase SQL editor. `subscriptions` stays service_role
-- only, so no grants: the API alone reads or writes these.

-- Google's id for the account (the ID token's `sub`), set when a subscriber
-- signs in with Google or adds it, so SignInGate counts it as a way to sign in.
alter table public.subscriptions
  add column if not exists google_sub text,
  add column if not exists google_linked_at timestamptz;
