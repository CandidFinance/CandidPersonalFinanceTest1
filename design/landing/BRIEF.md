# Landing page brief (candid-finance.co.uk/)

DRAFT 26 Oct 2026. Product truth (audience, purpose, copy rules) lives in /PRODUCT.md; this file holds what is specific to the landing page. Nothing gets built until Harvey has seen a side-by-side and said go.

## 1. Job of this page

- **Mode:** Persuade. The visitor decides whether Candid is worth three minutes, then taps start.
- **Who arrives:** mostly on a phone, from a TikTok, LinkedIn or Substack post about one specific question (student loan, £100k trap, idle cash). A minority on desktop from search.
- **What they must believe in the first screen:** this works out *my* money in pounds, it is for someone on my salary, it is not selling me anything, and it is quick.
- **The one action:** start the check (StartCheckButton). The second route is a 30-second free calculator.
- **Proof we can honestly show:** real app screens with real £ answers, the free calculators, the list of areas covered. No testimonials, user counts or press exist; don't fake them.
- **Success:** more visitors tap start and reach their first £ answer. Measured in PostHog (`app_entered`, first answer).

## 2. What the current page is, honestly

It is the category template: a split hero (copy left, phone right, a badge and a tick row), three stat tiles, a 2x2 grid of icon cards, a dark rounded panel of pills, three more cards, a closing CTA. Green, gold and cream give it some identity, but with the colours removed it could be any fintech. It also leans on cards everywhere, which CLAUDE.md rule 3 says not to do.

What to keep: the headline idea (money lost to tax traps and idle cash), the real app screenshot, the free calculator links, the regulatory line, the wordmark.

## 3. Design families

Each family is a whole visual world, not a skin. They come from things this audience already knows and trusts. I'd show you the first screen and the start of the next section for whichever families you shortlist (2 or 3), next to the current page.

### A. The weekend broadsheet
- **Idea:** the page reads like the money section of a Saturday paper. Your situation is the story; the £ figure is the headline.
- **Look:** warm newsprint ground, black and dark-green ink, a tall condensed serif for headlines, column rules, a standfirst, small caps bylines. Gold used only as a highlighter mark.
- **First screen:** a front-page layout. Masthead with the wordmark, one huge serif figure ("£2,840 a year") as the lead, a standfirst saying what it is, the start button set in the column like a coupon.
- **Risk:** can tip into pastiche (fake newspaper). Needs restraint to stay a product page.

### B. The statement
- **Idea:** Candid as the payslip or annual statement you never got: line by line, where your money leaks, totalled.
- **Look:** white paper, tabular figures, hairline rules, a monospaced or tabular numeral face beside the serif, dark green for totals. Very little colour.
- **First screen:** an itemised statement builds down the page: "Pension tax relief not claimed £1,420 / Cash earning 1.5% instead of 4.5% £600 / Student loan overpayment that will be written off £900", then a total line in the serif and the start button where you'd sign.
- **Risk:** illustrative figures must be labelled as an example, never read as a claim about the visitor. Can feel dry if the motion and typography aren't confident.

### C. Private-bank stationery
- **Idea:** the care a private bank gives its clients, at app prices. The world the current green and gold already hint at, taken all the way.
- **Look:** deep green ground, cream laid-paper panels, gold used like foil on rules and the wordmark, engraved-style serif, generous margins, letterpress weight.
- **First screen:** full-bleed green, the wordmark like a letterhead, one line of serif copy, a cream "letter" card holding a real £ answer from the app, start button in cream.
- **Risk:** closest to what exists, so the least change. Can read exclusive or stuffy, which feeds the "is this for people like me?" bounce for both ends of the audience.

### D. The map
- **Idea:** "Your finances, mapped", taken literally: Ordnance Survey grammar. Each area of money is a region; leaks are marked on the map.
- **Look:** pale map ground, contour lines, grid references, a legend box, OS-style labels in a clean sans, the serif kept for figures. Green from the existing palette fits naturally.
- **First screen:** a stylised map of the six modules with £ figures pinned on it and a legend holding the headline and start button.
- **Risk:** the metaphor needs work to stay readable on a phone. It's the most distinctive, and the most likely to be clever rather than clear.

### E. The one chart
- **Idea:** one data graphic does the persuading, in the tradition of the FT and the ONS: what your money does over 10 years with and without the changes.
- **Look:** off-white, one strong chart, annotation callouts in small sans, the serif for the big number, green and gold as the only two data colours.
- **First screen:** headline above a full-width line chart with two lines pulling apart and the gap labelled in £, start button under the chart.
- **Risk:** a chart needs illustrative numbers, labelled as an example. Charts read less well than a single figure on a small phone.

### Standing option: the category standard, done properly
The current layout kept, at the craft level of the best UK fintech pages (e.g. Monzo, Chip, Plum). Pick this if the aim is polish rather than a new look. It won't stand out, but it is familiar.

**My pick:** B (statement) for the phone visitor with one question, with A's typography as a possible borrow. It shows the product's real output (£ line items) in the first screen, which the current hero only does through a small screenshot.

## 4. Your inspiration

Drop images or links into `design/landing/inspo/` (or paste them in chat) and add a line each below: what you like about it (type, colour, layout, feel), and anything to avoid.

