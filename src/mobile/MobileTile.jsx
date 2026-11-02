import { useState, useRef, useId, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { G, TEXT, MUT, WHITE, SANS, CARD, HAIRLINE, GOLD_TEXT } from "../design-tokens.js";
import useDialogFocus from "./useDialogFocus.js";

// A module answer tile, after Monzo's: a short bold title top left, a gold
// "more" button top right that opens a menu of the tile's actions, and the
// content as rows on the tile itself, never a tile inside it. Always open.
// `menu`: [{ icon, label, onClick }], falsy entries skipped.
// `level`: the title's heading level.
// Rows (TileRow) carry the hairline: it starts at the text's left edge and
// runs to the tile's right edge, so the tile has left padding only.
export default function MobileTile({ title, menu = [], level = 2, badge, children, ...rest }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const items = menu.filter(Boolean);
  const Heading = `h${level}`;
  const menuId = useId();
  return (
    <section {...rest} style={{...CARD,position:"relative",paddingLeft:"16px",marginBottom:"12px",scrollMarginTop:"80px",...rest.style}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",padding:"16px 6px 8px 0",minHeight:"24px"}}>
        <Heading style={{margin:0,fontFamily:SANS,fontSize:"17px",fontWeight:700,color:G,lineHeight:1.3}}>{title}</Heading>
        {items.length > 0 && (
          <button type="button" aria-label={`${title}: more`} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen(o => !o)}
            style={{display:"flex",alignItems:"center",justifyContent:"center",width:"44px",height:"44px",margin:"-10px 0",background:"none",border:"none",padding:0,color:GOLD_TEXT,cursor:"pointer",flexShrink:0}}>
            <MoreHorizontal size={22} strokeWidth={2.5} aria-hidden="true"/>
          </button>
        )}
      </div>
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
export function TileRow({ first = false, onClick, align = false, expanded, id, children, style }) {
  const box = {borderTop:first ? "none" : HAIRLINE,padding:"12px 16px 12px 0",scrollMarginTop:"80px",...style};
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
