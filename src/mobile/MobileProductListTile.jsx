import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF } from "../CandidApp.jsx";

// Collapsible "Best [X] right now" provider-rate tile — collapsed by default
// to roughly 2 rows' worth of height: the 1st row fully visible, the 2nd
// blurring from its own top edge down to fully solid white by the tile's
// bottom edge, with "See all N rates" sitting on that white band — so the
// blur genuinely reaches the bottom of the tile rather than leaving a stub
// of plain whitespace below a short fade. Expands to the full list on tap.
const COLLAPSED_HEIGHT = 98;

export default function MobileProductListTile({ heading, subheading, products, disclaimer }) {
  const [open, setOpen] = useState(false);
  if (!products || products.length === 0) return null;

  return (
    <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginTop:"16px"}}>
      <div onClick={() => setOpen(o => !o)} style={{cursor:"pointer"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
          <div style={{fontFamily:SERIF,fontSize:"16px",fontWeight:700,color:G}}>{heading}</div>
          <span style={{fontSize:"14px",color:"#6b6b6b",flexShrink:0,display:"inline-block",transform:open?"rotate(90deg)":"none",transition:"transform 0.15s"}}>›</span>
        </div>
        {subheading && <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.4,marginTop:"3px",marginBottom:0}}>{subheading}</p>}
      </div>

      <div style={{position:"relative",marginTop:"10px",maxHeight:open?"none":`${COLLAPSED_HEIGHT}px`,overflow:"hidden"}}>
        {products.map((p, i) => (
          <a key={i} href={p.productUrl} target="_blank" rel="noopener noreferrer" style={{
            display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",padding:"8px 0",
            borderBottom: i < products.length-1 ? "1px solid rgba(22,47,36,0.06)" : "none",
            textDecoration:"none",
          }}>
            <div style={{minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                <span style={{fontSize:"14px",fontWeight:600,color:TEXT}}>{p.name}</span>
                {p.badge && <span style={{fontSize:"9px",fontWeight:700,color:GOLD,background:"rgba(196,150,58,0.15)",padding:"2px 7px",borderRadius:"100px",letterSpacing:"0.03em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{p.badge}</span>}
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
            <div style={{position:"absolute",inset:0,background:`linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 50%, ${WHITE} 100%)`,pointerEvents:"none"}}/>
            <div onClick={() => setOpen(true)} style={{position:"absolute",left:0,right:0,bottom:"10px",textAlign:"center",cursor:"pointer"}}>
              <span style={{fontSize:"12px",fontWeight:600,color:GOLD}}>See all {products.length} rates</span>
            </div>
          </>
        )}
      </div>

      {open && disclaimer && (
        <p style={{fontSize:"10.5px",color:MUT,lineHeight:1.5,marginTop:"12px",marginBottom:0}}>{disclaimer}</p>
      )}
    </div>
  );
}
