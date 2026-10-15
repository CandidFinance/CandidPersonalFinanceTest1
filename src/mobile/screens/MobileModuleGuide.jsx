import { useEffect } from "react";
import { G, TEXT, MUT, SERIF } from "../../design-tokens.js";
import { MODULE_META } from "../../lib/moduleStatus.js";
import { MODULE_GUIDES } from "../../lib/moduleGuide.js";
import GuidedFlow from "../property/GuidedFlow.jsx";
import EmptyResultCard from "../property/EmptyResultCard.jsx";
import MobileCashTiersList from "../onboarding/MobileCashTiersList.jsx";

// A module's walk-through (/app/module/:key until its questions are
// answered): the module's header, its answer held back as a blurred card,
// then the questions (src/lib/moduleGuide.js). When they're done the module's
// own screen takes over, and that is the answer.

const RENDERERS = {
  cashAccounts: ({ d, set }) => <MobileCashTiersList d={d} set={set}/>,
};

export default function MobileModuleGuide({ moduleKey, d, m, set, onDone }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  const guide = MODULE_GUIDES[moduleKey];

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px"}}>
        <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {meta?.icon && <meta.icon size={18} color={G}/>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,margin:0,lineHeight:1.2}}>{meta?.title || moduleKey}</h1>
          <div style={{fontSize:"12.5px",color:MUT,marginTop:"3px"}}>A few questions first</div>
        </div>
      </div>
      <GuidedFlow key={moduleKey} questions={guide.questions} d={d} m={m} set={set}
        renderers={RENDERERS} onDone={onDone}
        result={<EmptyResultCard text={guide.emptyText}/>}/>
    </div>
  );
}
