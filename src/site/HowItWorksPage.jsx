import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import SiteLayout from "./SiteLayout.jsx";
import StartCheckButton from "./StartCheckButton.jsx";
import { riseIn } from "./motion.js";
import { STEPS } from "./steps.js";

// How it works tab, in the Statement design (shared classes in
// SiteLayout.jsx): the four steps (./steps.js, shared with Home's teaser) as
// numbered rows on hairline rules.

export default function HowItWorksPage() {
  const reduceMotion = useReducedMotion();

  useEffect(() => { posthog.capture("how_it_works_viewed"); }, []);

  return (
    <SiteLayout title="How it works | Candid">
      <motion.section {...riseIn(reduceMotion)} className="st-section st-hero">
        <div className="st-label">How it works</div>
        <h1 className="st-h1">How Candid works.</h1>
        <p className="st-lede">
          Four steps, five minutes, and a complete picture of your tax efficiency, net worth, and your options in pounds – built to update automatically as your life changes.
        </p>
      </motion.section>

      <section className="st-section">
        <ol className="st-rows">
          {STEPS.map((step, i) => (
            <motion.li key={step.title} {...riseIn(reduceMotion, { delay: i * 0.08, y: 18 })}>
              <div className="st-n">{String(i + 1).padStart(2, "0")}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="st-final">
        <motion.h2 {...riseIn(reduceMotion)} className="st-h2">
          Find out what not optimising is <mark>costing</mark> you.
        </motion.h2>
        <StartCheckButton source="how_it_works_cta" />
      </section>
    </SiteLayout>
  );
}
