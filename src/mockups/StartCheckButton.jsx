import { useNavigate } from "react-router-dom";
import posthog from "posthog-js";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { WHITE, SANS } from "../CandidApp.jsx";

// Apple's own button blue — the one accent colour on the marketing pages that
// departs from Candid's usual green/gold, reserved for the main CTA.
export const CTA_BLUE = "#0071E3";

// Where a visitor lands on entering the app: someone with a saved report, or
// who has been through the app's two-question entry, goes straight back in;
// everyone else starts the pre-assessment confidence check. Always the
// mobile-native app (/app/...), regardless of viewport.
export function appEntryPath() {
  try {
    const savedInputs = localStorage.getItem('candid_inputs');
    const hasSavedInsights = !!localStorage.getItem('candid_insights');
    if (savedInputs && (hasSavedInsights || JSON.parse(savedInputs).appEntered)) return "/app/home";
  } catch (e) {}
  return "/welcome";
}

// The CTA's label, shared with the site header so every "start" button reads
// the same. It says what you get, not "Beta" (testers didn't read the old
// "Beta - Optimise my money" as the way into the product).
export const CTA_LABEL = "See what I could save";

// Main marketing CTA: one click straight into the app, no sign-up. `source`
// tags which section of the site it was clicked from in analytics. `size`
// "large" is the hero's version: bigger, with a glow, so it is unmistakably
// the thing to press.
export default function StartCheckButton({ source, size = "regular" }) {
  const large = size === "large";
  const navigate = useNavigate();

  function start() {
    posthog.capture("start_check_clicked", { source });
    navigate(appEntryPath());
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <motion.button
      type="button" onClick={start}
      whileHover={{ scale: 1.03 }}
      style={{
        display: "inline-flex", alignItems: "center", gap: "10px",
        background: CTA_BLUE, border: "none", borderRadius: "100px",
        padding: large ? "20px 36px" : "16px 30px",
        fontSize: large ? "18px" : "15px", fontWeight: 700, color: WHITE, fontFamily: SANS, cursor: "pointer",
        boxShadow: large ? "0 10px 30px rgba(0,113,227,0.35)" : "0 6px 18px rgba(0,113,227,0.22)",
      }}
    >
      {CTA_LABEL}
      <ArrowRight size={large ? 20 : 17} strokeWidth={2.5} />
    </motion.button>
  );
}
