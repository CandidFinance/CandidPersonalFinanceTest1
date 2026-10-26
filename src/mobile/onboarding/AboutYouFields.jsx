import { useId, useState } from "react";
import { NATION_OPTIONS, nationAlso } from "../../lib/sharedQuestions.js";
import { nationOf } from "../../lib/childcare.js";
import { G, GOLD_TEXT, MUT, MUT_ON_CDARK, TEXT, SERIF, CDARK } from "../../design-tokens.js";
import { PillSlider } from "../PillSlider.jsx";
import { capField } from "../../lib/onboarding.js";
import { scottishRate } from "../../lib/tax.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";

const TRAJECTORY_OPTIONS = [
  { value:"stable", label:"Stable" },
  { value:"moderate", label:"Steady" },
  { value:"high", label:"Rapid" },
];
const TRAJECTORY_HINT = {
  stable: "Rising with prices, about 2% a year",
  moderate: "About 5% a year for ten years, then with prices",
  high: "About 10% a year for ten years, then with prices",
};
// Not working: retired, or between jobs (pension.js inRetirement).
const NOT_WORKING_OPTIONS = [{ value:"retired", label:"Retired" }, { value:"break", label:"Between jobs or a break" }];
const SCOTTISH_BAND_NAME = {
  0.19: "Starter rate (19%)", 0.20: "Basic rate (20%)", 0.21: "Intermediate rate (21%)",
  0.42: "Higher rate (42%)", 0.45: "Advanced rate (45%)", 0.48: "Top rate (48%)",
};
const EMPLOYMENT_STATUS_OPTIONS = [
  { value:"employed", label:"Employed" },
  { value:"self_employed", label:"Self-employed" },
  { value:"not_working", label:"Not working" },
];

