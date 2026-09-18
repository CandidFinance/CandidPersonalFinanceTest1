import { X, Plus } from "lucide-react";
import { GOLD } from "../../CandidApp.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";
import { capField } from "../../lib/onboarding.js";

// Repeatable "one row per cash account" list for the onboarding Cash step —
// mobile equivalent of desktop's inline cashTiers grid (OnboardingStep,
// CandidApp.jsx). Same data shape ([{amount,rate}]) and same field caps, so
// values written here read back identically everywhere else in the app.
export default function MobileCashTiersList({ d, set }) {
  const tiers = d.cashTiers || [{ amount:"", rate:"" }];

  const updateTier = (i, patch) => {
    const t = [...tiers];
    t[i] = { ...t[i], ...patch };
    set("cashTiers", t);
  };
  const removeTier = i => {
    const t = tiers.filter((_, j) => j !== i);
    set("cashTiers", t.length ? t : [{ amount:"", rate:"" }]);
  };

  return (
    <div>
      {tiers.map((tier, i) => (
        <div key={i} style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"8px"}}>
          <PillMoneyInput label="Amount" value={tier.amount || null} onChange={v => updateTier(i, { amount: capField("isaPrevCash", v ?? "") })}/>
          <PillMoneyInput label="Rate" unit="%" value={tier.rate || null} onChange={v => updateTier(i, { rate: capField("savingsRate", v ?? "") })}/>
          {tiers.length > 1 && (
            <button type="button" onClick={() => removeTier(i)} aria-label="Remove account" style={{background:"none",border:"none",padding:"6px",cursor:"pointer",flexShrink:0,color:"#6b6b6b"}}>
              <X size={16}/>
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => set("cashTiers", [...tiers, { amount:"", rate:"" }])} style={{
        display:"flex",alignItems:"center",gap:"6px",background:"none",border:`1px dashed ${GOLD}`,borderRadius:"100px",
        padding:"7px 14px",color:GOLD,fontSize:"12px",fontWeight:600,cursor:"pointer",marginTop:"4px",
      }}>
        <Plus size={13}/> Add another account
      </button>
    </div>
  );
}
