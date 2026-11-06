# Candid: free and premium tier plan

Agreed with Harvey on 6 November 2026. This builds on the freemium change that shipped the same day (53bb787). **No new gating has been built from this plan.**

**The rule:** free tells you where you stand. Premium plans what-ifs and tracks over time.

## Tiers

| Feature | Free | Premium | State today |
|---|---|---|---|
| Every module's questions, figures, why and options | Yes | Yes | Live |
| Calculators and manual inputs | Yes | Yes | Live |
| Decision waterfall | Yes | Yes | Live, in Property |
| Buying together in Property | Yes | Yes | Live |
| Forecast with a monthly surplus | Yes | Yes | Live |
| Tax year end email | Yes | Yes | Live |
| Better-rate alerts, on the user's own figures | Yes | Yes | Live |
| Outside event emails (Bank Rate, Budget) | Yes | Yes | Live |
| Sunday email | First 3 issues | Yes | Live |
| Candid Assist | No | Yes | Live |
| Scenario modelling, loan comparison, forecast lump sums | No | Yes | Live |
| Your own goals | No | Yes | Live |
| £100k payday and bonus tracking | No | Yes | Live |
| New tax year email | No | Yes | Live |
| Open Banking | No | Yes | Sandbox only; no screen links to it |
| Payslip and document upload | No | Yes | Not built |
| Monthly surplus split | No | Yes | Not built |
| Personalised monitoring alerts, such as a savings rate falling behind | No | Yes | Not built |
| What-ifs for a pay rise, house purchase or new baby | No | Yes | Not built |
| Joint planning, as a new household view | No | Yes | Not built |
| Value tracker | No | Yes | Not built |

## Decisions

- **Open Banking is premium when it goes live.** No free user has it today, so nobody loses anything. Going live needs a production TrueLayer setup and a sign-in check on `api/truelayer/auth-link.js`, which currently takes the email from the URL.
- **The tax year end email stays free.** The bonus, payday and new tax year emails stay premium.
- **The Sunday email stays at 3 free issues** (`FREE_WEEKLY_ISSUES`). This also avoids pressure on the send cap of 95 a day (`DAILY_SEND_CAP`).
- **Buying together stays free,** because every module's answer is free. Premium joint planning has to be something new, not this moved behind a gate.
- **No trial for now.** Revisit once there's conversion data; funnel baselines reset from 6 November. Prices stay at £7.99 a month and £49.99 a year.

## How features get gated

Use the two checks that already exist, and don't add a third:

- **In the app:** `premiumOpen(d)` in `src/lib/unlock.js`. It covers subscribers and older users who kept their access.
- **On the server:** `accessFor(row)` in `server/access.js`. Bank and payslip routes must check this with the signed token, because the app's check can be faked by editing the browser's local storage.

## Still open

- **Older users and payday tracking:** `MobileTaxTrapDeepDive.jsx` and `MobileHomeScreen.jsx` call `hasAccess()` directly, so older users without a subscription don't get it. Moving them to `premiumOpen` would give it to them.
- **Older users and bank linking:** the server check excludes them unless Harvey decides otherwise.

## Copy for the features not yet built

Candid is a calculator, not an adviser, and premium copy explains what the numbers show.

- **Monthly surplus split:** the user sets the split and Candid shows what each option comes to. Avoid "plan". Proposed name: "Monthly surplus" (not yet confirmed).
- **Value tracker:** avoid "Premium found you £X". `gainedSoFar` counts changes the user reports, including ones from free modules, so crediting Premium would overstate it. Proposed wording: "Changes you've recorded: £X a year", beside the annual price (not yet confirmed).
