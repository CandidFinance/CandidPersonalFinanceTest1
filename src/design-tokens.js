// Candid design tokens — single source of truth for colour, type, and the
// handful of spacing/radius values that are genuinely consistent app-wide.
// Values were extracted as-is from CandidApp.jsx's inline styles (Sept 2026
// design-tokens audit). Every file imports its tokens from here directly.

// ── Palette ──────────────────────────────────────────────────────────────
// Brand
export const G     = "#162f24"; // primary brand dark green — text, buttons, headlines
export const GOLD  = "#c4963a"; // brand gold accent
export const CREAM = "#faf7f0"; // page background
export const CDARK = "#ede7db"; // secondary/darker cream surface
export const TEXT  = "#1a1a1a"; // body text
export const MUT   = "#6b6b6b"; // muted/secondary text
export const WHITE = "#ffffff";
// Readable versions of the above where the plain token fails WCAG AA (4.5:1
// for text, 3:1 for a field's edge). GOLD itself is 2.53:1 on CREAM, so gold
// text, gold links and white-on-gold badges use GOLD_TEXT (4.71:1 on CREAM,
// 5.04:1 white on it). MUT is 4.33:1 on CDARK, so muted text on a CDARK
// surface (pill captions, unpicked PillSlider options) uses MUT_ON_CDARK
// (5.27:1). FIELD_BORDER: a typed field's outline, 3.11:1 on CREAM (the
// site's SITE_EDGE).
export const GOLD_TEXT    = "#8a6a24";
export const MUT_ON_CDARK = "#5e5e5e";
export const FIELD_BORDER = "#8f8d84";
// Apple's own button blue: the one accent that departs from Candid's usual
// green and gold, reserved for the main call to action (the site's start
// button, the paywall's subscribe button).
export const CTA_BLUE = "#0071E3";
// Deliberately darker than G — every form <input>/<select> that sits on a G
// (or near-G) dark surface uses this as a "recessed" background so the
// field reads as tappable/editable rather than blending into the panel
// around it. Consistent across DevTools.jsx and the 3 standalone calculator
// pages (which can't import this file — see the Header section below for
// the same caveat, and check those pages by hand if this value changes).
export const INPUT_BG_DARK = "#0f2018";

// Semantic status colours. SUCCESS also absorbs the old "#1e4030" — a
// near-identical third green used in only 2 places that read as an
// unintentional one-off rather than a deliberate distinct colour.
export const SUCCESS  = "#2d6b4a"; // "on track" / positive state
export const PROGRESS_GREEN = "#2f9461"; // the progress line's fill: a mid green, lighter than G
export const GAIN_ON_DARK = "#4fd18b"; // a gain (saved £) on the dark band: bar fill and "+£x" (Harvey, 8 Nov 2026)
// The track still to fill under a saved bar on the dark band: diagonal stripes.
export const STRIPE_ON_DARK = "repeating-linear-gradient(135deg, rgba(246,234,208,0.28) 0 4px, rgba(246,234,208,0.1) 4px 8px)";
export const ON_TRACK_FILL = "#edf6f1"; // a very pale PROGRESS_GREEN: the fill of an on-track module tile
export const REVIEWED_FILL = "#f4f2ec"; // muted: a reviewed module tile with something still to act on
export const WARNING  = "#d9822b"; // scoreBand's 4th tier only — sits between GOLD and CRITICAL
// WARNING as text or a meaningful icon: WARNING is 2.93:1 on white, this is
// 4.22:1 on white, 3.94:1 on CREAM (large figures and icons need 3:1).
export const WARNING_TEXT = "#b9661a";
export const CRITICAL = "#c0392b"; // "action needed" / error state
export const ERROR_TEXT = "#b3261e"; // error messages under forms and buttons
export const NOTIFY_RED = "#FF3B30"; // the "something new" badge only (NewBadge.jsx), bright like a phone's

// Forecast-chart-only accents. Named (rather than left inline) because the
// Surplus chart and the Net Worth breakdown both need to use the same hex
// per category for the two Forecast tabs to read as one colour language.
export const CASH_BLUE      = "#1a6fa3"; // "Cash savings"
export const STUDENT_PURPLE = "#8a4fae"; // "Student loan overpayment"
export const PENSION_RAS    = "#1e7a5a"; // "Pension (relief at source)"

