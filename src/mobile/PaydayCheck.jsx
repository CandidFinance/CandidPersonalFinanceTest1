import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import posthog from "posthog-js";
import { CalendarPlus } from "lucide-react";
import { G, WHITE, MUT, TEXT, SERIF, RADIUS_CARD, CRITICAL } from "../design-tokens.js";
import { fmt } from "../lib/format.js";
import { yearProjection, paydayOf, monthKey, TRAP_START } from "../lib/taxTrap.js";
import { triggerCalendarReminder } from "./reminders.js";

// The £100k trap through the year, for subscribers: their taxable pay to
// date from each payslip (d.payToDate, as of d.payToDateOn) turns their
// answers into where this tax year is heading (taxTrap.js yearProjection).
// Home asks for it from each payday until answered (PaydayCheckCard); the
// module shows where the year is heading (TrapTracking).

const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
const shortDate = s => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const pill = primary => ({ flex:1, background:primary ? G : WHITE, color:primary ? WHITE : TEXT, border:primary ? "none" : "1.5px solid rgba(22,47,36,0.15)", borderRadius:"100px", padding:"11px 14px", fontSize:"14px", fontWeight:700, fontFamily:"inherit", cursor:"pointer" });

// A repeating calendar event on their payday, from the next one.
export function addPaydayReminder(d) {
  const payday = paydayOf(d), now = new Date();
  const inMonth = (y, mo) => new Date(y, mo, Math.min(payday, new Date(y, mo + 1, 0).getDate()));
  let next = inMonth(now.getFullYear(), now.getMonth());
  if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = inMonth(now.getFullYear(), now.getMonth() + 1);
  triggerCalendarReminder({
    title: "Payday: check your £100k year in Candid",
    description: "Add your taxable pay to date from this month's payslip to see where your income this tax year is heading.",
    date: next, monthlyOn: payday,
  });
  posthog.capture("payday_reminder_added");
}

function PayToDateForm({ d, set, onSaved, submitLabel = "Save" }) {
  const [pay, setPay] = useState("");
  const save = e => {
    e.preventDefault();
    const value = String(pay).replace(/[^\d.]/g, "");
    if (!(+value > 0)) return;
    set("payToDate", value);
    set("payToDateOn", today());
    posthog.capture("pay_to_date_entered");
    onSaved?.();
  };
  return (
    <form onSubmit={save} style={{display:"flex",gap:"8px"}}>
      <input inputMode="numeric" value={pay} onChange={e => setPay(e.target.value)} placeholder={d.payToDate ? `Last time ${fmt(+d.payToDate)}` : "£0"} aria-label="Taxable pay to date"
        style={{flex:1,minWidth:0,boxSizing:"border-box",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"100px",padding:"11px 16px",fontSize:"16px",fontFamily:"inherit",color:TEXT,outline:"none",background:WHITE}}/>
      <button type="submit" style={{...pill(true),flex:"0 0 auto"}}>{submitLabel}</button>
    </form>
  );
}

// Where the year's heading, in a line: over £100k, the top-up that brings it
// back; under, the room left.
function headingLine(y) {
  return y.over ? `${fmt(y.topUp)} more into your pension before 5 April brings it back to £100k.`
    : `${fmt(TRAP_START - y.projected)} under £100k, with ${y.paydaysLeft} payday${y.paydaysLeft === 1 ? "" : "s"} to go.`;
}

export function PaydayCheckCard({ d, m, set }) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const done = () => set("paydayCheckedMonth", monthKey(new Date()));
  // Answered: checked in for this month once they move on, Done or not.
  const answered = useRef(false);
  const setRef = useRef(set);
  setRef.current = set;
  useEffect(() => () => { if (answered.current) setRef.current("paydayCheckedMonth", monthKey(new Date())); }, []);
  const card = {marginTop:"22px",background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,boxShadow:"0 2px 10px rgba(22,47,36,0.05)",padding:"18px"};
  const eyebrow = <div style={{fontSize:"11px",fontWeight:600,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Payday check-in</div>;
  if (saved) {
    const y = yearProjection(d, m);
    return (
      <div style={card}>
        {eyebrow}
        <div style={{fontSize:"13px",color:MUT,marginTop:"8px"}}>Your income this tax year is heading for</div>
        <div style={{fontFamily:SERIF,fontSize:"32px",fontWeight:700,color:y.over ? CRITICAL : G,lineHeight:1.15,marginTop:"2px"}}>{fmt(y.projected)}</div>
        <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"6px 0 12px"}}>{headingLine(y)}</p>
        <div style={{display:"flex",gap:"8px"}}>
          <button type="button" onClick={done} style={pill(true)}>Done</button>
          <button type="button" onClick={() => navigate("/app/module/taxTrap")} style={pill(false)}>See the £100k trap</button>
        </div>
      </div>
    );
  }
  return (
    <div style={card}>
      {eyebrow}
      <div style={{fontSize:"16px",fontWeight:700,color:TEXT,marginTop:"8px",lineHeight:1.35}}>What's your taxable pay to date?</div>
      <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"4px 0 12px"}}>It's on your payslip, often as "Taxable pay to date" or "Taxable gross YTD". It shows where your £100k year is heading.</p>
      <PayToDateForm d={d} set={set} onSaved={() => { answered.current = true; setSaved(true); }}/>
      <div style={{display:"flex",gap:"8px",marginTop:"8px"}}>
        <button type="button" onClick={done} style={pill(false)}>Skip this month</button>
        <button type="button" onClick={() => navigate("/app/inputs")} style={pill(false)}>My pay's changed</button>
      </div>
    </div>
  );
}

// Under the module's answer: where this tax year is heading, from their pay
// to date or their answers, with a way to update it and a payday reminder.
// From January, the days to 5 April as well.
export function TrapTracking({ d, m, set }) {
  const [editing, setEditing] = useState(false);
  const y = yearProjection(d, m);
  const lastStretch = new Date().getMonth() <= 3 && y.daysLeft > 0;
  const link = { background:"none", border:"none", padding:0, color:G, fontSize:"12.5px", fontWeight:700, fontFamily:"inherit", cursor:"pointer", textDecoration:"underline", display:"inline-flex", alignItems:"center", gap:"4px" };
  return (
    <div style={{margin:"0 4px 16px"}}>
      <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:0}}>
        On course for <b style={{fontFamily:SERIF,fontSize:"15px",color:y.over ? CRITICAL : G}}>{fmt(y.projected)}</b> this tax year, {y.tracked ? `from your pay to date on ${shortDate(y.asOf)}` : "from your answers"}. {headingLine(y)}{lastStretch ? ` ${y.daysLeft} days to 5 April.` : ""}
      </p>
      {editing
        ? <div style={{marginTop:"8px"}}><PayToDateForm d={d} set={set} onSaved={() => setEditing(false)} submitLabel="Update"/></div>
        : <div style={{display:"flex",flexWrap:"wrap",gap:"14px",marginTop:"6px"}}>
            <button type="button" onClick={() => setEditing(true)} style={link}>{y.tracked ? "Update pay to date" : "Add your pay to date"}</button>
            <button type="button" onClick={() => addPaydayReminder(d)} style={link}><CalendarPlus size={13} aria-hidden="true"/>Remind me each payday</button>
          </div>}
    </div>
  );
}
