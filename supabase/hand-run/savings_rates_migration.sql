create table public.savings_rates (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  account_type text not null,
  rate_aer numeric(5,2) not null,
  product_url text not null,
  updated_at timestamptz not null default now()
);

-- RLS enabled with exactly one policy: public read-only. No insert/update/delete
-- policy for anon — matches "I'll maintain this manually via Table Editor" (the
-- dashboard's Table Editor uses your account's elevated access, not the anon key,
-- so it bypasses RLS regardless). Never add an anon write policy to this table.
alter table public.savings_rates enable row level security;

create policy "allow_public_read" on public.savings_rates
  for select
  to anon
  using (true);

-- Starting set — 3 real, currently-live UK easy-access Cash ISAs, verified via
-- MoneySavingExpert's comparison and each provider's own product page (Aug 2026).
-- These rates move — update updated_at whenever you revise a rate.
insert into public.savings_rates (provider_name, account_type, rate_aer, product_url, updated_at) values
  ('Hargreaves Lansdown', 'Cash ISA', 4.52, 'https://www.hl.co.uk/savings/cash-isa', now()),
  ('Trading 212',         'Cash ISA', 4.51, 'https://www.trading212.com/isa?cash-isa=', now()),
  ('Chip',                'Cash ISA', 4.41, 'https://www.getchip.uk/savings-accounts/smart-cash-isa', now());
