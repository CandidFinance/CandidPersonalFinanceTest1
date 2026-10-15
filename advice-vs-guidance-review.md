# Candid: advice vs guidance risk review

Reviewed 12 October 2026, against the code on `main` (`dc795ed`). This is a risk review, not legal advice. It does not conclude whether Candid is, or is not, carrying on a regulated activity. Several points need a solicitor or regulatory counsel to confirm (listed at the end).

## Summary

1. **The highest risk is the named-provider lists on the Pension and Investments screens.** They sit under the user's own figures, highlight one provider ("Lowest cost", "Easiest consolidation"), call it "Best for…", and link straight to "Open SIPP" / "Start pension". For an unauthorised firm, the test is advice on the merits of a *particular* investment ([PERG 8.24.1G–8.24.2G](https://handbook.fca.org.uk/handbook/perg8/perg8s25)), and these lists are the part of Candid that names particular investments.
2. **The second is a handful of investment steers.** These are "Move this into your S&S ISA", "Putting money you won't need for five years or more into a Stocks and Shares ISA…", and "VCTs and EIS are the usual alternative". The first two describe the FCA's own example of the new regulated *targeted support* activity.
3. **Most other copy is on the guidance side or close to it.** That covers the tax-rule explanations, the student loan, cash and property maths, the drawdown illustration with its Pension Wise signpost, and Assist's unranked choice of savings accounts. The grey areas are imperative headings ("Pay your bonus into your pension") and words like "advice", "tailored plan" and "how to fix it".
4. **Charging raises the stakes on the paywall wording.** It currently sells "how to fix it" and "Every module's answer", which reads as selling a recommendation. The app's own screens also carry no "guidance, not advice" statement, except on Property.
5. **The AI-written report is not live** (the app went code-only), but it, the PDF and the old desktop modules, which name more providers, can still be reached by typed URL.

### Top 5 changes before charging begins

| # | Change | Why first | Changes behaviour? |
|---|---|---|---|
| 1 | On Pension and Investments, remove the provider lists from the personalised screens, or make them neutral: alphabetical, no highlight, no badges, no "best", a "Visit site" button, and a "not a recommendation" line that's always visible. Correct the "may earn a referral fee… our ranking" line. | Names particular investments with a value judgement. Highest risk, and the CTAs may also be financial promotions. | **Yes**, layout and order. Needs your decision. |
| 2 | Rewrite the three investment steers (S&S ISA x2, VCT/EIS) as options with trade-offs. | Directs money into investments, based on the user's own figures. | No, wording only. |
| 3 | Remove "advice", "tailored plan", "action plan", "roadmap", "how to fix it" and "every module's answer" from the onboarding, landing and paywall copy. | Self-describes the product as advice, and charging makes the description matter more. | No. |
| 4 | Add a persistent in-app statement on every module screen and the paywall ("Guidance, not advice: what Candid does and doesn't do"), plus MoneyHelper, Pension Wise and find-an-adviser signposts on Pension and Investments. | Right now only the Property screen says it. | No. Wording and a small UI addition. |
| 5 | Switch off the legacy routes (`/assessment`, `/dashboard`, `/module/:key`, the PDF), and make `api/claude.js` build its own prompt on the server instead of accepting any prompt from the browser. | Old surfaces name more providers and use "quick win" AI copy. The open AI proxy can't be guard-railed. | **Yes**, removes routes. Needs your decision. |

## A correction on where the provider figures come from

You said the pension and ISA figures are meant to be the highest-rate accounts, sourced from MoneySuperMarket. The code shows otherwise:

