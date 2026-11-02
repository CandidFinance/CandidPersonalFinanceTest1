import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { G, GOLD, WHITE, TEXT, MUT, RADIUS_CARD, PROVIDER_TILE_BG, PROVIDER_TILE_BORDER, PROVIDER_TILE_SHADOW } from "../design-tokens.js";
import MobileReminderAction, { ActionButton } from "./MobileReminderAction.jsx";
import NewBadge from "./NewBadge.jsx";

// Compact, tap-to-expand "Win" tile for mobile module deep-dive pages, at
// mobile density. Unnumbered: numbers read as steps to follow, and Candid
// lists, it doesn't direct. Reuses the expand pattern from
// MobileModulesScreen (white card, chevron rotate on open). `reminder`
// (optional {id,title,description,email}) adds a labelled "Remind me" action
// pill at the bottom of the expanded tile, turning the Win into something
// the user can actually schedule (and, with `email`, send to HR), not just read.
// `provider`: the provider lists' surface (pale grey gradient and border),
// same size and layout as every other tile on the page (the plain tile has a
// transparent border, so the provider border adds no height).
// `open` and `onOpenChange`, together, let the page open it (a link
// elsewhere on the page that leads to it).
// `badge` ({ count, label }): a red count bubble on its top right corner for
// something new in it (NewBadge.jsx).
// `action` ({ label, onClick }): a CTA-blue button at the bottom of the
// expanded tile, sharing the row half and half with the reminder pill.
export default function MobileWinTile({ title, headline, tagLabel, tagColor = GOLD, defaultOpen = false, reminder, action, provider = false, open: openProp, onOpenChange, badge, children }) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = f => onOpenChange ? onOpenChange(f(open)) : setOpenState(f);
  const surface = provider
    ? { background:PROVIDER_TILE_BG, border:PROVIDER_TILE_BORDER, boxShadow:PROVIDER_TILE_SHADOW }
    : { background:WHITE, border:"1px solid transparent", boxShadow:"0 2px 10px rgba(22,47,36,0.06)" };
  return (
    <div style={{position:"relative",marginBottom:"12px"}}>
    <div style={{...surface,borderRadius:RADIUS_CARD,overflow:"hidden"}}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{display:"flex",alignItems:"flex-start",gap:"12px",width:"100%",padding:"16px 16px 13px",background:"none",border:"none",textAlign:"left",font:"inherit",color:"inherit",cursor:"pointer"}}>
        <span style={{display:"block",flex:1,minWidth:0}}>
          <span style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
            <span style={{fontSize:"15px",fontWeight:700,color:G,lineHeight:1.3}}>{title}</span>
            {tagLabel && (
              <span style={{fontSize:"9.5px",fontWeight:700,color:tagColor,background:`${tagColor}18`,padding:"3px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap",flexShrink:0}}>{tagLabel}</span>
            )}
          </span>
          {headline && <span style={{display:"block",fontSize:"13.5px",color:TEXT,marginTop:"4px",lineHeight:1.4}}>{headline}</span>}
        </span>
        <span style={{display:"flex",alignItems:"center",flexShrink:0,marginTop:"2px"}}>
          <ChevronRight size={14} color={MUT} aria-hidden="true" style={{transform:open?"rotate(90deg)":"none",transition:"transform 0.15s"}}/>
        </span>
      </button>
      {open && (
        <div style={{padding:"0 16px 16px"}}>
          {children}
          {reminder
            ? <MobileReminderAction id={reminder.id} title={reminder.title} description={reminder.description} email={reminder.email} action={action}/>
            : action && <div style={{marginTop:"16px"}} onClick={e => e.stopPropagation()}><ActionButton action={action}/></div>}
        </div>
      )}
    </div>
    {badge && <NewBadge count={badge.count} label={badge.label}/>}
    </div>
  );
}
