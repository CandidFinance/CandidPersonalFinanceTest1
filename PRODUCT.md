# Product

<!-- impeccable:product-schema 1 -->

DRAFT 26 Oct 2026, from CLAUDE.md, docs/personas.md and the live site. Lines marked [CONFIRM] need Harvey's answer.

## Platform

web (candid-finance.co.uk on Vercel; the app is mobile-first and also runs on desktop)

## Users

UK employees on good salaries who have never had anyone work their finances out in pounds. Typical visitor: 27 to 45, £50k to £150k, renting or recently bought, a Plan 2 student loan, a workplace pension at or near the default, cash sitting in a low-rate account. Often in or near the £100k trap, the child benefit charge or the 60% band.

They arrive on a phone from TikTok, LinkedIn, Substack or a friend, with between one and ten minutes, usually after a specific question ("should I overpay my student loan?", "am I in the 60% trap?"). A smaller group arrives on desktop from search and stays longer.

Common states of mind: sceptical of fintech that is "selling something", wary of sharing bank data, short on time, wanting an answer they can screenshot. Bounce risk: "is this for people like me?" from very high earners, and impatience from low-literacy visitors.

Not the target: business owners taking dividends, contractors, DB-pension-only public sector workers with few levers, people who already pay an adviser.

## Product Purpose

Candid is a calculator. A visitor answers a few questions and sees, in pounds a year, what each option is worth: pension salary sacrifice, idle cash, student loan overpayment, the £100k trap, the mortgage, and more. Success is a visitor reaching their first £ answer in about three minutes and coming back when their circumstances change.

## Positioning

Every option is worked out in pounds from the visitor's own figures, across all areas at once, with no product to sell them and no bank link required. Banks, comparison sites and robo-advisers each show one area and want a sale; Candid shows the whole picture and leaves the decision with the visitor.

## Operating Context

Visitors compare Candid against payslips, P60s, pension statements, student loan statements and banking apps. They often check one figure against an HMRC page or a Martin Lewis article. The free calculators (student loan, £100k trap, mortgage vs savings) are entry points from search.

## Capabilities and Constraints

- First module free, no card needed; paid subscription via Stripe after that. [CONFIRM: show the price on the landing page or not]
- No bank linking; figures are typed in. Rough estimates are fine.
- England, Wales, NI and Scottish tax rates.
- Regulatory: guidance, not advice (PERG 8.30B.9G). The regulatory disclaimer component must stay on the page.

## Brand Commitments

- Wordmark: "Candid." in Georgia Bold. Fixed (logo files exist: Candid_Logos, Candid_Wordmark_Logos).
- Palette in use: dark green #162f24, gold #c4963a, cream #faf7f0. CTA blue #0071E3 on the main start button only. Open to change (Harvey, 26 Oct 2026).
- Type in use: Playfair Display for headlines and every prominent £ figure; DM Sans for everything else. Open to change, but prominent £ figures stay in a serif (CLAUDE.md rule 5).
- Shared `<Header>` on every page with the wordmark and the current page label.
- No emoji anywhere. One icon set (Lucide), used consistently.
- Voice: plain, British, figures first. No hype, no exclamation marks.

## Evidence on Hand

- Real app screens: /hero-answer.png (Pension module, £2.8k of avoidable tax), and any screen the app renders for the 28 test profiles.
- Three free calculators, live.
- Problem stats on the current page (PensionBee 2023, FCA Financial Lives 2024 and 2025) are flagged in code as pending confirmed citations. Don't add new stats until they're sourced.
- No testimonials, reviews, user counts, press or ratings. Never invent any.

## Product Principles

1. A calculator, not an adviser. Show the £ value of each option; the visitor decides.
2. Pounds first. Every claim lands as a £ figure, and figures carry the design.
3. Honest by default. No invented proof, no urgency tricks, no dark patterns.
4. Respect the visitor's time. First answer in about three minutes; one question at a time.
5. Private by default. No bank link, no data sold.

## Copy guardrails (binding on every surface)

- No directive copy: no "start with X", numbered to-do steps, "what to do first", "you should".
- List opportunities neutrally, largest £ first.
- Never tie figures to the visitor's profile ("people like you").
- Avoid "advice", "tailored plan", "action plan", "roadmap".
- Frame around money being lost that could be saved (testing, Oct 2026). "Leaking" and gains land less well. It's about the visitor's finances, not just money.
- Never name the founder or their background. The people behind Candid are "a team who built it to solve their own problem". Company details live in the footer.

## Accessibility & Inclusion

WCAG 2.2 AA: body text contrast 4.5:1, focus visible, tap targets 44px, every animation respects reduced motion. Must work at 360px phone width with no sideways scroll.
