import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import { GEORGIA, MONO, SITE_INK, SITE_MUTED, SITE_RULE } from "../design-tokens.js";
import SiteLayout from "./SiteLayout.jsx";
import StartCheckButton from "./StartCheckButton.jsx";
import FinancesModuleTiles from "./FinancesModuleTiles.jsx";
import { riseIn } from "./motion.js";

// The Problem tab, in the Statement design (shared classes in SiteLayout.jsx):
// why people leave money on the table, why it's one picture, why it keeps
// changing, then what Candid is for.

const CAUSES = [
  { title: "Complexity", body: "Pensions, ISAs, tax bands, allowances and mortgages all interact. Get one decision wrong and it can undo the benefit of another." },
  { title: "Lack of time", body: "Between demanding careers and life outside work, few have the bandwidth to model each financial decision against every tax threshold, account rule and investment option across their wider setup." },
  { title: "Lack of access", body: "Traditional financial advisers charge thousands in fees or demand six-figure minimum portfolios – leaving millions to work it out alone." },
];

const LIFE_EVENTS = ["Salary & tax band change", "House purchase", "Family planning", "Student loan payoff"];

// The life events sit on one ink line, a dot each, like points on a timeline.
const CSS = `
  .tp-events { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; border-top: 1px solid ${SITE_INK}; }
  .tp-events li { position: relative; padding-top: 26px; font: 400 clamp(18px, 2vw, 22px)/1.3 ${GEORGIA}; }
  .tp-events li::before { content: ""; position: absolute; top: -5px; left: 0; width: 9px; height: 9px; border-radius: 50%; background: ${SITE_INK}; }
  .tp-events li span { display: block; font: 500 12px/1 ${MONO}; color: ${SITE_MUTED}; margin-bottom: 10px; }
  .tp-aim { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 56px; align-items: start; padding-top: 36px; border-top: 1px solid ${SITE_RULE}; }
  .tp-aim p { font-size: clamp(17px, 1.8vw, 20px); line-height: 1.65; color: ${SITE_MUTED}; margin: 0; }

  @media (max-width: 760px) {
    .tp-events { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 0; border-top: none; }
    .tp-events li { border-top: 1px solid ${SITE_INK}; padding-bottom: 28px; }
    .tp-aim { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  }
`;

export default function TheProblemPage() {
  const reduceMotion = useReducedMotion();

  useEffect(() => { posthog.capture("the_problem_viewed"); }, []);

  return (
    <SiteLayout>
      <style>{CSS}</style>

      {/* ── HERO ── */}
      <motion.section {...riseIn(reduceMotion)} className="st-section st-hero">
        <div className="st-label">The problem</div>
        <h1 className="st-h1">Millions of higher and additional rate taxpayers are uniquely exposed to a financial <mark>minefield</mark>.</h1>
        <p className="st-lede">
          Not because they've made mistakes – because personal finance has become overly complex, time-consuming, and frustratingly opaque. The result? Thousands of pounds left on the table every year.
        </p>
      </motion.section>

      {/* ── ROOT CAUSES ── */}
      <section className="st-section">
        <motion.div {...riseIn(reduceMotion)} className="st-intro">
          <div className="st-label">Why it happens</div>
          <h2 className="st-h2">Three reasons, none of them your fault.</h2>
        </motion.div>
        <ol className="st-rows">
          {CAUSES.map((cause, i) => (
            <motion.li key={cause.title} {...riseIn(reduceMotion, { delay: i * 0.08, y: 18 })}>
              <div className="st-n">{String(i + 1).padStart(2, "0")}</div>
              <h3>{cause.title}</h3>
              <p>{cause.body}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* ── THE HOLISTIC POINT ── */}
      <FinancesModuleTiles />

      {/* ── YOUR SITUATION KEEPS CHANGING ── */}
      <section className="st-section">
        <motion.div {...riseIn(reduceMotion)} className="st-intro">
          <div className="st-label">And it never stands still</div>
          <h2 className="st-h2">Year on year, the picture changes – your figures have to keep up.</h2>
        </motion.div>
        <ol className="tp-events">
          {LIFE_EVENTS.map((ev, i) => (
            <motion.li key={ev} {...riseIn(reduceMotion, { delay: i * 0.08, y: 18 })}>
              <span>{String(i + 1).padStart(2, "0")}</span>{ev}
            </motion.li>
          ))}
        </ol>
      </section>

      {/* ── CANDID'S AIM ── */}
      <section className="st-section">
        <motion.div {...riseIn(reduceMotion)} className="tp-aim">
          <div>
            <div className="st-label">What Candid is for</div>
            <h2 className="st-h2">Candid's aim is to help you fix this.</h2>
          </div>
          <p>
            One complete, always-up-to-date view of your finances – built to adapt instantly as you change jobs, buy a home, start a family, or clear your student loan.
          </p>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section className="st-final">
        <motion.h2 {...riseIn(reduceMotion)} className="st-h2">
          Find out what not optimising is <mark>costing</mark> you.
        </motion.h2>
        <StartCheckButton source="the_problem_cta" />
      </section>
    </SiteLayout>
  );
}
