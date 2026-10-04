import { WHITE, TEXT } from "../../CandidApp.jsx";

// A Property step's result card before it has the figures it needs: the
// card's shape in grey, blurred, with one line (`text`) saying what fills it
// in. Placeholder bars only, never made-up figures. Shared so every step's
// empty state looks the same.
export default function EmptyResultCard({ text }) {
  const bar = (width, height = 8) => <div style={{width,height,borderRadius:"4px",background:"rgba(22,47,36,0.12)"}}/>;
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
