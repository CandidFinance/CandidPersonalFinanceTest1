import { useState } from "react";
import { Lock, ChevronDown, X, Plus, Layers } from "lucide-react";
import { MAX_PLANS, newPlan } from "../../lib/loanPlan.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import WheelPicker from "../WheelPicker.jsx";
import { PillSlider } from "../PillSlider.jsx";
import SubscribeButtons from "./SubscribeButtons.jsx";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, STUDENT_PURPLE } from "../../design-tokens.js";

// "Scenario modelling" at the top of the student loan page's figures to
// try: a collapsed tile, marked as a subscriber feature for everyone, that
// opens to the repayment plan builder (lib/loanPlan.js) for subscribers, or
// a blurred example and the way to subscribe for anyone else.
//
// Plans are saved with their answers (d.slPlans, up to MAX_PLANS), and the
// one picked (d.slPlanShown) is drawn on the balance chart beside the lump
// sum, so the two can be compared. `run`: the picked plan run against the
// loan (loanPlan.js runPlan), worked out by the page.

const badge = locked => (
  <span style={{display:"inline-flex",alignItems:"center",gap:"4px",background:"rgba(196,150,58,0.14)",color:"#8a6a24",borderRadius:"100px",padding:"3px 8px",fontSize:"10px",fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",flexShrink:0}}>
    {locked && <Lock size={10} strokeWidth={2.6}/>}Subscribers
  </span>
);

export default function ScenarioModelling({ d, m, sl, set, open, run }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{background:WHITE,border:"1px solid rgba(22,47,36,0.12)",borderRadius:"12px",padding:"12px 14px",marginBottom:"16px",boxShadow:"0 1px 3px rgba(22,47,36,0.06)"}}>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(e => !e)} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",background:"none",border:"none",padding:0,fontFamily:"inherit",cursor:"pointer",textAlign:"left"}}>
        <Layers size={17} color={STUDENT_PURPLE} style={{flexShrink:0}}/>
        <span style={{flex:1,minWidth:0}}>
          <span style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
            <span style={{fontSize:"14px",fontWeight:700,color:TEXT}}>Scenario modelling</span>
            {badge(!open)}
          </span>
          <span style={{display:"block",fontSize:"12px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>Plan lump sums and monthly overpayments, year by year.</span>
        </span>
        <ChevronDown size={16} color={MUT} style={{flexShrink:0,transition:"transform 0.15s",transform:expanded ? "rotate(180deg)" : "none"}}/>
      </button>
      {expanded && (open ? <PlanBuilder d={d} m={m} sl={sl} set={set} run={run}/> : <Locked d={d}/>)}
    </div>
  );
}

// A year on the wheel, earliest first: "April 2027".
const yearItems = (from, to, blank = null) => [
  ...(blank ? [{ value: "", label: blank }] : []),
  ...Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => ({ value: String(from + i), label: `April ${from + i}` })),
];
const describe = it => it.kind === "once"
  ? `${fmt(+it.amount)} in April ${it.year}`
  : `${fmt(+it.amount)} a month from April ${it.from}${+it.to > 0 ? ` to March ${+it.to + 1}` : ", until it's cleared"}`;

