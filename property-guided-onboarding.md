# Property: guided first pass

A plain-English, one-question-per-screen walk-through the first time someone opens Property. When it ends, they land on the existing step screens, unchanged.

**Status:** all three steps are built. The questions and the rules for when each walk-through starts are in `src/lib/propertyGuide.js`, and the screens are in `src/mobile/property/GuidedFlow.jsx`.

## How it works

- **One question per screen.** The question is the headline, with one input below it and one "why it matters" line under that.
- **The result fills in as they answer.** The blurred result card sits at the top, so each answer visibly moves it closer to a figure.
- **Never ask twice.** Anything Candid already has, from onboarding or another module, is skipped. Someone who did core onboarding with Cash & savings and Pension sees 4 to 6 questions in Readiness.
- **Short bites.** Each step has its own walk-through on its first visit, not one long flow. It starts by itself only on a blank step:
  - Readiness: still incomplete.
  - Mortgage: no term, rate or fix set.
  - Rent vs buy: no rent entered.

  Once finished or skipped, it doesn't come back on its own.
- **"I'm not sure"** appears wherever a sensible default exists. The button says what it will use, e.g. "Use the London average, £550,000".
- **Back and skip.** Back is always available. "Skip to the full view" leaves the walk-through at any point.
- **Again later.** After the walk-through, the step shows the current dense inputs. A "Walk me through it" link can rerun it.
- **One progress indicator only** (e.g. "3 of 6"). No second progress marker.
- **Single source.** The question, the why line, the input, the default and the skip rule are defined once. Answers save to the same inputs the dense view uses. In the dense view, the "?" beside each of those fields shows the same why line. Fields that already had a fuller explainer keep it: first-time buyer, sole property and cash available.
- **Measured.** PostHog records `property_guide_finished`, `property_guide_skipped` (with the question it was left at) and `property_guide_restarted`.

## Answers and movement

- **Choices** (yes/no, alone/together, region) are full-width answer buttons stacked vertically. One tap answers and moves on. The dense view keeps its toggles.
- **£ and %** use the pill input with a Continue button, which the keyboard's Go/Enter also triggers. Continue stays off until there's an answer where one is needed.
- **Movement.** The question moves up about 30px and fades out (0.15s), then the next rises from below (0.25s). Back reverses this. With reduced motion on, questions only fade. If the result card has scrolled out of view, the page scrolls back to it so the answer is seen landing.

## Rules for the "why it matters" line

- One sentence, 15 words at most.
- Say what the answer changes for *them*, not what the term means.
- No jargon. If a term is unavoidable (freehold, leasehold), the question explains it.
- Figures (£300,000, 5%, 3 months, £20,000) are read from the code, not typed, like the calculator pages.
- It must be true in every region it's shown in. Where it isn't, give a regional variant.

## Step 1: Readiness

| # | Question | Why it matters | Answer | If not sure | Asked when |
|---|---|---|---|---|---|
| R1 | Are you buying on your own or with someone? | Lenders add incomes together, so buying together usually means borrowing more. | On my own / With someone | n/a | Always |
| R2 | What does your partner earn a year, before tax? | Added to your income to work out what you could borrow. | £ | Left blank, counts as £0 | Together |
| R3 | Does your partner have any other regular income? | Regular extra income, like rent from a property, counts towards what you could borrow. | £ | "No other income" | Together |
| R4 | Where are you buying? | Stamp duty and local prices depend on where you buy. | Region list | n/a | Always |
| R5 | Have you ever owned a home, in the UK or abroad? | If not, you could pay no stamp duty on the first £300,000. | Yes / No | n/a | England or Northern Ireland |
| R6 | Has your partner ever owned a home? | First-time buyer relief only applies if neither of you has. | Yes / No | n/a | Together, England or Northern Ireland |
| R7 | Will you (either of you) still own another home after buying this one? | Keeping another home adds 5% stamp duty on the whole price. | Yes / No | n/a | England or Northern Ireland, and not every buyer is a first-time buyer |
| R8 | Roughly what price are you looking at? | Sets your stamp duty and how much you'd need to borrow. (Scotland and Wales: "Sets how much you'd need to borrow.") | £ | Regional average price | Always |
| R9 | What do you spend in a typical month? | We keep 3 months of this aside before counting your cash towards a home. | £ | n/a | Expenses missing |
| R10 | How much cash could you put towards buying? | It pays the deposit, stamp duty and fees. The mortgage covers the rest. (Scotland and Wales: no stamp duty.) | £, prefilled | Keeps the prefill | Always |

