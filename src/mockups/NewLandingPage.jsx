import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, useInView, animate } from "framer-motion";
import { ClipboardList, Scale, Search, Compass, GraduationCap, PoundSterling, Home as HomeIcon } from "lucide-react";
import posthog from "posthog-js";
import { G, GOLD, WHITE, MUT, SERIF } from "../CandidApp.jsx";
import NewSiteLayout from "./NewSiteLayout.jsx";
import WaitlistForm from "./WaitlistForm.jsx";
import { EASE_STEADY, riseIn, pullTogether, heroStagger, heroItem } from "./motion.js";

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
  const match = String(str).match(/^([^\d]*)([\d,.]+)([^\d]*)$/);
  if (!match) return { prefix: "", target: 0, suffix: String(str), decimals: 0, hasComma: false };
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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? parsed.target : 0);
  useEffect(() => {
    if (!isInView) return;
    if (reduceMotion) { setDisplay(parsed.target); return; }
    const controls = animate(0, parsed.target, { duration: 0.9, ease: EASE_STEADY, onUpdate: setDisplay });
    return () => controls.stop();
  }, [isInView, parsed.target, reduceMotion]);
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
function Tile({ children, style, ...motionProps }) {
  return (
    <motion.div {...motionProps} style={{
      background: WHITE, borderRadius: "18px", padding: "32px 28px",
      boxShadow: "0 4px 24px rgba(22,47,36,0.07)", ...style,
    }}>
      {children}
    </motion.div>
  );
}

export default function NewLandingPage() {
  const reduceMotion = useReducedMotion();

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
            Candid finds the gaps, inefficiencies and missed allowances costing you thousands — then shows you exactly what to do. Join the waitlist to be first in when we launch.
          </motion.p>
          <motion.div variants={heroItem}>
            <WaitlistForm id="waitlist" source="hero" />
            <div style={{ fontSize: "12px", color: MUT, marginTop: "14px" }}>No spam. One email, the day we launch.</div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── PROBLEM STATS ── */}
      <div style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", textAlign: "center" }}>
          <motion.h2 {...riseIn(reduceMotion)} style={{ fontFamily: SERIF, fontSize: "clamp(24px,3.5vw,30px)", color: G, fontWeight: 700, lineHeight: 1.25, marginBottom: "40px" }}>
            Good income. Good career.<br />Still losing thousands.
          </motion.h2>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { n: "£4,200", label: "avg annual pension tax relief unclaimed" },
              { n: "£680", label: "left on the table in savings yield gaps" },
              { n: "6.5m", label: "higher-rate taxpayers in the UK" },
            ].map((chip, i) => (
              <Tile key={chip.n} {...pullTogether(i, 3, reduceMotion)} style={{ textAlign: "center", minWidth: "160px", flex: "1 1 160px", maxWidth: "220px", padding: "24px 20px" }}>
                <div style={{ fontFamily: SERIF, fontSize: "28px", fontWeight: 700, color: GOLD, lineHeight: 1, marginBottom: "8px" }}>
                  <CountUpStat value={chip.n} />
                </div>
                <div style={{ fontSize: "13px", color: MUT, lineHeight: 1.4 }}>{chip.label}</div>
              </Tile>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS (teaser — the full "How it works" tab has more detail) ── */}
      <div style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "44px" }}>
            <SectionLabel>How it works</SectionLabel>
            <motion.h2 {...riseIn(reduceMotion)} style={{ fontFamily: SERIF, fontSize: "clamp(24px,3.5vw,30px)", color: G, fontWeight: 700, lineHeight: 1.2 }}>
              Your complete financial picture, in 5 minutes.
            </motion.h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "24px" }}>
            {[
              { icon: ClipboardList, title: "Tell us about your finances", body: "Salary, savings, pension, debts, as they stand today. Approximate figures are fine — no need to have anything optimised first." },
              { icon: Scale, title: "We analyse your whole position", body: "A trade-off analysis against the UK's actual tax rules, weighed against your goals — the outcome is a health score and clear next steps." },
              { icon: Search, title: "Deep-dive guidance", body: "Walk through each area of your finances with specific, prioritised actions and their £ impact, calculated from your actual numbers." },
              { icon: Compass, title: "Ongoing, as things change", body: "A pay rise, a house move, a growing family — the guidance keeps up with your position, not just on day one." },
            ].map((step, i) => (
              <Tile key={step.title} {...pullTogether(i, 4, reduceMotion)} {...tileHover} style={{ borderTop: `4px solid ${GOLD}` }}>
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
            Guidance, not advice. Candid helps you understand your options — the decisions are always yours.
          </div>
        </motion.div>
      </div>

      {/* ── FREE CALCULATORS ── */}
      <div style={{ padding: "0 24px 88px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "44px" }}>
            <SectionLabel>Free calculators</SectionLabel>
            <motion.h2 {...riseIn(reduceMotion)} style={{ fontFamily: SERIF, fontSize: "clamp(24px,3.5vw,30px)", color: G, fontWeight: 700, lineHeight: 1.2 }}>
              Answer one question in 30 seconds.
            </motion.h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
            {[
              { href: "/student-loan-calculator.html", icon: GraduationCap, title: "Student loan overpayment calculator", body: "Plan 1, 2, 4, 5 & Postgraduate — find out if overpaying saves you money or just hands cash to the government that would've been written off." },
              { href: "/100k-tax-trap-calculator.html", icon: PoundSterling, title: "£100,000 tax trap & childcare cliff calculator", body: "Check the 60% marginal-rate zone and the childcare cliff, and see the exact pension sacrifice that fixes both at once." },
              { href: "/mortgage-vs-savings-calculator.html", icon: HomeIcon, title: "Mortgage overpayment vs high-yield savings", body: "When your fix ends, compare paying down the mortgage against a savings account or Cash ISA — tax accounted for." },
            ].map((tool, i) => (
              <motion.a key={tool.href} href={tool.href} {...pullTogether(i, 3, reduceMotion)} {...tileHover} style={{
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
