import { WHITE, TEXT, SERIF, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE } from "../../design-tokens.js";

// A Property step's result card before it has the figures it needs: the
// card's shape in grey, blurred, with one line (`text`) saying what fills it
// in. Placeholder bars only, never made-up figures. Shared so every step's
// empty state looks the same. `compact`: for a module's walk-through, the
// module's Opportunity tile blurred behind the line, smaller than the full
// card, so there's plainly an answer waiting without crowding the questions.
export default function EmptyResultCard({ text, compact = false }) {
  const bar = (width, height = 8) => <div style={{width,height,borderRadius:"4px",background:"rgba(22,47,36,0.12)"}}/>;
  if (compact) return (
    <div style={{background:OPPORTUNITY_TILE_BG,border:OPPORTUNITY_TILE_BORDER,boxShadow:OPPORTUNITY_TILE_SHADOW,borderRadius:"14px",padding:"12px 16px 13px"}}>
      <div aria-hidden="true" style={{display:"flex",alignItems:"flex-end",gap:"14px",filter:"blur(3px)",opacity:0.8}}>
        <div>
          <div style={{fontSize:"10px",fontWeight:800,color:OPPORTUNITY_TILE_LABEL,letterSpacing:"0.08em",textTransform:"uppercase"}}>Opportunity</div>
          <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"4px"}}>
            <span style={{fontFamily:SERIF,fontSize:"28px",fontWeight:700,color:OPPORTUNITY_TILE_FIGURE,lineHeight:1}}>£</span>
            <div style={{width:"96px",height:"20px",borderRadius:"5px",background:OPPORTUNITY_TILE_FIGURE,opacity:0.5}}/>
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:"6px",paddingBottom:"3px"}}>
          <div style={{width:"80%",height:"7px",borderRadius:"4px",background:OPPORTUNITY_TILE_LABEL,opacity:0.45}}/>
          <div style={{width:"55%",height:"7px",borderRadius:"4px",background:OPPORTUNITY_TILE_LABEL,opacity:0.45}}/>
        </div>
      </div>
      <p style={{fontSize:"13px",fontWeight:600,color:TEXT,lineHeight:1.45,margin:"10px 0 0"}}>{text}</p>
    </div>
  );
  return (
    <div style={{position:"relative",background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"18px",overflow:"hidden"}}>
      <div aria-hidden="true" style={{filter:"blur(3px)",opacity:0.7}}>
        <div style={{display:"flex",gap:"24px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>{bar("70px")}{bar("130px",26)}</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>{bar("70px")}{bar("56px",26)}</div>
        </div>
        <div style={{marginTop:"18px"}}>{bar("100%",10)}</div>
        <div style={{marginTop:"12px"}}>{bar("75%")}</div>
        <div style={{marginTop:"8px",marginBottom:"8px"}}>{bar("55%")}</div>
      </div>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
        <p style={{fontSize:"13.5px",fontWeight:600,color:TEXT,lineHeight:1.5,margin:0,textAlign:"center",background:"rgba(255,255,255,0.85)",borderRadius:"10px",padding:"10px 14px"}}>
          {text}
        </p>
      </div>
    </div>
  );
}
