# Finance engine audit, 2026/27

Audit of the calculation and recommendation logic in `src/lib/` against UK rules for the 2026/27 tax year (6 April 2026 to 5 April 2027). Started 8 October 2026.

**Scope:**
- **Covered:** tax, NI, savings, ISAs, pensions, investments, student loans, Property (stamp duty, borrowing, monthly budget, rent vs buy, the decision waterfall), and age and status handling.
- **Not changed:** UI components, copy and styling.

**Method:**
- I read every engine file and checked each figure against GOV.UK or HMRC (or FSCS and NS&I where those are the authority).
- Sources marked † were confirmed from the GOV.UK search result's quoted text rather than a full page read, because the page didn't render for the fetch tool. Every other source was read directly.

**Severity key:**
- **Number:** a wrong figure shown to users.
- **Advice:** a wrong recommendation.
- **Edge:** a case that's mishandled.
- **Hygiene:** a hard-coded or undated value, or a duplicate.

---

## 1. Rules checked and found correct

| Rule | Engine value | Source |
|---|---|---|
| Personal Allowance £12,570; taper £1 per £2 over £100,000, gone at £125,140 | tax.js | [income-tax-rates](https://www.gov.uk/income-tax-rates) |
| Bands (England, Wales, NI): 20% to £50,270, 40% to £125,140, 45% above | tax.js | same |
| Employee NI 8% from £12,570 to £50,270, 2% above | metrics.js, rentVsBuy.js | [rates-and-thresholds-for-employers-2026-to-2027](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027) |
| Personal Savings Allowance £1,000 / £500 / £0 | tax.js `PSA_BY_BAND` | [how much is tax free](https://www.gov.uk/apply-tax-free-interest-on-savings/how-much-is-tax-free)† |
| Savings rates 22/42/47% from 6 April 2027 (not Scotland) | tax.js `savingsTaxRates` | [changes to tax rates for property, savings and dividend income](https://www.gov.uk/government/publications/changes-to-tax-rates-for-property-savings-dividend-income/changes-to-tax-rates-for-property-savings-dividend-income) |
| Dividend allowance £500; 10.75 / 35.75 / 39.35% from 6 April 2026 | tax.js `dividendTaxRates`, rentVsBuy.js | [tax-on-dividends](https://www.gov.uk/tax-on-dividends) |
| ISA allowance £20,000; adults 18+; Lifetime ISA first payment before 40, £4,000 a year, 25% bonus, no payments from 50 | tax.js, moduleGuide.js | [individual-savings-accounts](https://www.gov.uk/individual-savings-accounts), [lifetime-isa](https://www.gov.uk/lifetime-isa) |
| Cash ISA £12,000 for under-65s from 6 April 2027; 65+ keep £20,000 | tax.js `cashIsaLimit` | [Cash ISA limit reduction](https://www.gov.uk/government/publications/reduction-in-the-cash-individual-savings-account-isa-limit/cash-individual-savings-account-isa-limit-reduction)† |
| CGT allowance £3,000; 18% within the basic band, 24% above | metrics.js, rentVsBuy.js | [capital-gains-tax/rates](https://www.gov.uk/capital-gains-tax/rates), [allowances](https://www.gov.uk/capital-gains-tax/allowances) |
| Annual allowance £60,000; taper over £200,000 threshold and £260,000 adjusted income, £1 per £2, minimum £10,000; MPAA £10,000 | pension.js | [pension schemes rates](https://www.gov.uk/government/publications/rates-and-allowances-pension-schemes/pension-schemes-rates), [tapered annual allowance](https://www.gov.uk/guidance/pension-schemes-work-out-your-tapered-annual-allowance)† |
| Carry forward up to 3 years | pension.js | [annual allowance](https://www.gov.uk/tax-on-your-private-pension/annual-allowance) |
| Lump Sum Allowance £268,275; LSDBA £1,073,100; FP2012 £450,000, FP2014 £375,000, FP2016 £312,500 | pension.js | [lump-sum-allowance](https://www.gov.uk/tax-on-your-private-pension/lump-sum-allowance), [PTM174700](https://www.gov.uk/hmrc-internal-manuals/pensions-tax-manual/ptm174700)† |
| Full new State Pension £241.30 a week; 35 years for the full rate | tax.js | [new-state-pension/what-youll-get](https://www.gov.uk/new-state-pension/what-youll-get) |
| Unused pensions in the estate for inheritance tax from 6 April 2027 | drawdown.js | [IHT on unused pension funds](https://www.gov.uk/government/publications/inheritance-tax-unused-pension-funds-and-death-benefits/inheritance-tax-unused-pension-funds-and-death-benefits) |
| Student loan thresholds: Plan 1 £26,900, Plan 2 £29,385, Plan 4 £33,795, Plan 5 £25,000, PG £21,000; 9% (PG 6%) | studentLoan.js | [rates-and-thresholds-for-employers-2026-to-2027](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027) |
| Interest from 1 Sept 2026: RPI 4.1%; Plan 2 RPI + up to 3% between £29,385 and £52,885, capped at 6%; PG capped at 6% | studentLoan.js | [what-you-pay](https://www.gov.uk/repaying-your-student-loan/what-you-pay), [terms and conditions 2026 to 2027](https://www.gov.uk/government/publications/student-loans-a-guide-to-terms-and-conditions/student-loans-a-guide-to-terms-and-conditions-2026-to-2027)† |
| Write-off: Plan 1 25 years, Plan 2 30, Plan 4 30, Plan 5 40, PG 30 (post-2006/2007 loans) | studentLoan.js | [when your loan gets written off](https://www.gov.uk/repaying-your-student-loan/when-your-student-loan-gets-written-off-or-cancelled) |
| Plan assignment by nation, course and start date | studentLoan.js | [which repayment plan you're on](https://www.gov.uk/repaying-your-student-loan/which-repayment-plan-you-are-on) (checked 5 October 2026, per the code) |
| SDLT: 0 / 2 / 5 / 10 / 12% at £125k / £250k / £925k / £1.5m; first-time buyers 0% to £300k, 5% to £500k, no relief above £500k; +5% on additional dwellings | stampDuty.js | [SDLT residential rates](https://www.gov.uk/stamp-duty-land-tax/residential-property-rates) |
| Premium Bonds: £50,000 maximum; prizes tax-free | assist.js, cash.js | [NS&I Premium Bonds](https://www.nsandi.com/products/premium-bonds) |

---

## 2. Factual errors: fixed in the engine, each with a test

| # | Location | What's wrong | Correct rule (source) | Severity | Fix |
|---|---|---|---|---|---|
| F1 | pension.js `calcBonusSacrifice` (`employerNISave`) | Employer NI saved on salary sacrifice worked out at 13.8% | Employer NI is 15% from April 2025 ([employer rates 2026 to 2027](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027)) | Number | Use 15%, from one tax.js constant |
| F2 | metrics.js `annualRepayment`, `willClear` | Plan 4 and Postgraduate loans (offered in onboarding) get £0 repayments and "won't clear", so they read as below the threshold at any salary | Plan 4: 9% over £33,795; PG: 6% over £21,000 ([what-you-pay](https://www.gov.uk/repaying-your-student-loan/what-you-pay)) | Number, Advice | One calculation for every plan, from its threshold, rate and write-off term |
| F3 | metrics.js `statePensionAnnual` | Pro rata for any number of NI years, so 5 years shows about £1,790 a year | At least 10 qualifying years are needed to get any new State Pension ([new-state-pension](https://www.gov.uk/new-state-pension)†) | Number | £0 below 10 years |
| F4 | pension.js `missedPensionRelief` | A 75+ year-old who's earning and not paying in is told they're missing tax relief (critical) | No relief on contributions from age 75 ([PTM044100](https://www.gov.uk/hmrc-internal-manuals/pensions-tax-manual/ptm044100)†) | Advice | No missed relief at 75 or over |
| F5 | metrics.js `niAnnual` (take-home, monthly surplus, Property budget) | Employee NI charged past State Pension age | Employees stop paying NI at State Pension age; Class 4 stops from the next 6 April ([NI after State Pension age](https://www.gov.uk/tax-national-insurance-after-state-pension-age)) | Number | No NI from 67, the age by which everyone has reached State Pension age until 2044. Age 66 is left as it is: see Q3 |
| F6 | metrics.js `niAnnual` | Self-employed charged employee NI at 8% | Class 4: 6% from £12,570 to £50,270, 2% above; Class 2 treated as paid ([self-employed NI](https://www.gov.uk/self-employed-national-insurance-rates)) | Number | Class 4 rates when self-employed |
| F7 | assist.js `savingsTax`, cash.js `psaLimit` | Only the Personal Savings Allowance counts as tax-free interest. Unused Personal Allowance and the £5,000 starting rate for savings are ignored, which overstates tax for low earners and retirees: for example, State Pension only plus £4,500 of interest is shown as £700 of tax, when it's £0 | 0% starting rate on up to £5,000 of interest, reduced £1 for every £1 of other income over the Personal Allowance, gone at £17,570 ([SAIM1112](https://www.gov.uk/hmrc-internal-manuals/savings-and-investment-manual/saim1112)†, [how much is tax free](https://www.gov.uk/apply-tax-free-interest-on-savings/how-much-is-tax-free)†) | Number, Advice | `taxFreeInterest()` in tax.js: unused Personal Allowance, plus the starting rate band, plus the PSA |
| F8 | pension.js `pensionReturnRatio`, `pensionReturnLabel` | Salary sacrifice counts a 2% NI saving only above £50,270, and none below, missing the 8% basic-rate saving | Employee NI is 8% from £12,570 to £50,270 and 2% above ([employer rates 2026 to 2027](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027)); none past State Pension age | Number | NI rate by earnings band, using the same helper as F5 and F6 |
| F9 | pension.js `calcBonusSacrifice` | Student loan interest hard-coded at 7.5% (Plans 2 and 5) and 5% (others); 9% deducted on a Postgraduate loan; nothing deducted when the bonus takes pay over the threshold | Current rates (`resolveSlRate`); PG deduction 6%; deductions on pay over the threshold ([what-you-pay](https://www.gov.uk/repaying-your-student-loan/what-you-pay)) | Number | Use studentLoan.js for the rate; deduct on the part over the threshold |
| F10 | metrics.js `projectedPot`, pension.js trajectory, forecast.js | The projected pot counts the employer's whole match cap, even when the user pays less than the cap and the employer only matches what they pay | The app's own model: the employer matches 1:1 up to the cap, the same as `missedMatch` and the allowance check | Number | Count the employer's matched share (lower of the two) |
| F11 | aiPrompt.js `taxBand` | "60% taper zone" can never be chosen: the higher-rate check comes first, so the chat is told "Higher rate (40%)" between £100k and £125,140 | Personal Allowance taper ([income-tax-rates](https://www.gov.uk/income-tax-rates)) | Advice (chat context) | Check the taper first |
| F12 | pension.js `inRetirement` | Someone under 55 whose retirement age has passed (for example a target of 50) is put in retirement mode and shown drawdown and tax-free cash they can't take yet | Minimum pension age 55, rising to 57 from 6 April 2028 ([increasing NMPA](https://www.gov.uk/government/publications/increasing-normal-minimum-pension-age/increasing-normal-minimum-pension-age)†) | Advice | Retirement mode only from the minimum pension age (dated by tax year) |
| F13 | metrics.js `incomeTaxAnnual` (take-home, surplus, Property budget) | Dividends taxed as salary (20/40/45%, no allowance) | £500 allowance, then 10.75 / 35.75 / 39.35% ([tax-on-dividends](https://www.gov.uk/tax-on-dividends)) | Number | Tax dividends on their own rates, on top of other income |

Hygiene fixed alongside these (no change to any figure):
- **H1:** the NI rates and thresholds, the employer NI rate and the CGT allowance live once in tax.js; the files that repeated them now read them from there.
- **H2:** the carry-forward table's years are worked out from the tax year instead of being typed in ("2025/26" and so on).

---

## 3. Waiting for your go-ahead: product decisions, missing inputs, or outside the engine

| # | Location | Issue | Rule (source) | Severity | Proposed fix | Why it's paused |
|---|---|---|---|---|---|---|
| Q1 | studentLoan.js, metrics.js | Write-off is counted from today, not from the April repayments were first due, so someone who graduated in 2018 is projected to 2056 instead of April 2049. That makes "will clear" and "worth overpaying" more likely than they should be | Written off 30 / 25 / 40 years after the April first due ([write-off](https://www.gov.uk/repaying-your-student-loan/when-your-student-loan-gets-written-off-or-cancelled)) | Advice | Ask the year repayments started, or estimate it from age | Needs an input the app doesn't collect |
| Q2 | tax.js, everything that uses it | Scottish taxpayers have their own income tax bands. Savings and dividend rates are UK-wide. LBTT and LTT aren't calculated (already labelled in the app) | [income-tax-rates](https://www.gov.uk/income-tax-rates) ("different if you live in Scotland") | Number | Ask where they live; add the Scottish bands | Residence isn't collected |
| Q3 | metrics.js, drawdown.js | State Pension age depends on date of birth: 66 for people born before 6 April 1960, 66 plus 1 to 11 months for 6 April 1960 to 5 March 1961, 67 after. The app only has age, so at 66 it can't tell (State Pension in payment, NI) | [State Pension age timetable](https://www.gov.uk/government/publications/state-pension-age-timetable/state-pension-age-timetable)† | Edge | Collect month and year of birth, or keep 66 as an approximation | Needs an input the app doesn't collect |
| Q4 | rentVsBuy.js, forecast.js, the Investments screen | Investment growth is 7% for stocks and shares ISAs and rent vs buy, but 6% for pensions (growth.js) | Candid's own assumption | Hygiene | Use one figure | Product decision |
| Q5 | metrics.js | Student loan repayments are on salary only. GOV.UK says repayments include bonuses and overtime, and unearned income over £2,000 through Self Assessment | [what-you-pay](https://www.gov.uk/repaying-your-student-loan/what-you-pay) | Number | Include the bonus | The app treats the bonus as irregular everywhere else |
| Q6 | pension.js `calcPensionTaperSaving` | The £100k trap saving always includes 2% NI, as if paid by salary sacrifice. Relief-at-source payments save no NI, and none is saved past State Pension age | [employer rates 2026 to 2027](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027) | Number | 0 NI unless salary sacrifice | The tile's wording proposes salary sacrifice; your call on framing |
| Q7 | pension.js `calcCarryForward` | Carry forward only offered from £100k of earnings | Candid's threshold | Edge | None proposed | Product decision |
| Q8 | moduleStatus.js | Mortgage rate "above average" fixed at 4.5% | Market figure | Hygiene | Read from the rate feed | Product decision |
| Q9 | pension.js `PROTECTED_LUMP_SUM` | Individual Protection gives 25% of the protected amount, up to £375,000 (2014) or £312,500 (2016). The app uses the maximum | [PTM174700](https://www.gov.uk/hmrc-internal-manuals/pensions-tax-manual/ptm174700)† | Edge | Ask for the protected amount when it's Individual Protection | Needs a new question (UI) |
| Q10 | MobilePensionDeepDive.jsx:477, CandidApp.jsx:3612 and 4307, MobilePensionDeepDive.jsx (`niSavingPct`) | The UI repeats F1 ("Employer NI of 13.8%", in copy and in the desktop calculation) and F8 (an NI saving only above £50,270) | As F1 and F8 | Number | Change the copy and these calculations to match | Outside the engine files, and changes copy |
| Q11 | stampDuty.js | 2% surcharge for buyers not resident in the UK isn't modelled | [SDLT rates](https://www.gov.uk/stamp-duty-land-tax/residential-property-rates) | Edge | Add a residency question | Residence isn't collected |
| Q12 | pension.js (bonus and salary sacrifice) | Announced: from 6 April 2029 only the first £2,000 a year of salary-sacrificed pension contributions is free of NI | [salary sacrifice from April 2029](https://www.gov.uk/government/publications/changes-to-salary-sacrifice-for-pensions-from-april-2029/changes-to-salary-sacrifice-for-pensions-from-april-2029)† | Edge (future) | Switch on by tax year in April 2029, like the other dated rules | Announced change; the date is set |
| Q13 | sharedQuestions.js (age), waterfall.js | No minimum age. Under-18s would be shown adult ISA allowance as unused (ISAs are 18+) | [individual-savings-accounts](https://www.gov.uk/individual-savings-accounts) | Edge | Set a minimum age of 18 | Product decision |
| Q14 | studentLoan.js, metrics.js | Projections hold repayment thresholds flat. Plan 2 is frozen until 2029/30 (correct); Plans 1, 4 and 5 normally rise with RPI each April, so future repayments come out slightly high | [Student loan forecasts methodology](https://explore-education-statistics.service.gov.uk/methodology/student-loan-forecasts-for-england)† | Edge | Index the Plan 1, 4 and 5 thresholds | Assumption choice |

Also noted, no change proposed:
- **FSCS:** cover rose from £85,000 to £120,000 per person per firm on 1 December 2025 ([FSCS](https://www.fscs.org.uk/media/press/2025/nov/fscs-welcomes-higher-deposit-protection-limit-of-120000--giving-people-confidence-their-money-is-protected/)). The engine doesn't use the limit; the cash allocation could suggest more than £120,000 with one bank.
- **The tapered annual allowance** is rounded down to £1,000 and shown as approximate. HMRC doesn't round.
- **The CGT saving** takes all of the £3,000 at 18% for basic-rate taxpayers, even when some of it would fall above the band at 24%.
- **Not modelled:** Marriage Allowance, Blind Person's Allowance, and the High Income Child Benefit Charge (£60,000 to £80,000, [child-benefit-tax-charge](https://www.gov.uk/child-benefit-tax-charge)). The Kids module that would use the charge is hidden.

---

## 4. Outcome

### Fixed (F1 to F13, H1, H2)

All in `src/lib/`: tax.js, metrics.js, pension.js, assist.js, cash.js, forecast.js, aiPrompt.js and rentVsBuy.js. No UI, copy or styling was touched. Nothing has been committed.

The figures users will see change as follows:

| # | Before | After (example) |
|---|---|---|
| F1 | Employer NI saved on a £10,000 sacrificed bonus: £1,380 | £1,500 |
| F2 | Plan 4, £50,000 salary: £0 a year, "below the threshold" | £1,458 a year. Postgraduate on £50,000: £1,740 a year |
| F3 | 9 NI years: about £3,226 a year of State Pension | £0. 10 or more years unchanged |
| F4 | Aged 76, earning £40,000, nothing paid in: "critical, tax relief missed" | No gap shown |
| F5 | Aged 70 on £40,000: £2,194 a year of NI taken off take-home pay | £0, so the monthly surplus and the Property budget rise by about £183 a month |
| F6 | Self-employed on £60,000: £3,211 of NI | Class 4 £2,457, so take-home rises by about £63 a month |
| F7 | Retiree with only the State Pension, £4,500 of interest: £700 of tax | £0; the cash plan treats £6,022 as tax-free, not £1,000. Earners above £17,570 unchanged |
| F8 | Salary sacrifice on £40,000: return ratio 1:1.25 | 1:1.39 (20% tax + 8% NI). Above £50,270: 1:1.72, unchanged. Past State Pension age: tax only |
| F9 | Bonus sacrifice on a Postgraduate loan: 9% student loan; interest saved at a hard-coded 7.5% or 5% | 6%; the plan's real rate; only the part over the threshold |
| F10 | Pays 3% with a 5% match: projected pot counted 8% a year | 6% a year (3% + 3% matched) |
| F11 | Chat told "Higher rate (40%)" at £110,000 | "60% taper zone" |
| F12 | Aged 52 with a retirement age of 50: drawdown section shown | Not shown until the minimum pension age (55; 57 from April 2028) |
| F13 | £30,000 salary and £10,000 of dividends: taxed at 20% with no allowance | £500 allowance, then 10.75%: £4,507 of tax, not £5,486, so take-home rises by about £82 a month |
| H1 | Repeated constants in metrics, pension and rentVsBuy | One source (tax.js); no figure changes |
| H2 | Carry-forward years typed in as 2025/26 to 2023/24 | Worked out from the tax year, so they move on 6 April 2027 |

Two choices I made while fixing, which you should know about:
- **Age 66:** F5 and F8 treat 67 as definitely past State Pension age. A 66-year-old still has NI worked out (see Q3). The State Pension added at 66 in step 2 (`statePensionIncome`) is unchanged, so 66 is treated differently in the two places until Q3 is decided.
- **Unknown income:** when Candid doesn't know someone's other income, F7 counts only the Personal Savings Allowance as tax-free, as before.

The investor model (`scripts/personas`) calls `cashOpportunity` and `calcStudentLoanScenario`, so its figures will shift slightly when it's next run. It hasn't been rerun.

### Deferred (section 3, Q1 to Q14)

None of these were changed. Each needs your decision, an input the app doesn't collect, or a change outside the engine files:
- **Biggest effect:** Q1 (student loan write-off counted from today), Q2 (Scottish taxpayers) and Q10 (the UI repeats F1 and F8: "Employer NI of 13.8%" in the copy, and the desktop and mobile calculations).

### Tests added

`src/lib/audit.test.js`: 15 tests, one for each of F1 to F13 and H2, plus F7's unknown-income case. Each failed before its fix and passes after. The full suite: 347 passing, 0 failing. The production build compiles.

---

## 5. Your decisions on section 3, and what was built (8 October 2026)

Tests: `src/lib/audit2.test.js` (14 tests, each written before its change). Existing tests whose expected figures changed because of these decisions were updated, and each change is noted below. Full suite: 361 passing, 0 failing. The production build compiles. Nothing has been committed.

| # | Your decision | What was built | What changes for users |
|---|---|---|---|
| Q1 | Estimate from age; make it an editable assumption | `studentLoan.js`: `slFirstDueYear` (the April after turning 22, or the user's own year; never before the plan's first repayments: Plan 2 2016, Plan 5 2026, Postgraduate 2018) and `slYearsLeft`. Used by the scenario, `metrics.willClear` and the Forecast loan simulations. The student loan screen says "Written off in April 2048. We've assumed repayments started in April 2018, the April after you turned 22", with a Change button and "Use the estimate" | A Plan 2 borrower aged 30 is projected to April 2048 (22 years), not 30 years from today. "Will clear" and "worth overpaying" become less likely for anyone who started repaying years ago |
| Q2 | England and Northern Ireland for now | No change. Welsh income tax is currently the same as England's; Scottish taxpayers would see English bands | None |
| Q3 | Use judgement; date of birth is an option | Kept age, rather than changing the app's age input everywhere. One rule (`metrics.pastStatePensionAge`): past State Pension age at 67; at 66 unless they've said they don't get it yet. The State Pension question now goes to everyone 66+, with an "I don't get it yet" answer. NI, the State Pension in income and drawdown all use the rule | At 66, NI stops and the State Pension counts as income, unless they answer "I don't get it yet". This removes the 66/67 inconsistency left by the first round |
| Q4 | 6% over 7% | Rent vs buy "invested", Forecast investments, the Investments ISA projection, and the sort weights now use `GROWTH_NOMINAL_PCT` (6%) | Investment projections are lower: an unused £20,000 allowance grown over 30 years shows about £115k, not £152k |
| Q5 | Include the bonus | `slEarnings`: salary plus bonus, less pension paid by salary sacrifice (relief-at-source payments don't reduce it). Used in `annualRepayment`, the scenario, Forecast and bonus sacrifice. Monthly take-home and surplus use the part without the bonus | £40,000 plus a £10,000 bonus on Plan 2: £1,855 a year, not £955. With 5% salary sacrifice, repayments fall. Existing test updated: `studentLoan.test.js` now expects pay after salary sacrifice |
| Q6 | No NI saving unless salary sacrifice | `calcPensionTaperSaving`: NI only for salary sacrifice and before State Pension age. The pension screen says "in tax" rather than "in tax and NI" when there's no NI | The £100k trap figure drops by 2% of the sacrifice for relief-at-source and unknown payers |
| Q7 | Is £100k sensible? Flag it as a strategy | Kept £100k. Carry forward can only add anything once earnings exceed the £60,000 allowance, since payments in can't exceed 100% of earnings, and it's mostly used above £100k. The tile is now tagged "Strategy" instead of "Today" | Tag only |
| Q8 | Read from the rate feed | There's no mortgage feed yet: the weekly feed reads savings products only. `computeModuleStatuses` now takes `marketRates.avgMortgageRate` when supplied, with `AVERAGE_MORTGAGE_RATE_PCT` (4.5%) as the fallback | None until a feed supplies a figure. The Mortgage module is hidden for the MVP |
| Q9 | Add the question | Protection options are now separate: Fixed 2012, 2014, 2016 and Individual 2014, 2016. For Individual Protection, a "protected amount" question; the limit is the lower of 25% of it and £375,000 or £312,500 ([PTM174600](https://www.gov.uk/hmrc-internal-manuals/pensions-tax-manual/ptm174600)†). Answers saved before the split still read as the fixed figures | An IP2014 holder with £1.2m protected sees £300,000, not £375,000 |
| Q10 | Approved, UI and calculations | Pension screen: "Employer NI of 15%" (from `EMPLOYER_NI_RATE`); the sacrifice calculator's NI rate by band. Desktop: its bonus sacrifice block now uses `calcBonusSacrifice` (15%, plan rates, real loan interest); tooltip says "8% up to £50,270, 2% above" | As F1, F8 and F9, now on screen too |
| Q11 | Yes | `calcStampDuty({ nonResident })`: +2% on every band, first-time buyer rates included. A Property question: "Have you lived in the UK for at least 183 days in the last 12 months?", with answers for couples (no surcharge if married or civil partners and one of them is resident) ([non-UK residents](https://www.gov.uk/guidance/rates-of-stamp-duty-land-tax-for-non-uk-residents)†). Existing Property guide tests updated for the new question | A non-resident buying at £400,000 sees £18,000 of stamp duty, not £10,000. Unanswered counts as resident. The refund for later becoming resident isn't modelled |
| Q12 | Approved | `salarySacrificeNiCap(taxYear)`: £2,000 from tax year 2029. Applied to the salary sacrifice return ratio, the £100k trap NI saving, and bonus sacrifice (NI due on the part over the cap; employer NI saving only on the NI-free part) | Nothing until 6 April 2029 |
| Q13 | Agreed | The age question needs 18 or over. Continue stays off, with "Candid is for adults: you need to be 18 or over." (`GuidedFlow.jsx` supports a `min`) | Under-18s can't continue. The older assessment and desktop age inputs don't enforce it |
| Q14 | Agreed | `slThresholdIn`: Plan 1 rises with RPI from April 2027; Plan 5 from April 2027; Plan 2 frozen to 2029/30, then RPI; Postgraduate flat (no uprating announced). Plan 4 flat: no GOV.UK source confirmed its uprating. RPI taken at Candid's 2% ([student loan forecasts methodology](https://explore-education-statistics.service.gov.uk/methodology/student-loan-forecasts-for-england)†) | Projected Plan 1 and 5 repayments are a little lower in later years |
| FSCS | Reflect it | `allocateCash` and the Assist cash plan put no more than £120,000 with one provider (NS&I exempt: Treasury-backed), and spill the rest into the next account. The screens say "FSCS protects up to £120,000 with each bank, counting anything you already hold there" | Only for more than £120,000 in savings. It doesn't know about banks sharing one licence, or money already held with a bank |

Still open:
- **Q8:** decided: no feed. The engine compares against fallbacks in order: a rate the user has been offered (`mortgageOfferRate`), then a reference rate entered by hand (`marketRates.avgMortgageRate`), then 4.5%. See `mortgageComparisonRate` in moduleStatus.js; there's a test in audit2.test.js. Still to do when the Mortgage module returns: the optional "Have you been offered a rate for when your fix ends?" question, and, if wanted, the hand-entered reference rate on /admin/rates.
- **Q13:** closed. The older assessment and desktop are being phased out, so they won't get the 18+ rule.
- **Q14:** Plan 4's uprating rule, to confirm from the Student Awards Agency Scotland.

### Checklist for each tax year

**Every April (new tax year):**
- [ ] Income tax: Personal Allowance, bands, £100k taper (frozen until April 2031): `tax.js`
- [ ] NI: primary threshold, upper earnings limit, 8%/2%, Class 4 6%/2%, employer 15%: `tax.js`
- [ ] Personal Savings Allowance, starting rate for savings (£5,000), dividend allowance and rates, CGT allowance and rates: `tax.js`
- [ ] Savings rates 22/42/47% switch on from tax year 2027: `tax.js savingsTaxRates`
- [ ] ISA £20,000; Cash ISA £12,000 for under-65s from 2027; Lifetime ISA £4,000: `tax.js`, `onboarding.js` caps
- [ ] Pensions: annual allowance, taper limits, MPAA, Lump Sum Allowance, protections: `pension.js`
- [ ] Minimum pension age 57 from tax year 2028: `pension.js minimumPensionAge`
- [ ] State Pension weekly rate (uprated each April) and the State Pension age timetable: `tax.js`
- [ ] Student loan repayment thresholds (Plan 2 frozen until 2029/30): `studentLoan.js`. Move `SL_THRESHOLDS_TAX_YEAR` on with them, and confirm the uprating rules in `slThresholdIn` (Plan 4 still unconfirmed)
- [ ] Salary sacrifice: £2,000 NI cap from April 2029 (Q12)
- [ ] Inheritance tax on pensions from tax year 2027: `drawdown.js`

**Every September:**
- [ ] Student loan interest rates (RPI, the Plan 2 range and cap, Postgraduate cap): `studentLoan.js`

**After each Budget or fiscal event:**
- [ ] SDLT bands, first-time buyer relief, surcharges: `stampDuty.js`
- [ ] Any newly announced dated change: add it with its start tax year, as `savingsTaxRates` does

**Assumptions to review once a year (Candid's own, not set by law):**
- [ ] Growth: 6% pensions, 7% investments, 2% inflation (Q4)
- [ ] Mortgage "above average" 4.5% (Q8), default mortgage rate, rent growth, selling costs
- [ ] FSCS limit (£120,000 from 1 December 2025): `cashAllocation.js FSCS_DEPOSIT_LIMIT`
- [ ] Student loan start age (22) and RPI for thresholds (2%): `studentLoan.js`
- [ ] Non-resident SDLT surcharge (2%): `stampDuty.js`
