import { MUT, WHITE } from "../CandidApp.jsx";

// Shared circular "?" toggle for a short collapsed explanatory note — same
// convention on every deep-dive/onboarding screen that needs one. Used to be
// an identical inline style object copy-pasted into 5 separate files; any one
// of those could have silently drifted from the others on its next edit.
// `style` merges in any call-site-specific override (e.g. inline vertical
// alignment next to running text).
export default function InfoButton({ onClick, open, style, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={open ? "Hide explanation" : "Show explanation"}
      style={{
        background: MUT, color: WHITE, border: "none", borderRadius: "50%",
        width: "15px", height: "15px", fontSize: "10px", fontWeight: 700,
        lineHeight: "15px", textAlign: "center", padding: 0, cursor: "pointer", flexShrink: 0,
        ...style,
      }}
    >?</button>
  );
}
