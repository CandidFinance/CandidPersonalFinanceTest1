import { useState } from "react";
import { CircleAlert, CircleCheck, CircleDashed, ChevronRight } from "lucide-react";
import { G, MUT, TEXT, SERIF, SC } from "../../CandidApp.jsx";
import { runWaterfall, waterfallInputs, ISA_ALLOWANCE, EMERGENCY_RANGE_MONTHS } from "../../lib/waterfall.js";
import { capField } from "../../lib/onboarding.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";

// The decision waterfall as a self-contained block: give it Candid's inputs
// and it runs and renders the checks (logic in src/lib/waterfall.js). It
// doesn't depend on the Property screen, so any screen can mount it, and
// removing it is a matter of deleting the one place it's used.
//
// The high-interest debt check (step 2) runs in lib/waterfall.js but isn't
// shown here: Candid has no debts input yet (the personal-loan step is hidden
// for MVP, see HIDE_MVP_MODULES), so it would always read as "missing". Add
// "debt" to SHOWN_CHECKS once a debts input exists.
const SHOWN_CHECKS = ["match", "emergency", "isa"];

const TITLES = {
  match: "Employer pension match",
  emergency: "Emergency fund",
  isa: "ISA allowance",
};

// Each check row's single state indicator.
const STATE_ICON = {
  attention: { Icon: CircleAlert, color: SC.attention },
  ok: { Icon: CircleCheck, color: SC.ok },
  missing: { Icon: CircleDashed, color: MUT },
};

const oneDecimal = n => String(Math.round(n * 10) / 10);
const monthsText = n => `${oneDecimal(n)} ${oneDecimal(n) === "1" ? "month" : "months"}`;

function matchSentence(p) {
  const you = p.who === "you";
  const pays = you ? "You pay" : "Your partner pays";
  const their = you ? "your" : "their";
  if (p.noPension) return "No workplace pension recorded in your Pension inputs, so there's no match to check.";
  if (p.employerPct === 0) return `No employer match recorded for ${you ? "you" : "your partner"}, so there's nothing unclaimed.`;
  if (p.state === "ok") return `${pays} ${oneDecimal(p.myPct)}%, enough to get ${their} employer's full match of up to ${oneDecimal(p.employerPct)}%.`;
  const unclaimed = p.unclaimedAnnual > 0 ? `about ${fmt(p.unclaimedAnnual)} a year` : `${oneDecimal(p.unclaimedPct)}% of salary`;
  return `${pays} ${oneDecimal(p.myPct)}% and ${their} employer matches up to ${oneDecimal(p.employerPct)}%, so ${unclaimed} of employer contributions goes unclaimed.`;
}

function isaSentence(p, together) {
  if (!together) {
    return p.state === "ok"
      ? `This tax year's ${fmt(ISA_ALLOWANCE)} allowance is fully used.`
      : `${fmt(p.headroom)} of this tax year's ${fmt(ISA_ALLOWANCE)} allowance is unused.`;
  }
  const you = p.who === "you";
  return p.state === "ok"
    ? `${you ? "Your" : "Your partner's"} allowance for this tax year is fully used.`
    : `${you ? "You have" : "Your partner has"} ${fmt(p.headroom)} of this tax year's ${fmt(ISA_ALLOWANCE)} allowance unused.`;
}

function emergencySentence(c) {
  const [low, high] = EMERGENCY_RANGE_MONTHS;
  const covers = `Your cash and Premium Bonds cover ${monthsText(c.months)} of expenses`;
  if (c.state === "attention") {
    return `${covers}. The usual range is ${low} to ${high} months; reaching ${low} months would take another ${fmt(c.shortfall)}.`;
  }
  const where = c.months <= high ? `within the usual ${low} to ${high} month range` : `above the usual ${low} to ${high} month range`;
  const ownTarget = c.belowOwnTarget ? ` That's below the ${c.targetMonths}-month target you chose in Cash & savings.` : "";
  return `${covers}, ${where}.${ownTarget}`;
}

const body = { fontSize:"13.5px", color:TEXT, lineHeight:1.55, margin:"4px 0 0" };
const note = { fontSize:"12px", color:MUT, lineHeight:1.5, margin:"6px 0 0" };

function AddLink({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{background:"none",border:"none",padding:0,marginTop:"8px",color:G,fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"2px"}}>
      {label}<ChevronRight size={14}/>
    </button>
  );
}

