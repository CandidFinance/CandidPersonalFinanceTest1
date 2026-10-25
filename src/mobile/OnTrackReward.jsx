import { useEffect } from "react";
import posthog from "posthog-js";
import { G, MUT, TEXT, SERIF } from "../design-tokens.js";
import { NATIONAL_STATS } from "../lib/nationalStats.js";
import Burst from "./Burst.jsx";

// Under the answer of a module with nothing to improve (onTrackReward,
// unlock.js): one more answer free ("bonus"), or a national figure for the
// module ("stat"), so an answer of "nothing to change" still gives
// something. A short gold burst marks it the first time it's seen
// (`celebrate`), not on a replay or with reduced motion. `unlocked`: how
// many answers they have, counting a friend's invite still to use (the
// bonus is then their third). CandidApp puts the bonus on their record.

// A module without a national figure (nationalStats.js) shows nothing
// once the bonus is used.

export default function OnTrackReward({ moduleKey, kind, unlocked = 1, celebrate = true, onChoose }) {
  const stat = kind === "stat" ? NATIONAL_STATS[moduleKey] : null;
  const showing = kind === "bonus" || !!stat;
  useEffect(() => {
    if (!showing) return;
    posthog.capture("on_track_reward_shown", { module: moduleKey, kind });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!showing) return null;
  const textLink = { background:"none", border:"none", padding:"8px 0 0", color:G, fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" };
  return (
    <div style={{position:"relative",marginTop:"28px",padding:"20px",borderRadius:"14px",background:"rgba(196,150,58,0.10)"}}>
      {celebrate && <Burst/>}
      {kind === "bonus" ? <>
        <div style={{fontSize:"17px",fontWeight:700,color:TEXT,lineHeight:1.3}}>{unlocked > 1 ? "Next module unlocked" : "Second module unlocked"}</div>
        <p style={{fontSize:"15px",color:MUT,lineHeight:1.5,margin:"6px 0 0"}}>
          Nothing here needs changing, so the next module you open is free.
        </p>
        <button type="button" onClick={() => { posthog.capture("on_track_bonus_choose", { module: moduleKey }); onChoose(); }} style={textLink}>
          Choose a module
        </button>
      </> : <>
        <div style={{fontFamily:SERIF,fontSize:"34px",fontWeight:700,color:G,lineHeight:1.1}}>{stat.figure}</div>
        <p style={{fontSize:"15px",color:TEXT,lineHeight:1.45,margin:"6px 0 0"}}>{stat.line}</p>
        <p style={{fontSize:"12px",color:MUT,lineHeight:1.4,margin:"8px 0 0"}}>Source: {stat.source}</p>
      </>}
    </div>
  );
}

