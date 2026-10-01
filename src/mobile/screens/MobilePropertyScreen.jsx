import { Home } from "lucide-react";
import { G, MUT, TEXT, SERIF, PillSlider } from "../../CandidApp.jsx";
import { capField } from "../../lib/onboarding.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import DecisionWaterfall from "../property/DecisionWaterfall.jsx";
import BorrowingCheck from "../property/BorrowingCheck.jsx";

// Property module, phase 1 of the Rent vs Buy build: the decision waterfall
// and the borrowing check. The year-by-year rent vs buy engine comes later.
// Not in MODULE_META yet: that list drives scoring, the £-impact sort, the AI
// prompt and the PDF, and Property has no £ figure until the engine exists.

const BUYING_MODE_OPTIONS = [{ value:"alone", label:"Buying alone" }, { value:"together", label:"Buying together" }];
const divider = { border:"none", borderTop:"1px solid rgba(22,47,36,0.1)", margin:"26px 0 22px" };

export default function MobilePropertyScreen({ d, m, set, onAddInputs }) {
  const together = d.propertyBuyingMode === "together";

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"14px"}}>
        <div style={{width:"42px",height:"42px",borderRadius:"11px",background:"rgba(22,47,36,0.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Home size={18} color={G}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,margin:0,lineHeight:1.2}}>Property</h1>
          <div style={{fontSize:"12.5px",color:MUT,marginTop:"3px"}}>Buying a home</div>
        </div>
      </div>
      <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.55,margin:"0 0 16px"}}>
        A first look at buying a home: what usually comes before a deposit, and how much you'd need to borrow. A year-by-year rent vs buy comparison is coming next.
      </p>

      <PillSlider value={together ? "together" : "alone"} onChange={v => set("propertyBuyingMode", v)} options={BUYING_MODE_OPTIONS}/>

      {together && (
        <div style={{marginTop:"20px"}}>
          <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"3px"}}>Your partner</div>
          <p style={{fontSize:"11px",color:MUT,lineHeight:1.5,margin:"0 0 10px"}}>
            Used to check their employer match and ISA allowance, and added to your income for the borrowing check.
          </p>
          <div style={{display:"flex",gap:"10px",marginBottom:"10px"}}>
            <PillMoneyInput label="Salary" value={+d.partnerSalary || null} onChange={v => set("partnerSalary", capField("salary", v ?? ""))}/>
            <PillMoneyInput label="Other income" value={+d.partnerOtherIncome || null} onChange={v => set("partnerOtherIncome", capField("otherIncome", v ?? ""))}/>
          </div>
          <div style={{display:"flex",gap:"10px",marginBottom:"10px"}}>
            <PillMoneyInput label="Pension contribution" unit="%" value={d.partnerMyContribution || null} onChange={v => set("partnerMyContribution", capField("myContribution", v ?? ""))}/>
            <PillMoneyInput label="Employer match cap" unit="%" value={d.partnerEmployerMatch || null} onChange={v => set("partnerEmployerMatch", capField("employerMatch", v ?? ""))}/>
          </div>
          <div style={{display:"flex",gap:"10px"}}>
            <PillMoneyInput label="ISA paid in this tax year" value={+d.partnerIsaThisYear || null} onChange={v => set("partnerIsaThisYear", capField("isaThisYearOther", v ?? ""))}/>
          </div>
        </div>
      )}

      <hr style={divider}/>
      <DecisionWaterfall d={d} m={m} set={set} onAddInputs={onAddInputs}/>

      <hr style={divider}/>
      <BorrowingCheck d={d} m={m} set={set}/>

      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,marginTop:"26px"}}>
        Candid is guidance, not regulated financial advice. These figures show where things stand; the right decision depends on your full circumstances.
      </p>
    </div>
  );
}
