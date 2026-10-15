# Candid code quality audit

14 October 2026, branch `feature/mobile-app`, before any refactoring.

Scope: `src/`, `api/`, `vite.config.js`, `vercel.json`, `package.json`, the calculator pages, and `scripts/` where they import app code. Planning documents and SQL files were checked for references only.

## How this was checked

- **Routing.** Every route in `src/main.jsx` was traced to the component it renders.
- **Import graph.** A script followed every static, dynamic and re-export import from each real entry point: `index.html`, the three calculator pages, `vite.config.js`, each Vercel function in `api/`, the Node scripts and the tests. It reports files nothing reaches and exports nothing imports.
- **Unused variables.** A Babel scope analysis did the same job as ESLint's `no-unused-vars`. The project has no linter configured.
- **Pruning.** On a scratch copy of `CandidApp.jsx`, the unreachable route branches were removed, then every top-level declaration nothing referenced any more was pruned repeatedly, until nothing changed. This measures exactly how much code is dead.
- **Reading and pattern sweeps.** I read the API routes, the app shell and the larger mobile screens, and swept for risky patterns: `.then` without `.catch`, effects and timers, `console.log`, secrets, duplicated helpers and hard-coded colours.

### Baseline (before any change)

| Check | Result |
|---|---|
| `npm test` | 424 tests, 424 pass |
| Characterisation test (new, see below) | 1 test, pass. Snapshot of 17 profiles × 2 rate states × 29 engine outputs |
| `npm run build` | Passes when run through bash, as Vercel does. One warning: main chunk 1,261 kB (372 kB gzip) |
| Rendered UI snapshot | 1,913 screens rendered to HTML with no errors, plus a second pass with every boolean state forced on (tiles open) |
| Linter | None configured |

The rendered UI snapshot is a scratch harness, not part of the repo. It server-renders every `/app/*` route and every marketing page for each test profile (open, paywalled and newcomer variants), plus each module screen, the Property steps and Assist with savings rates loaded. Each run is byte-identical, so any change in rendered output shows up as a diff.

## Where things stand (15 October 2026)

All 18 stages are done, and none is committed. Each is a patch in `refactor-stages/`. Applied in order, they reproduce the working tree exactly; reverted in reverse order (q back to a), they restore the starting tree exactly. Round 1 (a to e) ran on 14 October. Round 2 (f to q) followed your decisions on 15 October.

| Stage | Done | Files | Tests | Main JS bundle | Renders | API scenarios |
|---|---|---|---|---|---|---|
| (a) Dead code | DEAD-1 to 6, DEAD-8, DEAD-9; PERF-1; BUG-7 went with dead output | 18 | 425/425 | 1,261 → 991 kB | 0 differ | — |
| (b) Consistency | DEAD-10, QUAL-11, QUAL-12 | 12 | 425/425 | Byte-identical | 0 differ | — |
| (c) Duplication | QUAL-3 (`useElementWidth`), QUAL-4 | 6 | 425/425 | 990 kB | 0 differ | — |
| (d) Splitting | QUAL-7 (`moduleProducts.js`), QUAL-8 (`FeedbackAdmin.jsx`), QUAL-9 sub-component moves | 14 | 425/425 | 990 kB | 0 differ | — |
| (e) Bugs | BUG-1, BUG-2 | 1 | 425/425 | 990 kB | 0 differ | — |
| (f) Security | SEC-1, SEC-2, SEC-4, SEC-5, SEC-6 | 5 | 425/425 | — | 0 differ | 52/60 same; 8 changed as intended |
| (g) API helpers | QUAL-5 (`server/http.js`), BUG-5, BUG-6 | 8 | 425/425 | — | 0 differ | 57/60 same; 3 fixed |
| (h) Dead code 2 | DEAD-11 to 16: `aiPrompt.js`, the dormant "Edit answers" rerun, `assets/fonts`, `api/test.js`; docs to `docs/`, hand-run SQL to `supabase/hand-run/`; new README | 166 (122 fonts, 22 moves) | 424/424 (F11 went with `aiPrompt.js`) | — | 0 differ | 59/60 same (`/api/test` gone) |
| (i) Supabase | QUAL-6 (`lib/supabase.js`), QUAL-15 (`lib/reportRow.js`, `useReportRow.js`), BUG-3, BUG-4 | 7 | 424/424 | — | 0 differ | Requests: 11/11 identical |
| (j) Token imports | QUAL-1: 64 files import from the real sources; `NavBar.jsx` and `PillSlider.jsx` get their own files; circular import gone | 68 | 424/424 | 989 kB | 0 differ | — |
| (k) Performance | PERF-2 (app lazy-loaded), PERF-3 | 2 | 424/424 | **989 → 498 kB** (gzip 301 → 163); app 414 kB on its own | 0 differ | — |
| (l) Colour tokens | QUAL-2: 101 literals in 28 files; new `ERROR_TEXT` token | 29 | 424/424 | — | 0 differ | — |
| (m) Site folder | QUAL-10: `src/mockups` → `src/site`, `New*` prefixes dropped | 15 | 424/424 | — | 0 differ | — |
| (n) Storage errors | QUAL-14: one reporter, `lib/storage.js` | 14 | 425/425 (+1) | — | 0 differ | — |
| (o) Component bodies | QUAL-9: 14 sections extracted from 6 components | 6 | 425/425 | — | 0 differ (both passes) | — |
| (p) Types | TYPE-1: `lib/types.js`, with a test that keeps it current | 5 | 427/427 (+2) | — | 0 differ | — |
| (q) Build script | BUG-9: `npm run build` works on Windows | 2 | 427/427 | `dist/` byte-identical | 0 differ | — |