// ── Chart colours: one per module, the same in every chart (Home's pot,
// both Forecast tabs), so Pension is always the same green. Red is also
// the "action needed" colour elsewhere; in a chart it only means Mortgage.
// The green is a step brighter than SUCCESS so it doesn't read as grey
// beside the others. Checked with the dataviz validator on #F7F9F5: every
// pair clears normal-vision separation, but purple and blue are close for
// red-green colour blindness, so every chart using these also names its
// modules (a legend, a table or a tooltip). (A softer earth-tone palette,
// 1b71db2, is in git history; its pale colours needed outlined lines.)
export const MODULE_CHART_COLOR = {
  cash:         CASH_BLUE,
  investments:  GOLD,
  pension:      "#1f8a4c",
  studentLoan:  STUDENT_PURPLE,
  kids:         "#d27a5b",
  taxTrap:      "#b9661a",
  mortgage:     CRITICAL,    // and property equity
  personalLoan: "#e87ba4",   // and Forecast's "Debts"
};

// The Progress tab's custom goals (goal pots): a deep ultramarine no module
// uses. Checked with the dataviz validator against every colour above and
// SUCCESS: at least ΔE 18.9 for normal vision and 10.9 for red-green colour
// blindness, and 11:1 on white. Darker than the module colours' band on
// purpose, as it stands on its own rather than in a set.
export const CUSTOM_GOAL_COLOR = "#381ea7";

// edge / watch: the £100k tax trap under £100k, amber within £5,000 of it.
export const SC = { ok: SUCCESS, attention: GOLD, critical: CRITICAL, na: MUT, unknown: MUT, edge: WARNING, watch: MUT };

// Candid score → colour + label. Five discrete bands, not a continuous
// gradient — deliberately: a flat colour per band reads as "which zone am I
// in" at a glance, which a smoothly-interpolated fill doesn't. Single source
// of truth for the score ring, the mobile score bar, the tap-through detail
// sheet, and the PDF report — none of them should ever disagree on where
// the bands sit or what colour a given score reads as (they used to: the
// PDF had its own separate 4-band version with different thresholds).
export function scoreBand(score) {
  if (score >= 80) return { color: G, label: "Optimised" };
  if (score >= 65) return { color: SUCCESS, label: "On track" };
  if (score >= 50) return { color: GOLD, label: "Room to improve" };
  if (score >= 35) return { color: WARNING, label: "Needs work" };
  return { color: CRITICAL, label: "Needs attention" };
}

// Per-option line colours (chart + legend + table dots) shared by both
// Forecast tabs.
// Forecast tabs. Each option takes its module's chart colour; the two
// pension options never show together, so both are Pension's.
export const FORECAST_COLORS = {
  "Mortgage overpayment": MODULE_CHART_COLOR.mortgage,
  "Student loan overpayment": MODULE_CHART_COLOR.studentLoan,
  "Stocks & Shares ISA": MODULE_CHART_COLOR.investments,
  "Cash savings": MODULE_CHART_COLOR.cash,
  "Pension (salary sacrifice)": MODULE_CHART_COLOR.pension,
  "Pension (relief at source)": MODULE_CHART_COLOR.pension,
};

// Shorter display names for the same options — mobile legend/table space is
// tight, so this only affects what's rendered.
export const FORECAST_SHORT_LABEL = {
  "Mortgage overpayment": "Mortgage",
  "Student loan overpayment": "Student Loan",
  "Stocks & Shares ISA": "S&S ISA",
  "Cash savings": "Cash",
  "Pension (salary sacrifice)": "Pension (sal. sac.)",
  "Pension (relief at source)": "Pension (RAS)",
};

// ── Typography ───────────────────────────────────────────────────────────
export const SERIF = "'Playfair Display',serif"; // headline £ figures only (Harvey, 8 Nov 2026)
export const SANS  = "'DM Sans',sans-serif";      // body copy, UI chrome

