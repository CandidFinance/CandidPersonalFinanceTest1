import { useEffect } from "react";
import SiteLayout from "./SiteLayout.jsx";

// About: Candid's aim, then Why and Who as ruled rows (.st-split, shared in
// SiteLayout.jsx). Rendered to HTML at build time too (scripts/prerender.js),
// so crawlers can read it; no entrance animations, so the pre-rendered page
// shows everything. Company details stay in the footer; the people behind
// Candid are "a team", never named.
const TILES = [
  {
    title: "Why",
    body: [
      "Managing your finances optimally is hard, time-consuming, and usually requires costly professional advice. Between pensions, ISAs, savings accounts, student loans, mortgages, and tax thresholds—like a pay rise pushing you past £100,000—the moving parts stack up quickly.",
      "To make matters worse, the goalposts keep moving. With every government budget, autumn statement, and tax review, allowance rules and thresholds change.",
      "The real challenge is that none of these pieces exist in isolation—every decision directly impacts the others. Unpicking how shifting rules interact across your whole balance sheet takes hours most people simply don't have. We built Candid to do the heavy lifting for you.",
    ],
  },
  {
    title: "Who",
    body: [
      "Candid is built by a team of passionate, experienced people who started out trying to solve their own problem. Now we want to share the solution.",
    ],
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
      {/* Why and Who as large Georgia words on desktop; the shared size on a phone. */}
      <style>{`
        @media (min-width: 761px) { .about-split h2 { font-size: clamp(40px, 4.7vw, 50px); line-height: 1.05; letter-spacing: -.025em; } }
      `}</style>
      <section className="st-section st-hero">
        <div className="st-label">About</div>
        <h1 className="st-h1">Built to stop you wasting thousands on financial blind spots</h1>
        <p className="st-lede">
          Our aim is simple: help people keep more of what they earn. We find the tax traps, idle cash and unused allowances costing you.
        </p>
      </section>
      <section className="st-section">
        {TILES.map(tile => (
          <div key={tile.title} className="st-split about-split">
            <h2>{tile.title}</h2>
            <div>
              {tile.body.map(para => <p key={para}>{para}</p>)}
            </div>
          </div>
        ))}
      </section>
    </SiteLayout>
  );
}
