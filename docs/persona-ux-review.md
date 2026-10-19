# Candid: synthetic persona UX review (50 personas)

**What this is:** a structured stress test, not user research. The 50 personas in `personas.md` are invented. Their reactions, quotes and payment intent are **simulated inference** by the same model that built the product's logic, so they will share its blind spots. Treat every finding as a hypothesis, and validate the top ones with 5–10 real people from the 25–45, £50k–£125k+ segment.

**What was observed rather than inferred:**
- **18 real journeys:** walked in the actual app, built from the current `main` (commit `361ec82`) with Supabase and PostHog switched off. Each ran at the persona's device width (390px mobile or 1280px desktop) and covered the landing page, entry questions, module walk-throughs, the answer steps, the module page, the paywall and the Chat tab.
- **All 50 traced through the engine:** the exact questions each would be asked, and the answer each would see, came from the same functions the screens call (`neededAtStart`, `visibleQuestions`, `MODULE_REVEALS`, `computeModuleStatuses`).
- **Screen copy quoted below is real.** Times are **estimates** (reading speed plus input effort), because the browser runs at machine speed.

**Safety:**
- **Production services:** nothing was written to production Supabase, and no PostHog events, emails or payments were sent. The build had both services blanked, and the test browser blocked Supabase, PostHog, Stripe, TrueLayer and Resend. The app also skips all Supabase writes under automation.
- **Live savings rates** were therefore unavailable, so figures use the app's fallback rates.

---

## 1. Summary

- **Verdict:** a strong engine wrapped in a slow, generic start. When personas reach an answer it is often specific, correct and genuinely valuable: the £100k-trap figures checked out to the pound in every run. The problems are getting there, what happens to people the model doesn't fit, and the timing of the paywall.
- **Simulated completion:** 36 of 50 (72%) reach a first answer. 17 of 50 (34%) reach one that is useful and correct for them. 8 of 50 (16%) would pay: 4 firmly, 4 maybe.
- **Where the drop-off concentrates:** the start, before any value, accounts for 14 of the 50.
  - **The landing page:** 4 leave there.
  - **The entry questions (name, confidence, interests):** 2 leave there.
  - **The module questions:** 7 more. Estimated time to first answer is about 2–3.5 minutes; 13 personas have 2 minutes of patience or less.
- **Top 5 problems:**
  1. **The slowest start hits the highest-value users.** The £100k-trap and bonus personas are the most time-poor. Oliver (£22k a year to find) leaves at question 9 of 12.
  2. **Wrong or misleading numbers for whole segments:**
     - **Scottish taxpayers:** shown rest-of-UK rates.
     - **Student loan borrowers:** assumed to have started repaying this year.
     - **Fixed employer pension contributions:** read as an unclaimed "match", giving a false £12,000 alarm.
     - **Company directors:** told relief applies to dividends.
  3. **Final-salary pension members have no path.** NHS, teachers', civil service, police and university scheme members are asked for a pot value they don't have, and "Estimate it for me" invents one.
  4. **"Nothing stands out right now" for real worries:** the child benefit charge, retirement adequacy, share-award income and maternity leave aren't modelled, so these people get a non-answer.
  5. **The paywall lands after the work.** Personas answer a second module's questions, then learn it's locked. It reads as bait.
- **Top 3 strengths:**
  1. **The £ answers are concrete and credible:** "£22,219 a year of tax you could save", "Paying your £40,000 bonus into your pension could save up to £20,211".
  2. **Direct links work:** the student loan link reached an answer in about 48 seconds, with no entry questions.
  3. **The trust framing is clear and consistent:** "Guidance, not advice", the "What Candid is and isn't" page, no bank linking and a 14-day refund all landed well with sceptics.

---

## 2. Funnel view (simulated, 50 personas)

