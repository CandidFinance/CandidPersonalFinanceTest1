import { G, WHITE, MUT, TEXT, SERIF, RADIUS_CARD, LABEL_CAPS } from "../../design-tokens.js";
import { moduleOrder, moduleDone, scorePicks, pitchFor, SCORED_MODULES } from "../../lib/appEntry.js";
import { readinessMissing } from "../../lib/propertyReadiness.js";
import { mobileGreeting } from "../copy.js";
import ModuleStartRow, { moduleMeta } from "../ModuleStartRow.jsx";
import { moduleEstimate } from "../../lib/crossModule.js";
import { ProgressLine, PrimaryButton } from "../onboarding/OnboardingShell.jsx";

// Home before the Candid score appears: the modules to start with, their
// picks from the entry first. The score waits until every pick is answered
// (scoreUnlocked; for "Just exploring", the first module), and its place says
// which are left, rather than scoring a picture that's mostly blank.

const listText = items => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

export default function MobileStartHome({ d, m, set, onStartModule }) {
  const propertyDone = readinessMissing(d, m).length === 0;
  const order = moduleOrder(d);
  const done = order.filter(k => moduleDone(k, d, propertyDone));
  // The score waits for the scored modules picked at the entry (never
  // Property, which it doesn't cover), or with none picked, the first scored
  // module (scoreUnlocked).
  const chosen = scorePicks(d);
  const left = chosen.filter(k => !done.includes(k));
  const needsScored = chosen.length === 0;
  // Progress towards the score: scored picks answered of those picked, or
  // the first scored module.
  const target = chosen.length || 1;
  const reached = chosen.length ? chosen.length - left.length : Math.min(done.filter(k => SCORED_MODULES.includes(k)).length, 1);
  const start = order.find(k => !done.includes(k));
  const rest = order.filter(k => k !== start);
  const label = LABEL_CAPS;
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

      {/* The score's place, held until every pick is answered. The progress
          line is its one indicator (screen readers get the count). */}
      <div style={label}>Candid Score</div>
      <p style={{fontSize:"14px",color:TEXT,lineHeight:1.5,margin:"6px 0 0"}}>
        {needsScored
          ? `Your Candid score covers ${listText(SCORED_MODULES.map(k => moduleMeta(k).title))}. Finish one of them to see it.`
          : `Finish ${listText(left.map(k => moduleMeta(k).title))} to see your Candid score.`}
      </p>
      <ProgressLine position={reached} total={target} style={{marginTop:"10px"}}/>

      {startMeta && (
        <div style={{marginTop:"24px"}}>
          <div style={label}>Next module</div>
          <div style={{...card,padding:"18px",marginTop:"10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              {iconTile(startMeta.icon)}
              <div style={{fontSize:"16px",fontWeight:700,color:TEXT}}>{startMeta.title}</div>
            </div>
            <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.5,margin:"10px 0 0"}}>{pitchFor(start, d)}</p>
            <PrimaryButton size="regular" onClick={() => onStartModule(start)} style={{marginTop:"14px"}}>Start</PrimaryButton>
          </div>
        </div>
      )}

      <div style={{marginTop:"24px"}}>
        <div style={label}>{startMeta ? "Your other modules" : "Your modules"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:"8px",marginTop:"10px"}}>
          {rest.map(key => <ModuleStartRow key={key} moduleKey={key} d={d} done={done.includes(key)} estimate={moduleEstimate(key, d, m)} onOpen={onStartModule}/>)}
        </div>
      </div>

    </div>
  );
}
