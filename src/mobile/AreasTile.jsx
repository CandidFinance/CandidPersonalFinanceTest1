import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { IconButton } from "./ui";
import { MODULE_META } from "../lib/moduleStatus.js";
import { TILE_ART } from "./tileArt.js";
import { fmtCompact } from "../lib/format.js";
import { G, MUT, TEXT, WHITE, SANS, CARD, TILE_KICKER } from "../design-tokens.js";

// Home's "Areas to explore": the opportunities as small tiles inside the
// tile, largest £ first, each opening its module: the Modules screen's tile
// in small, square, with its name and its illustration (tileArt.js); the £
// is in its label for screen readers. A half-width square beside the £100k
// tax trap tile, titled "To explore" so the title fits, or the full width
// when it's alone (`full`; HomeTilePair.jsx). Up to four; with more, the
// fourth says how many others
// there are and opens Modules. A reviewed area (`ticking`, appEntry.js
// areasOnHome) shows its tick on the first visit after the review, then
// fades and joins `areasTicked`, so it's gone from then on. Closed with its
// X (`onDismiss`).
const SHOWN = 4;
const TICK_MS = 1200;
// The name rule (Harvey, 18 Nov 2026): each mini tile carries its module's
// own name, as on Modules (MODULE_META), never a shortened one; a name too
// long for the tile is cut with an ellipsis ("Student lo…"), and the full
// name is in its label.
const META = Object.fromEntries(MODULE_META.map(mm => [mm.key, mm]));
// Frosted glass for the square's title and cross, over the mini tiles.
const GLASS = { background:"rgba(255,255,255,0.2)", backdropFilter:"blur(16px) saturate(1.6)", WebkitBackdropFilter:"blur(16px) saturate(1.6)",
  border:"1px solid rgba(255,255,255,0.7)", boxShadow:"0 2px 10px rgba(22,47,36,0.16), 0 0 0 0.5px rgba(22,47,36,0.06)" };
const GLASS_INK = "#3d4a44";

export default function AreasTile({ items, ticking, full = false, onOpen, onSeeAll, onTicked, onDismiss }) {
  const reduce = useReducedMotion();
  // The ticks hold a moment, then go.
  useEffect(() => {
    if (!ticking.length) return;
    const id = setTimeout(() => onTicked(ticking), reduce ? 600 : TICK_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per set of ticks
  }, [ticking.join()]);

  const more = items.length > SHOWN ? items.length - (SHOWN - 1) : 0;
  const shown = more ? items.slice(0, SHOWN - 1) : items;
  // Square, the mini tiles are sized to the space under the title, so the
  // tile stays square however many rows they take; full width, to the width.
  const gap = full ? 8 : 6;
  const box = useRef(null);
  const [space, setSpace] = useState(null);
  useEffect(() => {
    const el = box.current;
    if (full || !el) return;
    const update = () => setSpace({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);
  const cells = shown.length + (more > 0 ? 1 : 0);
  const side = !full && space ? Math.floor(Math.min((space.w - gap) / 2, cells > 2 ? (space.h - gap) / 2 : space.h)) : null;
  // Square, the name sits at the foot, clear of the glass title over the top
  // row.
  const cell = { display:"flex",flexDirection:full ? "column" : "column-reverse",gap:"1px",aspectRatio:"1",minWidth:0,minHeight:0,boxSizing:"border-box",overflow:"hidden",
    background:"rgba(22,47,36,0.05)",border:"none",borderRadius:"10px",padding:"5px 5px 4px 6px",cursor:"pointer",fontFamily:SANS,textAlign:"left",color:TEXT };
  const title = full ? "Areas to explore" : "To explore";

  return (
    <section aria-label="Areas to explore"
      style={{...CARD,position:"relative",boxSizing:"border-box",padding:"14px",width:full ? "100%" : "calc(50% - 6px)",...(!full && { aspectRatio:"1" }),alignSelf:"stretch",display:"flex",flexDirection:"column",gap:"10px"}}>
      {full ? (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"6px"}}>
          <h2 style={TILE_KICKER}>{title}</h2>
          <IconButton icon={X} label="Dismiss Areas to explore" size={28} variant="plain" color={MUT} onClick={onDismiss} style={{margin:"-6px -6px -6px 0"}}/>
        </div>
      ) : <>
        {/* Square (Harvey, 18 Nov): the mini tiles fill the tile inside an
            even 14px, and the title and cross float over them on frosted
            glass, each where the £100k tax trap tile's header is (its text
            and icon 14px down, 16px in, on a 16px row). */}
        <h2 style={{...TILE_KICKER,...GLASS,position:"absolute",zIndex:2,top:"11px",left:"10px",padding:"2px 5px",borderRadius:"7px",lineHeight:"16px",color:GLASS_INK}}>{title}</h2>
        <IconButton icon={X} label="Dismiss Areas to explore" size={28} variant="plain" color={GLASS_INK} onClick={onDismiss}
          style={{...GLASS,position:"absolute",zIndex:2,top:"11px",right:"13px",width:"21px",height:"21px",borderRadius:"7px",boxSizing:"border-box"}}/>
      </>}
      <div ref={box} style={{position:"relative",...(!full && { flex:1, minHeight:0 })}}>
      <div style={{...(!full && { position:"absolute", inset:0 }),display:"grid",gridTemplateColumns:full ? "repeat(4, 1fr)" : `repeat(2, ${side ? side + "px" : "1fr"})`,
        gridAutoRows:side ? `${side}px` : "auto",justifyContent:full ? "center" : "space-between",alignContent:!full && cells > 2 ? "space-between" : "start",gap:`${gap}px`}}>
        <AnimatePresence initial={false}>
          {shown.map(p => {
            const name = META[p.key]?.title || p.title;
            const art = TILE_ART[p.key]?.[0];
            return (
              <motion.button key={p.key} type="button" layout={!reduce} onClick={() => onOpen(p.key)}
                exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3 }}
                aria-label={`${p.title}: ${fmtCompact(p.amount)}${p.amountIsLumpSum ? " by 18" : " a year"}${p.done ? ", reviewed" : ""}`}
                style={cell}>
                <span aria-hidden="true" style={{fontSize:"10px",fontWeight:700,color:G,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name}</span>
                {/* The module's illustration; reviewed, a tick in its place. */}
                <span aria-hidden="true" style={{position:"relative",flex:1,minHeight:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {p.done
                    ? <span style={{width:"24px",height:"24px",borderRadius:"50%",background:G,color:WHITE,display:"flex",alignItems:"center",justifyContent:"center"}}><Check size={14} strokeWidth={3}/></span>
                    : art && <img src={`/tile-illustrations/${art}.svg`} alt="" draggable="false" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain"}}/>}
                </span>
              </motion.button>
            );
          })}
          {more > 0 && (
            <motion.button key="more" type="button" layout={!reduce} onClick={onSeeAll} style={{...cell,flexDirection:"column",justifyContent:"center",alignItems:"center"}}>
              <span style={{fontSize:"13px",fontWeight:700,color:G}}>+{more}</span>
              <span style={{fontSize:"10.5px",fontWeight:600,color:MUT}}>more</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      </div>
    </section>
  );
}