// The "About you" fields on the Edit inputs page (MobileInputsScreen): age,
// pay, work, where in the UK, other income and monthly spending, each
// written straight into `d`.
export default function AboutYouFields({ d, set }) {
  const [showAdditionalIncome, setShowAdditionalIncome] = useState(false);
  const [showEmploymentInfo, setShowEmploymentInfo] = useState(false);
  // Each pill group is named by the visible label above it.
  const ids = useId();
  const employmentId = `${ids}-employment`, nationId = `${ids}-nation`, trajectoryId = `${ids}-trajectory`;
  const fieldLabel = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:"8px", display:"block" };
  const totalIncome = (+d.salary||0) + (+d.bonusAmount||0) + (+d.otherIncome||0) + (+d.dividendIncome||0);
  // Scottish taxpayers: Scotland's own bands (tax.js scottishRate).
  const taxBand = d.scottishTaxpayer === "yes" ?SCOTTISH_BAND_NAME[scottishRate(totalIncome)]
    : totalIncome > 125140 ? "Additional rate (45%)" : totalIncome > 50270 ? "Higher rate (40%)" : "Basic rate (20%)";
  return (
    <div>
      <div style={{display:"flex",gap:"10px",marginBottom:"14px"}}>
        <PillMoneyInput label="Age" unit="" value={d.age || null} onChange={v => set("age", v ?? "")}/>
        <PillMoneyInput label="Gross salary" value={d.salary || null} onChange={v => set("salary", capField("salary", v ?? ""))}/>
      </div>

      <div style={{marginBottom:"18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"8px"}}>
          <span id={employmentId} style={{...fieldLabel,marginBottom:0}}>Employment status</span>
          <InfoButton onClick={() => setShowEmploymentInfo(v => !v)} open={showEmploymentInfo}/>
        </div>
        <PillSlider value={d.employmentStatus || "employed"} onChange={v => { set("employmentStatus", v); set("employmentAsked", true); }} options={EMPLOYMENT_STATUS_OPTIONS} labelledBy={employmentId}/>
        {d.employmentStatus === "not_working" && (
          <div style={{marginTop:"10px"}}>
            <PillSlider value={d.notWorkingReason || ""} onChange={v => set("notWorkingReason", v)} options={NOT_WORKING_OPTIONS} label="Why not working"/>
          </div>
        )}
        {/* Where they live: Scotland's own income tax rates (tax.js), and
            childcare help by nation (childcare.js). */}
        <div style={{marginTop:"12px"}}>
          <span id={nationId} style={{fontSize:"13px",color:TEXT,fontWeight:600,display:"block",marginBottom:"6px"}}>Where in the UK do you live?</span>
          <PillSlider value={nationOf(d) || ""} onChange={v => { set("ukNation", v); set("scottishTaxpayer", nationAlso(v).scottishTaxpayer); }}
            options={NATION_OPTIONS.map(o => o.value === "ni" ? { ...o, label:"N. Ireland" } : o)} labelledBy={nationId}/>
        </div>
        {/* Between jobs: pay this tax year before stopping (sets this year's tax band). */}
        {d.employmentStatus === "not_working" && d.notWorkingReason === "break" && (
          <div style={{display:"flex",marginTop:"10px"}}>
            <PillMoneyInput label="Earned this tax year, before stopping" value={d.earnedThisTaxYear === "" || d.earnedThisTaxYear == null ? null : +d.earnedThisTaxYear} onChange={v => set("earnedThisTaxYear", v == null ? "" : String(v))}/>
          </div>
        )}
        {showEmploymentInfo && (
          <p style={{fontSize:"12px",color:MUT_ON_CDARK,lineHeight:1.55,marginTop:"8px",background:CDARK,borderRadius:"8px",padding:"8px 10px"}}>
            Whether you're employed, self-employed or not working changes which tax breaks and schemes apply to you, so the figures only use the ones that do.
          </p>
        )}
      </div>

      {totalIncome > 0 && (
        <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"12px 14px",marginBottom:"18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}}>
          <div>
            <div style={{fontSize:"9.5px",fontWeight:700,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"3px"}}>Tax band</div>
            <div style={{fontFamily:SERIF,fontSize:"15px",fontWeight:700,color:G}}>{taxBand}</div>
          </div>
          <div style={{fontSize:"11px",color:MUT,textAlign:"right",maxWidth:"140px",lineHeight:1.4}}>Based on £{totalIncome.toLocaleString("en-GB")} total income</div>
        </div>
      )}

      <span id={trajectoryId} style={fieldLabel}>Salary trajectory</span>
      <PillSlider value={d.salaryTrajectory} onChange={v => { set("salaryTrajectory", v); set("salaryGrowthPct", ""); set("payByYear", []); }} options={TRAJECTORY_OPTIONS} labelledBy={trajectoryId}/>
      <p style={{fontSize:"11.5px",color:MUT,marginTop:"6px",marginBottom:"18px"}}>{TRAJECTORY_HINT[d.salaryTrajectory] || "Used to project your salary over time."}</p>

      <button type="button" onClick={() => setShowAdditionalIncome(v => !v)} aria-expanded={showAdditionalIncome} style={{background:"none",border:"none",color:GOLD_TEXT,fontSize:"13px",fontWeight:600,cursor:"pointer",padding:0,minHeight:"44px",marginBottom:"4px",display:"block"}}>
        {showAdditionalIncome ? "− Hide additional income" : "+ Add bonus / other income"}
      </button>
      {showAdditionalIncome && (
        <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:"18px"}}>
          <div style={{display:"flex",gap:"10px"}}>
            <PillMoneyInput label="Other income /yr" value={d.otherIncome || null} onChange={v => set("otherIncome", capField("otherIncome", v ?? ""))}/>
            <PillMoneyInput label="Dividend income /yr" value={d.dividendIncome || null} onChange={v => set("dividendIncome", capField("dividendIncome", v ?? ""))}/>
          </div>
          <PillMoneyInput label="Annual bonus" value={d.bonusAmount || null} onChange={v => set("bonusAmount", capField("bonusAmount", v ?? ""))}/>
        </div>
      )}

      <label style={fieldLabel}>Monthly essential expenses</label>
      <PillMoneyInput label="Rent, bills, food, transport" value={d.monthlyExpenses || null} onChange={v => set("monthlyExpenses", capField("monthlyExpenses", v ?? ""))}/>
    </div>
  );
}
