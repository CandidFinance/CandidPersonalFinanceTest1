import { useState, useRef, useId, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { G, TEXT, MUT, WHITE, SANS, SERIF, CARD, HAIRLINE, GOLD_TEXT, CRITICAL } from "../design-tokens.js";
import useDialogFocus from "./useDialogFocus.js";

// A module answer tile, after Monzo's: a short bold title top left, a gold
// "more" button top right that opens a menu of the tile's actions, and the
// content as rows on the tile itself, never a tile inside it. Always open.
// `menu`: [{ icon, label, onClick }], falsy entries skipped.
// `level`: the title's heading level. `subtitle`: a line under the title, as
// close to it as a row's note is to its label.
// Rows (TileRow) carry the hairline: it starts at the text's left edge and
// runs to the tile's right edge, so the tile has left padding only.
export default function MobileTile({ title, subtitle, menu = [], level = 2, badge, children, ...rest }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const items = menu.filter(Boolean);
  const Heading = `h${level}`;
  const menuId = useId();
  return (
    <section {...rest} style={{...CARD,position:"relative",paddingLeft:"16px",marginBottom:"12px",scrollMarginTop:"80px",...rest.style}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",padding:subtitle ? "16px 6px 0 0" : "16px 6px 8px 0",minHeight:"24px"}}>
        <Heading style={{margin:0,fontFamily:SANS,fontSize:"17px",fontWeight:700,color:G,lineHeight:1.3}}>{title}</Heading>
        {items.length > 0 && (
          <button type="button" aria-label={`${title}: more`} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen(o => !o)}
            style={{display:"flex",alignItems:"center",justifyContent:"center",width:"44px",height:"44px",margin:"-10px 0",background:"none",border:"none",padding:0,color:GOLD_TEXT,cursor:"pointer",flexShrink:0}}>
            <MoreHorizontal size={22} strokeWidth={2.5} aria-hidden="true"/>
          </button>
        )}
      </div>
      {subtitle && <div style={{...ROW.note,padding:`0 16px ${ROW_PAD} 0`}}>{subtitle}</div>}
      {children}
      <AnimatePresence>
        {menuOpen && <TileMenu id={menuId} title={title} items={items} onClose={() => setMenuOpen(false)}/>}
      </AnimatePresence>
      {badge}
    </section>
  );
}

// One row of a tile. `first`: no hairline above it (the row under the title).
// `onClick`: the whole row is a button, with a chevron at its right.
// `align`: a plain row that keeps the chevron's space, so its figure lines
// up with those of tappable rows in the same tile.
// `expanded` (with `onClick`): the row opens content under itself, its
// chevron turning down while open.
const CHEVRON = 16, CHEVRON_GAP = "10px";
// A row's padding above and below its text.
const ROW_PAD = "9px";
export function TileRow({ first = false, onClick, align = false, expanded, id, children, style }) {
  const box = {borderTop:first ? "none" : HAIRLINE,padding:`${ROW_PAD} 16px ${ROW_PAD} 0`,scrollMarginTop:"80px",...style};
  if (!onClick && align) return (
    <div id={id} style={{...box,display:"flex",alignItems:"center",gap:CHEVRON_GAP}}>
      <div style={{flex:1,minWidth:0}}>{children}</div>
      <span aria-hidden="true" style={{width:`${CHEVRON}px`,flexShrink:0}}/>
    </div>
  );
  if (!onClick) return <div id={id} style={box}>{children}</div>;
  return (
    <button type="button" id={id} onClick={onClick} aria-expanded={expanded}
      style={{...box,display:"flex",alignItems:"center",gap:CHEVRON_GAP,width:"100%",borderLeft:"none",borderRight:"none",borderBottom:"none",background:"none",textAlign:"left",font:"inherit",color:"inherit",cursor:"pointer"}}>
      <span style={{display:"block",flex:1,minWidth:0}}>{children}</span>
      <ChevronRight size={CHEVRON} color={MUT} aria-hidden="true" style={{flexShrink:0,transform:expanded ? "rotate(90deg)" : "none",transition:"transform 0.15s"}}/>
    </button>
  );
}

// A row's parts: its label and note on the left, its figure on the right.
// `text`: a sentence on its own row; `action`: a row that leads somewhere.
export const ROW = {
  line: { display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:"12px" },
  label: { fontSize:"14px", color:TEXT, lineHeight:1.4 },
  note: { fontSize:"12px", color:MUT, lineHeight:1.45, marginTop:"2px" },
  figure: { fontFamily:SERIF, fontSize:"17px", fontWeight:700, color:G, whiteSpace:"nowrap" },
  text: { fontSize:"13px", color:TEXT, lineHeight:1.55, margin:0 },
  action: { display:"flex", alignItems:"center", gap:"10px", fontSize:"14px", fontWeight:600, color:G },
};

// A row's text: its label, semi-bold, its note under it, and its figure at
// the right, centred on the row as the chevron is. `inline`: the note on the
// label's line, so a tile of short rows keeps one depth. `tool`: a small
// button beside the label (the spanner that edits the figure, or a ?).
export function RowText({ label, note, figure, inline = false, figureStyle, tool }) {
  const head = <span style={{...ROW.label,fontWeight:600}}>{label}</span>;
  return (
    <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
      <div style={{flex:1,minWidth:0}}>
        {inline ? (
          <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",columnGap:"6px"}}>{head}{tool}{note && <span style={{...ROW.note,marginTop:0}}>{note}</span>}</div>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"6px"}}>{head}{tool}</div>
            {note && <div style={ROW.note}>{note}</div>}
          </>
        )}
      </div>
      {figure != null && figure !== false && <span style={{...ROW.figure,...figureStyle}}>{figure}</span>}
    </div>
  );
}

// A PRIORITY pill, for a row's `tool`.
export const priorityTag = <span style={{fontSize:"11px",fontWeight:700,color:CRITICAL,background:`${CRITICAL}18`,padding:"2px 8px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase"}}>Priority</span>;

// A calculator row's icon, where a provider's logo sits in a list
// (ProviderLogo): marks the row as something to open. `muted`: a note's, with
// no tile behind it.
export function RowIcon({ icon: Icon, muted = false, color = G }) {
  return (
    <span aria-hidden="true" style={{width:"32px",height:"32px",borderRadius:"8px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:muted ? "none" : "rgba(22,47,36,0.07)"}}>
      <Icon size={muted ? 18 : 17} color={muted ? MUT : color} strokeWidth={2}/>
    </span>
  );
}
// The icon, then the row's own content.
export const withIcon = (icon, children, muted = false, color) => (
  <div style={{display:"flex",alignItems:muted ? "flex-start" : "center",gap:"12px"}}><RowIcon icon={icon} muted={muted} color={color}/><div style={{flex:1,minWidth:0}}>{children}</div></div>
);
// A calculator open under its row: indented past the icon, so its rows'
// hairlines start under the row's text.
export const Nested = ({ children }) => <div style={{marginLeft:"44px"}}>{children}</div>;

// A card that pops out from a row's button (a spanner, a ?), as the menu
// does from the "more" button: an input or an explanation over the page,
// not opening the tile downwards. Put it inside the row, made `position:
// relative` (`anchor` below); it opens under the row
// from its right edge. A tap anywhere else, or Escape, closes it.
export function TilePopover({ title, onClose, children }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  useDialogFocus(ref, { onEscape: onClose });
  return (
    <>
      <motion.div aria-hidden="true" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.15 }}
        style={{position:"fixed",inset:0,zIndex:40,background:"rgba(22,47,36,0.08)"}}/>
      <motion.div ref={ref} role="dialog" aria-label={title} tabIndex={-1}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
        transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.2, 0, 0, 1] }}
        style={{position:"absolute",top:"calc(100% - 4px)",right:"8px",zIndex:41,transformOrigin:"top right",width:"min(320px, calc(100% - 8px))",background:WHITE,borderRadius:"14px",boxShadow:"0 8px 28px rgba(22,47,36,0.18), 0 1px 3px rgba(22,47,36,0.08)",padding:"14px 16px",outline:"none",textAlign:"left"}}>
        <div style={{fontFamily:SANS,fontSize:"15px",fontWeight:700,color:G,marginBottom:"8px"}}>{title}</div>
        {children}
      </motion.div>
    </>
  );
}
// A row's anchor for a TilePopover.
export const anchor = { position:"relative" };