// `onAddInputs(stepId)` opens an existing onboarding step ("cash",
// "investments", "about") so a missing figure is entered where it normally
// lives, never asked twice.
export default function DecisionWaterfall({ d, m, set, onAddInputs }) {
  const input = waterfallInputs(d, m);
  const together = input.buyers.length > 1;
  const checks = runWaterfall(input).filter(c => SHOWN_CHECKS.includes(c.key));
  // Your pension match is the one figure asked here rather than in its own
  // step: it's needed even when the Pension module wasn't chosen. Once the
  // prompt has shown, it stays for the visit, so the fields don't vanish
  // mid-typing the moment the check has enough to run.
  const [askMatch] = useState(() => !input.buyers[0].pension.known);

  function figure(c) {
    if (c.state !== "attention") return null;
    if (c.key === "match") {
      const unclaimed = c.people.reduce((s, p) => s + (p.unclaimedAnnual || 0), 0);
      return unclaimed > 0 ? { value: `${fmt(unclaimed)}/yr`, label: "Unclaimed" } : null;
    }
    if (c.key === "emergency") return { value: monthsText(c.months), label: "Of expenses" };
    if (c.key === "isa") return { value: fmt(c.people.reduce((s, p) => s + (p.headroom || 0), 0)), label: "Unused" };
    return null;
  }

  function details(c) {
    if (c.key === "match") {
      return (
        <>
          {c.people.map(p => p.state === "missing"
            ? (p.who === "partner" && <p key={p.who} style={body}>Add your partner's pension figures above to check theirs.</p>)
            : <p key={p.who} style={body}>{matchSentence(p)}</p>)}
          {askMatch && (
            <div style={{marginTop:"10px"}}>
              {c.people[0].state === "missing" && <p style={{...body,marginBottom:"8px"}}>Candid doesn't have your workplace pension figures yet. Add them to run this check.</p>}
              <div style={{display:"flex",gap:"10px"}}>
                <PillMoneyInput label="Your contribution" unit="%" value={d.myContribution || null} onChange={v => set("myContribution", capField("myContribution", v ?? ""))}/>
                <PillMoneyInput label="Employer match cap" unit="%" value={d.employerMatch || null} onChange={v => set("employerMatch", capField("employerMatch", v ?? ""))}/>
              </div>
            </div>
          )}
          {c.state === "attention" && <p style={note}>Matched money is effectively a 100% return on what's paid in, before any investment growth, which is why this check comes first.</p>}
        </>
      );
    }
    if (c.key === "emergency") {
      if (c.state === "missing") {
        return c.missing === "expenses"
          ? <><p style={body}>Add your monthly expenses to run this check.</p><AddLink label="Add your expenses" onClick={() => onAddInputs("about")}/></>
          : <><p style={body}>Add your cash savings to run this check.</p><AddLink label="Add Cash & savings" onClick={() => onAddInputs("cash")}/></>;
      }
      return (
        <>
          <p style={body}>{emergencySentence(c)}</p>
          {c.state === "attention" && <p style={note}>Money in a deposit can't easily be drawn back out, so the emergency fund comes before it.</p>}
        </>
      );
    }
    if (c.key === "isa") {
      return (
        <>
          {c.people.map(p => {
            if (p.state !== "missing") return <p key={p.who} style={body}>{isaSentence(p, together)}</p>;
            return p.who === "you"
              ? <div key={p.who}><p style={body}>Add your ISAs to run this check{together ? " for you" : ""}.</p><AddLink label="Add your ISAs" onClick={() => onAddInputs("investments")}/></div>
              : <p key={p.who} style={body}>Add your partner's ISA payments above to check theirs.</p>;
          })}
          {c.state === "attention" && <p style={note}>The allowance resets on 6 April and unused allowance doesn't carry over.</p>}
        </>
      );
    }
    return null;
  }

  return (
    <div>
      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"6px"}}>Before a deposit</div>
      <p style={{fontSize:"13.5px",color:MUT,lineHeight:1.55,margin:"0 0 4px"}}>
        Candid looks at these first, in this order, because each can be worth more than the same money in a deposit. Here's where your figures stand.
      </p>
      {checks.map((c, i) => {
        const { Icon, color } = STATE_ICON[c.state];
        const fig = figure(c);
        return (
          <div key={c.key} style={{display:"flex",gap:"12px",padding:"16px 0",borderTop:i === 0 ? "none" : "1px solid rgba(22,47,36,0.1)"}}>
            <Icon size={20} color={color} style={{flexShrink:0,marginTop:"1px"}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}}>
                <div style={{fontSize:"15px",fontWeight:600,color:TEXT}}>{TITLES[c.key]}</div>
                {fig && (
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:SERIF,fontSize:"18px",fontWeight:700,color:TEXT,lineHeight:1.1}}>{fig.value}</div>
                    <div style={{fontSize:"10px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginTop:"2px"}}>{fig.label}</div>
                  </div>
                )}
              </div>
              {details(c)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
