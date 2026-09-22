import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { G, GOLD, CREAM, MUT, SERIF, SANS } from "../CandidApp.jsx";
import { isBetaUnlocked, destinationAfterUnlock } from "../BetaGate.jsx";
import { EASE_STEADY } from "./motion.js";

// Fixed header height, kept in sync with this file's own padding/font-size
// choices below — NewSiteLayout uses it to reserve the equivalent space in
// the document flow (the header itself is `position: fixed`, so it doesn't
// push content down on its own).
export const HEADER_HEIGHT = 80;

const TABS = [
  { to: "/", label: "Home" },
  { to: "/the-problem", label: "The Problem" },
  { to: "/how-it-works", label: "How it works" },
];

// Only ever true in dev/preview builds (see main.jsx's own SHOW_DEV_TOOLS) —
// reserves room in the header so the Beta Tester button never sits under the
// dev-tools toggle, which floats fixed at top:16/right:16 on top of
// everything at this screen size. Folds to a literal `false` in production,
// so this reserve (and the dead-code branch it guards) disappears there too.
const RESERVE_FOR_DEV_TOOLS = import.meta.env.VITE_SHOW_DEV_TOOLS === "true";

// Hides the header on the first scroll away from the top, brings it back on
// any upward scroll, and also forces it back once the page is scrolled to
// its very bottom (so it's never permanently unreachable).
function useNavVisibility() {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 4;
      const scrollingUp = y < lastY.current;
      if (atBottom || scrollingUp || y < HEADER_HEIGHT) setVisible(true);
      else setVisible(false);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return visible;
}

export default function NewSiteHeader() {
  const visible = useNavVisibility();
  const location = useLocation();
  const navigate = useNavigate();
  const unlocked = isBetaUnlocked();

  return (
    <motion.div
      animate={{ y: visible ? 0 : "-100%", opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.75, ease: EASE_STEADY }}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: HEADER_HEIGHT,
        background: CREAM, borderBottom: "1px solid rgba(22,47,36,0.08)",
        paddingTop: "env(safe-area-inset-top, 0px)", boxSizing: "border-box",
      }}
    >
      {/* Tabs sit right next to the logo rather than pushed out to the far
          right edge — the dev-tools toggle (SHOW_DEV_TOOLS, DevTools.jsx)
          renders fixed at top:16/right:16 on top of everything on this
          screen size, and would otherwise sit directly over them. The Beta
          Tester button on the right gets the same treatment, via
          RESERVE_FOR_DEV_TOOLS below, since it can't move away like the tabs
          did — the brief calls for it specifically in the top right. */}
      <div style={{
        height: "100%", display: "flex", alignItems: "center", gap: "56px",
        padding: `0 ${RESERVE_FOR_DEV_TOOLS ? "170px" : "28px"} 0 28px`,
      }}>
        <Link to="/" style={{ fontFamily: SERIF, fontSize: "28px", fontWeight: 700, color: G, textDecoration: "none" }}>
          Candid.
        </Link>
        <nav style={{ display: "flex", gap: "30px" }}>
          {TABS.map(tab => {
            const active = location.pathname === tab.to;
            return (
              <Link key={tab.to} to={tab.to} style={{
                fontFamily: SANS, fontSize: "14px", fontWeight: 600,
                color: active ? G : MUT, textDecoration: "none",
                borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
                paddingBottom: "4px",
              }}>
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => navigate(unlocked ? destinationAfterUnlock() : "/beta")}
          style={{
            marginLeft: "auto", flexShrink: 0, display: "flex", alignItems: "center", gap: "7px",
            background: "transparent", border: `1.5px solid ${G}`, borderRadius: "100px",
            padding: "8px 18px", fontFamily: SANS, fontSize: "13px", fontWeight: 700,
            color: G, cursor: "pointer",
          }}
        >
          <Lock size={13} />
          Beta Tester
        </button>
      </div>
    </motion.div>
  );
}
