import { useEffect } from "react";
import posthog from "posthog-js";
import { G, CDARK, WHITE, MUT, TEXT, SERIF, RADIUS_CARD } from "../../CandidApp.jsx";
import { moduleOrder, moduleDone, reportReady, MODULE_PITCH, REPORT_AFTER_MODULES } from "../../lib/appEntry.js";
import { readinessMissing } from "../../lib/propertyReadiness.js";
import { mobileGreeting } from "../copy.js";
import ModuleStartRow, { moduleMeta } from "../ModuleStartRow.jsx";

// Home for a user without a report yet: the modules to start with, their
// picks from the entry first. The Candid score waits until enough modules
// are done for the overall report (REPORT_AFTER_MODULES), and says so,
// rather than scoring a picture that's mostly blank; then its place offers
// the report ("See what to do first").

const NUMBER_WORDS = { 2:"two", 3:"three", 4:"four" };

export default function MobileStartHome({ d, m, onStartModule, onSeeReport }) {
  const propertyDone = readinessMissing(d, m).length === 0;
  const order = moduleOrder(d);
  const done = order.filter(k => moduleDone(k, d, propertyDone));
  const ready = reportReady(d, propertyDone);
  useEffect(() => { if (ready) posthog.capture("report_offered", { where: "home", modules: done.join(",") }); }, [ready]);
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

      {/* The score's place, held until the report. Before enough modules
          are done, the bar is its one progress indicator; after, the way to
          the report. */}
      <div style={label}>Candid Score</div>
      {ready ? (
        <div style={{...card,padding:"18px",marginTop:"10px"}}>
          <p style={{fontSize:"14px",color:TEXT,lineHeight:1.5,margin:0}}>
            You've answered enough for Candid to work out how well you're doing, and what to do first.
          </p>
          <button type="button" onClick={onSeeReport} style={{marginTop:"14px",width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"14px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
            See what to do first
          </button>
        </div>
      ) : (<>
        <p style={{fontSize:"14px",color:TEXT,lineHeight:1.5,margin:"6px 0 0"}}>
          Finish {NUMBER_WORDS[REPORT_AFTER_MODULES] || REPORT_AFTER_MODULES} modules and we'll work out how well you're doing.
        </p>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginTop:"10px"}}>
          <div style={{flex:1,height:"5px",borderRadius:"100px",background:CDARK,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:"100px",background:G,width:`${Math.min(100, (done.length / REPORT_AFTER_MODULES) * 100)}%`,transition:"width 0.4s ease"}}/>
          </div>
          <span style={{fontSize:"11px",color:MUT,whiteSpace:"nowrap"}}>{done.length} of {REPORT_AFTER_MODULES} done</span>
        </div>
      </>)}

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
