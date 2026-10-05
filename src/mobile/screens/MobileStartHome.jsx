import { G, CDARK, WHITE, MUT, TEXT, SERIF, RADIUS_CARD } from "../../CandidApp.jsx";
import { moduleOrder, moduleDone, picks, unfinishedPicks, MODULE_PITCH, SCORED_MODULES } from "../../lib/appEntry.js";
import { readinessMissing } from "../../lib/propertyReadiness.js";
import { mobileGreeting } from "../copy.js";
import ModuleStartRow, { moduleMeta } from "../ModuleStartRow.jsx";

// Home before the Candid score appears: the modules to start with, their
// picks from the entry first. The score waits until every pick is answered
// (scoreUnlocked; for "Just exploring", the first module), and its place says
// which are left, rather than scoring a picture that's mostly blank.

const listText = items => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

export default function MobileStartHome({ d, m, onStartModule }) {
  const propertyDone = readinessMissing(d, m).length === 0;
  const order = moduleOrder(d);
  const done = order.filter(k => moduleDone(k, d, propertyDone));
  const chosen = picks(d);
  const left = unfinishedPicks(d, propertyDone);
  // Picks all answered but none of them scored (Property alone, say): the
  // score still needs one module it covers.
  const needsScored = left.length === 0 && !done.some(k => SCORED_MODULES.includes(k));
  // Progress towards the score: picks answered of picks made, or the first
  // (scored) module for "Just exploring" and the case above.
  const target = chosen.length && !needsScored ? chosen.length : 1;
  const reached = needsScored ? 0 : chosen.length ? chosen.length - left.length : Math.min(done.length, 1);
  const start = order.find(k => !done.includes(k));
  const rest = order.filter(k => k !== start);
  const label = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase" };
  const card = { background:WHITE, border:"1px solid rgba(22,47,36,0.08)", borderRadius:RADIUS_CARD, boxShadow:"0 2px 10px rgba(22,47,36,0.05)" };
  const iconTile = (Icon, size = 34) => (
    <div style={{width:`${size}px`,height:`${size}px`,borderRadius:"9px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <Icon size={size * 0.47} color={G}/>
    </div>
  );
  const startMeta = start ? moduleMeta(start) : null;

  return (
    <div>
      <h1 style={{fontFamily:SERIF,fontSize:"22px",color:G,fontWeight:700,marginBottom:"20px",lineHeight:1.2}}>
        {mobileGreeting(d)}
      </h1>

      {/* The score's place, held until every pick is answered. The bar is
          its one progress indicator. */}
      <div style={label}>Candid Score</div>
      <p style={{fontSize:"14px",color:TEXT,lineHeight:1.5,margin:"6px 0 0"}}>
        {needsScored
          ? "Your Candid score covers your savings, investments, pension and student loan. Finish one of them to see it."
          : chosen.length
            ? `Finish ${listText(left.map(k => moduleMeta(k).title))} to see your Candid score.`
            : "Finish your first module to see your Candid score."}
      </p>
      <div style={{display:"flex",alignItems:"center",gap:"10px",marginTop:"10px"}}>
        <div style={{flex:1,height:"5px",borderRadius:"100px",background:CDARK,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:"100px",background:G,width:`${(reached / target) * 100}%`,transition:"width 0.4s ease"}}/>
        </div>
        <span style={{fontSize:"11px",color:MUT,whiteSpace:"nowrap"}}>{reached} of {target} done</span>
      </div>

      {startMeta && (
        <div style={{marginTop:"24px"}}>
          <div style={label}>Start here</div>
          <div style={{...card,padding:"18px",marginTop:"10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              {iconTile(startMeta.icon)}
              <div style={{fontSize:"16px",fontWeight:700,color:TEXT}}>{startMeta.title}</div>
            </div>
            <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0"}}>{MODULE_PITCH[start]}</p>
            <button type="button" onClick={() => onStartModule(start)} style={{marginTop:"14px",width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"14px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              Start
            </button>
          </div>
        </div>
      )}

      <div style={{marginTop:"24px"}}>
        <div style={label}>{startMeta ? "Then" : "Your modules"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"10px"}}>
          {rest.map(key => <ModuleStartRow key={key} moduleKey={key} done={done.includes(key)} onOpen={onStartModule}/>)}
        </div>
      </div>
    </div>
  );
}
