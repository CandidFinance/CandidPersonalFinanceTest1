import { Home, LayoutGrid, LineChart, MessageCircle } from "lucide-react";

// Single source of truth for the mobile app's own bottom nav — deliberately
// separate from desktop's NAV_ITEMS (CandidApp.jsx) rather than reusing it,
// since /app/* routes are a distinct tree from /dashboard, /modules, etc.
export const MOBILE_NAV_ITEMS = [
  { key:"home", label:"Home", path:"/app/home", icon:Home },
  { key:"modules", label:"Modules", path:"/app/modules", icon:LayoutGrid },
  { key:"forecast", label:"Forecast", path:"/app/forecast", icon:LineChart },
  { key:"chat", label:"Chat", path:"/app/chat", icon:MessageCircle },
];

export default function MobileTabBar({ active, onNavigate }) {
  return (
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"#162f24",borderTop:"1px solid rgba(255,255,255,0.12)",display:"flex",zIndex:4000,paddingBottom:"env(safe-area-inset-bottom, 0px)"}}>
      {MOBILE_NAV_ITEMS.map(item => {
        const isActive = item.key === active;
        return (
          <button key={item.key} type="button" onClick={() => onNavigate(item.path)} style={{
            flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"4px",
            background:"transparent", border:"none", padding:"10px 4px 8px", cursor:"pointer",
          }}>
            <item.icon size={20} color={isActive ? "#c4963a" : "rgba(255,255,255,0.55)"} strokeWidth={isActive ? 2.4 : 2}/>
            <span style={{fontSize:"10px",fontWeight:isActive?700:500,color:isActive ? "#c4963a" : "rgba(255,255,255,0.55)"}}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
