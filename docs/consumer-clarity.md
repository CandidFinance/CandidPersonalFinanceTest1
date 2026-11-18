# Consumer clarity standard

The test for any words, figures or screens a Candid user sees: **would a UK non-specialist understand what this means for them, at a skim, on a phone?**

Technically correct is the starting point, not the bar. Every rule below comes from a correction Harvey made to Claude's output (dates and sources given), so it records the gap between Claude's first draft and the version that shipped. Reviewers check work against this file, not against their own sense of what is clear.

Built 18 Nov 2026 from: Harvey's feedback in Claude Code sessions (16 Oct to 17 Nov), copy-tightening commits, and `docs/persona-ux-review.md`.

---

## The reader

- Lives in the UK, aged 25–45, earns well (roughly £50k–£125k+), busy. See `docs/personas.md`.
- Knows their salary, take-home pay, and roughly what an ISA and a pension are.
- **Does not know** how the tax system's mechanics work: adjusted net income, tapers, allowances, relief, the Personal Savings Allowance, carry forward, how Plan 2 write-offs work.
- Skims. Reads the £ figure and the line next to it, maybe one more. If the answer isn't in the first line, it is missed.
- Wants to know: am I losing money, how much, why, and what are the options.

## Known blind spot

Simulated reviews miss this. The 50-persona review (19 Oct) rated the answer steps "short, readable, no jargon". Harvey then found "adjusted net income" meaningless to users (27 Oct) and the "Tax shield" tile unclear from its title, icon and text (17 Nov). Claude knows the mechanics, so a term reads as plain to Claude when it isn't. **Check against the jargon list and the rules below. Don't go on an impression of clarity.**

---

## The rules

Each rule has the check to run, then the evidence.

### 1. Answer first, then why, then options

**Check:** Does the first line say what this means for the user (good or bad, how much)? Does the page then go: headline £ → why → what it costs → the options?

- 17 Nov, Tax shield: "We should lead with the answer, e.g. you're paying a lot more tax because you are in the tax trap … then the mechanism … then the option."
- 20 Oct, £100k page: "the page flow reads like a load of 'and this, and this, and this' … It needs to have flow: Headline figure … why … what this costs, what the remedies are."
- 20 Oct: "Answers first, concise explainers, £ values."

### 2. A title names the problem, not the feature

**Check:** Could someone who has never seen Candid tell from the title alone what is at stake?

- 17 Nov: "Tax shield" doesn't say what the issue is, "nor the shield icon, nor the text in the square version. It's only when clicking into it … that it becomes clearer what is at stake."

### 3. Every £ must be a real £ the user would recognise

**Check:** If the user acted, would this figure turn up in their bank account, pension or tax bill as stated? Does the label say exactly what the figure is (per year or one-off, before or after tax)?

- 20 Oct: "do we mean by this that the user will have £x more in their bank account at the end of the year …? If no, then we should not be showing a figure of £x."
- 27 Oct: "saying that the user is £8k down on take home but £22k up on pensions doesn't feel like overall they're down £8k a year."
- Same-label figures must reconcile across a screen; never mix £/yr with built-up £ (see memory: figures must tally).

### 4. Insight, not regurgitation

**Check:** Does each figure on screen help the user decide something, or is it a number they already know? Pair figures so the comparison does the explaining.

- 20 Oct, student loan: "the fields below the graph currently are not strategic, they are regurgitating information." Put estimated balance next to total repaid, and interest next to repayments. "Clears in X years" matters less than whether it clears before the write-off date, "because it informs users whether the loan will get wiped or not."
- 10 Nov, account rows: show allowance used, gains this tax year, days left to use an allowance. "This is the second order information that drives value to customers, vs just showing them a figure they already know."
- 27 Oct: "Currently showing their adjusted net income isn't that useful to someone who doesn't know what that means." The takeaway is whether they are near the £100k trap and what it costs.

### 5. Consequence before mechanism; terms only when earned

**Check:** Is any technical term used? If so: is the plain meaning given first, is the term needed at all, and is it in the jargon list below?

- 5 Nov: "Monthly / lump sum" is unclear → "Recurring monthly contribution/surplus, One-off today … I want people to be able to infer that whatever they have left at the end of the month can be the monthly figure."
- 21 Oct: the slider label "Your pay in 10 years" could be clearer, since it is the salary growth assumption.

