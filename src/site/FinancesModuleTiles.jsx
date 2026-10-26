import { motion, useReducedMotion } from "framer-motion";
import { GEORGIA, MONO, SITE_BG, SITE_INK, SITE_MUTED, SITE_RULE } from "../design-tokens.js";
import { riseIn } from "./motion.js";

// The Problem's "one whole picture" section: the areas Candid covers as one
// joined strip of cells (a 1px grid gap over a rule-coloured background
// draws the hairlines between them), so they read as parts of one thing
// rather than separate products. Not cards: none of them is a link. On a
// phone the strip becomes a ruled list.
const AREAS = ["Pension", "ISA", "Savings", "Student loan", "Tax", "Mortgage", "Family"];

const CSS = `
  .fm-strip { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(${AREAS.length}, minmax(0, 1fr)); gap: 1px;
    background: ${SITE_RULE}; border-top: 1px solid ${SITE_INK}; border-bottom: 1px solid ${SITE_RULE}; }
  .fm-strip li { background: ${SITE_BG}; padding: 18px 14px 26px; font: 400 clamp(16px, 1.7vw, 20px)/1.25 ${GEORGIA}; }
  .fm-strip li span { display: block; font: 500 11px/1 ${MONO}; color: ${SITE_MUTED}; margin-bottom: 14px; }
  .fm-copy { font-size: clamp(16px, 1.7vw, 18px); line-height: 1.7; color: ${SITE_MUTED}; margin: 20px 0 0; }

  @media (max-width: 760px) {
    .fm-strip { grid-template-columns: minmax(0, 1fr); }
    .fm-strip li { display: flex; justify-content: space-between; align-items: baseline; padding: 16px 0; }
    .fm-strip li span { order: 2; margin: 0; }
  }
`;

export default function FinancesModuleTiles() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="st-section">
      <style>{CSS}</style>
      <motion.div {...riseIn(reduceMotion)} className="st-intro">
        <div className="st-label">The real issue</div>
        <h2 className="st-h2">Your finances are one whole picture, not a set of separate accounts.</h2>
        <p className="fm-copy">
          Good decisions require seeing all the moving parts at once. Savings apps hunt for a slightly better interest rate, but won't notice that you're missing your full employer pension match or wasting your ISA allowance.
        </p>
      </motion.div>
      <motion.ul {...riseIn(reduceMotion, { delay: 0.1 })} className="fm-strip">
        {AREAS.map((area, i) => (
          <li key={area}><span>{String(i + 1).padStart(2, "0")}</span>{area}</li>
        ))}
      </motion.ul>
    </section>
  );
}
