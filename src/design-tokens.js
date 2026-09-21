// Candid design tokens — single source of truth for colour, type, and the
// handful of spacing/radius values that are genuinely consistent app-wide.
// Values were extracted as-is from CandidApp.jsx's inline styles (Sept 2026
// design-tokens audit) — this is a refactor, not a redesign: every value
// here is unchanged, only its source moved. CandidApp.jsx imports and
// re-exports the palette/type/SC/forecast tokens, so every existing
// `import { G, GOLD, ... } from "../../CandidApp.jsx"` (mobile screens,
// desktop components, etc.) keeps working unchanged.

// ── Palette ──────────────────────────────────────────────────────────────
// Brand
export const G     = "#162f24"; // primary brand dark green — text, buttons, headlines
export const GOLD  = "#c4963a"; // brand gold accent
export const CREAM = "#f6f0e6"; // page background
export const CDARK = "#ede7db"; // secondary/darker cream surface
export const TEXT  = "#1a1a1a"; // body text
export const MUT   = "#6b6b6b"; // muted/secondary text
export const WHITE = "#ffffff";

// Semantic status colours. SUCCESS also absorbs the old "#1e4030" — a
// near-identical third green used in only 2 places that read as an
// unintentional one-off rather than a deliberate distinct colour.
export const SUCCESS  = "#2d6b4a"; // "on track" / positive state
export const CRITICAL = "#c0392b"; // "action needed" / error state

// Forecast-chart-only accents. Named (rather than left inline) because the
// Surplus chart and the Net Worth breakdown both need to use the same hex
// per category for the two Forecast tabs to read as one colour language.
export const CASH_BLUE      = "#1a6fa3"; // "Cash savings"
export const STUDENT_PURPLE = "#8a4fae"; // "Student loan overpayment"
export const PENSION_RAS    = "#1e7a5a"; // "Pension (relief at source)"

export const SC = { ok: SUCCESS, attention: GOLD, critical: CRITICAL, na: MUT, unknown: MUT };

// Per-option line colours (chart + legend + table dots) shared by both
// Forecast tabs.
export const FORECAST_COLORS = {
  "Mortgage overpayment": CRITICAL,
  "Student loan overpayment": STUDENT_PURPLE,
  "Stocks & Shares ISA": GOLD,
  "Cash savings": CASH_BLUE,
  "Pension (salary sacrifice)": SUCCESS,
  "Pension (relief at source)": PENSION_RAS,
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

// ── Spacing / radius ─────────────────────────────────────────────────────
// Border-radius is otherwise inconsistent (11 distinct values found in the
// audit, no dominant "card" radius). This is the one value used
// consistently everywhere it appears (pills, buttons) — the rest is left
// untokenized rather than inventing a false consistency.
export const RADIUS_PILL = "100px";

// "Where to open an account" provider tiles (Cash/Investments/Pension) — a
// pale green, close to white, with a subtle top-to-bottom gradient for a
// raised/glossy feel, so these link-out tiles read as visually distinct from
// the app's plain-white numbered action tiles at a glance. PROVIDER_TILE_BG_END
// is the gradient's own bottom-stop colour, reused by scrollable provider
// lists' fade-to-solid overlay so the fade blends into the tile rather than
// revealing a mismatched white seam.
export const PROVIDER_TILE_BG = "linear-gradient(180deg, #f8faf8 0%, #eef4ef 100%)";
export const PROVIDER_TILE_BG_END = "#eef4ef";
export const PROVIDER_TILE_BORDER = "1.5px solid rgba(45,107,74,0.18)";
export const PROVIDER_TILE_SHADOW = "inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 10px rgba(22,47,36,0.06)";

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
