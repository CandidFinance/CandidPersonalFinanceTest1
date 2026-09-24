import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ClipboardList, Scale, Search, Compass } from "lucide-react";
import posthog from "posthog-js";
import { G, GOLD, WHITE, MUT, SERIF } from "../CandidApp.jsx";
import NewSiteLayout from "./NewSiteLayout.jsx";
import WaitlistForm from "./WaitlistForm.jsx";
import { riseIn, pullTogether } from "./motion.js";

const STEPS = [
  {
    icon: ClipboardList, title: "Tell us about your finances",
    body: "Salary, savings, pension, debts – as they stand today. There's no need to have anything optimised first; your current position, as it is, is exactly what we need.",
    detail: "Approximate figures are fine, and nothing is shared until you choose to. Takes about 5 minutes.",
  },
  {
    icon: Scale, title: "Candid analyses your whole position",
    body: "We run a trade-off analysis against the UK's actual tax structures and systems – pensions, ISAs, student loan, thresholds – to work out what's genuinely best for you, in the context of your position and your goals.",
    detail: "The outcome is a Candid health score and a clear set of actionable steps towards a more optimised position.",
  },
  {
    icon: Search, title: "Deep-dive guidance, module by module",
    body: "We walk you through exactly where you can improve – pension, ISA, student loan, cash – with specific, prioritised actions and their £ impact, calculated from your actual numbers.",
    detail: "Every recommendation shows its working, in plain English, so you understand the 'why' as well as the 'what.'",
  },
  {
    icon: Compass, title: "Ongoing guidance as things change",
    body: "A pay rise, a house move, a growing family, a student loan finally paid off – your position keeps moving, so the guidance does too, not just on day one.",
    detail: "Come back whenever something changes; your score and your next steps update with it.",
  },
];

export default function HowItWorksPage() {
  const reduceMotion = useReducedMotion();

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
            Four steps, five minutes, and a complete picture of where your money's going, what to do about it, and how that keeps up as life changes.
          </p>
        </motion.div>
      </div>

      <div style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          {STEPS.map((step, i) => (
            <motion.div key={step.title} {...pullTogether(i, STEPS.length, reduceMotion, { stagger: 0.1, duration: 0.7, spreadPx: 20, riseYPx: 44 })} style={{
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