### 6. Short and sharp

**Check:** Count the text styles in a tile (more than 3 is a flag). Can each label lose words without losing meaning? Is there one idea per line?

- 10 Nov: "'Prizes a year, on avg' to 'Avg. prizes/yr' … You see how this is much sharper."
- 20 Oct: "There is way too much text visible, most tiles have multiple different text types (I count 6 …) so it is not clear what the answer is." Each option needs: what it is, what is needed, what the outcome is.
- 24 Oct: "I want the copy to be sharp, so that people actually read it." Use £xxk rather than £xx,xxx in summaries.
- 8 Nov: "Your money left on the table each year, across what you've answered." → "Opportunity from topics covered."
- 9 Nov: cut disclaimers and dummy-figure notes from tutorials.

### 7. Make skimming work

**Check:** If the user reads only the bold parts, do they get the point?

- 24 Oct: "if someone is skimming, the summary is 3 points and is in prose so is likely to get missed/skipped." Bold the key fact ("Inflation rose to 3.5%").
- 4 Nov: bold key terms such as "£100k tax trap".

### 8. Loss framing in everyday words

**Check:** Is a gap framed as money lost or left behind, in words people use in conversation? No blame, no legalese, no overclaiming.

- 23 Oct: "people are more likely to act to avoid losing vs acting to gain".
- 22 Oct: "forfeit" is legalistic; "waste" blames the user; "money drain" sounds like subscriptions. Use "left on the table", "missed" or "lost to low rates".
- 23 Oct: a figure that is a loss shows in red.

### 9. Concrete examples, named things

**Check:** Are examples specific (amounts, banks, what the money is)? Are providers named?

- 9 Nov: "Say £30,000 earns X%" → be clear that this is £30k in cash savings.
- 9 Nov: "Bank A offers 2.5% and Bank B offers 4%; the bank account you use can make a big difference."
- 10 Nov: name the account provider (Barclays, with its logo).

### 10. Say where things are

**Check:** When copy sends the user somewhere in the app, would they find it?

- 9 Nov (ccbd355): "Add it in Your finances" → "Add it in Your finances (the sliders button at the top of Home)."

### 11. Copy fits the user's answers

**Check:** Walk the copy through each answer branch. Does it still read correctly (no partner, no children, no pension)?

- 27 Oct: user said no partner, but the tile said "stops if you or your partner…" → "you or a partner".

### 12. A person, not a form

**Check:** Do question flows read like a conversation?

- 4 Nov: "Roughly what are your monthly costs?" → "Got it. Next one, roughly what are your monthly costs?" Affirm where natural ("Looks like you've been saving well").

### 13. Neutral, not directive

See CLAUDE.md product rules. The form Harvey approved (1 Nov): state the condition, not the command, e.g. "To capture the benefit this needs actioning before 5 April." "Build your emergency fund" → "Your emergency fund gap".

---

## Jargon list

"Evidence" means Harvey corrected it. "Proposed" means not yet confirmed by Harvey; check with him before treating it as a rule.

