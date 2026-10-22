import { Home, Target, LayoutGrid, LineChart, MessageCircle } from "lucide-react";
import { G, MUT, WHITE } from "../design-tokens.js";
import NewBadge, { rateUpdatesLabel } from "./NewBadge.jsx";
import { useCashNews } from "./visitNews.js";

// Single source of truth for the app's bottom nav.
export const MOBILE_NAV_ITEMS = [
  { key:"home", label:"Home", path:"/app/home", icon:Home },
  { key:"progress", label:"Progress", path:"/app/progress", icon:Target },
  { key:"modules", label:"Modules", path:"/app/modules", icon:LayoutGrid },
  { key:"forecast", label:"Forecast", path:"/app/forecast", icon:LineChart },
  { key:"chat", label:"Chat", path:"/app/chat", icon:MessageCircle },
];

export default function MobileTabBar({ active, onNavigate }) {
  // Best rates moved for them since the last visit: a red badge on Modules
  // until they open Cash (visitNews.js).
  const news = useCashNews();
  const badge = news && !news.opened ? news.count : 0;
  return (
    // No border: the bar's top edge is fully transparent, not opaque CREAM,
    // so it melts into whatever is scrolled underneath it (the page's own
    // beige background, or a white tile) with a soft fade either way,
    // rather than a hard line only hidden when the background happens to
    // already be CREAM. Reaches solid white by 40% down the bar (not the
    // full height) so the tab icons/labels sit on a fully opaque surface
    // rather than a still-fading one, with just the top portion soft.
    // data-tab-bar: walk-throughs measure it to keep questions clear of it.
    <nav data-tab-bar style={{position:"fixed",bottom:0,left:0,right:0,background:`linear-gradient(180deg, transparent 0%, ${WHITE} 40%)`,zIndex:4000,paddingBottom:"env(safe-area-inset-bottom, 0px)"}}>
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
              <span style={{position:"relative",display:"flex"}}>
                <item.icon size={20} color={isActive ? G : MUT} strokeWidth={isActive ? 2.4 : 2}/>
                {item.key === "modules" && <NewBadge count={badge} label={rateUpdatesLabel(badge)} style={{top:"-7px",right:"-12px",minWidth:"18px",height:"18px",lineHeight:"18px",fontSize:"10.5px",padding:"0 5px"}}/>}
              </span>
              <span style={{fontSize:"10px",fontWeight:isActive?700:500,color:isActive ? G : MUT}}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