| Stage | Reach | Lost here | Main reasons (personas) |
|---|---|---|---|
| Arrive (landing or a direct link) | 50 | — | — |
| Start (tap "See what I could save", or arrive on a module) | 46 | 4 | Too long a page for a 45–60 second visitor; no instant answer above the fold (#20 Chris, #43 Ellie, #45 Jordan, #49 Ella) |
| Finish the entry questions and "How Candid works" chat | 44 | 2 | "Why do you need my name and how I feel?" (#6 Imogen); won't pick topics, feels like a funnel (#9 Kwame, real run) |
| Open a module | 43 | 1 | Wanted remortgage help; "Mortgage & debt" is advertised but no module exists (#12 Henry) |
| Reach a first answer | 36 | 7 | Out of patience at 9–12 questions (#4 Daniel, #10 Oliver, #36 Kirsty, #42 Rachel); final-salary pension has no pot to give (#8 Megan, #18 Isabel, both real runs); can't say "on maternity leave" (#38 Amy) |
| Answer is useful and correct for them | 17 | 19 | "Nothing stands out" for an unmodelled worry (#7, #15, #50, #25, #21, #40); non-answer "We need two numbers…" (#19, #35); no Sharia or halal options (#47, #48); misleading for directors (#23, #24); wrong but believed (#22, #31, #33); low interest or low fit (#27, #30, #44, #46) |
| Try a second module and hit the paywall | ~15 | — | Most who found value explore further |
| Would pay | 8 (4 firm, 4 maybe) | ~7 | "The first answer was the value; what's left that's worth paying for?"; ongoing value unclear |

---

## 3. Bounce points (ranked)

1. **Module questions 7–12, before any number (7 leave).**
   - **Who:** #10 Oliver (left at "What percentage of your salary do you pay in?", question 9 of 12 in the real run), #4 Daniel, #36 Kirsty, #42 Rachel.
   - **Trigger (simulated):** "Any income besides your salary?" → Yes → "Roughly how much is your yearly bonus?" → "How much do you get in dividends a year?" → "Any other income a year, such as rent?" That's three questions to describe one bonus.
   - **Quote (simulated, Oliver):** "I'm nine questions in and still no number. I'll do it later." He never does.
2. **"Roughly how much is in your pension now?" for final-salary members (2 leave, 2 more stall).**
   - **Who:** #8 Megan (civil service), #18 Isabel (NHS, GP partner). Both are real runs and stalled here; #35 Natalie and #19 George stall on "not sure".
   - **What they see:** "Estimate it for me (about £64,767)".
   - **Quote (simulated, Megan):** "I'm in a civil service pension, there isn't a pot. It's going to estimate something that doesn't exist?"
3. **Entry question "How confident do you feel about your finances?" (1 leaves, 3 hesitate).**
   - **Who:** #6 Imogen; #9 Kwame, #29 Alex and #26 Rebecca hesitate.
   - **Quote (simulated, Imogen):** "Name, then how I feel? I came for a number."
4. **Entry question "What would you like help with?" (1 leaves).**
   - **Who:** #9 Kwame (real run).
   - **Quote (simulated):** "Choose your interests: this is where the upsell starts."
5. **Landing, first screen (4 leave).** "Stop leaking wealth to tax traps and idle cash" plus "About 3 minutes".
   - **Who:** #20 Chris, #43 Ellie, #45 Jordan, #49 Ella.
   - **Why:** they wanted a one-tap answer. The free calculators (student loan, £100k trap) that would have served them sit at the bottom of a 5,700px page.
6. **Home, after the entry (1 leaves).**
   - **Who:** #12 Henry looks for the mortgage module the landing promised: "WHAT CANDID COVERS … Mortgage & debt".
7. **The answer itself (non-answers):**
   - **Who:** #15 Ben, #50 Rory, #7 Raj, #25 Paul.
   - **What they see:** "Nothing stands out right now. Worth checking again when your pay or job changes."
   - **Quote (simulated, Rory, £8k pot at 37):** "I told it I'm worried I've left it too late, and it says nothing stands out?"

---

## 4. Friction and time sinks (estimated)

| Step | Estimated time | Notes |
|---|---|---|
| Landing page read | 10–35 seconds | 5,694px tall on mobile; the stats count up only when scrolled to |
| Entry: name, confidence, interests, "Good to have to hand" | ~35 seconds | No value delivered; feels like set-up |
| "How Candid works" chat | ~15 seconds | Pleasant, but another wait before anything personal |
| Pension walk-through | 9–12 questions, ~85–125 seconds | Employment, salary, extra income (up to 3 more), age, status, %, match, pot, old pots, retirement age, how you pay in |
| Cash walk-through | 10 questions, ~110 seconds | The savings-accounts list (name, amount, rate per account) is the slowest single screen, ~25 seconds |
| Investments walk-through | 8 questions, ~90 seconds | |
| Student loan walk-through | 6 questions, ~45 seconds | The fastest; but it skips age, which causes bug #2 |
| Property readiness | 7–14 questions, ~70–150 seconds | 14 questions when buying with a partner |
| Answer, step by step (3 steps) | ~20 seconds | Good pacing |
| **First answer from the landing page** | **~2–3.5 minutes** | Roughly matches "About 3 minutes"; the risk is the patience of the time-poor, not the claim |
| First answer from a direct module link | ~0.8–2 minutes | Best path observed |

The landing page also contradicts itself on time: "About 3 minutes", "All, in 5 minutes", and the meta description's "under 5 minutes".

---

## 5. What is missing (needs personas raised that the app didn't answer)

- **Final-salary pensions:** NHS, Teachers', civil service alpha, police, university scheme. 7 personas are public-sector higher earners with these schemes.
- **Scottish income tax**, at the six Scottish rates (7 personas).
- **The High Income Child Benefit Charge, and childcare at £100k:**
  - **Who:** #10, #15, #20, #7.
  - **Why it's missed:** the children module is hidden, and the landing page's free calculator covers it, but the app doesn't.
- **Mortgage and remortgage** (#12): advertised, hidden.
- **Share awards and employee share schemes** (#7). Entering them as "other income" works for the tax band, but nothing addresses vesting or sale.
- **Company directors and contractors** (#23, #24): salary plus dividends, and company pension contributions.
- **Employer contributions that aren't a match,** such as a fixed 15% (#22, #18).
- **Maternity, paternity or part-time** (#38, #42): pay that's temporarily lower.
- **Retirement adequacy:** "Is £279k enough?" There's no target income or gap (#50, #19).
- **Two student loans at once:** Plan 2 plus a Postgraduate loan (#3).
- **Sharia-compliant savings and halal investing** (#47, #48).
- **Leaving the UK:** ISA and pension portability (#40). Also NI gaps for a returning expat, beyond the 45+ State Pension line (#39).
- **Crypto** (#27), and **uneven income** such as commission or freelance (#14, #45).
- **Open Banking:**
  - **The gap:** it isn't reachable anywhere in the UI. The app only handles the return from TrueLayer.
  - **Who:** personas who'd have linked rather than type 10 numbers (#11, #34).
  - **Who's relieved:** #29 Alex.
- **"Where do I start?":**
  - **Why it's missing:** deliberately not answered, since Candid is guidance, not advice.
  - **The friction:** anxious personas (#19, #36, #50) wanted an order.
  - **A middle ground:** show the "Still to do" list ranked by £ value.

---

## 6. What works

- **Specific £ answers that check out:**
  - **Oliver:** "£22,219 a year of tax you could save … Paying £39,250 more into your pension through salary sacrifice would bring your income back to £100,000."
  - **Zara:** £10,168. **Rebecca:** £13,330, which she verified (simulated).
  - **Grace:** "Paying your £40,000 bonus into your pension could save up to £20,211 in tax."
  - **Dev:** "£2,520 a year more your savings could earn". **Marcus:** "£3,655 a year", plus the new FSCS line.
- **The property readiness answer is honest:** "That's £139,500 more than 4.5x your income … A home up to £317,000 is within what most lenders lend." The stamp duty checks out.
- **The student loan turning point, chart and "written off" figure are memorable.** Tom (simulated): "So I'll never pay it off. Good to know, honestly."
- **"Estimate it for me (about £328,174)"** on the pot question helps those with a defined-contribution pension who don't know their pot.
- **The "Your position / Why / What you could do" steps:** short, readable, no jargon.
- **Trust:** "Guidance, not advice", "with no stake in what you choose", the "What Candid is and isn't" page, and no bank linking. Sceptics (#29, #26, #8) noted it (simulated).
- **The Chat tab's lump-sum conversation** (#41 Sam): tax on each part of the settlement, then where it could go, ranked by £. The most "adviser-like" moment in the product.

---

## 7. Trust and compliance perception

- **Felt like a data grab:** asking for name and "How confident do you feel about your finances?" before any value (#6, #9, #29). No persona minded income questions once inside a module, because each has a "why" line, e.g. "Sets your tax band, which changes most of what Candid suggests."
- **Felt like a sales pitch:**
  - **The headline:** "Stop leaking wealth to tax traps and idle cash" reads as marketing to #9 and #26.
  - **The paywall timing:** "Your position is ready", then the paywall, after a second module's questions.
  - **The hero mockup:** it shows an old flow ("Step 5 of 9"), which made #29 wonder what the real app is.
- **Felt like advice, or bordered on it:**
  - **An ordering instruction:** "Building this up comes before chasing better rates" (cash answer, emergency-fund shortfall). It's the one line that tells people what order to act in, against the "no directive advice" principle.
  - **Fear language:** "You're approaching a cliff edge, around age 50" (pension page, Lump Sum Allowance). It's alarming, and it appeared in 5 of the 9 real pension runs.
- **Low credibility:**
  - **Wrong rates for Scottish taxpayers:** shown at rest-of-UK rates, with no hint. #31 Fiona (simulated): "If it gets my band wrong, why trust the rest?"
  - **A visible, false assumption:** "We've assumed repayments started in April 2026, the April after you turned 22" shown to a 34-year-old who was never asked his age.
  - **A false alarm:** "£12,000 a year of your employer's money you're not getting" (#22), when his employer pays a fixed 15%.
  - **Zeros for AI and search visitors:** they see "£0 p.a." and "0%" stats in the pre-rendered page.
- **Credibility builders:** sources cited under each landing statistic (PensionBee, FCA), and the company number and address in the footer.

---

## 8. Pricing and conversion signals (simulated)

- **Would pay firmly (4):**
  - **#5 Grace:** £24 a year: "obviously, for the bonus number alone".
  - **#3 Zara:** £2.99 a month: "if it reminds me before bonus season".
  - **#39 Marcus:** £24 a year.
  - **#41 Sam:** £24 a year, for the lump-sum conversation.
- **Maybe (4):** #1 Priya, #11 Dev, #14 Hannah, #34 Luke. The deciding question for each: "What will it do for me next month?"
- **Won't pay:**
  - **Already advised or expert:** #4, #6, #25, #26.
  - **Below target income:** #36, #44, #49.
  - **Poor fit:** #23, #24, #46, #47, #48.
  - **Got "nothing stands out":** #15, #50, #7.
- **Price:**
  - **The higher earners:** £24 a year is seen as cheap. Several would accept £40–£60 a year *if* there's ongoing value: rate alerts, bonus-season and 5 April reminders, re-checks when pay changes.
  - **Monthly:** £2.99 is a non-issue.
  - **The ask, not the price, is the barrier:** "I've already got my answer."
- **What they need to see first:**
  - **The £ figure behind the lock:** the paywall shows a £ figure only when the module has one; for Investments, Grace saw just "Your position is ready".
  - **The paywall before the questions:** a clear list of what subscription adds beyond the next one-off answer.

---

## 9. Segment findings

- **By income:**
  - **£100k–£125k:** the biggest wins (£10k–£22k a year), but the most time-poor. The highest-value users are lost before the value.
  - **£150k+:** often "Nothing stands out", or they already have an adviser. The app doesn't yet speak to tapered allowances, share awards or carried interest beyond a note.
  - **Under £50k:** emergency-fund messages and low savings; little to pay for.
- **By literacy:**
  - **Experts:** checked the £100k-trap maths and found it right, a trust win. They then hit model limits: directors, share awards, final-salary schemes.
  - **Low literacy and anxious:** stall on "not sure", get "We need two numbers…", and leave without a plan.
- **By device:**
  - **Mobile:** the flows work. Minor: the Candid Assist button overlaps cards.
  - **Desktop:** a narrow, phone-width column with the mobile tab bar. It feels like a phone app in a browser, and Rebecca and Raj (simulated) found it "unfinished" for a desk session.
- **By arrival:**
  - **Direct module links** (LinkedIn student loan, a property link from a friend): fastest to value, and the best completion.
  - **TikTok:** most bounces, from impatience and lower income.
  - **Substack:** high intent, high fit.
  - **AI assistant:** careful readers. They read "What Candid is and isn't", and their assistant read the pre-rendered page with £0 stats.
  - **Search** (for mortgage or remortgage): a promise mismatch.
- **Scottish taxpayers** (7): systematically wrong figures; most wouldn't notice until a payslip comparison.
- **Public-sector final-salary members** (7): the worst-served group, for a segment Candid otherwise targets well.

---

## 10. Per-persona appendix

Outcome codes:
- **L:** left at landing.
- **E:** left during the entry questions.
- **H:** left at Home.
- **Q:** left during a module's questions.
- **A:** reached an answer (✓ useful, ~ partly useful, ✗ not useful or wrong).
- **P:** hit the paywall.

★ marks a real browser run; the rest were traced through the engine. Figures are the app's own; quotes are simulated.

| # | Persona | Path | Outcome | Verdict | Top quote (simulated) |
|---|---|---|---|---|---|
| 1 | Priya, £78k, Plan 2 ★ | LinkedIn link → student loan (6 questions, ~48s) | A✓ P | "15 years until your loan is paid off… overpaying doesn't come out ahead"; liked the chart | "That's the answer I wanted, in under a minute." |
| 2 | Olivia, £65k buyer ★ | Property link → 7 questions | A✓ P | "£432,000 to borrow, 6.6x your income" → "up to £317,000" | "Harsh but fair." |
| 3 | Zara, £120k, Plan 2 + Postgrad ★ | TikTok → entry → pension (9 questions) | A✓ P, would pay | £10,168 trap saving; can't enter both loans | "Ten grand? Why did no one tell me." |
| 4 | Daniel, £150k + bonus | Friend → pension | Q (bonus questions) | Left before the answer | "Is this for people like me?" |
| 5 | Grace, quant ★ | Substack → pension → investments | A✓ P, would pay | £20,211 bonus sacrifice; paywall after the second module's questions | "Annoying timing, but £24 is nothing." |
| 6 | Imogen, private equity | Friend → entry | E (confidence question) | Poor fit | "I came for a number, not a quiz." |
| 7 | Raj, £140k + share awards ★ | Substack → pension | A✗ | "Nothing stands out"; allowance-taper note helpful | "It doesn't know what share awards are." |
| 8 | Megan, civil service final-salary ★ | AI → "What Candid is" → pension | Q (pot question) | No path for a final-salary scheme | "There isn't a pot." |
| 9 | Kwame, £55k sceptic ★ | TikTok → entry | E (interests question) | Bounced | "Here comes the funnel." |
| 10 | Oliver, £115k + bonus ★ | LinkedIn → pension | Q (question 9 of 12) | Missed £22,219 a year | "Still no number. Later." |
| 11 | Dev, £60k at 0% ★ | TikTok → cash | A✓ P, maybe | £2,520–£2,737 a year more | "OK, that's embarrassing. Moving it today." |
| 12 | Henry, remortgage | Search → Home | H | Mortgage advertised, absent | "Where's the mortgage bit?" |
| 13 | Tom, NHS, Plan 2 £92k ★ | Friend link → student loan | A~ | "Won't clear"; wrong start year (2026), turning point 2046 | "I never told it my age…" |
| 14 | Hannah, commission | TikTok → pension | A✓ maybe | £4,464 trap saving when commission lands | "Useful, if my commission is what I guessed." |
| 15 | Ben, new dad ★ | Search → pension | A✗ | "Nothing stands out"; no child benefit | "I asked about child benefit." |
| 16 | Lucy, Brighton buyer | Substack → property | A✓ | 6.9x warning, realistic budget | "Clear." |
| 17 | Ahmed, buying together | Friend → property (14 questions) | A✓ | 3.0x, comfortably within lending | "Long, but reassuring." |
| 18 | Isabel, GP, NHS ★ | Search → pension | Q (pot question) | Self-employed copy talks about "salary" and an "employer"; no NHS path | "Not built for GPs." |
| 19 | George, four old pots | TikTok → pension | A✗ ("We need two numbers…") | Dead end for "not sure" | "So… find my pots myself?" |
| 20 | Chris, 60 seconds | TikTok → landing | L | — | "Too much reading." |
| 21 | Laura, university pension | Substack → investments | A~ | £20,000 ISA unused; no pension comparison | "Generic." |
| 22 | Michael, pilot | Search → pension | A✗ (false alarm) | "£12,000 a year of your employer's money you're not getting": his employer pays a fixed 15% | "Am I really missing £12k?!" |
| 23 | James, company director ★ | Search → pension | A✗ | "Every £60 becomes £100 (40% relief)… HR or payroll" | "Dividends don't work like that." |
| 24 | Sarah, contractor | Search → pension | A✗ | Same as #23 | "Not for contractors." |
| 25 | Paul, has an adviser | Friend → pension | A~ | £812k projected; nothing new | "My adviser said the same." |
| 26 | Rebecca, finance director ★ | LinkedIn → pension | A✓, won't pay | Verified £13,330 | "Correct. I'd send it to my team, not pay for it." |
| 27 | Charlie, crypto | Substack → investments ★ | A~ | £720 capital gains tax; crypto ignored | "Cute." |
| 28 | Patrick, police | Friend → cash | A~ | £365 a year; Premium Bonds covered | "Fair enough." |
| 29 | Alex, privacy-conscious | Search → cash | A✓ | £375 a year; relieved there's no bank linking | "Didn't ask for my bank login. Good." |
| 30 | Mo, £46k | TikTok → cash | A~ | £11,700 short of an emergency fund | "I know." |
| 31 | Fiona, Edinburgh ★ | Search → pension | A✗ (wrong rates) | "Nothing stands out" at rest-of-UK rates | "Is this Scottish tax?" |
| 32 | Jamie, Glasgow | Substack → investments | A~ | ISA used, nothing to do | "Told me nothing." |
| 33 | Sophie, Edinburgh £105k | LinkedIn → pension | A✗ (wrong rates) | £100k trap at rest-of-UK rates | (Wouldn't notice) |
| 34 | Luke, Aberdeen | LinkedIn → cash | A✓ maybe | £1,200 a year | "Easy win." |
| 35 | Natalie, NHS Scotland | Search → pension | A✗ ("We need two numbers…") | Final-salary, Scottish | "Not for me." |
| 36 | Kirsty, £38k | TikTok → cash | Q | Below target income | "Too many questions." |
| 37 | Emily, teacher buyer | TikTok → property | A✓ | 8.6x warning | "So, not London." |
| 38 | Amy, maternity leave | TikTok → pension | Q (salary question) | Can't say she's on maternity pay | "Which salary, the real one or this one?" |
| 39 | Marcus, returning expat ★ | AI → cash | A✓ P, would pay | £3,655 a year plus FSCS | "Exactly what I needed." |
| 40 | Nadia, leaving the UK | AI → investments | A~ | Nothing on portability | "Doesn't know I'm leaving." |
| 41 | Sam, redundancy | LinkedIn → Chat | A✓ would pay | Tax on each part of the settlement, then options ranked by £ | "Like talking to someone who gets it." |
| 42 | Rachel, part-time | Friend → pension | Q (interrupted) | — | (Closes tab) |
| 43 | Ellie, low engagement | TikTok → landing | L | — | — |
| 44 | Will, Plan 5, £34k | TikTok → student loan | A~ | "Won't clear" | "So ignore it? OK." |
| 45 | Jordan, creator | TikTok → landing | L | — | — |
| 46 | Tariq, barber | TikTok → pension | A~ | £450 a year of relief missed | "Where do I even open one?" |
| 47 | Aisha, avoids interest | Friend → cash | A✗ | Interest-only options | "All interest." |
| 48 | Yusuf, halal investing | Friend → investments | A✗ | No halal filter | "Not for me." |
| 49 | Ella, trainee accountant | TikTok → landing | L | — | — |
| 50 | Rory, Edinburgh catch-up ★ | LinkedIn → pension | A✗ | "Nothing stands out" for a £8k pot at 37, at rest-of-UK rates | "That's not reassuring, that's wrong." |

---

## 11. Prioritised recommendations

**Quick wins (high impact, low effort):**
1. **Student loan age:** ask age, or the year repayments started, in the student loan walk-through. Don't state "the April after you turned 22" when no age was given (fixes bug #2).
2. **Employer contributions:** ask whether the employer matches or pays a fixed percentage. Stop calling a fixed contribution "money you're not getting" (fixes bug #3).
3. **Paywall timing:** show the paywall, and the £ value behind it, *before* a locked module's questions, not after.
4. **Landing page:**
   - Pre-render the real stat values.
   - Remove "Mortgage & debt" until it exists.
   - Make the time claim consistent.
   - Replace the "Step 5 of 9" mockup.
5. **Copy:**
   - Fix the tie wording ("Savings pay 5.1%, more than your loan's 5.1%").
   - Relabel "£22k: Tax-free allowance you could win back" as tax saved.
   - Replace "cliff edge".
   - Drop "Building this up comes before chasing better rates".
6. **Self-employed and directors:** no "salary", "employer" or "HR" wording. For directors, say personal relief is limited to salary, and mention company contributions.

**Onboarding changes:**
1. **First number before personal questions.** Move name and "How confident do you feel" to after the first answer, or make them optional.
2. **Lead with direct entry points:** the student loan link took 48 seconds to an answer, so open with "What do you want to check?" and go straight into a module.
3. **Fewer income questions:** after "Yes" to other income, offer bonus, dividends and other income as one multi-select, not three questions in a row.
4. **A final-salary pension route:** add "Final salary / career average (NHS, teachers, civil service…)" to "Do you pay into a pension?". Skip the pot question for those members and explain what Candid can and can't say for them.
5. **"Not sure" should lead somewhere.** Replace "We need two numbers to check your pension" with the most useful thing possible from what is known.
6. **Desktop:** a wider layout, and no mobile tab bar.

**Content and copy:**
1. **Each answer step:** one line on what Candid can't see for that person, e.g. "Candid doesn't yet include child benefit or share awards".
2. **Turn "Nothing stands out" into a positive check-list:**
   - **The wording:** "You're getting your full match, you're under the £100k trap, your pot isn't near the Lump Sum Allowance".
   - **Why:** it reassures rather than dismisses.
3. **Promote the free calculators** (£100k trap, student loan) above the fold for 60-second visitors.

**Product gaps (ranked by personas affected and conversion value):**
1. **Scottish income tax** (affects every figure for about 1 in 12 UK taxpayers).
2. **Final-salary pensions** (public-sector higher earners).
3. **The High Income Child Benefit Charge, and childcare at £100k** (unhide a minimal version; it pairs with the £100k trap).
4. **Retirement adequacy:** target income versus projected income.
5. **Mortgage and remortgage.**
6. **Share awards and employee share schemes.**
7. **Plan 2 plus a Postgraduate loan together.**
8. **Ongoing value to justify a subscription:** rate alerts, bonus-season and tax-year-end reminders, re-checks after a pay change.
9. **Sharia-compliant options.**

---

## 12. Bugs found

| # | Severity | Bug | Where | Evidence |
|---|---|---|---|---|
| 1 | **High** (wrong numbers) | No Scottish income tax: rest-of-UK bands for everyone; no question asks for Scottish taxpayer status | `src/lib/tax.js` `calcIncomeTax`; band in `metrics.js` | Fiona (£95k, Edinburgh, real run) is treated as 40%; she pays 45% |
| 2 | **High** (wrong numbers) | Student loan walk-through never asks age or start year; defaults to first repayment this tax year (2026); write-off, turning point and total repaid are off by years for non-clearers | `moduleGuide.js` student loan questions; `studentLoan.js` `slFirstDueYear` | Tom (34, £92k, real run): "We've assumed repayments started in April 2026, the April after you turned 22"; written off 2056 instead of ~2046; "balance starts falling April 2046" |
| 3 | **High** (wrong numbers) | Employer contribution modelled only as a match; a fixed employer % shows as unclaimed | Pension "Up to what percentage will your employer match it?"; `missedMatch` in `metrics.js` | #22 Michael: "£12,000 a year of your employer's money you're not getting" |
| 4 | **High** (no path) | Final-salary pension members asked for a pot; "Estimate it for me" invents a defined-contribution pot | Pension walk-through | Megan (real run): "Estimate it for me (about £64,767)" |
| 5 | Medium | Company director: "Every £60 you pay in becomes £100 in your pension, because of 40% tax relief" and "HR or payroll" on £12,570 salary plus £90k dividends | `moduleReveal.js` pension, not-contributing branch | James (real run) |
| 6 | Medium | Pre-rendered landing shows "£0 p.a.", "0%" and "~£0 p.a." (search engines, link previews, AI assistants, no-JavaScript) | `scripts/prerender.js` output; count-up stats | `dist/index.html` |
| 7 | Medium | Self-employed copy: "What percentage of your salary do you pay in? Your employer may add more if you pay in more"; Home tile "Check you're getting all the money your employer will add" | Pension walk-through; `appEntry.js` `MODULE_PITCH` | Isabel (real run) |
| 8 | Medium | Landing advertises "Mortgage & debt"; modules hidden | `LandingPage.jsx` | Henry |
| 9 | Low | Tie wording: "Savings pay 5.1%, more than your loan's 5.1%…"; module page: "The best savings rate (5.1%) beats your loan's average rate over its life (5.1%)" | `moduleReveal.js` student loan; `MobileStudentLoanDeepDive.jsx` | Priya (real run) |
| 10 | Low | "£22k: Tax-free allowance you could win back": the £22k is tax saved, not allowance | Pension opportunity card | Oliver (real run) |
| 11 | Low | Hero phone mockup shows the old onboarding ("Step 5 of 9", "Tell us about you") | Landing hero image | Landing |
| 12 | Low | Time claims inconsistent: "About 3 minutes", "All, in 5 minutes", meta "under 5 minutes" | Landing page and meta | Landing |
| 13 | Low (UX) | Desktop renders a phone-width column with the mobile tab bar | App shell | All desktop runs |
| 14 | Low (UX) | Candid Assist button overlaps card content on mobile | Module pages | Oliver's module page |
| 15 | Low (UX) | "Yes" to other income asks bonus, dividends and other income as three questions | `sharedQuestions.js` | Oliver, Grace |
| 16 | Info | Maternity leave and part-time pay can't be represented | — | Amy |

Not a product bug: the "DEV TOOLS" button on every screenshot comes from `VITE_SHOW_DEV_TOOLS` in `.env.local`, used for this local build.