Line counts, before → after: `CandidApp.jsx` 6,831 → 841 (its `AppShell` component is 677); `main.jsx` 441 → 335. Main components: Pension deep dive 569 → 286; Forecast 306 → 60; Student loan 293 → 66; Rent vs buy 300 → 105. Across `src/`, `api/` and `server/` (excluding tests), 26,844 → 21,208 lines.

Still open:
- **SEC-3**, the email in TrueLayer's `state`: waiting on your answer to the proposal (Redis `nonce → email`, and the identity to come from the subscription token when the flow is built out).
- **QUAL-13**: merging the two "is the screen wide" checks would change the Assist panel on a pinch-zoomed tablet; left as it is unless you say otherwise.
- **QUAL-16**, line endings: wasn't in the approved range.
- **QUAL-9, further:** the app shell (677 lines, mostly effects that depend on each other's order), Candid Assist's walk-through and the onboarding step, which already reads as one block per step, were left as they are. Splitting them further would mostly pass props through.
- **BUG-8**: no change, by design.

Everything below is the audit as written on 14 October.

## Headline counts

| Category | Findings | Fix now (low risk, output unchanged) | Needs your decision |
|---|---|---|---|
| Security hygiene | 11 | 0 | 6 (the rest are informational) |
| Bugs and error-handling gaps | 9 | 3 | 5 |
| Dead and redundant code | 16 (1 withdrawn) | 9 | 5 |
| Code quality and consistency | 16 | 7 (QUAL-13 then skipped) | 8 |
| Performance | 3 | 1 (follows from dead-code removal) | 1 |
| Types and structure | 1 | 0 | 1 |
| **Total** | **56** | **20** | **26** |

## The 5 highest-impact findings

1. **About 5,800 lines of unreachable code (DEAD-1, DEAD-2, DEAD-3).** `main.jsx` redirects the old desktop routes (`/dashboard`, `/modules`, `/forecast`, `/chat`, `/module/:key`, `/assessment/:step`) before they reach `AppShell`. Every branch in `AppShell` for those paths, and the whole desktop report they render, can never run. That includes `callClaude`, which still posts to `/api/claude`, deleted in b9dfe16. `CandidApp.jsx` goes from 6,831 to about 1,430 lines. `src/pdf/` and four npm dependencies are also unused.
2. **The TrueLayer routes write cookies, the CSRF nonce and the user's email to Vercel logs (SEC-1, SEC-2, SEC-3).** These are "temporary diagnostic" lines that were never removed. The email also travels inside the OAuth `state` parameter.
3. **`assessment_abandoned` has never fired on page close since the app moved to `/app/*` (BUG-1).** The listener still checks for `/assessment/`, so your abandonment numbers for the questions are missing this event.
4. **Design tokens are imported through `CandidApp.jsx` in about 65 files (QUAL-1).** This creates a circular import, `CandidApp.jsx` ↔ mobile screens, that four files carry warning comments about. It is also why the marketing site downloads the entire app (PERF-2).
5. **Two Supabase writes bypass the guarded helper (BUG-3).** `modules_completed` (in `AppShell`) and `returned` (in `main.jsx`) are PATCHed by hand. Failures aren't reported to PostHog and a missing row isn't detected: the same class of silent failure that lost 28 reports between August and September.

---

## 1. Security hygiene

No leaked secret was found. Every tracked file was scanned for Stripe, Anthropic, Resend, AWS, GitHub, Google and JWT key patterns and private keys, and `.env*` files have never been committed. The only key-shaped string is a PostHog project key (`phc_…`) in `.claude/settings.json`. Those keys are public by design: the same key ships in the client bundle.

| ID | Location | Issue | Proposed fix | Risk | Could change output? |
|---|---|---|---|---|---|
| SEC-1 | `api/truelayer/callback.js:104-119` | "Temporary diagnostic" logs write the raw Cookie header (every cookie on the domain, PostHog's included), the `tl_state` CSRF nonce, the decoded state including the **user's email**, and nonce comparisons to Vercel logs. | Delete the six `console.log` lines. Keep the `console.error` on failure. | Low | No user output; logs only. **Needs your OK (Open Banking).** |
| SEC-2 | `api/truelayer/auth-link.js:50-53` | Logs the full auth URL, which contains `state` (with the email) and the redirect URI. | Delete the two lines. | Low | Logs only. **Needs your OK (Open Banking).** |
| SEC-3 | `api/truelayer/auth-link.js:35-36` | The user's email is put into OAuth `state` (base64, not encrypted), so it passes through TrueLayer, the browser URL and history. | Keep email-to-nonce server-side (for example in Redis, keyed by nonce), or drop the email until refresh-token storage is built. | Medium | Changes the connect flow. **Needs your decision.** |
| SEC-4 | `api/truelayer/stage-payment.js:135,187`; `api/rates.js:314` | Internal error text (`e.message` from TrueLayer, Supabase or Stripe) is returned to the browser in `detail` / `error`. | Log the detail and return a generic message. | Low | Changes error responses. **Needs your OK (Open Banking / admin).** |
| SEC-5 | `api/billing.js:83,177` | `crypto.timingSafeEqual` throws `RangeError` when a token or signature has the right string length but multi-byte characters, so a malformed token gives a 500 rather than "not signed in". | Compare `Buffer` byte lengths before `timingSafeEqual`. | Low | Only the response to a malformed token. **Needs your OK (payments).** |
| SEC-6 | `api/billing.js:253-256` | The sign-in-link limiter is keyed on IP + email (3 an hour). Someone rotating IPs can send many sign-in emails to one subscriber. | Add a per-email limit (for example 5 a day) alongside the IP one. | Low | **Needs your OK (payments / auth).** |
| SEC-7 | `api/feedback.js:74-81`, `api/rates.js:253-261`, `api/truelayer/stage-payment.js:115-120` | Rate limiters fail open if Redis errors, and feedback, rates and billing run with no limit at all if the Upstash env vars are missing. `stage-payment` alone fails closed. | Decide per route. For the admin password routes, failing closed is safer. | Low | Informational. |
| SEC-8 | `api/truelayer/auth-link.js`, `callback.js`, `session-data.js` | No rate limiting on the TrueLayer connect routes. The callback performs a token exchange per call. | Add the shared IP limiter (sandbox only today). | Low | Informational. |
| SEC-9 | All `api/*` `isAllowedOrigin` / `ourOrigin` | The Origin/Referer allow-list stops cross-site browser calls, but any non-browser client can set those headers. The real protections are the admin password, signed billing tokens and the Stripe signature. Those are in place. | No change. Don't rely on the origin check as authentication. | Low | Informational. |
| SEC-10 | `api/feedback.js`, `api/rates.js` | One password (`FEEDBACK_ADMIN_PASSWORD`) guards both admin pages. | Optional: separate passwords. | Low | Informational. |
| SEC-11 | `src/lib/unlock.js`, `src/lib/entitlement.js` | The paywall is decided in the browser, so it can be bypassed (already known: "Phase 2" in your Stripe notes). | As planned: serve module answers from the server. | Low | Informational. |

## 2. Bugs and error-handling gaps

| ID | Location | Issue | Proposed fix | Risk | Could change output? |
|---|---|---|---|---|---|
| BUG-1 | `src/CandidApp.jsx:5634, 5698` | `assessmentStepNum` and the `pagehide` listener test `pathname.startsWith("/assessment/")`. The app has lived at `/app/assessment/` since the legacy routes became redirects, so `assessment_abandoned` (reason `page_unload`) never fires. | Test `/app/assessment/` in both places. | Low | No UI change. PostHog starts receiving the event again. **Stage (e).** |
| BUG-2 | `src/CandidApp.jsx:6068-6077` | When someone with an old AI report has reviewed every module, a timer sets `feedbackOpen` and sends `feedback_modal_shown`. The feedback modal only rendered on the removed desktop routes, so the event is recorded for a modal nobody sees. | Remove the effect, and the now-unused `feedbackOpen` / `feedbackFired`. | Low | No UI change. Stops a false PostHog event. **Stage (e).** |
| BUG-3 | `src/CandidApp.jsx:5718` (`supaUpdate`, used by `markModuleComplete`); `src/main.jsx:313` (`returned`) | Hand-written PATCHes to `test` skip `supaUpdateRow`: no `supabase_operation_failed` report, no detection of a missing row (a PATCH matching nothing still "succeeds"), and the row id isn't URL-encoded. | Route both through `supaUpdateRow` (moved into a shared `src/lib/supabase.js`). | Medium | Request shape changes (`select=id`, `return=representation`). **Needs your OK (Supabase writes).** |
| BUG-4 | `src/CandidApp.jsx:6213-6215` (`insertReportRow`) | Two `localStorage.getItem` calls sit outside any try/catch. With storage blocked, the insert throws before it is sent: an unhandled rejection, and no row. | Wrap both reads, falling back to `null`. | Low | In that edge case a row would now be written. **Needs your OK (Supabase writes).** |
| BUG-5 | `api/truelayer/callback.js:23`, `session-data.js:16` | `decodeURIComponent` in `parseCookies` throws `URIError` on a malformed cookie, outside the try/catch, so the request fails with an unhandled 500. | Guard the decode. | Low | **Needs your OK (Open Banking).** |
| BUG-6 | `api/rates.js:244-248` | The cron branch calls `runRefresh()` with no try/catch. A Supabase failure becomes an unstructured 500. | Wrap it and log `[api/rates] cron run failed`. | Low | Changes the failure response only. **Needs your OK** (the route writes rates to Supabase). |
| BUG-7 | `src/CandidApp.jsx` `getModuleProducts("investments")` | The ISA countdown builds 5 April at local midnight and rolls to next year once `now` passes it, so on 5 April (the last day of the tax year) it would say about 365 days. | **Not visible**: no screen reads that heading or subheading. Removed as dead output in DEAD-4. | Low | No. |
| BUG-8 | `src/CandidApp.jsx:6258-6271` | Stale closure: the access-check effect reads `d.email` from the first render. Harmless in practice (it only fills an empty email). | No change. Noted. | Low | No. |
| BUG-9 | `package.json` `build` | The `for f in *.html` copy loop is bash syntax and fails under Windows `cmd` ("f was unexpected at this time"), so `npm run build` doesn't work locally on this machine. Vercel (Linux) is fine. | Move the copy step into a small Node script. | Low | Changes the build command Vercel runs. **Needs your OK.** |

Also checked and fine: the Supabase helpers `supaInsert`, `supaSelect` and `supaUpdateRow` catch every failure and report it. `checkAccessOnLoad` and `signInWithLink` handle their own errors. Every `addEventListener`, `ResizeObserver`, `IntersectionObserver`, interval and timeout in an effect is cleaned up. The two un-cleared `setTimeout`s that reset animation state (`MobileModuleDeepDive`, `MobileModulesScreen`) are harmless in React 18.

## 3. Dead and redundant code

| ID | Location | Issue | Proposed fix | Risk | Could change output? |
|---|---|---|---|---|---|
| DEAD-1 | `src/CandidApp.jsx` | About 5,400 unreachable lines. These are the desktop report screens (`HomeScreen`, `ModulesScreen`, `ForecastScreen`, `ChatScreen`, the 2,000-line desktop `ModuleDeepDive`, `OnboardingScreen`/`OnboardingStep`, `LoadingScreen`, `FeedbackModal`, `PdfReportModal`, `ScoreRing`, `ScoreDetailSheet`, `FmtInput`, `Toggle`, `PageWrap`, `ContentWrap` and their helpers). Also the `AppShell` route branches and handlers for the old paths: `generateDashboard`, `callClaude`, `openModule`, `addModule`, `resetAll`, `clearSavedData`, three `/dashboard`-only effects and nine pieces of state. 139 declarations and imports in all. | Delete. The file keeps the Supabase helpers, `getModuleProducts`, `PillSlider`, `NavBar`, the saved-data loaders and the live `AppShell`. | Low | No. Routes verified, plus build and render snapshot. **Stage (a).** |
| DEAD-2 | `src/pdf/ReportPdf.jsx`, `reportData.js`, `fonts.js` | Unreachable: their only consumer, `api/generate-report-pdf.js`, was deleted in b9dfe16. | Delete. | Low | No (no PDF is generated today). **Stage (a).** |
| DEAD-3 | `package.json` | `@react-pdf/renderer` (only `src/pdf`), `@supabase/supabase-js` (the code uses REST over `fetch`), `@fontsource/dm-sans` and `@fontsource/playfair-display` (fonts load from Google Fonts in `index.html`) are imported nowhere. | `npm uninstall` all four. | Low | No. **Stage (a).** |
| DEAD-4 | `src/CandidApp.jsx` `getModuleProducts` | Only `"cash"`, `"investments"` and `"pension"` are ever passed, so the `studentLoan`, `mortgage` and `default` cases are dead. So are fields nothing reads: investments' and pension's `heading` and `subheading`, cash's `subheading`, and `appIcon` on cash rows. This includes BUG-7 and the mortgage list's "Candid may earn a referral fee" line, which contradicts "Candid isn't paid by any provider". | Delete the dead cases and fields. | Low | No. **Stage (a).** |
| DEAD-5 | 11 files | Unused imports: `main.jsx` (`PageWrap`, `ContentWrap`), `lib/assist.js` (`FSCS_DEPOSIT_LIMIT`), `lib/metrics.js` (`calcIncomeTax`), `lib/moduleReveal.js` (`LSA_INFLECTION_POT`), `MobileCashDeepDive` and `MobileStudentLoanDeepDive` (`OPPORTUNITY_TILE_BODY`), `MobilePensionDeepDive` (`fmtK`), `MobileProductListTile` (`WHITE`), `MobileHomeScreen` (`fmtCompact`), `api/rates.js` (`rowFields`). | Delete. | Low | No. **Stage (a).** The three engine files are covered by the characterisation test. |
| DEAD-6 | `MobileModuleDeepDive.jsx:78` and four deep dives | `onShowReveal` is passed to every module's content but used only by the shell itself. `insights` is passed down and used by none of the four. | Stop passing them; drop the unused props. | Low | No. **Stage (a).** |
| ~~DEAD-7~~ | `src/mockups/NewLandingPage.jsx:82` | **Withdrawn: false positive.** The analysis flagged the inner function name of `const Tile = forwardRef(function Tile…)`. `Tile` itself is used at line 369. | None. | | |
| DEAD-8 | `src/CandidApp.jsx:51-57` | The re-exports "for src/pdf/reportData.js" (`fmt`, `fmtK`, `calcCashOptimisation`, …) have no other consumer. Only `MODULE_META`, `calcMetrics`, `computeModuleStatuses` and `sanitizeForMvp` are imported through here (by `DevTools` and the mobile screens). | Keep those four and delete the rest. | Low | No. **Stage (a).** |
| DEAD-9 | `src/CandidApp.jsx:6198-6219`, `CandidApp.jsx:6334` | Dev-only debug `console.log`s ("Supabase insert starting/complete", "Metrics sent to Claude"). | Delete (the second goes with DEAD-1). | Low | No (already stripped from production). **Stage (a).** |
| DEAD-10 | `src/mobile/assist/AgentPanel.jsx:63` | `border: bg === "none" ? "none" : "none"`, a ternary with identical branches. | `border: "none"`. | Low | No. **Stage (b).** |
| DEAD-11 | `src/lib/aiPrompt.js` (169 lines) | The AI report's prompt and fallback builders. Since DEAD-1 only tests use them (`audit.test.js` and the characterisation test). | **For your review**: delete with its tests, or keep if the AI narrative may return. | Low | No. |
| DEAD-12 | `CandidApp.jsx` `moduleRerun`; `MobileModuleDeepDive` `onWalkThrough` | The "Edit answers" rerun of a module walk-through is dormant. `moduleRerun` is never set to a module, and the only caller passes `onWalkThrough={null}` (since d65d8b0 moved editing to Edit inputs). | **For your review**: delete, or keep for a return of "Edit answers". | Low | No. |
| DEAD-13 | `assets/fonts/` (122 files, 9.3 MB), `assets/Images/Candid.png` | Only the dead PDF code references them. Not part of the build. | **For your review**: they may be brand assets you use elsewhere. | Low | No. |
| DEAD-14 | `api/test.js` | A public `{ ok: true }` endpoint with no caller in the repo. | **For your review**: delete unless an uptime check uses it. | Low | Removes an API route. |
| DEAD-15 | Repo root | 12 hand-run `supabase_*.sql` / `savings_rates_migration.sql` files sit beside `supabase/migrations/`, plus about 15 planning `.md` files. `README.md` still describes a Tally feedback form and a first deploy. | **For your review**: move SQL into `supabase/` and planning notes into `docs/`, and rewrite the README. | Low | No. |
| DEAD-16 | `scripts/personas/engine.js:453, 512` | Unused locals `p` and `taxFree` in the investor model. | Leave (outside the app; the model's own tests pass). | Low | No. |

Exports that only tests import (for example `pensionReveal`, `checkEmployerMatch`, `UNLOCK_QUESTIONS`) are used inside their own module too, so they aren't dead. They're left alone.

## 4. Code quality and consistency

| ID | Location | Issue | Proposed fix | Risk | Could change output? |
|---|---|---|---|---|---|
| QUAL-1 | About 65 files in `src/mobile`, `src/mockups`, `src/admin`, `src/CookieNotice.jsx`, `src/DevTools.jsx` | Design tokens are imported from `CandidApp.jsx`, which re-exports `design-tokens.js`. This makes a circular import (`CandidApp.jsx` → screens → `CandidApp.jsx`), and four files (`BorrowingCheck`, `DecisionWaterfall`, `StickySummaryBar`, `MobileOnboardingStep`) carry comments about the load-order errors it causes. `AgentPanel.jsx` already imports `design-tokens.js` directly. | Import tokens from `design-tokens.js`, `MODULE_META` from `lib/moduleStatus.js`, `topRate` from `lib/savingsRates.js`, and `NavBar`/`PillSlider`/`getModuleProducts` from their own small files. Then drop the re-exports. | Low per file | No. **Touches about 65 files. Needs your OK.** |
| QUAL-2 | About 20 files | Colour literals equal to existing tokens: `#2d6b4a` = `SUCCESS` (39 uses, 10 files), `#ede7db` = `CDARK` (23 uses, 12 files), `#c0392b` = `CRITICAL` (22 uses, 7 files), `#b3261e` = `paymentErrorText` (14 uses, 6 files). | Use the tokens (`ErrorBoundary` keeps its literals on purpose). | Low | No. **Touches about 20 files. Needs your OK.** |
| QUAL-3 | `MobileForecastScreen`, `MobileStudentLoanDeepDive`, `property/MortgageStep`, `property/RentVsBuyStep` | Four identical copies of "measure the chart's width with a ResizeObserver" (`clientWidth || fallback`). | A shared `useElementWidth(ref, fallback, deps)` hook in `src/mobile/useElementWidth.js`. `GainedFromChanges` measures differently (rounded `contentRect`), so it stays as it is. | Low | No. **Stage (c).** |
| QUAL-4 | `src/CandidApp.jsx` (`AppShell` router) | The "‹ Modules" header button is written out four times, and `window.scrollTo({ top: 0, behavior: "instant" })` seven times. | One `modulesBackButton` element and one `scrollToTop()` helper. | Low | No. **Stage (c).** |
| QUAL-5 | `api/billing.js`, `feedback.js`, `rates.js`, `truelayer/*` | `ALLOWED_HOSTNAMES` (×5), the origin check (×4), client IP (×3), `parseCookies` (×2), `COOKIE_DOMAIN` (×3) and Redis/Ratelimit set-up (×4) are copied between routes. | A shared `api/_lib/http.js` (Vercel doesn't deploy `_`-prefixed files as functions). | Medium | No. **Touches payments and Open Banking. Needs your OK.** |
| QUAL-6 | `CandidApp.jsx`, `main.jsx`, `lib/savingsRates.js` | Three ways of calling Supabase REST from the browser, each with its own error handling (see BUG-3). | One `src/lib/supabase.js` with `insert`, `select` and `updateRow`. | Medium | **Supabase writes. Needs your OK** (with BUG-3). |
| QUAL-7 | `src/CandidApp.jsx` `getModuleProducts` | Provider lists, with hand-typed fees, live in the app shell. | After DEAD-4, move them to `src/mobile/moduleProducts.js` beside the tiles that show them. | Low | No. **Stage (d).** |
| QUAL-8 | `src/main.jsx:172-271` | The feedback admin page (100 lines) sits in the bootstrap file, while the rates admin has its own file. | Move it to `src/admin/FeedbackAdmin.jsx`, imported the same way (not lazy, so nothing changes). | Low | No. **Stage (d).** |
| QUAL-9 | Large components | `MobilePensionDeepDive` 825 lines (main component 569), `CandidAssist` 602 (342), `RentVsBuyStep` 583 (300), `MobileOnboardingStep` 472 (377), `BorrowingCheck` 425, `MobileStudentLoanDeepDive` 377 (311), `MobileForecastScreen` 366 (306). | First, move the self-contained sub-components out to their own files. This is safe and is checked by the open-tiles render. Then split the main bodies tile by tile, one component per change, each verified against the render snapshot. | Medium | No if verified. **Stage (d): sub-component moves now; body splits proposed per file.** |
| QUAL-10 | `src/mockups/` | The live marketing site sits in a folder called `mockups`, with stale `New` prefixes (`NewLandingPage`, `NewSiteHeader`, `NewSiteLayout`). | Rename to `src/site/` and drop the prefixes. | Low | No. **Touches about 14 files. Needs your OK** (recently verified nav work). |
| QUAL-11 | `src/main.jsx:273-284`, plus comments across mobile files | The block describing `RootRoute` sits above `LegacyRedirect`. Many comments describe the deleted desktop UI ("as desktop's ring did", "every desktop call site omits it"). | Move or reword the comments that DEAD-1 makes wrong. | Low | No. **Stage (b).** |
| QUAL-12 | `src/CandidApp.jsx:17` | `ASSIST_MODULE_LABELS` is declared between `import` statements. | Move it below the imports. | Low | No. **Stage (b).** |
| QUAL-13 | `CandidAssist.jsx:267-272` vs `RentVsBuyStep.jsx:134-145` | Two ways of asking "is the screen wide": `resize` + `innerWidth` against `matchMedia`. | **Not done.** They differ under pinch-zoom: iOS's `innerWidth` follows the zoomed viewport, while media queries don't. Merging them could change the Assist panel's layout on a zoomed tablet. | Low | Yes, in that edge case. **Left as is.** |
| QUAL-16 | Working tree | Line endings are mixed (about 40 files LF, the rest CRLF). Git normalises them on commit (`core.autocrlf=true`), so nothing breaks, but editors and scripts see both. | Add a `.gitattributes` with `* text=auto eol=lf` and renormalise once. | Low | No. **Needs your OK** (touches every file once). |
| QUAL-14 | `main.jsx`, `CandidApp.jsx`, `lib/*` | localStorage errors are handled three ways: reported to PostHog (`reportStorageFailure`), a dev-only warning, or silently swallowed. | Pick one (report and continue). | Low | Adds PostHog events. **Needs your decision.** |
| QUAL-15 | `src/CandidApp.jsx` `AppShell` (about 700 lines after DEAD-1) | Row saving runs through three "tick" counters (`rowSaveTick`, `unlockSaveTick`, `accessTick`) and 20 effects in one component. | Extract a `useReportRow()` hook holding the insert/patch logic. | Medium | **Supabase writes. Needs your OK.** |

## 5. Performance

| ID | Location | Issue | Proposed fix | Risk | Could change output? |
|---|---|---|---|---|---|
| PERF-1 | Build | The main chunk is 1,261 kB (372 kB gzip). Rollup can't drop the desktop UI, because the dead route branches still reference it. | DEAD-1 removes it. **Stage (a).** | Low | No. |
| PERF-2 | `src/main.jsx:6` | `main.jsx` imports `CandidApp.jsx` statically, for `NavBar` and tokens, so a visitor to the marketing site downloads the whole app and every module screen. | After QUAL-1, `React.lazy` the app shell the same way the marketing pages already are. | Low | Opening `/app` shows nothing for the moment its chunk loads, as the marketing pages do today. **Needs your OK.** |
| PERF-3 | `MobileForecastScreen.jsx:100-102` | `calcForecast`, `calcForecastSeries` and `buildForecastAssumptions` run on every render, including chart re-measures. | `useMemo` on their inputs. | Low | No. Optional. |

## 6. Types and structure

| ID | Location | Issue | Proposed fix | Risk | Could change output? |
|---|---|---|---|---|---|
| TYPE-1 | Everywhere | No TypeScript or PropTypes. The inputs object `d` (about 150 fields, mostly numbers stored as strings and coerced with `+x\|\|0`), the `calcMetrics` output `m` and `statuses` have no written shape. `BLANK_DATA` in `CandidApp.jsx` is the nearest thing to one. | Add JSDoc `@typedef`s for `d`, `m` and `statuses` in `src/lib/types.js` and reference them from the engine functions. A later step is `// @ts-check`. | Low | No. **Needs your decision** (adds a file and comments). |

## 7. Finance engine

No engine logic or constant was changed. The new characterisation test (`src/lib/characterisation.test.js` with `characterisation.snapshot.json`) runs 17 profiles through every engine function the app shows figures from, with and without savings rates loaded, and compares every value exactly. The profiles cover the Dev Tools presets, the £100k taper, £240k, self-employed, Plans 1, 2, 4, 5 and postgraduate, near and past retirement, flat cash, an unknown pension, buying alone and together, and the hidden modules. Rebuild the snapshot only after a deliberate engine change: `CHARACTERISATION_UPDATE=1 npm test`.

Out of scope here and not changed, but worth your eye:

- The cash rate lists still sort by rate and badge the first row "Highest rate" (`getModuleProducts("cash")`, shown by `MobileProductListTile`). The investment and pension lists were made neutral in b9dfe16.

---

## Staged plan

Each stage is its own set of changes, saved as a patch in `refactor-stages/` so it can be reviewed or reverted alone. After every stage: `npm test` (including the characterisation test), the production build, and both render snapshots, which must match the baseline exactly.

| Stage | Contents |
|---|---|
| (a) Dead code | DEAD-1 to DEAD-9; PERF-1 |
| (b) Consistency and naming | DEAD-10, QUAL-11, QUAL-12 |
| (c) Duplication | QUAL-3, QUAL-4, QUAL-13 |
| (d) Component splitting | QUAL-7, QUAL-8, QUAL-9 (sub-component moves) |
| (e) Bug fixes | BUG-1, BUG-2 |

Waiting for your decision: SEC-1 to SEC-6, BUG-3 to BUG-6, BUG-9, DEAD-11 to DEAD-15, QUAL-1, QUAL-2, QUAL-5, QUAL-6, QUAL-10, QUAL-14, QUAL-15, QUAL-16, PERF-2 and TYPE-1. Also proposed: splitting the main bodies of the large components (QUAL-9), one tile per change, each checked against the render snapshot.

The characterisation snapshot (`src/lib/characterisation.snapshot.json`) is 1.9 MB, mostly 25- and 30-year forecast series. If that's too big to commit, the horizons in the test can be shortened before you commit it.
