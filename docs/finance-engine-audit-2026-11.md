# Finance engine re-audit and screen figures check, November 2026

Follows `docs/finance-engine-audit.md` (8 Oct 2026) and the brief in `docs/figures-audit-brief-2026-11.md`. Started 16 Nov 2026. Report only: no code was changed.

**Status of this document**

- **Part 1 (engine): done** for tax, NI, the £100k trap, pensions, childcare, cash, student loans, module statuses, saved figures and the year-end and bonus alerts.
- **Part 1, Property: done** by a background check (stamp duty, borrowing, mortgage, rent vs buy, loan files). Its findings are P1 to P3 in section 2. Every source it used is †, and it could not read the official Budget 2026 document.
- **Part 1, forecast, windfall, drawdown, Assist, emails and the public calculator pages: done** by a second background check. Its findings are F1 to F12 in section 2. It read its sources through a summarising fetch, did not open the Budget 2026 document, and did not build the public pages (findings there come from the page source).
- **Part 1, not read in full:** `netWorthView.js`, `guesses.js`, `cashQuick.js`, `pensionQuick.js`, `studentLoanQuick.js`, `moduleReveal.js`, `reportRow.js`. Only the parts named below were checked.
- **Fixed, batch 1 (tax trap and pension), 16 Nov 2026:** E1 to E11, E12 except the Postgraduate turning point, and F8's Sunday email salary sacrifice cap. Each has a test in `src/lib/audit2026-11.test.js`. Two screen changes from the batch (a payday question with pay to date, and the interest line on the trap page) wait for Harvey's check. Also fixed after review: a weekend payday moved into the month before, a payday on the 6th moved before 6 April, and Cash ISA money left out of the interest. Not fixed: dividends are still stacked below savings interest only for the allowance taper, not for the dividend bands (the interest is still left out of the bands, as before).
- **Still open:** Property (P), forecast and windfall (F, with Q12), public pages and emails, and the Postgraduate edge in E12. One batch per session.
- **Part 2 (screens): not started.** Section 3 is empty.

**Method**

- Figures marked "ran" come from running the real engine functions with the clock set to the date given, in throwaway scripts that have been deleted.
- Sources marked † were confirmed from a GOV.UK search result's quoted text, not a full page read. Sources marked ‡ were not re-read this session: the constant is unchanged since the October audit, which checked it.
- The test snippets are written out, not committed, and none has been run.

---

## 1. Rules checked and found correct

