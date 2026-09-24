import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, useInView, animate } from "framer-motion";
import { ClipboardList, Scale, Search, Compass, GraduationCap, PoundSterling, Home as HomeIcon } from "lucide-react";
import posthog from "posthog-js";
import { G, GOLD, WHITE, MUT, SERIF } from "../CandidApp.jsx";
import NewSiteLayout from "./NewSiteLayout.jsx";
import WaitlistForm from "./WaitlistForm.jsx";
import { EASE_STEADY, riseIn, pullTogether, heroStagger, heroItem } from "./motion.js";
import { useEqualHeights } from "./useEqualHeights.js";

// ── Home tab of the rebuilt marketing site: same brand (green/gold/serif),
// one new accent (Apple's #0071E3 blue, reserved for the waitlist CTA) and
// one new idea — a single continuous page background (no more alternating
// solid colour blocks), with content laid out as floating tiles over it
// rather than full-bleed sections. The header/footer/background shell lives
// in NewSiteLayout.jsx, shared with the other tabs. Reviewed at /new before
// being promoted to the live "/" (see main.jsx's RootRoute).
//
// Every entrance animation on this page comes from ./motion.js, which
// encodes the site's three themes — continual upward growth, slow and
// steady, and simplicity emerging from complexity — see that file's comment.

const tileHover = {
  whileHover: { y: -4, boxShadow: "0 18px 40px rgba(22,47,36,0.14)", transition: { duration: 0.2, ease: EASE_STEADY } },
};

function parseStatValue(str) {
  // Only a single "prefix + number + suffix" shape (e.g. "£4,200") can be
  // counted up. Anything else — e.g. "£425 / £527", two figures side by
  // side — is displayed as plain static text instead (see CountUpStat).
  const match = String(str).match(/^([^\d]*)([\d,.]+)([^\d]*)$/);
  if (!match) return { raw: String(str) };
  const [, prefix, numStr, suffix] = match;
  const hasComma = numStr.includes(",");
  const cleanNum = numStr.replace(/,/g, "");
  const decimals = cleanNum.includes(".") ? cleanNum.split(".")[1].length : 0;
  return { prefix, target: parseFloat(cleanNum), suffix, decimals, hasComma };
}
function formatStatNumber(value, { decimals, hasComma }) {
  const fixed = value.toFixed(decimals);
  if (!hasComma) return fixed;
  const [intPart, decPart] = fixed.split(".");
  const withCommas = Number(intPart).toLocaleString("en-GB");
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}
function CountUpStat({ value }) {
  const parsed = useMemo(() => parseStatValue(value), [value]);
  const isRaw = parsed.raw != null;
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion || isRaw ? parsed.target : 0);
  useEffect(() => {
    if (isRaw || !isInView) return;
    if (reduceMotion) { setDisplay(parsed.target); return; }
    const controls = animate(0, parsed.target, { duration: 0.9, ease: EASE_STEADY, onUpdate: setDisplay });
    return () => controls.stop();
  }, [isInView, parsed.target, reduceMotion, isRaw]);
  if (isRaw) return <span ref={ref}>{parsed.raw}</span>;
  return <span ref={ref}>{parsed.prefix}{formatStatNumber(display, parsed)}{parsed.suffix}</span>;
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: "10px", fontWeight: 700, color: GOLD, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "18px" }}>
      {children}
    </div>
  );
}

// White floating card — the one reusable "tile" surface for this page.
// Forwards its ref so a tile set can be measured/equalised via
// useEqualHeights (see the "How it works" teaser and calculator grids below).
const Tile = forwardRef(function Tile({ children, style, ...motionProps }, ref) {
  return (
    <motion.div ref={ref} {...motionProps} style={{
      background: WHITE, borderRadius: "18px", padding: "32px 28px",
      boxShadow: "0 4px 24px rgba(22,47,36,0.07)", ...style,
    }}>
      {children}
    </motion.div>
  );
});

