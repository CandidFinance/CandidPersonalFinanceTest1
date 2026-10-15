# Candid Visual Consistency Audit

Date: 2026-09-28
Scope: `src/` (React app, mobile screens, mockups, PDF export) + root-level static HTML pages (calculators, privacy, terms). Audit-only — no fixes applied.

Reference: `src/design-tokens.js` is the single source of truth for colour/type/spacing tokens. It already documents some known, historically-accepted drift (29 distinct font-size literals, 11 distinct border-radius values, several one-off chart colours) — those are called out below where relevant, not re-litigated as new findings.

**Zero-emoji policy: clean.** No pictographic emoji found anywhere in `src/` or the root HTML pages. The only non-alphanumeric glyphs in copy are typographic arrows (→ ← ↑ ↓) and checkmarks (✓), which are a separate finding under Icons below, not an emoji-policy breach.

---

## Colour

1. **Four unrelated "muted grey" values compete for the same secondary-text/dimmed-state role**, none of them tokenized in `design-tokens.js`:
   - `MUT` (`#6b6b6b`) — the actual token, used app-wide for secondary text.
   - `#9a9a8e` — used for legend labels/descriptions in `MobileForecastScreen.jsx` (lines 201-203, 216, 287), `MobileInvestmentsDeepDive.jsx` (chart segment colours, line 25/31/37), `MobileModulesScreen.jsx:185`, `MobilePensionDeepDive.jsx:498`.
   - `#4a4a4a` — used for body copy in `MobileForecastScreen.jsx` (lines 231, 291-293, 329, 332-333) and `MobileModulesScreen.jsx:127`.
   - `#a8a89c` — used as the "reviewed/dimmed" status colour and as the background of the small circular info-button ("?") repeated across `MobileCashDeepDive.jsx:24`, `MobilePensionDeepDive.jsx:66,80`, `MobileInvestmentsDeepDive.jsx:126`, `MobileOnboardingStep.jsx:122`, `MobileForecastScreen.jsx:216,287`, `MobileModuleDeepDive.jsx:25`, `MobileModulesScreen.jsx:102`.
   - `#8a8a7e` — one-off in `mockups/HowItWorksPage.jsx:92`.
   - **Likely correct pattern:** `MUT` (`#6b6b6b`) — it's the tokenized, desktop-consistent value. The other three read as mobile-only drift that never got reconciled against the token.

2. **`scoreBand()`'s "Needs work" tier uses an untokenized amber, `#d9822b`** (`CandidApp.jsx:1927`), that doesn't match `GOLD` (`#c4963a`) or anything else in the palette. The other four bands in the same function use `G`, `#2d6b4a` (=`SUCCESS`), `GOLD`, and `#c0392b` (=`CRITICAL`) — all real token values, just re-typed as literals instead of imported. `#d9822b` is the odd one out with no token backing it at all.

3. **`terms.html`'s `h2` sets `color: #000`** (pure black, line 13) instead of `TEXT` (`#1a1a1a`) used by every other heading/body colour on that page and on `privacy.html`. Only instance of pure black found anywhere in the audit.

4. **`#0f2018` (a third near-black-green, distinct from `G` `#162f24`) is used consistently for one specific role** — the fixed cookie-consent banner background — across `mortgage-vs-savings-calculator.html:39`, `100k-tax-trap-calculator.html:39`, `student-loan-calculator.html:39`, and separately for `DevTools.jsx`'s panel background (lines 234, 283). It's never in `design-tokens.js`. *Ambiguous — needs a decision:* is this a deliberate "darker than brand green" banner shade, or should it just be `G`?

5. Not a finding, flagged for completeness: `mockups/WaitlistForm.jsx:10` / `mockups/NewLandingPage.jsx:12` introduce `#0071E3` (Apple blue) for the waitlist CTA — this is explicitly documented in-code as an intentional, brief-driven one-off exception to the green/gold palette, not accidental drift. No action implied.

---

## Typography

1. **`privacy.html` silently drops out of the DM Sans body font.** Its `<nav>` header correctly uses `'DM Sans',Arial,sans-serif` (matching `terms.html`), but the legal-copy container itself is set to `font-family:Arial,sans-serif` (line 57), and six separate rules further down force `font-family: Arial !important` (lines 19, 24, 29, 34, 41, 46, 71). No other page in the app does this — `terms.html`, which has near-identical structure and content type, correctly inherits `'DM Sans', Arial, sans-serif` throughout. This reads like a leftover from a copy-paste (Word/Docs) import rather than a deliberate choice, and it's the single most visible typography break in the app since it affects an entire page's body text.

2. Already self-documented, restated for completeness: `design-tokens.js` records that font sizes are **not** a clean scale — 29 distinct literal values (8px–42px) exist across the app, and only 5 of the most common are tokenized (`FONT_SIZE.CAPTION/LABEL/BODY/HEADLINE/HERO`). This is acknowledged, accepted drift, not a new finding — listed here only so the audit doesn't look like it missed it.

