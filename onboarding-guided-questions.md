# Onboarding: two questions, then one module at a time

Today, onboarding asks up to 9 steps and about 45 fields before anything comes back. The proposal is to ask two questions, open the app, and then gather each module's questions when the user opens that module. Each module ends with its answer straight away, the way Property now does.

It uses the same walk-through as Property (one question per screen, a reason of 15 words or fewer, the result card filling in), and the same question registry, so nothing is asked twice.

## Today: the baseline

From PostHog, last 90 days, bots excluded:

| | People |
|---|---|
| Started onboarding | 37 |
| Finished onboarding | 27 (73%) |
| Report generated | 43 (includes regenerations by returning users) |
| Abandonment events | 15 |

Abandonments by step:

| Step | People | How |
|---|---|---|
| Focus (pick modules), step 1 | 6 | 5 went back to the welcome page |
| About you | 3 | Closed the page |
| Cash & savings | 3 | Closed the page |
| Name, Investments, Debt | 1 to 3 each | |

**Treat this as a rough guide only.** The numbers are small, they probably include our own testing, and they span older versions of the flow (the "Debt" and "Interests" steps no longer exist). What they do suggest: people leave at the first step, before giving anything, and at the first two money-heavy steps. Both point the same way as the proposal.

To compare old and new later, the new flow records:
- `guide_finished` and `guide_skipped`, with the module and the question reached.
- `module_answer_shown`.

These sit alongside the existing `assessment_*` events.

## The new shape

1. **Entry, 2 screens:** what they'd like help with, and their name. Then the app opens.
2. **Home:** the modules they picked come first. Each tile says what it needs, e.g. "5 questions, about 2 minutes", and shows a blurred result like Property's cards. The other modules sit below.
3. **Opening a module:** its walk-through runs, then its answer appears. After that, the module shows its normal full view, with "Walk me through it" to rerun.
4. **Shared figures** (salary, spending, age) are asked by the first module that needs them, then never again.
5. **The overall "what to do first" report** is offered once enough modules are done (decision 1).

## What has to change in the app

These come from the code, not from preference:

- **The app is gated on the report.** Every app page, Property included, redirects to the welcome page if there's no report (`CandidApp.jsx:6277`), and the home screen renders nothing without one. The new entry has to open the app with no report.
- **The Supabase row is created when the report is generated** (`insertReportRow`). It needs creating at entry instead (name and interests), then updated as each module is answered, the way Property's saves already work. Any new columns need an anon update grant, or every save is silently refused (the known `test`-table trap).
- **The report becomes optional, not the gate.** Module answers are worked out by Candid's own code, so they're free and instant. Only the overall report uses the AI (about 2p a time).
- **Score.** The home score comes from the report. With modules done one at a time, it either waits for the report or says what it's based on ("from 2 of 4 modules").
- **Existing users are unaffected.** They already have a report, and their modules are already filled in.
- **Desktop wizard.** The start button already sends everyone to the mobile app. The old desktop wizard (`/assessment`) is left alone.

## Entry

| # | Question | Why it matters | Answer |
|---|---|---|---|
| E1 | What would you like help with? | We'll start with these. You can add the rest any time. | Multi-choice: Savings and emergency cash, Investing and ISAs, Pension, Student loan, Buying a home, Just exploring |
| E2 | What should we call you? | Only used to talk to you in the app. | First name |

E1 replaces both the Focus step and the Goals step:
- "Buying a home" sets the buy-a-house goal and puts Property in their list.
- The Goals step's other options (a big purchase, money for future generations, consolidating) only shape the overall report, so they're asked when that's generated (decision 3).
- "Just exploring" opens the app with no module first.

## Shared figures (asked once, by the first module that needs them)

| # | Question | Why it matters | Answer | If not sure | Needed by |
|---|---|---|---|---|---|
| S1 | What's your salary before tax? | Sets your tax band, which changes most of what Candid suggests. | £ (payslip upload offered here, once built) | n/a | All |
| S2 | Are you employed, self-employed or not working? | Changes which tax breaks and employer benefits you can use. | Choice | n/a | All |
| S3 | Any income besides your salary? | Bonuses, dividends and other income can push you into a higher tax band. | Yes / No; Yes asks bonus, dividends and other income in turn | No | All |
| S4 | How old are you? | Sets how long your money has to grow. | Years | n/a | Pension |
| S5 | What do you spend in a typical month on essentials? | Shows how many months your savings would cover. | £ | n/a | Cash, Property |

