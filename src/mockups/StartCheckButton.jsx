import { useNavigate } from "react-router-dom";
import posthog from "posthog-js";
import { motion } from "framer-motion";
import { WHITE, SANS } from "../CandidApp.jsx";

// Apple's own button blue — the one accent colour on the marketing pages that
// departs from Candid's usual green/gold, reserved for the main CTA.
export const CTA_BLUE = "#0071E3";

// Where a visitor lands on entering the app: someone with a saved report goes
// straight back into it; everyone else starts the pre-assessment confidence
// check. Always the mobile-native app (/app/...), regardless of viewport.
export function appEntryPath() {
  try {
    const hasSavedInputs = !!localStorage.getItem('candid_inputs');
    const hasSavedInsights = !!localStorage.getItem('candid_insights');
    if (hasSavedInputs && hasSavedInsights) return "/app/home";
  } catch (e) {}
  return "/welcome";
}

// Main marketing CTA: one click straight into the app, no sign-up. `source`
// tags which section of the site it was clicked from in analytics.
export default function StartCheckButton({ source }) {
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
        background: CTA_BLUE, border: "none", borderRadius: "100px", padding: "16px 32px",
        fontSize: "15px", fontWeight: 700, color: WHITE, fontFamily: SANS, cursor: "pointer",
      }}
    >
      Optimise my money
    </motion.button>
  );
}