// The menu: a small card from the "more" button's corner, an icon and a
// label per item, no hairlines. Opens and closes with a scale and fade from
// that corner; a tap anywhere else, or Escape, closes it.
function TileMenu({ id, title, items, onClose }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  useDialogFocus(ref, { onEscape: onClose, focusOnOpen: false });
  useEffect(() => { ref.current?.querySelector("[role=menuitem]")?.focus({ preventScroll: true }); }, []);
  const pick = item => { onClose(); item.onClick(); };
  // Up and Down move between items, as a menu does.
  const onKeyDown = e => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const btns = [...ref.current.querySelectorAll("[role=menuitem]")];
    const i = btns.indexOf(document.activeElement);
    btns[(i + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length]?.focus();
  };
  return (
    <>
      <motion.div aria-hidden="true" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.15 }}
        style={{position:"fixed",inset:0,zIndex:40,background:"rgba(22,47,36,0.08)"}}/>
      <motion.div ref={ref} id={id} role="menu" aria-label={title} onKeyDown={onKeyDown}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
        transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.2, 0, 0, 1] }}
        style={{position:"absolute",top:"44px",right:"8px",zIndex:41,transformOrigin:"top right",minWidth:"220px",maxWidth:"calc(100% - 24px)",background:WHITE,borderRadius:"14px",boxShadow:"0 8px 28px rgba(22,47,36,0.18), 0 1px 3px rgba(22,47,36,0.08)",padding:"6px 0"}}>
        {items.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" role="menuitem" onClick={() => pick(item)}
              style={{display:"flex",alignItems:"center",gap:"14px",width:"100%",minHeight:"44px",padding:"10px 18px",background:"none",border:"none",textAlign:"left",fontFamily:SANS,fontSize:"15px",fontWeight:500,color:TEXT,cursor:"pointer"}}>
              {Icon && <Icon size={19} color={G} strokeWidth={2} aria-hidden="true" style={{flexShrink:0}}/>}
              <span>{item.label}</span>
            </button>
          );
        })}
      </motion.div>
    </>
  );
}
