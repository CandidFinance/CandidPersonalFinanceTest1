import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { G, MUT, SANS, SERIF, TILE_KICKER } from "../../design-tokens.js";

// The student loan page's tiles as one chain, each leading to the next
// (Harvey, 20 Nov 2026: "so a user can see the causal chain"): closed
// squares, two a row, read left to right, a wide soft line running behind
// them from one to the next. A square opens full width where it is, its row
// partner a short rectangle beside it in the order (above it when the opened
// one is second), so the order never changes. One open at a time.
//
// `items`: [{ id, title, look: { bg, border, art }, art, headline, line,
//   inner?: ({ rect }) => node (in place of the £, e.g. Planning's parts),
//   body: ({ onToggle, style }) => the tile opened (a MobileTile) }].
// A chain of one is just that tile, open.

const MOVE = { duration: 0.3, ease: [0.4, 0, 0.2, 1] };
// The line: wide enough to read as the route between the tiles.
const LINE = { width: 10, color: G, opacity: 0.16, radius: 16 };
// Where every picture starts: under the tile's padding and a two-line title.
const ART_TOP = "60px";

export default function LoanChain({ items }) {
  const reduce = useReducedMotion();
  const [openId, setOpenId] = useState(null);
  const wrapRef = useRef(null);
  const pathRef = useRef(null);
  const tileRefs = useRef({});
  const [drawn, setDrawn] = useState(false);
  const shown = items.filter(Boolean);
  const ids = shown.map(it => it.id).join("|");
  // An item gone (an answer changed) can't stay open.
  const open = shown.some(it => it.id === openId) ? openId : null;

  // The route: from each tile's centre to the next. Side by side, straight
  // across; a row down, down to the gap between them, across, and down into
  // the next, with rounded corners. Measured from the tiles as they are on
  // screen (mid-animation too), so the line moves with them.
  const draw = () => {
    const wrap = wrapRef.current, path = pathRef.current;
    if (!wrap || !path) return;
    const base = wrap.getBoundingClientRect();
    const boxes = shown.map(it => tileRefs.current[it.id]?.getBoundingClientRect()).filter(Boolean)
      .map(r => ({ top: r.top - base.top, bottom: r.bottom - base.top, cx: r.left - base.left + r.width / 2, cy: r.top - base.top + r.height / 2 }));
    if (boxes.length < 2) { path.setAttribute("d", ""); return; }
    let d = `M ${boxes[0].cx} ${boxes[0].cy}`;
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i - 1], b = boxes[i];
      if (Math.abs(a.top - b.top) < 2) { d += ` L ${b.cx} ${b.cy}`; continue; }
      const mid = (a.bottom + b.top) / 2;
      const dx = b.cx - a.cx;
      if (Math.abs(dx) < 1) { d += ` L ${b.cx} ${b.cy}`; continue; }
      const s = Math.sign(dx);
      const r = Math.max(0, Math.min(LINE.radius, Math.abs(dx) / 2, mid - a.cy, b.cy - mid));
      d += ` L ${a.cx} ${mid - r} Q ${a.cx} ${mid} ${a.cx + s * r} ${mid} L ${b.cx - s * r} ${mid} Q ${b.cx} ${mid} ${b.cx} ${mid + r} L ${b.cx} ${b.cy}`;
    }
    path.setAttribute("d", d);
  };

  useLayoutEffect(draw);
  // While the tiles move (a tile opening or closing), every frame.
  useEffect(() => {
    let frame, stop = performance.now() + (reduce ? 50 : 700);
    const tick = () => { draw(); if (performance.now() < stop) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, ids, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  // And when anything inside changes size (rows opening, the page width).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  // The line draws itself in once, when the chain first comes into view.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (drawn || !wrap) return;
    if (reduce || typeof IntersectionObserver === "undefined") { setDrawn(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setDrawn(true); }, { threshold: 0.25 });
    io.observe(wrap);
    return () => io.disconnect();
  }, [drawn, reduce, shown.length > 1]); // eslint-disable-line react-hooks/exhaustive-deps


  if (shown.length === 0) return null;
  if (shown.length === 1) return shown[0].body({});

  // Pairs in reading order: the opened one and its partner go full width;
  // a lone last tile is a rectangle.
  const shape = i => {
    const pair = Math.floor(i / 2) * 2;
    const partner = i === pair ? pair + 1 : pair;
    if (shown[i].id === open) return "open";
    if (partner >= shown.length) return "rect";
    return shown[partner].id === open ? "rect" : "square";
  };

  const toggle = (id, el) => {
    if (open === id) {
      // Closing from further down: back up to the tile as it folds.
      const top = el?.getBoundingClientRect().top ?? 0;
      if (top < 80) window.scrollBy({ top: top - 80, behavior: reduce ? "auto" : "smooth" });
      setOpenId(null);
    } else setOpenId(id);
  };

  return (
    <div ref={wrapRef} style={{position:"relative",display:"flex",flexWrap:"wrap",gap:"28px 24px",marginBottom:"12px"}}>
      <svg aria-hidden="true" style={{position:"absolute",inset:0,width:"100%",height:"100%",overflow:"visible",pointerEvents:"none",zIndex:0}}>
        <path ref={pathRef} pathLength="1" fill="none" stroke={LINE.color} strokeOpacity={LINE.opacity} strokeWidth={LINE.width} strokeLinecap="round" strokeLinejoin="round"
          style={reduce ? undefined : {strokeDasharray:1,strokeDashoffset:drawn ? 0 : 1,transition:"stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1) 0.15s"}}/>
      </svg>
      {shown.map((it, i) => (
        <ChainTile key={it.id} item={it} shape={shape(i)} moves={`${open}|${ids}`} reduce={reduce}
          tileRef={el => { tileRefs.current[it.id] = el; }} onToggle={el => toggle(it.id, el)}/>
      ))}
    </div>
  );
}

