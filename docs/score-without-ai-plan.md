# The score without the AI report

**Status:** approved and built (5 October 2026). Decisions below.

## The problem

"Generating a report" is one AI call, about 2p. It looks as though it produces the Candid score, but it doesn't. The code already works out all of these, free and instantly, from the answers:

- the score
- the opportunity figure
- net worth
- "your biggest win"
- every module's figures

The AI call only adds wording:

| AI output | Where it shows on mobile |
|---|---|
| Headline (12 words or fewer) | Under the score on home |
| Two-sentence narrative | Score detail sheet (tap the score) |
| Up to 4 "priorities" (title, £, one-line reason, urgency) | Score detail sheet |
| One line per module | Modules tab, when a card is expanded |

Two more problems with it:

1. **It holds the score back.** The score is real the moment the answers are in, but we only show it once a report is made, behind a loading screen.
2. **It can contradict the code.** For Cash, Investments and Student loan, the AI's module status overrides the code's own (`getModuleSummary`). So a module's colour can come from the AI rather than the calculation.

## The change

Take the AI out of the score path entirely.

1. **The score appears once the user's picks are done.** It's worked out by the code, with no cost and no loading screen, and updates live as they answer more.
   - "Picks" means the modules chosen at the entry.
   - Someone who chose "Just exploring" sees it after their first module.
   - Until then, home keeps "Still to do" with the score's place explaining what's left: "Finish Pension and Student loan to see your Candid score."
2. **"What to do first" is built by the code.** The top modules, ranked by £ impact, each with the code's own one-line label (`impactLabel` in `moduleStatus.js`, e.g. "£8,000 ISA headroom unused").
   - The labels exist for every module with something to act on. A module that's on track has none, so it needs a short line such as "On track".
   - Some labels use jargon: "CGT saving", "ISA headroom". They get a plain-English pass, e.g. "£8,000 of this year's ISA allowance unused".
   - It replaces the AI priorities and narrative in the score detail sheet.
   - A plain headline is built from the top item, e.g. "Your biggest win: Cash & savings, £222 a year".
3. **Module statuses and one-liners come from the code only.** This ends the AI override in `getModuleSummary`.
4. **The user's Supabase row gets its score when the score first appears**, then keeps it current as modules are answered (the existing `saveRow`).

## What goes

- **The AI call in the mobile app.** No 2p per user, and no "See what to do first" loading screen.
- **"See what to do first" and "Update my report".** With a live score there's nothing to generate or update.
- **The narrative and the AI's priority wording.** The code's ranking replaces them.
- **The goals question before the report.** See decision 2.

## What stays

- `/api/claude` and its rate limit, ready for the Q&A on your own numbers from the AI review, with its cap and caching.
- Existing users' saved reports stay in their browsers, unused by the mobile app.
- The old desktop report screens (`/dashboard` and similar), which nothing links to. Left as they are.

## Decisions

1. **When the score appears:** once all picks are done. "Just exploring" users see it after their first module.
2. **The goals question:** asked once, as a card on home after the score appears. "Not now" dismisses it for good. Answers go to `financial_goals`.
3. **The "Edit inputs" wizard (wrench icon):** its last button is now "Save and go back". There's no AI call.
4. **Existing users' AI wording:** no longer shown. Everyone sees the code's current wording.

Also found while building: the Cash label put the access warning ahead of the £ figure it sat next to. It now leads with what the £ figure is, with any access concern after it.

## Build

1. Score unlock rule (picks done) and the home score area, with tests.
2. Code-built "what to do first" and headline, with tests. The module labels get their plain-English pass and an "On track" line. Score detail sheet switched to them.
3. `getModuleSummary` uses the code's status and label only.
4. Remove the report steps: the `/app/report-start` route, "See what to do first", "Update my report", and `generateDashboard` from the mobile paths. Add the goals card or move the question, per decision 2. Make the wrench wizard's last step save and go back.
5. Supabase: write the score when it first appears. PostHog: `score_unlocked` in place of the `report_*` events.

Mobile only. Nothing in Supabase changes.
