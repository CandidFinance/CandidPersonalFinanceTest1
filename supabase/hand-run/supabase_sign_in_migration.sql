-- Signing in with a passkey (Face ID, Touch ID, a phone's screen lock) or an
-- email and password, for subscribers (api/billing.js). Run once in the
-- Supabase SQL editor. Only service_role (the API) reads or writes either.

-- One row per passkey. Deleted with the subscription row it belongs to.
create table if not exists public.passkeys (
  id            text primary key,             -- the credential's ID, base64url
  email         text not null references public.subscriptions(email) on delete cascade,
  public_key    text not null,                -- its public key (COSE), base64url
  counter       bigint not null default 0,
  transports    text[],
  device_type   text,                         -- singleDevice or multiDevice (synced, e.g. iCloud Keychain)
  backed_up     boolean,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index if not exists passkeys_email_idx on public.passkeys (email);
alter table public.passkeys enable row level security;
revoke all on public.passkeys from anon, authenticated;

-- A password: a scrypt hash ("scrypt$N$r$p$salt$key"), never the password.
alter table public.subscriptions add column if not exists password_hash text;
alter table public.subscriptions add column if not exists password_set_at timestamptz;
