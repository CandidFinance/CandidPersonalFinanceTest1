-- Referrals (server/referrals.js): a friend who arrives on someone's link,
-- confirms their email and gets their first answer earns that person a free
-- month, up to 12. Run once in the Supabase SQL editor.
--
--  - referral_codes: one code per confirmed email, made the first time
--    they ask for their link. The code is what goes in ?ref=, so the link
--    never carries an email.
--  - referrals: one row per friend (a friend counts once, ever), from when
--    they give their email on someone's link. `friend_email` is their
--    inbox's plain address (server/referrals.js inboxOf: no "+tag", and no
--    dots in a Gmail name), so another spelling of it doesn't count again.
--    `status`:
--      pending   their email isn't confirmed yet
--      rewarded  confirmed, and the free month given (`reward` says how:
--                free_month, a month's access; stripe_credit, £2.99 off a
--                subscriber's next bill, `stripe_balance_txn` its id)
--      capped    confirmed, but the referrer had 12 months already
--      failed    confirmed, but the reward couldn't be given (`note` says
--                why); to give by hand
--
-- Service-role only, like email_verifications: RLS on with no policies,
-- nothing granted to anon or authenticated.
--
-- Additive only: nothing renamed, dropped or changed, no existing rows
-- touched.

create table if not exists public.referral_codes (
  email text primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
revoke all on public.referral_codes from anon, authenticated;

create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  code text not null references public.referral_codes (code),
  referrer_email text not null,
  friend_email text not null unique,
  status text not null default 'pending' check (status in ('pending', 'rewarded', 'capped', 'failed')),
  reward text check (reward in ('free_month', 'stripe_credit')),
  stripe_balance_txn text,
  note text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  rewarded_at timestamptz
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_email);
alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;