function PlanBuilder({ d, m, sl, set, run }) {
  const taxYear = sl.writeOffTaxYear - sl.writeOffYr;
  const lastYear = taxYear + (sl.willClear ? sl.clearYr : sl.writeOffYr) - 1;
  const plans = d.slPlans || [];
  const plan = plans.find(p => p.id === d.slPlanShown) || null;
  const [adding, setAdding] = useState(null); // "once" | "monthly"
  const blank = { amount: null, year: String(taxYear), from: String(taxYear), to: "" };
  const [draft, setDraft] = useState(blank);

  const savePlan = next => set("slPlans", plans.map(p => p.id === next.id ? next : p));
  const start = () => {
    const p = newPlan(plans);
    set("slPlans", [...plans, p]);
    set("slPlanShown", p.id);
    setAdding("once"); setDraft(blank);
  };
  const remove = () => {
    set("slPlans", plans.filter(p => p.id !== plan.id));
    set("slPlanShown", "");
    setAdding(null);
  };
  const add = () => {
    const item = adding === "once"
      ? { id: `i${Date.now().toString(36)}`, kind: "once", amount: String(draft.amount), year: draft.year }
      : { id: `i${Date.now().toString(36)}`, kind: "monthly", amount: String(draft.amount), from: draft.from, to: draft.to };
    savePlan({ ...plan, items: [...plan.items, item] });
    setAdding(null); setDraft(blank);
  };
  const canAdd = draft.amount > 0 && (adding === "once" ? !!draft.year : !!draft.from && (!draft.to || +draft.to >= +draft.from));

  const label = { fontSize:"10px", color:MUT, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase", marginBottom:"6px" };
  const ghost = { display:"inline-flex", alignItems:"center", gap:"5px", background:"none", border:`1px dashed ${GOLD}`, borderRadius:"100px", padding:"7px 12px", color:GOLD, fontSize:"12px", fontWeight:600, fontFamily:"inherit", cursor:"pointer" };
  const solid = on => ({ flex:1, background:on ? G : "rgba(22,47,36,0.2)", color:WHITE, border:"none", borderRadius:"100px", padding:"10px", fontSize:"13px", fontWeight:600, fontFamily:"inherit", cursor:on ? "pointer" : "not-allowed" });
  const outline = { flex:1, background:WHITE, color:G, border:"1.3px solid rgba(22,47,36,0.2)", borderRadius:"100px", padding:"10px", fontSize:"13px", fontWeight:600, fontFamily:"inherit", cursor:"pointer" };
  const stat = (name, value) => (
    <div>
      <div style={{fontSize:"9.5px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{name}</div>
      <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>{value}</div>
    </div>
  );
  const saved = run ? run.base.totalPaid - run.totalPaid : 0;

  return (
    <div style={{marginTop:"14px",borderTop:"1px solid rgba(22,47,36,0.08)",paddingTop:"12px"}}>
      <div style={label}>Your plans</div>
      <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
        {plans.length > 0 && (
          <div style={{flex:1,minWidth:0}}>
            <PillSlider compact value={d.slPlanShown || ""} onChange={v => { set("slPlanShown", v); setAdding(null); }}
              options={[{ value:"", label:"None" }, ...plans.map(p => ({ value:p.id, label:p.name }))]}/>
          </div>
        )}
        {plans.length < MAX_PLANS && <button type="button" onClick={start} style={ghost}><Plus size={13}/>New plan</button>}
      </div>

      {plan && (
        <div style={{marginTop:"12px"}}>
          {plan.items.length === 0 && !adding && <p style={{fontSize:"12.5px",color:MUT,margin:"0 0 8px"}}>Add a payment to see {plan.name} on the chart.</p>}
          {plan.items.map(it => (
            <div key={it.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 0",borderBottom:"1px solid rgba(22,47,36,0.08)"}}>
              <span style={{flex:1,fontSize:"13.5px",color:TEXT,fontWeight:600}}>{describe(it)}</span>
              <button type="button" aria-label={`Remove ${describe(it)}`} onClick={() => savePlan({ ...plan, items: plan.items.filter(x => x.id !== it.id) })} style={{background:"none",border:"none",padding:"4px",cursor:"pointer",color:MUT}}><X size={15}/></button>
            </div>
          ))}

          {adding ? (
            <div style={{marginTop:"10px",display:"flex",flexDirection:"column",gap:"10px"}}>
              <PillMoneyInput label={adding === "once" ? "One-off payment" : "Each month"} value={draft.amount} onChange={v => setDraft(x => ({ ...x, amount: v }))}/>
              {adding === "once" ? (
                <div>
                  <div style={label}>Paid in</div>
                  <WheelPicker label="Paid in" items={yearItems(taxYear, lastYear)} value={draft.year} onChange={v => setDraft(x => ({ ...x, year: v || String(taxYear) }))}/>
                </div>
              ) : (
                <div style={{display:"flex",gap:"8px"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={label}>From</div>
                    <WheelPicker label="From" items={yearItems(taxYear, lastYear)} value={draft.from} onChange={v => setDraft(x => ({ ...x, from: v || String(taxYear) }))}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={label}>Until</div>
                    <WheelPicker label="Until" items={yearItems(+draft.from || taxYear, lastYear, "It's cleared")} value={draft.to} onChange={v => setDraft(x => ({ ...x, to: v }))}/>
                  </div>
                </div>
              )}
              {adding === "monthly" && (m.monthlySurplus || 0) > 0 && (
                <p style={{fontSize:"11.5px",color:MUT,margin:0}}>About {fmt(Math.round(m.monthlySurplus))} a month is left after your spending.</p>
              )}
              <div style={{display:"flex",gap:"8px"}}>
                <button type="button" onClick={() => { setAdding(null); setDraft(blank); }} style={outline}>Cancel</button>
                <button type="button" disabled={!canAdd} onClick={add} style={solid(canAdd)}>Add</button>
              </div>
            </div>
          ) : (
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginTop:"10px"}}>
              <button type="button" onClick={() => { setAdding("once"); setDraft(blank); }} style={ghost}><Plus size={13}/>One-off payment</button>
              <button type="button" onClick={() => { setAdding("monthly"); setDraft(blank); }} style={ghost}><Plus size={13}/>Monthly payments</button>
            </div>
          )}

          {run && run.paidIn > 0 && (
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginTop:"14px"}}>
                {stat(run.clearYr === 0 ? "Cleared" : run.clearYr ? "Clears in" : "Written off", run.clearYr === 0 ? "Today" : run.clearYr ? `${run.clearYr} yrs` : fmt(run.writeOffBal))}
                {stat(saved >= 0 ? "Saves in all" : "Costs more", fmt(Math.abs(saved)))}
                {stat("You'd pay in all", fmt(run.totalPaid))}
              </div>
              <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>
                {fmt(run.paidIn)} paid in by {plan.name}, against {run.base.clearYr ? `clearing in ${run.base.clearYr} yrs` : `${fmt(run.base.writeOffBal)} written off`} and {fmt(run.base.totalPaid)} paid in all, as it is.
                {" "}Valued today, counting what the money would earn in savings at {sl.cashRate}%, it costs {fmt(Math.abs(run.paidToday - run.base.paidToday))} {run.paidToday <= run.base.paidToday ? "less" : "more"}.
              </p>
            </>
          )}

          <button type="button" onClick={remove} style={{background:"none",border:"none",padding:"12px 0 0",color:MUT,fontSize:"12px",fontWeight:600,textDecoration:"underline",fontFamily:"inherit",cursor:"pointer"}}>Delete {plan.name}</button>
        </div>
      )}
      {plans.length === 0 && <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>Make a plan of one-off and monthly payments, and see it on the chart beside the lump sum. Up to {MAX_PLANS} plans, saved.</p>}
    </div>
  );
}

// Anyone else: an example plan, blurred, and the way to subscribe.
function Locked({ d }) {
  const example = ["£5,000 in April 2027", "£200 a month, until it's cleared"];
  return (
    <div style={{position:"relative",marginTop:"14px",borderTop:"1px solid rgba(22,47,36,0.08)",paddingTop:"12px"}}>
      <div aria-hidden="true" inert="" style={{filter:"blur(5px)",userSelect:"none",pointerEvents:"none"}}>
        {example.map(t => <div key={t} style={{padding:"8px 0",borderBottom:"1px solid rgba(22,47,36,0.08)",fontSize:"13.5px",fontWeight:600,color:TEXT}}>{t}</div>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginTop:"12px",fontFamily:SERIF,fontSize:"18px",fontWeight:700,color:G}}>
          <span>3 yrs</span><span>£4,210</span><span>£16,900</span>
        </div>
      </div>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"10px",textAlign:"center"}}>
        <span style={{fontSize:"12.5px",fontWeight:600,color:G,lineHeight:1.45,maxWidth:"260px"}}>Plan payments year by year and compare them with a lump sum, with a subscription</span>
        <SubscribeButtons d={d} module="studentLoan" from="scenario_modelling"/>
      </div>
    </div>
  );
}
