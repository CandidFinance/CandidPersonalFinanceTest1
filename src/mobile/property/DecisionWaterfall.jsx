import { useState } from "react";
import { CircleAlert, CircleCheck, CircleDashed, ChevronRight } from "lucide-react";
import { G, MUT, TEXT, SERIF, SC, WHITE, MODULE_META } from "../../CandidApp.jsx";
import { runWaterfall, waterfallInputs, VISIBLE_CHECKS, ISA_ALLOWANCE, EMERGENCY_RANGE_MONTHS } from "../../lib/waterfall.js";
import { capField } from "../../lib/onboarding.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";

// The decision waterfall as a self-contained block: give it Candid's inputs
// and it runs and renders the checks (logic in src/lib/waterfall.js) as one
// expandable tile per check. It doesn't depend on the Property screen, so any
// screen can mount it, and removing it is a matter of deleting the one place
// it's used.
//
// Which checks are shown is VISIBLE_CHECKS in lib/waterfall.js (the debt
// check runs but stays hidden until Candid has a debts input).

const TITLES = {
  match: "Employer pension match",
  emergency: "Emergency fund",
  isa: "ISA allowance",
};

// Each tile's single state indicator.
// Built at render time, not module scope: this file is part of the
// circular import with CandidApp.jsx (via MobilePropertyScreen), so tokens
// imported from it can't be relied on while the module first evaluates.
function stateIcon(state) {
  return {
    attention: { Icon: CircleAlert, color: SC.attention },
    ok: { Icon: CircleCheck, color: SC.ok },
    missing: { Icon: CircleDashed, color: MUT },
  }[state];
}

const oneDecimal = n => String(Math.round(n * 10) / 10);
const monthsText = n => `${oneDecimal(n)} ${oneDecimal(n) === "1" ? "month" : "months"}`;
const sum = (people, key) => people.reduce((s, p) => s + (p[key] || 0), 0);

// The figure on the right of each tile.
function tileValue(c) {
  if (c.state === "missing" && !(c.people || []).some(p => p.state !== "missing")) return { text: "Add", muted: true };
  if (c.key === "match") return { text: `${fmt(sum(c.people, "unclaimedAnnual"))}/yr` };
  if (c.key === "emergency") return { text: monthsText(c.months) };
  if (c.key === "isa") return { text: `${fmt(sum(c.people, "headroom"))} left` };
  return null;
}

function matchLine(p) {
  const you = p.who === "you";
  if (p.noPension) return "No workplace pension recorded, so there's no match to claim.";
  if (p.employerPct === 0) return `${you ? "Your" : "Your partner's"} employer doesn't match contributions, so there's nothing to claim.`;
  if (p.state === "ok") return `${you ? "You're" : "Your partner is"} getting the full employer match.`;
  const unclaimed = p.unclaimedAnnual > 0 ? `${fmt(p.unclaimedAnnual)} a year` : `${oneDecimal(p.unclaimedPct)}% of salary`;
  return `${you ? "You have" : "Your partner has"} ${unclaimed} of employer contributions going unclaimed.`;
}

function isaLine(p) {
  const you = p.who === "you";
  if (p.state === "ok") return `${you ? "You've" : "Your partner has"} used the full ${fmt(ISA_ALLOWANCE)} allowance this tax year.`;
  return `${you ? "You have" : "Your partner has"} ${fmt(p.headroom)} of ISA allowance left this tax year.`;
}

function emergencyLine(c) {
  const [low, high] = EMERGENCY_RANGE_MONTHS;
  if (c.state === "attention") return `Your cash covers ${monthsText(c.months)} of expenses. Another ${fmt(c.shortfall)} gets you to ${low} months.`;
  const where = c.months <= high ? `within the usual ${low} to ${high}` : `above the usual ${low} to ${high}`;
  return `Your cash covers ${monthsText(c.months)} of expenses, ${where}.${c.belowOwnTarget ? ` That's below your own ${c.targetMonths}-month target.` : ""}`;
}

function AddLink({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{alignSelf:"flex-start",background:"none",border:"none",padding:0,color:G,fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"2px"}}>
      {label}<ChevronRight size={14}/>
    </button>
  );
}

// The module an expanded tile links to, when the user has chosen it: the
// match lives in Pension, ISAs in Investments (or Cash & savings for a
// cash-only user).
function linkedModule(key, selected) {
  if (key === "match") return selected.has("pension") ? "pension" : null;
  if (key === "isa") return selected.has("investments") ? "investments" : selected.has("cash") ? "cash" : null;
  return null;
}

