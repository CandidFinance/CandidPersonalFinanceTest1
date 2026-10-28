import { Plus } from "lucide-react";
import { fmtCompact } from "../../lib/format.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, CDARK, RADIUS_CARD, PILL_HEIGHT, HERO_TILE_BG } from "../../design-tokens.js";
import { pillFieldStyle } from "../../mobile/PillMoneyInput.jsx";

// Pieces shared by the Progress tab's sections (ProgressTrackerDashboard,
// GoalVaults).

export const kicker = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.09em", textTransform:"uppercase", margin:0 };
export const helpText = { fontSize:"12px", color:MUT, lineHeight:1.5, margin:0 };

// A section's tile: white, or `wash` for the headline pair (Home's hero
// tile treatment), with its title and, on the right, an optional action.
export function Tile({ title, action = null, wash = false, tour, children }) {
  return (
    <section data-tour={tour} style={{display:"flex",flexDirection:"column",minWidth:0,background:wash ? HERO_TILE_BG : WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:RADIUS_CARD,
      boxShadow:wash ? "0 4px 18px rgba(22,47,36,0.07)" : "0 2px 10px rgba(22,47,36,0.05)",padding:"16px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"12px"}}>
        <h2 style={kicker}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// A completion bar: thick, filled in its category's colour on a pale step
// of the same colour. Its length is the one sign of progress (CLAUDE.md
// rule 4): reaching a target fills it, with no tick or change on top. Spans,
// as it sits inside a goal tile's button. `color` is a "#rrggbb" chart colour.
export function ProgressBar({ pct, color, label }) {
  return (
    <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
      style={{display:"block",height:"14px",borderRadius:"100px",background:`${color}26`,overflow:"hidden"}}>
      <span style={{display:"block",height:"100%",width:`${pct}%`,background:color,borderRadius:"100px",transition:"width 0.3s ease"}}/>
    </span>
  );
}

// The bar's place on a goal that's locked: an empty grey track.
export const lockedBar = <span style={{display:"block",height:"14px",borderRadius:"100px",background:"rgba(22,47,36,0.07)"}}/>;

// A goal's figures in £k, the amount in serif (CLAUDE.md rule 5): "£9k/£20k",
// or the amount alone without a target.
export function Figure({ current, target = 0 }) {
  return (
    <>
      <span style={{fontFamily:SERIF,fontSize:"14px",fontWeight:700,color:TEXT}}>{fmtCompact(current)}</span>
      {target > 0 && <span style={{fontSize:"11px",color:MUT}}>/{fmtCompact(target)}</span>}
    </>
  );
}

// One goal: a white tile nested in its section's, with a shadow. Its name
// on the left (small, over two lines where it needs them), the bar, and its
// figures, the name and figures in columns of fixed width so every goal's
// bar is the same length. A tap opens the details below it: the figures in
// full, and what can be changed. `locked` greys it out; `tag` sits under
// the name, saying what kind of goal it is (a custom one's).
export function BarTile({ title, tag = null, bar, figure = null, locked = false, open, onToggle, children }) {
  const faded = { opacity: locked ? 0.4 : 1 };
  return (
    <div style={{background:WHITE,border:"1px solid rgba(22,47,36,0.08)",borderRadius:"12px",boxShadow:"0 2px 10px rgba(22,47,36,0.07)"}}>
      <button type="button" aria-expanded={open} onClick={onToggle}
        style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",minHeight:"50px",background:"none",border:"none",padding:"9px 12px",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
        {/* 70px: room for "Emergency", the longest single word, on one line. */}
        <span style={{flex:"0 0 70px",minWidth:0,...faded}}>
          <span style={{display:"block",fontSize:"12px",fontWeight:700,color:TEXT,lineHeight:1.25,overflowWrap:"break-word"}}>{title}</span>
          {tag}
        </span>
        <span style={{flex:1,minWidth:0,...faded}}>{bar}</span>
        <span style={{flex:"0 0 84px",textAlign:"right",whiteSpace:"nowrap"}}>{figure}</span>
      </button>
      {open && <div style={{padding:"0 12px 12px"}}>{children}</div>}
    </div>
  );
}

// A small label under a goal's name saying what kind it is ("Custom"), on
// a pale step of the goal's colour, the text itself in muted ink.
export function Tag({ children, color }) {
  return (
    <span style={{display:"inline-block",marginTop:"4px",padding:"2px 6px",borderRadius:"100px",background:`${color}1f`,
      fontSize:"9px",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:MUT,lineHeight:1.3}}>
      {children}
    </span>
  );
}

// An action among the goal tiles (Add a goal), set apart from them as the
// app's other "add" buttons are (ScenarioModelling's): a dashed gold
// outline with no fill or shadow, its label centred in green. A tap opens
// its form below.
export function AddTile({ label, open, onToggle, children }) {
  return (
    <div style={{border:`1.5px dashed ${GOLD}`,borderRadius:"12px"}}>
      <button type="button" aria-expanded={open} onClick={onToggle}
        style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",width:"100%",minHeight:"46px",background:"none",border:"none",padding:"9px 12px",cursor:"pointer",fontFamily:"inherit",color:G,fontSize:"13px",fontWeight:700}}>
        <Plus size={15} aria-hidden="true"/>
        {label}
      </button>
      {open && <div style={{padding:"0 12px 12px"}}>{children}</div>}
    </div>
  );
}

// An open tile's details: a line of text, and an action on the right.
export function Details({ text, action = null }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px"}}>
      <p style={helpText}>{text}</p>
      {action}
    </div>
  );
}

export function TextButton({ children, onClick, muted = false }) {
  return (
    <button type="button" onClick={onClick} style={{background:"none",border:"none",padding:0,color:muted ? MUT : G,fontSize:"12.5px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
      {children}
    </button>
  );
}

// A form opened in place: a title, the fields, then Cancel and Save, as in
// LoanBalanceEditor; `footer` sits below them (a Remove link). A pale panel
// rather than another card, as it opens inside the tiles.
export function EditorCard({ title, children, onCancel, onSave, saveDisabled = false, footer = null }) {
  const ghost = { flex:1, background:WHITE, border:"1.3px solid rgba(22,47,36,0.2)", borderRadius:"100px", padding:"10px", fontSize:"13px", fontWeight:600, color:G, cursor:"pointer", fontFamily:"inherit" };
  const solid = { flex:1, background:saveDisabled ? "rgba(22,47,36,0.25)" : G, border:"none", borderRadius:"100px", padding:"10px", fontSize:"13px", fontWeight:600, color:WHITE, cursor:saveDisabled ? "not-allowed" : "pointer", fontFamily:"inherit" };
  return (
    <div style={{background:"#f7f7f4",borderRadius:"10px",padding:"12px",marginTop:"10px"}}>
      <div style={{...kicker,fontSize:"10.5px",marginBottom:"10px"}}>{title}</div>
      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>{children}</div>
      <div style={{display:"flex",gap:"8px",marginTop:"14px"}}>
        <button type="button" onClick={onCancel} style={ghost}>Cancel</button>
        <button type="button" onClick={onSave} disabled={saveDisabled} style={solid}>Save</button>
      </div>
      {footer}
    </div>
  );
}

// A one-line text field in the same pill as PillMoneyInput.
export function TextPill({ label, value, onChange, placeholder = "", maxLength = 40 }) {
  return (
    <label style={{minWidth:0,background:CDARK,borderRadius:"100px",padding:"0 16px",height:PILL_HEIGHT,boxSizing:"border-box",display:"flex",flexDirection:"column",justifyContent:"center",cursor:"text"}}>
      <span style={{fontSize:"9.5px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</span>
      <input type="text" value={value} placeholder={placeholder} maxLength={maxLength} onChange={e => onChange(e.target.value)}
        style={{border:"none",background:"none",color:TEXT,outline:"none",padding:0,...pillFieldStyle("100%")}}/>
    </label>
  );
}
