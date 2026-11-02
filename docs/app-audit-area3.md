# App audit, area 3: module answer screens

Audited 1 Nov 2026 (impeccable `reference/audit.md`, Operate mode, the app on its own terms). Scope: `src/mobile/screens/MobileModuleReveal.jsx`, `MobileModuleDeepDive.jsx`, `MobileModuleGuide.jsx`, `src/mobile/ModuleScreenParts.jsx`, everything in `src/mobile/deepdive/`, and the shared parts they render.

Line numbers are from the audit and predate the P0 and P1 fixes (2ac8959, 925d88c). Search by the quoted text or component name, not the line.

Score before fixes: **11/20**. Accessibility 2, Performance 3, Theming 2, Responsive 2, Implementation integrity 2. The shared pieces (OpportunityTile, AlertBox, InfoButton, CountUpFigure) hold up, but each deep dive builds its own presentation: Kids reads like one product, Pension and Tax trap like two others.

## Status

| Batch | State |
|---|---|
| P0 (1–2) | Shipped 2 Nov, 2ac8959 |
| P1 (3–14) | Shipped 2 Nov, 925d88c |
| Machine-made top five | **Next.** Harvey's chosen focus before plain P2 order |
| P2 (15–33) | Open. Most of it overlaps the top five |
| P3 (34–39) | Open |

Decisions Harvey made along the way:
- **Directive copy.** Keep the PRIORITY tags and alert icons. Never use "Build". Options are phrased "You could…". Deadlines read "To capture it, this needs actioning before…". People should act optimally, but Candid doesn't tell them to.
- **Tax trap ways back.** Shown largest worth first, in the order the engine sorts them.
- **Tax trap PlanAhead.** The red stake box stays: Harvey keeps the alert icons.
- **Reuse, don't add one-offs.**
  - Tokens from areas 1 and 2, plus WARNING_TEXT added in P1: GOLD_TEXT, MUT_ON_CDARK, WARNING_TEXT, LABEL_CAPS, HAIRLINE, CARD, SECTION_TITLE, NOTICE_LABEL, ROW_TILE, SR_ONLY.
  - The `.tap44` class.
  - `useDialogFocus`.
  - PrimaryButton `size`/`outline`.
  - MobileWinTile `level`.

## Machine-made top five (next)

Ranked by how much each makes the screens look machine-made.

1. **Everything is a tile, and tiles sit inside tiles.**
   - MobileWinTile is the universal container: every deep dive is a stack of identical white chevron tiles with a pill tag.
   - They nest 2–4 deep: Cash 266–278, Pension 393–404, Student loan 199–254.
2. **Tracked uppercase micro-labels and badges everywhere.**
   - 48 hand-rolled uppercase labels at 8.5–11px, none of them using LABEL_CAPS.
   - A tag pill on nearly every tile: "TODAY", "STRATEGY", "WHAT IF", "PROVIDERS", "TAX LATER", "FUTURE OPPORTUNITY", "PRIORITY".
   - Icons in tinted squares: the module header, LookingAhead alternatives 168–171, provider rows.
3. **Stat-tile grids.** Nine separate 2-up, 3-up and 2×2 boxes of tinted cells, each with a different tint and radius, and the label above the figure in some and below in others.
4. **Staged effects and glow.**
   - A fake "Checking your figures" wait of about 5.5s.
   - A 1.5s splash every time a module opens.
   - A sheen that loops forever.
   - CTA-blue glow shadows.
   - Glass blur: Student loan 543, Tax trap 356.
   - Coin, party-popper and Sparkles flourishes: Reveal 125–129.
5. **Notice and copy sprawl.**
   - Ten notice styles.
   - Long paragraphs hidden behind "?".
   - Filler copy: "It's not worth getting wrong", "free money".

**The model is Kids:** hairline rows, no cards, plain sections.

**Suggested pass**, mostly P2 items 15–19:
1. Section titles become `<h2 style={SECTION_TITLE}>`.
2. Two notice styles only: AlertBox for warnings, and a neutral note (HAIRLINE, NOTICE_LABEL, body) for the rest.
3. CARD on the outer container only, with HAIRLINE rows inside.
4. One figure-row pattern in place of the stat grids.
5. Sentence-case labels, and tags only where they add something the title doesn't.

