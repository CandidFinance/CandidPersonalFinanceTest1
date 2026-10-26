import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import posthog from "posthog-js";
import { WHITE, GEORGIA, MONO, SITE_INK, SITE_MUTED, SITE_RULE } from "../design-tokens.js";
import SiteLayout from "./SiteLayout.jsx";
import StartCheckButton, { CTA_BLUE } from "./StartCheckButton.jsx";
import ReceiptScene from "./ReceiptScene.jsx";
import { EASE_STEADY, riseIn } from "./motion.js";
import { STEPS } from "./steps.js";

// ── Home tab of the marketing site, in the "Statement" design (Highlighter
// version, design/landing/BRIEF.md): Georgia headlines, a cyan highlighter,
// hairline rules, and cards kept only for things you tap (the calculators).
// The first screen is ReceiptScene; the sections below it explain, list
// what's covered, and offer the free calculators. The header/footer shell
// lives in SiteLayout.jsx, shared with the other tabs.
//
// Entrances below the scene use riseIn from ./motion.js: everything rises,
// nothing slides sideways, so nothing can widen a phone screen mid-reveal.

const AREAS = ["Pension & salary sacrifice", "ISA & investments", "Cash savings optimisation", "Student loan strategy", "Buying a home"];

const CALCULATORS = [
  { href: "/student-loan-calculator.html", title: "Student loan overpayment calculator", body: "Plan 1, 2, 4, 5 & Postgraduate – find out if overpaying saves you money or just hands cash to the government that would've been written off." },
  { href: "/100k-tax-trap-calculator.html", title: "£100,000 tax trap & childcare cliff calculator", body: "Check the 60% marginal-rate zone and the childcare cliff, and see how much pension sacrifice would bring your income back under £100,000." },
  { href: "/mortgage-vs-savings-calculator.html", title: "Mortgage overpayment vs high-yield savings", body: "When your fix ends, compare paying down the mortgage against a savings account or Cash ISA – tax accounted for." },
];

const CSS = `
  .lp-steps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 56px; border-top: 1px solid ${SITE_INK}; }
  .lp-step { display: grid; grid-template-columns: 44px minmax(0, 1fr); padding: 26px 0 30px; border-bottom: 1px solid ${SITE_RULE}; }
  .lp-step-n { font: 500 13px/1.6 ${MONO}; color: ${SITE_MUTED}; }
  .lp-step h3 { font: 700 20px/1.3 ${GEORGIA}; margin: 0 0 8px; }
  .lp-step p { font-size: 15px; line-height: 1.65; color: ${SITE_MUTED}; margin: 0; }

  .lp-covers { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 56px; align-items: start; }
  .lp-areas { list-style: none; margin: 0; padding: 0; border-top: 1px solid ${SITE_INK}; }
  .lp-areas li { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 18px 0; border-bottom: 1px solid ${SITE_RULE}; font: 400 clamp(20px, 2.4vw, 24px)/1.25 ${GEORGIA}; }
  .lp-areas li span { font: 500 12px/1 ${MONO}; color: ${SITE_MUTED}; }

  .lp-calcs { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
  .lp-calc { display: flex; flex-direction: column; background: ${WHITE}; border: 1px solid ${SITE_RULE}; border-radius: 6px; padding: 26px 24px;
    text-decoration: none; color: ${SITE_INK}; box-shadow: 0 18px 40px -30px rgba(20,35,28,.35); transition: border-color .2s ease; }
  .lp-calc:hover { border-color: ${SITE_INK}; }
  .lp-calc h3 { font: 700 19px/1.3 ${GEORGIA}; margin: 0 0 10px; }
  .lp-calc p { font-size: 14.5px; line-height: 1.65; color: ${SITE_MUTED}; margin: 0 0 20px; flex: 1; }
  .lp-calc-go { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: ${CTA_BLUE}; }

  @media (max-width: 760px) {
    .lp-steps { grid-template-columns: minmax(0, 1fr); }
    .lp-covers { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  }
`;

export default function LandingPage() {
  const reduceMotion = useReducedMotion();

  useEffect(() => { posthog.capture("landing_page_viewed"); }, []);

  return (
    <SiteLayout>
      <style>{CSS}</style>
      <ReceiptScene />

      <div>
        {/* ── HOW IT WORKS (teaser — the full "How it works" tab has more detail) ── */}
        <section className="st-section" style={{ paddingTop: "96px" }}>
          <motion.div {...riseIn(reduceMotion)} className="st-intro">
            <div className="st-label">How it works</div>
            <h2 className="st-h2">Your finances, mapped. Every option worked out in pounds.</h2>
          </motion.div>
          <ol className="lp-steps" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {STEPS.map((step, i) => (
              <motion.li key={step.title} {...riseIn(reduceMotion, { delay: (i % 2) * 0.12 })} className="lp-step">
                <div className="lp-step-n">{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.teaser}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </section>

        {/* ── AREAS COVERED ── */}
        <section className="st-section">
          <div className="lp-covers">
            <motion.div {...riseIn(reduceMotion)}>
              <div className="st-label">What Candid covers</div>
              <h2 className="st-h2">Every area of your finances, connected.</h2>
              <p className="st-small">Guidance, not advice. Candid helps you understand your options – the decisions are always yours.</p>
            </motion.div>
            <div>
              <ul className="lp-areas">
                {AREAS.map((area, i) => (
                  <motion.li key={area} {...riseIn(reduceMotion, { delay: i * 0.07, y: 18 })}>
                    {area}<span>{String(i + 1).padStart(2, "0")}</span>
                  </motion.li>
                ))}
              </ul>
              <p className="st-small">+ more areas depending on your situation</p>
            </div>
          </div>
        </section>

        {/* ── FREE CALCULATORS ── the one set of cards: each is a link. */}
        <section className="st-section">
          <motion.div {...riseIn(reduceMotion)} className="st-intro">
            <div className="st-label">Free calculators</div>
            <h2 className="st-h2">Answer one question in 30 seconds.</h2>
          </motion.div>
          <div className="lp-calcs">
            {CALCULATORS.map((tool, i) => (
              <motion.a
                key={tool.href} href={tool.href} className="lp-calc"
                {...riseIn(reduceMotion, { delay: i * 0.12 })}
                whileHover={reduceMotion ? undefined : { y: -3, transition: { duration: 0.2, ease: EASE_STEADY } }}
              >
                <h3>{tool.title}</h3>
                <p>{tool.body}</p>
                {/* Said in words, so the card reads as something to open. */}
                <span className="lp-calc-go">Open the calculator <ArrowRight size={15} strokeWidth={2.5} /></span>
              </motion.a>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="st-final">
          <motion.h2 {...riseIn(reduceMotion)} className="st-h2">
            Find out what not optimising is <mark>costing</mark> you.
          </motion.h2>
          <StartCheckButton source="final_cta" />
        </section>
      </div>
    </SiteLayout>
  );
}