// ── Marketing site (Statement design, Oct 2026) ─────────────────────────
// The rebuilt site's own palette and type, from design/landing/BRIEF.md
// (Highlighter version). Site pages only; the app keeps SERIF and CREAM.
export const GEORGIA    = "Georgia,'Times New Roman',serif"; // site wordmark, headlines, £ totals
export const MONO       = "'IBM Plex Mono',monospace";       // document tiles, receipt figures, labels
export const HIGHLIGHT  = "#51f5d4"; // cyan highlighter behind key words and landed receipt lines
export const SITE_BG    = "#fbfaf5"; // page background
export const SITE_INK   = "#1a1a17"; // text
export const SITE_MUTED = "#66665e"; // quiet text, 5.7:1 on SITE_BG
export const SITE_RULE  = "#e2e0d6"; // hairline rules and tile borders
export const SITE_EDGE  = "#8f8d84"; // form field borders, 3.3:1 on white (inputs need 3:1)

// Named sizes for the 5 clearest, heaviest-used size clusters only. Font
// sizes across the app are NOT a clean scale — 29 distinct values from 8px
// to 42px were found in the Sept 2026 audit. These 5 are just the
// unambiguous, high-frequency roles the audit confirmed; every other size
// (11px, 14px, 15px, 17px, 20px, etc.) is left as a plain inline literal
// rather than forced into a token or merged with a neighbour — that would
// be a visual change, not a refactor.
export const FONT_SIZE = {
  CAPTION:  "10px", // uppercase micro-labels/captions
  LABEL:    "12px", // standard UI label text
  BODY:     "13px", // body copy
  HEADLINE: "22px", // section headlines
  HERO:     "28px", // hero £ figures
};

// The small uppercase label over a section or field ("CANDID SCORE",
// "EMPLOYMENT STATUS"). Spread it, then override colour or margin if needed.
// (Not the caption inside a money pill, which is smaller to fit.)
export const LABEL_CAPS = { fontSize: "11px", fontWeight: 600, color: MUT, letterSpacing: "0.08em", textTransform: "uppercase" };

// ── Header / nav wordmark ────────────────────────────────────────────────
// The "Candid." wordmark's font/weight/colour-per-background, shared by
// every header in the app — CandidApp.jsx's in-app `NavBar` and the
// marketing site's `SiteHeader` both build their wordmark style off
// these rather than re-declaring it, so a change here (or a GOLD/SERIF
// change) can't quietly stop reaching one of them. Each context still
// picks its own font-size (they're different-height bars), so only
// font-family/weight/colour are centralised here.
//
// The standalone HTML pages (privacy.html, terms.html, and the three
// calculator pages) can't import this file — they're plain HTML, not
// bundled. Their inline `<nav>` markup hand-matches HEADER_BG_DARK +
// HEADER_WORDMARK_DARK's values; if either changes here, check those 5
// files too.
export const HEADER_BG_DARK = G;
export const HEADER_BG_LIGHT = CREAM;
export const HEADER_WORDMARK_DARK  = { fontFamily: SERIF, fontWeight: 700, color: GOLD };
export const HEADER_WORDMARK_LIGHT = { fontFamily: SERIF, fontWeight: 700, color: G };

