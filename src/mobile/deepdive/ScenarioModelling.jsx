import { useState } from "react";
import { Lock, ChevronDown, X, Plus, Layers, Pencil, CircleAlert } from "lucide-react";
import { MAX_PLANS, MONTHS, newPlan, monthsFrom } from "../../lib/loanPlan.js";
import { payPathOf } from "../../lib/metrics.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import WheelPicker from "../WheelPicker.jsx";
import { PillSlider } from "../PillSlider.jsx";
import SubscribeButtons from "./SubscribeButtons.jsx";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, CTA_BLUE, CRITICAL } from "../../design-tokens.js";

// "Scenario modelling" at the top of the student loan page's figures to
// try: a collapsed tile, marked as a subscriber feature for everyone, that
// opens to the repayment plan builder (lib/loanPlan.js) for subscribers, or
// a blurred example and the way to subscribe for anyone else. In the pale
// blue of Home's "Since your last visit" (SinceLastVisit.jsx), as a
// subscriber feature, with a sheen passing over it like the Opportunity
// tile's (OpportunityTile.jsx).
//
// Plans are saved with their answers (d.slPlans, up to MAX_PLANS), and the
// one picked (d.slPlanShown) is drawn on the balance chart beside the lump
// sum, so the two can be compared. `run`: the picked plan run against the
// loan (loanPlan.js runPlan), worked out by the page. `onPlanSaved`: called
// when a payment is added or changed, so the page can show it on the chart.

const CSS = `
.sm-tile { position: relative; overflow: hidden; }
.sm-tile > * { position: relative; z-index: 1; }
.sm-tile::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 260%; z-index: 0; pointer-events: none;
  background: linear-gradient(112deg, transparent 32%, rgba(255,255,255,0.75) 46%, transparent 60%);
  will-change: transform; animation: sm-sheen 7s ease-in-out infinite; }
@keyframes sm-sheen { 0% { transform: translateX(-75%); } 55%, 100% { transform: translateX(25%); } }
@media (prefers-reduced-motion: reduce) { .sm-tile::after { animation: none; transform: translateX(-30%); } }
.sm-tile.sm-open::after { display: none; }
`;

export default function ScenarioModelling({ d, m, sl, set, open, run, onPlanSaved }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={expanded ? "sm-tile sm-open" : "sm-tile"} style={{background:"rgba(0,113,227,0.06)",border:`1.5px solid ${CTA_BLUE}`,borderRadius:"12px",padding:"12px 14px",marginBottom:"14px",boxShadow:"0 4px 16px rgba(0,113,227,0.12)"}}>
      <style>{CSS}</style>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(e => !e)} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",background:"none",border:"none",padding:0,fontFamily:"inherit",cursor:"pointer",textAlign:"left"}}>
        <Layers size={17} color={CTA_BLUE} style={{flexShrink:0}}/>
        <span style={{flex:1,minWidth:0}}>
          <span style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
            <span style={{fontSize:"14px",fontWeight:700,color:CTA_BLUE}}>Scenario modelling</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:"4px",background:CTA_BLUE,color:WHITE,borderRadius:"100px",padding:"3px 8px",fontSize:"10px",fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase"}}>
              {!open && <Lock size={10} strokeWidth={2.6}/>}Subscribers
            </span>
          </span>
          <span style={{display:"block",fontSize:"12px",color:TEXT,lineHeight:1.45,marginTop:"2px"}}>Your pay year by year, and plans of lump sums and monthly overpayments.</span>
        </span>
        <ChevronDown size={16} color={CTA_BLUE} style={{flexShrink:0,transition:"transform 0.15s",transform:expanded ? "rotate(180deg)" : "none"}}/>
      </button>
      {expanded && (
        <div style={{background:WHITE,borderRadius:"10px",padding:"2px 12px 12px",marginTop:"12px"}}>
          {open ? <><PayByYear d={d} m={m} sl={sl} set={set}/><PlanBuilder d={d} m={m} sl={sl} set={set} run={run} onSaved={onPlanSaved}/></> : <Locked d={d}/>}
        </div>
      )}
    </div>
  );
}

const describe = it => it.kind === "once"
  ? `${fmt(+it.amount)} in ${MONTHS[(+it.month || 4) - 1]} ${it.year}`
  : `${fmt(+it.amount)} a month from April ${it.from}${+it.to > 0 ? ` to March ${+it.to + 1}` : ", until it's cleared"}`;

