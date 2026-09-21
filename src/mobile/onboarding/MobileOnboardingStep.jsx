import { useState } from "react";
import posthog from "posthog-js";
import { AlertTriangle, Landmark, CreditCard, Home, Star, Baby, RefreshCw, Shield, Lightbulb, Check } from "lucide-react";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, MODULE_META, PillSlider } from "../../CandidApp.jsx";
import { capField, isaThisYearTotal } from "../../lib/onboarding.js";
import { estimatePensionPot, CAREER_START_AGE } from "../../lib/pension.js";
import { resolveSlRate } from "../../lib/studentLoan.js";
import { fmt, fmtCompact } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import MobileCashTiersList from "./MobileCashTiersList.jsx";

// The 4 active MVP modules a user can pick from on the "Focus" step — same
// keys/icons as desktop's MODULE_SELECT_TILES (CandidApp.jsx), sourced from
// the shared MODULE_META instead of a second hardcoded list.
const PICKABLE_MODULE_KEYS = ["cash", "investments", "pension", "studentLoan"];

const TRAJECTORY_OPTIONS = [
  { value:"stable", label:"Stable" },
  { value:"moderate", label:"Steady" },
  { value:"high", label:"Rapid" },
];
const TRAJECTORY_HINT = {
  stable: "~2% p.a. salary growth",
  moderate: "~5% p.a. salary growth",
  high: "~15% p.a. salary growth",
};

const YES_NO_OPTIONS = [{ value:"yes", label:"Yes" }, { value:"no", label:"No" }];
const EMERGENCY_FUND_OPTIONS = [{ value:"no", label:"6 months" }, { value:"yes", label:"9 months" }];
const CASH_ACCESS_OPTIONS = [{ value:"yes", label:"Instant access" }, { value:"partial", label:"Partial" }, { value:"no", label:"No" }];
const PENSION_STATUS_OPTIONS = [{ value:"yes", label:"Yes" }, { value:"no", label:"No" }, { value:"unsure", label:"Not sure" }];
const PENSION_TYPE_OPTIONS = [{ value:"sacrifice", label:"Salary sacrifice" }, { value:"relief", label:"Relief at source" }, { value:"", label:"Not sure" }];
const STUDENT_LOAN_OPTIONS = [
  { value:"none", label:"No loan" },
  { value:"plan1", label:"Plan 1" },
  { value:"plan2", label:"Plan 2" },
  { value:"plan5", label:"Plan 5" },
];

// "Your goals" step, right after module selection — same keys/fields as
// desktop's GOAL_TILES (CandidApp.jsx). Multi-select except "exploring",
// which stands in for "none of the above" and clears every other selection.
const GOAL_TILES = [
  { key:"buy_house",          icon:Home,      label:"Buy a house" },
  { key:"big_purchase",       icon:Star,      label:"Saving for a big purchase" },
  { key:"future_generations", icon:Baby,      label:"Money aside for future generations" },
  { key:"consolidate",        icon:RefreshCw, label:"Consolidating what I already have" },
  { key:"emergency_fund",     icon:Shield,    label:"Building an emergency fund" },
  { key:"exploring",          icon:Lightbulb, label:"Just exploring, no specific goal", exclusive:true },
];
const GOAL_TIMEFRAME_OPTIONS = [
  { value:"lt1",   label:"<1 yr"   },
  { value:"1to3",  label:"1-3 yrs" },
  { value:"3to5",  label:"3-5 yrs" },
  { value:"5plus", label:"5+ yrs"  },
];