// ── Spacing / radius ─────────────────────────────────────────────────────
// Border-radius is otherwise inconsistent (11+ distinct values found in the
// audit). These three are the ones with a genuine dominant pattern behind
// them — pills/buttons, mobile card containers, and desktop/mockup modal
// shells — each already used consistently everywhere that role appears. All
// other radii are left untokenized rather than inventing a false
// consistency.
export const RADIUS_PILL  = "100px";
// Every mobile input pill (PillMoneyInput, PillSelect, PillSlider) is this
// tall, so a toggle, a dropdown and a £/% field sit level when they share a
// row or stack. Your finances sets --pill-height to 37px for its shorter pills.
export const PILL_HEIGHT = "var(--pill-height, 44px)";
// Visually hidden, still read by screen readers (Home's and Modules' h1).
export const SR_ONLY = { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };
export const RADIUS_CARD  = "14px"; // mobile card containers (WinTile, ProviderTile, ProductListTile, HomeScreen/ForecastScreen cards)
export const RADIUS_MODAL = "18px"; // desktop modal shells + marketing/mockup cards
// A rule between rows in a list (modules to start, a card's figures).
export const HAIRLINE = "1px solid rgba(22,47,36,0.1)";
// A white card, for a discrete block you act on (a form, a notice with a
// close button). What's listed inside one is hairline rows, never more cards.
export const CARD = { background: WHITE, border: "1px solid rgba(22,47,36,0.08)", borderRadius: RADIUS_CARD };
// A list of rows on its tile (modules to start, Coming soon): the heading
// inside at the top, a hairline above each row, the tile's edge below the
// last. Harvey, 31 Oct 2026: rows need a tile under them in the app.
export const ROW_TILE = { ...CARD, padding: "16px 18px 4px" };
// A section's heading on an app screen: DM Sans, sentence case, no caps
// label above it.
// The small line above a notice's title (what it is, when): sentence case,
// 12.5px, MUT (5.3:1 on WHITE).
export const NOTICE_LABEL = { fontSize: "12px", fontWeight: 600, color: MUT, lineHeight: 1.4, margin: 0 };
// A tile's title on Home and Progress ("Your years with Candid", "Coming up"):
// small tracked caps in MUT.
export const TILE_KICKER = { fontSize: "11px", fontWeight: 600, color: MUT, letterSpacing: "0.09em", textTransform: "uppercase", margin: 0 };
// The rest of a tile's text, matching "Your years with Candid". A figure is
// 13px bold on its row; only a screen's headline £ is larger (Harvey, 9 Nov
// 2026: Opportunity tiles at 44px, Home's hero, the £100k figures, Your years).
export const TILE_FIGURE = { fontFamily: SANS, fontSize: "13px", fontWeight: 700 };
export const TILE_LABEL_SIZE = "12px";
export const TILE_NOTE = { fontSize: "12px", color: MUT, lineHeight: 1.5 };
export const SECTION_TITLE = { fontFamily: SANS, fontSize: "18px", fontWeight: 700, color: G, lineHeight: 1.25, margin: 0 };

// "Where to open an account" provider tiles (Cash/Investments/Pension) —
// white fading to a light grey, top to bottom, for a raised/glossy feel, so
// these link-out tiles read apart from the plain-white numbered action tiles
// and from each module's green-and-gold Opportunity tile above them. (Pale
// green until 6 Oct 2026, too close to that tile.) PROVIDER_TILE_BG_END is
// the gradient's own bottom-stop colour, reused by scrollable provider lists'
// fade-to-solid overlay (from PROVIDER_TILE_FADE_CLEAR, the same colour
// transparent) so the fade blends into the tile rather than revealing a
// mismatched seam.
export const PROVIDER_TILE_BG = "linear-gradient(180deg, #ffffff 0%, #f0f1ef 100%)";
export const PROVIDER_TILE_BG_END = "#f0f1ef";
export const PROVIDER_TILE_FADE_CLEAR = "rgba(240,241,239,0)";
export const PROVIDER_TILE_BORDER = "1.5px solid rgba(22,47,36,0.10)";
export const PROVIDER_TILE_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 10px rgba(22,47,36,0.06)";

// Home's hero tile (the Candid score): a soft wash in Candid's own colours,
// pale tints of the brand greens (SUCCESS from the top left, PENSION_RAS's
// teal-green from the top right) and a warm hint of GOLD from the bottom
// right, over a near-white green. Worn only by Home's headline tiles (the
// score, and Gains), light enough for dark text and the
// score's band colours. (A cooler
// version with lilac and pink, b7a6e7e, is in git history for a future white
// background.)
export const HERO_TILE_BG = [
  "radial-gradient(120% 95% at 0% 0%, #E6F0EA 0%, rgba(230,240,234,0) 62%)",
  "radial-gradient(90% 80% at 100% 0%, #E8F3EF 0%, rgba(232,243,239,0) 60%)",
  "radial-gradient(100% 90% at 100% 100%, #F7F0E2 0%, rgba(247,240,226,0) 62%)",
  "#F7F9F5",
].join(", ");
// The same wash in red and amber, for a card in a wallet stack (CardStack)
// that warns while it's behind: Progress's Tax shield over £100,000 (red)
// or within £5,000 of it (amber).
export const HERO_TILE_BG_RED = [
  "radial-gradient(120% 95% at 0% 0%, #F7E1DD 0%, rgba(247,225,221,0) 62%)",
  "radial-gradient(90% 80% at 100% 0%, #FAE8E0 0%, rgba(250,232,224,0) 60%)",
  "radial-gradient(100% 90% at 100% 100%, #F8EEE2 0%, rgba(248,238,226,0) 62%)",
  "#FBF5F3",
].join(", ");
export const HERO_TILE_BG_AMBER = [
  "radial-gradient(120% 95% at 0% 0%, #FBEAD6 0%, rgba(251,234,214,0) 62%)",
  "radial-gradient(90% 80% at 100% 0%, #FCEFDF 0%, rgba(252,239,223,0) 60%)",
  "radial-gradient(100% 90% at 100% 100%, #F8EEE2 0%, rgba(248,238,226,0) 62%)",
  "#FCF7F1",
].join(", ");
// And in green, for a card in a wallet stack that's on track (Modules).
export const HERO_TILE_BG_GREEN = [
  "radial-gradient(120% 95% at 0% 0%, #D6ECDF 0%, rgba(214,236,223,0) 62%)",
  "radial-gradient(100% 90% at 100% 100%, #E6F2EA 0%, rgba(230,242,234,0) 62%)",
  "#EDF6F1",
].join(", ");

