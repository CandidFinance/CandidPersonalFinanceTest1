# Copy Review — Home, The Problem, How it works

Edit any "Current copy" text in place, then send this file back. Do not edit
the "Location" lines — they're how each change gets matched back to code.

Note on reused copy (flagged per your stop condition, not duplicated below):
- The **header, footer, and waitlist form** are one shared component each,
  rendered on all three pages. Listed once under "Shared components" at the
  bottom — an edit there applies everywhere automatically.
- The **"Be first to know when Candid launches."** CTA heading is *not* a
  shared component — it's typed out separately on each of the three pages —
  but reads identically on all three. Listed once per page below since each
  copy is a separate edit location; keep them matching if you want them to
  stay identical.

---

## Home

**File:** `src/mockups/NewLandingPage.jsx`

### Hero — badge
**Current copy:** Coming soon
**Location:** `NewLandingPage.jsx`, hero badge `<motion.div>`

### Hero — headline
**Current copy:** Your finances, trending in the right direction.
**Location:** `NewLandingPage.jsx`, hero `<motion.h1>` (note: "right" is rendered in a bold span, rest is normal weight)

### Hero — subhead
**Current copy:** Candid finds the gaps, inefficiencies and missed allowances costing you thousands – then shows you exactly how to fix it. Join the waitlist to be first in when we launch.
**Location:** `NewLandingPage.jsx`, hero `<motion.p>`

### Hero — trust line
**Current copy:** No spam. One email, the day we launch.
**Location:** `NewLandingPage.jsx`, line directly under the waitlist form in the hero

### Problem stats — section label
**Current copy:** What it solves
**Location:** `NewLandingPage.jsx`, `<SectionLabel>` above "Good income..."

### Problem stats — heading
**Current copy:** Good income. Good career.
Still losing thousands.
**Location:** `NewLandingPage.jsx`, `<motion.h2>` above the three stat tiles

### Problem stats — tile 1 (front)
**Current copy:** £425 p.a. / average unclaimed pension tax relief, by higher-rate taxpayers
**Location:** `NewLandingPage.jsx`, stats array item 1 (`n` / `label`), rendered via `StatFlipTile`

### Problem stats — tile 1 (back / source)
**Current copy:** PensionBee (Jan 2023), 2020/21 tax year
**Location:** `NewLandingPage.jsx`, stats array item 1 (`source`)

### Problem stats — tile 2 (front)
**Current copy:** 61% / of those with £10k+ in investable assets hold at least three-quarters or more in cash
**Location:** `NewLandingPage.jsx`, stats array item 2 (`n` / `label`)

### Problem stats — tile 2 (back / source)
**Current copy:** FCA Financial Lives (May 2024)
**Location:** `NewLandingPage.jsx`, stats array item 2 (`source`)

### Problem stats — tile 3 (front)
**Current copy:** ~£100 p.a. / average foregone interest surplus, per cash saver
**Location:** `NewLandingPage.jsx`, stats array item 3 (`n` / `label`)

### Problem stats — tile 3 (back / source)
**Current copy:** FCA update on cash savings (Sept 2024), FCA Financial Lives (May 2025)
**Location:** `NewLandingPage.jsx`, stats array item 3 (`source`)

### How it works (teaser) — section label
**Current copy:** How it works
**Location:** `NewLandingPage.jsx`, `<SectionLabel>` above the 2×2 grid

### How it works (teaser) — heading
**Current copy:** Your finances, mapped. Tailored steps to grow your wealth. All, in 5 minutes.
**Location:** `NewLandingPage.jsx`, `<motion.h2>` above the 2×2 grid

### How it works (teaser) — tile 1
**Current copy:** Where you stand and where you're headed / Share your current setup and targets, from salary and savings to buying a home or growing your investments. Rough estimates are fine, we'll do the maths.
**Location:** `NewLandingPage.jsx`, teaser steps array item 1

### How it works (teaser) — tile 2
**Current copy:** Your full financial picture, analysed / We test your setup against UK tax traps, debt mechanics, and personal goals. Delivering an instant financial health score and a tailored plan.
**Location:** `NewLandingPage.jsx`, teaser steps array item 2

### How it works (teaser) — tile 3
**Current copy:** See the £ value of every decision / Walk through personalised actions, showing precisely how much each decision adds to your net worth.
**Location:** `NewLandingPage.jsx`, teaser steps array item 3

### How it works (teaser) — tile 4
**Current copy:** Guidance that grows with you / Life isn't static. Whether you get a pay rise, buy a home, or start a family – Candid updates automatically, keeping your money on track.
**Location:** `NewLandingPage.jsx`, teaser steps array item 4

### What Candid covers — section label
**Current copy:** What Candid covers
**Location:** `NewLandingPage.jsx`, `<SectionLabel>` inside the dark tile

### What Candid covers — heading
**Current copy:** Every area of your finances, connected.
**Location:** `NewLandingPage.jsx`, dark tile `<h2>`

