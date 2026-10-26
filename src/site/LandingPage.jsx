import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import posthog from "posthog-js";
import { WHITE, GEORGIA, MONO, HIGHLIGHT, SITE_BG, SITE_INK, SITE_MUTED, SITE_RULE } from "../design-tokens.js";
import SiteLayout from "./SiteLayout.jsx";
import StartCheckButton, { CTA_BLUE } from "./StartCheckButton.jsx";
import ReceiptScene from "./ReceiptScene.jsx";
import { EASE_STEADY, riseIn } from "./motion.js";

// ── Home tab of the marketing site, in the "Statement" design (Highlighter
// version, design/landing/BRIEF.md): Georgia headlines, a cyan highlighter,
// hairline rules, and cards kept only for things you tap (the calculators).
// The first screen is ReceiptScene; the sections below it explain, list
// what's covered, and offer the free calculators. The header/footer shell
// lives in SiteLayout.jsx, shared with the other tabs.
//
// Entrances below the scene use riseIn from ./motion.js: everything rises,
// nothing slides sideways, so nothing can widen a phone screen mid-reveal.

const STEPS = [
  { title: "Where you stand and where you're headed", body: "Share your current setup and targets, from salary and savings to buying a home or growing your investments. Rough estimates are fine, we'll do the maths." },
  { title: "Your full financial picture, analysed", body: "We test your setup against UK tax traps, debt mechanics, and personal goals. Then your Candid score, and every option worked out in pounds." },
  { title: "See the £ value of every decision", body: "See what each option saves you, from your own figures. Candid does the maths; the decisions are yours." },
  { title: "Guidance that grows with you", body: "Life isn't static. Whether you get a pay rise, buy a home, or start a family – update a figure and every module's answer moves with it." },
];

const AREAS = ["Pension & salary sacrifice", "ISA & investments", "Cash savings optimisation", "Student loan strategy", "Buying a home"];

const CALCULATORS = [
  { href: "/student-loan-calculator.html", title: "Student loan overpayment calculator", body: "Plan 1, 2, 4, 5 & Postgraduate – find out if overpaying saves you money or just hands cash to the government that would've been written off." },
  { href: "/100k-tax-trap-calculator.html", title: "£100,000 tax trap & childcare cliff calculator", body: "Check the 60% marginal-rate zone and the childcare cliff, and see how much pension sacrifice would bring your income back under £100,000." },
  { href: "/mortgage-vs-savings-calculator.html", title: "Mortgage overpayment vs high-yield savings", body: "When your fix ends, compare paying down the mortgage against a savings account or Cash ISA – tax accounted for." },
];

