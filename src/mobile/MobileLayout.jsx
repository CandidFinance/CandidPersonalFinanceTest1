import { useNavigate } from "react-router-dom";
import { NavBar, G, SERIF } from "../CandidApp.jsx";
import MobileTabBar from "./MobileTabBar.jsx";

// Shell for every /app/* mobile screen: a bare NavBar (safe-area spacer +
// optional page-specific action in its right slot — see NavBar's `light`
// mode) and a scrollable content area above the fixed mobile tab bar. The
// "Candid." wordmark lives here instead, as the first thing in the content
// column — left-aligned with every tile/card below it, like a native app's
// own in-content branding rather than a system-chrome bar. `pageLabel` is
// optional and currently unset everywhere: the tab bar shows which of the 4
// tab-bar screens is active, and a module deep dive already carries its own
// title heading in its content, so a nav-bar title would just repeat it.
export default function MobileLayout({ pageLabel, activeTab, headerRight, children }) {
  const navigate = useNavigate();
  return (
    <div style={{minHeight:"100vh",background:"#f6f0e6",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <NavBar light center={pageLabel} right={headerRight} />
      <div style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",paddingBottom:"90px",width:"100%"}}>
        <button type="button" onClick={() => navigate("/app/home")} style={{fontFamily:SERIF,color:G,fontSize:"20px",fontWeight:700,background:"none",border:"none",padding:0,marginBottom:"18px",cursor:"pointer",display:"block"}}>Candid.</button>
        {children}
      </div>
      <MobileTabBar active={activeTab} onNavigate={navigate} />
    </div>
  );
}
