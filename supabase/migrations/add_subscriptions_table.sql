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
  -- The module whose paywall they paid at (Checkout metadata), the price and
  -- what it costs (pence), when they cancelled, and the reason and comment
  -- Stripe's portal asks for on the way out.
  signup_module text,
  stripe_price_id text,
  amount_pence integer,
  currency text,
  canceled_at timestamptz,
  cancellation_reason text,
  cancellation_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