// Preset-buttons-plus-range-slider for a single £ target — mobile-styled
// twin of desktop's GoalAmountSlider (CandidApp.jsx). A plain function
// declaration, not an object literal, so referencing G/WHITE/SERIF inside its
// body is safe despite the circular-import TDZ hazard noted above: those are
// only read when the function is called at render time, well after
// CandidApp.jsx has finished initializing.
function GoalAmountSlider({ label, value, onChange, max, step, presets }) {
  const v = +value || 0;
  return (
    <div style={{marginBottom:"14px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}>
        <span style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</span>
        <span style={{fontFamily:SERIF,fontSize:"15px",fontWeight:700,color:G}}>{fmt(v)}</span>
      </div>
      <div style={{display:"flex",gap:"6px",marginBottom:"8px",flexWrap:"wrap"}}>
        {presets.map(p => (
          <button key={p} type="button" onClick={() => onChange(String(p))} style={{flex:"1 1 auto",minWidth:"52px",padding:"6px 4px",background:v===p?G:"transparent",border:`1.5px solid ${v===p?G:"rgba(22,47,36,0.2)"}`,borderRadius:"7px",color:v===p?WHITE:G,fontSize:"11px",fontWeight:600,cursor:"pointer"}}>{fmtCompact(p)}</button>
        ))}
      </div>
      <input type="range" min="0" max={max} step={step} value={v} onChange={e => onChange(e.target.value)} style={{width:"100%",accentColor:G}}/>
    </div>
  );
}

// Mobile-native rebuild of desktop's OnboardingStep (CandidApp.jsx) — same
// step ids, same `d`/`set` writes (values land in the exact same fields), but
// mobile-density copy and PillMoneyInput/PillSlider primitives instead of
// desktop's boxed FmtInput/Toggle/two-column Field grids. Steps not yet built
// for mobile fall through to a placeholder rather than blocking the flow —
// Continue isn't disabled on any module-specific step, so onboarding can
// still be completed end to end while later steps are built out.
export default function MobileOnboardingStep({ stepId, d, set }) {
  const [showAdditionalIncome, setShowAdditionalIncome] = useState(false);
  const [potEstimated, setPotEstimated] = useState(false); // true only right after the "estimate it" button is used, so the caption doesn't linger over a manually-typed figure
  const [paymentStaging, setPaymentStaging] = useState({ status:"idle" }); // idle | loading | error
  const stagePayment = async () => {
    setPaymentStaging({ status:"loading" });
    try {
      const res = await fetch("/api/truelayer/stage-payment", { method:"POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || `status ${res.status}`);
      posthog.capture("truelayer_payment_staged", { payment_id: data.paymentId });
      window.location.href = data.hostedPaymentUrl;
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[Candid] Failed to stage TrueLayer payment:", e);
      posthog.capture("truelayer_payment_stage_failed", { reason: e.message });
      setPaymentStaging({ status:"error" });
    }
  };
  // Defined inside the component, not at module scope — this file is part of
  // a circular import with CandidApp.jsx (which imports it via the
  // onboarding screen), so G/SERIF/etc aren't initialized yet when the module
  // itself first evaluates. Safe once read at render time instead.
  const questionHeading = { fontFamily:SERIF, fontSize:"22px", color:G, fontWeight:700, marginBottom:"8px", textAlign:"center" };
  const questionSub = { fontSize:"13px", color:MUT, lineHeight:1.5, textAlign:"center", marginBottom:"24px" };
  const fieldLabel = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:"8px", display:"block" };
  const centeredInput = { width:"100%", maxWidth:"320px", margin:"0 auto", display:"block", textAlign:"center", fontSize:"17px", fontWeight:600, color:TEXT, padding:"14px 18px", borderRadius:"100px", border:"1.5px solid rgba(22,47,36,0.18)", background:WHITE, outline:"none", boxSizing:"border-box" };

  if (stepId === "modules") {
    const modules = MODULE_META.filter(mm => PICKABLE_MODULE_KEYS.includes(mm.key));
    return (
      <div>
        <h2 style={questionHeading}>What do you want Candid to look at?</h2>
        <p style={questionSub}>Pick at least one — you can always add more later.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"12px"}}>
          {modules.map(mm => {
            const selected = (d.selectedModules || []).includes(mm.key);
            return (
              <button key={mm.key} type="button"
                onClick={() => set("selectedModules", selected
                  ? (d.selectedModules || []).filter(k => k !== mm.key)
                  : [...(d.selectedModules || []), mm.key])}
                style={{
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"8px",
                  padding:"22px 12px", borderRadius:"14px", cursor:"pointer",
                  background: selected ? G : WHITE,
                  border: selected ? `2px solid ${GOLD}` : "1.5px solid rgba(22,47,36,0.12)",
                  color: selected ? WHITE : TEXT,
                  transition:"all 0.15s ease",
                }}>
                {mm.icon && <mm.icon size={24} color={selected ? WHITE : G}/>}
                <span style={{fontSize:"13px",fontWeight:600}}>{mm.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (stepId === "goals") {
    const goals = d.financialGoals || [];
    return (
      <div>
        <h2 style={questionHeading}>What are you working towards?</h2>
        <p style={questionSub}>Pick as many as apply — this helps us tailor advice to what matters to you.</p>
        <div style={{display:"flex",flexDirection:"column",gap:"9px"}}>
          {GOAL_TILES.map(({ key, icon:Icon, label, exclusive }) => {
            const selected = goals.includes(key);
            return (
              <button key={key} type="button" onClick={() => {
                if (selected) { set("financialGoals", goals.filter(k => k !== key)); return; }
                if (exclusive) { set("financialGoals", [key]); return; }
                set("financialGoals", [...goals.filter(k => k !== "exploring"), key]);
              }} style={{
                display:"flex",alignItems:"center",gap:"11px",width:"100%",textAlign:"left",
                padding:"12px 14px",borderRadius:"10px",cursor:"pointer",
                background:selected?"rgba(196,150,58,0.08)":WHITE,
                border:`1.5px solid ${selected?GOLD:"rgba(22,47,36,0.14)"}`,
              }}>
                <div style={{width:"32px",height:"32px",borderRadius:"8px",background:selected?G:"rgba(22,47,36,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Icon size={15} color={selected?WHITE:G}/>
                </div>
                <span style={{fontSize:"13px",fontWeight:600,color:TEXT,flex:1}}>{label}</span>
                {selected && <Check size={15} color={GOLD}/>}
              </button>
            );
          })}
        </div>

        {goals.includes("buy_house") && (
          <div style={{marginTop:"20px",padding:"14px",background:"rgba(22,47,36,0.03)",borderRadius:"10px"}}>
            <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"10px"}}>Buying a house</div>
            <GoalAmountSlider label="Target deposit or purchase amount" value={d.houseTargetAmount} onChange={v=>set("houseTargetAmount",capField("houseTargetAmount",v))} max={500000} step={5000} presets={[10000,25000,50000,100000,200000]}/>
            <label style={fieldLabel}>When do you need this by?</label>
            <PillSlider value={d.houseTimeframe} onChange={v=>set("houseTimeframe",v)} options={GOAL_TIMEFRAME_OPTIONS}/>
          </div>
        )}

        {goals.includes("big_purchase") && (
          <div style={{marginTop:"16px",padding:"14px",background:"rgba(22,47,36,0.03)",borderRadius:"10px"}}>
            <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"10px"}}>Big purchase</div>
            <GoalAmountSlider label="Target amount" value={d.bigPurchaseTargetAmount} onChange={v=>set("bigPurchaseTargetAmount",capField("bigPurchaseTargetAmount",v))} max={100000} step={1000} presets={[1000,5000,10000,25000,50000]}/>
            <label style={fieldLabel}>When do you need this by?</label>
            <PillSlider value={d.bigPurchaseTimeframe} onChange={v=>set("bigPurchaseTimeframe",v)} options={GOAL_TIMEFRAME_OPTIONS}/>
          </div>
        )}
      </div>
    );
  }

  if (stepId === "name") return (
    <div style={{paddingTop:"12px"}}>
      <h2 style={questionHeading}>What should we call you?</h2>
      <input style={centeredInput} value={d.name} onChange={e => set("name", e.target.value)} placeholder="Your first name" autoFocus/>
    </div>
  );

  if (stepId === "email") return (
    <div style={{paddingTop:"12px"}}>
      <h2 style={questionHeading}>Where shall we send a backup of your report?</h2>
      <p style={questionSub}>Optional — so you can refer back to it anytime.</p>
      <input type="email" style={centeredInput} value={d.email} onChange={e => set("email", e.target.value)} placeholder="your@email.com"/>
    </div>
  );

  if (stepId === "about") {
    const totalIncome = (+d.salary||0) + (+d.otherIncome||0) + (+d.dividendIncome||0);
    const taxBand = totalIncome > 125140 ? "Additional rate (45%)" : totalIncome > 50270 ? "Higher rate (40%)" : "Basic rate (20%)";
    return (
      <div>
        <h2 style={questionHeading}>Tell us about you</h2>
        <p style={questionSub}>We use this to work out your tax band and how much surplus you have each month.</p>

        <div style={{display:"flex",gap:"10px",marginBottom:"14px"}}>
          <PillMoneyInput label="Age" unit="" value={d.age || null} onChange={v => set("age", v ?? "")}/>
          <PillMoneyInput label="Gross salary" value={d.salary || null} onChange={v => set("salary", capField("salary", v ?? ""))}/>
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

        <label style={fieldLabel}>Salary trajectory</label>
        <PillSlider value={d.salaryTrajectory} onChange={v => set("salaryTrajectory", v)} options={TRAJECTORY_OPTIONS}/>
        <p style={{fontSize:"11.5px",color:MUT,marginTop:"6px",marginBottom:"18px"}}>{TRAJECTORY_HINT[d.salaryTrajectory] || "Used to project your salary over time."}</p>

        <button type="button" onClick={() => setShowAdditionalIncome(v => !v)} style={{background:"none",border:"none",color:GOLD,fontSize:"13px",fontWeight:600,cursor:"pointer",padding:0,marginBottom:"16px",display:"block"}}>
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

  if (stepId === "cash") {
    const isaTotal = isaThisYearTotal(d);
    const isaOver = isaTotal > 20000;
    return (
      <div>
        <h2 style={questionHeading}>Cash & savings</h2>
        <p style={questionSub}>Helps us spot yield gaps and whether your cash is working as hard as it should.</p>

        <button type="button" onClick={() => { window.location.href = `/api/truelayer/auth-link?email=${encodeURIComponent(d.email || "")}`; }} style={{
          display:"flex",alignItems:"center",gap:"9px",width:"100%",textAlign:"left",background:"rgba(22,47,36,0.04)",
          border:`1.5px dashed ${GOLD}`,borderRadius:"10px",padding:"13px 16px",color:G,fontSize:"13px",fontWeight:600,cursor:"pointer",marginBottom:"12px",
        }}>
          <Landmark size={17}/><span>Connect your bank (Sandbox) — auto-fill cash balances</span>
        </button>
        <button type="button" disabled={paymentStaging.status==="loading"} onClick={stagePayment} style={{
          display:"flex",alignItems:"center",gap:"9px",width:"100%",textAlign:"left",background:"rgba(22,47,36,0.04)",
          border:`1.5px dashed ${GOLD}`,borderRadius:"10px",padding:"13px 16px",color:G,fontSize:"13px",fontWeight:600,
          cursor:paymentStaging.status==="loading" ? "default" : "pointer",opacity:paymentStaging.status==="loading" ? 0.6 : 1,
          marginBottom:paymentStaging.status==="error" ? "6px" : "22px",
        }}>
          <CreditCard size={17}/><span>{paymentStaging.status==="loading" ? "Staging test payment…" : "Stage a test payment (Sandbox) — £2,500"}</span>
        </button>
        {paymentStaging.status==="error" && <p style={{fontSize:"12px",color:"#b3261e",marginTop:0,marginBottom:"20px"}}>Couldn't stage the sandbox payment — please try again.</p>}

        <label style={fieldLabel}>Emergency fund target</label>
        <PillSlider value={d.higherBuffer||"no"} onChange={v=>set("higherBuffer",v)} options={EMERGENCY_FUND_OPTIONS}/>
        <p style={{fontSize:"11px",color:MUT,marginTop:"6px",marginBottom:"20px"}}>9 months if self-employed or variable income</p>

        <label style={fieldLabel}>Cash savings accounts</label>
        <p style={{fontSize:"11.5px",color:MUT,marginTop:"-4px",marginBottom:"8px"}}>Add each account separately for an accurate blended rate</p>
        <MobileCashTiersList d={d} set={set}/>

        <div style={{marginTop:"20px"}}/>
        <PillMoneyInput label="Premium bonds" value={d.premiumBonds || null} onChange={v => set("premiumBonds", capField("premiumBonds", v ?? ""))}/>

        <div style={{marginTop:"20px"}}>
          <label style={fieldLabel}>Is your cash easy-access?</label>
          <PillSlider value={d.cashAccessType||""} onChange={v=>set("cashAccessType",v)} options={CASH_ACCESS_OPTIONS}/>
        </div>

        <div style={{marginTop:"20px"}}>
          <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"3px"}}>Cash ISA</div>
          <p style={{fontSize:"11px",color:MUT,marginTop:0,marginBottom:"10px"}}>Counts toward your £20,000 annual ISA allowance</p>
          <div style={{display:"flex",gap:"10px"}}>
            <PillMoneyInput label="Contributed this year" value={d.isaThisYearCash || null} onChange={v => set("isaThisYearCash", capField("isaThisYearCash", v ?? ""))}/>
            <PillMoneyInput label="From previous years" value={d.isaPrevCash || null} onChange={v => set("isaPrevCash", capField("isaPrevCash", v ?? ""))}/>
          </div>
          {isaOver && (
            <div style={{marginTop:"8px",fontSize:"11.5px",color:"#c0392b",fontWeight:700,display:"flex",alignItems:"flex-start",gap:"5px"}}>
              <AlertTriangle size={12} style={{flexShrink:0,marginTop:"1px"}}/><span>Total this year across all ISA types: {fmt(isaTotal)} — exceeds the £20,000 allowance.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (stepId === "investments") {
    const isaTotal = isaThisYearTotal(d);
    const isaOver = isaTotal > 20000;
    const prevTotal = (+d.isaPrevSS||0) + (+d.isaPrevLISA||0) + (+d.isaPrevOther||0);
    return (
      <div>
        <h2 style={questionHeading}>Investments</h2>
        <p style={questionSub}>We'll check whether your investments are sheltered efficiently, and whether any CGT opportunities exist.</p>

        <label style={fieldLabel}>Do you have investments?</label>
        <PillSlider value={d.hasInvestments} onChange={v => set("hasInvestments", v)} options={YES_NO_OPTIONS}/>

        {d.hasInvestments === "yes" && (
          <div style={{marginTop:"22px"}}>
            <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"3px"}}>ISA contributions this tax year</div>
            <p style={{fontSize:"11px",color:MUT,marginTop:0,marginBottom:"10px"}}>Shared £20,000 limit with any Cash ISA</p>
            <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
              <PillMoneyInput label="S&S ISA" value={d.isaThisYearSS || null} onChange={v => set("isaThisYearSS", capField("isaThisYearSS", v ?? ""))}/>
              <PillMoneyInput label="LISA" value={d.isaThisYearLISA || null} onChange={v => set("isaThisYearLISA", capField("isaThisYearLISA", v ?? ""))}/>
              <PillMoneyInput label="Other ISA" value={d.isaThisYearOther || null} onChange={v => set("isaThisYearOther", capField("isaThisYearOther", v ?? ""))}/>
            </div>
            {isaOver && (
              <div style={{marginBottom:"14px",fontSize:"11.5px",color:"#c0392b",fontWeight:700,display:"flex",alignItems:"flex-start",gap:"5px"}}>
                <AlertTriangle size={12} style={{flexShrink:0,marginTop:"1px"}}/><span>Total this year across all ISA types: {fmt(isaTotal)} — exceeds the £20,000 allowance.</span>
              </div>
            )}

            <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"3px",marginTop:"18px"}}>ISA balance from previous years</div>
            <div style={{display:"flex",gap:"8px",marginBottom:"6px"}}>
              <PillMoneyInput label="S&S ISA" value={d.isaPrevSS || null} onChange={v => set("isaPrevSS", capField("isaPrevSS", v ?? ""))}/>
              <PillMoneyInput label="LISA" value={d.isaPrevLISA || null} onChange={v => set("isaPrevLISA", capField("isaPrevLISA", v ?? ""))}/>
              <PillMoneyInput label="Other" value={d.isaPrevOther || null} onChange={v => set("isaPrevOther", capField("isaPrevOther", v ?? ""))}/>
            </div>
            {prevTotal > 0 && <p style={{fontSize:"11.5px",color:MUT,marginTop:0,marginBottom:"18px"}}>Total previous years: {fmt(prevTotal)}</p>}

            <PillMoneyInput label="Investments outside an ISA" value={d.unwrappedValue || null} onChange={v => set("unwrappedValue", capField("unwrappedValue", v ?? ""))}/>
            <div style={{marginTop:"10px"}}>
              <PillMoneyInput label="Estimated unrealised gains" value={d.unrealisedGains || null} onChange={v => set("unrealisedGains", capField("unrealisedGains", v ?? ""))}/>
              <p style={{fontSize:"11px",color:MUT,marginTop:"6px"}}>Profit above what you paid, for investments outside an ISA/pension</p>
            </div>

            <div style={{marginTop:"18px"}}>
              <label style={fieldLabel}>Have you sold any investments or property outside an ISA or pension this tax year?</label>
              <PillSlider value={d.hasSoldAssetsOutsideWrapper || "no"} onChange={v => { set("hasSoldAssetsOutsideWrapper", v); if (v === "no") set("realisedCgtGains", ""); }} options={YES_NO_OPTIONS}/>
              {d.hasSoldAssetsOutsideWrapper === "yes" && (
                <div style={{marginTop:"10px"}}>
                  <p style={{fontSize:"11px",color:MUT,marginTop:0,marginBottom:"8px"}}>We ask this to track your £3,000 CGT allowance.</p>
                  <PillMoneyInput label="Estimated total profit" value={d.realisedCgtGains || null} onChange={v => set("realisedCgtGains", capField("realisedCgtGains", v ?? ""))}/>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (stepId === "pension") {
    const contributing = d.hasPension === "yes";
    return (
      <div>
        <h2 style={questionHeading}>Pension</h2>
        <p style={questionSub}>The single biggest optimisation for most people in your income bracket.</p>

        <label style={fieldLabel}>Do you contribute to a pension?</label>
        <PillSlider value={d.pensionUnknown ? "unsure" : (d.hasPension || "no")} onChange={v => {
          if (v === "unsure") { set("pensionUnknown", true); }
          else { set("pensionUnknown", false); set("hasPension", v); }
        }} options={PENSION_STATUS_OPTIONS}/>

        {d.pensionUnknown ? (
          <div style={{background:"rgba(22,47,36,0.04)",border:"1px solid rgba(22,47,36,0.12)",borderRadius:"10px",padding:"14px",marginTop:"14px"}}>
            <p style={{fontSize:"13px",color:G,lineHeight:1.6,margin:0}}>No problem — this is really common. Your report will walk you through how to find out, and it won't count against your score.</p>
          </div>
        ) : contributing ? (
          <div style={{marginTop:"18px"}}>
            <div style={{display:"flex",gap:"10px",marginBottom:"14px"}}>
              <PillMoneyInput label="Your contribution" unit="%" value={d.myContribution || null} onChange={v => set("myContribution", capField("myContribution", v ?? ""))}/>
              <PillMoneyInput label="Employer match cap" unit="%" value={d.employerMatch || null} onChange={v => set("employerMatch", capField("employerMatch", v ?? ""))}/>
            </div>

            <div style={{display:"flex",gap:"10px",marginBottom:"4px"}}>
              <div style={{flex:1}}>
                <PillMoneyInput label="Main pot value" value={d.potValue || null} onChange={v => { setPotEstimated(false); set("potValue", capField("potValue", v ?? "")); }}/>
                {+d.age > 0 && +d.salary > 0 && (
                  <button type="button" onClick={() => { set("potValue", String(estimatePensionPot(d))); setPotEstimated(true); }} style={{background:"none",border:"none",color:GOLD,fontSize:"11px",fontWeight:600,cursor:"pointer",padding:"4px 0 0",display:"block"}}>
                    Don't know? Estimate it
                  </button>
                )}
              </div>
              <div style={{flex:1}}>
                <PillMoneyInput label="Other pots combined" value={d.potValue2 || null} onChange={v => set("potValue2", capField("potValue2", v ?? ""))}/>
              </div>
            </div>
            {potEstimated && +d.potValue > 0 && (
              <p style={{fontSize:"10.5px",color:MUT,lineHeight:1.5,marginTop:"6px",marginBottom:"14px"}}>
                Estimated assuming you've worked and contributed since age {CAREER_START_AGE}, at{" "}
                {((+d.myContribution||0)+(+d.employerMatch||0)) > 0 ? `your stated ${(+d.myContribution||0)+(+d.employerMatch||0)}% combined rate` : "the UK auto-enrolment minimum (8%)"}, growing at 6% p.a. — a rough order of magnitude, not a real balance.
              </p>
            )}

            <div style={{display:"flex",gap:"10px",marginTop:"14px",marginBottom:"18px"}}>
              <PillMoneyInput label="Target retirement age" unit="" value={d.retirementAge || null} onChange={v => set("retirementAge", Math.min(80, v ?? 0) || "")}/>
              <PillMoneyInput label="NI years completed" unit="" value={d.niYears || null} onChange={v => set("niYears", v == null ? "" : String(Math.min(35, Math.max(0, v))))}/>
            </div>
            <p style={{fontSize:"11px",color:MUT,marginTop:"-12px",marginBottom:"18px"}}>35 NI years gives the full State Pension — check yours free at gov.uk/check-state-pension</p>

            <label style={fieldLabel}>How are contributions made?</label>
            <PillSlider value={d.pensionType||""} onChange={v=>set("pensionType",v)} options={PENSION_TYPE_OPTIONS}/>
            <p style={{fontSize:"11px",color:MUT,marginTop:"6px",lineHeight:1.5}}>
              {d.pensionType==="sacrifice" ? "Comes off your gross pay before tax — check your payslip for a deduction before income tax." :
               d.pensionType==="relief"   ? "Comes from your take-home pay — your provider claims basic rate relief, you claim higher rate via self-assessment." :
               "Check your payslip — if the deduction appears before tax is calculated, it's likely salary sacrifice."}
            </p>
          </div>
        ) : (
          <div style={{background:"rgba(196,150,58,0.08)",border:"1px solid rgba(196,150,58,0.3)",borderRadius:"10px",padding:"14px",marginTop:"14px"}}>
            <p style={{fontSize:"13px",color:G,lineHeight:1.6,margin:0}}><strong>This is likely your biggest financial gap.</strong> We'll quantify exactly what it's costing you.</p>
          </div>
        )}
      </div>
    );
  }

  if (stepId === "studentLoan") {
    // Live default rate for the plan/salary combo, shown as a placeholder
    // (not a stored value) so it visibly updates as the plan slider changes —
    // resolveSlRate is the same function the rest of the app uses, so this
    // preview always matches what's actually applied if the field is left blank.
    const defaultRatePct = (d.studentLoan !== "none" && +d.salary > 0)
      ? (resolveSlRate(d, +d.salary) * 100).toFixed(1)
      : "0.0";
    return (
      <div>
        <h2 style={questionHeading}>Student loan</h2>
        <p style={questionSub}>Understanding your loan lets us work out whether overpaying is actually worth it.</p>

        <label style={fieldLabel}>Student loan</label>
        <PillSlider value={d.studentLoan} onChange={v => set("studentLoan", v)} options={STUDENT_LOAN_OPTIONS}/>

        {d.studentLoan !== "none" && (
          <div style={{marginTop:"18px"}}>
            <div style={{display:"flex",gap:"10px"}}>
              <PillMoneyInput label="Outstanding balance" value={d.loanBalance || null} onChange={v => set("loanBalance", capField("loanBalance", v ?? ""))}/>
              <PillMoneyInput label="Current interest rate" unit="%" placeholder={defaultRatePct} value={d.studentLoanRate || null} onChange={v => set("studentLoanRate", v ?? "")}/>
            </div>
            <p style={{fontSize:"11px",color:MUT,marginTop:"6px"}}>Optional — we'll use an estimated {defaultRatePct}% for this plan and salary unless you enter your actual rate from your SLC online account</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback for any step id not handled above (shouldn't occur — every
  // ALL_STEP_DEFS id is built) — keeps onboarding completable even if a new
  // step id is added here before its mobile content is.
  const stepMeta = MODULE_META.find(mm => mm.key === stepId);
  return (
    <div style={{textAlign:"center",padding:"40px 20px"}}>
      <h2 style={questionHeading}>{stepMeta?.title || "This step"}</h2>
      <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.6}}>This step isn't built for mobile yet — tap Continue for now, or finish this on desktop.</p>
    </div>
  );
}