---

## Spacing & Layout

1. Also already self-documented: **border-radius has ~14 distinct raw values in active use** (2, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 24px, plus the `RADIUS_PILL` token at 100px for pills/buttons — pills are the one genuinely consistent case). There's a loose, not-quite-rule pattern worth noting for the follow-up pass: mobile card containers lean toward **14px** (`MobileWinTile.jsx:15`, `MobileHomeScreen.jsx:165,212`, `MobileForecastScreen.jsx:154,258`, `MobileProviderTile.jsx:26`, `MobileProductListTile.jsx:18`), while `CandidApp.jsx`'s modal shells and several marketing mockup cards lean toward **18px** (`CandidApp.jsx:2115,3027,3137`, `mockups/HowItWorksPage.jsx:77`, `mockups/NewLandingPage.jsx:77,110,324`, `mockups/TheProblemPage.jsx:79,89`). Buttons/inputs vary 6–10px with no evident logic. *Ambiguous — needs a decision:* whether to formalise "14px mobile card / 18px modal" as real tokens, or leave as-is per the token file's existing "don't invent false consistency" stance.

---

## Icons

1. **Raw Unicode arrows/chevrons are used as interactive affordances in several places, inconsistent with the "single Lucide icon set" rule**, even though `design-tokens.js` explicitly states lucide-react is the only icon system and the app does otherwise honour that (no other icon library found anywhere). Concretely:
   - Expand/collapse chevrons: `MobileHomeScreen.jsx:168` uses a literal `"⌄"` character for the net-worth section's expand toggle, while the equivalent affordance elsewhere (`GoToProviderButton.jsx`) uses Lucide's `<ChevronDown>`. `MobileModulesScreen.jsx:123` separately uses a literal `"›"` for its own expand toggle.
   - "See more/show all" links use literal `"↓"` (`CandidApp.jsx:4600`, `:4961`) rather than a Lucide chevron/arrow icon.
   - CTA link arrows (`"Continue →"`, `"← Back"`, `"See all modules →"`, etc.) recur as literal `→`/`←` text throughout `CandidApp.jsx`, `main.jsx`, `BetaGate.jsx`, `DevTools.jsx` — dozens of occurrences. This is consistent *with itself* (always the same glyph, same role) but never uses Lucide's `ArrowRight`/`ArrowLeft`, which the app does import and use elsewhere (`ArrowUpRight` in `CandidApp.jsx`). *Ambiguous — needs a decision:* text arrows in CTA copy may be an intentional editorial choice distinct from icon usage; flagging rather than assuming.
   - Raw `"✓"` checkmark glyphs appear 5 times in `CandidApp.jsx` (lines 356, 1070, 4023, 4768, 4770, 5148) doing the same job Lucide's `<Check>` does elsewhere in the very same file (e.g. lines 2650, 2671, 3665, 5496, 5498). This one reads as the clearest actual inconsistency of the group — same file, same intent, two different renderings.

