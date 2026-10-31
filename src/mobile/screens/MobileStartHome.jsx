import { MUT, TEXT, SERIF, ROW_TILE, SR_ONLY, SECTION_TITLE } from "../../design-tokens.js";
import { moduleOrder, moduleDone, scorePicks, SCORED_MODULES } from "../../lib/appEntry.js";
import { readinessMissing } from "../../lib/propertyReadiness.js";
import ModuleStartRow, { moduleMeta } from "../ModuleStartRow.jsx";
import { moduleEstimate } from "../../lib/crossModule.js";
import { ProgressLine } from "../onboarding/OnboardingShell.jsx";
import { StillCard } from "../CardStack.jsx";
import ScoreDonut from "../ScoreDonut.jsx";

// Home before the Candid score appears: every module in one list, largest
// rough £ first, none singled out (no "start with X": PRODUCT.md). The score waits until every pick is answered
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
  // By rough £, largest first; those with no estimate yet keep their order
  // after them (the sort is stable).
  const rows = order.map(key => ({ key, estimate: moduleEstimate(key, d, m) }))
    .sort((a, b) => (b.estimate?.high ?? -1) - (a.estimate?.high ?? -1));

  return (
    <div>
      {/* No greeting (Harvey, 30 Oct 2026): the heading is for screen readers. */}
      <h1 style={SR_ONLY}>Home</h1>

      {/* The score's place, held until every pick is answered: Home's
          figures card greyed, its figure and score blank. The progress line
          is its one indicator (screen readers get the count). */}
      <StillCard data-tour="home-score" label="Left on the table" body={t => (
        <>
          <div style={{display:"flex",alignItems:"flex-start",gap:"14px"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:SERIF,fontSize:"var(--hero-fig)",fontWeight:700,color:MUT,opacity:0.5,lineHeight:1,marginTop:"8px"}}>£–</div>
              <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"10px 0 0"}}>
                {needsScored
                  ? `Your Candid score covers ${listText(SCORED_MODULES.map(k => moduleMeta(k).title))}. Finish one of them to see it.`
                  : `Finish ${listText(left.map(k => moduleMeta(k).title))} to see your Candid score.`}
              </p>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,opacity:0.6}}>
              <ScoreDonut value={null} size={76} stroke={7} track={t.track}/>
              <div style={{fontSize:"11.5px",fontWeight:600,color:t.label,marginTop:"6px"}}>Candid score</div>
            </div>
          </div>
          <ProgressLine position={reached} total={target} style={{marginTop:"14px"}}/>
        </>
      )}/>

      <div data-tour="home-modules" style={{...ROW_TILE,marginTop:"22px"}}>
        <h2 style={SECTION_TITLE}>Your modules</h2>
        <div style={{display:"flex",flexDirection:"column",marginTop:"8px"}}>
          {rows.map(({ key, estimate }) => <ModuleStartRow key={key} moduleKey={key} d={d} done={done.includes(key)} estimate={estimate} onOpen={onStartModule}/>)}
        </div>
      </div>

    </div>
  );
}
