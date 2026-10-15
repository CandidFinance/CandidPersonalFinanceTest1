import { SANS, CREAM, WHITE } from "../design-tokens.js";
import SiteHeader, { HEADER_HEIGHT } from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";

// Shared shell for every /new page: the fixed hide-on-scroll header + tabs,
// and the footer. `children` is just that page's own content between the two.
export default function SiteLayout({ children }) {
  return (
    <div style={{ background: `linear-gradient(180deg, ${CREAM} 0%, ${WHITE} 60%, ${WHITE} 100%)` }}>
      <div style={{ fontFamily: SANS }}>
        <SiteHeader />
        {/* Reserves the header's own height — the header is `position: fixed`
            (so it can slide off-screen without leaving a permanent gap),
            which means it doesn't push this content down on its own. */}
        <div style={{ height: HEADER_HEIGHT }} />
        {children}
        <SiteFooter />
      </div>
    </div>
  );
}