R9 comes before R10 because the cash prefill keeps three months of spending back. The prefill comes with a caption: "Your savings, less 3 months' spending kept back for emergencies."

Scotland and Wales: their property tax isn't asked. The result's breakdown shows it as "Not included" unless they enter their own figure in the full view.

**The checks** come after R10, led by one line: "Before you put money into a deposit". Each is only asked if Candid doesn't have the figure yet.

| # | Question | Why it matters | Answer | If not sure | Asked when |
|---|---|---|---|---|---|
| C1 | What percentage of your salary do you pay into your workplace pension? | Your employer may add more if you pay in more. | % | Skip, check stays open | Match not known |
| C2 | Up to what percentage will your employer match it? | An unclaimed match is free money, worth taking before saving a deposit. | % (caption: "It's in your contract, or ask HR.") | Skip, check stays open | Match not known |
| C3–C5 | C1 and C2 for the partner, then "How much has your partner paid into ISAs since 6 April?" | Same lines with "their". ISA: "Their £20,000 allowance is lost if it's not used by 5 April." | | Skip, check stays open | Together |

Your own ISA figure isn't asked here. The ISA check only counts once Cash & savings or Investments is filled in, so it keeps its link to those modules, as decision 1 does for cash savings.

C2 is where the payslip upload shortcut belongs once it's built.

**Not asked**, so dense view only: legal and survey fees (default £2,500).

## Step 2: Mortgage, on first visit

| # | Question | Why it matters | Answer | If not sure |
|---|---|---|---|---|
| M1 | How many years do you want the mortgage over? | Longer lowers the monthly payment but costs more interest overall. | Years, 30 shown | Continue keeps 30 |
| M2 | What interest rate do you expect? | Each 1% adds about £X a month on this loan. | %, 4.5% shown (caption: "4.5% is Candid's starting figure. Use a quote if you have one.") | Continue keeps 4.5% |
| M3 | How long would you fix the rate for? | Your payment stays the same until the fix ends, then you'd remortgage. | 2 / 3 / 5 / 10 years | n/a |

In M2, the £X is worked out from their own loan and term, to the nearest £10, so the reason is specific to them. If no loan is needed, the line reads "Sets your monthly payment." The repayment card is there from the first question, so each answer moves a figure that's already showing.

**Not asked:** the remortgage fee (default £1,000).

## Step 3: Rent vs buy, on first visit

| # | Question | Why it matters | Answer | If not sure | Asked when |
|---|---|---|---|---|---|
| V1 | What do you pay in rent each month? | Buying is compared against what you'd keep paying in rent. | £ | "I don't pay rent" (£0) | Always |
| V2 | How many years would you stay before selling? | Buying costs come up front, so the longer you stay, the better buying looks. | Years, 5 shown | Continue keeps 5 | Always |
| V3 | Will you own the land (freehold) or lease it (leasehold)? | Leasehold adds ground rent and a service charge every year. | Freehold / Leasehold (caption: "Most houses are freehold, and most flats leasehold.") | n/a | Always |
| V4 | What's the yearly ground rent? | A yearly cost of owning that a renter doesn't pay. | £ | Left blank, counts as £0 | Leasehold |
| V5 | And the yearly service charge? | Covers the building's upkeep, and usually rises faster than inflation. | £ | Left blank, counts as £0 | Leasehold |
| V6 | If you rented instead, would your spare money sit in savings or be invested? | Investments usually grow faster than savings, which favours renting. | Savings / Invested | n/a | Always |

£0 rent now counts as an answer everywhere, including the full view and the Supabase record. Before, the result waited for rent above £0.

**Not asked:** house price and rent growth, the ground rent rise, the cash or investment rate, and the dividend share. These are shown as assumptions under the result, as now.

## Decisions

1. **Cash savings when Cash & savings wasn't chosen:** keep the current "Add Cash & savings" link. Don't ask for a total here.
2. **Price "not sure":** offer the average price for their region. Added to `regionalRates.js` from the UK House Price Index, July 2026 (Northern Ireland Q2 2026), the same release as the growth figures.
3. **First-time buyer outside England and Northern Ireland:** not asked, in the walk-through or the full view, and not needed to unlock steps 2 and 3. Focus is England and Northern Ireland for now.
4. **Scotland and Wales property tax:** not asked. Shown as "Not included" (see above).
5. **Rent:** allow £0.
6. **Skipping the walk-through:** offered from the first screen.
7. **Answers:** answer buttons and movement as described above.
