import { useNavigate } from "react-router-dom";
import { NavBar } from "../NavBar.jsx";
import { CREAM, G, GOLD, MUT } from "../design-tokens.js";
import MobileTabBar, { MOBILE_NAV_ITEMS } from "./MobileTabBar.jsx";
import { SignInGate } from "./SignInSetup.jsx";

// Shell for every /app/* mobile screen: a light NavBar (the "Candid."
// wordmark on the left, above the bar's hairline, plus an optional page-
// specific action on the right — see NavBar's `light` mode) and a scrollable
// content area above the fixed mobile tab bar. `pageLabel` is set on every
// screen below the tabs (a module, Property, Your inputs) and left unset on
// the 4 tab screens themselves, where the tab bar already says where you are.
export default function MobileLayout({ pageLabel, activeTab, headerRight, assist = null, children }) {
  const navigate = useNavigate();
  return (
    <div style={{minHeight:"100vh",background:CREAM,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      {/* Keyframes for the "reviewed" coins and Home score gain. Desktop gets
          the same ones from PageWrap's stylesheet, which this layout doesn't use. */}
      <style>{`
        @keyframes coinFloat{0%{opacity:1;transform:translateY(0) scale(1);}100%{opacity:0;transform:translateY(-40px) scale(1.3);}}
        @keyframes btnGoldTint{0%{background:transparent;}40%{background:rgba(196,150,58,0.35);}100%{background:transparent;}}
        @keyframes badgeFadeUp{0%{opacity:0;transform:translateY(8px);}20%{opacity:1;transform:translateY(0);}70%{opacity:1;transform:translateY(0);}100%{opacity:0;transform:translateY(-6px);}}
      `}</style>
      {/* From 1000px wide (a desktop browser): the tabs move under the
          header, the bottom bar goes, and the column widens. */}
      <style>{`
        .app-desktop-tabs { display: none; }
        @media (min-width: 1000px) {
          [data-tab-bar] { display: none !important; }
          .app-desktop-tabs { display: flex; }
          .app-content { max-width: 720px !important; padding-bottom: 56px !important; }
          .app-navbar-inner { max-width: 720px !important; }
        }
      `}</style>
      <NavBar light center={pageLabel} right={headerRight} onLogoClick={() => navigate("/app/home")} />
      <nav className="app-desktop-tabs" aria-label="App" style={{gap:"28px",maxWidth:"720px",width:"100%",margin:"0 auto",padding:"4px 20px 0",boxSizing:"border-box"}}>
        {MOBILE_NAV_ITEMS.map(item => (
          <button key={item.key} type="button" onClick={() => navigate(item.path)} style={{
            background:"none", border:"none", padding:"6px 0", cursor:"pointer", fontFamily:"inherit",
            fontSize:"14px", fontWeight:600, color:item.key === activeTab ? G : MUT,
            borderBottom:`2px solid ${item.key === activeTab ? GOLD : "transparent"}`,
          }}>{item.label}</button>
        ))}
      </nav>
      {/* 120px at the bottom on a phone: room past the tab bar and the
          Assist button, so the last card scrolls clear of both. */}
      <div className="app-content" style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",paddingBottom:"120px",width:"100%",boxSizing:"border-box"}}>
        {children}
      </div>
      <MobileTabBar active={activeTab} onNavigate={navigate} />
      {assist}
      {/* A subscriber without a passkey or password sets one up first. */}
      <SignInGate/>
    </div>
  );
}
