import { motion, useReducedMotion } from "framer-motion";
import { G, GOLD, MUT, SERIF, PROVIDER_TILE_BG, PROVIDER_TILE_BORDER } from "../CandidApp.jsx";
import { riseIn, pullTogether } from "./motion.js";

// Replaces an earlier heptagon-of-tiles-with-connecting-lines diagram —
// dropped in favour of something plainer: a simple wrapping row of module
// tiles at the page's normal content width, no geometry, no icons, no
// lines. The gradient/border match PROVIDER_TILE_BG / PROVIDER_TILE_BORDER
// (design-tokens.js), the same pale white-to-light-green fill used on the
// Modules page's "where to open an account" tiles, rather than a one-off.
// Two explicit rows rather than one flex-wrap list left to wrap wherever it
// naturally falls — that had "Mortgage" and "Family" landing on separate
// lines depending on viewport width; this guarantees they sit together.
const ROWS = [
  [
    { key: "pension", label: "Pension" },
    { key: "isa", label: "ISA" },
    { key: "savings", label: "Savings" },
    { key: "studentLoan", label: "Student loan" },
    { key: "tax", label: "Tax" },
  ],
  [
    { key: "mortgage", label: "Mortgage" },
    { key: "children", label: "Family" },
  ],
];

export default function FinancesModuleTiles() {
  const reduceMotion = useReducedMotion();

  return (
    <div style={{ padding: "0 24px 88px" }}>
      <motion.div {...riseIn(reduceMotion)} style={{ maxWidth: "680px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: GOLD, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "14px" }}>
          The real issue
        </div>
        <h2 style={{ fontFamily: SERIF, fontSize: "clamp(24px,3.5vw,32px)", color: G, fontWeight: 700, lineHeight: 1.3, marginBottom: "16px" }}>
          Your finances are one whole picture, not a set of separate accounts.
        </h2>
        <p style={{ fontSize: "15px", color: MUT, lineHeight: 1.7, marginBottom: "8px" }}>
          Good decisions require seeing all the moving parts at once. Savings apps hunt for a slightly better interest rate, but won't notice that you're missing your full employer pension match or wasting your ISA allowance.
        </p>
      </motion.div>

      {/* Bigger tiles + more breathing room above them than before — this
          section was reading noticeably shallower than "The problem" and
          "And it never stands still" either side of it once the diagram
          was simplified down to plain tiles. Each row's tiles pull together
          and rise in as it scrolls into view, matching the same entrance
          used for the Root Causes tiles and the life-events timeline. */}
      <div style={{ maxWidth: "960px", margin: "56px auto 0", display: "flex", flexDirection: "column", gap: "18px" }}>
        {ROWS.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "18px" }}>
            {row.map((area, i) => (
              <motion.div key={area.key} {...pullTogether(i, row.length, reduceMotion)} style={{
                background: PROVIDER_TILE_BG, border: PROVIDER_TILE_BORDER, borderRadius: "14px",
                padding: "22px 34px", fontSize: "15px", fontWeight: 600, color: G,
              }}>
                {area.label}
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
