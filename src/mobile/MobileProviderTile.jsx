import { useState } from "react";
import { Landmark, Unlock, ExternalLink } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF } from "../CandidApp.jsx";

// Static "where to actually do this" provider list for Investments/Pension —
// unlike Cash's MobileProductListTile, there's no live-rate data source for
// platform fees or SIPP charges (no equivalent of the savings_rates table),
// so the list itself stays the same curated illustrative one desktop's
// ProductCard already shows (getModuleProducts). Collapsed/blurred the same
// way as Cash's tile though, for visual consistency between the two "explore
// providers" surfaces — one item fully visible, the next fading from its own
// top edge to solid white by the tile's bottom edge. Items here are taller
// and variable-height (icon row + feature paragraph), unlike Cash's fixed-
// height rows, so the collapsed height/gradient split is an approximation
// tuned to typical item length rather than an exact row boundary. Items with
// a real productUrl render as an actual outbound link (same convention as
// desktop's ProductCard and Cash's tile); the "demo" label only remains for
// any future entry with no real destination yet.
const COLLAPSED_HEIGHT = 190;

export default function MobileProviderTile({ heading, products, disclaimer }) {
  const [open, setOpen] = useState(false);
  if (!products || products.length === 0) return null;

  return (
    <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginTop:"16px"}}>
      <div onClick={() => setOpen(o => !o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",cursor:"pointer",marginBottom:"12px"}}>
        <div style={{fontFamily:SERIF,fontSize:"16px",fontWeight:700,color:G}}>{heading}</div>
        <span style={{fontSize:"14px",color:"#6b6b6b",flexShrink:0,display:"inline-block",transform:open?"rotate(90deg)":"none",transition:"transform 0.15s"}}>›</span>
      </div>

      <div style={{position:"relative",maxHeight:open?"none":`${COLLAPSED_HEIGHT}px`,overflow:"hidden"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {products.map((p, i) => {
            const Icon = p.appIcon || Landmark;
            const isLink = !!p.productUrl;
            const Wrapper = isLink ? "a" : "div";
            const wrapperProps = isLink ? { href: p.productUrl, target: "_blank", rel: "noopener noreferrer" } : {};
            return (
              <Wrapper key={i} {...wrapperProps} style={{display:"block",textDecoration:"none",color:"inherit",border:`1.5px solid ${p.highlight ? GOLD : "rgba(22,47,36,0.09)"}`,borderRadius:"10px",padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <div style={{width:"32px",height:"32px",background:p.highlight?G:"rgba(22,47,36,0.07)",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <Icon size={16} color={p.highlight?WHITE:G}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                      <span style={{fontSize:"13.5px",fontWeight:600,color:TEXT}}>{p.name}</span>
                      {p.badge && <span style={{fontSize:"9px",fontWeight:700,color:GOLD,background:"rgba(196,150,58,0.15)",padding:"2px 7px",borderRadius:"100px",letterSpacing:"0.03em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{p.badge}</span>}
                    </div>
                    <div style={{fontSize:"11.5px",color:MUT,marginTop:"1px"}}>{p.type}</div>
                  </div>
                  {p.rate && <div style={{fontFamily:SERIF,fontSize:"14px",fontWeight:700,color:G,flexShrink:0,whiteSpace:"nowrap"}}>{p.rate}</div>}
                </div>
                {p.feature && <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"8px",marginBottom:0}}>{p.feature}</p>}
                <div style={{marginTop:"8px",fontSize:"11px",fontWeight:isLink?700:400,color:isLink?GOLD:"rgba(22,47,36,0.4)",fontStyle:isLink?"normal":"italic",display:"flex",alignItems:"center",gap:"4px"}}>
                  {isLink ? <>{p.cta}<ExternalLink size={11}/></> : <><Unlock size={10}/>{p.cta} · demo</>}
                </div>
              </Wrapper>
            );
          })}
        </div>
        {!open && products.length > 1 && (
          <>
            <div style={{position:"absolute",inset:0,background:`linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 55%, ${WHITE} 100%)`,pointerEvents:"none"}}/>
            <div onClick={() => setOpen(true)} style={{position:"absolute",left:0,right:0,bottom:"10px",textAlign:"center",cursor:"pointer"}}>
              <span style={{fontSize:"12px",fontWeight:600,color:GOLD}}>See all {products.length} options</span>
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
