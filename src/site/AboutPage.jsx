import { useEffect } from "react";
import { G, GOLD, MUT, WHITE, SERIF, RADIUS_MODAL } from "../design-tokens.js";
import SiteLayout from "./SiteLayout.jsx";

// About: Candid's aim, then Why and Who side by side. Rendered to HTML at
// build time too (scripts/prerender.js), so crawlers can read it. Company
// details stay in the footer; the people behind Candid are "a team", never
// named.
const TILES = [
  {
    title: "Why",
    body: "Pension, ISA, savings, student loan, mortgage, a bonus, a pay rise that edges you past £100,000… each decision affects the others. Unpicking all of it to see what your money could really be doing is hard, and most people never get the time.",
  },
  {
    title: "Who",
    body: "Candid is built by a team of passionate, experienced people who started out trying to solve their own problem. Now we want to share the solution.",
  },
];

export default function AboutPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = "About | Candid";
    return () => { document.title = previous; };
  }, []);
  return (
    <SiteLayout>
      <style>{`
        .about-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 760px) { .about-tiles { grid-template-columns: 1fr; } }
      `}</style>
      <section style={{ maxWidth: "960px", margin: "0 auto", padding: "64px 24px 96px", boxSizing: "border-box" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto 48px", textAlign: "center" }}>
          <h1 style={{ fontFamily: SERIF, fontSize: "clamp(30px,4.6vw,46px)", fontWeight: 700, color: G, lineHeight: 1.15, letterSpacing: "-0.01em", margin: 0 }}>
            Candid is being built to help stop you from losing thousands you didn't know you were wasting.
          </h1>
          <p style={{ fontSize: "clamp(15px,2vw,18px)", color: MUT, lineHeight: 1.7, margin: "20px auto 0", maxWidth: "620px" }}>
            Our aim is simple: help people keep more of what they earn. We find the tax traps, idle cash and unused allowances costing you.
          </p>
        </div>
        <div className="about-tiles">
          {TILES.map(tile => (
            <div key={tile.title} style={{
              background: WHITE, borderRadius: RADIUS_MODAL, padding: "32px 28px",
              boxShadow: "0 4px 24px rgba(22,47,36,0.07)", borderTop: `4px solid ${GOLD}`,
            }}>
              <h2 style={{ fontFamily: SERIF, fontSize: "26px", fontWeight: 700, color: G, margin: 0 }}>{tile.title}</h2>
              <p style={{ fontSize: "15px", color: MUT, lineHeight: 1.7, margin: "12px 0 0" }}>{tile.body}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
