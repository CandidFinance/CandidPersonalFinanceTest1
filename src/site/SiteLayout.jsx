import { SANS, CREAM, WHITE } from "../design-tokens.js";
import SiteHeader, { HEADER_HEIGHT } from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";

// Shared shell for every /new page: the fixed hide-on-scroll header + tabs,
// and the footer. `children` is just that page's own content between the two.
// `background` lets a page already moved to the Statement design pass
// SITE_BG; the rest keep the cream-to-white gradient until their own pass.
export default function SiteLayout({ children, background = `linear-gradient(180deg, ${CREAM} 0%, ${WHITE} 60%, ${WHITE} 100%)` }) {
  return (
    <div style={{ background }}>
      {/* At least a screen tall, with the page's content taking up the
          slack, so on a short page (About, Sign in) the footer still sits
          at the bottom of the screen rather than partway up it. */}
      <div style={{ fontFamily: SANS, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <SiteHeader />
        {/* Reserves the header's own height — the header is `position: fixed`
            (so it can slide off-screen without leaving a permanent gap),
            which means it doesn't push this content down on its own. */}
        <div style={{ height: HEADER_HEIGHT, flexShrink: 0 }} />
        <main style={{ flex: 1 }}>{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
