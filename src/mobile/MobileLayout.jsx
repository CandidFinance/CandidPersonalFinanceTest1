import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { NavBar } from "../NavBar.jsx";
import { CREAM, G, GOLD, MUT } from "../design-tokens.js";
import MobileTabBar, { MOBILE_NAV_ITEMS } from "./MobileTabBar.jsx";
import { SignInGate } from "./SignInSetup.jsx";
import PremiumButton from "./Premium.jsx";
import AccountButton from "./Account.jsx";

// Shell for every /app/* mobile screen: a light NavBar (the "Candid."
// wordmark on the left, above the bar's hairline, plus an optional page-
// specific action on the right — see NavBar's `light` mode) and a scrollable
// content area above the fixed mobile tab bar. `pageLabel` is set on every
// screen below the tabs (a module, Property, Your inputs) and left unset on
// the tab screens themselves, where the tab bar already says where you are.
// `d`: their answers, for Candid Premium's crown beside the wordmark.
// `pageKey`: which page is showing; with `fadeIn` (the app's tour, moving
// between tabs), each new page fades in and rises a little as it comes.
export default function MobileLayout({ d = {}, pageLabel, activeTab, headerRight, assist = null, pageKey = null, fadeIn = false, children }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  return (
    <div style={{minHeight:"100vh",background:CREAM,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      {/* Keyframes for the "reviewed" coins and Home score gain. Desktop gets
          the same ones from PageWrap's stylesheet, which this layout doesn't use. */}
      <style>{`
        @keyframes coinFloat{0%{opacity:0;transform:translateY(4px) scale(0.85);}18%{opacity:1;transform:translateY(-6px) scale(1);}65%{opacity:1;transform:translateY(-34px) scale(1.15);}100%{opacity:0;transform:translateY(-54px) scale(1.25);}}
        @keyframes btnGoldTint{0%{background:transparent;}35%{background:rgba(196,150,58,0.3);}60%{background:rgba(196,150,58,0.3);}100%{background:transparent;}}
        @keyframes reviewedIn{0%{opacity:0;transform:translateY(3px);}100%{opacity:1;transform:translateY(0);}}
        @keyframes badgeFadeUp{0%{opacity:0;transform:translateY(8px);}20%{opacity:1;transform:translateY(0);}70%{opacity:1;transform:translateY(0);}100%{opacity:0;transform:translateY(-6px);}}
      `}</style>
      {/* From 1000px wide (a desktop browser): the tabs move under the
          header, the bottom bar goes, and the column widens. */}
      <style>{`
        .app-desktop-tabs { display: none; }
        @media (min-width: 1000px) {
          [data-tab-bar] { display: none !important; }
          .app-desktop-tabs { display: flex; }
          .app-content { max-width: 720px !important; padding-bottom: 56px !important; --hero-figure: 60px; }
          .app-navbar-inner { max-width: 720px !important; }
        }
      `}</style>
      <NavBar light center={pageLabel} right={headerRight} lead={<AccountButton/>} badge={<PremiumButton d={d}/>} onLogoClick={() => navigate("/app/home")} />
      <nav className="app-desktop-tabs" aria-label="App" style={{gap:"28px",maxWidth:"720px",width:"100%",margin:"0 auto",padding:"4px 20px 0",boxSizing:"border-box"}}>
        {MOBILE_NAV_ITEMS.map(item => (
          <button key={item.key} type="button" data-tour={`tab-${item.key}`} onClick={() => navigate(item.path)} style={{
            background:"none", border:"none", padding:"6px 0", cursor:"pointer", fontFamily:"inherit",
            fontSize:"14px", fontWeight:600, color:item.key === activeTab ? G : MUT,
            borderBottom:`2px solid ${item.key === activeTab ? GOLD : "transparent"}`,
          }}>{item.label}</button>
        ))}
      </nav>
      {/* 120px at the bottom on a phone: room past the tab bar and the
          Assist button, so the last card scrolls clear of both. */}
      <div className="app-content" style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",paddingBottom:"120px",width:"100%",boxSizing:"border-box"}}>
        {pageKey == null ? children : (
          <motion.div key={pageKey} initial={fadeIn && !reduce ? { opacity: 0, y: 12 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}>
            {children}
          </motion.div>
        )}
      </div>
      <MobileTabBar active={activeTab} onNavigate={navigate} />
      {assist}
      {/* A subscriber without a passkey or password sets one up first. */}
      <SignInGate/>
    </div>
  );
}
