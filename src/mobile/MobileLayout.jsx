import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { NavBar } from "../NavBar.jsx";
import { CREAM, G, GOLD, MUT } from "../design-tokens.js";
import MobileTabBar, { MOBILE_NAV_ITEMS, BAR_ORDER } from "./MobileTabBar.jsx";
import { SignInGate } from "./SignInSetup.jsx";
import PremiumButton from "./Premium.jsx";
import AccountButton from "./Account.jsx";

// Shell for every /app/* mobile screen: a scrollable content column above
// the floating tab bar (MobileTabBar). Only Home has a top bar: the Account
// button and Candid Premium's crown on the left (no wordmark: users know
// they're in the app) and `headerRight` (Edit inputs) on the right. Every
// other screen starts at the top of the page for more room; its
// `headerRight` (a module's edit button, Your inputs' Done) floats in the
// top-right corner without a bar. `pageLabel` (a module, Property, Your
// inputs) is kept for screen readers and analytics but not shown.
// `d`: their answers, for the crown.
// `pageKey`: which page is showing; with `fadeIn` (the app's tour, moving
// between tabs), each new page fades in and rises a little as it comes.
// Moving between tabs, the new page slides in from the side its tab sits.

// The tab last shown, across remounts (each tab screen may be its own tree).
let shownTab = null;

// Hidden on screen, still in the page for screen readers and analytics.
const VISUALLY_HIDDEN = { position:"absolute", width:"1px", height:"1px", padding:0, margin:"-1px", overflow:"hidden", clip:"rect(0,0,0,0)", whiteSpace:"nowrap", border:0 };

function PageEnter({ tab, fadeIn, children }) {
  const reduce = useReducedMotion();
  const [from] = useState(() => {
    const a = BAR_ORDER.indexOf(shownTab), b = BAR_ORDER.indexOf(tab);
    return a < 0 || b < 0 || a === b ? 0 : b > a ? 1 : -1;
  });
  useEffect(() => { shownTab = tab; }, [tab]);
  const initial = reduce ? false : from ? { opacity: 0, x: from * 24 } : fadeIn ? { opacity: 0, y: 12 } : false;
  return (
    <motion.div initial={initial} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

export default function MobileLayout({ d = {}, pageLabel, activeTab, headerRight, assist = null, pageKey = null, fadeIn = false, children }) {
  const navigate = useNavigate();
  const home = activeTab === "home";
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
      {home && <NavBar light wordmark={false} right={headerRight} lead={<AccountButton/>} badge={<PremiumButton d={d}/>} />}
      {pageLabel && <span style={VISUALLY_HIDDEN}>{pageLabel}</span>}
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
          Assist button, so the last card scrolls clear of both. Without the
          top bar, the safe area at the top comes here instead. */}
      <div className="app-content" style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",paddingTop:home ? "24px" : "calc(16px + env(safe-area-inset-top, 0px))",paddingBottom:"120px",width:"100%",boxSizing:"border-box",position:"relative"}}>
        {!home && headerRight && (
          <div style={{position:"absolute",top:"calc(10px + env(safe-area-inset-top, 0px))",right:"14px",zIndex:5,display:"flex",alignItems:"center"}}>{headerRight}</div>
        )}
        <PageEnter key={pageKey ?? activeTab ?? "page"} tab={activeTab} fadeIn={fadeIn}>{children}</PageEnter>
      </div>
      <MobileTabBar active={activeTab} onNavigate={navigate} />
      {assist}
      {/* A subscriber without a passkey or password sets one up first. */}
      <SignInGate/>
    </div>
  );
}
