import { useState } from "react";
import { G, GOLD, CREAM, WHITE, TEXT } from "../CandidApp.jsx";
import MobileReminderAction from "./MobileReminderAction.jsx";

// Compact, tap-to-expand "Win" tile for mobile module deep-dive pages —
// mirrors desktop's numbered ExpandableInvestmentItem (CandidApp.jsx) but at
// mobile density, and reuses the same expand pattern already established in
// MobileModulesScreen (white card, chevron rotate on open). `reminder`
// (optional {id,title,description,email}) adds a labelled "Remind me" action
// pill at the bottom of the expanded tile, turning the Win into something
// the user can actually schedule (and, with `email`, send to HR), not just read.
export default function MobileWinTile({ number, title, headline, tagLabel, tagColor = GOLD, defaultOpen = false, reminder, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{background:WHITE,borderRadius:"14px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",marginBottom:"12px",overflow:"hidden"}}>
      <div onClick={() => setOpen(o => !o)} style={{display:"flex",alignItems:"flex-start",gap:"12px",padding:"16px 16px 13px",cursor:"pointer"}}>
        {number != null && (
          <div style={{width:"24px",height:"24px",borderRadius:"50%",background:G,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>
            <span style={{fontSize:"12px",fontWeight:700,color:CREAM}}>{number}</span>
          </div>
        )}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
            <div style={{fontSize:"15px",fontWeight:700,color:G,lineHeight:1.3}}>{title}</div>
            {tagLabel && (
              <span style={{fontSize:"9.5px",fontWeight:700,color:tagColor,background:`${tagColor}18`,padding:"3px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap",flexShrink:0}}>{tagLabel}</span>
            )}
          </div>
          <div style={{fontSize:"13.5px",color:TEXT,marginTop:"4px",lineHeight:1.4}}>{headline}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0,marginTop:"2px"}}>
          <span style={{fontSize:"14px",color:"#6b6b6b",display:"inline-block",transform:open?"rotate(90deg)":"none",transition:"transform 0.15s"}}>›</span>
        </div>
      </div>
      {open && (
        <div style={{padding:"0 16px 16px"}}>
          {children}
          {reminder && <MobileReminderAction id={reminder.id} title={reminder.title} description={reminder.description} email={reminder.email}/>}
        </div>
      )}
    </div>
  );
}
