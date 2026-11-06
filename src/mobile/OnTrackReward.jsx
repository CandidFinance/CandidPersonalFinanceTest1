import { useEffect } from "react";
import posthog from "posthog-js";
import { G, MUT, TEXT, SERIF } from "../design-tokens.js";
import { NATIONAL_STATS } from "../lib/nationalStats.js";
import Burst from "./Burst.jsx";

// Under the answer of a module with nothing to improve (onTrack, unlock.js):
// a national figure for the module, so an answer of "nothing to change" still
// gives something. A short gold burst marks it the first time it's seen
// (`celebrate`), not on a replay or with reduced motion. A module without a
// national figure (nationalStats.js) shows nothing.

export default function OnTrackReward({ moduleKey, celebrate = true }) {
  const stat = NATIONAL_STATS[moduleKey];
  useEffect(() => {
    if (!stat) return;
    posthog.capture("on_track_reward_shown", { module: moduleKey, kind: "stat" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!stat) return null;
  return (
    <div style={{position:"relative",marginTop:"28px",padding:"20px",borderRadius:"14px",background:"rgba(196,150,58,0.10)"}}>
      {celebrate && <Burst/>}
      <div style={{fontFamily:SERIF,fontSize:"34px",fontWeight:700,color:G,lineHeight:1.1}}>{stat.figure}</div>
      <p style={{fontSize:"15px",color:TEXT,lineHeight:1.45,margin:"6px 0 0"}}>{stat.line}</p>
      <p style={{fontSize:"12px",color:MUT,lineHeight:1.4,margin:"8px 0 0"}}>Source: {stat.source}</p>
    </div>
  );
}
