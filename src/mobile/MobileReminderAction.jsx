import { useState } from "react";
import { reportStorageFailure } from "../lib/storage.js";
import { Bell, BellRing, Mail, CalendarPlus, Check } from "lucide-react";
import { G, GOLD, WHITE, MUT, SANS, RADIUS_PILL, SUCCESS, CTA_BLUE } from "../design-tokens.js";
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
// The Win tile's `action` ({ label, onClick }), e.g. "See options" opening Candid
// Assist: solid CTA blue, the same size as the reminder pill beside it.
export function ActionButton({ action }) {
  return (
    <button type="button" onClick={action.onClick} style={{
      flex:1, minWidth:0, width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
      background:CTA_BLUE, color:WHITE, border:`1.5px solid ${CTA_BLUE}`, borderRadius:RADIUS_PILL, padding:"11px 10px",
      fontSize:"13px", fontWeight:700, fontFamily:SANS, cursor:"pointer", whiteSpace:"nowrap",
    }}>{action.label}</button>
  );
}

// `action` (optional): an ActionButton beside the pill, half the row each,
// so the pill's label is shortened to fit: "Remind me", then the bell and
// the reminder's date once set.
export default function MobileReminderAction({ id, title, description, email, action }) {
  const storageKey = `candid_reminder_${id}`;
  const [isSet, setIsSet] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch (e) { reportStorageFailure("read_reminder", e); return false; }
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
    try { localStorage.setItem(storageKey, "1"); } catch (e) { reportStorageFailure("save_reminder", e); }
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

  const pillLabel = action
    ? (isSet ? dateLabel : email ? "Email HR" : "Remind me")
    : isSet
    ? `Reminder set for ${dateLabel}`
    : email ? "Email HR & set a reminder" : `Remind me on ${dateLabel}`;
  const Icon = isSet ? BellRing : email ? Mail : Bell;

  const stepBtn = (done) => ({
    display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", width:"100%", marginTop:"8px",
    background: done ? "rgba(45,107,74,0.1)" : G, color: done ? SUCCESS : WHITE,
    border:"none", borderRadius:RADIUS_PILL, padding:"10px 14px", fontSize:"13px", fontWeight:700, fontFamily:SANS, cursor:"pointer",
  });
  const stepNum = { width:"20px", height:"20px", borderRadius:"50%", background:G, color:WHITE, fontSize:"11px", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };

  return (
    <div style={{marginTop:"16px"}} onClick={e => e.stopPropagation()}>
      <div style={{display:"flex",gap:"10px"}}>
      <button type="button" onClick={onPillClick} style={{
        flex:1, minWidth:0, whiteSpace:"nowrap", display:"flex", alignItems:"center", justifyContent:"center", gap: action ? "6px" : "8px",
        background: isSet ? "rgba(196,150,58,0.12)" : "transparent",
        color: isSet ? "#8a6a24" : G,
        border:`1.5px solid ${isSet ? GOLD : G}`, borderRadius:RADIUS_PILL, padding: action ? "11px 10px" : "11px 18px",
        fontSize:"13px", fontWeight:700, fontFamily:SANS, cursor: (!email && isSet) ? "default" : "pointer",
      }}>
        <Icon size={15}/>{pillLabel}
      </button>
      {action && <ActionButton action={action}/>}
      </div>

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
