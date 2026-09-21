import { useState } from "react";
import { Bell, BellRing, Mail, CalendarPlus, Check } from "lucide-react";
import { G, GOLD, WHITE, MUT, SANS, RADIUS_PILL } from "../CandidApp.jsx";
import { triggerCalendarReminder, nextAvailableWorkingDay } from "./reminders.js";
import { buildMailtoUrl, draftAsText } from "./emailDrafts.js";

// The action at the bottom of an expanded Win tile that turns a passive
// recommendation into something the user actually does. Replaces the old
// unlabelled bell icon in the tile header, which new users couldn't decode.
//
// Two shapes, depending on `email` ({subject, body}, optional):
//  - No email: one tap adds a calendar reminder (9am on a working day) via
//    the OS's native "add event" flow.
//  - With email: the pill opens a two-step panel — (1) open a pre-written
//    draft to HR in the user's mail app, (2) add the follow-up calendar
//    reminder. They're separate buttons because a web page can only trigger
//    one OS hand-off per tap (a second navigation cancels the first), and
//    can't attach a file to the mail draft; the draft text is also embedded
//    in the calendar event so it's still there at reminder time.
//
// `id` must be stable and unique per reminder (localStorage key, so the pill
// shows as already-set on return visits, on this device only — no backend).
// The date is staggered by how many other reminders are already set, so
// setting several in one sitting spreads them across different days.
export default function MobileReminderAction({ id, title, description, email }) {
  const storageKey = `candid_reminder_${id}`;
  const [isSet, setIsSet] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [emailOpened, setEmailOpened] = useState(false);
  const reminderDate = nextAvailableWorkingDay(id);
  const dateLabel = reminderDate.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });

  const setReminder = () => {
    triggerCalendarReminder({
      title,
      description: email ? `${description}\n\n${draftAsText(email)}` : description,
      date: reminderDate,
    });
    try { localStorage.setItem(storageKey, "1"); } catch {}
    setIsSet(true);
  };

  const openEmail = () => {
    setEmailOpened(true);
    window.location.href = buildMailtoUrl(email);
  };

  const onPillClick = () => {
    if (email) setPanelOpen(o => !o);
    else if (!isSet) setReminder();
  };

  const pillLabel = isSet
    ? `Reminder set for ${dateLabel}`
    : email ? "Email HR & set a reminder" : `Remind me on ${dateLabel}`;
  const Icon = isSet ? BellRing : email ? Mail : Bell;

  const stepBtn = (done) => ({
    display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", width:"100%", marginTop:"8px",
    background: done ? "rgba(45,107,74,0.1)" : G, color: done ? "#2d6b4a" : WHITE,
    border:"none", borderRadius:RADIUS_PILL, padding:"10px 14px", fontSize:"13px", fontWeight:700, fontFamily:SANS, cursor:"pointer",
  });
  const stepNum = { width:"20px", height:"20px", borderRadius:"50%", background:G, color:WHITE, fontSize:"11px", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };

  return (
    <div style={{marginTop:"16px"}} onClick={e => e.stopPropagation()}>
      <button type="button" onClick={onPillClick} style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
        background: isSet ? "rgba(196,150,58,0.12)" : "transparent",
        color: isSet ? "#8a6a24" : G,
        border:`1.5px solid ${isSet ? GOLD : G}`, borderRadius:RADIUS_PILL, padding:"11px 18px",
        fontSize:"13px", fontWeight:700, fontFamily:SANS, cursor: (!email && isSet) ? "default" : "pointer",
      }}>
        <Icon size={15}/>{pillLabel}
      </button>

      {email && panelOpen && (
        <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"12px",padding:"14px",marginTop:"10px"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:"10px"}}>
            <span style={stepNum}>1</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"13px",fontWeight:700,color:G}}>Send HR your questions</div>
              <div style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"2px"}}>We've written the email for you — just add HR's address and hit send.</div>
              <button type="button" onClick={openEmail} style={stepBtn(emailOpened)}>
                {emailOpened ? <><Check size={14}/>Draft opened — open again</> : <><Mail size={14}/>Open draft email</>}
              </button>
            </div>
          </div>
          <div style={{height:"1px",background:"rgba(22,47,36,0.1)",margin:"14px 0"}}/>
          <div style={{display:"flex",alignItems:"flex-start",gap:"10px"}}>
            <span style={stepNum}>2</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"13px",fontWeight:700,color:G}}>Get a reminder to follow up</div>
              <div style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"2px"}}>Adds a calendar event for {dateLabel}, with the email text included.</div>
              <button type="button" onClick={setReminder} style={stepBtn(isSet)}>
                {isSet ? <><Check size={14}/>Reminder set — add again</> : <><CalendarPlus size={14}/>Add to calendar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
