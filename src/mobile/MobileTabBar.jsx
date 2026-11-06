import { Home, Target, LayoutGrid, LineChart, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { G, MUT, HERO_TILE_BG } from "../design-tokens.js";
import NewBadge, { rateUpdatesLabel } from "./NewBadge.jsx";
import { useCashNews } from "./visitNews.js";

// Single source of truth for the app's nav: the order here is the desktop
// tabs' order (MobileLayout); the phone's bar puts Chat in the middle.
export const MOBILE_NAV_ITEMS = [
  { key:"home", label:"Home", path:"/app/home", icon:Home },
  { key:"modules", label:"Modules", path:"/app/modules", icon:LayoutGrid },
  { key:"progress", label:"Progress", path:"/app/progress", icon:Target },
  { key:"forecast", label:"Forecasts", path:"/app/forecast", icon:LineChart },
  { key:"chat", label:"Chat", path:"/app/chat", icon:Sparkles },
];
export const BAR_ORDER = ["home", "modules", "chat", "progress", "forecast"];
const SPRING = { type:"spring", stiffness:420, damping:34, mass:0.8 };

// The phone's bar: a see-through pill floating over the page, icons only
// (each named for screen readers). A soft lens slides to the active tab;
// it's one shared layoutId, so it glides across even when the page below
// remounts the bar. Chat sits in the middle as the Candid Assist mark,
// raised a little, ringed in the same frosted glass as the pill.
// data-tab-bar: walk-throughs measure it to keep questions clear of it, so
// it spans the pill and the gap beneath it.
export default function MobileTabBar({ active, onNavigate }) {
  const reduce = useReducedMotion();
  // Best rates moved for them since the last visit: a red badge on Modules
  // until they open Cash (visitNews.js).
  const news = useCashNews();
  const badge = news && !news.opened ? news.count : 0;
  const glass = { background:"rgba(255,255,255,0.62)", WebkitBackdropFilter:"blur(18px) saturate(1.6)", backdropFilter:"blur(18px) saturate(1.6)" };
  return (
    <nav data-tab-bar aria-label="Main" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:4000,padding:"0 14px calc(10px + env(safe-area-inset-bottom, 0px))",pointerEvents:"none"}}>
      {/* Capped to MobileLayout's 580px column, so on a wide window the
          icons don't spread across the whole screen. */}
      <div style={{...glass,maxWidth:"420px",margin:"0 auto",height:"48px",borderRadius:"24px",padding:"4px",boxSizing:"border-box",display:"flex",pointerEvents:"auto",
        border:"1px solid rgba(255,255,255,0.75)",boxShadow:"0 8px 24px rgba(22,47,36,0.14), 0 1px 2px rgba(22,47,36,0.06)"}}>
        {BAR_ORDER.map(key => {
          const item = MOBILE_NAV_ITEMS.find(i => i.key === key);
          const isActive = key === active;
          const chat = key === "chat";
          return (
            <button key={key} type="button" data-tour={`tab-${key}`} aria-label={key === "modules" && badge ? `${item.label}, ${rateUpdatesLabel(badge)}` : item.label} aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(item.path)} style={{
              flex:1, position:"relative", display:"flex", alignItems:"center", justifyContent:"center",
              background:"transparent", border:"none", padding:0, cursor:"pointer",
            }}>
              {isActive && !chat && (
                <motion.span layoutId="tab-lens" transition={reduce ? { duration:0 } : SPRING}
                  style={{position:"absolute",inset:0,borderRadius:"20px",background:"rgba(22,47,36,0.08)"}}/>
              )}
              {chat ? (
                // The frosted ring shows the page through it, not a white edge.
                <span style={{...glass,position:"relative",top:"-7px",padding:"3px",borderRadius:"50%",display:"flex",
                  border:"1px solid rgba(255,255,255,0.6)",boxShadow:"0 4px 12px rgba(22,47,36,0.16)"}}>
                  <span style={{width:"34px",height:"34px",borderRadius:"50%",background:HERO_TILE_BG,display:"flex",alignItems:"center",justifyContent:"center",
                    boxShadow:isActive ? `inset 0 0 0 1.5px ${G}` : "inset 0 0 0 1px rgba(22,47,36,0.08)"}}>
                    <Sparkles size={18} color={G} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true"/>
                  </span>
                </span>
              ) : (
                // Tapped: a soft pulse, a little larger and back.
                <motion.span key={isActive ? "on" : "off"} style={{position:"relative",display:"flex"}}
                  initial={{ scale:1 }} animate={isActive && !reduce ? { scale:[1, 1.14, 1] } : { scale:1 }} transition={{ duration:0.36, ease:"easeInOut" }}>
                  <item.icon size={21} color={isActive ? G : MUT} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true"/>
                  {key === "modules" && <NewBadge count={badge} label={rateUpdatesLabel(badge)} style={{top:"-7px",right:"-12px",minWidth:"18px",height:"18px",lineHeight:"18px",fontSize:"10.5px",padding:"0 5px"}}/>}
                </motion.span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