// Modules' tiles: each module's icon on a rounded square of its own colour,
// so the tiles tell apart at a glance. `bg` the square, `fg` the icon (each
// at least 3:1 on its square). A module not started yet goes grey instead.
export const MODULE_ACCENTS = {
  cash:         { bg: "#DDF1E4", fg: "#23784C" },
  investments:  { bg: "#E9E4FA", fg: "#5B3FC4" },
  pension:      { bg: "#DFEAFA", fg: "#2860B8" },
  studentLoan:  { bg: "#FAEBD2", fg: "#9A6209" },
  kids:         { bg: "#FBE3DD", fg: "#B8472E" },
  taxTrap:      { bg: "#D9F0EE", fg: "#17746F" },
  property:     { bg: "#F5E2EE", fg: "#9C3A6F" },
  mortgage:     { bg: "#E4E9EF", fg: "#3F5266" },
  personalLoan: { bg: "#E2E6F8", fg: "#3E4FA8" },
};
export const MODULE_ACCENT_MUTED = { bg: "rgba(22,47,36,0.06)", fg: "#8a8a8a" };
// A module not built yet: a flat grey tile with its icon on white, so it
// reads apart from one not started (a pale white tile, its icon on grey).
export const MODULE_SOON_TILE = { bg: "#ECEAE3", chip: "#FFFFFF", fg: "#9B9B9B" };
// A module not live yet (not started, not open, not applicable): white at
// 60% over CREAM, and its art's panel rgba(22,47,36,0.06) over that, both
// made opaque so the layers of a Modules tile don't stack darker.
export const MODULE_QUIET_TILE = { bg: "#FBF9F5", panel: "#EEEDE9" };
// Modules' top band, behind the title and the hero card: brand green
// washing into gold, pale enough for dark text.
// The same band warning, red or amber: Progress's while income is over
// £100,000 (red) or within £5,000 of it (amber), as the Tax shield card's
// wash was in the wallet stack. Each a 160deg gradient through these three
// colours (ScreenBand.jsx fades between them).
export const BAND_STOPS = {
  light: ["#D9EADF", "#E9EEDB", "#F5E6C8"],
  red:   ["#F4D3CC", "#F7DED6", "#F8E6DC"],
  amber: ["#FBE2C6", "#FAE8D3", "#F8EBDA"],
  // Progress's net worth and its row pages: the brand's dark green, flat.
  green: [G, G, G],
};

// The same tile treatment in red, amber and green, for a card whose whole
// surface is its status (the Property mortgage card: whether the repayments
// are affordable). White for the top 30%, then fading to the status colour
// over white at about 8% at the bottom, with a border in the same colour. Use PROVIDER_TILE_SHADOW.
// `figure` is the full-strength colour, for the figure that sets the
// status; amber is a shade darker than WARNING so it stays readable on white.
const STATUS_FADE_FROM = "30%";
const statusFill = end => `linear-gradient(180deg, #ffffff 0%, #ffffff ${STATUS_FADE_FROM}, ${end} 100%)`;
export const STATUS_TILE = {
  ok:    { background: statusFill("#eef4ef"), border: "1.5px solid rgba(45,107,74,0.18)", figure: SUCCESS },
  tight: { background: statusFill("#fcf5ee"), border: "1.5px solid rgba(217,130,43,0.35)", figure: "#b9661a" },
  short: { background: statusFill("#faefee"), border: "1.5px solid rgba(192,57,43,0.32)", figure: CRITICAL },
};

