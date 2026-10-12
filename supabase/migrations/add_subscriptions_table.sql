-- Who has a Candid subscription, kept current by api/billing.js from Stripe's
-- webhook. Read and written only by service_role (the server): RLS is on
-- with no policies, and anon/authenticated have no grants, so the browser
-- can never read or change it.
create table if not exists public.subscriptions (
  email text primary key,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text not null,
  plan text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