2. **No defined icon-size scale** — Lucide `size` props range from 10px to 32px with no evident tiering (e.g. "16 for inline, 20 for nav, 28 for hero" isn't consistently followed). *Ambiguous — needs a decision:* likely fine as contextual, but flagging since it's the same "untokenized spread" pattern seen in font-size and border-radius.

---

## Components (headers, cards, buttons, status indicators)

1. **There is no single shared `<Header>` component — this directly contradicts design rule #1.** Three structurally different navigation implementations exist:
   - `NavBar` in `CandidApp.jsx:977` — the in-app dashboard/modules header. 3-column grid, background is either `G` (dark) or `CREAM` with a border (`light` prop), not fixed-position.
   - `NewSiteHeader.jsx` — the marketing site header (Home / The Problem / How it works). Always `CREAM` background, `position: fixed` with scroll-hide behaviour, 80px fixed height, includes nav tabs + "Beta Tester" button + hamburger menu on mobile.
   - Raw inline `<nav>` markup, duplicated near-verbatim across five standalone HTML files (`privacy.html:52`, `terms.html:19`, `mortgage-vs-savings-calculator.html:56`, `100k-tax-trap-calculator.html:56`, `student-loan-calculator.html:53`) — always dark `#162F24` background with a `GOLD` wordmark and a static (non-fixed) position, plus a page-title span and a "← Back to Candid" link that neither of the two React headers has.
   These three don't just differ in code path (expected, since two are React and one is static HTML) — they differ in visual result: background colour logic, fixed vs. static positioning, and what sits alongside the wordmark. This is the highest-impact finding in the audit (see summary below).

2. **Box-shadow colour splits into two camps.** Nearly every card/modal in `CandidApp.jsx` and `mobile/` uses a brand-green-tinted shadow (`rgba(22,47,36, 0.05–0.25)` — e.g. `MobileWinTile.jsx:15`, `MobileHomeScreen.jsx:165,212`, `CandidApp.jsx:2116,3027`, `mockups/NewLandingPage.jsx:78,110`). But `BetaGate.jsx:79` and `main.jsx:269`'s auth/report-request modals, plus `DevTools.jsx:210,223`, use plain black shadows (`rgba(0,0,0,0.1–0.4)`) instead. Dominant pattern is the green tint; the black-shadow modals are the outliers.

3. **Single-state-indicator rule (design rule #4) appears to be broken on the mobile modules list.** In `MobileModulesScreen.jsx` (lines 100–120), a single module's status (`statusColor`, derived once per row) is applied to: the icon's fill colour, the icon's background tint, the headline £-figure/label colour, *and* a separate small coloured dot next to the status text — four simultaneous encodings of the same one piece of state. Compare to design rule #4's "eliminate redundant badges or secondary icons repeating the same status." Worth checking against the desktop equivalent (`CandidApp.jsx` module list, which computes its status colour differently and wasn't confirmed to have the same redundancy) to decide whether to trim mobile down to one indicator (most likely just the dot + label, dropping the icon-tint and figure-colour duplication) or whether this is intentional emphasis.

4. **Duplicated inline "info" button markup.** An identical circular 15×15px "?" button (`background:"#a8a89c"`, `border-radius:"50%"`, etc.) is copy-pasted verbatim across five files (`MobileCashDeepDive.jsx:24`, `MobilePensionDeepDive.jsx:80`, `MobileInvestmentsDeepDive.jsx:126`, `MobileOnboardingStep.jsx:122`, `MobileForecastScreen.jsx:216,287`) instead of being one shared component. Not a visible bug today since all five copies currently match, but it's exactly the kind of duplication that produces silent drift the next time only one of the five gets edited.

---

## Other

1. **The PDF export has its own, entirely separate colour system.** `src/pdf/reportData.js` (lines 7–13) defines seven background/text colour pairs for report category badges (`#EAF3EE`/`#1F5E42`, `#F7EFDC`/`#8A6A1D`, `#E7F0E9`/`#1B4332`, `#FBEAE7`/`#B54A38`, `#E8EEF3`/`#355070`, `#FBEFE3`/`#8C5A2B`, `#EFEAF5`/`#5B4B8A`) that don't derive from `design-tokens.js`'s `SC`/status colours at all — they're pastel and printer-friendly rather than the app's saturated green/gold/red. This may be entirely intentional (PDF export often wants different, calmer colours than a live UI), but *ambiguous — needs a decision*: there's currently no shared source of truth between in-app status colour and PDF badge colour, so the two systems could drift apart from each other with no way to notice.

2. **Widespread re-typing of token values as raw hex literals instead of importing the token.** `BetaGate.jsx`, `DevTools.jsx`, `main.jsx`, `ErrorBoundary.jsx`, `MobileLayout.jsx`, and others hardcode `#f6f0e6`, `#162f24`, `#1a1a1a`, `#6b6b6b`, etc. directly rather than importing `CREAM`/`G`/`TEXT`/`MUT`. The values currently match (so this isn't a rendering bug today), but the casing is already inconsistent between copies (e.g. `ErrorBoundary.jsx:34-35` uses `#F6F0E6`/`#162F24` uppercase, `design-tokens.js` defines them lowercase) — a purely cosmetic tell that these are independently-typed duplicates, not a shared reference, and the likely mechanism by which future colour drift (like item 1 in Colour) gets introduced.

---

## Running counts

| Category | Findings |
|---|---|
| Colour | 4 (+1 reviewed/cleared) |
| Typography | 2 (1 new, 1 restated from design-tokens.js) |
| Spacing & Layout | 1 (restated/expanded from design-tokens.js) |
| Icons | 2 |
| Components | 4 |
| Other | 2 |
| **Total** | **15** |

Well under the 100-item threshold — this is the full list, not a first pass.

---

## Top 5 highest-impact items (most likely to read as a bug, not a style choice)

1. **No shared `<Header>` component** (Components #1) — directly contradicts design rule #1, and is the most visible thing a user moving between the marketing site, the in-app dashboard, and a shared calculator link would notice.
2. **`privacy.html` renders its body copy in Arial instead of DM Sans** (Typography #1) — an entire page silently off-brand, most likely a copy-paste leftover rather than intent.
3. **Mobile modules list shows one status through four simultaneous indicators** (Components #3) — directly contradicts design rule #4 and is visible on the app's most-trafficked screen.
4. **Raw `✓` glyphs vs. Lucide `<Check>` inside the same file** (Icons #1, checkmark bullet) — small individually, but happening in the exact same component for the exact same purpose makes it look like an oversight rather than a choice.
5. **Three unreconciled "muted grey" values** (Colour #1) — subtle but affects secondary text across most mobile screens; likely to visually read as slightly-off/inconsistent text weight even to users who can't name why.

---

**File:** `visual-consistency-audit.md` (repo root)
**Total inconsistencies found:** 15
