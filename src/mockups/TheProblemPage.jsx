import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Layers, Clock, DoorClosed, TrendingUp, Home as HomeIcon, Users, CheckCircle2 } from "lucide-react";
import posthog from "posthog-js";
import { G, GOLD, WHITE, MUT, SERIF } from "../CandidApp.jsx";
import NewSiteLayout from "./NewSiteLayout.jsx";
import WaitlistForm from "./WaitlistForm.jsx";
import FinancesModuleTiles from "./FinancesModuleTiles.jsx";
import { EASE_STEADY, riseIn, pullTogether } from "./motion.js";

const CAUSES = [
  { icon: Layers, title: "Complexity", body: "Pensions, ISAs, tax bands, allowances and mortgages all interact. Get one decision wrong and it can undo the benefit of another." },
  { icon: Clock, title: "Lack of time", body: "Between demanding careers and life outside work, few have the bandwidth to model each financial decision against every tax threshold, account rule and investment option across their wider setup." },
  { icon: DoorClosed, title: "Lack of access", body: "Traditional financial advisers charge thousands in fees or demand six-figure minimum portfolios – leaving millions with nowhere clear to turn." },
];

const LIFE_EVENTS = [
  { icon: TrendingUp, label: "Salary & tax band change" },
  { icon: HomeIcon, label: "House purchase" },
  { icon: Users, label: "Family planning" },
  { icon: CheckCircle2, label: "Student loan payoff" },
];

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: "10px", fontWeight: 700, color: GOLD, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "18px" }}>
    {children}
  </div>
);