| Source | What Harvey likes | Avoid |
|---|---|---|
| inspo/chronotask-scattered-edges.png | Simple: lots of "mess" round the edges, one clear message in the middle; the design shows the problem it solves (consolidation) | |
| inspo/coreshift-clean.png | Very clean | |
| inspo/profinance-colour-arrow.png | Good use of colour; the hand-drawn arrow to the download button is impactful | |
| inspo/savium-shows-product.png | Minimal, clear CTA, shows the product so visitors know what they'll get | |
| inspo/finix-space-plane.png | Good use of space, clear headline, small off-centre disclaimer, shows the app, nice touch with the paper plane | |
| inspo/kumo-hero-image.png | Ultra-HD image with the site built round it, minimal elsewhere | Hard for Candid: no obvious image or landscape fits the brand |

**Shortlist (26 Oct):** B, D, E. Review board: https://claude.ai/artifact/Gp2Ho9VKpookQrZtdpoMzx (mocks in `mocks/`, screenshots of the live page in `current/`).

**Chosen (26 Oct): B, Statement.** Harvey's notes: no cropped tiles; keep the framing on money leaking (that's what captures users); on scroll the receipt rises and each tile is pulled into its line while the total ticks up; nav links centred. Four versions with live editing: https://claude.ai/artifact/EXBB8F4vDgnhd3aMSpqW1T (source `statement-lab.html`).

**Round 2 (26 Oct): Highlighter version.** Cyan highlighter rgb(81, 245, 212) = #51f5d4. Headline and total figure in Georgia, to match the wordmark. Tiles at size 1, tilt 5. "About 3 minutes" dropped from under the button. Framing: in testing, "leaking" and gains landed less well than money being lost that Candid's guidance helps save, and it's about finances, not just money. So: headline "Save the money you're losing." with "losing" highlighted, CTA "See what I could save", receipt "What you could save". The lede names the £100k tax trap and doesn't say "quietly".

**Build decisions (26 Oct):**
- The new hero and receipt replace the current hero and the three stat tiles. The sections below (How it works, What Candid covers, Free calculators, final CTA) stay and get restyled to match: Georgia, cyan highlighter, fewer cards.
- Centred nav links approved for the shared header on every page.
- £85k example receipt approved for the live site, labelled as an example.
- Launch: not yet. The landing page ships together with the other pages once they've been refined in the same style, so this work must not reach `main` (production) on its own.
- Next: build in plan mode from `statement-lab.html` (Highlighter version), keeping the StartCheckButton `source` names, using framer-motion for the scroll animation, and showing the finished receipt when reduced motion is on.

**Brand (26 Oct):** the wordmark stays Georgia Bold. Palette and type are open; Claude drives.

## 5. Dos and don'ts

**Do**
- Make one £ figure the hero of the first screen, in the display serif.
- Show the real product (an app screen or a real-format answer) above the fold on a phone.
- Keep one primary action, visible without scrolling at 390px wide.
- Label any example figures as an example.
- Use whitespace, rules and section backgrounds to separate content; save cards for things you tap.
- Keep motion purposeful and short; everything works with reduced motion on.
- Hit 4.5:1 contrast for body text, including the small print.

**Don't**
- Use emoji, stock photos of smiling people, 3D blobs, or purple-to-blue gradients.
- Repeat the template: split hero with a badge row, three stat cards, a 2x2 icon grid, a centred CTA strip.
- Put an icon in a rounded square above every heading.
- Use grey text on coloured backgrounds, or gold text on cream for anything that must be read.
- Invent proof: testimonials, "trusted by", user counts, star ratings, press logos.
- Use directive copy or urgency ("Act now", "what to do first", countdowns).
- Add a second accent colour beyond what the family defines.
- Let more than one thing animate at once in the first screen.

## 6. How we review (side by side)

1. You shortlist 2 or 3 families above (and add inspiration).
2. For each, I build a static mock of the first screen and the start of the next section, at phone (390px) and desktop (1440px). Mocks live in `design/landing/mocks/` and never touch `src/`.
3. I put them on one comparison page: the current page's screenshot on the left, the mock on the right, with a phone/desktop switch. I can publish it as a private link so you can open it on your phone.
4. You react: pick, combine, or send back with notes. We repeat until one is chosen.
5. Only after you say go do I build it into `src/site/LandingPage.jsx`, uncommitted, for you to check on localhost.

## 7. Open questions

1. Are green, gold, cream, Playfair and DM Sans fixed, or can a family change them?
2. Show the subscription price on the landing page?
3. Keep the hand-holding-phone image, or is any real app screen fine?

## 8. What was built (Oct 2026)

Family B, the statement (Highlighter version), now runs across every site page: Home, The Problem, How it works, About, What Candid is, Sign in and 404.

- Shared pieces live in `SITE_CSS` in `src/site/SiteLayout.jsx` (labels, Georgia headings, the cyan `<mark>`, numbered rows, heading-left split rows, the closing CTA). `SITE_BG` is the layout's only background. Pages add only their own classes.
- Cards are kept for links (the calculators) and forms (Sign in). Everything else sits on hairline rules.
- Entrances only rise (`riseIn`). Sideways entrances were removed with their phone-overflow workarounds.
- Gold is gone from the site. The footer keeps the green, with a white Georgia wordmark.
- The highlighter marks one word, two on The Problem: "minefield" in the headline and "costing" in the closing line.
- Closing line on every page: "Find out what not optimising is costing you." It replaced "See what your finances could be doing"; "should" was rejected as reading like a verdict.
- Rows in a ruled list keep their natural heights; equal heights only suited the old side-by-side cards.
- Not restyled yet: the standalone .html pages (calculators, privacy, terms), which use `<candid-footer>` from `src/lib/sitePartials.js`.