## P2: open

15. **Ten notice styles.**
    - Left bar 4px G plus tint: Pension 284, 320, 347, 382.
    - Left bar 4px gold plus tint: Student loan 807.
    - Left bar 3px gold, no fill: Investments 227.
    - Red tint with an uppercase label: Pension 247, 682; Student loan 763.
    - Gold tint with an uppercase label: Pension 628.
    - CliffEdge `#fdecea` box: LookingAhead 74.
    - Amber button-notice: Tax trap 419.
    - Reveal aside with icon and bar: Reveal 222.
    - AlertBox.
    - CDARK caption boxes: Cash 58; Investments 177, 188.
    - **Fix:** AlertBox for warnings and one neutral note for everything else. Drop the left bars.
16. **Cards nested in cards.**
    - Cash 267–278: MobileWinTile inside MobileWinTile.
    - Pension 394–403: the Explore tile holds other tiles, which hold tinted boxes.
    - Student loan, four levels: 199 > 244 > ScenarioModelling 51 > 69.
    - LoanCompare 51 inside 78.
    - **Fix:** CARD on the outer container only, rows inside.
17. **Four card styles and 14 radius values** (2, 3, 5, 6, 8, 9, 10, 11, 12, 14, 16, 20, 100 and 999px).
    - Tax trap `tile`: r16 with a shadow.
    - Reveal: r16.
    - ScenarioModelling: r12.
    - Everywhere else: r14 with a 1.5px border.
    - **Fix:** CARD and RADIUS_CARD, with 10 for inner radii.
18. **Stat-tile grids built nine ways.**
    - Drawdown Pill 2×2 (88–93).
    - Pension taper trio (231–244) and 368.
    - BonusTile (690–709).
    - Student loan LoanStats 2×2 (389–426) and LumpSum 3-up (484).
    - ScenarioModelling 3-up (261).
    - Investments 125–136.
    - Tax trap Cell (61, 403, 625).
    - **Fix:** one figure row (sentence-case label, serif figure, hairline-separated), and at most one 2-up per screen.
19. **48 hand-rolled uppercase micro-labels and a tag on most tiles.** **Fix:** sentence case (NOTICE_LABEL or SECTION_TITLE). Keep a tag only where it adds information.
20. **Buttons built by hand instead of PrimaryButton.** DeepDive 99–111 ("Mark as reviewed" and "Back to Modules"); Investments 162–163; LoanBalanceEditor 44–45; Student loan 218–220 and a link styled as a button at 498; ScenarioModelling 160–161, 328–329; Pension 83–88; CheckedCard 36–37.
21. **Segmented controls reinvented.** Tax trap `pill()` (350, 383); LoanCompare yes/no (121); Tax trap partner answers (843–846). P1 already added state to YearToggle and the Drawdown toggle. **Fix:** PillSlider with a label.
22. **The module header is written three times, with a decorative 42px icon square.** Reveal 90–98, DeepDive 65–78, Guide 34–42. **Fix:** extract a shared ModuleHeader and consider dropping the icon square.
23. **About 20 raw hex colours, including six reds.**
    - Where: Tax trap 55, 233, 248, 470, 592–593, 647–651, 747; SubscribeButtons 7, 34; LookingAhead 21, 64, 74; Investments 116; Cash 135 (`#1e4d35`).
    - LookingAhead's `EXTRA_COLOR` equals STUDENT_PURPLE, so Pension's "pay in more" bar (Pension 475, 489) uses the Student loan colour.
    - **Fix:** use tokens, add one COST_TEXT token, and give that bar a Pension tint.