// The slick: teal, violet and gold tints over a near-black green, at about
// 40% of the first version, so small text on it stays over 4.5:1 in every
// corner (5.1:1 at the teal's peak; the full slick took it to 2.1:1), with a
// faint sheen that runs once. The card stack's front card (Home, Progress,
// Modules) from 31 Oct 2026, the module pages' tiles from 1 Nov. Harvey.
// `slickBg(h)`: the slick drawn for a box `h` tall (a CSS length) at the top
// of a taller one, carrying on smoothly below it (ScreenBand's dark band,
// which runs on under its sheet).
// Each tint sized as a layer of its own (a gradient's radius won't take a
// calc of % and px): the teal and violet fade out inside the top box; the
// gold, centred below it, on a layer twice as tall.
export const slickBg = h => `radial-gradient(80% 120% at 0% 0%, rgba(42,138,108,0.38) 0%, rgba(42,138,108,0) 60%) 0 0 / 100% ${h} no-repeat, radial-gradient(70% 100% at 100% 0%, rgba(107,90,166,0.35) 0%, rgba(107,90,166,0) 62%) 0 0 / 100% ${h} no-repeat, radial-gradient(90% 55% at 85% 57.5%, rgba(196,150,58,0.3) 0%, rgba(196,150,58,0) 60%) 0 0 / 100% calc(${h} * 2) no-repeat, #0e2219`;
export const STACK_SLICK_BG    = "radial-gradient(80% 120% at 0% 0%, rgba(42,138,108,0.38) 0%, rgba(42,138,108,0) 60%), radial-gradient(70% 100% at 100% 0%, rgba(107,90,166,0.35) 0%, rgba(107,90,166,0) 62%), radial-gradient(90% 110% at 85% 115%, rgba(196,150,58,0.3) 0%, rgba(196,150,58,0) 60%), #0e2219";
export const STACK_SLICK_SHEEN = 0.05;

// "Opportunity" tile (each module deep dive, drawn by OpportunityTile.jsx) —
// each page's key message, and the one dark surface on a module page: the
// slick above, cream serif figures and short chips. Before 1 Nov 2026 the
// slick at full strength with a sheen every 7s; before 27 Oct, Home's light
// wash (HERO_TILE_BG), which blended into the page; before 6 Oct, solid brand
// green with gold labels; before that, white to light gold.
export const OPPORTUNITY_TILE_BG     = STACK_SLICK_BG;
export const OPPORTUNITY_TILE_BORDER = "1px solid rgba(255,255,255,0.122)";
export const OPPORTUNITY_TILE_SHADOW = "0 10px 28px rgba(22,47,36,0.16)";
export const OPPORTUNITY_TILE_LABEL  = "#d8d0bb"; // "OPPORTUNITY" overline, sub-labels
export const OPPORTUNITY_TILE_FIGURE = "#f6ead0"; // £ figures (serif when a £)
export const OPPORTUNITY_TILE_BODY   = "#b4bdb2"; // chips and supporting sentences
export const OPPORTUNITY_TILE_RADIUS = "18px";
export const OPPORTUNITY_TILE_SHEEN  = STACK_SLICK_SHEEN; // white at the sheen's peak

// ── One-off colours — reference only, NOT for reuse ───────────────────────
// Each of these appears in exactly one place (a specific SVG chart
// gradient/line, or a single badge) and isn't part of the shared palette
// above. Listed here so they're discoverable/auditable; new code should
// reach for a palette token above rather than adding to this list.
export const CHART_ONE_OFFS = {
  netWorthChartGradientStart: "#153524",
  netWorthChartLine:          "#c79a3d",
  netWorthChartPotentialLine: "#e8d5a3",
  pensionReturnLine:          "#d4b97a",
  affordabilitySliderMax:     "#1e4d35",
  forecastTableZebra:         "#f8f7f4",
  assumptionsBoxBackground:   "#f4eee2",
  paymentErrorText:           "#b3261e",
  investmentGainNote:         "#a67c2e",
  aiSummaryBadgeText:         "#8a6a24",
};

// ── Iconography ──────────────────────────────────────────────────────────
// lucide-react is the single icon library used app-wide (desktop + mobile),
// post-emoji-removal. No other icon set or raw emoji should be introduced.
