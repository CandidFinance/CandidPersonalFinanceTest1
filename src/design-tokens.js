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
export const ON_TRACK_FILL = "#edf6f1"; // a very pale PROGRESS_GREEN: the fill of an on-track module tile
export const REVIEWED_FILL = "#f4f2ec"; // muted: a reviewed module tile with something still to act on
export const WARNING  = "#d9822b"; // scoreBand's 4th tier only — sits between GOLD and CRITICAL
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

export const SC = { ok: SUCCESS, attention: GOLD, critical: CRITICAL, na: MUT, unknown: MUT };

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
export const SERIF = "'Playfair Display',serif"; // headlines, hero £ figures
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
// row or stack.
export const PILL_HEIGHT = "44px";
export const RADIUS_CARD  = "14px"; // mobile card containers (WinTile, ProviderTile, ProductListTile, HomeScreen/ForecastScreen cards)
export const RADIUS_MODAL = "18px"; // desktop modal shells + marketing/mockup cards

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

// "Opportunity" tile (each module deep dive) — each page's key message, in
// the same treatment as Home's score tile (HERO_TILE_BG), so the headline of
// every screen looks alike: the green-and-gold wash, a thin border and a soft
// shadow, dark serif figures and muted labels. Previously the one solid
// brand-green surface, with gold labels and cream figures (before 6 Oct
// 2026), and before that a white-to-light-gold gradient.
export const OPPORTUNITY_TILE_BG     = HERO_TILE_BG;
export const OPPORTUNITY_TILE_BORDER = "1px solid rgba(22,47,36,0.08)";
export const OPPORTUNITY_TILE_SHADOW = "0 4px 18px rgba(22,47,36,0.07)";
export const OPPORTUNITY_TILE_LABEL  = MUT;   // "OPPORTUNITY" overline, sub-labels
export const OPPORTUNITY_TILE_FIGURE = TEXT;  // serif £ figures, "Explain this"
export const OPPORTUNITY_TILE_BODY   = MUT;   // supporting sentences

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
