import { useEffect } from "react";
import { SANS, GEORGIA, MONO, HIGHLIGHT, WHITE, SITE_BG, SITE_INK, SITE_MUTED, SITE_RULE } from "../design-tokens.js";
import SiteHeader, { HEADER_HEIGHT } from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";

// Shared shell for every site page: the fixed hide-on-scroll header + tabs,
// and the footer. `children` is just that page's own content between the two.
//
// SITE_CSS holds the "Statement" design's shared pieces (design/landing/
// BRIEF.md), so each page only styles what's its own:
//   .st              wrapper: ink text, and the cyan <mark> (one word a page, at most)
//   .st-section      centred 1040px column with the gap below each section
//   .st-hero         a page's opening: .st-label, .st-h1, .st-lede
//   .st-label        mono uppercase kicker above a heading
//   .st-h1 / .st-h2  Georgia headings
//   .st-intro        label + heading block above a section's content
//   .st-rows         numbered rows on hairline rules: number, title, body
//   .st-split        heading on the left, text on the right, under an ink rule
//   .st-small        quiet footnote text
//   .st-final        the closing heading + start button
//   .st-sr           text for screen readers only (e.g. "opens in a new tab")
const SITE_CSS = `
  .st { color: ${SITE_INK}; }
  .st mark { background: linear-gradient(transparent 12%, ${HIGHLIGHT} 12%, ${HIGHLIGHT} 92%, transparent 92%); color: inherit; padding: 0 .08em; }
  .st a.st-link { color: ${SITE_INK}; font-weight: 600; text-decoration: underline; text-decoration-color: ${SITE_RULE}; text-underline-offset: 3px; text-decoration-thickness: 2px; }
  .st a.st-link:hover { text-decoration-color: ${SITE_INK}; }
  .st-section { max-width: 1040px; margin: 0 auto; padding: 0 24px 104px; box-sizing: border-box; }
  .st-hero { padding-top: 72px; padding-bottom: 80px; }
  .st-label { font: 500 11px/1 ${MONO}; letter-spacing: .1em; text-transform: uppercase; color: ${SITE_MUTED}; margin-bottom: 16px; }
  .st-h1 { font: 700 clamp(36px, 6vw, 64px)/1.04 ${GEORGIA}; letter-spacing: -.025em; color: ${SITE_INK}; margin: 0; max-width: 900px; text-wrap: balance; }
  .st-h2 { font: 700 clamp(28px, 4vw, 40px)/1.12 ${GEORGIA}; letter-spacing: -.02em; color: ${SITE_INK}; margin: 0; text-wrap: balance; }
  .st-lede { font-size: clamp(16px, 1.8vw, 19px); line-height: 1.65; color: ${SITE_MUTED}; margin: 24px 0 0; max-width: 640px; }
  .st-intro { margin-bottom: 44px; max-width: 720px; }
  .st-small { font-size: 13px; line-height: 1.6; color: ${SITE_MUTED}; margin: 16px 0 0; }

  .st-rows { list-style: none; margin: 0; padding: 0; border-top: 1px solid ${SITE_INK}; }
  .st-rows > li { display: grid; grid-template-columns: 56px minmax(0, 5fr) minmax(0, 7fr); gap: 0 40px; padding: 28px 0 32px; border-bottom: 1px solid ${SITE_RULE}; }
  .st-rows .st-n { font: 500 13px/1.7 ${MONO}; color: ${SITE_MUTED}; }
  .st-rows h3 { font: 700 clamp(20px, 2.2vw, 24px)/1.25 ${GEORGIA}; margin: 0; }
  .st-rows p { font-size: 15.5px; line-height: 1.7; color: ${SITE_MUTED}; margin: 0; }

  .st-split { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 8fr); gap: 0 56px; padding: 28px 0 40px; border-top: 1px solid ${SITE_INK}; }
  .st-split + .st-split { border-top-color: ${SITE_RULE}; }
  .st-split h2 { font: 700 clamp(22px, 2.6vw, 28px)/1.2 ${GEORGIA}; letter-spacing: -.01em; margin: 0; }
  .st-split p, .st-split li { font-size: 16px; line-height: 1.7; color: ${SITE_INK}; }
  .st-split p { margin: 0 0 14px; }
  .st-split p:last-child { margin-bottom: 0; }
  .st-split ul { list-style: none; margin: 0; padding: 0; }
  .st-split li { position: relative; padding-left: 22px; margin-bottom: 10px; }
  .st-split li::before { content: ""; position: absolute; left: 0; top: .8em; width: 10px; border-top: 1px solid ${SITE_INK}; }

  .st-skip { position: fixed; top: 12px; left: 12px; z-index: 60; padding: 12px 18px; border-radius: 12px; background: ${SITE_INK}; color: ${WHITE};
    font-weight: 600; text-decoration: none; transform: translateY(-200%); }
  .st-skip:focus { transform: none; }
  main:focus { outline: none; }
  .st-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

  .st-final { text-align: center; padding: 0 24px 112px; }
  .st-final .st-h2 { margin-bottom: 28px; }

  @media (max-width: 760px) {
    .st-section { padding-bottom: 80px; }
    .st-hero { padding-top: 48px; padding-bottom: 56px; }
    .st-intro { margin-bottom: 32px; }
    .st-rows > li { grid-template-columns: 40px minmax(0, 1fr); gap: 8px 0; }
    .st-rows > li > p { grid-column: 2; }
    .st-split { grid-template-columns: minmax(0, 1fr); gap: 14px; padding-bottom: 32px; }
  }
`;

// `title` is the browser tab's title for this page; the home page leaves it
// out and keeps index.html's own.
export default function SiteLayout({ title, children }) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);

  return (
    <div style={{ background: SITE_BG }}>
      <style>{SITE_CSS}</style>
      {/* First thing Tab reaches: jumps past the header to the page itself. */}
      <a href="#main" className="st-skip" onClick={e => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      {/* At least a screen tall, with the page's content taking up the
          slack, so on a short page (About, Sign in) the footer still sits
          at the bottom of the screen rather than partway up it. */}
      <div style={{ fontFamily: SANS, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <SiteHeader />
        {/* Reserves the header's own height — the header is `position: fixed`
            (so it can slide off-screen without leaving a permanent gap),
            which means it doesn't push this content down on its own. */}
        <div style={{ height: HEADER_HEIGHT, flexShrink: 0 }} />
        <main id="main" tabIndex={-1} className="st" style={{ flex: 1 }}>{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
