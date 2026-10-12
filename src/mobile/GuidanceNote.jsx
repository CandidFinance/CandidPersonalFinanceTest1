import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { G, MUT, TEXT, SERIF } from "../CandidApp.jsx";
import { CREAM } from "../design-tokens.js";

// Candid is guidance, not advice, said where people read their figures:
// briefly as a module page opens (GuidanceIntro), then once more at the foot
// of the page (GuidanceFooter), out of the way of the figures themselves.
// The fuller version is the "What Candid is and isn't" page.

export const GUIDANCE_PAGE = "/what-candid-is";

// Free, impartial help, shown at the foot of the modules where people most
// often go on to take advice. Checked 12 October 2026.
const ADVISER_HELP = { label: "Choosing a regulated adviser", href: "https://www.moneyhelper.org.uk/en/getting-help-and-advice/financial-advisers/choosing-a-financial-adviser" };
const SIGNPOSTS = {
  pension: [
    { label: "Pension Wise (free, 50 and over)", href: "https://www.moneyhelper.org.uk/en/pensions-and-retirement/pension-wise" },
    { label: "MoneyHelper on pensions", href: "https://www.moneyhelper.org.uk/en/pensions-and-retirement" },
    ADVISER_HELP,
  ],
  investments: [
    { label: "MoneyHelper on investing", href: "https://www.moneyhelper.org.uk/en/savings/investing" },
    ADVISER_HELP,
  ],
};
export const ADVISER_LINK = ADVISER_HELP;

// Over the page as it opens: the page fades in from behind it. 1.8
// seconds in all, and skipped for anyone who has asked for less motion.
const INTRO_MS = 1800;
export function GuidanceIntro() {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(!reduce);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(false), INTRO_MS);
    return () => clearTimeout(t);
  }, [shown]);
  if (!shown) return null;
  return (
    // A tap ends it early, rather than landing on the page still hidden under it.
    <motion.div aria-hidden="true" onClick={() => setShown(false)}
      initial={{ opacity: 1 }} animate={{ opacity: [1, 1, 0] }} transition={{ duration: INTRO_MS / 1000, times: [0, 0.75, 1], ease: "easeOut" }}
      style={{ position: "fixed", inset: 0, zIndex: 4800, background: CREAM, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, 0] }} transition={{ duration: INTRO_MS / 1000, times: [0, 0.15, 0.7, 0.85] }}
        style={{ textAlign: "center" }}>
        <div style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: G }}>Guidance, not advice</div>
        <div style={{ fontSize: "14px", color: TEXT, marginTop: "6px" }}>Candid does the maths on your figures. The choices are yours.</div>
      </motion.div>
    </motion.div>
  );
}

// At the foot of a module page, below everything else.
export function GuidanceFooter({ moduleKey }) {
  const links = SIGNPOSTS[moduleKey] || [];
  const link = { color: MUT, fontWeight: 600 };
  return (
    <div style={{ borderTop: "1px solid rgba(22,47,36,0.1)", marginTop: "26px", paddingTop: "14px", fontSize: "11.5px", color: MUT, lineHeight: 1.55 }}>
      <p style={{ margin: 0 }}>
        Guidance, not advice. Candid works out what each option is worth on the figures you've given it, with no stake in what you choose. It doesn't know everything about your situation, so the decision is yours. <Link to={GUIDANCE_PAGE} style={link}>What Candid is and isn't</Link>
      </p>
      {links.length > 0 && (
        <p style={{ margin: "8px 0 0" }}>
          Free, impartial help:{" "}
          {links.map((l, i) => (
            <span key={l.href}>{i > 0 && " · "}<a href={l.href} target="_blank" rel="noopener noreferrer" style={link}>{l.label}</a></span>
          ))}
        </p>
      )}
    </div>
  );
}