const CSS = `
  .lp { color: ${SITE_INK}; }
  .lp-section { max-width: 1040px; margin: 0 auto; padding: 0 24px 104px; }
  .lp-label { font: 500 11px/1 ${MONO}; letter-spacing: .1em; text-transform: uppercase; color: ${SITE_MUTED}; margin-bottom: 16px; }
  .lp-h2 { font: 700 clamp(28px, 4vw, 40px)/1.12 ${GEORGIA}; letter-spacing: -.02em; color: ${SITE_INK}; margin: 0; text-wrap: balance; }
  .lp mark { background: linear-gradient(transparent 12%, ${HIGHLIGHT} 12%, ${HIGHLIGHT} 92%, transparent 92%); color: inherit; padding: 0 .08em; }
  .lp-intro { margin-bottom: 44px; max-width: 720px; }

  .lp-steps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 56px; border-top: 1px solid ${SITE_INK}; }
  .lp-step { display: grid; grid-template-columns: 44px minmax(0, 1fr); padding: 26px 0 30px; border-bottom: 1px solid ${SITE_RULE}; }
  .lp-step-n { font: 500 13px/1.6 ${MONO}; color: ${SITE_MUTED}; }
  .lp-step h3 { font: 700 20px/1.3 ${GEORGIA}; margin: 0 0 8px; }
  .lp-step p { font-size: 15px; line-height: 1.65; color: ${SITE_MUTED}; margin: 0; }

  .lp-covers { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 56px; align-items: start; }
  .lp-areas { list-style: none; margin: 0; padding: 0; border-top: 1px solid ${SITE_INK}; }
  .lp-areas li { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 18px 0; border-bottom: 1px solid ${SITE_RULE}; font: 400 clamp(20px, 2.4vw, 24px)/1.25 ${GEORGIA}; }
  .lp-areas li span { font: 500 12px/1 ${MONO}; color: ${SITE_MUTED}; }
  .lp-small { font-size: 13px; line-height: 1.6; color: ${SITE_MUTED}; margin: 16px 0 0; }

  .lp-calcs { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
  .lp-calc { display: flex; flex-direction: column; background: ${WHITE}; border: 1px solid ${SITE_RULE}; border-radius: 6px; padding: 26px 24px;
    text-decoration: none; color: ${SITE_INK}; box-shadow: 0 18px 40px -30px rgba(20,35,28,.35); transition: border-color .2s ease; }
  .lp-calc:hover { border-color: ${SITE_INK}; }
  .lp-calc h3 { font: 700 19px/1.3 ${GEORGIA}; margin: 0 0 10px; }
  .lp-calc p { font-size: 14.5px; line-height: 1.65; color: ${SITE_MUTED}; margin: 0 0 20px; flex: 1; }
  .lp-calc-go { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: ${CTA_BLUE}; }

  .lp-final { text-align: center; padding: 0 24px 112px; }
  .lp-final .lp-h2 { margin-bottom: 28px; }

  @media (max-width: 760px) {
    .lp-section { padding-bottom: 80px; }
    .lp-steps { grid-template-columns: minmax(0, 1fr); }
    .lp-covers { grid-template-columns: minmax(0, 1fr); gap: 28px; }
    .lp-intro { margin-bottom: 32px; }
  }
`;

export default function LandingPage() {
  const reduceMotion = useReducedMotion();

  useEffect(() => { posthog.capture("landing_page_viewed"); }, []);

  return (
    <SiteLayout background={SITE_BG}>
      <style>{CSS}</style>
      <ReceiptScene />

      <div className="lp">
        {/* ── HOW IT WORKS (teaser — the full "How it works" tab has more detail) ── */}
        <section className="lp-section" style={{ paddingTop: "96px" }}>
          <motion.div {...riseIn(reduceMotion)} className="lp-intro">
            <div className="lp-label">How it works</div>
            <h2 className="lp-h2">Your finances, mapped. Every option worked out in pounds.</h2>
          </motion.div>
          <ol className="lp-steps" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {STEPS.map((step, i) => (
              <motion.li key={step.title} {...riseIn(reduceMotion, { delay: (i % 2) * 0.12 })} className="lp-step">
                <div className="lp-step-n">{String(i + 1).padStart(2, "0")}</div>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </section>

        {/* ── AREAS COVERED ── */}
        <section className="lp-section">
          <div className="lp-covers">
            <motion.div {...riseIn(reduceMotion)}>
              <div className="lp-label">What Candid covers</div>
              <h2 className="lp-h2">Every area of your finances, connected.</h2>
              <p className="lp-small">Guidance, not advice. Candid helps you understand your options – the decisions are always yours.</p>
            </motion.div>
            <div>
              <ul className="lp-areas">
                {AREAS.map((area, i) => (
                  <motion.li key={area} {...riseIn(reduceMotion, { delay: i * 0.07, y: 18 })}>
                    {area}<span>{String(i + 1).padStart(2, "0")}</span>
                  </motion.li>
                ))}
              </ul>
              <p className="lp-small">+ more areas depending on your situation</p>
            </div>
          </div>
        </section>

        {/* ── FREE CALCULATORS ── the one set of cards: each is a link. */}
        <section className="lp-section">
          <motion.div {...riseIn(reduceMotion)} className="lp-intro">
            <div className="lp-label">Free calculators</div>
            <h2 className="lp-h2">Answer one question in 30 seconds.</h2>
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
        <section className="lp-final">
          <motion.h2 {...riseIn(reduceMotion)} className="lp-h2">
            See what your finances <mark>could</mark> be doing.
          </motion.h2>
          <StartCheckButton source="final_cta" />
        </section>
      </div>
    </SiteLayout>
  );
}
