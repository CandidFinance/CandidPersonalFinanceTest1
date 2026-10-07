# Candid: from comparison to doing the work

Workplan, 7 October 2026. Combines the review of the agentic Cash & Savings plan with the strategy response to Bain Capital Ventures' "the classic software startup isn't being born anymore" thesis.

Items marked **(verify)** are my understanding at the time of writing, not confirmed facts. Check them before relying on them.

---

## 1. The thesis

- **What wins:** companies that sell the work itself, not tools for the people who do it. For Candid, the "work" is what a financial adviser, a mortgage broker, or someone with a free weekend would do: find the money, then move it.
- **An agent is not the same as an LLM.** Candid becomes an agent when it **watches** your money, **notices** when something changes, and **does** the work. Most of that is deterministic code; the LLM is a small part, mostly for wording.
- **Candid already has the hard part:** a calculation engine people can trust, the Candid score, and opportunities ranked by £. The agent is an execution layer on top of that.
- **Pitch line:** "Candid is the financial adviser most people can't afford. It finds the money and moves it." The market is the advice gap (most UK adults never pay for advice), not a software budget.
- **Business model:** paid on outcomes, not seats. Commission on a completed move, or a share of the first year's gain. The fronted-payout idea (section 6) is a version of this.

## 2. Regulatory map by module

| Module | Can Candid act on the user's behalf today? | Route |
|---|---|---|
| Cash & Savings | Yes, within limits. Advice on simple deposits isn't a regulated activity **(verify with compliance)** | Build it: monitoring, plus moving money between accounts the user holds |
| Student Loan | Mostly information already; little to execute | Monitoring only |
| Pension | No. Consolidation or transfers are regulated | Partner hand-off, or authorisation later |
| Investments | No. ISA transfers and arranging deals are regulated | Partner hand-off, or authorisation later |
| Property | No. Mortgage broking is regulated | Refer to an authorised broker |

**Decision to make (before changing any product copy):** an hour with a compliance consultant on:
- [ ] An appointed representative (AR) arrangement under a principal firm
- [ ] The FCA's targeted support regime, which came out of the Advice Guidance Boundary Review: where the rules have landed and what permission it needs **(verify current status)**
- [ ] Whether the fronted payout (section 6) counts as credit if it's clawed back
- [ ] Rules on financial promotions for deposit comparisons
- [ ] What Candid's role is under TrueLayer: agent, or client using TrueLayer's permissions

**Guardrail until then:** the "no directive advice" rule stays. List opportunities by £; never say "start with X", never give numbered steps, never say "we recommend". Compare: "Option A has the highest 12-month net figure."

## 3. Product corrections to the original plan

