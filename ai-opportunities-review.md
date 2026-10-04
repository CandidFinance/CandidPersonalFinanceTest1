# AI opportunities review: Candid

October 2026. Based on the codebase at commit `1325d6b`. Updated 3 October 2026 with answers to follow-up questions and the decisions taken so far. This review is recommendations only; nothing in it has been built, apart from the student loan threshold fix noted below.

**Starting picture, in brief.**
- **Claude** writes the report's words in a single call: a headline, a short narrative, up to 4 priorities and one line per module ([`aiPrompt.js`](src/lib/aiPrompt.js), `callClaude` in `CandidApp.jsx`). Every figure, status and the score are worked out by Candid's own code first.
- **Chat** is a "Coming soon" placeholder.
- **TrueLayer** is sandbox only. It fills in cash balances (with no interest rate) and an estimate of monthly spending.
- **Market data**:
  - Best savings rates and regional rent and house price growth live in two Supabase tables that are updated by hand.
  - The mortgage rate default, income multiples, Premium Bonds return, stamp duty, tax bands, student loan interest rates and the State Pension amount are all fixed in the code.
  - There is no Bank of England data, mortgage rate data or Land Registry data.
- **Reminders** are calendar files created on the user's device. Nothing runs on a schedule on the server.
- **Resend** is in the pipeline.

**Fixed since the first version: student loan repayment thresholds.** The thresholds were two years out of date: £27,295 for Plan 2 and £24,990 for Plan 1. The current gov.uk figures are £29,385 and £26,900, so every Plan 2 user's yearly repayment was overstated by about £188 (£172 for Plan 1). The figures were copied into 9 places across 5 files. They now live in one table, `SL_REPAYMENT_THRESHOLDS` in [`studentLoan.js`](src/lib/studentLoan.js), with a test that pins them. The public [`student-loan-calculator.html`](student-loan-calculator.html) page had the same stale figures and has been updated too, including Plan 4 (£33,795). A real payslip confirmed the problem: its £423 monthly Plan 2 deduction only adds up at the gov.uk threshold for that tax year, not at the one in the code.

**Also fixed: student loan interest rates.** These were checked against gov.uk's "what you pay" page, which carries the 1 September 2026 to 31 August 2027 rates. The per-plan guidance pages were still showing last year's rates.

