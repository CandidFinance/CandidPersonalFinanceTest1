-- Outside events' emails (src/lib/eventEmails.js, api/events.js): a Bank
-- Rate decision or a Budget, drafted by Claude on the day and approved on
-- /admin/alerts before api/alerts.js sends it to subscribers.
--  - event_emails: one row per event, keyed by its id in
--    src/lib/outsideEvents.js EVENTS (e.g. "boe-2026-11"). `outcome`: what
--    was announced that the app shows (Bank Rate: { "to": 3.5 }). `items`:
--    the same shape as weekly_issues.items. `note`: Claude's note for
--    whoever approves it, never sent. Only a row with approved_at goes out,
--    or shows in the app.
--
-- Read and written only through the service-role key (api/events.js,
-- api/alerts.js); the app reads approved outcomes through api/events.js.

create table if not exists public.event_emails (
  event_id    text primary key,
  outcome     jsonb,
  subject     text not null default '',
  intro       text not null default '',
  items       jsonb not null default '[]'::jsonb,
  note        text not null default '',
  drafted_by  text,
  drafted_at  timestamptz,
  approved_at timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.event_emails enable row level security;
revoke all on public.event_emails from anon, authenticated;