### What Candid covers — area pills
**Current copy:** Pension & salary sacrifice · ISA & investments · Cash savings optimisation · Student loan strategy · Mortgage & debt
**Location:** `NewLandingPage.jsx`, dark tile `area` pill list

### What Candid covers — footnote
**Current copy:** + more areas depending on your situation
**Location:** `NewLandingPage.jsx`, dark tile, below the pills

### What Candid covers — disclaimer
**Current copy:** Guidance, not advice. Candid helps you understand your options – the decisions are always yours.
**Location:** `NewLandingPage.jsx`, dark tile, bottom border-top line

### Free calculators — section label
**Current copy:** Free calculators
**Location:** `NewLandingPage.jsx`, `<SectionLabel>` above the calculator tiles

### Free calculators — heading
**Current copy:** Answer one question in 30 seconds.
**Location:** `NewLandingPage.jsx`, `<motion.h2>` above the calculator tiles

### Free calculators — tile 1
**Current copy:** Student loan overpayment calculator / Plan 1, 2, 4, 5 & Postgraduate – find out if overpaying saves you money or just hands cash to the government that would've been written off.
**Location:** `NewLandingPage.jsx`, calculator tools array item 1

### Free calculators — tile 2
**Current copy:** £100,000 tax trap & childcare cliff calculator / Check the 60% marginal-rate zone and the childcare cliff, and see the exact pension sacrifice that fixes both at once.
**Location:** `NewLandingPage.jsx`, calculator tools array item 2

### Free calculators — tile 3
**Current copy:** Mortgage overpayment vs high-yield savings / When your fix ends, compare paying down the mortgage against a savings account or Cash ISA – tax accounted for.
**Location:** `NewLandingPage.jsx`, calculator tools array item 3

### Final CTA — heading
**Current copy:** Be first to know when Candid launches.
**Location:** `NewLandingPage.jsx`, final CTA `<motion.h2>` (also appears on The Problem and How it works — see note at top)

---

## The Problem

**File:** `src/mockups/TheProblemPage.jsx` (plus `FinancesModuleTiles.jsx` for the "real issue" section)

### Hero — section label
**Current copy:** The problem
**Location:** `TheProblemPage.jsx`, `<SectionLabel>` above the H1

### Hero — headline
**Current copy:** Millions of higher and additional rate taxpayers are uniquely exposed to a financial minefield.
**Location:** `TheProblemPage.jsx`, hero `<h1>`

### Hero — paragraph
**Current copy:** Not because they've made mistakes – because personal finance has become overly complex, time-consuming, and frustratingly opaque. The result? Thousands of pounds leaking from your net worth every year.
**Location:** `TheProblemPage.jsx`, hero `<p>`

### Root causes — tile 1 (front title)
**Current copy:** Complexity
**Location:** `TheProblemPage.jsx`, `CAUSES` array item 1 (`title`)

### Root causes — tile 1 (back body)
**Current copy:** Pensions, ISAs, tax bands, allowances and mortgages all interact. Get one decision wrong and it can undo the benefit of another.
**Location:** `TheProblemPage.jsx`, `CAUSES` array item 1 (`body`)

### Root causes — tile 2 (front title)
**Current copy:** Lack of time
**Location:** `TheProblemPage.jsx`, `CAUSES` array item 2 (`title`)

### Root causes — tile 2 (back body)
**Current copy:** Between demanding careers and life outside work, few have the bandwidth to model each financial decision against every tax threshold, account rule and investment option across their wider setup.
**Location:** `TheProblemPage.jsx`, `CAUSES` array item 2 (`body`)

### Root causes — tile 3 (front title)
**Current copy:** Lack of access
**Location:** `TheProblemPage.jsx`, `CAUSES` array item 3 (`title`)

### Root causes — tile 3 (back body)
**Current copy:** Traditional financial advisers charge thousands in fees or demand six-figure minimum portfolios – leaving millions with nowhere clear to turn.
**Location:** `TheProblemPage.jsx`, `CAUSES` array item 3 (`body`)

### The real issue — section label
**Current copy:** The real issue
**Location:** `FinancesModuleTiles.jsx`, section label div

### The real issue — heading
**Current copy:** Your finances are one whole picture, not a set of separate accounts.
**Location:** `FinancesModuleTiles.jsx`, `<h2>`

