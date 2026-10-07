-- The weekly savings rate feed (api/rates.js, src/lib/rateFeed.js).
--
-- rate_sources: the provider pages the feed reads. savings_rate_reviews:
-- changes waiting for a person (new products, big rate moves, products gone
-- from the page). Both are service-role only: RLS on, no policies.
--
-- savings_rates keeps feeding the app as before, with extra detail per
-- product, and a status so a withdrawn product disappears from the app
-- without its row being deleted.

create table public.rate_sources (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  url text not null unique,
  active boolean not null default true,
  last_fetched_at timestamptz,
  last_hash text,
  last_status text,
  last_error text,
  last_product_count integer,
  created_at timestamptz not null default now()
);
alter table public.rate_sources enable row level security;

alter table public.savings_rates
  add column product_name text,
  add column rate_kind text,
  add column term_months integer,
  add column notice_days integer,
  add column bonus_rate numeric(5,2),
  add column bonus_months integer,
  add column max_balance numeric,
  add column withdrawal_limits text,
  add column app_only boolean not null default false,
  add column evidence text,
  add column checked_at timestamptz,
  add column status text not null default 'live' check (status in ('live', 'withdrawn')),
  add column source_id uuid references public.rate_sources(id) on delete set null;

create table public.savings_rate_reviews (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.rate_sources(id) on delete cascade,
  row_id uuid references public.savings_rates(id) on delete set null,
  change_type text not null check (change_type in ('new', 'rate_change', 'missing')),
  product_key text not null,
  product_name text,
  current_rate numeric(5,2),
  proposed jsonb,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (resolution in ('approved', 'rejected'))
);
alter table public.savings_rate_reviews enable row level security;
create index savings_rate_reviews_open on public.savings_rate_reviews (created_at) where resolved_at is null;

-- The app only ever sees live rates.
drop policy "allow_public_read" on public.savings_rates;
create policy "allow_public_read_live" on public.savings_rates
  for select to anon
  using (status = 'live');

-- Existing rows: what kind of account each one is.
update public.savings_rates set rate_kind = 'fixed', term_months = (substring(account_type from '(\d+)-year'))::int * 12
  where account_type ilike '%fixed%';
update public.savings_rates set rate_kind = 'easy_access'
  where rate_kind is null and (account_type ilike 'easy access%' or account_type = 'Cash ISA');

-- Data fixes. Hargreaves Lansdown's Cash ISA was flagged as not an ISA.
-- Trading 212 and Chip each had a second copy of their Cash ISA flagged as
-- not an ISA, which put an ISA rate in the non-ISA comparison.
update public.savings_rates set is_isa = true, account_type = 'Easy access ISA'
  where provider_name = 'Hargreaves Lansdown' and account_type = 'Cash ISA';
update public.savings_rates set status = 'withdrawn'
  where provider_name in ('Trading 212', 'Chip') and account_type = 'Cash ISA' and is_isa = false;

-- One source per page the live rows came from, linked back to its rows.
insert into public.rate_sources (provider_name, url)
  select min(provider_name), product_url from public.savings_rates where status = 'live' group by product_url;
update public.savings_rates r set source_id = s.id from public.rate_sources s where s.url = r.product_url and r.status = 'live';
