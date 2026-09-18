import { Landmark, Unlock } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF } from "../CandidApp.jsx";

// Static "where to actually do this" provider list for Investments/Pension —
// unlike Cash's MobileProductListTile, there's no live-rate data source for
// platform fees or SIPP charges (no equivalent of the savings_rates table),
// so this stays the same curated illustrative list desktop's ProductCard
// already shows (getModuleProducts), just laid out for a narrow mobile card.
// Short lists (3-4 items) — no collapse/blur needed. Items with no real
// productUrl get the same "demo" tag desktop uses for non-linkable cards.
export default function MobileProviderTile({ heading, products, disclaimer }) {
  if (!products || products.length === 0) return null;

  return (
    <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"14px",padding:"16px 18px",marginTop:"16px"}}>
      <div style={{fontFamily:SERIF,fontSize:"16px",fontWeight:700,color:G,marginBottom:"12px"}}>{heading}</div>
      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
        {products.map((p, i) => {
          const Icon = p.appIcon || Landmark;
          return (
            <div key={i} style={{border:`1.5px solid ${p.highlight ? GOLD : "rgba(22,47,36,0.09)"}`,borderRadius:"10px",padding:"12px 14px"}}>
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
              <div style={{marginTop:"8px",fontSize:"10.5px",color:"rgba(22,47,36,0.4)",fontStyle:"italic",display:"flex",alignItems:"center",gap:"4px"}}>
                <Unlock size={10}/>{p.cta} · demo
              </div>
            </div>
          );
        })}
      </div>
      {disclaimer && <p style={{fontSize:"10.5px",color:MUT,lineHeight:1.5,marginTop:"12px",marginBottom:0}}>{disclaimer}</p>}
    </div>
  );
}