- [ ] **Open Banking can't switch accounts.** A current-account switch through CASS (the Current Account Switch Service) is started by the user at the new bank, after that bank's identity checks. Opening a savings account works the same way. Drop "auto-switch" from all copy.
- [ ] **What Open Banking can do:** move money into an account the user already holds. Reframe the product as "one tap moves your savings into an account you've opened".
- [ ] **Explore a savings platform partnership** (Raisin, Flagstone, Hargreaves Lansdown's cash platform). One identity check, then money moves between banks inside the platform, which makes the one-tap switch real. Do this before building switching ourselves.
- [ ] **Sweeping VRP** (Variable Recurring Payments between the user's own accounts) lets repeat moves happen without the user authorising each one. The CMA9 banks are required to support it **(verify which banks and TrueLayer's support)**. This is the right tool for the "agentic" loop.
- [ ] **CASS bonuses and savings rates are separate products.** Calculate them as separate options, not one formula.

## 4. Phase 0: fix before anything goes live

These block Phase 1.

- [ ] **The payment button is public.** It sits in onboarding's Cash step (`src/mobile/onboarding/MobileOnboardingStep.jsx`, and `src/CandidApp.jsx`). Hide it unless the server says live payments are allowed for this user.
- [ ] **The amount is fixed at £2,500, with a hard-coded payee** (`api/truelayer/stage-payment.js`). Switching only the base URLs to live would let any visitor stage a real £2,500 payment. Use a separate live setup with a £10 ceiling.
- [ ] **Connections are keyed by an email anyone can supply** (`api/truelayer/auth-link.js`). The callback upserts on it, so anyone can overwrite another person's stored token. Tie connections to a signed-in user. **The app needs sign-in before Phase 2.**
- [ ] **Diagnostic logs write cookies and emails to the logs.** Remove them from `auth-link.js` and `callback.js`.
- [ ] **Refresh tokens are stored in plain text.** Encrypt them at rest, in a table only the service role can access.

## 5. Phase 1: founder dogfooding (N = 1)

**Prerequisite:** TrueLayer probably enables Live only after its onboarding and KYB checks **(verify in the console)**. If so, the old Phase 3 item 1 moves here.

**Environment and credentials**
- [ ] Generate live credentials. The signing key is **EC P-521 (ES512), not RSA.** Register the public key in the Live console; it gets its own `kid`.
- [ ] Add the environment switch (section 9). Run Phase 1 on production, behind a founder-only key. `vercel dev` on localhost can't complete the bank connection today: `APP_ORIGIN` and `COOKIE_DOMAIN` are fixed to production.
- [ ] Register the live redirect URI and payment return URI in the TrueLayer console.

**Reading data (AIS)**
- [ ] Use `/data/v1/accounts`. It's v1; v3 is the Payments API.
- [ ] Request the `direct_debits` scope. It isn't requested today.
- [ ] **Current rate (R_current):** Open Banking doesn't return it. Ask the user, or estimate it: last month's interest ÷ average balance × 12.
- [ ] **Savings balance (C):** many savings providers aren't on Open Banking, so expect gaps. Fall back to manual entry.
- [ ] **Direct Debit count (D):** use the `/direct_debits` endpoint, falling back to counting Direct Debit transactions. Exclude standing orders.
- [ ] **Pay-in velocity (V):** average per calendar month over 90 days. Handle 4-weekly pay, and record each bank's rules on what counts as a pay-in.
- [ ] Make the account calls in parallel, with a cap. They currently run one after another, which risks the function timeout.
- [ ] Replace the `tl_data` cookie handoff with a server-side store and a one-time ID. Cookies are capped at about 4KB.

**Engine**
- [ ] Calculate CASS and savings options separately (section 7).

**Paying (PIS)**
- [ ] Stage a £10 me-to-me payment to the founder's own second account.
- [ ] Add `/api/truelayer/webhook`:
  - verify `Tl-Signature` against the raw body
  - check the `jku` against TrueLayer's JWKS addresses
  - update the payment's status

## 6. Phase 2: concierge alpha (N = 5 to 20)

- [ ] **Sign-in in place**, with connections tied to the user's ID, not their email.
- [ ] **Confirm with TrueLayer** whose permissions friends connect under.
- [ ] **Comparison cards:** at least 3 options, sortable by net figure, rate and upfront cash. No modal verbs ("should", "recommend").
- [ ] **Footer:** "Candid provides mathematical comparisons and payment staging. We do not provide regulated financial advice."
- [ ] **Fronted payout test** (for example, £350 over 12 months, £150 upfront):
  - [ ] Get a compliance view before launch (section 2).
  - [ ] **Completion check:** no webhook confirms a CASS switch. Infer it from account data (for example, salary arriving at the new bank), then release the payout.
  - [ ] **Bonus hunters:** define how clawback works when a switch is reversed, including bonus-hunting cases.

## 7. Engine specification

12-month net figure, per option:

```
Savings option:   C × (R_target − R_current), after tax, using the rate that applies over 12 months
CASS option:      bonus − anything the user has to give up
Candid fee:       shown separately and disclosed
```

- [ ] Rates are stored as decimals.
- [ ] **Tax:** interest above the Personal Savings Allowance is taxed (£1,000 basic rate, £500 higher, £0 additional), using the tax band Candid already has. Interest inside an ISA is tax free.
- [ ] **Introductory rates:** use the rate that actually applies over 12 months.
- [ ] **Account limits:** withdrawal limits and maximum balances.
- [ ] **FSCS:** the protection limit is per banking licence (£120k) **(verify)**.
- [ ] **Eligibility Open Banking can't see** ("no bonus since 2023", new customers only, app login): ask the user.
- [ ] **Market data:** decide the source, scraped or licensed (Moneyfacts, Defaqto). Show "rates as of" on every comparison.
- [ ] **The Candid fee:** if the bank pays it, it isn't a cost to the user, but disclose it. If the user pays it, say how it's collected.

## 8. Where the LLM fits

- [ ] **Not per user.** "Requires moving 2 Direct Debits (you have 4)" is a template.
- [ ] **When a bank is added:** use Claude to turn the bank's terms into a structured requirements list, with a person checking the output. Use structured output, because scraped pages can contain prompt injection.
- [ ] **If any runtime wording stays:** pass only computed figures, never transactions or personal data, and reject any output containing a number that wasn't in the input.

## 9. Code: switching between sandbox and live

**One config module, `api/truelayer/_config.js`.** Vercel doesn't treat files starting with `_` as routes.
- `TRUELAYER_ENV` is set per Vercel environment. Anything other than `live` means sandbox, so a missing or mistyped value fails safe.
- Credentials are read by prefix (`TRUELAYER_SANDBOX_*` and `TRUELAYER_LIVE_*`), so sandbox keys can never pair with live hosts.
- Live refuses to run outside a production deploy unless `TRUELAYER_ALLOW_LOCAL_LIVE=1`.
- The module returns the hosts (auth, API, hosted payment page, webhook JWKS), the Open Banking providers to offer (`uk-cs-mock` in sandbox, `uk-ob-all uk-oauth-all` in live), and the credentials.

**`stage-payment.js`**
- [ ] **Payment setup per environment.** Never from the client.
  - Sandbox: the mock bank, as now.
  - Live: £10, UK retail banks on general release, Faster Payments only, and the payee from env vars.
- [ ] **Hard live ceiling:** `LIVE_MAX_MINOR = 1000`.
- [ ] **Access in live:** a kill switch (`TRUELAYER_LIVE_ENABLED`) plus the founder key (header compared with `timingSafeEqual`). Replace both with real sign-in in Phase 2.
- [ ] **Rate limiting:** fail closed in live. Today it lets the request through when Redis errors.
- [ ] **Idempotency key:** from a client-generated `intentId` (a checked UUID), so a double tap doesn't stage two payments.
- [ ] **Access token:** cache it per environment until about 60 seconds before it expires.
- [ ] **Reconciliation:** record `{payment_id, env, amount, created_at}` in a table only the service role can access.
- [ ] **Errors:** in live, return a generic error to the client and log TrueLayer's detail on the server.
- [ ] **Response:** include `env`, so the UI can hide the button and stop hard-coding "(Sandbox)".

**`auth-link.js` and `callback.js`**
- [ ] Use `_config.js`. Remove the mock-bank provider and the diagnostic logs.
- [ ] Derive the origin and cookie domain from the request host, or keep Phase 1 on production only.

## 10. Open Banking edge cases

- [ ] **Refresh token rotation:**
  - Save the new refresh token on every refresh.
  - Lock per connection, because two refreshes at once invalidate one of the tokens.
  - Treat `invalid_grant` as "reconnect needed": flag the connection and notify the user. Don't retry.
- [ ] **90-day consent:** reconfirm consent with the user every 90 days, and stop reading data if they don't. Some banks still expire access on their own schedule.
- [ ] **Background reads:** a maximum of 4 a day per account when the user isn't present. Send `X-PSU-IP` when they are, and count cron retries against the cap.
- [ ] **Coverage gaps:** savings accounts, and the Direct Debits endpoint.
- [ ] **Payment webhooks report payment status only.** There's no switch-completion event.

## 11. Phase 3: public launch (N = 100+)

- [ ] **TrueLayer agent registration** with the FCA (if that's the model chosen in section 2). Allow weeks to months.
- [ ] **Monthly monitoring** (Vercel Cron, batched, within the read limits above). It flags facts, not instructions:
  - "Your savings rate fell to 2.1%; the top easy-access rate is 4.6%"
  - "Your ISA allowance resets in 3 weeks"
  - "Your fixed mortgage rate ends in 6 months"
- [ ] **Rate drop alert** when `R_current < R_market_top − 0.75%`. Because R_current comes from what the user entered or from the interest estimate, show the basis.
- [ ] **Alert wording stays factual.** Not "Tap here to auto-switch and capture £140", which is both directive and untrue. Instead: "Your rate is 2.1%. Accounts you hold or could open pay up to 4.6%, about £140 more a year."
- [ ] **Sweeping VRP** for repeat moves between accounts the user holds.

## 12. Candid Assist: the automation widget

**The gap it fills:** today Candid shows the options and then does nothing. Assist walks the user through carrying out the option they choose. It never moves money itself.

**Principle: you choose, Candid does the work.**
1. The engine shows the options, each with its 12-month £ effect.
2. The user picks one.
3. Assist covers the legwork for that choice: the amount, which account the money comes from, a link to the right page, the steps, and a "Done, I've done it" button that updates their data.

This is guidance on carrying out the user's own decision, not advice, so it doesn't depend on the compliance decision in section 2.

**Naming and copy**
- [ ] Don't call it a "robo-advisor". Robo-advice is the FCA's term for regulated automated advice. Working name: "Candid Assist".
- [ ] Use the Candid mark or a Lucide icon, not a robot.
- [ ] No ranking of where leftover cash "should" go. Showing ISA, student loan and savings options side by side with £ effects is fine. Putting them in an order to follow is a financial plan.

**The engine decides; Claude explains**
- [ ] Every walkthrough narrates deterministic engine output. Worked example: cash at 2% against a student loan at 6% looks like "pay off the loan", but most Plan 2 borrowers are written off after 30 years and overpaying gives money away. `src/lib/studentLoan.js` already models this (`SL_WRITE_OFF_YEARS`, `calcOverpaymentScenarios`). When the engine says it doesn't pay, Assist says so and shows why.
- [ ] Mention that money paid to the Student Loans Company can't be taken back, so it reduces the user's emergency cushion.
- [ ] Free-text questions go to Claude with only the user's engine figures. Reject any answer containing a number that wasn't in its input, and fall back to scripted copy.

**The widget**
- [ ] Fixed above the bottom nav, or snapping to either edge. Not freely draggable: on phones it fights scrolling and covers content.
- [ ] **Badge: a small gold dot**, not red. Red is the CRITICAL colour in the RAG system.
- [ ] **What the badge means:** "something changed since you last looked". It must not mean "there are opportunities", which the Home hero already shows (single state indicator rule).
- [ ] **Replaces the "Coming soon" chat** (`src/mobile/screens/MobileChatScreen.jsx`).
- [ ] **Reuses the GuidedFlow pattern from Property:** button answers first, free text as an option.

**Triggers**

| Trigger | When it's possible |
|---|---|
| ISA allowance unused as 5 April approaches; tax year reset | Now, from what the user entered |
| Fixed mortgage rate ending; score or opportunity changed after an edit | Now |
| Market rates changed | Once the rate feed (section 13) exists |
| Paid with cash left over | Once live Open Banking exists (Phases 1 and 2) |

Version 1 works out the badge when the app opens. Push notifications and pay-day detection come later.

**Version 1 scope**
- [ ] The widget, the badge, and the walkthrough shell (GuidedFlow plus grounded free text)
- [ ] Walkthrough: move cash to a higher-rate account
- [ ] Walkthrough: use the remaining ISA allowance before 5 April
- [ ] Walkthrough: student loan overpayment, offered only when the engine shows it pays
- [ ] "Done, I've done it" updates the user's data, and the score and opportunities refresh

## 13. Weekly rate feed

**Approach:** a weekly Vercel Cron job.
1. Fetch a curated list of provider product pages. Fetch them directly; don't let Claude search freely.
2. Claude (Haiku) extracts structured products using a fixed schema.
3. Validate the results.
4. Write them to a Supabase table that anon users can only read.
5. A person reviews the flagged changes.

- [ ] **Provider list:** about 30 to 50 providers that cover the best-buy tables (challengers and platforms included), each with its product page URLs.
- [ ] **Extraction schema:**
  - provider, product, type (easy access, notice, fixed, cash ISA)
  - AER, plus any bonus rate and its end date
  - balance tiers, withdrawal limits, eligibility, app-only flag
  - source URL, fetch date
  - **the exact text snippet supporting each rate**
- [ ] **Validation, in code:**
  - the snippet must appear in the fetched page text
  - AER must be within sane bounds
  - a change of more than 1 point, or a missing product, is held for review rather than published
  - pages whose content hash hasn't changed are skipped
- [ ] **Fetching:** handle JavaScript-rendered pages and bot blocking. Some pages will need a headless fetch or a different URL.
- [ ] **Sources:** don't scrape comparison sites (Moneyfacts, MoneySavingExpert). Their data is licensed, and their terms prohibit it. Use provider pages only.
- [ ] **Display:** show "rates as of <date>" everywhere. Rerun the job when the Bank of England changes the base rate.
- [ ] **Later:** a licensed feed (Moneyfacts or Defaqto data, a savings platform's rates API, or affiliate network feeds) once Candid is earning revenue from it.

## 14. Sequence

| Step | Track | Item |
|---|---|---|
| 1 | Compliance | Consultant hour: AR arrangement, targeted support, fronted payout, TrueLayer role |
| 2 | Phase 0 | Hide button, live ceiling, sign-in plan, logs, token encryption |
| 3 | Partner | Savings platform conversations (Raisin, Flagstone, Hargreaves Lansdown) |
| 4 | Phase 1 | Environment switch, founder dogfood, £10 test, webhook |
| 5 | Assist v1 | Widget, badge, three engine-driven walkthroughs (no regulatory dependency) |
| 6 | Rate feed | Weekly scan, validation, review queue; enables the "rates changed" trigger |
| 7 | Monitoring | Monthly factual alerts across all modules, delivered through Assist |
| 8 | Phase 2 | Sign-in, alpha with friends, fronted payout test |
| 9 | Narrative | Deck rewritten around outcomes and the advice gap, with Assist and Cash as proof |
| 10 | Phase 3 | Agent registration, public launch, VRP |
