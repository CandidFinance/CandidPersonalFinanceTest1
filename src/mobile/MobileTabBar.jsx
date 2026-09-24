import { Home, LayoutGrid, LineChart, MessageCircle } from "lucide-react";
import { G, MUT, WHITE } from "../CandidApp.jsx";

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
    // No border: the bar's top edge is fully transparent, not opaque CREAM,
    // so it melts into whatever is scrolled underneath it (the page's own
    // beige background, or a white tile) with a soft fade either way,
    // rather than a hard line only hidden when the background happens to
    // already be CREAM. Reaches solid white by 40% down the bar (not the
    // full height) so the tab icons/labels sit on a fully opaque surface
    // rather than a still-fading one, with just the top portion soft.
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:`linear-gradient(180deg, transparent 0%, ${WHITE} 40%)`,zIndex:4000,paddingBottom:"env(safe-area-inset-bottom, 0px)"}}>
      {/* The bar itself stays full-bleed, but the buttons are capped to the
          same 580px content width as MobileLayout's content column and
          centred — otherwise on a wide (desktop browser) viewport the icons
          spread out across the full window instead of the app's own screen
          width. */}
      <div style={{display:"flex",maxWidth:"580px",margin:"0 auto"}}>
        {MOBILE_NAV_ITEMS.map(item => {
          const isActive = item.key === active;
          return (
            <button key={item.key} type="button" onClick={() => onNavigate(item.path)} style={{
              flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"4px",
              background:"transparent", border:"none", padding:"10px 4px 8px", cursor:"pointer",
            }}>
              <item.icon size={20} color={isActive ? G : MUT} strokeWidth={isActive ? 2.4 : 2}/>
              <span style={{fontSize:"10px",fontWeight:isActive?700:500,color:isActive ? G : MUT}}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
