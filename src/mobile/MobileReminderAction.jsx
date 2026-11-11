import { useState } from "react";
import { motion } from "framer-motion";
import { reportStorageFailure } from "../lib/storage.js";
import { Bell, BellRing, Mail, CalendarPlus, Check } from "lucide-react";
import { G, GOLD, WHITE, MUT, SANS, RADIUS_PILL, SUCCESS, CTA_BLUE } from "../design-tokens.js";
import { triggerCalendarReminder, nextAvailableWorkingDay } from "./reminders.js";
import { buildMailtoUrl, draftAsText } from "./emailDrafts.js";
import { Button } from "./ui";

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
// `who`: who the email goes to, in the pill's copy ("HR" unless given).
// `beside` (optional): any control beside the pill instead of an action,
// sized to its content, the pill taking the rest ("Email HR + reminder",
// without its icon to fit).
// The reminder itself, without the pill: whether it's set, its date, and
// adding it to the calendar. Also used by a tile's menu (MobileTile).
export function useReminder({ id, title, description, email, who = "HR" }) {
  const storageKey = `candid_reminder_${id}`;
  const [isSet, setIsSet] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch (e) { reportStorageFailure("read_reminder", e); return false; }
  });
  const reminderDate = nextAvailableWorkingDay(id);
  const dateLabel = reminderDate.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
  const setReminder = () => {
    triggerCalendarReminder({
      title,
      description: email ? `${description}\n\n${draftAsText(email, who)}` : description,
      date: reminderDate,
    });
    try { localStorage.setItem(storageKey, "1"); } catch (e) { reportStorageFailure("save_reminder", e); }
    setIsSet(true);
  };
  return { isSet, dateLabel, setReminder };
}

// A tile's visible actions as pills, in the same style as the pill below:
// open the drafted email (`email`, optional) and add the calendar reminder
// (`reminder`, from useReminder). Two buttons, as a page can hand off to the
// phone only once per tap. Short labels, so the two fit side by side at
// phone width; the reminder's date in a note under them. The kit's 37px
// secondary button (ui/Button), gold once done. `action` (optional,
// { label, onClick }): a primary button first (Cash's "Show me how").
// Once the reminder's set its button goes, leaving a quiet line with the
// date in its place, so what's done takes no more attention.
const DONE = { background:"rgba(196,150,58,0.12)", color:"#8a6a24", border:`1.5px solid ${GOLD}`, cursor:"pointer" };
export function ReminderPills({ reminder, email, who = "HR", action }) {
  const [emailOpened, setEmailOpened] = useState(false);
  return (
    <>
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"8px 14px"}}>
        {action && <Button onClick={action.onClick} style={{whiteSpace:"nowrap"}}>{action.label}</Button>}
        {email && (
          <Button variant="secondary" icon={emailOpened ? Check : Mail} onClick={() => { setEmailOpened(true); window.location.href = buildMailtoUrl(email); }}
            style={{whiteSpace:"nowrap",...(emailOpened && DONE)}}>
            {emailOpened ? "Email opened" : `Email ${who}`}
          </Button>
        )}
        {reminder.isSet ? (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
            style={{display:"inline-flex",alignItems:"center",gap:"6px",fontSize:"12px",color:MUT,lineHeight:1.45,whiteSpace:"nowrap"}}>
            <BellRing size={14} aria-hidden="true"/>Reminder set for {reminder.dateLabel}
          </motion.span>
        ) : (
          <Button variant="secondary" icon={Bell} onClick={reminder.setReminder} style={{whiteSpace:"nowrap"}}>Remind me</Button>
        )}
      </div>
      {!reminder.isSet && (
        <div style={{fontSize:"12px",color:MUT,lineHeight:1.45,marginTop:"6px"}}>The reminder is for {reminder.dateLabel}</div>
      )}
    </>
  );
}

export default function MobileReminderAction({ id, title, description, email, action, beside, who = "HR" }) {
  const { isSet, dateLabel, setReminder } = useReminder({ id, title, description, email, who });
  const [panelOpen, setPanelOpen] = useState(false);
  const [emailOpened, setEmailOpened] = useState(false);

  const openEmail = () => {
    setEmailOpened(true);
    window.location.href = buildMailtoUrl(email);
  };

  const onPillClick = () => {
    if (email) setPanelOpen(o => !o);
    else if (!isSet) setReminder();
  };

  const pillLabel = beside
    ? (isSet ? `Reminder ${dateLabel}` : email ? `Email ${who} + reminder` : "Remind me")
    : action
    ? (isSet ? dateLabel : email ? `Email ${who}` : "Remind me")
    : isSet
    ? `Reminder set for ${dateLabel}`
    : email ? `Email ${who} & set a reminder` : `Remind me on ${dateLabel}`;
  const Icon = isSet ? BellRing : email ? Mail : Bell;

  const stepBtn = (done) => ({
    display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", width:"100%", marginTop:"8px",
    background: done ? "rgba(45,107,74,0.1)" : G, color: done ? SUCCESS : WHITE,
    border:"none", borderRadius:RADIUS_PILL, padding:"10px 14px", fontSize:"13px", fontWeight:700, fontFamily:SANS, cursor:"pointer",
  });
  const stepNum = { width:"20px", height:"20px", borderRadius:"50%", background:G, color:WHITE, fontSize:"11px", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };

  return (
    <div style={{marginTop:"16px"}} onClick={e => e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
      {/* The kit's button: 37px, and a long label wraps instead of spilling
          out when a switch sits beside it. Gold once the reminder is set. */}
      <Button variant="secondary" onClick={onPillClick} icon={beside ? undefined : Icon}
        style={{
          flex:1, minWidth:0,
          ...(action || beside ? { padding:"8px 10px" } : {}),
          ...(isSet ? { background:"rgba(196,150,58,0.12)", color:"#8a6a24", border:`1.5px solid ${GOLD}` } : {}),
          cursor: (!email && isSet) ? "default" : "pointer",
        }}>
        {pillLabel}
      </Button>
      {action && <ActionButton action={action}/>}
      {beside}
      </div>

      {email && panelOpen && (
        <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"12px",padding:"14px",marginTop:"10px"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:"10px"}}>
            <span style={stepNum}>1</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"13px",fontWeight:700,color:G}}>Send {who} your questions</div>
              <div style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginTop:"2px"}}>We've written the email for you — just add {who}'s address and hit send.</div>
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