### The real issue — paragraph
**Current copy:** Good decisions require seeing all the moving parts at once. Savings apps hunt for a slightly better interest rate, but won't notice that you're missing your full employer pension match or wasting your ISA allowance.
**Location:** `FinancesModuleTiles.jsx`, `<p>` (no emphasis markup in the current wording — the earlier version's `<em>and</em>` was tied to specific old wording and was dropped along with it)

### The real issue — module tile labels
**Current copy:** Pension · ISA · Savings · Student loan · Tax · Mortgage · Family
**Location:** `FinancesModuleTiles.jsx`, `ROWS` array

### And it never stands still — section label
**Current copy:** And it never stands still
**Location:** `TheProblemPage.jsx`, `<SectionLabel>` above "Year on year..."

### And it never stands still — heading
**Current copy:** Year on year, the picture changes – your plan has to keep up.
**Location:** `TheProblemPage.jsx`, `<motion.h2>`

### And it never stands still — life event labels
**Current copy:** Salary & tax band change · House purchase · Family planning · Student loan payoff
**Location:** `TheProblemPage.jsx`, `LIFE_EVENTS` array

### Candid's aim — heading
**Current copy:** Candid's aim is to fix this.
**Location:** `TheProblemPage.jsx`, dark tile `<h2>`

### Candid's aim — paragraph
**Current copy:** One complete, always-up-to-date view of your finances – built to adapt instantly as you change jobs, buy a home, start a family, or clear your student loan.
**Location:** `TheProblemPage.jsx`, dark tile `<p>`

### Final CTA — heading
**Current copy:** Be first to know when Candid launches.
**Location:** `TheProblemPage.jsx`, final CTA `<motion.h2>` (also appears on Home and How it works — see note at top)

---

## How it works

**File:** `src/mockups/HowItWorksPage.jsx`

### Hero — headline
**Current copy:** How Candid works.
**Location:** `HowItWorksPage.jsx`, hero `<h1>`

### Hero — subhead
**Current copy:** Four steps, five minutes, and a complete picture of your tax efficiency, net worth, and tailored action plan – built to update automatically as your life changes.
**Location:** `HowItWorksPage.jsx`, hero `<p>`

### Step 1
**Current copy:**
Step 1
Share your current setup
Salary, savings, pension, debts – as they stand today. Ballpark figures are fine, and you don't need to organise a thing beforehand. We do the heavy lifting, in under 5 minutes.
**Location:** `HowItWorksPage.jsx`, `STEPS` array item 1 (`title` / `body`; "Step 1" label is auto-generated from array index, not separately editable — all four steps are now a single body paragraph each, no separate italic detail line)

### Step 2
**Current copy:**
Step 2
Candid runs the numbers against UK tax rules
Candid cross-references your figures against pension allowances, ISA limits, tax brackets, student loan thresholds, and more. The outcome is an instant financial health score and a prioritised roadmap for your specific goals.
**Location:** `HowItWorksPage.jsx`, `STEPS` array item 2

### Step 3
**Current copy:**
Step 3
Actionable steps with exact £ impact
Break down your finances area by area – pension, ISAs, mortgage, debt and cash. Every action shows its quantified £ impact, calculated directly from your numbers, alongside clear plain English explainers so you see the 'why' behind every step.
**Location:** `HowItWorksPage.jsx`, `STEPS` array item 3

### Step 4
**Current copy:**
Step 4
Guidance that grows with you
A pay rise, buying a home, starting a family, or clearing a student loan – life isn't static. Update your numbers whenever things change, and Candid automatically recalculates your score and next steps to keep your plan on track.
**Location:** `HowItWorksPage.jsx`, `STEPS` array item 4

### Final CTA — heading
**Current copy:** Be first to know when Candid launches.
**Location:** `HowItWorksPage.jsx`, final CTA `<motion.h2>` (also appears on Home and The Problem — see note at top)

---

## Shared components (used on all three pages)

### Header — wordmark
**Current copy:** Candid.
**Location:** `src/mockups/NewSiteHeader.jsx`, logo `<Link>`

### Header — nav tabs
**Current copy:** Home · The Problem · How it works
**Location:** `src/mockups/NewSiteHeader.jsx`, `TABS` array

### Header — beta button
**Current copy:** Beta Tester
**Location:** `src/mockups/NewSiteHeader.jsx`, top-right `<button>`

### Footer — wordmark
**Current copy:** Candid.
**Location:** `src/mockups/SiteFooter.jsx`

### Footer — company details
**Current copy:** Candid Personal Finance Ltd · Company no. 17383565
66 Paul Street, London, England, EC2A 4NA
**Location:** `src/mockups/SiteFooter.jsx`

### Footer — regulatory disclaimer
**Current copy:** Candid provides financial guidance and education only – not regulated financial advice. Always consider your personal circumstances and consult a qualified adviser for complex situations.
**Location:** `src/mockups/SiteFooter.jsx`

### Footer — copyright + links
**Current copy:** © 2026 Candid Finance · Privacy Policy · Terms of Service
**Location:** `src/mockups/SiteFooter.jsx`

### Waitlist form — email placeholder
**Current copy:** you@email.com
**Location:** `src/mockups/WaitlistForm.jsx`, `<input placeholder>`

### Waitlist form — submit button
**Current copy:** Join the waitlist (loading state: "Joining…")
**Location:** `src/mockups/WaitlistForm.jsx`, submit `<motion.button>`

### Waitlist form — success message
**Current copy:** You're on the list – we'll email you the moment Candid launches.
**Location:** `src/mockups/WaitlistForm.jsx`, success state

### Waitlist form — invalid email error
**Current copy:** Enter a valid email address.
**Location:** `src/mockups/WaitlistForm.jsx`, invalid state

### Waitlist form — generic error
**Current copy:** Something went wrong – please try again.
**Location:** `src/mockups/WaitlistForm.jsx`, error state
