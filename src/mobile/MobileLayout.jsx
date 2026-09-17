import { useNavigate } from "react-router-dom";
import { NavBar } from "../CandidApp.jsx";
import MobileTabBar from "./MobileTabBar.jsx";

// Shell for every /app/* mobile screen: shared <NavBar> header (per the
// design-language rule that every page carries the identical Candid header +
// page label, with an optional page-specific action in its right slot) and a
// scrollable content area above the fixed mobile tab bar.
export default function MobileLayout({ pageLabel, activeTab, headerRight, children }) {
  const navigate = useNavigate();
  return (
    <div style={{minHeight:"100vh",background:"#f6f0e6",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <NavBar center={pageLabel} onLogoClick={() => navigate("/app/home")} right={headerRight} />
      <div style={{flex:1,maxWidth:"580px",margin:"0 auto",padding:"24px 20px",paddingBottom:"90px",width:"100%"}}>
        {children}
      </div>
      <MobileTabBar active={activeTab} onNavigate={navigate} />
    </div>
  );
}