- **Cash** savings and Cash ISA rates are live. Candid reads them itself from 22 provider web pages (`rate_sources`: Chase, Trading 212, Plum, NS&I and others), not from MoneySuperMarket, and lists them sorted by rate.
- **Pension (SIPP) and Stocks and Shares ISA** lists are hand-written in the code ([CandidApp.jsx:734-752](src/CandidApp.jsx#L734-L752)). They have fixed fee figures and badges chosen by Candid, and nothing updates them. They are fees, not rates, so there is no "highest rate" to sort by. The badges ("Lowest cost", "Widest range", "Easiest consolidation") are Candid's own judgements.
- No outbound link carries an affiliate or tracking parameter, yet both lists say "Candid may earn a referral fee".

## Surfaces reviewed

| Surface | Where | Statements reviewed |
|---|---|---|
| Pension screen, drawdown planner, pension reveal | `MobilePensionDeepDive.jsx`, `MobileDrawdown.jsx`, `drawdown.js`, `pension.js`, `moduleReveal.js` | ~150 |
| Investments screen and reveal | `MobileInvestmentsDeepDive.jsx`, `moduleReveal.js` | ~40 |
| Cash screen, Candid Assist, reveal | `MobileCashDeepDive.jsx`, `CandidAssist.jsx`, `assist.js`, `moduleReveal.js` | ~110 |
| Student loan screen and reveal | `MobileStudentLoanDeepDive.jsx`, `studentLoan.js`, `moduleReveal.js` | ~65 |
| Property (borrowing, budget, rent vs buy) | `MobilePropertyScreen.jsx`, `propertyGuide.js`, `propertyReveal.js` | ~120 |
| Provider lists | `CandidApp.jsx:725-755`, `MobileProviderTile.jsx`, `MobileProductListTile.jsx` | 3 lists, 7 named pension/ISA products plus live cash lists |
| Module questions and summary lines | `moduleGuide.js`, `moduleStatus.js` | ~160 |
| Entry chat, onboarding, Home, Modules, Forecast tabs | `appEntry.js`, `MobileOnboardingStep.jsx`, `MobileHomeScreen.jsx`, `MobileModulesScreen.jsx`, `MobileForecastScreen.jsx`, `forecast.js` | ~140 |
| Paywall, sign-in, rate alerts, unlock survey | `MobileUnlock.jsx`, `SignInPage.jsx`, `unlock.js` | ~35 |
| Emails: sign-in, HR drafts, reminders | `api/billing.js`, `emailDrafts.js`, `MobileReminderAction.jsx` | ~17 |
| Marketing site and calculators | `NewLandingPage.jsx`, `HowItWorksPage.jsx`, `TheProblemPage.jsx`, `SiteFooter.jsx`, `index.html`, 3 calculator pages | ~45 |
| Terms and privacy | `terms.html`, `privacy.html` | Reviewed earlier today; relevant points below |
| Legacy, unlinked but reachable: AI report prompt, PDF, desktop modules | `aiPrompt.js`, `api/claude.js`, `src/pdf/*`, `CandidApp.jsx` desktop screens | ~60 |
| Dev-only, never deployed: Assist account-opening agent | `scripts/assist-agent/*`, `AgentPanel.jsx` | 7 (noted, not classified) |

About 950 statements were reviewed. Most are neutral questions, figures and tax-rule explanations, classed as **clearly guidance** and not listed one by one. The table below lists every grey-area and advice-risk item, plus examples of the guidance-side patterns worth keeping.

## Regulatory frame used

- **Which test applies to Candid.** For an unauthorised person, the FCA says the relevant definition is advice "in his capacity as an investor or potential investor" on a *particular* investment. "It is not relevant to such a person whether or not the advice is a personal recommendation" ([PERG 8.24.1D–8.24.2G](https://handbook.fca.org.uk/handbook/perg8/perg8s25)). So naming particular products and judging them is the core risk. Talking about ISAs or pensions in general is less likely to be "a particular investment", though that is an inference to confirm (counsel item 1).
- **Advice vs information.** Advice "requires an element of opinion". Information given "without making any comment or value judgment" is generally not advice. Information that is "the product of a process of selection involving a value judgment", or given "on a selected, rather than balanced, basis", can become advice. "Any significant element of evaluation, value judgment or persuasion is likely to mean that advice is being given." Saying something "is a very good buy" but leaving the choice to the customer is still advice ([PERG 8.28](https://www.handbook.fca.org.uk/handbook/PERG/8/28.html)).
- **Personal recommendations (useful analogy).** PERG 8.30B is written for authorised firms, but its examples show how the FCA reads tools:
  - highlighting one product counts as an implicit recommendation (8.30B.9G)
  - simple single-factor filters generally do not (8.30B.27G–28G)
  - tools that present outputs as meeting the customer's needs can (8.30B.33G)
  - "a legalistic disclaimer is unlikely to be enough" (8.30B.32G)

  ([PERG 8.30B](https://handbook.fca.org.uk/handbook/PERG/8/30B.html))
- **Cash.** Advising on investments "does not… include giving advice about deposits (except structured deposits)" ([PERG 2.7.15](https://handbook.fca.org.uk/handbook/perg2/perg2s7)). That is why Cash, Cash ISAs and Assist score lower here. Premium Bonds should be confirmed separately.
- **Mortgages.** Advising on regulated mortgage contracts concerns "a particular regulated mortgage contract". The FCA's example of crossing the line is a firm identifying specific products and steering the customer to them ([PERG 4.6](https://handbook.fca.org.uk/handbook/PERG/4/6.html)). Candid's Property screen names no mortgage products.
- **Targeted support.** This is a new regulated activity from 6 April 2026 for authorised firms with permission. The FCA's own examples include "suggesting an ISA to someone holding excess cash" ([FCA Advice Guidance Boundary Review](https://www.fca.org.uk/firms/advice-guidance-boundary-review)). Candid's investments steer is close to that example.
- **Financial promotions.** An unauthorised person must not, in the course of business, communicate an invitation or inducement to engage in investment activity unless it is approved by an authorised firm with s21 approver permission, or an exemption applies ([PERG 8.9](https://handbook.fca.org.uk/handbook/perg8/perg8s9); [FCA PS23/13](https://www.fca.org.uk/publication/policy/ps23-13.pdf)).
- **Pension decumulation signposting.** Pension Wise (MoneyHelper) gives free, impartial guidance to people aged 50+ with a defined contribution pot, and "doesn't recommend any products" ([pensionwise.gov.uk](https://pensionwise.gov.uk); [MoneyHelper](https://www.moneyhelper.org.uk/en/pensions-and-retirement/pension-wise/understanding-what-pension-wise-is-and-how-to-use-it)).
- **Consumer law for paid claims.** Misleading actions and omissions, including true information "presented in a misleading way", are unfair commercial practices ([DMCC Act 2024, Part 4 Chapter 1](https://www.legislation.gov.uk/ukpga/2024/13/part/4/chapter/1)).

## Findings

Classifications: **Advice risk** (fix before charging), **Grey** (reword), **Guidance** (keep). Locations link to the line.

### Provider lists

| Surface | Location | Current wording | Class | Why | Safer version |
|---|---|---|---|---|---|
| Pension providers | [CandidApp.jsx:745-754](src/CandidApp.jsx#L745-L754), shown at [MobilePensionDeepDive.jsx:647-651](src/mobile/deepdive/MobilePensionDeepDive.jsx#L647-L651) | Title "Consolidate or top up" (source heading "Consider consolidating or topping up"). PensionBee gold-highlighted, badge "Easiest consolidation", button "Start pension". Vanguard SIPP "Lowest cost… Best long-term value for hands-off investors", "Open SIPP". | **Advice risk** | Particular investments, a value judgement ("best"), one highlighted (8.30B.9G), placed under the user's own figures, and a consolidation steer (moving old pensions can lose guarantees). The CTAs may be financial promotions. | **Preferred:** remove the list from the personalised screen. **Alternative:** a neutral page, "Some pension providers (alphabetical, not a recommendation)". No highlight, no badges, no "best", same facts for each (fees, type, minimums), "Visit site" button. Add: "Before moving an old pension, check for exit fees and any guaranteed benefits you'd lose. MoneyHelper explains how." Title "Ways to pay in more", not "Consolidate or top up". |
| ISA platforms | [CandidApp.jsx:725-740](src/CandidApp.jsx#L725-L740), [MobileInvestmentsDeepDive.jsx:262-267](src/mobile/deepdive/MobileInvestmentsDeepDive.jsx#L262-L267) (open by default) | "Here's where you could actually do this:" Vanguard highlighted "Lowest cost… Best for low-cost, long-term investors", HL "Best platform for active investors", "Open S&S ISA". Subheading "consider a Bed & ISA strategy next tax year". | **Advice risk** | As above, for particular ISA products, with suitability-style labels ("for active investors"). | As above. Replace "Best for…" with neutral facts ("Funds and ETFs; platform fee 0.15%"). Start closed. Drop "Here's where you could actually do this". |
| Referral-fee line | [CandidApp.jsx:740](src/CandidApp.jsx#L740), [754](src/CandidApp.jsx#L754) | "Candid may earn a referral fee — this does not affect our ranking." Only shown once the list is expanded. | **Advice risk** (accuracy) | No referral arrangement is visible in the links, so the line may be untrue (misleading action). "Our ranking" confirms it is a ranking. | If no fees: "Candid isn't paid by any provider listed. Listed alphabetically; not a recommendation." Always visible, not inside the expanded list. |
| Cash rate lists | [MobileCashDeepDive.jsx:239-247](src/mobile/deepdive/MobileCashDeepDive.jsx#L239-L247) | Live rates, sorted by rate, "See all N rates". | Guidance | Deposits sit outside advising on investments (PERG 2.7.15). A single objective sort is a filter (8.30B.27G). | Keep. Use "highest rates" rather than "best", and show "Rates checked [date]". |

### Investments

| Surface | Location | Current wording | Class | Why | Safer version |
|---|---|---|---|---|---|
| ISA allowance tile | [MobileInvestmentsDeepDive.jsx:245-247](src/mobile/deepdive/MobileInvestmentsDeepDive.jsx#L245-L247) | Heading "Move this into your S&S ISA": "You have £X of surplus cash above your 3-month emergency fund and £Y of unwrapped investments — £Z of ISA allowance is available to shelter it from tax, permanently." | **Advice risk** | Instruction to move the user's own money into an investment, based on their circumstances. Matches the FCA's targeted-support example. | Heading "How this year's ISA allowance could be used": "£Z of this year's allowance is unused. In a Stocks and Shares ISA, growth is free of tax but the money is invested, so it can fall as well as rise; it tends to suit money not needed for several years. A Cash ISA uses the same allowance without that risk. Investments you already hold can be moved in over time ('Bed and ISA'), which can create a taxable gain." |
| Investments reveal | [moduleReveal.js:170-171](src/lib/moduleReveal.js#L170-L171) | "Putting money you won't need for five years or more into a Stocks and Shares ISA would use it. Investments can fall as well as rise." | **Advice risk** | Names one course of action as the answer. | "A Stocks and Shares ISA, for money you won't need for five years or more, or a Cash ISA, for money you might, would use it. Which suits depends on when you'll need it and how you feel about risk." |
| CGT allowance | [MobileInvestmentsDeepDive.jsx:160](src/mobile/deepdive/MobileInvestmentsDeepDive.jsx#L160), [moduleReveal.js:162-163](src/lib/moduleReveal.js#L162-L163) | "Take £X of profit tax-free". "Taking £X of that profit before 5 April would use this year's allowance. Your platform or an adviser can tell you how for your holdings. Buying back inside an ISA keeps you invested." | Grey | Steer to sell and buy back. Mitigated: no particular holding named, adviser signposted. | Heading "£X of profit could be taken tax-free this year". Last sentence: "Some people buy back inside an ISA ('Bed and ISA') to stay invested; prices can move in between." |
| Bed and breakfasting explainer | [MobileInvestmentsDeepDive.jsx:190](src/mobile/deepdive/MobileInvestmentsDeepDive.jsx#L190) | "Buying back in (bed and breakfasting)" | Guidance | A tax-rule explanation. | Keep. |

### Pension

| Surface | Location | Current wording | Class | Why | Safer version |
|---|---|---|---|---|---|
| High-income alternatives | [MobilePensionDeepDive.jsx:546](src/mobile/deepdive/MobilePensionDeepDive.jsx#L546) | "VCTs and EIS are the usual alternative — both give 30% upfront income tax relief, with far more risk and illiquidity. Speak to an FCA-regulated adviser before investing." | **Advice risk** | Names high-risk investment types as this user's solution. Promotion rules on high-risk investments may apply (counsel item 6). | "Pension contributions alone may not bring your income under £200,000. The other options carry much more risk, and this is a situation where people usually take regulated advice." Link to MoneyHelper's adviser directory. |
| Contribution tiles | [MobilePensionDeepDive.jsx:122](src/mobile/deepdive/MobilePensionDeepDive.jsx#L122), [427](src/mobile/deepdive/MobilePensionDeepDive.jsx#L427); [moduleReveal.js:71](src/lib/moduleReveal.js#L71), [80-81](src/lib/moduleReveal.js#L80-L81) | "Get your full employer match", "Pay into your pension". "Increasing to X% claims the rest — free money from your employer". "Paying in 5% of your salary would start it." "Raising your payments to X% would get the full match." | Grey | A course of action on a pension, from the user's figures. No product named, and it concerns their existing workplace scheme. Whether that is a "particular investment" is counsel item 2. | Describe the consequence, not an instruction. Title "Your employer's match". Text: "At X%, your employer would add £Y a year. It would cost you about £Z after tax relief. Money in a pension can't usually be taken out until 57." |
| Salary sacrifice | [MobilePensionDeepDive.jsx:202-212](src/mobile/deepdive/MobilePensionDeepDive.jsx#L202-L212); [moduleReveal.js:91](src/lib/moduleReveal.js#L91) | "Pay less tax with salary sacrifice". "sacrifice now to stay ahead of it". "Sacrificing now builds wealth efficiently". | Grey | Urgency ("now") and persuasion ("efficiently") are the PERG 8.28.6 signals. | "Salary sacrifice of £X would bring your income back to £100,000, saving about £Y in tax and NI. It reduces your take-home pay, and the money is locked in your pension until 57." Drop "now" and "efficiently". |
| Bonus sacrifice | [MobilePensionDeepDive.jsx:554](src/mobile/deepdive/MobilePensionDeepDive.jsx#L554), [632](src/mobile/deepdive/MobilePensionDeepDive.jsx#L632); [moduleReveal.js:102](src/lib/moduleReveal.js#L102) | "Pay your bonus into your pension". "Getting a bonus? Sacrifice it before it's paid". | Grey | Imperative headings. | "Your bonus and your pension": "Paying your bonus in through salary sacrifice could save up to £X in tax. It has to be arranged before the bonus is paid." |
| Pension cliff options | [MobilePensionDeepDive.jsx:790-795](src/mobile/deepdive/MobilePensionDeepDive.jsx#L790-L795) | "Save the extra in an ISA", "Pay into a partner's pension", "Plan when you draw it" | Grey (low) | Already presented as alternatives with trade-offs. Only the headings are imperatives. | Headings as nouns: "An ISA instead", "A partner's pension", "When you draw it". |
| Adviser prompt | [MobilePensionDeepDive.jsx:732](src/mobile/deepdive/MobilePensionDeepDive.jsx#L732) | "This is a complex position, and people in it often get help from a regulated adviser." | Guidance | Good signposting. | Keep, and add a link (see Structural safeguards). |
| Drawdown planner | [MobileDrawdown.jsx:99-100](src/mobile/deepdive/MobileDrawdown.jsx#L99-L100), [161](src/mobile/deepdive/MobileDrawdown.jsx#L161); [moduleReveal.js:57-61](src/lib/moduleReveal.js#L57-L61) | "£X more after tax than all in Year 1"; "An illustration, not a recommendation of how much to take."; "Pension Wise, from MoneyHelper, gives free guidance…" | Guidance (keep a close eye on it) | A side-by-side calculation of two methods, clearly labelled, with signposting. | Keep. Show the Pension Wise line on the screen itself, not only in the reveal. Add "Taking money from a pension is a big decision with more options than these two." |
| Tax-free cash, taper, cliff explanations | [MobilePensionDeepDive.jsx:261-280](src/mobile/deepdive/MobilePensionDeepDive.jsx#L261-L280), [785](src/mobile/deepdive/MobilePensionDeepDive.jsx#L785) | "Up to 25% of your pot can be taken tax-free, to a limit of £X." | Guidance | Rules and figures, no value judgement. | Keep. This is the model for everything else. |

### Cash, student loan, property, forecast

| Surface | Location | Current wording | Class | Why | Safer version |
|---|---|---|---|---|---|
| Cash steps | [MobileCashDeepDive.jsx:124](src/mobile/deepdive/MobileCashDeepDive.jsx#L124), [167-198](src/mobile/deepdive/MobileCashDeepDive.jsx#L167-L198) | "Move surplus cash to a better rate". "Step 1 — Fill your ISA", "Step 2 — Use your tax-free savings interest", "Step 3 — Premium Bonds". | Grey (low) | Deposits, so lower regulatory risk. But numbered steps are directive, and break Candid's own "no numbered steps" rule. | "How the £X a year is worked out: a Cash ISA first (interest never taxed), then savings up to your tax-free allowance, then Premium Bonds." |
| Candid Assist (cash) | [CandidAssist.jsx:212-224](src/mobile/assist/CandidAssist.jsx#L212-L224); [assist.js:9-14](src/lib/assist.js#L9-L14) | "Cash ISAs you could transfer to", several sorted by rate, none picked; "Keep it where it is"; "Keep it for investing". | Guidance | Deposits, an objective sort, user's choice, a "keep" option. | Keep. Never let Assist extend to investments without legal review. |
| Student loan | [MobileStudentLoanDeepDive.jsx:260](src/mobile/deepdive/MobileStudentLoanDeepDive.jsx#L260); [moduleReveal.js:208](src/lib/moduleReveal.js#L208) | "Not recommended given your rates, but for reference:". "That money could do more in savings or your pension." | Grey (low) | Student loans aren't investments, but "recommended" is advice vocabulary, and the second line nudges towards a pension. | "On these figures, overpaying doesn't come out ahead. For reference:". "On these assumptions, savings or a pension may earn more than overpaying." |
| Student loan comparisons | [MobileStudentLoanDeepDive.jsx:239-243](src/mobile/deepdive/MobileStudentLoanDeepDive.jsx#L239-L243) | "Repay wins by X%", "Pension wins by X%", "Level — repaying is guaranteed" | Guidance | A rate comparison with stated assumptions. | Keep. Add "on Candid's assumed growth" to the pension case. |
| Property | [propertyReveal.js:43](src/lib/propertyReveal.js#L43), [55](src/lib/propertyReveal.js#L55), [131](src/lib/propertyReveal.js#L131); [MobilePropertyScreen.jsx:170](src/mobile/screens/MobilePropertyScreen.jsx#L170) | "A home up to £X would fit." "The most you could afford is about £X." "Renting… grows your money faster here." Disclaimer present. | Guidance | No mortgage product named (PERG 4.6 test). Has the only in-app disclaimer. | Keep. "would fit" → "is within what most lenders lend". "The most you could afford" → "The most lenders would typically lend". |
| Forecast | [MobileForecastScreen.jsx:150-152](src/mobile/screens/MobileForecastScreen.jsx#L150-L152); [forecast.js:376-380](src/lib/forecast.js#L376-L380) | Compares S&S ISA, savings and pension side by side; "Estimates, not promises: growth isn't guaranteed."; "Globally diversified index fund". | Guidance | Illustration with assumptions and warnings. | Keep. "Globally diversified index fund" → "an illustrative growth rate for shares". It shouldn't read as an asset-allocation suggestion. |

### App framing, onboarding and marketing

| Surface | Location | Current wording | Class | Why | Safer version |
|---|---|---|---|---|---|
| Onboarding goals | [MobileOnboardingStep.jsx:147](src/mobile/onboarding/MobileOnboardingStep.jsx#L147) | "this helps us tailor advice to what matters to you." | **Advice risk** (wording) | Calls the output advice, tailored to the person. | "this helps us show what's most relevant to you." |
| Coming-soon module | [MobileModulesScreen.jsx:66](src/mobile/screens/MobileModulesScreen.jsx#L66) | "Marriage or a civil partnership changes the advice…" | Grey | Same word. | "…changes the picture, from shared allowances to how you hold savings and investments." |
| Entry chat | [appEntry.js:123-126](src/lib/appEntry.js#L123-L126), [138](src/lib/appEntry.js#L138) | "I weigh your figures and goals against UK tax law and best practice. Then I show you your options, and you choose what suits you." "I'll do the sums and build your action plan as you go." | Grey | "Weigh… goals… best practice" implies a suitability assessment. "Action plan" implies instructions. | "I check your figures against UK tax rules and allowances, and show what each option is worth in pounds. I don't know everything about your situation, so the choices are yours." / "I'll do the sums and show you the options as you go." |
| Onboarding pension hints | [MobileOnboardingStep.jsx:370](src/mobile/onboarding/MobileOnboardingStep.jsx#L370), [426](src/mobile/onboarding/MobileOnboardingStep.jsx#L426) | "The single biggest optimisation for most people in your income bracket." "This is likely your biggest financial gap. We'll quantify exactly what it's costing you." | Grey (low) | A judgement on the person before any figures. | "Pensions often hold the biggest tax savings at this income." "We'll show what it could be worth." |
| Landing page | [NewLandingPage.jsx:356-357](src/mockups/NewLandingPage.jsx#L356-L357) | "Delivering an instant financial health score and a tailored plan." "Walk through personalised actions, showing precisely how much each decision adds to your net worth." | Grey | "Tailored plan" and "personalised actions" describe a recommendation service. "Precisely" overstates estimates. | "…and a clear view of your options." "See what each option could be worth to you, worked out from your own figures." |
| How it works | [HowItWorksPage.jsx:19](src/mockups/HowItWorksPage.jsx#L19), [23-24](src/mockups/HowItWorksPage.jsx#L23-L24), [29](src/mockups/HowItWorksPage.jsx#L29) | "a prioritised roadmap for your specific goals". "Actionable steps with exact £ impact… Every action shows its quantified £ impact". "recalculates your score and next steps to keep your plan on track". | Grey | Roadmap, actions and plan language. "Exact" overstates. | "Your options, ranked by what they're worth in £". "Every option shows its estimated £ value." "…recalculates your score and figures." |
| Landing disclaimer | [NewLandingPage.jsx:395](src/mockups/NewLandingPage.jsx#L395); [SiteFooter.jsx:20](src/mockups/SiteFooter.jsx#L20) | "Guidance, not advice. Candid helps you understand your options – the decisions are always yours." | Guidance | Good. | Keep, and repeat it inside the app. |
| Calculators | [NewLandingPage.jsx:416](src/mockups/NewLandingPage.jsx#L416); `100k-tax-trap-calculator.html` meta | "see the exact pension sacrifice that fixes both at once" | Grey (low) | "Fixes" is a promise. | "see how much pension sacrifice would bring your income under £100,000". |
| Site meta | `index.html` | "Find the money you didn't know you're missing. Free, in under 5 minutes." Title "Optimise your money". | Grey (consumer law) | No longer free beyond the first module. | "Free to start. See what your money could be doing, in under 5 minutes." |

### Paywall and paid-tier wording

| Surface | Location | Current wording | Class | Why | Safer version |
|---|---|---|---|---|---|
| Locked module | [MobileUnlock.jsx:27-28](src/mobile/screens/MobileUnlock.jsx#L27-L28) | Hidden sections "Why you're missing it", "How to fix it"; button "Show me how to fix it". | **Advice risk** once paid | You'd be charging for "how to fix it", which reads as buying a recommendation. | "Why it's happening", "Your options and what each is worth"; button "Show me my options". |
| Paywall body | [MobileUnlock.jsx:137](src/mobile/screens/MobileUnlock.jsx#L137), [154](src/mobile/screens/MobileUnlock.jsx#L154), [158](src/mobile/screens/MobileUnlock.jsx#L158) | "Subscribe to see how to fix this, and every other module." "Every module's answer, kept up to date as rates change." | Grey | "Fix" and "answer" frame the product as the decision. | "Subscribe to see your options here and in every other module." "Every module's figures and options, kept up to date as rates change. Guidance, not advice." |
| Value claim | [MobileUnlock.jsx:46](src/mobile/screens/MobileUnlock.jsx#L46), [200-201](src/mobile/screens/MobileUnlock.jsx#L200-L201) | "£X a year you're missing out on". "That's 9x what Candid costs a year (£24)." | Grey (consumer law) | An estimate stated as fact, next to a price, inviting the purchase (DMCC s226 risk). | "£X a year: our estimate, on your figures". Keep the comparison only with "if you made these changes". |
| Rate alerts | [MobileUnlock.jsx:173](src/mobile/screens/MobileUnlock.jsx#L173) | "We'll email you when you could be keeping more: a better rate, or an allowance going unused." | Guidance | Factual alerts on deposits and allowances. | Keep. Keep alert emails to cash and allowances, not investments, unless reviewed. |
| Home | [MobileHomeScreen.jsx:150-153](src/mobile/screens/MobileHomeScreen.jsx#L150-L153) | "At stake each year". "What your money could be doing that it isn't". | Guidance | General framing. | Add "estimated" to the figure label. |

### Legacy and AI surfaces (reachable by typed URL, not linked)

| Surface | Location | Current wording | Class | Why | Safer version |
|---|---|---|---|---|---|
| AI report prompt | [aiPrompt.js:113-133](src/lib/aiPrompt.js#L113-L133) | "the single most important thing to address", "close with the single biggest quick win", "Priorities ordered by urgency", "not hedgy", "Cut… hedging" | **Advice risk** if served | Tells the model to rank and instruct, and bans the caveats that keep it on the guidance side. | Retire with the route, or use the guardrails below. |
| AI fallback text | [aiPrompt.js:139-143](src/lib/aiPrompt.js#L139-L143) | "Pension and ISA are your fastest wins". "that money works harder in a pension". | Grey | Steers to products. | Retire. |
| Desktop modules | [CandidApp.jsx:5231](src/CandidApp.jsx#L5231), [5262-5263](src/CandidApp.jsx#L5262-L5263), [5377-5378](src/CandidApp.jsx#L5377-L5378), [5434-5435](src/CandidApp.jsx#L5434-L5435), [3366](src/CandidApp.jsx#L3366), [3576](src/CandidApp.jsx#L3576) | "Open a Junior ISA for my child" (Hargreaves Lansdown), "Set up a child pension (SIPP)" (PensionBee), L&C, Sprive, Farewill, VouchedFor. Alternative investments ("Hagerty Blue Chip index has returned ~12%"). Gilts "effectively risk-free". | **Advice risk** if reachable | Named products and providers as actions, past-performance claims on collectables, "risk-free". | Delete with the legacy routes. |
| PDF report | [ReportPdf.jsx:233](src/pdf/ReportPdf.jsx#L233), [252](src/pdf/ReportPdf.jsx#L252) | "No live recommendations right now — your finances are well optimised." Footer "Guidance, not financial advice". | Grey | "Recommendations". | Retire with `/dashboard`. If kept: "Nothing to look at right now." |
| AI proxy | [api/claude.js:64-127](api/claude.js#L64-L127) | Forwards whatever prompt the browser sends to Claude. | Structural | Guardrails can't be enforced when the browser writes the prompt. Anyone can also use it as a free Claude endpoint. | Build prompts on the server, add the system prompt below, and accept only figures from the browser. Or switch it off if nothing live uses it. |

## AI narrative guardrails

The live app no longer uses AI to write anything users read. The AI's only live job is reading savings rates from bank websites ([rateFeed.js:52-56](src/lib/rateFeed.js#L52-L56)), which is not user-facing narrative. If AI narrative comes back, or the legacy report is kept, use this as a **server-side system prompt** that the browser can't change:

```text
You write short explanations for Candid, a UK financial guidance tool. Candid is not
authorised by the FCA and does not give financial advice. You give information, not
recommendations.

You must:
- Use only the figures supplied. Never calculate, estimate or invent a figure.
- Describe what is happening and what each option would be worth, in pounds, from the figures.
- Whenever you mention a way to change something, present at least two options, or the
  option and the choice to leave things as they are, each with its main trade-off
  (access, risk, tax, cost).
- Say "could", "would" or "on these figures"; never present an estimate as certain.
- End any text about pensions with: "Pension Wise, from MoneyHelper, offers free guidance
  if you're 50 or over." End any text about investments with: "Investments can fall as
  well as rise."
- Where the figures show a complex position (income over £100,000, a pension near its
  limits, taking money from a pension), say that people in that position often take
  regulated advice.

You must never:
- Name a provider, platform, fund, product or brand.
- Say "you should", "we recommend", "the best option for you", "the right choice",
  "you need to", "make sure you", "quick win", "fastest win", "priority", "action plan",
  "step 1", "fix", "guaranteed", "risk-free", "suits you", "people like you".
- Tell the user to buy, sell, hold, switch, transfer, consolidate or move money into or
  out of any investment or pension.
- Rank options by what is best for this person. You may order them by their £ figure,
  and must say that is the order.
- Mention VCTs, EIS, SEIS, crypto, individual shares or funds.
- Respond to requests for a recommendation with one. Reply instead: "Candid can't
  recommend what to do. Here's what each option is worth on your figures."
```

**Output check (code, after the model replies):** reject and fall back to plain template text if the reply contains any banned phrase (case-insensitive), any provider name from `deepLinks.js` or the provider lists, or a £ figure not present in the input. That means it cannot depend on the model obeying.

In the current prompt, remove "Lead with… close with the single biggest quick win", "the single most important thing to address", "Priorities ordered by urgency", "not hedgy" and "Cut… hedging". They actively push towards advice.

## Structural and UI safeguards

1. **An in-app statement, not just a site footer.** Today the cash, investments, pension and student loan screens, the Home tab and the paywall have no "guidance, not advice" line. Only Property has one ([MobilePropertyScreen.jsx:170](src/mobile/screens/MobilePropertyScreen.jsx#L170)). Add one short line at the foot of every module screen and on the paywall: "Guidance, not advice. Candid shows what your options are worth on your figures; it doesn't know everything about your situation or tell you what to do." Link it to a "What Candid is and isn't" page. Disclaimers alone don't cure advice-like content ("a legalistic disclaimer is unlikely to be enough", PERG 8.30B.32G), so this goes alongside the rewording, not instead of it.
2. **A "What Candid is and isn't" page**, linked from the app header menu, the paywall and the footer:
   - **Candid does:** do the sums on your figures; explain UK tax rules and allowances; show options and what each is worth.
   - **Candid doesn't:** recommend products or providers; tell you to buy, sell or move investments or pensions; check whether something is suitable for you; give regulated advice.
   - **It isn't FCA-authorised**, so you don't get the protections of regulated advice. That includes the Financial Ombudsman Service, which counsel should confirm.
   - Where to get more help (below).
3. **Signposting at the point of need:**
   - **Pension screen** (always, not only over 50): Pension Wise for 50+ with a defined contribution pot; MoneyHelper's pension guidance for everyone else.
   - **Pension consolidation**, wherever it's mentioned: MoneyHelper on transferring pensions, and the risk of losing guaranteed benefits.
   - **Investments screen**: MoneyHelper's investing basics, and "find a regulated financial adviser" (MoneyHelper's directory, or the FCA register to check an adviser).
   - **The adviser prompts** at [MobilePensionDeepDive.jsx:732](src/mobile/deepdive/MobilePensionDeepDive.jsx#L732) and [546](src/mobile/deepdive/MobilePensionDeepDive.jsx#L546) should link to the directory, not just mention it.
4. **Assumptions and data currency.** Each module screen should show "Figures use 2026/27 tax rules; growth assumed at X%; rates checked [date]". Most screens already say some of this, but not consistently. Cash already has dates in Assist.
5. **An acknowledgment step at subscription.** One line above the Subscribe button: "Candid is guidance, not financial advice. It won't tell you which product to choose." This is not a tick box, because an extra gate would cut conversion, but it puts the statement at the moment of payment.
6. **Terms.** [terms.html](terms.html) sections 1 and 4 already say guidance only and not FCA-authorised. Add to section 6 (Subscriptions): "A subscription gives access to calculations and information. It is not a personal recommendation or advice service, and Candid does not assess whether any product is suitable for you."
7. **Naming.** "Your answer" (paywall, reveals: "Your answer, step by step") suggests the product hands down a decision. Use "Your figures" or "What we found".

## Paid-tier and marketing language

Charging doesn't change the definition of advice. It changes how a reasonable user reads the product: they're paying, so they expect to be told what to do (compare PERG 8.30B.13G on customer expectations, and counsel item 4). The things you sell should be the *sums, the information and the convenience*, never the decision.

| Say | Avoid |
|---|---|
| "See your options in every module, and what each is worth" | "See how to fix it" |
| "Kept up to date as rates and allowances change" | "Every module's answer" |
| "Alerts when a better savings rate or an unused allowance appears" | "We'll tell you when to move your money" |
| "An estimated £X a year on your figures" | "£X a year you're missing out on" (stated as fact) |
| "Your options, ordered by £ value" | "Your action plan", "your priorities", "roadmap" |
| "Guidance, not advice" next to the price | No mention at the point of purchase |

Two more points:

- **The 9x claim.** The comparison against Candid's price ([MobileUnlock.jsx:200](src/mobile/screens/MobileUnlock.jsx#L200)) is the strongest sales line and the most exposed one. It sets a figure Candid can't guarantee against the price of the product. Keep it only as "Our estimate of what's at stake here is 9x Candid's yearly price", with the estimate wording.
- **Unlock survey options** ([unlock.js:47-49](src/lib/unlock.js#L47-L49)). "Opening better accounts for me" and "Talking it through with an adviser" are fine as research questions. But if you build either, the first is arranging, and the second needs a regulated partner. Both are counsel questions before building.

## Prioritised recommendations

| Rank | Change | Risk reduced | Effort | Behaviour change? |
|---|---|---|---|---|
| 1 | Pension and ISA provider lists: remove, or neutralise and fix the referral-fee line | High | Low to remove, medium to redesign | Yes |
| 2 | Rewrite investment steers (S&S ISA x2, VCT/EIS) | High | Low | No |
| 3 | Remove "advice", "tailored plan", "action plan", "how to fix it", "answer" from onboarding, landing and paywall | Medium-high | Low | No |
| 4 | In-app guidance statement, "What Candid is and isn't" page, signposting links | Medium-high | Low-medium | No (UI addition) |
| 5 | Retire legacy routes, AI report, PDF and desktop modules; lock the AI proxy | Medium (high if anyone reaches them) | Low-medium | Yes |
| 6 | Pension imperatives → consequence wording (match, salary sacrifice, bonus) | Medium | Low | No |
| 7 | Estimate wording on £ figures and the 9x claim; fix "Free" in the site meta | Medium (consumer law) | Low | No |
| 8 | Cash steps, student loan "recommended", forecast "index fund", property "would fit" | Low | Low | No |
| 9 | Subscription acknowledgment line and terms section 6 addition | Low-medium | Low | No |
| 10 | Guardrail prompt and output filter, if AI narrative returns | Medium (future) | Medium | Yes (server) |

**Changes that alter product behaviour, flagged rather than made** (your stop condition): items 1, 5 and 10. Item 1 changes what the Pension and Investments screens show and in what order. Item 5 removes reachable routes and changes how the AI endpoint works. Item 10 changes the server. None changes any calculation. All the other items are wording, labels or small UI additions.

## Questions for a solicitor or regulatory counsel

1. **Provider lists.** Do the pension (SIPP) and Stocks and Shares ISA provider lists, shown under the user's own figures with badges and "Open…" buttons, amount to advising on a particular investment (PERG 8.24) for an unauthorised firm? Would a neutral, alphabetical, unbadged list on a separate page cure it?
2. **Contributions to an existing workplace pension.** Is suggesting someone raise their contributions, salary-sacrifice, or pay a bonus into their existing scheme advice on a "particular investment"? Does the answer differ between occupational (trust-based) schemes and group personal pensions?
3. **The surplus cash → Stocks and Shares ISA suggestion.** Is this generic guidance (no particular investment), or does it fall within the new targeted-support activity, which needs permission?
4. **Charging.** Does charging for personalised outputs change the analysis in 1–3, given a paying user's reasonable expectations?
5. **Financial promotions.** Are "Open SIPP", "Start pension" and "Open S&S ISA" links, and the earlier "Here's where you could actually do this", invitations or inducements under FSMA s21 needing s21-approver sign-off or an exemption? Would neutral "Visit site" links change that?
6. **VCT/EIS mention.** Does naming VCTs and EIS with "30% upfront income tax relief" engage the rules on promoting high-risk investments?
7. **Drawdown planner.** Is comparing two ways of taking tax-free cash, on the user's figures, guidance? Is there any expectation that tools discussing decumulation signpost Pension Wise in a set form?
8. **Consumer law.** Are "£X a year you're missing out on", "That's 9x what Candid costs", "Free" in the site meta, and the "may earn a referral fee… our ranking" line compliant with DMCC Act 2024 Part 4?
9. **Disclosure wording.** What is the right wording to tell users that Candid is not FCA-authorised and what protections they don't have, including whether the Financial Ombudsman Service applies?
10. **Future features.** Would Assist opening savings or ISA accounts on a user's behalf (the dev-only prototype) be arranging deals? Would partnering with an adviser or a referral arrangement change Candid's position?

## Sources

- FCA Handbook, PERG 8.24 Advising on investments: https://handbook.fca.org.uk/handbook/perg8/perg8s25
- FCA Handbook, PERG 8.28 Advice vs information: https://www.handbook.fca.org.uk/handbook/PERG/8/28.html
- FCA Handbook, PERG 8.30B Personal recommendations: https://handbook.fca.org.uk/handbook/PERG/8/30B.html
- FCA Handbook, PERG 2.7 Activities (deposits and advising): https://handbook.fca.org.uk/handbook/perg2/perg2s7
- FCA Handbook, PERG 4.6 Advising on regulated mortgage contracts: https://handbook.fca.org.uk/handbook/PERG/4/6.html
- FCA Handbook, PERG 8.9 Section 21 restriction: https://handbook.fca.org.uk/handbook/perg8/perg8s9
- FCA PS23/13, s21 approver gateway: https://www.fca.org.uk/publication/policy/ps23-13.pdf
- FCA, Advice Guidance Boundary Review and targeted support: https://www.fca.org.uk/firms/advice-guidance-boundary-review
- Pension Wise: https://pensionwise.gov.uk
- MoneyHelper, What Pension Wise is: https://www.moneyhelper.org.uk/en/pensions-and-retirement/pension-wise/understanding-what-pension-wise-is-and-how-to-use-it
- Digital Markets, Competition and Consumers Act 2024, Part 4 Chapter 1: https://www.legislation.gov.uk/ukpga/2024/13/part/4/chapter/1

Some sources could not be read in full: MoneyHelper's advice-vs-guidance page returned 403, and the DMCC Act text came from search excerpts. Counsel should check the current versions before relying on any point here.