24. **Too many accent colours.** CTA_BLUE is reserved for the start button and the paywall subscribe, but it also drives "See my options" with a glow (Tax trap 853), the ScenarioModelling tile (52–60) and PlanAhead's glow (223). **Fix:** G for "See my options", and remove the glows.
25. **A sheen that loops forever.** ScenarioModelling 31–40: a 7s infinite sheen with `will-change` left on. **Fix:** run it once, as OpportunityTile does.
26. **Built-in waits.**
    - Reveal's "Checking your figures" holds about 5.5s (23, 50–53). **Fix:** under 1.5s.
    - GuidanceIntro's 1.5s splash on every module open (GuidanceNote 31–52). **Fix:** once per session.
    - Tax trap walkthrough gaps up to 2s (461). **Fix:** halve them.
27. **Reduced motion misses the review celebration.** `coinFloat`, `btnGoldTint` and `reviewedIn` (keyframes in MobileLayout 27–29) still run. **Fix:** gate them on `useReducedMotion`.
28. **Charts without a text alternative.** The Student loan return chart `<svg>` (812). Pension GrowthChart bars (456–486). **Fix:** `role="img"` with a summary label, or an SR_ONLY table.
29. **Five ways to show and hide content.** Two chevron styles, Plus/Minus, an "Assumptions" pill (Drawdown 150) and "?". "Explore what-ifs" is a tile in Pension (394) but ExploreToggle in Student loan (155). **Fix:** one chevron style, and ExploreToggle everywhere.
30. **Filler, fear and hedging copy.**
    - "It's not worth getting wrong" (Tax trap 205–206).
    - "less than 1% of the £X at stake" (258).
    - "immediate flexibility for rent, bills, or short-term savings" (634).
    - Any "free money" left in Pension.
    - PartyPopper icon (Pension 705).
    - "Use it or lose it" in CRITICAL red (Investments 184).
31. **Long paragraphs and jargon.**
    - Long paragraphs: Investments 233 (~75 words), LookingAhead 135 (~95 words), Cash 235, Pension 293–296.
    - "Post-tax salary foregone" should be "forgone" (LookingAhead 37–38).
    - "post-tax" / "income-tax" captions (Drawdown 89–90).
    - "Theoretical maximum" (Pension 620), "inject in one go" (595), "Uplift if you match the cap" (566).
32. **Tiny type.** 8.5px (Pension 692, 701); 9px badges (ProviderTile, ProductListTile); 9.5px tags and labels in many places. **Fix:** an 11px floor, and 12px for labels.
33. **The Drawdown tax-free toggle may overflow at 360px** (MobileDrawdown 109–120). P1 removed the "?" from each option. **Fix:** check at 360px; shorten the labels to "Each withdrawal" / "Year 1 lump sum" if needed.

## P3: open

34. Five compact £ formatters (`k`, `compact`, `fmtK`, `fmtCompact`, `fmtBig`). Merge them in `format.js`.
35. CountUpFigure 33 hand-rolls a screen-reader-only style. Use SR_ONLY.
36. Stale fallback copy, "isn't built for mobile yet… view it on desktop" (DeepDive 88).
37. RateChart works only with a pointer (Tax trap 981–982). Arrow-key stepping is optional.
38. Reveal's "Checking your figures" is a `<p>` (154), and step changes aren't announced. Make it a heading and move focus to the new step's title.
39. The Investments ISA CTA label "To my ISA" (242) is odd copy.

## Done (for reference)

**P0, 2ac8959**
- MobileWinTile's header is a button with `aria-expanded`, and no tile is numbered.
- Student loan's "Step n" prefixes are gone.
- The Cash titles are "Your emergency fund gap" and "Rates on your savings".
- Tax trap's ways back read "You could…", largest first.
- Reminder copy says what's at stake and when it needs actioning.

**P1, 925d88c**
- Contrast tokens applied, and WARNING_TEXT added.
- All six sliders have names.
- `.tap44` on small controls, plus a taller "Change provider" select.
- Provider lists open with real buttons, and keyboard focus opens a collapsed list.
- Section titles are headings, with MobileWinTile `level`.
- The Tax trap walkthrough is a dialog with `useDialogFocus`.
- Reviewed shows once.
- Cash's dot and its gap restatement are gone; Student loan's "Critical." word is gone.
- Unlike figures are no longer added together.
- Growth copy reads from `growth.js`, and the ISA projection uses `retirementAgeFor(d)`.
