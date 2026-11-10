# Net worth redesign: handoff

Written 9 Nov 2026 for the Claude session picking this up. Replaces the net worth ring on the Progress tab.

## Step 1 built (10 Nov 2026), uncommitted, waiting on Harvey's localhost check

- Engine: `src/lib/netWorthView.js` covers the accounts, the three groupings, the timeline, the payment split and the home share. `src/lib/netWorthHistory.js` is the monthly save, kept in `d.netWorthHistory`. `mergeAnswers.js` merges months from both devices. Tests are in `netWorthView.test.js`.
- UI:
  - `src/mobile/networth/NetWorthParts.jsx` is the mock's parts file, moved.
  - `worthUi.jsx` holds the theme, the brackets and the row icons.
  - `ProgressTrackerDashboard.jsx` uses a `green` band tone on Net worth. The ring and tiles are gone.
  - Row pages are `src/mobile/screens/MobileWorthDetail.jsx`, at `/app/progress/worth/:rowKey[/:more]`. These were added to `main.jsx`, `vercel.json` and `CandidApp.jsx`, which also gains the save effect.
- Verified:
  - 828/828 tests; characterisation unchanged.
  - Build passes, and the mock is not in `dist`. `check:key` passes; its first run hit a one-off chat lump-sum error.
  - Playwright at 390 wide:
    - The figures tally. A month is saved once.
    - A chart swipe doesn't switch view.
    - Back returns to Progress, and an unknown row redirects there.
    - The student loan payments page renders. A new user's chart starts at Now.
- Not checked on screen: the Home and Mortgage pages, and Your share. `sanitizeForMvp` hides the mortgage module, so no real profile has a mortgage yet. Only an outright owner gets a Home row.
- Round 2 (Harvey, 10 Nov):
  - Home and Mortgage show as "Coming soon" rows while the mortgage module is hidden (`comingSoonRows` in `worthUi.jsx`).
  - The chart caption is "Dashed line is a projection", with no growth %.
  - The composition bar is 5px.
  - The grouping dropdown sits on its own line, top right, above "Assets".
  - New details in `netWorthView.js`:
    - **Student loan:** balance, the year repayments began, this tax year's interest forecast, repayments left this tax year, still to repay.
    - **Cash account:** rate, interest so far this tax year, interest forecast for the year.
    - **Premium Bonds:** prize rate, average prizes, a comparison with the best easy-access rate after tax, the limit used, tax saved.
    - **Pension:** State Pension, estimated.
- Round 3 (Harvey, 10 Nov):
  - **Tighter labels:** "Avg. prizes/yr", "vs. best easy access rate, after tax", "Tax saved vs. savings interest", rates without "a year", "(est.)", "26/27".
  - **Investments:** ISA allowance used and left. For money outside an ISA: gains, taxable if sold, CGT allowance left, days to use it. For each ISA: paid in this year, the allowance, and for a Lifetime ISA the £4k limit and bonus.
  - **Pension:** you and your employer per year, paid in so far, trap lump sums (`trapTopUps`), Annual Allowance use (full-year forecast), employer match, projected pot, access age, State Pension.
  - **Cash accounts:** Provider, Account type and Access. The provider is matched from the account name (`src/lib/providers.js`); otherwise all three say "Coming soon". Premium Bonds "Prizes won" is also "Coming soon".
- Round 4 (Harvey, 10 Nov):
  - "Coming soon" is muted across the whole line: Home and Mortgage rows (label too), and any detail whose value is "Coming soon" (`labels.soon` in `DetailScreen`).
  - **Pension split:** each pot's own details are on its page (`currentPotFacts`): Provider (Coming soon), you and employer as % and £/yr, Paid by, paid in this year, lump sums, employer match. Old pots show Provider and "Paying in: No". The Pension page keeps the overall ones: Annual allowance use, projected pot, access age, State Pension. With one pot, the Pension page shows both.
  - **Student loan:** the Student Loans Company logo (`public/logos/slc.co.uk.png`, from GOV.UK) beside the title on its page. Bank account pages show their provider's logo there too.
  - **Investments:** both allowances as "used": ISA (£x / £20,000) and CGT (£x / £3,000). "ISA allowance left" removed.