| Plan | gov.uk 2026/27 | App before | Public calculator page before |
|---|---|---|---|
| Plan 1 | 4.1% | 3.2% (last year's) | 6.25% |
| Plan 2 | 4.1% rising with income, capped at 6% | correct | 3.2–6.2% |
| Plan 4 | 4.1% | not modelled | 6.25% |
| Plan 5 | 4.1% | correct | 7.3% |
| Postgraduate | 6% (capped) | not modelled | 7.3% |

Both the app and the calculator page now match gov.uk, and a test pins the rates.

A lesson for 5b: gov.uk itself can be inconsistent between pages during the September changeover. Each figure in the record needs to name the exact page it was checked against.

---

## Decisions so far (3 October 2026)

| # | Opportunity | Decision |
|---|---|---|
| 1 | Accuracy check | **Plain-code check on every report: agreed.** Profile runs: not yet built. Proposed: the maths checks (free) run every time; a paid AI-text run happens only when Claude Code flags that the report's words could change and you approve (see 1a). Second Claude review per report: optional. |
| 2 | Q&A from the user's numbers | **Agreed in principle.** Before public release it needs a usage cap, prompt caching and Sonnet 5.5. Pre-screening questions is covered in 1b. |
| 3 | Onboarding from a payslip | **Agreed** (see 2a for the worked example). |
| 4 | Public data pipeline | **Approved and prioritised**, including flagging officially announced future changes (see 5a and 5d). |
| 5 | Bank transactions | **Planned for after the move off the TrueLayer sandbox.** |

---

## Top opportunities (highest leverage)

1. **[An automatic accuracy check for every report](#1a-automatic-accuracy-check)**: a free plain-code check on every report that every £ figure in the AI's text comes from Candid's own calculations, plus fixed test profiles that check the maths whenever the engine changes. This protects the one thing a finance product can't get wrong, before users or investors see it.
2. **[Questions answered from the user's own numbers](#1b-questions-answered-from-the-users-own-numbers)**: turn the Chat placeholder into Q&A where Claude calls Candid's existing calculations to answer, so every answer comes from the calculations rather than being made up. It's the most visible AI feature and the most demoable one.
3. **[Fill in onboarding from a payslip or pension statement](#2a-fill-in-onboarding-from-a-payslip-or-pension-statement)**: Claude reads an uploaded document and fills in the fields people least often know (pension type, contribution rates, student loan plan).
4. **[An automatic pipeline for public data](#5a-an-automatic-pipeline-for-public-data)**: official figures fetched on a schedule, a dated record of every fixed figure in the code, and flags for announced changes that will affect a user's plan.
5. **[Make better use of bank transactions](#3a-make-better-use-of-bank-transactions)**: pick out salary, rent, pension payments and savings interest from TrueLayer data, so connecting a bank fills in far more of the report than balances and a rough spending figure.

---

## What the AI features cost

Current Claude API prices, per million tokens:

| Model | Input | Cached input | Output | Note |
|---|---|---|---|---|
| Sonnet 4.6 (what the app uses now) | $3 | $0.30 | $15 | |
| **Sonnet 5.5 (recommended)** | $2 | $0.20 | $10 | Splits the same text into about 30% more tokens, but is still cheaper overall. |
| Haiku 4.5 | $1 | $0.10 | $5 | Fine for simple checking and sorting tasks. |
| Opus 5.5 | $4 | $0.20 | $20 | Not needed: Candid's own code does the maths. |

- **Batch API:** the Batch API halves the price for work that can wait (up to 24 hours, usually much less).
- **How these estimates were made:** pounds are converted at about $1.33 to the pound, and token counts are estimates. The Anthropic console shows the real ones once a feature is live.

| Feature | Estimated cost |
|---|---|
| Today's report (Sonnet 4.6, about 3.5k tokens in, 1k out) | about 2p a report |
| The same report on Sonnet 5.5 | about 1.7p a report |
| Plain-code accuracy check per report | free |
| Optional Claude review per report | about 1.2p (Sonnet 5.5) or 0.6p (Haiku) |
| Test profiles: maths checks | free |
| Test profiles: AI text checks, 10 profiles | about 30p a run, or about 15p with the Batch API |
| One Q&A question | about 0.7–1p with caching, about 2.5p without |
| Reading one payslip | under 1p |
| Reading a multi-page pension statement | about 3–5p |

---

## 1. Financial planning/guidance quality

### 1a. Automatic accuracy check

The first version of this review blurred two different checks. They protect different things.

**Check 1: every report, as it's made. This protects the individual user. Agreed.**
- The text Claude writes is new for every user, so test profiles can't prove any one person's text is right. This check runs on each real report.
- **Plain-code check (free, instant):**
  - pull every £ figure and % out of the narrative and priorities, and confirm each one appears in the figures Candid gave Claude
  - a short list of rules for advice pointing the wrong way, for example "start contributing" or "open a pension" when the user already contributes, or "overpay your loan" when the student loan module says not to
  - the existing "no pension" text guard in `getModuleSummary` is the precedent; this generalises it
- **If a check fails:** regenerate the text once, then fall back to plain copy built from the figures.
- **Optional second Claude call (about 1.2p):** catches subtler problems, such as tone or advice that contradicts a module's status in a way the rules don't cover. The report prompt already tells Claude not to do these things, and the plain-code rules catch the most common ones. So this extra call is a safety net, worth adding only if the failure logs show it's needed.

**Check 2: test profiles, when the code changes. This protects the engine. On hold until the cost is understood.**

There are two parts, with very different costs:

| Part | What it checks | Cost | When to run it |
|---|---|---|---|
| **Maths** | The ~10 test profiles run through `calcMetrics` → `computeModuleStatuses` with checks written as code (like the `*.test.js` files) | **Free.** Runs locally with `npm test` in about 2 seconds, no API calls. | Every code change. |
| **AI text** | The same profiles go through the real report prompt, then Check 1 above | **About 30p a run** (10 profiles × about 1.7p report + 1.2p review). About 15p with the Batch API, about 23p with a Haiku review, about half with 5 profiles. | Only when something that affects the words changes: `aiPrompt.js`, the model, or which figures are handed to Claude. Most engine changes don't. |

- **Correction:** the first version said "on every change". The maths part can run on every change for free, and that part would have caught the bonus-income, pension-allowance, income-tax and student-loan bugs found during the profile testing. The paid part only needs to run when the prompt changes.
- **What it costs in a month:** at about 4 prompt changes a month, around £1.20 a month. The cost is per run, not per user, so it doesn't grow with the user base.

**Deciding when a paid run is needed: Claude Code flags it (your suggestion).**
- **Why:** most changes don't affect the report's words, so paying for a run on every change is wasted money.
- **What Claude Code does:** at the end of any change, it puts the change into one of three classes and says so in its summary, with the reason:

| Class | Examples | What runs |
|---|---|---|
| **Words could change** | `aiPrompt.js`; the model or settings in `api/claude.js`; which figures `buildFinancialSummary` hands to Claude; a new module status or field the report talks about | The free maths tests, plus a **recommendation** for a paid AI-text run. Claude Code asks first and never starts one itself. |
| **Engine change** | `tax.js`, `pension.js`, `studentLoan.js`, `metrics.js`, `moduleStatus.js`, `forecast.js`, fixed figures like thresholds and rates | The free maths tests only. The per-report plain-code check (Check 1) still guards the words in production. |
| **Interface only** | layout, styles, website copy, animation | Nothing beyond the existing tests. |

- **How it could be built:**
  - **The judgement:** one rule in `CLAUDE.md`. Claude Code reads it at the start of every session, so it applies to every change.
  - **A safety net:** a simple file-path check in the profile-run script itself, so the judgement isn't the only safeguard. If `aiPrompt.js` or `api/claude.js` has changed since the last paid run, the script says a run is due.
  - **When:** add both when the profile-run script is built. A rule pointing at a script that doesn't exist yet would only cause confusion.
- **Example:** this week's work would have produced:
  - for the student loan threshold and rate fixes: engine change, free tests only
  - for the homepage hero changes: interface only
  - for none of them: a paid run
- **How it could be built:** the calculation code is plain JavaScript that already runs on the server (`generate-report-pdf.js` uses it). A Node script plus `node --test`, with a switch so the AI part only runs when asked.

### 1b. Questions answered from the user's own numbers
- **What it does:** users ask things like "what if I put £5k of my bonus in my pension?" or "should I overpay my loan or my ISA?". Claude answers by calling Candid's own functions as tools rather than doing the arithmetic itself. Examples: `calcBonusSacrifice`, `calcOverpaymentScenarios`, `calcPensionTaperSaving`, `calcRentVsBuy`, `mortgageSummary`.
- **How it could be built:**
  - Claude tool use through a new API route built like `api/claude.js` (same origin check and Upstash rate limits), with each tool a thin wrapper over an existing `src/lib` function, given the user's inputs.
  - Store questions in Supabase or PostHog. At this stage they're also free research into what users want next.
- **Must have before public release (decided):**
  - **A usage cap:** a per-user daily and monthly question limit through the Upstash rate limiter `api/claude.js` already uses, plus a monthly spend limit in the Anthropic console as a backstop. The limits are yours to set. For scale, 100 questions a month at about 1p each is about £1 a user at most.
  - **Prompt caching** (see below).
  - **Sonnet 5.5.**
- **Going straight to the relevant module (the pre-screening question, clarified).** The idea: if someone asks about their pension, Claude starts at pensions, rather than starting at the top and working down every decision tree until it reaches pensions.
  - **Good news: this is already how it would work, because Claude never walks the decision trees.**
    - The trees are Candid's own code: `computeModuleStatuses` and the module functions. They run for every module on every report, in milliseconds, at no token cost.
    - By the time someone asks a question, every module's answer is already worked out.
    - Claude only reads results. So "starting at pensions" means Claude reads the pension results and nothing else in detail.
    - The design below does exactly that: the question "What do I do with my pension?" leads Claude to fetch the pension figures directly.
  - **One thing to keep: a one-line status for every other module.**
    - Jumping straight to pensions shouldn't mean being blind to everything else. Some pension answers depend on modules further up the order: the sequence in `waterfall.js` puts expensive debt and the emergency fund before extra pension saving.
    - Example: if the user's emergency fund is critical, "put more into your pension" is the wrong answer, even though the question was only about pensions.
    - The short summary sent with every question (one line per module, about 500 tokens) lets Claude see a red flag like this without reading the other modules in full.
  - **The design:** don't send all of the user's figures up front. Each request starts with a fixed block: the instructions, the tool definitions and a short summary of the user's report (score and one line per module, about 500 tokens). The detailed figures for each module sit behind a tool, for example `get_module_figures("pension")`. Claude fetches only what the question needs:
    - "What do I do with my pension?" pulls the pension figures only.
    - "Pension or mortgage?" pulls both.
  - **No separate screening call:** the screening happens inside the first call Claude already makes.
  - **Alternatives considered:**
    - Keyword matching in code (free) breaks on questions like "where should my bonus go?", which touches pension, ISA and student loan at once.
    - A separate Haiku call to sort the question (about 0.1p) adds a step and delay for little gain.
  - **How it interacts with caching:** caching only works on an identical opening block, so the fixed block stays the same for every question in a session. The question-specific figures come after it.
  - **What it actually saves:**
    - Once caching is on, cached tokens cost a tenth of the normal price, so trimming them saves little.
    - Pre-screening mainly helps two things: the first question in a session (before anything is cached, about half the cost) and answer quality (Claude isn't distracted by figures that don't matter to the question).
    - The biggest cost is the answer itself, so keeping answers short (around 150–250 words) is the strongest cost lever.
  - **Estimated cost:** about 0.7p per question with this design, against about 2.5p for the uncached version.
- **Why now:**
  - It is the visible "AI" in an AI-backed raise, and it extends the "calculation-first" positioning instead of diluting it.
  - The placeholder already promises it ("grounded in your Candid report").
  - It needs a firm boundary between guidance and regulated advice in its instructions (see Lower priority).

### 1c. Match the explanation to how confident the user is
- **What it does:** the confidence score from the `/welcome` check (`candid_confidence_score`) is saved to the report row but never passed to Claude. Including it would let the narrative define terms and explain mechanisms (salary sacrifice, the taper) for low-confidence users, and get straight to the numbers for confident ones.
- **How it could be built:** add one field to `buildFinancialSummary` and one rule to the prompt.
- **Why now:** it's a very small change. It also answers the profile-test finding that the jargon in onboarding and reports suits experienced users only.

### 1d. Update the Claude setup
- **What it does:** move from `claude-sonnet-4-6` (allow-listed in `api/claude.js`) to Sonnet 5.5, and use structured output (a tool whose input is a schema) for the report.
- **How it could be built:** structured output removes the "malformed JSON" fallback path in `callClaude`, which currently shows generic stock copy.
- **Why now:**
  - It improves the quality of every report and is slightly cheaper per report (about 1.7p against 2p).
  - It stops a failure mode in which a demo shows placeholder text.
  - It's the same model Q&A will use.

### 1e. Open question: a sequenced action plan
The dashboard currently ranks modules by £ value, and the code says this is deliberately not a recommendation (`getModuleBreakdown`). Meanwhile `waterfall.js` already has a sequence for property: employer match → expensive debt → emergency fund → ISA. Applying that sequence to the main report, with Claude explaining each step, would make the report more actionable. **But it changes Candid's stance from ranking to recommending, so it's your call.** I haven't assumed it.

---

## 2. Customer data collection

### 2a. Fill in onboarding from a payslip or pension statement

**Agreed.**

- **What it does:** the user uploads a payslip, a P60 or a pension statement, and Claude reads it and fills in the fields. The user then confirms or edits them as usual.
- **How it could be built:**
  - A file input on the About and Pension steps.
  - A new API route sends the image or PDF to Claude and gets back fields matching an exact schema.
  - The values fill in `d` through the existing `set`.
  - The file isn't stored, only the confirmed numbers. The instructions tell Claude to return only the listed fields: payslips also carry the name, address, NI number and employee number, none of which Candid needs.
- **Cost:** under 1p for a one-page payslip, about 3–5p for a multi-page pension statement.

**Worked example: a real September 2025 payslip.**

| Onboarding field | From this payslip | How |
|---|---|---|
| Salary | £85,000 | £7,083.33 × 12 |
| How contributions are made | Relief at source | The £170 deduction is exactly 3% of pay minus the 20% basic-rate relief the pension provider claims back (£212.50 × 0.8). Year-to-date taxable pay equals gross pay plus the medical insurance benefit, so nothing is taken off before tax. |
| Your contribution | 3% | Not 2.4%, which is what someone reading the payslip themselves might enter. |
| Employer contribution | 6% | This is what's paid, not the "match cap". Whether the employer would pay more if the employee did isn't on a payslip. |
| Student loan plan | Plan 2 | £423 only fits Plan 2: Plan 1 would be £442, Plan 4 £391 and Plan 5 £450. |
| Bonus | Unclear, so ask | Year-to-date pensionable pay is £1,634.67 more than six months of basic pay: a bonus, a pay rise or back pay. Claude should ask rather than fill it in. |

Not onboarding fields today, but useful:
- **Tax code 1257L** is the standard code. With relief at source and higher-rate pay, that suggests the extra 20% higher-rate relief (about £510 a year here) isn't coming through the tax code. It may still be claimed through Self Assessment, so Candid should ask rather than assume. This turns the existing relief-at-source tip into a £ figure.
- **Private medical insurance:** a taxable benefit of about £1,517 a year here, which adds to taxable income. That matters for anyone near £100k.

**Coverage:**
- By count, a payslip fills about 6 of roughly 35 onboarding fields. Those include 4 of the 5 people least often know: pension type, both contribution rates and the loan plan.
- Other documents fill the rest of the Pension and Student loan steps:
  - a pension statement gives the pot value
  - a Student Loans Company statement gives the balance
  - a P60 gives full-year pay including bonus
  - a State Pension forecast gives NI years
- Spending, cash, ISAs and investments come from Open Banking (3a).

**Why now:** the pension type ("Not sure" is an option), the contribution rates and the student loan plan are the fields people least often know, and the pension module carries the largest £ amounts. Better inputs mean better reports, and fewer steps where people drop out (PostHog already tracks this per step).

### 2b. Describe your situation in words, then confirm
- **What it does:** an optional first step: "Tell us about your money in a few sentences." Claude turns the answer into the onboarding fields. The wizard then opens with them filled in and highlighted so the user can check each one.
- **How it could be built:** the same route pattern as 2a, returning the same fields. Low risk, because the existing wizard is still where the user confirms.
- **Why now:** it cuts the "under 5 minutes" claim further for people who'd rather type. It's lower priority than 2a, because free text is less reliable than a document.

### 2c. Sense checks while the user types
- **What it does:** extend checks like the existing "over the £20k ISA allowance" warning with ones that compare fields against each other:
  - spending higher than take-home pay
  - an employer match bigger than what the user contributes
  - a pension pot implausible for the user's age and salary (`estimatePensionPot` already exists)
- **How it could be built:** mostly plain code rather than AI. Claude is only worth adding to phrase the prompt shown to the user.
- **Why now:** cheap, and every bad input becomes a wrong £ figure further on.

---

## 3. Finance app/data connections

### 3a. Make better use of bank transactions

**Planned for after the move off the TrueLayer sandbox.**

- **What it does:** `api/truelayer/callback.js` currently totals outgoings over 90 days and divides by 3. Using the transactions properly would let the app:
  - **Fill in the missing savings rate:** work it out from interest credits, since `cashTiers` arrives with an empty rate today.
  - **Detect salary:** find regular credits, from which gross pay can be estimated by reversing the tax and NI calculation in `tax.js`.
  - **Detect rent:** regular payments to the same recipient, which feeds the Property / Rent-vs-Buy module.
  - **Detect pension payments:** regular payments to a pension provider (relief at source).
  - **Exclude transfers between the user's own accounts:** these currently inflate the spending estimate.
  - **Split essential from discretionary spending.**
- **How it could be built:** simple rules first (recurring amounts, known merchant names). Then a batched Claude call to sort the merchants the rules can't place. All of this can happen inside the existing callback before results go into the short-lived data cookie.
- **Why now:** it turns "Open Banking" in the deck from "fills in a balance" into "fills in most of the report". A spending figure that counts transfers between accounts is wrong in a way users will notice.

### 3b. Ongoing access, built properly
- **What it does:** the long-lived access token TrueLayer issues is already designed to be stored, keyed by email (`truelayer_connections`), but nothing uses it.
- **How it could be built:** a scheduled job that refreshes balances, re-runs the calculations and feeds the reminders in section 4.
- **Why now:** this is plumbing to design now and switch on once TrueLayer goes live. Going live needs Candid to be authorised to access bank data (its own FCA authorisation, or working as an agent of TrueLayer). That's a question for the raise, not an engineering task.

### 3c. Beyond banking: not yet
- **Pensions:** the UK Pensions Dashboards Programme is the eventual route to pension data, but third-party apps can't use it yet.
- **Investment platforms:** they have no common open API.
- **HMRC:** it has no consumer API for an individual's tax position.

None of these are worth effort now. Uploading documents (2a) covers the same gaps today.

---

## 4. Automated calendar/reminder updates

### 4a. A personal calendar for the tax year
- **What it does:** an "add your money calendar" action that creates one calendar file with several personalised events. Examples:
  - ISA allowance deadline, 5 April (with the user's unused amount)
  - capital gains allowance, before 5 April
  - a "talk to payroll" reminder before the user's bonus is paid, if they're near the £100k trap
  - student loan rate reset, 1 September
  - end of a fixed-rate mortgage
- **How it could be built:** extend `reminders.js` (which already builds calendar files) to include several events. The dates come straight from the figures already calculated. No backend and no Resend needed.
- **Why now:** it's the cheapest way to add the "it keeps working for you after the report" element before email exists.

### 4b. Scheduled nudges, once Resend is live
- **What it does:** a scheduled Vercel job reads opted-in users (the quarterly check-ins tick-box already records consent) and sends email when something matters for that person, such as:
  - the tax-year deadline getting close with unused allowance
  - the best savings rate moving enough to change the user's £ gap
  - the Bank of England base rate changing
  - an announced rule change that affects them (see 5d)
  Claude writes each email using the person's own figures.
- **How it could be built:** Vercel Cron, a Supabase table of each opted-in user's latest inputs (today only the `test` row exists, keyed by session), Resend, and the existing calculations.
- **Why now:** it's mostly valuable once there are users. It's worth designing the data model now so 4a and 3b feed into it, but it shouldn't come before the items in the top list.

---

## 5. Public data sources (ONS, BoE, lender rates)

**Approved and prioritised.** Build in this order, by how much each source affects users' £ figures:

1. **The dated record of fixed figures (5b).** This comes first: it would have caught the student loan threshold bug.
2. **Bank of England base rate:** feeds the mortgage default and Plan 1 loan interest.
3. **Best savings rates (5c):** these drive the cash and student loan comparisons.
4. **RPI and student loan interest rates:** reset each September.
5. **ONS rents and Land Registry house prices.**

### 5a. An automatic pipeline for public data
- **What it does:** a scheduled job pulls each official source, checks it, and writes it to Supabase with its source and date:
  - **Bank of England base rate:** its statistics database publishes the rate as downloadable data.
  - **ONS private rents:** the source of the hand-updated `property_regional_rates` table.
  - **Land Registry UK House Price Index:** published monthly by region and local authority.
  - **RPI:** for student loan interest rates.
- **How it could be built:** Vercel Cron and a fetch-and-check step per source. Claude is only needed where a release's format changes or a figure has to be read from a document. Anything new waits as a draft row until you approve it.
- **Why now:**
  - It removes the manual updates you'd otherwise forget, and makes the "current and specific" claim true.
  - The house price index goes down to local authority level, so the Rent-vs-Buy engine could use the user's borough rather than a London-wide figure. That fits a London-first product.
  - The base rate would replace the 4.5% mortgage default and make Plan 1 loan interest (the lower of RPI and base rate + 1%) work itself out.

### 5b. A dated record of every fixed figure
- **What it does:** one table of every number currently fixed in the code, each with its value, source link and the date it was last checked. Examples: tax bands, student loan thresholds and rates, the ISA allowance, the State Pension amount, stamp duty and the Premium Bonds return.
- **How it could be built:** a monthly job asks Claude to compare each value with its official gov.uk or NS&I page and produce a list of differences for you to approve. The new `SL_REPAYMENT_THRESHOLDS` table in `studentLoan.js` is the pattern: one place per figure, with its source in a comment.
- **Already known to check next:**
  - **ISA allowance:** £20,000 is written straight into both [`metrics.js`](src/lib/metrics.js) and [`waterfall.js`](src/lib/waterfall.js).
  - **Done: the public calculator pages.** All three (student loan, £100k tax trap, mortgage vs savings) now read their figures from `src/lib` and are built with the app, so they can't drift. Their text is filled in at build time from [`pageFigures.js`](src/lib/pageFigures.js), and the mortgage page uses the live best savings rate.
  - **Still written into the code in more than one place:** the £50,270 higher-rate threshold and National Insurance rates in `pension.js` and `CandidApp.jsx`. These should move to the constants in `tax.js` next.
- **Why now:** they're your main source of slowly-going-wrong figures, and a record like this shows investors that the maths is maintained, not frozen.

### 5c. Lender savings and mortgage rates
- **Savings:** the `savings_rates` table has 3 hand-entered Cash ISAs. A scheduled job could read providers' public rate pages with Claude and propose updates for you to approve. Check each site's terms first. The comment "replace with live Moneyfacts API" in `forecast.js` points at the paid route.
- **Mortgages:** there's no free live source. The Bank of England publishes monthly average quoted rates by fixed period and loan-to-value, which is enough to replace the fixed 4.5% default with a realistic market figure in the Rent-vs-Buy and borrowing checks. Moneyfacts or a mortgage broker's data feed would be the paid upgrade. That's a new supplier, and only worth it once there are users.

### 5d. Flag announced changes that affect a user's plan
- **What it does:** each row in the 5b record also gets:
  - an **effective date**
  - a **certainty level:** in force, legislated, announced, or under consultation
  The engine works with today's values. A second pass re-runs each user's figures with every future value, and flags the changes that move their numbers by a meaningful amount, in the report and in any action plan. For example: "From April 2027 the cash ISA limit falls to £12,000. Your plan puts £15,000 into a cash ISA this year; from next year only £12,000 of that can go in."
- **How it could be built:** Claude watches official sources (Budget documents, HMRC policy papers, Student Loans Company announcements) and proposes new rows for you to approve. It also writes the plain-English flag. No new data supplier is needed.
- **Recommended rule: official announcements and formal consultations only, never press speculation.** Otherwise users get alarmed by rumours before every Budget, and Candid's credibility rests on its figures being right.
- **On the personal allowance specifically:** it's frozen at £12,570 until April 2031, so a change is unlikely. The freeze itself is the forward-looking point: pay rises push people towards the £100k trap. The salary forecast could show when this person is likely to cross it.
- **Changes believed announced at the November 2025 Budget that would affect Candid's advice.** These need confirming as the record's first entries, because they come from knowledge up to mid-2026:
  - **Cash ISA limit falls to £12,000 for under-65s from April 2027.** The overall ISA limit stays £20,000.
  - **Salary sacrifice above £2,000 a year starts paying National Insurance from April 2029.** This directly affects the pension and bonus sacrifice recommendations.
  - **Tax on savings interest rises by 2 percentage points from April 2027.** This affects the cash vs ISA comparison.
  - **The Plan 2 repayment threshold is frozen at £29,385 from April 2027.**
  - **State Pension age rises from 66 to 67 between 2026 and 2028.** This affects retirement projections.
- **Why now:** an action plan that ignores a change already announced for next April is wrong in a way users will notice. Flagging it is something few consumer tools do.

---

## Lower priority (reference only)

- **Billing:** nothing worth doing yet.
- **Transactional email:** once Resend lands, the obvious first job is sending the PDF that `api/generate-report-pdf.js` already generates. The route's own comments say this is the missing step.
- **Legal/compliance:** one point relevant to the AI features. Q&A (1b), any action plan (1e) and announced-change flags (5d) must stay on the guidance side of the FCA's line between guidance and regulated advice. Build this into the instructions Claude is given and into the accuracy check (1a), rather than treating it as a separate legal task. Document uploads (2a) also need a line in the privacy policy about documents being processed by Anthropic and not stored.
- **Social/marketing:** nothing worth doing yet.
