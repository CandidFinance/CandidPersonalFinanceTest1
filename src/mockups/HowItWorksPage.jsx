import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ClipboardList, Scale, Search, Compass } from "lucide-react";
import posthog from "posthog-js";
import { G, GOLD, WHITE, MUT, SERIF } from "../CandidApp.jsx";
import NewSiteLayout from "./NewSiteLayout.jsx";
import WaitlistForm from "./WaitlistForm.jsx";
import { riseIn, pullTogether } from "./motion.js";
import { useEqualHeights } from "./useEqualHeights.js";

const STEPS = [
  {
    icon: ClipboardList, title: "Share your current setup",
    body: "Salary, savings, pension, debts – as they stand today. Ballpark figures are fine, and you don't need to organise a thing beforehand. We do the heavy lifting, in under 5 minutes.",
    detail: "",
  },
  {
    icon: Scale, title: "Candid runs the numbers against UK tax rules",
    body: "Candid cross-references your figures against pension allowances, ISA limits, tax brackets, student loan thresholds, and more. The outcome is an instant financial health score and a prioritised roadmap for your specific goals.",
    detail: "",
  },
  {
    icon: Search, title: "Actionable steps with exact £ impact",
    body: "Break down your finances area by area – pension, ISAs, mortgage, debt and cash. Every action shows its quantified £ impact, calculated directly from your numbers, alongside clear plain English explainers so you see the 'why' behind every step.",
    detail: "",
  },
  {
    icon: Compass, title: "Guidance that grows with you",
    body: "A pay rise, buying a home, starting a family, or clearing a student loan – life isn't static. Update your numbers whenever things change, and Candid automatically recalculates your score and next steps to keep your plan on track.",
    detail: "",
  },
];

export default function HowItWorksPage() {
  const reduceMotion = useReducedMotion();
  // All four step tiles are sized to match whichever currently has the
  // most copy (see useEqualHeights) — a plain vertical flex column, unlike
  // CSS Grid, never equalises sibling heights on its own.
  const stepRef = useEqualHeights(STEPS.length);

  useEffect(() => { posthog.capture("how_it_works_viewed"); }, []);

  return (
    <NewSiteLayout>
      <div style={{ padding: "56px 24px 88px", textAlign: "center" }}>
        <motion.div {...riseIn(reduceMotion)} style={{ maxWidth: "620px", margin: "0 auto" }}>
          <h1 style={{
            fontFamily: SERIF, fontSize: "clamp(32px,5vw,48px)", fontWeight: 700,
            color: G, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: "18px",
          }}>
            How Candid works.
          </h1>
          <p style={{ fontSize: "clamp(15px,2vw,17px)", color: MUT, lineHeight: 1.7, maxWidth: "480px", margin: "0 auto" }}>
            Four steps, five minutes, and a complete picture of your tax efficiency, net worth, and tailored action plan – built to update automatically as your life changes.
          </p>
        </motion.div>
      </div>

      {/* .of-clip-steps (mobile-only): contains this list's scroll-entrance
          overflow on narrow phones. Step 4 (the last, so the largest offset)
          starts off-screen — translated sideways by up to ~30px while
          invisible (opacity:0), via pullTogether in motion.js — until
          scrolled into its reveal trigger, and a CSS transform still counts
          toward scrollable overflow even at opacity:0. Safe to clip: this
          wrapper's own 88px bottom padding comfortably exceeds the
          animation's 44px vertical travel, so nothing visible gets cut off
          mid-reveal. */}
      <style>{`
        @media (max-width: 768px) {
          .of-clip-steps { overflow-x: hidden; }
        }
      `}</style>
      <div className="of-clip-steps" style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          {STEPS.map((step, i) => (
            <motion.div key={step.title} ref={stepRef(i)} {...pullTogether(i, STEPS.length, reduceMotion, { stagger: 0.1, duration: 0.7, spreadPx: 20, riseYPx: 44 })} style={{
              background: WHITE, borderRadius: "18px", padding: "32px", boxShadow: "0 4px 24px rgba(22,47,36,0.07)",
              display: "flex", gap: "22px", alignItems: "flex-start", textAlign: "left",
            }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "12px", background: "rgba(196,150,58,0.14)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <step.icon size={24} color={G} />
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: GOLD, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>
                  Step {i + 1}
                </div>
                <div style={{ fontFamily: SERIF, fontSize: "20px", color: G, fontWeight: 600, marginBottom: "8px" }}>{step.title}</div>
                <div style={{ fontSize: "14.5px", color: MUT, lineHeight: 1.7, marginBottom: "10px" }}>{step.body}</div>
                <div style={{ fontSize: "13px", color: "#8a8a7e", lineHeight: 1.6, fontStyle: "italic" }}>{step.detail}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 24px 96px", textAlign: "center" }}>
        <motion.h2 {...riseIn(reduceMotion)} style={{ fontFamily: SERIF, fontSize: "clamp(22px,3.5vw,28px)", color: G, fontWeight: 700, marginBottom: "28px", lineHeight: 1.3 }}>
          Be first to know when Candid launches.
        </motion.h2>
        <WaitlistForm source="how_it_works_cta" />
      </div>
    </NewSiteLayout>
  );
}