| Term or phrase | Use instead | Status |
|---|---|---|
| Adjusted net income | Lead with whether they're near the £100k trap and what it costs; the term only in the explainer | Evidence, 27 Oct |
| Tax shield (as a title) | Name the problem: e.g. paying 60% tax in the £100k trap | Evidence, 17 Nov |
| Leakage / leaking | Left on the table / lost to low rates | Evidence, 22 Oct |
| Forfeit, waste, money drain | Missed, left on the table, lost to | Evidence, 22 Oct |
| Personal Savings Allowance (inline) | "Annual interest above £500 is taxed" | Evidence, 5b0789f |
| "Could earn £x more" (gain framing) | "Lost to low rates" / "a low rate is costing you £x" | Evidence, 23 Oct |
| Overpaying "shrinks what's written off" | "Overpaying would mostly go on debt that's written off anyway" | Evidence, 4546bbf |
| Monthly / lump sum | Recurring monthly (what's left at month end) / one-off today | Evidence, 5 Nov |
| "Pay on Student Loans Company website" (pill) | SLC | Evidence, 29 Oct |
| Consumer price index | CPI (in news emails) | Evidence, 24 Oct |
| CGT allowance *left* vs ISA allowance *used* | Both as "used" | Evidence, 10 Nov |
| Marginal tax rate | "Of each extra £1 you earn, Xp goes in tax" | Proposed |
| Carry forward | "Unused allowance from the last 3 tax years" | Proposed (wording in 2ac8959) |
| Salary sacrifice | Keep the term, but always say what happens to take-home and pension | Proposed |
| Taper / tapered | Say what is lost: "your tax-free allowance shrinks" | Proposed |
| Drawdown | "Taking money out of your pension" | Proposed |

---

## Before and after

Claude's version, then the version Harvey asked for or approved.

| Before | After | Why | Source |
|---|---|---|---|
| Prizes a year, on avg | Avg. prizes/yr | Sharper | 10 Nov |
| Against the best easy access rate (5%), after tax | vs. best easy access rate, after tax | Sharper | 10 Nov |
| Tax saved a year, against interest | Tax saved vs. savings interest | Sharper | 10 Nov |
| Your money left on the table each year, across what you've answered. | Opportunity from topics covered. | Shorter on a busy band | 8 Nov |
| Kept by holding it in an ISA | Saved by holding it in the ISA | More impact | 9 Nov |
| Say £30,000 earns X% | Say £30,000 in cash savings earns X% | Says what the money is | 9 Nov |
| ~X months … (long line on mobile) | ~x months of spare £x.xk/mo closes it | Fits a phone | 11 Nov |
| Your savings could earn £x/yr more | Your savings lose £x/yr to low rates | Loss framing | 22 Oct |
| an email when a better savings rate could earn you £100+ a year more | an email when a low rate is costing you £100+ a year | Loss framing | 23 Oct |
| Overpaying would mostly shrink what's written off, not what you pay. | Overpaying would mostly go on debt that's written off anyway. | Plain consequence | 22 Oct |
| Interest over £x a year (your Personal Savings Allowance) is taxed. | Annual interest above £x is taxed. | Drops the term | 22 Oct |
| You get your employer's full pension match. | Employer's full match | Row label, not a sentence | 19 Oct |
| Your spending isn't in yet, so your cash buffer can't be checked (Cash & savings). | Cash runway not checked yet | Row label, not a sentence | 19 Oct |
| Build your emergency fund | Your emergency fund gap | Not directive | 1 Nov |
| Carry forward unused allowance … to contribute more without a charge — use the calculator below. | Unused allowance from the last 3 tax years can be carried forward, so more can go in without a charge. The calculator below works it out. | Not directive | 2 Nov |
| Add it in Your finances. | Add it in Your finances (the sliders button at the top of Home). | Says where | 9 Nov |
| stops if you or your partner… (user has no partner) | stops if you or a partner… | Fits their answers | 27 Oct |
| Roughly what are your monthly costs? | Got it. Next one, roughly what are your monthly costs? | Conversation | 4 Nov |
| "Tax shield" tile with adjusted net income | Lead with: you're paying more tax in the £100k trap, then why, then options | Answer first | 17 Nov |

---

## Settled decisions

Choices Harvey has made. A reviewer may note that users could read these differently, but files them as "Harvey's call", never as a defect to fix.

| Decision | Date |
|---|---|
| "What it costs you" on the £100k trap uses tick-box rows (ticked = applies to you; not applicable greyed) | 27 Oct |
| In paired tiles, the gain comes first, then the cost | 27 Oct |
| A £ figure that is a loss or a gap shows in red | 23 Oct |
| Gaps are framed as loss: "left on the table", "lost to low rates" | 22 Oct |
| "Opportunity" labels the headline £/yr on Home and module heroes | 8 Nov |
| Page names show only under the tab bar icons; screens have no visible page title | 8 Nov |
| "Guidance, not advice" footer on module pages; readers skipping it is fine | 12 Oct |

## Keeping this file current

When Harvey changes copy or a screen after Claude's version:
1. Add the pair to **Before and after**, with the date.
2. If it shows a new pattern, add or extend a rule, with his words as evidence.
3. If it involves a term, add it to the **Jargon list**. Move "Proposed" terms to "Evidence" once he confirms or corrects them.
4. If he keeps something a reviewer flagged, add it to **Settled decisions**.