function ChainTile({ item, shape, moves, reduce, tileRef, onToggle }) {
  const ref = useRef(null);
  const setRef = el => { ref.current = el; tileRef(el); };
  const { look } = item;
  const opened = shape === "open", rect = shape === "rect";
  // Layout moves only when the chain's shape changes (Planning's squares
  // learnt this: a figure changing inside mustn't replay the move).
  const layout = reduce ? false : { layout: true, layoutDependency: moves, transition: MOVE };
  // The chevron runs on from the title's last word, wrapped or not, where the
  // opened tile (MobileTile) has it. Room for two lines either way, so the £
  // sits at the same height across a row.
  const kicker = (
    <span style={{...TILE_KICKER,fontFamily:SANS,lineHeight:1.3,color:"#585858",display:"block",minHeight:item.inner ? undefined : "2.6em"}}>
      {item.title}<ChevronDown size={16} color={MUT} strokeWidth={2.5} aria-hidden="true" style={{verticalAlign:"-3px",marginLeft:"6px"}}/>
    </span>
  );
  return (
    <motion.div ref={setRef} data-chain={item.id} {...(layout || {})}
      style={{position:"relative",zIndex:1,width:shape === "square" ? "calc(50% - 12px)" : "100%",...(shape === "square" ? { aspectRatio:"1" } : rect ? { minHeight:"120px" } : {}),
        background:look.bg,border:look.border,borderRadius:"14px",boxShadow:"0 4px 18px rgba(22,47,36,0.06)",boxSizing:"border-box",
        overflow:opened ? "visible" : "hidden",display:"flex",flexDirection:"column",scrollMarginTop:"80px"}}>
      {opened ? (
        <motion.div key="open" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: reduce ? 0 : 0.15 }}>
          {item.body({ onToggle: () => onToggle(ref.current), style: { background: "none", border: "none", borderRadius: 0, marginBottom: 0 } })}
        </motion.div>
      ) : (
        <>
          {/* The picture: faint, behind a square's £; on a rectangle's right
              30%, clear of the text. Every one starts under the deepest
              title (two lines, which every title reserves) and sits on the
              same bottom line, so they line up across the chain. */}
          <motion.span key={`art-${shape}`} aria-hidden="true" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: reduce ? 0 : 0.15 }}
            style={{position:"absolute",...(rect ? { top:0, right:0, bottom:0, width:"30%", padding:`${ART_TOP} 16px 16px 0` } : { inset:0, padding:`${ART_TOP} 8% 16px` }),boxSizing:"border-box",display:"flex",pointerEvents:"none",color:look.art}}>
            {item.inner ? null : item.art}
          </motion.span>
          <motion.button {...(reduce ? {} : { layout: "position", layoutDependency: moves, transition: MOVE })} type="button" onClick={() => onToggle(ref.current)} aria-expanded={false}
            style={{position:"relative",flex:1,display:"flex",flexDirection:"column",justifyContent:item.inner ? "space-between" : "flex-start",gap:item.inner ? "6px" : "10px",width:"100%",background:"none",border:"none",
              padding:item.inner ? "14px 10px 10px" : "14px 16px 16px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",color:"inherit"}}>
            <span style={{display:"block",width:"100%",paddingLeft:item.inner ? "6px" : 0}}>{kicker}</span>
            {item.inner ? item.inner({ rect }) : (
              <span style={{display:"flex",flexDirection:"column",gap:"4px",maxWidth:rect ? "70%" : "none"}}>
                <span style={{fontFamily:SERIF,fontSize:"26px",fontWeight:700,color:item.color ?? G,lineHeight:1,letterSpacing:"-0.01em"}}>{item.headline}</span>
                {/* Three lines at most, so the £ stays in the square. */}
                {item.line && <span style={{fontSize:"12px",fontWeight:700,color:G,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.line}</span>}
              </span>
            )}
          </motion.button>
        </>
      )}
    </motion.div>
  );
}

// The chain's pictures, in their tile's colour (currentColor), faint, as
// Planning's (FallingArt). The loan's rate against savings': two bars.
export function RatesArt() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 80" preserveAspectRatio="xMidYMax meet" style={{display:"block"}}>
      <rect x="22" y="8" width="24" height="68" rx="5" fill="currentColor" opacity="0.08"/>
      <rect x="54" y="22" width="24" height="54" rx="5" fill="currentColor" opacity="0.045"/>
    </svg>
  );
}
// Cash above the buffer: layers stacked.
export function BufferArt() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 80" preserveAspectRatio="xMidYMax meet" style={{display:"block"}}>
      {[[56, 0.18], [34, 0.13], [12, 0.08]].map(([y, o]) => <rect key={y} x="12" y={y} width="76" height="18" rx="6" fill="currentColor" opacity={o}/>)}
    </svg>
  );
}
// The same money in several places: lines fanning out.
export function FanArt() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 80" preserveAspectRatio="xMidYMax meet" style={{display:"block"}}>
      <path d="M8 70 C 36 70, 44 18, 92 10" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.15"/>
      <path d="M8 70 C 38 70, 50 40, 92 36" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.11"/>
      <path d="M8 70 L 92 62" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.08"/>
    </svg>
  );
}