- **Harvey's decisions:**
  - Provider, type, access and prizes come from Open Banking, so no new questions.
  - Investment provider waits for step 3 (ISAs by provider).
  - Growth since 6 April comes from the monthly saves, from April 2027.
- **Logos:** 17 big-bank logos added to `public/logos` (96px, from each site's icon). Santander, Marcus, Coventry and Metro Bank had no usable icon and show a letter. `ProviderLogo.jsx` now reads its domains from `providers.js`.
- Committing: `CandidApp.jsx` also holds the uncommitted Cash walk-through changes. Stage only the net worth hunks.

## Where it stood before step 1

A clickable dev-only mock is built on invented figures. **Nothing is connected to real data, and nothing is committed.**

- See it with `npm run dev`, then http://localhost:5173/dev/net-worth-mock (390 wide).
- `src/mockups/NetWorthMock.jsx`: the presentational parts. Words, numbers and colours come through props.
- `src/mockups/NetWorthMockPage.jsx`: sample data, state and floating mock controls. The file's top comment has the custom item shape.
- `src/main.jsx`: two lines only, a `lazy` import and a `<Route>`, both behind `import.meta.env.DEV`. A production build was confirmed to contain no trace of the mock (before the later mock edits; the guard hasn't changed).

**Commit only these files for this task.** The working tree also holds unrelated work: the Cash walk-through (`CashScenes.jsx`, `moduleExplainer*`, `ExplainerScenes.jsx`, `ModuleExplainer.jsx`, `CandidApp.jsx`, `GuidanceNote.jsx`, `MobileModuleDeepDive.jsx`), `.claude/` changes, and `scripts/vercel-routes.test.js`.

**DeepSeek:** drafted the first version from a written brief only. The mock is now repo code, so it can't go back to DeepSeek (`docs/module-walkthrough-playbook.md`). All later edits were local.

## Answered by Harvey (10 Nov 2026)

1. Mock signed off. Go ahead with real figures (build order step 1).
2. Brackets (£xxx) on the net worth screens only, for now.
3. Category / Account / Access stays a dropdown.

## Not yet verified

- A real finger swipe on the chart. Programmatic scroll and mouse drag work; touch needs a phone.
- The £0 floor on the chart's axis (the last edit, `lo = lo >= 0 ? ...` in `TrendChart`) hasn't been seen on screen.

## Harvey's decisions

**Look**
- Dark green band (`G`), cream sheet below. White headline, green chart and figures.
- Time range dropdown (1Y, 5Y, All time) on the right of the Assets and Debts line. On row pages, level with the headline £.
- Grouping dropdown (Category, Account, Access) beside the "Assets" heading. It applies to Debts too.
- Rows show icon, name and right-aligned £ only. No pale explainer text, no chevrons.
- A small count beside a name means the row combines accounts, e.g. Cash (3). Harvey confirmed this is clear enough.
- Negatives as (£xxx): totals, rows, axes, money out. The hero Debts figure too.
- Bars, not rings. Home is dark green, not the mortgage red. Interest is cream on the band and dark green on the sheet, because red and green stacked failed the dataviz colour-blindness check.

**Chart**
- One sideways-scrolling timeline: past solid, projection dashed, Now between them. Opens with Now three-quarters across. A new user starts at Now, projection only.
- Vertical scale follows what's in view. Tap reads a point; on desktop, hover reads and drag scrolls.

**Levels**
1. Net worth screen.
2. Tap a row: its own page with chart, "What makes it up" (accounts with rate), More detail, Details, and a link to the module. The old row notes (`worthNotes`, `worthByAccess`) move here.
3. More detail:
   - Student loan and Mortgage: payments this tax year, monthly interest and principal chart, "Where it went", transactions. Principal on the mortgage adds to the share of the home.
   - Home: your share (value less mortgage), and this tax year's change split into principal repaid and change in the home's value.
   - Accounts: transactions.

**Custom assets and debts (Premium, via `premiumOpen(d)`)**
- Counted from the day added, so the line steps up at Now. The "last 12 months" change excludes them, because adding a car isn't a gain.
- Asset: `type` (vehicle, property, valuable, business, other), `name`, `value`, `liquidity` (days, months, longer), `growthPct`. Picking a type pre-fills liquidity and growth.
- Debt: `name`, `value`, `ratePct`, `monthlyPayment`.
- "Days" counts as Available now in Access; slower goes in "Takes time to sell". Same-type items aggregate, e.g. Vehicles (2).

**Later**
- ISAs held per provider, split out like cash accounts.
- Real transactions from Open Banking: one movement seen from both sides, e.g. a payment to SLC leaves cash and reduces the debt, so net worth doesn't change.

## Build order agreed

1. Real figures on this screen, plus a monthly save per category and account. History only exists from the day this ships, so it comes first.
2. Custom items behind Premium.
3. ISAs by provider.
4. Transactions, once Open Banking or payslip upload is live.

## Where the real data is

| Mock needs | Source |
|---|---|
| Headline, assets, debts | `netWorthPicture(d, m)` in `src/lib/progressTracker.js` (via `buildProgressSnapshot`) |
| Access grouping | `worthByAccess(d, m)`, same file |
| Facts for row pages | `worthNotes(d, m)`, same file. Rewrite from sentences into label and value pairs |
| Projection | `calcNetWorthTrajectory` in `src/lib/forecast.js`. Yearly rows, so the monthly timeline must interpolate |
| Cash accounts | `d.cashTiers` (`name`, `amount`, `rate`). `name` is optional, so needs a fallback; see `accountName` in `src/lib/assist.js` |
| Pensions | `d.potValue`, `d.potValue2` |
| ISAs | `isaPrev*` and `isaThisYear*`: held by type, not account, until step 3 |
| Entry point | `NetWorth`, `WorthTiles` and `assetsBy` in `src/components/dashboard/ProgressTrackerDashboard.jsx` |

## Traps

- **Figures must tally.** The projection's first point must equal the headline. `calcNetWorthTrajectory` builds cash from `m.totalLiquid` and nets property to equity, while `netWorthPicture` shows the home in full with the mortgage in debts. Compare year 0 with `netWorth` and test it. Sums of accounts must equal each category.
- **Sideways swipes.** The Progress band swipes between Net worth, Goals and Tax shield (`useBandViews`, `bandProps`). A swipe on the chart must only move the chart.
- **Tone.** The band is `tone="light"` on Progress, and Goals and Tax shield depend on that (Tax shield turns red or amber). Dark needs to apply to the Net worth view without breaking them.
- **Keep:** `data-tour="progress-worth"`, the hidden `h1`, and the analytics events `progress_worth_view` and `progress_module_opened`. `progress_worth_view` values will change now there are three groupings.
- **Row pages and browser back.** The walk-through hit a bug where overlay state survived a back swipe. Clear on route change, or make these real routes. Don't point system redirects at them (CLAUDE.md).
- **The monthly save** must write at most once a month, and storage isn't decided. The `test` table has column-level grants for `anon`: a new client-updated column needs a GRANT (hand Harvey the SQL), and a PATCH matching no row still reports success, so verify by querying.
- **New inputs** that appear in a walk-through go in `ADDED_LATER` in `src/lib/moduleStatus.js`.
- **Copy** stays neutral (calculator, not adviser), and UI waits for Harvey's go-ahead on localhost before committing.
- **One-off Playwright checks:** in `scripts/_*.mjs`, deleted after. When blocking third parties on the dev server, match external hosts only. A plain `/posthog/` also blocks the local `posthog-js` module and gives a blank page.

## Flagged to Harvey for later steps

- **ISAs by provider is the largest change:** the current fields appear 129 times across 41 files, including the allowance logic and tests. Needs moving existing users' totals into accounts. Treat as its own piece of work.
- **Open Banking won't see most student loan payments.** Employed borrowers repay through payroll, so the bank only sees net pay. Regular repayments need payslip upload (Premium, not built); Open Banking catches overpayments and direct payments.
- **Lenders don't report the interest and principal split.** Calculate it from balance and rate, unless the user enters a statement figure. The mock labels this "Worked out from your balance and rate".
- **Transactions need a proper per-user table** with access controls and server-side checks (`accessFor` in `server/access.js`), not the report table.