// `onAddInputs(stepId)` opens an existing onboarding step ("cash",
// "investments", "about") so a missing figure is entered where it normally
// lives, never asked twice. `onOpenModule(key)` opens a module deep dive.
export default function DecisionWaterfall({ d, m, set, onAddInputs, onOpenModule }) {
  const selected = new Set(d.selectedModules || []);
  const line = { fontSize:"13.5px", color:TEXT, lineHeight:1.5, margin:0 };
  const why = { fontSize:"12.5px", color:MUT, lineHeight:1.5, margin:0 };
  const input = waterfallInputs(d, m);
  const checks = runWaterfall(input).filter(c => VISIBLE_CHECKS.includes(c.key));
  const [openKey, setOpenKey] = useState(null);
  // Your pension match is the one figure asked here rather than in its own
  // step: it's needed even when the Pension module wasn't chosen. Once the
  // prompt has shown, it stays for the visit, so the fields don't vanish
  // mid-typing the moment the check has enough to run.
  const [askMatch] = useState(() => !input.buyers[0].pension.known);

  function details(c) {
    if (c.key === "match") {
      return (
        <>
          {c.people.map(p => p.state === "missing"
            ? (p.who === "partner" && <p key={p.who} style={line}>Add your partner's pension figures above to check theirs.</p>)
            : <p key={p.who} style={line}>{matchLine(p)}</p>)}
          {c.state === "attention" && <p style={why}>Matched contributions are a 100% return, so this is a real wealth leakage.</p>}
          {askMatch && (
            <>
              {c.people[0].state === "missing" && <p style={line}>Add your workplace pension to check this.</p>}
              <div style={{display:"flex",gap:"10px"}}>
                <PillMoneyInput label="Your contribution" unit="%" value={d.myContribution || null} onChange={v => set("myContribution", capField("myContribution", v ?? ""))}/>
                <PillMoneyInput label="Employer match cap" unit="%" value={d.employerMatch || null} onChange={v => set("employerMatch", capField("employerMatch", v ?? ""))}/>
              </div>
            </>
          )}
        </>
      );
    }
    if (c.key === "emergency") {
      if (c.state === "missing") {
        return c.missing === "expenses"
          ? <><p style={line}>Add your monthly expenses to check this.</p><AddLink label="Add your expenses" onClick={() => onAddInputs("about")}/></>
          : <><p style={line}>Add your cash savings to check this.</p><AddLink label="Add Cash & savings" onClick={() => onAddInputs("cash")}/></>;
      }
      return (
        <>
          <p style={line}>{emergencyLine(c)}</p>
          {c.state === "attention" && <p style={why}>A deposit is hard to get back out, so this buffer comes first.</p>}
        </>
      );
    }
    if (c.key === "isa") {
      return (
        <>
          {c.people.map(p => {
            if (p.state !== "missing") return <p key={p.who} style={line}>{isaLine(p)}</p>;
            return p.who === "you"
              ? <div key={p.who} style={{display:"flex",flexDirection:"column",gap:"8px"}}><p style={line}>Add your ISAs to check this.</p><AddLink label="Add your ISAs" onClick={() => onAddInputs("investments")}/></div>
              : <p key={p.who} style={line}>Add your partner's ISA payments above to check theirs.</p>;
          })}
          {c.state === "attention" && <p style={why}>It resets on 6 April and doesn't roll over.</p>}
        </>
      );
    }
    return null;
  }

  return (
    <div>
      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"6px"}}>Before a deposit</div>
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.5,margin:"0 0 12px"}}>Worth checking first, in this order.</p>
      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
        {checks.map(c => {
          const { Icon, color } = stateIcon(c.state);
          const value = tileValue(c);
          const isOpen = openKey === c.key;
          return (
            <div key={c.key} style={{background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",overflow:"hidden"}}>
              <button type="button" onClick={() => setOpenKey(k => k === c.key ? null : c.key)} aria-expanded={isOpen} style={{width:"100%",display:"flex",alignItems:"center",gap:"12px",padding:"16px 18px",background:"none",border:"none",fontFamily:"inherit",textAlign:"left",cursor:"pointer"}}>
                <Icon size={20} color={color} style={{flexShrink:0}}/>
                <span style={{flex:1,minWidth:0,fontSize:"15px",fontWeight:600,color:TEXT}}>{TITLES[c.key]}</span>
                {value && <span style={{fontFamily:value.muted ? "inherit" : SERIF,fontSize:value.muted ? "13px" : "16px",fontWeight:700,color:value.muted ? G : TEXT,flexShrink:0}}>{value.text}</span>}
                <ChevronRight size={14} color={MUT} style={{flexShrink:0,transform:isOpen ? "rotate(90deg)" : "none",transition:"transform 0.15s"}}/>
              </button>
              {isOpen && (
                <div style={{background:"rgba(22,47,36,0.03)",padding:"14px 18px 18px",display:"flex",flexDirection:"column",gap:"8px"}}>
                  {details(c)}
                  {onOpenModule && linkedModule(c.key, selected) && (
                    <button type="button" onClick={() => onOpenModule(linkedModule(c.key, selected))} style={{marginTop:"4px",width:"100%",background:G,color:WHITE,border:"none",borderRadius:"100px",padding:"12px",fontSize:"13.5px",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                      Deep dive · {MODULE_META.find(mm => mm.key === linkedModule(c.key, selected))?.title}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
