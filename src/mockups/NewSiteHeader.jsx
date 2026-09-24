import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Menu, X } from "lucide-react";
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

// Below this width the tabs + Beta Tester button (desktop's `display:flex`
// row, sized for a wide screen) no longer fit and start overflowing the
// viewport — this is the one new breakpoint this file introduces, purely to
// swap that row for a hamburger toggle. Kept as a plain number (not the
// mobile app's `useWindowWidth()`, which lives in CandidApp.jsx and isn't
// exported) since every bit of the swap below is expressed as CSS/media
// queries, not JS branching — matching the same scoped-`<style>` +
// `@media` pattern already used for the "How it works" 2x2 grid.
const MOBILE_BREAKPOINT = 768;

// Only ever true in dev/preview builds (see main.jsx's own SHOW_DEV_TOOLS) —
// reserves room in the header so the Beta Tester button never sits under the
// dev-tools toggle, which floats fixed at top:16/right:16 on top of
// everything at this screen size. Folds to a literal `false` in production,
// so this reserve (and the dead-code branch it guards) disappears there too.
const RESERVE_FOR_DEV_TOOLS = import.meta.env.VITE_SHOW_DEV_TOOLS === "true";

// Hides the header on the first scroll away from the top, brings it back on
// any upward scroll, and also forces it back once the page is scrolled to
// its very bottom (so it's never permanently unreachable). `forceVisible`
// keeps it pinned open while the mobile menu is open, so the dropdown never
// slides away out from under a still-open toggle mid-interaction.
function useNavVisibility(forceVisible) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  useEffect(() => {
    if (forceVisible) { setVisible(true); return; }
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
  }, [forceVisible]);
  return visible;
}

export default function NewSiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const visible = useNavVisibility(mobileOpen);
  const location = useLocation();
  const navigate = useNavigate();
  const unlocked = isBetaUnlocked();
  const rootRef = useRef(null);

  // Belt-and-braces close triggers — none of these are reachable on desktop
  // in the first place (there's nothing to open), so none of this touches
  // desktop behaviour. Each page mounts its own NewSiteLayout/NewSiteHeader,
  // so a route change already remounts this component fresh in practice;
  // the pathname effect just covers it explicitly too.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e) { if (e.key === "Escape") setMobileOpen(false); }
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setMobileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [mobileOpen]);

  function goToBeta() {
    setMobileOpen(false);
    navigate(unlocked ? destinationAfterUnlock() : "/beta");
  }

  return (
    <motion.div
      ref={rootRef}
      animate={{ y: visible ? 0 : "-100%", opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.75, ease: EASE_STEADY }}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, height: HEADER_HEIGHT,
        background: CREAM, borderBottom: "1px solid rgba(22,47,36,0.08)",
        paddingTop: "env(safe-area-inset-top, 0px)", boxSizing: "border-box",
      }}
    >
      {/* Mobile-only rules. Everything above/below this stays exactly as it
          was for desktop — these three classes only ever change anything
          at MOBILE_BREAKPOINT and below: the tabs and Beta Tester button
          (too wide together to fit a phone screen) are swapped for a single
          toggle button, top-right, which opens a full-width dropdown
          containing the same tabs plus Beta Tester, stacked vertically. */}
      <style>{`
        .nsh-tabs { display: flex; }
        .nsh-beta-btn { display: flex; }
        .nsh-toggle { display: none; }
        .nsh-mobile-panel { display: none; }
        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          .nsh-tabs { display: none; }
          .nsh-beta-btn { display: none; }
          .nsh-toggle { display: flex; }
          .nsh-mobile-panel.nsh-mobile-panel--open { display: block; }
        }
      `}</style>
      <div style={{
        height: "100%", display: "flex", alignItems: "center", gap: "56px",
        padding: `0 ${RESERVE_FOR_DEV_TOOLS ? "170px" : "28px"} 0 28px`,
      }}>
        <Link to="/" style={{ fontFamily: SERIF, fontSize: "28px", fontWeight: 700, color: G, textDecoration: "none" }}>
          Candid.
        </Link>
        <nav className="nsh-tabs" style={{ gap: "30px" }}>
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
          className="nsh-beta-btn"
          onClick={goToBeta}
          style={{
            marginLeft: "auto", flexShrink: 0, alignItems: "center", gap: "7px",
            background: "transparent", border: `1.5px solid ${G}`, borderRadius: "100px",
            padding: "8px 18px", fontFamily: SANS, fontSize: "13px", fontWeight: 700,
            color: G, cursor: "pointer",
          }}
        >
          <Lock size={13} />
          Beta Tester
        </button>

        {/* Mobile menu toggle — invisible/unreachable on desktop
            (.nsh-toggle above), takes over the far-right spot the Beta
            Tester button occupies on desktop once that button is hidden. */}
        <button
          type="button"
          className="nsh-toggle"
          onClick={() => setMobileOpen(o => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="nsh-mobile-menu"
          style={{
            alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", padding: "8px",
            margin: "-8px 0 -8px auto", // negative top/bottom cancels the padding's added height (bigger tap target, same row height); auto-left pushes it to the far right, same trick the desktop Beta Tester button uses
            color: G, cursor: "pointer",
          }}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown — full-width, directly under the header, same tabs
          plus Beta Tester stacked vertically. Reachable only via
          .nsh-toggle (mobile-only) and hard-hidden again above
          MOBILE_BREAKPOINT regardless of `mobileOpen`, so a window resized
          wider mid-session (unlikely on a real phone, but possible when
          resizing a desktop browser) can never leave it stuck open over the
          desktop layout. */}
      <div
        id="nsh-mobile-menu"
        className={`nsh-mobile-panel${mobileOpen ? " nsh-mobile-panel--open" : ""}`}
        style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: CREAM, borderBottom: "1px solid rgba(22,47,36,0.08)",
          boxShadow: "0 12px 24px rgba(22,47,36,0.1)",
        }}
      >
        <nav style={{ display: "flex", flexDirection: "column", padding: "8px 28px 12px" }}>
          {TABS.map(tab => {
            const active = location.pathname === tab.to;
            return (
              <Link
                key={tab.to} to={tab.to}
                onClick={() => setMobileOpen(false)}
                style={{
                  fontFamily: SANS, fontSize: "16px", fontWeight: 600,
                  color: active ? G : MUT, textDecoration: "none",
                  padding: "14px 0", borderBottom: "1px solid rgba(22,47,36,0.08)",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={goToBeta}
            style={{
              display: "flex", alignItems: "center", gap: "8px", marginTop: "14px",
              background: "transparent", border: `1.5px solid ${G}`, borderRadius: "100px",
              padding: "10px 18px", fontFamily: SANS, fontSize: "14px", fontWeight: 700,
              color: G, cursor: "pointer", alignSelf: "flex-start",
            }}
          >
            <Lock size={14} />
            Beta Tester
          </button>
        </nav>
      </div>
    </motion.div>
  );
}
