import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import posthog from "posthog-js";
import SiteLayout from "./SiteLayout.jsx";
import StartCheckButton from "./StartCheckButton.jsx";
import { riseIn } from "./motion.js";

// How it works tab, in the Statement design (shared classes in
// SiteLayout.jsx): the four steps as numbered rows on hairline rules.
const STEPS = [
  {
    title: "Share your current setup",
    body: "Salary, savings, pension, debts – as they stand today. Ballpark figures are fine, and you don't need to organise a thing beforehand. We do the heavy lifting, in under 5 minutes.",
  },
  {
    title: "Candid runs the numbers against UK tax rules",
    body: "Candid cross-references your figures against pension allowances, ISA limits, tax brackets, student loan thresholds, and more. The outcome is an instant financial health score and your options, ordered by what they're worth in pounds.",
  },
  {
    title: "Every option, with its £ value",
    body: "Break down your finances area by area – pension, ISAs, mortgage, debt and cash. Every option shows its estimated £ value, calculated directly from your numbers, alongside clear plain English explainers so you see the 'why' behind it.",
  },
  {
    title: "Guidance that grows with you",
    body: "A pay rise, buying a home, starting a family, or clearing a student loan – life isn't static. Update your numbers whenever things change, and Candid automatically recalculates your score and options, so your figures stay current.",
  },
];

export default function HowItWorksPage() {
  const reduceMotion = useReducedMotion();

  useEffect(() => { posthog.capture("how_it_works_viewed"); }, []);

  return (
    <SiteLayout>
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