// A stat tile that flips on hover to reveal its source on the back — same
// mechanic as TheProblemPage's FlipCard (rotateY driven from a separate,
// never-hovered wrapper, so the flip's own perspective foreshortening never
// shrinks the thing being hovered — see that file's comment for why this
// matters). Not a shared import: FlipCard's front is an icon + title, this
// one's is a big stat + short label, different enough to keep separate.
function StatFlipTile({ n, label, source, i, total, reduceMotion }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      {...pullTogether(i, total, reduceMotion)}
      style={{ perspective: "1400px", minWidth: "240px", flex: "1 1 240px", maxWidth: "340px" }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <motion.div
        animate={{ rotateY: hovered ? 180 : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: EASE_STEADY }}
        style={{ position: "relative", height: "200px", transformStyle: "preserve-3d" }}
      >
        {/* Front — title and body as one block, centred together in the
            tile (both horizontally and vertically) — back to how this
            looked originally, now that the content itself is settled. */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          background: WHITE, borderRadius: "18px", boxShadow: "0 4px 24px rgba(22,47,36,0.07)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px",
        }}>
          {/* Title box */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontFamily: SERIF, fontSize: "40px", fontWeight: 700, color: GOLD, lineHeight: 1.15, textAlign: "center" }}>
              <CountUpStat value={n} />
            </div>
          </div>
          {/* Body box */}
          <div>
            {/* Fixed size (not length-based) — all three tiles' copy is now
                comparably long, so a shared size is what keeps them looking
                consistent with each other, same as the numbers above. */}
            <div style={{ fontSize: "11px", color: MUT, lineHeight: 1.4, textAlign: "center" }}>
              {/* "\n" in a label forces a manual line break (e.g. the pension-relief
                  stat splits after the comma) — plain labels have none, so they
                  render as a single line same as before. */}
              {label.split("\n").map((line, idx) => (
                <span key={idx}>{idx > 0 && <br />}{line}</span>
              ))}
            </div>
          </div>
        </div>
        {/* Back — source citation, reversed colour scheme for depth */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)",
          background: G, borderRadius: "18px", padding: "20px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px rgba(22,47,36,0.25)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
        }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: GOLD, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>Source</div>
          <div style={{ fontSize: "12.5px", color: "rgba(246,240,230,0.85)", lineHeight: 1.6 }}>
            {/* Same "\n"-forces-a-break convention as the label above (e.g. the
                cash-savings source splits after its comma). */}
            {source.split("\n").map((line, idx) => (
              <span key={idx}>{idx > 0 && <br />}{line}</span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function NewLandingPage() {
  const reduceMotion = useReducedMotion();
  // Both tile sets below have visibly uneven copy lengths, so each is sized
  // to match whichever tile currently has the most — see useEqualHeights.
  // The teaser grid needs this because CSS Grid only equalises height within
  // a shared row, not across the whole 2x2 set; the calculators row is
  // already equalised by Grid's own default row-stretch in the common
  // 3-in-a-row case, but this keeps it true even if it ever wraps unevenly.
  const teaserRef = useEqualHeights(4);
  const calcRef = useEqualHeights(3);

  useEffect(() => { posthog.capture("landing_page_viewed"); }, []);

  return (
    <NewSiteLayout>
      {/* ── HERO — a cascade, not one block: badge, headline, subhead, form
          and trust line each rise in slightly after the last. ── */}
      <div style={{ padding: "56px 24px 88px", textAlign: "center" }}>
        <motion.div
          variants={heroStagger} initial={reduceMotion ? "visible" : "hidden"} animate="visible"
          style={{ maxWidth: "680px", margin: "0 auto" }}
        >
          <motion.div variants={heroItem} style={{
            display: "inline-block", background: "rgba(196,150,58,0.14)", color: "#8a6a24",
            fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            borderRadius: "100px", padding: "7px 16px", marginBottom: "24px",
          }}>
            Coming soon
          </motion.div>
          <motion.h1 variants={heroItem} style={{
            fontFamily: SERIF, fontSize: "clamp(38px,6vw,58px)", fontWeight: 700,
            color: G, lineHeight: 1.12, letterSpacing: "-0.01em", marginBottom: "20px",
          }}>
            Your finances,<br />trending in the <span style={{ color: G, fontWeight: 800 }}>right</span> direction.
          </motion.h1>
          <motion.p variants={heroItem} style={{ fontSize: "clamp(15px,2vw,18px)", color: MUT, lineHeight: 1.7, maxWidth: "520px", margin: "0 auto 40px" }}>
            Candid finds the gaps, inefficiencies and missed allowances costing you thousands – then shows you exactly how to fix it. Join the waitlist to be first in when we launch.
          </motion.p>
          <motion.div variants={heroItem}>
            <WaitlistForm id="waitlist" source="hero" />
            <div style={{ fontSize: "12px", color: MUT, marginTop: "14px" }}>No spam. One email, the day we launch.</div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── PROBLEM STATS ── */}
      {/* .of-clip-stats (mobile-only, see the shared <style> below): contains
          this section's entrance-animation overflow on narrow phones. Each
          stat tile starts off-screen — translated sideways by up to ~46px
          while invisible (opacity:0), via pullTogether in motion.js — until
          scrolled into its reveal trigger. A CSS transform still counts
          toward scrollable overflow even at opacity:0, so before that tile
          is ever scrolled into view, that offset alone was enough to make
          the whole page horizontally scrollable on a narrow phone. Safe to
          clip here: this wrapper's own 88px bottom padding is comfortably
          more than the animation's 54px vertical travel, so nothing visible
          ever gets cut off mid-reveal. */}
      <div className="of-clip-stats" style={{ padding: "0 24px 88px" }}>
        {/* Widened from 720px so the tiles below have room to fit "£425 / £527
            p.a." on one line without shrinking. */}
        <div style={{ maxWidth: "960px", margin: "0 auto", textAlign: "center" }}>
          <SectionLabel>What it solves</SectionLabel>
          <motion.h2 {...riseIn(reduceMotion)} style={{ fontFamily: SERIF, fontSize: "clamp(24px,3.5vw,30px)", color: G, fontWeight: 700, lineHeight: 1.25, marginBottom: "40px" }}>
            Good income. Good career.<br />Still losing thousands.
          </motion.h2>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              // `source` is a placeholder pending real citations (see the
              // "sources of these claims" discussion) — swap each one in once confirmed.
              { n: "£425 p.a.", label: "average unclaimed pension tax relief,\nby higher-rate taxpayers", source: "PensionBee (Jan 2023), 2020/21 tax year" },
              { n: "61%", label: "of those with £10k+ in investable assets hold at least three-quarters or more in cash", source: "FCA Financial Lives (May 2024)" },
              { n: "~£100 p.a.", label: "average foregone interest surplus,\nper cash saver", source: "FCA update on cash savings (Sept 2024),\nFCA Financial Lives (May 2025)" },
            ].map((chip, i) => (
              <StatFlipTile key={chip.n} n={chip.n} label={chip.label} source={chip.source} i={i} total={3} reduceMotion={reduceMotion} />
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS (teaser — the full "How it works" tab has more detail) ── */}
      {/* .of-clip-teaser — same off-screen entrance-animation overflow fix as
          .of-clip-stats above, for this grid's own tiles. */}
      <div className="of-clip-teaser" style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "44px" }}>
            <SectionLabel>How it works</SectionLabel>
            <motion.h2 {...riseIn(reduceMotion)} style={{ fontFamily: SERIF, fontSize: "clamp(24px,3.5vw,30px)", color: G, fontWeight: 700, lineHeight: 1.2 }}>
              Your finances, mapped. Tailored steps to grow your wealth.<br />All, in 5 minutes.
            </motion.h2>
          </div>
          {/* Fixed 2x2 down to phone width, then a single column — a plain
              `repeat(2, 1fr)` never relaxes, so on a narrow screen it would
              just keep squeezing two columns rather than stacking them. */}
          <style>{`
            .how-it-works-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
            @media (max-width: 560px) {
              .how-it-works-grid { grid-template-columns: 1fr; }
            }
            @media (max-width: 768px) {
              .of-clip-stats, .of-clip-teaser, .of-clip-calc { overflow-x: hidden; }
            }
          `}</style>
          <div className="how-it-works-grid">
            {[
              { icon: ClipboardList, title: "Where you stand and where you're headed", body: "Share your current setup and targets, from salary and savings to buying a home or growing your investments. Rough estimates are fine, we'll do the maths." },
              { icon: Scale, title: "Your full financial picture, analysed", body: "We test your setup against UK tax traps, debt mechanics, and personal goals. Delivering an instant financial health score and a tailored plan." },
              { icon: Search, title: "See the £ value of every decision", body: "Walk through personalised actions, showing precisely how much each decision adds to your net worth." },
              { icon: Compass, title: "Guidance that grows with you", body: "Life isn't static. Whether you get a pay rise, buy a home, or start a family – Candid updates automatically, keeping your money on track." },
            ].map((step, i) => (
              <Tile key={step.title} ref={teaserRef(i)} {...pullTogether(i, 4, reduceMotion)} {...tileHover} style={{ borderTop: `4px solid ${GOLD}` }}>
                <div style={{ marginBottom: "16px" }}><step.icon size={26} color={G} /></div>
                <div style={{ fontFamily: SERIF, fontSize: "17px", color: G, fontWeight: 600, marginBottom: "10px" }}>{step.title}</div>
                <div style={{ fontSize: "14px", color: MUT, lineHeight: 1.7 }}>{step.body}</div>
              </Tile>
            ))}
          </div>
        </div>
      </div>

      {/* ── AREAS COVERED — one dark tile for contrast amid the light page ── */}
      <div style={{ padding: "0 24px 88px" }}>
        <motion.div {...riseIn(reduceMotion, { duration: 0.75 })} style={{
          maxWidth: "820px", margin: "0 auto", background: G, borderRadius: "24px",
          padding: "64px 40px", textAlign: "center",
        }}>
          <SectionLabel>What Candid covers</SectionLabel>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(26px,3.8vw,34px)", color: WHITE, fontWeight: 700, marginBottom: "36px", lineHeight: 1.25 }}>
            Every area of your finances, connected.
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center", marginBottom: "14px" }}>
            {["Pension & salary sacrifice", "ISA & investments", "Cash savings optimisation", "Student loan strategy", "Mortgage & debt"].map((area, i) => (
              <motion.div key={area} {...pullTogether(i, 5, reduceMotion, { stagger: 0.07, duration: 0.6, spreadPx: 26, riseYPx: 30 })} style={{
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "100px", padding: "11px 22px", fontSize: "16px", color: WHITE, fontWeight: 600,
              }}>{area}</motion.div>
            ))}
          </div>
          {/* Disclaimers — deliberately small and low-contrast so the module
              pills above (the actual content) stay the focus of this tile. */}
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "22px" }}>+ more areas depending on your situation</div>
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "18px",
            fontSize: "11px", color: "rgba(246,240,230,0.45)", lineHeight: 1.5, maxWidth: "440px", margin: "0 auto",
          }}>
            Guidance, not advice. Candid helps you understand your options – the decisions are always yours.
          </div>
        </motion.div>
      </div>

      {/* ── FREE CALCULATORS ── */}
      {/* .of-clip-calc — same off-screen entrance-animation overflow fix as
          .of-clip-stats/.of-clip-teaser above. Found while re-measuring after
          fixing those two: not one of the originally reported sections, but
          the identical bug (see the other .of-clip-* comments in this file). */}
      <div className="of-clip-calc" style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "44px" }}>
            <SectionLabel>Free calculators</SectionLabel>
            <motion.h2 {...riseIn(reduceMotion)} style={{ fontFamily: SERIF, fontSize: "clamp(24px,3.5vw,30px)", color: G, fontWeight: 700, lineHeight: 1.2 }}>
              Answer one question in 30 seconds.
            </motion.h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
            {[
              { href: "/student-loan-calculator.html", icon: GraduationCap, title: "Student loan overpayment calculator", body: "Plan 1, 2, 4, 5 & Postgraduate – find out if overpaying saves you money or just hands cash to the government that would've been written off." },
              { href: "/100k-tax-trap-calculator.html", icon: PoundSterling, title: "£100,000 tax trap & childcare cliff calculator", body: "Check the 60% marginal-rate zone and the childcare cliff, and see the exact pension sacrifice that fixes both at once." },
              { href: "/mortgage-vs-savings-calculator.html", icon: HomeIcon, title: "Mortgage overpayment vs high-yield savings", body: "When your fix ends, compare paying down the mortgage against a savings account or Cash ISA – tax accounted for." },
            ].map((tool, i) => (
              <motion.a key={tool.href} href={tool.href} ref={calcRef(i)} {...pullTogether(i, 3, reduceMotion)} {...tileHover} style={{
                background: WHITE, borderRadius: "18px", padding: "32px 28px", boxShadow: "0 4px 24px rgba(22,47,36,0.07)",
                borderTop: `4px solid ${GOLD}`, textDecoration: "none", display: "block",
              }}>
                <div style={{ marginBottom: "16px" }}><tool.icon size={26} color={G} /></div>
                <div style={{ fontFamily: SERIF, fontSize: "17px", color: G, fontWeight: 600, marginBottom: "10px" }}>{tool.title}</div>
                <div style={{ fontSize: "14px", color: MUT, lineHeight: 1.7 }}>{tool.body}</div>
              </motion.a>
            ))}
          </div>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div style={{ padding: "0 24px 96px", textAlign: "center" }}>
        <motion.h2 {...riseIn(reduceMotion)} style={{ fontFamily: SERIF, fontSize: "clamp(22px,3.5vw,28px)", color: G, fontWeight: 700, marginBottom: "28px", lineHeight: 1.3 }}>
          Be first to know when Candid launches.
        </motion.h2>
        <WaitlistForm source="final_cta" />
      </div>
    </NewSiteLayout>
  );
}
