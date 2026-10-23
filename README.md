# Candid

Candid works out what someone's money could be doing, from their own figures: cash and savings, investments, pension, student loan, and buying a home. It's a calculator, not an adviser. Live at [candid-finance.co.uk](https://www.candid-finance.co.uk).

React 18 and Vite, deployed on Vercel. Data in Supabase, analytics in PostHog, subscriptions through Stripe, emails through Resend, rate limits in Upstash Redis.

## Running it

```bash
npm install
npm run dev        # the site and app on http://localhost:5173, plus the Assist agent (below)
npm test           # the engine's tests, under a fixed clock (8 October 2026)
npm run build      # production build into dist/
```

`npm run dev` also starts the account-opening agent (`scripts/assist-agent`) unless `CANDID_AGENT=0`. `npm run personas` reruns the investor model (`scripts/personas`) and rebuilds its page.

## Where things are

| Path | What's there |
|---|---|
| `src/main.jsx` | Routes, analytics set-up, the welcome-back page |
| `src/CandidApp.jsx` | The app shell for `/app/*`: saved inputs, Supabase rows, which screen to show |
| `src/mobile/` | The app's screens, module pages, Property steps and Candid Assist |
| `src/lib/` | The finance engine: tax, pension, cash, student loan, property and forecasts. Plain JavaScript with no React, tested with `node --test` |
| `src/site/` | The marketing site (`/`, `/the-problem`, `/how-it-works`, `/signin`, `/what-candid-is`) |
| `src/admin/` | `/admin/feedback` and `/admin/rates` (password-protected) |
| `api/` | Vercel functions: `billing.js` (Stripe), `rates.js` (the savings-rate feed, also a daily cron), `feedback.js`, `truelayer/*` (sandbox only) |
| `server/` | Helpers the functions share (origin checks, cookies, rate limits) |
| `*.html` (root) | The public calculator pages, privacy policy and terms. The calculators are built by Vite, with figures filled in from `src/lib/pageFigures.js` |
| `supabase/` | `migrations/` for the CLI; `hand-run/` for SQL that was run by hand in the dashboard |
| `docs/` | Specs, reviews and plans the code refers to |

## Environment variables

Set in Vercel, and in `.env.local` for local development (never committed).

- **Browser** (`VITE_` prefix, bundled into the client, so public by design): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_KEY`, and the dev-only flags `VITE_SHOW_DEV_TOOLS` and `VITE_DEV_PAYWALL`.
- **Functions only:** `SUPABASE_SERVICE_ROLE_KEY`, `FEEDBACK_ADMIN_PASSWORD`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_BILLING_TOKEN_SECRET`, `RESEND_API_KEY`, `BILLING_MAIL_FROM`, `BILLING_EXTRA_HOSTS`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and the `TRUELAYER_*` sandbox settings.

## Tests

`src/lib/*.test.js` test the engine's rules one by one. `src/lib/characterisation.test.js` is different: it runs 17 test profiles through every engine function the app shows figures from, and compares the results, value for value, with `characterisation.snapshot.json`. It says nothing about whether a figure is right, only that a change hasn't moved it. After a deliberate change to the engine, rebuild the snapshot and review its diff:

```bash
CHARACTERISATION_UPDATE=1 npm test
```

## Deploying

Vercel deploys `main` to production. Day-to-day work happens on `main`.
