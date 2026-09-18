import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { GOLD, MUT } from "../CandidApp.jsx";
import { triggerCalendarReminder, nextWorkingDay } from "./reminders.js";

// A small Bell action attached to a Win tile — turns a passive recommendation
// into something the user actually does, by adding a real calendar reminder
// (next working day, 9am) for it via the OS's native "add event" flow. `id`
// must be stable and unique per reminder (used as the localStorage key so
// the bell shows as already-set on return visits, on this device only —
// there's no backend to sync it against).
export default function MobileReminderBell({ id, title, description }) {
  const storageKey = `candid_reminder_${id}`;
  const [isSet, setIsSet] = useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    triggerCalendarReminder({ title, description });
    try { localStorage.setItem(storageKey, "1"); } catch {}
    setIsSet(true);
  };

  return (
    <button type="button" onClick={handleClick}
      aria-label={isSet ? "Reminder set for next working day" : "Set a reminder for next working day"}
      title={isSet ? "Reminder set" : `Remind me ${nextWorkingDay().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}`}
      style={{
        background: isSet ? "rgba(196,150,58,0.16)" : "rgba(22,47,36,0.06)",
        border:"none", borderRadius:"50%", width:"28px", height:"28px",
        display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0,
      }}>
      {isSet ? <BellRing size={14} color={GOLD}/> : <Bell size={14} color={MUT}/>}
    </button>
  );
}