// A card that flips to reveal its body text on the reverse, on either hover
// (laptop/desktop) or tap (tablet/mobile) — the front stays a simple icon +
// title so the row reads cleanly at a glance, and the back uses the opposite
// colour scheme (dark green, not white) so the flip itself reads as "turning
// the card over" rather than a plain swap.
//
// Both triggers are wired unconditionally, not chosen via a `(hover: hover)`
// capability check — that check sounds right but isn't reliable in practice:
// plenty of touchscreen-enabled laptops report `hover: none` (a touch
// digitizer is present at all) even while being driven entirely by a mouse
// or trackpad, which would wire up tap-only and silently kill hover on a
// real laptop. Running both at once is safe because framer-motion's hover
// gesture already ignores touch pointers internally (to avoid the classic
// "sticky hover" glitch) — so onHoverStart/onHoverEnd only ever fire for a
// genuine mouse/trackpad, and onTap only ever fires from an actual tap or
// click, with each pointer type only ever driving the mechanism meant for it.
//
// Hover is detected on this OUTER, never-rotated wrapper and just flips a
// bit of state — deliberately not `whileHover` on the rotating element
// itself. The perspective/rotateY foreshortening shrinks a rotating
// element's own hit-box as it turns, so hovering the element that's doing
// the rotating makes the pointer fall outside that shrinking box mid-flip,
// which re-triggers mouseleave/mouseenter over and over (the "spasm").
// Keeping the hover target's box static and driving a separate child's
// rotation from state avoids that entirely.
//
// The flip still applies instantly under prefers-reduced-motion (the hover
// state itself isn't an animation to suppress) — only its transition
// duration drops to 0, per this site's existing reduced-motion convention.
function FlipCard({ icon: Icon, title, body, i, total, reduceMotion }) {
  const [hovered, setHovered] = useState(false);
  const [tapped, setTapped] = useState(false);
  const flipped = hovered || tapped;
  return (
    <motion.div
      {...pullTogether(i, total, reduceMotion)}
      style={{ perspective: "1400px" }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onTap={() => setTapped(t => !t)}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: EASE_STEADY }}
        style={{ position: "relative", height: "236px", transformStyle: "preserve-3d" }}
      >
        {/* Front */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          background: WHITE, borderRadius: "18px", borderTop: `4px solid ${GOLD}`,
          boxShadow: "0 4px 24px rgba(22,47,36,0.07)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px",
        }}>
          <Icon size={30} color={G} />
          <div style={{ fontFamily: SERIF, fontSize: "19px", color: G, fontWeight: 600, textAlign: "center" }}>{title}</div>
        </div>
        {/* Back — reversed colour scheme (dark green, gold accent) for depth */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)",
          background: G, borderRadius: "18px", padding: "28px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px rgba(22,47,36,0.25)",
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <div style={{ fontFamily: SERIF, fontSize: "15px", color: GOLD, fontWeight: 700, marginBottom: "10px" }}>{title}</div>
          <div style={{ fontSize: "13.5px", color: "rgba(246,240,230,0.85)", lineHeight: 1.7 }}>{body}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function TheProblemPage() {
  const reduceMotion = useReducedMotion();

  useEffect(() => { posthog.capture("the_problem_viewed"); }, []);

  return (
    <NewSiteLayout>
      {/* ── HERO ── */}
      <div style={{ padding: "56px 24px 80px", textAlign: "center" }}>
        <motion.div {...riseIn(reduceMotion)} style={{ maxWidth: "700px", margin: "0 auto" }}>
          <SectionLabel>The problem</SectionLabel>
          <h1 style={{
            fontFamily: SERIF, fontSize: "clamp(30px,4.5vw,44px)", fontWeight: 700,
            color: G, lineHeight: 1.2, letterSpacing: "-0.01em", marginBottom: "20px",
          }}>
            Millions of higher and additional rate taxpayers are uniquely exposed to a financial minefield.
          </h1>
          <p style={{ fontSize: "clamp(15px,2vw,17px)", color: MUT, lineHeight: 1.75, maxWidth: "580px", margin: "0 auto" }}>
            Not because they've made mistakes – because personal finance has become overly complex, time-consuming, and frustratingly opaque. The result? Thousands of pounds leaking from your net worth every year.
          </p>
        </motion.div>
      </div>

      {/* ── ROOT CAUSES ── */}
      {/* .of-clip-causes (mobile-only, see <style> below) contains this
          section's scroll-entrance overflow on narrow phones: each cause
          tile starts off-screen — translated sideways by up to ~46px while
          invisible (opacity:0), via pullTogether in motion.js — until
          scrolled into its reveal trigger, and a CSS transform still counts
          toward scrollable overflow even at opacity:0. That's what made the
          "Lack of access" tile (the outermost, so the largest offset)
          overflow the viewport before it had ever been scrolled to. Safe to
          clip here: this wrapper's own 88px bottom padding comfortably
          exceeds the animation's 54px vertical travel, so nothing visible
          gets cut off mid-reveal. */}
      <style>{`
        @media (max-width: 768px) {
          .of-clip-causes, .of-clip-life { overflow-x: hidden; }
        }
      `}</style>
      <div className="of-clip-causes" style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
            {CAUSES.map((cause, i) => (
              <FlipCard key={cause.title} icon={cause.icon} title={cause.title} body={cause.body} i={i} total={CAUSES.length} reduceMotion={reduceMotion} />
            ))}
          </div>
        </div>
      </div>

      {/* ── THE HOLISTIC POINT — a plain wrapping row of module tiles at
          normal page width (see FinancesModuleTiles.jsx). ── */}
      <FinancesModuleTiles />

      {/* ── YOUR SITUATION KEEPS CHANGING ── */}
      {/* .of-clip-life — same off-screen entrance-animation overflow fix as
          .of-clip-causes above. Found while re-measuring after fixing that
          one: not one of the originally reported sections, but the identical
          bug (see .of-clip-causes' comment for the full mechanism). */}
      <div className="of-clip-life" style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: "880px", margin: "0 auto", textAlign: "center" }}>
          <SectionLabel>And it never stands still</SectionLabel>
          <motion.h2 {...riseIn(reduceMotion)} style={{
            fontFamily: SERIF, fontSize: "clamp(24px,3.5vw,32px)", color: G, fontWeight: 700, lineHeight: 1.3, marginBottom: "44px",
          }}>
            Year on year, the picture changes – your plan has to keep up.
          </motion.h2>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: "24px", left: "8%", right: "8%", height: "1.5px", background: "rgba(22,47,36,0.12)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "24px", position: "relative" }}>
              {LIFE_EVENTS.map((ev, i) => (
                <motion.div key={ev.label} {...pullTogether(i, LIFE_EVENTS.length, reduceMotion, { stagger: 0.1, spreadPx: 22, riseYPx: 26 })} style={{
                  flex: "1 1 140px", maxWidth: "160px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
                }}>
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "50%", background: WHITE, border: `2px solid ${GOLD}`,
                    display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(22,47,36,0.08)",
                  }}>
                    <ev.icon size={20} color={G} />
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: G, lineHeight: 1.4 }}>{ev.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CANDID'S AIM ── */}
      <div style={{ padding: "0 24px 88px" }}>
        <motion.div {...riseIn(reduceMotion, { duration: 0.75 })} style={{
          maxWidth: "760px", margin: "0 auto", background: G, borderRadius: "24px",
          padding: "56px 40px", textAlign: "center",
        }}>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(24px,3.5vw,30px)", color: WHITE, fontWeight: 700, marginBottom: "18px", lineHeight: 1.3 }}>
            Candid's aim is to fix this.
          </h2>
          <p style={{ fontSize: "14.5px", color: "rgba(246,240,230,0.75)", lineHeight: 1.7, maxWidth: "540px", margin: "0 auto" }}>
            One complete, always-up-to-date view of your finances – built to adapt instantly as you change jobs, buy a home, start a family, or clear your student loan.
          </p>
        </motion.div>
      </div>

      {/* ── CTA ── */}
      <div style={{ padding: "0 24px 96px", textAlign: "center" }}>
        <motion.h2 {...riseIn(reduceMotion)} style={{ fontFamily: SERIF, fontSize: "clamp(22px,3.5vw,28px)", color: G, fontWeight: 700, marginBottom: "28px", lineHeight: 1.3 }}>
          Be first to know when Candid launches.
        </motion.h2>
        <WaitlistForm source="the_problem_cta" />
      </div>
    </NewSiteLayout>
  );
}
