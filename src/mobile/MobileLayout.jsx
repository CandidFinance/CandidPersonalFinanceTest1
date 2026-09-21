import { useNavigate } from "react-router-dom";
import { NavBar } from "../CandidApp.jsx";
import MobileTabBar from "./MobileTabBar.jsx";

// Shell for every /app/* mobile screen: a light NavBar (the "Candid."
// wordmark on the left, above the bar's hairline, plus an optional page-
// specific action on the right — see NavBar's `light` mode) and a scrollable
// content area above the fixed mobile tab bar. `pageLabel` is
// optional and currently unset everywhere: the tab bar shows which of the 4
// tab-bar screens is active, and a module deep dive already carries its own
// title heading in its content, so a nav-bar title would just repeat it.
export default function MobileLayout({ pageLabel, activeTab, headerRight, children }) {
  const navigate = useNavigate();
  return (
    <div style={{minHeight:"100vh",background:"#f6f0e6",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      {/* Keyframes for the "reviewed" coins and Home score gain. Desktop gets
          the same ones from PageWrap's stylesheet, which this layout doesn't use. */}
      <style>{`
        @keyframes coinFloat{0%{opacity:1;transform:translateY(0) scale(1);}100%{opacity:0;transform:translateY(-40px) scale(1.3);}}
        @keyframes btnGoldTint{0%{background:transparent;}40%{background:rgba(196,150,58,0.35);}100%{background:transparent;}}
        @keyframes badgeFadeUp{0%{opacity:0;transform:translateY(8px);}20%{opacity:1;transform:translateY(0);}70%{opacity:1;transform:translateY(0);}100%{opacity:0;transform:translateY(-6px);}}
      `}</style>
      <NavBar light center={pageLabel} right={headerRight} onLogoClick={() => navigate("/app/home")} />
      <div style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",paddingBottom:"90px",width:"100%"}}>
        {children}
      </div>
      <MobileTabBar active={activeTab} onNavigate={navigate} />
    </div>
  );
}