**Moved:** salary trajectory (stable, steady or rapid) only drives the Forecast's projections. It moves to the Forecast screen, keeping its default until changed.

## Module questions

### Cash & savings

| # | Question | Why it matters | Answer | If not sure / gate |
|---|---|---|---|---|
| C1 | How much is in your savings, and what rate does it pay? | Shows what your cash earns against the best rates available. | Each account: balance and rate, with "Add another account" | Rate not sure: see decision 5 |
| C2 | Do you have Premium Bonds? Then: how much? | Their prize rate can beat or trail a savings account. | Yes / No, then £ | No |
| C3 | Have you paid into a Cash ISA since 6 April? Then: how much? | Your £20,000 allowance is lost if it's not used by 5 April. | Yes / No, then £ | No |
| C4 | And how much is in Cash ISAs from earlier years? | Counts towards your savings without being taxed. | £ | Skip |
| C5 | Could you get to your savings within a few days? | Emergency money needs to be reachable quickly. | Instant access / Some of it / No | n/a |

**Answer shown:** months of spending covered, and what moving to the best rate would earn a year.
**Moved:** the emergency fund target (3, 6 or 9 months) keeps its default and moves to the full view.
**Removed from onboarding:** the TrueLayer sandbox buttons (decision 7).

### Investments

| # | Question | Why it matters | Answer | Gate |
|---|---|---|---|---|
| I1 | Do you have any investments? | n/a: it decides what comes next. | Yes / No | No ends the module, with the ISA allowance as the answer |
| I2 | How much is in Stocks and Shares ISAs? | Growth inside an ISA is never taxed. | £ | Yes |
| I3 | And how much have you paid in since 6 April? | Your £20,000 allowance is shared across all your ISAs. | £ | Yes |
| I4 | Do you have a Lifetime ISA? Then: balance, and paid in since 6 April | The government adds 25%, up to £1,000 a year. | Yes / No, then £ twice | Yes |
| I5 | Any investments outside an ISA or pension? Then: how much? | Gains and dividends there can be taxed. | Yes / No, then £ | Yes |
| I6 | Roughly how much of that is profit? | Shows how much of the £3,000 tax-free gains allowance you'd use. | £ | I5 yes; not sure skips |
| I7 | Have you sold any of those since 6 April? Then: profit made | Profits from sales count against the same £3,000 allowance. | Yes / No, then £ | I5 yes |

**Answer shown:** ISA allowance left this year, and any gains tax exposure.
**Moved:** "Other ISA" balances (innovative finance and similar) move to the full view; they're rare.

### Pension

| # | Question | Why it matters | Answer | If not sure / gate |
|---|---|---|---|---|
| P1 | Do you pay into a workplace or personal pension? | n/a: it decides what comes next. | Yes / No / Not sure | No or Not sure ends with that answer (as now) |
| P2 | What percentage of your salary do you pay in? | Your employer may add more if you pay in more. | % | Skip |
| P3 | Up to what percentage will your employer match it? | An unclaimed match is free money. | % | "It's in your contract, or ask HR." Skip |
| P4 | Roughly how much is in your pension now? | Sets where your retirement income starts from. | £ | "Estimate it for me" (existing estimate) |
| P5 | Any pensions from old jobs? Then: roughly how much? | Old pots still count, and are easy to lose track of. | Yes / No, then £ | No |
| P6 | When would you like to retire? | Sets how many years your pension has to grow. | Age, 65 shown | Continue keeps 65 |
| P7 | How do you pay in: from gross pay, or from take-home pay? | Changes how you get tax relief, and whether you must claim some yourself. | Salary sacrifice / Relief at source / Not sure | Not sure (as now) |