| Rule | Value in the engine | Where | Source |
|---|---|---|---|
| Savings interest rates from 6 April 2027 | 24% / 44% / 49% | `tax.js savingsTaxRates` | [Budget 2026](https://www.gov.uk/government/publications/budget-2026-document/budget-2026-html)†, [HMRC note on savings and property rates](https://www.gov.uk/government/publications/income-tax-changes-to-tax-rates-for-property-and-savings-income/income-tax-changes-to-tax-rates-for-property-and-savings-income)† |
| Cash ISA limit | £20,000; the £12,000 cap is scrapped | `tax.js cashIsaLimit` | [Budget 2026 press release](https://www.gov.uk/government/news/budget-2026-breathing-space-for-today-hope-for-the-future)† |
| Student loan thresholds | Plan 1 £26,900, Plan 2 £29,385, Plan 4 £33,795, Plan 5 £25,000, Postgraduate £21,000; 9% and 6% | `studentLoan.js` | [GOV.UK: what you pay](https://www.gov.uk/repaying-your-student-loan/what-you-pay) |
| Student loan interest | Plans 1, 4, 5: 4.1%. Postgraduate 6%. Plan 2: 4.1% to 6% between £29,385 and £52,885 | `studentLoan.js` | Same page. The shape of Plan 2's ramp is question Q1 |
| Child Benefit | £27.05 and £17.90 a week | `pension.js` | [GOV.UK: Child Benefit](https://www.gov.uk/child-benefit/what-youll-get) |
| Full new State Pension | £241.30 a week, 35 years for the full rate | `tax.js`, `metrics.js` | [GOV.UK: new State Pension](https://www.gov.uk/new-state-pension/what-youll-get) |
| Premium Bonds | 4.35% prize fund rate, £50,000 limit | `cash.js PB_RATE` (fallback; the live row is used when the feed has it) | [NS&I](https://www.nsandi.com/products/premium-bonds) |
| Income tax, the £100k taper, NI, dividends, CGT, PSA, starting rate for savings | Unchanged since October | `tax.js` | ‡ |
| Annual allowance £60,000, taper £200k/£260k, floor £10,000, MPAA £10,000, Lump Sum Allowance £268,275, minimum pension age 57 from 6 April 2028 | Unchanged | `pension.js` | ‡ |
| High Income Child Benefit Charge: 1% per £200 over £60,000 | Unchanged | `pension.js` | ‡ |
| Tax-Free Childcare 20% up to £2,000 a child; £100,000 limit | Unchanged | `childcare.js` | ‡ |
| FSCS £120,000 | Unchanged | `cashAllocation.js` | ‡ |
| Stamp duty: 0% to £125k, 2% to £250k, 5% to £925k, 10% to £1.5m, 12% above | As listed | `stampDuty.js:17` | [GOV.UK residential rates](https://www.gov.uk/stamp-duty-land-tax/residential-property-rates)† |
| First-time buyer relief: 0% to £300k, 5% to £500k, none above £500,000 | As listed | `stampDuty.js:20` | Same page† |
| Additional property +5 points from £40,000; non-resident +2% | As listed | `stampDuty.js:13`, `:26` | [Additional property](https://www.gov.uk/guidance/stamp-duty-land-tax-buying-an-additional-residential-property)†, [non-residents](https://www.gov.uk/guidance/rates-of-stamp-duty-land-tax-for-non-uk-residents)† |
| Lender income multiple 4.5 | As listed | `borrowing.js:9` | [Bank of England PS, Oct 2026](https://www.bankofengland.co.uk/prudential-regulation/publication/2026/october/high-loan-to-income-lending-policy-statement)† |

**Behaviour checked by running it, and correct:**

- **Income edges (ran, 16 Nov 2026).** £99,000: 42% on the next £1,000. £100,000: not over, 62% on the next £1,000. £100,001: over, £1 needed. £125,140: £5,028 of allowance tax, still "higher" band. £125,141: "additional" band. Tax at each matches a hand calculation.
- **A bonus that crosses £100k.** £92,000 plus a £15,000 bonus: trap £1,400, £7,000 needed, bonus potential £7,400 (£7,000 at 60% and £8,000 at 40%).
- **Plan 2 plus Postgraduate on £45,000.** £1,405 and £1,440 a year, both taken at once.
- **Age 66 and 67 (Q3 rule).** 66 counts as past State Pension age unless they said "I don't get it yet"; 67 always does.
- **FSCS spill.** £300,000 splits £120,000 / £120,000 / £60,000 across three providers.
- **6 April 2027 rollover.** The savings rate moves from 40% to 44% for a higher-rate taxpayer on the day, ISA payments roll, and top-ups from 2026/27 drop out.
- **Stamp duty at every band edge** (£125,000, £250,000, £300,000, £500,000, £925,000, £1.5m, each and £1 over): correct, standard and first-time buyer. £500,000 first-time buyer £10,000; £500,001 £15,000. About 70,000 price and flag combinations matched whole-pound arithmetic.
- **Mortgage maths.** £200,000 at 4.5% over 25 years: £1,111.66 a month. Max price, rent vs buy and the loan balance roll give the same result when run twice.
- **Walk-throughs.** `moduleExplainer.js` reads `ISA_ALLOWANCE`, `cashIsaLimit`, `CGT_ANNUAL_ALLOWANCE` and the live Premium Bonds rate. No hard-coded limits found.

---

## 2. Factual errors and mishandled cases in the engine

Largest £ effect first. "Known" means the brief already listed it; it's confirmed and measured here.

### E1. Savings interest isn't counted in adjusted net income
- **Where:** `metrics.js:212` (`adjustedNetIncome`).
- **Rule:** adjusted net income is total taxable income, which includes savings interest outside an ISA. It decides the £100k taper, the childcare limit and the Child Benefit charge.
- **Example (ran):** £99,000 salary, one child not yet at school, £80,000 in savings at 4.5% (£3,600 of interest). Candid shows the trap as "edge", £0, and Kids & family as "£1,000 under the £100,000 childcare limit". The real income is £102,600: £520 of allowance tax and **£10,290 a year of childcare support lost**.
- **Also affects:** the tax band used for the Personal Savings Allowance, for anyone whose interest takes them over £50,270 or £125,140.
- **Test:**
  ```js
  it("counts taxable savings interest in adjusted net income", () => {
    const m = calcMetrics({ salary: "99000", cashTiers: [{ amount: "80000", rate: "4.5" }] });
    expect(m.adjustedNetIncome).toBe(102600);
  });
  ```
- See Q2: how to count it is a product decision.

### E2. The Pension module's bonus figure ignores top-ups and pay to date (known)
- **Where:** `moduleStatus.js:239`, `moduleReveal.js:195`, `MobilePensionDeepDive.jsx:167`, `weekly.js:339` all call `calcBonusSacrificePotential(d, m)` on the user's own answers. Only `alerts.js:160` uses this tax year's figures.
- **Example (ran):** £100,000 salary, £20,000 bonus, 5% salary sacrifice, a £15,000 top-up recorded. Pension shows "up to **£2,000** of avoidable tax on your bonus"; on this tax year's figures it's **£8,000**, which is what the bonus email says. Understated by £6,000, and two places disagree.
- **Test:**
  ```js
  it("bonus potential in the pension status uses this tax year's figures", () => {
    const d = withTopUps({ salary: "100000", bonusAmount: "20000", myContribution: "5", pensionType: "sacrifice" }, 15000);
    expect(computeModuleStatuses(d, calcMetrics(d)).pension.potentialAmount).toBe(8000);
  });
  ```

### E3. The year-end alert measures the trap two ways
- **Where:** `alerts.js:116` (with pay to date: the allowance tax only, 20% of the gap) and `alerts.js:121` (without: all the tax saved, 60% of the gap).
- **Example:** income of £110,000. With pay to date entered the email says "£2,000 of tax"; without it, "£6,000 of tax". Same person, same payment of £10,000. The module itself shows £2,000.
- **Test:** the alert's `tax` for a £110,000 income is the same with and without `payToDate` that projects to £110,000.

### E4. On 6 April, a false "did you make a change?" for the trap (known)
- **Where:** `moduleStatus.js:624` (`pendingBank`), with `changeEnd`.
- **What happens (ran, clock 6 Apr 2027):** £110,000 salary, pay to date £70,000, an £8,000 top-up banked at £1,600. On 6 April the trap shows £900 with nothing pending, which is right. Change any trap answer (pension 5% to 6%) and it asks whether they made a change worth **£2,028**. They didn't: £1,600 of that is last year's top-up ending.
- **Test:** after `rollTaxYear` into 2027 and one answer change, `pendingBank(d, "taxTrap", amount)` is at most the fall caused by that answer (£220).

### E5. Pay to date entered before the nominal payday counts that month twice
- **Where:** `taxTrap.js:325` (`paydaysBetween(on, end, payday)`), `DEFAULT_PAYDAY = 28`.
- **Rule:** the projection adds a month's pay for every payday after the date the figure was entered. Paydays move earlier at weekends, and the payday is assumed to be the 28th until the user says.
- **Example (ran):** £110,000 salary, payday 28. 28 Nov 2026 is a Saturday, so pay arrives Friday 27th. Pay to date of £70,000 entered on the 27th projects **£113,542**; entered on the 28th, **£104,833**. The trap figure is overstated by £1,742 a year. The same happens for anyone paid on, say, the 25th who hasn't set their payday.
- **Test:** `yearProjection` for pay to date dated the working day before a weekend payday equals the projection dated on the payday.
- Part 2 should check whether the check-in can be reached before the payday, and whether it asks for the payday.

### E6. A top-up's saving is counted by the day, though it's saved for the whole tax year
- **Where:** `moduleStatus.js:645` (`IN_FULL` holds only Investments) and `:670`.
- **Example (ran):** the £8,000 top-up above, recorded 16 Nov 2026, keeps £1,600 of tax for 2026/27. By 5 April "Saved" shows **£618** (141 days of 365). A top-up made in March would show about a tenth of its saving.
- Capital gains tax savings already count in full for the same reason. See Q3.

### E7. `thisTaxYear` gives a different answer if run on its own output (known)
- **Where:** `taxTrap.js:372`.
- **Example (ran):** £110,000 salary, pay to date £70,000 on 28 Oct. First run: implied salary £119,518, trap £2,708. Run again on the result: £123,483 and **£3,462** (+£754). With an £8,000 relief-at-source top-up: £1,108, then £1,862.
- **Reach:** 13 call sites. The engine ones (`moduleStatus`, `alerts`, `guesses`, `moduleReveal`, `progressTracker`, `taxTrapRecord`) pass the user's own answers. The three deep-dive screens weren't traced: Part 2.
- **Test:** `const a = thisTaxYear(d, m); const b = thisTaxYear(a.d, a.m); expect(taxTrap(b.d, b.m).amount).toBe(taxTrap(a.d, a.m).amount);`

### E8. NI on a bonus is worked out on the year, not the pay period
- **Where:** `pension.js:339` (`niRateOnBonus`), used by the bonus sacrifice calculator.
- **Rule:** employee NI is charged on each pay period. A bonus paid in one month is mostly above that month's upper limit (£4,189), so most of it pays 2%, even for a basic-rate earner. Directors are on an annual basis.
- **Example (by hand):** £45,000 salary, £10,000 bonus. Candid: 8% = **£800** of NI on the bonus. Monthly: £439 at 8% and £9,561 at 2% = **£226**. The NI "saved" by sacrificing the bonus is overstated by £574.
- Not in the October audit. See Q4.

### E9. On 5 April the days left read as 366
- **Where:** `metrics.js:373` (`daysToTaxYearEnd`) and the copy of it at `moduleStatus.js:95`. Both compare with midnight at the start of 5 April.
- **Example (ran, £60,000 salary):** 4 April: 1 day, ISA fillable £21, Investments "critical". 5 April: **366 days**, ISA fillable £7,572, Investments drops to "attention" on deadline day. `windfall.js:359` uses it too. `alerts.js` and `taxTrap.js` have their own counts, which are right.
- **Test:** `expect(daysToTaxYearEnd(new Date(2027, 3, 5, 10))).toBeLessThanOrEqual(1);`

### E10. Take-home pay charges NI on salary that was sacrificed
- **Where:** `metrics.js:321` (`calcNI(salary, …)`).
- **Example (ran):** £40,000 with 5% salary sacrifice: NI £2,194, should be £2,034. Take-home is understated by £13 a month (£160 a year); £19 a month at £110,000 with 10%. The trap module's own take-home (`taxTrap.js position`) does it correctly, so the two differ.
- **Test:** monthly take-home for `pensionType: "sacrifice"` equals `position(d, m).takeHome / 12` for a profile with no bonus.

### E11. Annual allowance room on the user's own answers ignores top-ups (known)
- **Where:** `moduleStatus.js:235`, `moduleReveal.js:167`.
- **Example (ran):** £110,000, 5% matched, £8,000 of top-ups, pay to date implying £119,518. Own-answers room **£49,000**; this tax year's room after top-ups **£40,048**. Overstated by £8,952. It only feeds "over your allowance" checks and the cap on E2, so no £ shown is wrong until someone is near £60,000.
- The other half of the known issue, the regular % worked out on the salary after top-ups, is real (`m.salarySacrifice` £5,555 against £5,976) but adjusted net income still comes out right (£105,542), and `calcAnnualAllowanceRoomBeforeTopUps` corrects the room where it's used.

### E12. Smaller edges
- **Postgraduate turning-point salary** (`studentLoan.js:210`) divides by 9%, not 6%. A £12,000 Postgraduate loan shows £29,000; it should be £33,000.
- **Paydays on the 1st to 5th** (`taxTrap.js:295`): April's payday is placed before the tax year starts, so the monthly plan has one month fewer than the paydays left (ran: payday 3, 16 Nov: 5 paydays left, 4 plan months). The monthly amount comes out a quarter higher than needed.
- **UTC dates** (`moduleStatus.js:531`, `:630`): a change banked between midnight and 1am in summer time is dated the day before. On 6 April that puts it in last tax year. `taxTrapRecord.js` already uses the local date.
- **Annual allowance taper, relief at source** (`pension.js:223`): grosses the contribution up by 1/0.8, while `metrics.js` and `calcAnnualAllowanceRoom` treat the same % as already gross. Only matters above £200,000.
- **Stale pay to date after 6 April:** `rollTaxYear` leaves `payToDate` in place. It's ignored (wrong tax year), so no figure is wrong.

### Property (from the background check; figures not re-run by me)

By £ effect these rank: P1 above E1, P2 between E4 and E5, P3 with E12.

**P1. The additional-property surcharge is charged on someone replacing their main home**
- **Where:** `stampDuty.js:42-44`, `borrowing.js:80`, the question at `propertyGuide.js:112-114` ("Will you still own another home after buying this one?").
- **Rule:** the higher rates don't apply when the purchase replaces your main residence, even if you keep another property ([GOV.UK](https://www.gov.uk/guidance/stamp-duty-land-tax-buying-an-additional-residential-property)†).
- **Example:** a home-mover who keeps a buy-to-let, buying at £400,000: Candid shows **£30,000** of stamp duty; it should be **£10,000**. The extra £20,000 also comes off the deposit and the maximum price.
- Needs a new question: see Q7.
- **Test:** `calcStampDuty({ price: 400000, nation: "england", firstTimeBuyers: [false], additionalProperty: true, replacingMainResidence: true }).total` is `10000`.

**P2. Rent vs buy taxes a basic-rate renter's whole gain at 18%**
- **Where:** `rentVsBuy.js:244`, `:246`.
- **Rule:** only the gain that fits in the unused basic-rate band is at 18%; the rest is at 24%.
- **Example:** £45,000 salary, £400,000 home, renter invests at 6% for 15 years: gain £55,417, CGT **£9,435**, should be **£12,264**. The renter's side is overstated by £2,829 (£1,399 at 10 years, £4,699 at 25).
- Needs each person's taxable income, not only their band.

**P3. Non-resident 2% charged under £40,000**
- **Where:** `stampDuty.js:43-44`. £39,999 gives £799; should be £0. Not a realistic home price.

**Property hygiene**
- `REGIONAL_RATES_SNAPSHOT` (`regionalRates.js:11`) is one ONS release behind (September; October came out 21 Oct). It's the fallback only. London house prices −3.3% against −2.2%.
- `NATIONAL_STATS.pension` (`nationalStats.js:8`) rests on a 2017 figure.
- `SDLT_RATES_FROM` says "confirmed 1 October 2026", before the 28 October Budget. Trade press says stamp duty was unchanged; no official source was read.
- `CGT_RATE` in `rentVsBuy.js:86` is a local copy, not from `tax.js`.

### Forecast, windfall, emails and public pages (from the second background check; figures not re-run by me)

"Base" is the characterisation profile: age 32, £55,000, 5% salary sacrifice. By £ effect, F1 to F3 rank above E1 with P1; F4 to F6 sit between E1 and E2.

**F1. A mortgage with no monthly payment entered grows for ever** (`forecast.js:498-503`)
- £240,000 at 5.4% with `monthlyMortgage` blank: the balance reaches **£411,343** by year 10 and £110,000 of equity goes to £0 in the net worth projection. It should stay at or under £240,000.
- **Test:** `calcNetWorthTrajectory(d, m, 10, 0)[10].mortgageBalance <= 240000`.

**F2. Forecast's mortgage and student loan lines leave out the money paid in** (`forecast.js:185`, `:220-222`)
- Overpaying £500 a month for 10 years shows **£19,325** (interest saved only) beside £81,940 for the ISA, which counts the £60,000 paid in. Like for like it's £79,325. A lump sum is counted in full on the mortgage line, so the two inputs are treated differently. The screen says "The same amount goes into each line".
- Student loan line: £2,901 against £67,358 for the ISA on £300 a month plus £10,000.

**F3. The public student loan page counts the write-off from today** (`student-loan-calculator.html:265-268`)
- Plan 2, £40,000 salary, £30,000 balance, £150 a month, 10 years into repaying. The page says overpaying **saves £23,563**. With 20 years left it **costs £8,565 more**. The app handles this (`slYearsLeft`); the page has no "when did you start repaying" input.

**F4. Windfall pension relief uses the top band's rate on the whole amount** (`windfall.js:255-267`)
- Base with relief at source, £50,000 inheritance: £10,000 into a pension shows **£6,667** of relief; only £1,980 of income is in the 40% band, so it's **£2,995**. At the cap: £20,900 shown, £8,332 right (£12,568 over).

**F5. Forecast's salary sacrifice line has the same fault** (`forecast.js:264-272`)
- Base, £300 a month for 10 years: **£84,765**, should be about **£73,541**. It also keeps the NI saving past April 2029, when this user is already over the £2,000 cap.

**F6. Cash entered at 0% is projected at 3.5%** (`forecast.js:448`, `metrics.js:137`: `rate || 3.5`)
- £20,000 at a stated 0% becomes **£28,367** by year 10.

**F7. Redundancy pay over £30,000 isn't counted as earnings for pension relief** (`windfall.js:104`)
- £20,000 earned, £5,000 notice, £80,000 compensation: "up to **£25,000** can go in with relief". Relevant earnings are £75,000 (HMRC PTM044100), so the limit is the £60,000 annual allowance. £7,000 of relief not shown.

**F8. Smaller**
- **Forecast cash, own rate over 5%** (`forecast.js:254`): "high" (£77,641) comes out below "central" (£79,754).
- **Public mortgage-vs-savings page** taxes interest at 20/40/45% for periods running past 6 April 2027 and pools the Personal Savings Allowance across years. Higher rate, £1,000 a month, 5 years: £1,858 of tax shown, £2,130 with 44%. `pageFigures.js` has no savings-rate tokens.
- **Sunday email, salary sacrifice cap** (`weekly.js:202`): NI over the cap priced at 2% on gross salary. £52,000 sacrificing 10%: "£64 a year", should be £256.
- **17 December Bank Rate event** (`outsideEvents.js:31`) has no `from`, so a change would read as "held".
- **`addMonths`** (`assist.js:48`): 31 Aug plus 6 months gives 3 March.
- **Copy:** "Your ISA allowance resets on 5 April" (`assist.js:408`); it's the 6th. `nextIsaReset` shares E9's 5 April fault.

**Found correct there:** year-0 net worth in the projection equals `calcMetrics().netWorth` on 8 profiles; breakdown lines sum to the total for years 0 to 30; drawdown tax and the Lump Sum Allowance cap; settlement tax with the £30,000 exemption; the public pages' tokens match `tax.js` and `studentLoan.js`.

**Hygiene there**
- Screen copy: `MobileForecastScreen.jsx:341,357` says investments grow at "7% p.a."; the engine uses 6%.
- `outsideEvents.js` has no dates after 17 December 2026.
- All three public pages show "last updated 13 October 2026", before the Budget.
- Repeated literals: `60000` in `windfall.js:224,239`; `50270` and NI rates in `weekly.js:45,202`; tax rates in `crossModule.js:95,135` and `drawdown.js:46-52`; `PB_MAX` in `assist.js:31`; growth 4/6/8 in `forecast.js`.
- Stale comments in `forecast.js:368,389,400`.

### Known issues: the rest
- **Cash account ids are positional.** Removing an account from its net worth row page shifts the ids in the saved history (`worthEdit.js:123`), so that path is fine. Removing one in Cash's own list or Edit inputs wasn't traced: Part 2.
- **`worthNotes` and `worthByAccess`** have no callers outside tests. Nothing renders from them, so they can't disagree with `netWorthView`.
- **Plan 4's uprating rule:** not checked this session. Still unconfirmed.

---

## 3. Screen mismatches

Not started. To carry over from Part 1 for checking on screen: E2 (Pension tile against the bonus email), E3, E5 (can pay to date be entered before payday?), E7 (the three deep dives), E10 (take-home on the trap page against Home), and cash accounts deleted outside the net worth row page.

---

## 4. Questions for Harvey

| # | Question | £ effect | Recommendation | Harvey (16 Nov 2026) |
|---|---|---|---|---|
| Q1 | **Plan 2 interest between £29,385 and £52,885.** Candid adds 3 points across the band and caps at 6%, so it hits 6% at about £44,268. GOV.UK now words it as "4.1%, plus up to 1.9%", which could mean a straight line to 6% at £52,885 | At £45,000 with a £45,000 balance: 6% against 5.36%, £287 a year of interest | Confirm with the Student Loans Company's interest page before changing anything | Keep the current method: add-on = (salary − £29,385) ÷ £23,500 × 3%, plus RPI, capped at 6% (cap in place until 31 Aug 2027). It reaches the cap at about £44,268; £52,885+ would be 7.1% uncapped. No change |
| Q2 | **Savings interest in adjusted net income (E1).** Count interest on savings outside ISAs at the user's own rates? | Up to £10,290 of childcare for someone just under £100k | Yes. It uses figures Candid already has. Say on the trap page that interest is included | Approved |
| Q3 | **Top-up savings by the day or in full (E6)?** | £982 on the example; more for a March top-up | In full on the day, as capital gains tax savings are | Approved |
| Q4 | **NI on a bonus (E8):** monthly, or keep the yearly sum? | £574 on a £10,000 bonus at £45,000 | Monthly for employees. Candid doesn't ask whether someone is a director | Monthly. Approved |
| Q5 | **Which trap figure in the year-end email (E3):** the allowance tax (20% of the gap, as the module) or all the tax the payment saves (60%)? | £4,000 at £110,000 | The module's figure, so the email and the app agree | Approved |
| Q7 | **Stamp duty for home-movers who keep another property (P1).** Add "Are you selling your main home to buy this one?" (it goes in `ADDED_LATER`) | £20,000 at £400,000 | Yes | Approved |
| Q8 | **Lifetime ISA in Property.** It isn't counted in the deposit, and nothing flags the £450,000 price cap. The background check reports the charge over the cap fell to 20% on 29 Oct 2026†: not confirmed by me | £12,500 of deposit moves the maximum price from £215,000 to £227,000 for a £45,000 earner | Count it for first-time buyers under the cap; confirm the charge first | Approved |
| Q9 | **Forecast's relief-at-source pension line uses 20% only**, while salary sacrifice gets the marginal rate | About £20,500 lower over 10 years for a 40% payer at £300 a month | Use the same band-by-band relief for both (with F5) | Approved |
| Q10 | **Retirement adequacy counts a full State Pension from the retirement age** (`crossModule.js:124,197`), whatever the NI years; drawdown uses NI years | £12,548 a year for each year retired before 67 | Use the NI-years figure, from State Pension age | Approved |
| Q11 | **Windfall's annual allowance is a flat £60,000**: no taper, no £10,000 limit after drawing income | Up to £50,000 too much room shown | Use `calcAnnualAllowanceRoom` | Approved |
| Q12 | **Forecast lines are before tax and limits:** cash interest untaxed, ISA line ignores the £20,000 allowance, pension lines ignore tax on the way out | Cash: about £4,800 over 10 years at £500 a month for a higher-rate payer | Say so on the screen, or tax the cash line | Not before tax: taxable growth should compound net of tax, and the ISA line must respect the £20,000 allowance, or figures are badly inflated. Pension tax on withdrawal stays out, with a footnote saying the pensions line doesn't account for it |
| Q13 | **The public student loan page (F3):** add "when did you start repaying?" | Flips the answer; about £32,000 on the example | Yes | Approved |
| Q6 | **The default payday (E5).** Ask for it at the first check-in, or treat a figure entered within a few days before the payday as including that month? | £1,742 on the example | Ask for it at the first check-in | Approved |

---

## 5. The yearly checklist, updated

Changes from the October list are in bold.

**Every April (new tax year):**
- [ ] Income tax: Personal Allowance, bands, £100k taper (frozen until April 2031): `tax.js`
- [ ] NI: primary threshold, upper earnings limit, 8%/2%, Class 4 6%/2%, employer 15%: `tax.js`
- [ ] Personal Savings Allowance, starting rate for savings, dividend allowance and rates, CGT allowance and rates: `tax.js`
- [ ] **Savings rates 24/44/49% switch on from tax year 2027 (was 22/42/47; the October 2026 Budget added 2 more points): `tax.js savingsTaxRates`. The comment in `cash.js` still says "2 points"**
- [ ] ISA £20,000; **Cash ISA £20,000 for everyone (the £12,000 cap was scrapped)**; Lifetime ISA £4,000: `tax.js`
- [ ] Pensions: annual allowance, taper limits, MPAA, Lump Sum Allowance, protections: `pension.js`
- [ ] Minimum pension age 57 from tax year 2028: `pension.js minimumPensionAge`
- [ ] State Pension weekly rate and the State Pension age timetable: `tax.js`
- [ ] Student loan thresholds (Plan 2 frozen until 2029/30): `studentLoan.js`. Move `SL_THRESHOLDS_TAX_YEAR` on; Plan 4's uprating still unconfirmed
- [ ] **Child Benefit weekly rates and the £60,000 to £80,000 charge: `pension.js`**
- [ ] **Childcare: Tax-Free Childcare cap, the £100,000 limit, the hourly price behind funded hours (£7.27, Coram 2026): `childcare.js`**
- [ ] **Scottish bands and rates: `tax.js SCOTTISH_BANDS`**
- [ ] Salary sacrifice: £2,000 NI cap from April 2029
- [ ] Inheritance tax on pensions from tax year 2027: `drawdown.js`
- [ ] **Run the trap with the clock on 5 and 6 April: top-ups end, pay to date resets, nothing asks "did you make a change?" (E4, E9)**

**Every September:**
- [ ] Student loan interest rates (RPI, the Plan 2 range and cap, Postgraduate cap): `studentLoan.js`

**After each Budget or fiscal event:**
- [ ] SDLT bands, first-time buyer relief, surcharges: `stampDuty.js`
- [ ] Any newly announced dated change: add it with its start tax year

**Assumptions to review once a year:**
- [ ] Growth 6%, inflation 2%
- [ ] Mortgage "above average" 4.5%, default mortgage rate, rent growth, selling costs
- [ ] FSCS limit £120,000: `cashAllocation.js`
- [ ] Student loan start age (22) and RPI for thresholds (2%): `studentLoan.js`
- [ ] **Premium Bonds fallback rate (4.35%): `cash.js PB_RATE`**
- [ ] **Quick-start bands and the median defaults (taken 25 Oct 2026): `quickStart.js`, `taxTrapQuick.js`**
- [ ] **Default payday (28th) and default bonus month (March): `taxTrap.js`**