// Whether they could pay it: a one-off (with the one-offs before it) against
// their cash above the emergency buffer today; monthly payments against what
// they have left each month after spending. Null when it fits.
// { level: "over" | "close" | "unknown", text }.
function affordability(m, it, before = 0) {
  const amount = +it.amount || 0;
  if (m.expensesUnknown) return { level: "unknown", text: "Add your monthly spending in Cash & savings to check this fits." };
  if (it.kind === "once") {
    const spare = m.surplusCash || 0, total = before + amount;
    if (total <= spare) return null;
    return { level: "over", text: spare > 0
      ? `${before > 0 ? "With the payments before it, more" : "More"} than the ${fmt(Math.round(spare))} you have above your ${m.bufferMonths}-month cash buffer today.`
      : `You have no cash above your ${m.bufferMonths}-month buffer today, so this would come from it.` };
  }
  const left = Math.round(m.monthlySurplus || 0);
  if (amount > left) return { level: "over", text: `More than the ${fmt(left)} a month you have left after your spending.` };
  if (amount > left * 0.8) return { level: "close", text: `Close to all of the ${fmt(left)} a month you have left after your spending.` };
  return null;
}
const FLAG = { over: CRITICAL, close: GOLD, unknown: MUT };
const Flag = ({ check }) => check && (
  <div style={{display:"flex",gap:"6px",alignItems:"flex-start",fontSize:"11.5px",lineHeight:1.45,color:check.level === "unknown" ? MUT : TEXT,marginTop:"4px"}}>
    <CircleAlert size={13} color={FLAG[check.level]} style={{flexShrink:0,marginTop:"1px"}}/>{check.text}
  </div>
);