S4 (age) is asked before P4, since the estimate needs it.
**Answer shown:** any unclaimed employer match a year, and the projected pot at retirement.
**Moved:** NI years completed (State Pension) moves to the full view, keeping its gov.uk link. Few people know it offhand.

### Student loan

| # | Question | Why it matters | Answer | If not sure |
|---|---|---|---|---|
| L1 | Which student loan plan are you on? | Each plan has its own repayment threshold and interest rate. | Plan 1 / Plan 2 / Plan 4 / Plan 5 / Postgraduate / No loan | "Not sure" opens the plan helper (decision 6) |
| L2 | Roughly how much do you still owe? | Shows whether you'll clear it before it's written off. | £ | Skip |
| L3 | What interest rate is it charging? | Sets whether paying it off early would save you money. | %, the estimate for their plan shown | Continue keeps the estimate |

**Answer shown:** whether overpaying is worth it, and when the loan is cleared or written off.
**New choices:** onboarding offers only Plans 1, 2 and 5 today. Plan 4 (Scotland) and Postgraduate are already handled by the student loan calculations, so this adds them as choices.

### Property

Already built. Its walk-through runs when Property is opened from the home screen, using any shared figures already given.

## Count

Before anything comes back:
- **Today:** about 9 screens, typically 20 to 30 fields.
- **New:** 2 screens.

The first module opened then asks 3 to 8 questions, including shared figures. Later modules ask fewer.

## Decisions

1. **The overall report:** offered once two modules are done, as "See what to do first", then regenerated only on request.
2. **Email:** asked in both places:
   - After the first module answer: "Want this sent to you?"
   - When the overall report is made.
3. **The other goals** (big purchase, future generations, consolidating): asked when the overall report is made.
4. **Home score:** hidden until the report. In its place, a plain line such as "Finish two modules and we'll work out how well you're doing", with the two modules to try next.
5. **Savings rate "not sure":** leave it blank. The answer then shows without the rate comparison.
6. **Student loan plan "not sure":** build a helper. It asks where they lived when they applied and when their course started, and works out the plan. The rules below must be checked against GOV.UK before building:
   - England, course started before 1 September 2012: Plan 1.
   - England, started 1 September 2012 to 31 July 2023: Plan 2.
   - England, started on or after 1 August 2023: Plan 5.
   - Wales, started before 1 September 2012: Plan 1.
   - Wales, started on or after 1 September 2012: Plan 2. Plan 5 doesn't apply in Wales.
   - Scotland: Plan 4.
   - Northern Ireland: Plan 1.
   - A Master's or Doctoral loan is the Postgraduate plan, asked separately.
7. **TrueLayer sandbox buttons:** out of the walk-through, kept in the Cash full view until the move off the sandbox.
8. **"Just exploring":** suggest the module most people open first.
   - Last 90 days (PostHog `module_opened`, first module per person): Pension 20, Cash 19, Investments 12, Student loan 7.
   - Pension leads, but only by one person, so the default is a single setting that's easy to change as more data comes in.

9. **Supabase:** one row per user. It's created at entry, then updated as modules are answered and when the report is made. The anon update permissions were applied on 5 October 2026 (`supabase_entry_row_migration.sql`). Only the fixed columns stay insert-only: id, created_at, session, acquisition fields and confidence score.
10. **Confidence check:** kept as its own screen before the entry, in the same walk-through format. One tap answers and moves on, and the entry's first question then rises in, so the movement carries across.

## Build order

1. **Foundations.**
   - The app opens without a report.
   - The Supabase row is created at entry.
   - Entry screens E1 and E2.
   - The home screen for a new user: module tiles with their question count, and the score held back as in decision 4.
2. **Module walk-throughs.**
   - The shared figures.
   - Cash, Investments, Pension and Student loan, using the same walk-through and question registry as Property.
   - Each module's answer card, blurred until its answers are in.
3. **The overall report and email.**
   - "See what to do first" after two modules, with the other goals asked there.
   - "Want this sent to you?" after the first module.
4. **The student loan plan helper.**

Phases 1 and 2 go to main together, since phase 1 alone opens an app with no way to answer modules. Each phase is committed to the feature branch as it's finished.
