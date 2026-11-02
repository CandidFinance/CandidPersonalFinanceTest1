import { useState } from "react";
import { ExternalLink, ChevronRight } from "lucide-react";
import { PROVIDER_TILE_FADE_CLEAR, G, GOLD, MUT, TEXT, SERIF, PROVIDER_TILE_BG, PROVIDER_TILE_BG_END, PROVIDER_TILE_BORDER, PROVIDER_TILE_SHADOW, RADIUS_CARD, GOLD_TEXT } from "../design-tokens.js";

// Collapsible "Best [X] right now" provider-rate tile — collapsed by default
// to roughly 2 rows' worth of height: the 1st row fully visible, the 2nd
// blurring from its own top edge down to fully solid white by the tile's
// bottom edge, with "See all N rates" sitting on that white band — so the
// blur genuinely reaches the bottom of the tile rather than leaving a stub
// of plain whitespace below a short fade. Expands to the full list on tap.
const COLLAPSED_HEIGHT = 98;

// `embedded`: inside a MobileWinTile with `provider`, which gives
// the heading and the frame.
export default function MobileProductListTile({ heading, subheading, products, disclaimer, embedded = false }) {
  const [open, setOpen] = useState(false);
  if (!products || products.length === 0) return null;

  return (
    <div style={embedded ? {} : {background:PROVIDER_TILE_BG,border:PROVIDER_TILE_BORDER,boxShadow:PROVIDER_TILE_SHADOW,borderRadius:RADIUS_CARD,padding:"16px 18px",marginTop:"16px"}}>
      {!embedded && <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{background:"none",border:"none",padding:0,width:"100%",textAlign:"left",font:"inherit",color:"inherit",display:"block",cursor:"pointer"}}>
        <span style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
          <span style={{fontFamily:SERIF,fontSize:"16px",fontWeight:700,color:G}}>{heading}</span>
          <ChevronRight size={14} color={MUT} aria-hidden="true" style={{flexShrink:0,transform:open?"rotate(90deg)":"none",transition:"transform 0.15s"}}/>
        </span>
        {subheading && <span style={{display:"block",fontSize:"12.5px",color:MUT,lineHeight:1.4,marginTop:"3px"}}>{subheading}</span>}
      </button>}

      {/* Tabbing to a link hidden under the fade opens the list. */}
      <div onFocus={e => { if (!open && keyboardFocus(e.target)) setOpen(true); }} style={{position:"relative",marginTop:embedded ? 0 : "10px",maxHeight:open?"none":`${COLLAPSED_HEIGHT}px`,overflow:"hidden"}}>
        {products.map((p, i) => (
          <a key={i} href={p.productUrl} target="_blank" rel="noopener noreferrer" style={{
            display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",padding:"8px 0",
            borderBottom: i < products.length-1 ? "1px solid rgba(22,47,36,0.06)" : "none",
            textDecoration:"none",
          }}>
            <div style={{minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                <span style={{fontSize:"14px",fontWeight:600,color:TEXT}}>{p.name}</span>
                {p.badge && <span style={{fontSize:"9px",fontWeight:700,color:GOLD_TEXT,background:"rgba(196,150,58,0.15)",padding:"2px 7px",borderRadius:"100px",letterSpacing:"0.03em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{p.badge}</span>}
              </div>
              <div style={{fontSize:"12px",color:MUT,marginTop:"1px"}}>{p.type}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"6px",flexShrink:0}}>
              <span style={{fontFamily:SERIF,fontSize:"15px",fontWeight:700,color:G}}>{p.rate}</span>
              <ExternalLink size={13} color={MUT}/>
            </div>
          </a>
        ))}
        {!open && products.length > 1 && (
          <>
            <div style={{position:"absolute",inset:0,background:`linear-gradient(to bottom, ${PROVIDER_TILE_FADE_CLEAR} 0%, ${PROVIDER_TILE_FADE_CLEAR} 50%, ${PROVIDER_TILE_BG_END} 100%)`,pointerEvents:"none"}}/>
            <button type="button" onClick={() => setOpen(true)} style={{position:"absolute",left:0,right:0,bottom:0,background:"none",border:"none",padding:"14px 0 10px",font:"inherit",textAlign:"center",cursor:"pointer"}}>
              <span style={{fontSize:"12px",fontWeight:600,color:G}}>See all {products.length} rates</span>
            </button>
          </>
        )}
      </div>

      {open && disclaimer && (
        <p style={{fontSize:"10.5px",color:MUT,lineHeight:1.5,marginTop:"12px",marginBottom:0}}>{disclaimer}</p>
      )}
    </div>
  );
}

// Focus that came from the keyboard; older Safari has no :focus-visible.
function keyboardFocus(el) {
  try { return el.matches(":focus-visible"); } catch { return true; }
}