function PlanBuilder({ d, m, sl, set, run, onSaved }) {
  const now = new Date();
  const years = sl.willClear ? sl.clearYr : sl.writeOffYr;
  const taxYear = sl.writeOffTaxYear - sl.writeOffYr;
  const lastYear = taxYear + years - 1;
  const plans = d.slPlans || [];
  const plan = plans.find(p => p.id === d.slPlanShown) || null;
  const [adding, setAdding] = useState(null); // "once" | "monthly"
  const [editing, setEditing] = useState(null); // the item's id
  const [naming, setNaming] = useState(false);
  const blank = { amount: null, month: String(now.getMonth() + 1), year: String(now.getFullYear()), from: String(taxYear), to: "" };
  const [draft, setDraft] = useState(blank);

  const savePlan = next => set("slPlans", plans.map(p => p.id === next.id ? next : p));
  const start = () => {
    const p = newPlan(plans);
    set("slPlans", [...plans, p]);
    set("slPlanShown", p.id);
    setAdding("once"); setEditing(null); setDraft(blank);
  };
  const remove = () => {
    set("slPlans", plans.filter(p => p.id !== plan.id));
    set("slPlanShown", "");
    setAdding(null); setEditing(null);
  };
  const close = () => { setAdding(null); setEditing(null); setDraft(blank); };
  const openForm = (kind, item = null) => {
    setAdding(kind); setEditing(item?.id || null);
    setDraft(item ? { ...blank, ...item, amount: +item.amount, month: String(item.month || 4) } : blank);
  };
  const save = () => {
    const item = adding === "once"
      ? { id: editing || `i${Date.now().toString(36)}`, kind: "once", amount: String(draft.amount), month: draft.month, year: draft.year }
      : { id: editing || `i${Date.now().toString(36)}`, kind: "monthly", amount: String(draft.amount), from: draft.from, to: draft.to };
    savePlan({ ...plan, items: editing ? plan.items.map(x => x.id === editing ? item : x) : [...plan.items, item] });
    close();
    onSaved?.();
  };
  const ahead = adding === "once" ? monthsFrom(now, +draft.year, +draft.month) : 0;
  const whenOk = adding === "once" ? ahead >= 0 && ahead < years * 12 : !!draft.from && (!draft.to || +draft.to >= +draft.from);
  const canSave = draft.amount > 0 && whenOk;
  const hasMonthly = plan?.items.some(x => x.kind === "monthly");
  // One-offs in date order, each checked with the ones before it.
  const onceOrder = (plan?.items || []).filter(x => x.kind === "once").sort((a, b) => monthsFrom(now, +a.year, +a.month || 4) - monthsFrom(now, +b.year, +b.month || 4));
  const checkOf = it => {
    if (it.kind !== "once") return affordability(m, it);
    const before = onceOrder.slice(0, onceOrder.indexOf(it)).reduce((t, x) => t + (+x.amount || 0), 0);
    return affordability(m, it, before);
  };
  const draftCheck = draft.amount > 0 ? affordability(m, { kind: adding, amount: draft.amount }) : null;

  const label = { fontSize:"10px", color:MUT, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase", marginBottom:"6px" };
  const ghost = { display:"inline-flex", alignItems:"center", gap:"5px", background:"none", border:`1px dashed ${GOLD}`, borderRadius:"100px", padding:"7px 12px", color:GOLD, fontSize:"12px", fontWeight:600, fontFamily:"inherit", cursor:"pointer" };
  const solid = on => ({ flex:1, background:on ? G : "rgba(22,47,36,0.2)", color:WHITE, border:"none", borderRadius:"100px", padding:"10px", fontSize:"13px", fontWeight:600, fontFamily:"inherit", cursor:on ? "pointer" : "not-allowed" });
  const outline = { flex:1, background:WHITE, color:G, border:"1.3px solid rgba(22,47,36,0.2)", borderRadius:"100px", padding:"10px", fontSize:"13px", fontWeight:600, fontFamily:"inherit", cursor:"pointer" };
  const iconBtn = { background:"none", border:"none", padding:"4px", cursor:"pointer", color:MUT, display:"flex" };
  const tile = { background:"rgba(22,47,36,0.04)", borderRadius:"12px", padding:"10px", minWidth:0 };
  const stat = (name, value) => (
    <div style={tile}>
      <div style={{fontSize:"9.5px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{name}</div>
      <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>{value}</div>
    </div>
  );
  const saved = run ? run.base.totalPaid - run.totalPaid : 0;
  // This year's months from this one on: a one-off can't be in the past. A
  // saved one-off whose month has since passed keeps its month on the wheel
  // while it's changed, so the wheel shows what's stored.
  const monthItems = MONTHS.map((name, i) => ({ value: String(i + 1), label: name })).filter(o => +draft.year !== now.getFullYear() || +o.value >= now.getMonth() + 1 || o.value === draft.month);
  const years12 = Array.from({ length: lastYear - now.getFullYear() + 2 }, (_, i) => now.getFullYear() + i).filter(y => y <= lastYear + 1);

  return (
    <div style={{marginTop:"12px"}}>
      <div style={label}>Your plans</div>
      <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
        {plans.length > 0 && (
          <div style={{flex:1,minWidth:0}}>
            <PillSlider compact value={d.slPlanShown || ""} onChange={v => { set("slPlanShown", v); close(); setNaming(false); }}
              options={[{ value:"", label:"None" }, ...plans.map(p => ({ value:p.id, label:p.name }))]}/>
          </div>
        )}
        {plans.length < MAX_PLANS && <button type="button" onClick={start} style={ghost}><Plus size={13}/>New plan</button>}
      </div>

      {plan && (
        <div style={{marginTop:"12px"}}>
          {/* Its name, renamed in place. */}
          {naming ? (
            <form onSubmit={e => { e.preventDefault(); setNaming(false); }} style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"6px"}}>
              <input autoFocus maxLength={20} value={plan.name} aria-label="Plan name" onChange={e => savePlan({ ...plan, name: e.target.value })}
                onBlur={() => { if (!plan.name.trim()) savePlan({ ...plan, name: newPlan(plans.filter(p => p.id !== plan.id)).name }); setNaming(false); }}
                style={{flex:1,fontSize:"14px",fontWeight:700,color:TEXT,border:"1.5px solid rgba(22,47,36,0.25)",borderRadius:"8px",padding:"6px 10px",fontFamily:"inherit"}}/>
              <button type="submit" style={{...outline,flex:"0 0 auto",padding:"6px 14px"}}>Done</button>
            </form>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}>
              <span style={{fontSize:"14px",fontWeight:700,color:TEXT}}>{plan.name}</span>
              <button type="button" aria-label={`Rename ${plan.name}`} onClick={() => setNaming(true)} style={iconBtn}><Pencil size={13}/></button>
            </div>
          )}

          {plan.items.length === 0 && !adding && <p style={{fontSize:"12.5px",color:MUT,margin:"0 0 8px"}}>Add a payment to see {plan.name} on the chart.</p>}
          {plan.items.map(it => (
            <div key={it.id} style={{padding:"8px 0",borderBottom:"1px solid rgba(22,47,36,0.08)",opacity:editing === it.id ? 0.45 : 1}}>
              <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                <span style={{flex:1,fontSize:"13.5px",color:TEXT,fontWeight:600}}>{describe(it)}</span>
                <button type="button" aria-label={`Change ${describe(it)}`} onClick={() => openForm(it.kind, it)} style={iconBtn}><Pencil size={14}/></button>
                <button type="button" aria-label={`Remove ${describe(it)}`} onClick={() => { savePlan({ ...plan, items: plan.items.filter(x => x.id !== it.id) }); if (editing === it.id) close(); }} style={iconBtn}><X size={15}/></button>
              </div>
              <Flag check={checkOf(it)}/>
            </div>
          ))}

          {adding ? (
            <div style={{marginTop:"10px",display:"flex",flexDirection:"column",gap:"10px"}}>
              <PillMoneyInput label={adding === "once" ? "One-off payment" : "Each month"} value={draft.amount} onChange={v => setDraft(x => ({ ...x, amount: v }))}/>
              {adding === "once" ? (
                <div style={{display:"flex",gap:"8px"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={label}>Month</div>
                    <WheelPicker label="Month" items={monthItems} value={draft.month} onChange={v => setDraft(x => ({ ...x, month: v }))}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={label}>Year</div>
                    <WheelPicker label="Year" items={years12.map(y => ({ value: String(y), label: String(y) }))} value={draft.year} onChange={v => setDraft(x => ({ ...x, year: v, month: +v === now.getFullYear() && +x.month < now.getMonth() + 1 ? String(now.getMonth() + 1) : x.month }))}/>
                  </div>
                </div>
              ) : (
                <div style={{display:"flex",gap:"8px"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={label}>From April</div>
                    <WheelPicker label="From April" items={Array.from({ length: lastYear - taxYear + 1 }, (_, i) => ({ value: String(taxYear + i), label: String(taxYear + i) }))} value={draft.from} onChange={v => setDraft(x => ({ ...x, from: v }))}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={label}>Until March</div>
                    <WheelPicker label="Until March" items={[{ value: "", label: "It's cleared" }, ...Array.from({ length: Math.max(0, lastYear - (+draft.from || taxYear) + 1) }, (_, i) => ({ value: String((+draft.from || taxYear) + i), label: String((+draft.from || taxYear) + i + 1) }))]} value={draft.to} onChange={v => setDraft(x => ({ ...x, to: v }))}/>
                  </div>
                </div>
              )}
              {adding === "once" && !whenOk && <p style={{fontSize:"11.5px",color:CRITICAL,margin:0}}>Pick a month from now until the loan would be {sl.willClear ? "cleared" : "written off"}.</p>}
              <Flag check={draftCheck}/>
              <div style={{display:"flex",gap:"8px"}}>
                <button type="button" onClick={close} style={outline}>Cancel</button>
                <button type="button" disabled={!canSave} onClick={save} style={solid(canSave)}>{editing ? "Save" : "Add"}</button>
              </div>
            </div>
          ) : (
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginTop:"10px"}}>
              <button type="button" onClick={() => openForm("once")} style={ghost}><Plus size={13}/>One-off payment</button>
              {!hasMonthly && <button type="button" onClick={() => openForm("monthly")} style={ghost}><Plus size={13}/>Monthly payments</button>}
            </div>
          )}

          {run && run.paidIn > 0 && (
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginTop:"14px"}}>
                {stat(run.clearYr === 0 ? "Cleared" : run.clearYr ? "Clears in" : "Written off", run.clearYr === 0 ? "Today" : run.clearYr ? `${run.clearYr} yrs` : fmt(run.writeOffBal))}
                {stat(saved >= 0 ? "Saves" : "Costs more", fmt(Math.abs(saved)))}
                {stat("Paid", fmt(run.totalPaid))}
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

// Their pay in the years they know it (d.payByYear: [{ id, year, salary }],
// from April of `year`), used by every projection in Candid in place of a
// growth rate (metrics.js payPathOf): steady rises between, then with prices.
function PayByYear({ d, m, sl, set }) {
  const taxYear = sl.writeOffTaxYear - sl.writeOffYr;
  const rows = (d.payByYear || []).filter(p => +p.year > taxYear && +p.salary > 0).sort((a, b) => +a.year - +b.year);
  const [form, setForm] = useState(null); // { id?, year, salary }
  const path = payPathOf(d, +d.salary || 0, taxYear);
  const save = () => {
    const row = { id: form.id || `y${Date.now().toString(36)}`, year: form.year, salary: String(form.salary) };
    // One figure a year: a year given again replaces it.
    set("payByYear", [...rows.filter(r => r.id !== form.id && r.year !== form.year), row]);
    setForm(null);
  };
  const label = { fontSize:"10px", color:MUT, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase", marginBottom:"6px" };
  const ghost = { display:"inline-flex", alignItems:"center", gap:"5px", background:"none", border:`1px dashed ${GOLD}`, borderRadius:"100px", padding:"7px 12px", color:GOLD, fontSize:"12px", fontWeight:600, fontFamily:"inherit", cursor:"pointer" };
  const iconBtn = { background:"none", border:"none", padding:"4px", cursor:"pointer", color:MUT, display:"flex" };
  const canSave = form && form.salary > 0 && +form.year > taxYear;
  return (
    <div style={{marginTop:"12px",paddingBottom:"12px",borderBottom:"1px solid rgba(22,47,36,0.08)"}}>
      <div style={label}>Your pay, year by year</div>
      {rows.length === 0 && !form && (
        <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"0 0 8px"}}>Know what you'll earn in some years? Add them and every projection in Candid uses them, rising steadily between, then with prices.</p>
      )}
      {rows.length > 0 && (
        <div style={{fontSize:"12.5px",color:MUT,margin:"0 0 4px"}}>{fmt(+d.salary || 0)} today</div>
      )}
      {rows.map(r => (
        <div key={r.id} style={{display:"flex",alignItems:"center",gap:"4px",padding:"7px 0",borderBottom:"1px solid rgba(22,47,36,0.08)",opacity:form?.id === r.id ? 0.45 : 1}}>
          <span style={{flex:1,fontSize:"13.5px",color:TEXT,fontWeight:600}}>{fmt(+r.salary)} from April {r.year}</span>
          <button type="button" aria-label={`Change pay from April ${r.year}`} onClick={() => setForm({ id: r.id, year: r.year, salary: +r.salary })} style={iconBtn}><Pencil size={14}/></button>
          <button type="button" aria-label={`Remove pay from April ${r.year}`} onClick={() => set("payByYear", rows.filter(x => x.id !== r.id))} style={iconBtn}><X size={15}/></button>
        </div>
      ))}
      {form ? (
        <div style={{marginTop:"10px",display:"flex",flexDirection:"column",gap:"10px"}}>
          <div style={{display:"flex",gap:"8px",alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={label}>From April</div>
              <WheelPicker label="From April" items={Array.from({ length: 30 }, (_, i) => ({ value: String(taxYear + 1 + i), label: String(taxYear + 1 + i) }))} value={form.year} onChange={v => setForm(f => ({ ...f, year: v }))}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={label}>Pay a year</div>
              <PillMoneyInput label="Salary" value={form.salary} onChange={v => setForm(f => ({ ...f, salary: v }))}/>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button type="button" onClick={() => setForm(null)} style={{flex:1,background:WHITE,color:G,border:"1.3px solid rgba(22,47,36,0.2)",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Cancel</button>
            <button type="button" disabled={!canSave} onClick={save} style={{flex:1,background:canSave ? G : "rgba(22,47,36,0.2)",color:WHITE,border:"none",borderRadius:"100px",padding:"10px",fontSize:"13px",fontWeight:600,fontFamily:"inherit",cursor:canSave ? "pointer" : "not-allowed"}}>{form.id ? "Save" : "Add"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setForm({ year: String(taxYear + Math.min(5, Math.max(1, rows.length ? +rows[rows.length - 1].year - taxYear + 2 : 3))), salary: null })} style={{...ghost,marginTop:"8px"}}><Plus size={13}/>A year's pay</button>
      )}
      {path && !form && (
        <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>
          Used across Candid in place of your salary growth: {fmt(Math.round(+d.salary * path.factor(10) / 100) * 100)} in ten years.
        </p>
      )}
    </div>
  );
}

// Anyone else: an example plan, blurred, and the way to subscribe.
function Locked({ d }) {
  const example = ["£5,000 in October 2027", "£200 a month, until it's cleared"];
  return (
    <div style={{position:"relative",paddingTop:"10px"}}>
      <div aria-hidden="true" inert="" style={{filter:"blur(5px)",userSelect:"none",pointerEvents:"none"}}>
        {example.map(t => <div key={t} style={{padding:"8px 0",borderBottom:"1px solid rgba(22,47,36,0.08)",fontSize:"13.5px",fontWeight:600,color:TEXT}}>{t}</div>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginTop:"12px",fontFamily:SERIF,fontSize:"18px",fontWeight:700,color:G}}>
          <span>3 yrs</span><span>£4,210</span><span>£16,900</span>
        </div>
      </div>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"10px",textAlign:"center"}}>
        <span style={{fontSize:"12.5px",fontWeight:600,color:G,lineHeight:1.45,maxWidth:"260px"}}>Set your pay year by year, and plan payments to compare with a lump sum, with a subscription</span>
        <SubscribeButtons d={d} module="studentLoan" from="scenario_modelling"/>
      </div>
    </div>
  );
}
