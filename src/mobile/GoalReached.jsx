import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy, TriangleAlert } from "lucide-react";
import { G, GOLD, GOLD_TEXT, WARNING, STATUS_TILE, WHITE, TEXT, MUT, SERIF, CREAM, PROGRESS_GREEN, CTA_BLUE, RADIUS_CARD } from "../design-tokens.js";
import { fmt } from "../lib/format.js";
import { taxYearShort } from "../lib/taxYear.js";
import { tap } from "./haptics.js";

// The pop-up when a goal is reached (progressTracker.js goalsToCelebrate):
// over the main screens, with fireworks behind the card, once per goal.
// CandidApp holds it back during walk-throughs and the tours, and saves the
// goals as seen when it's closed. `goals`: [{ key, label, current, target,
// perYear, pot, warn, usedTitle, usedLine }]. `onProgress`: a link to
// Progress, left out on Progress. Limits reached (capital gains, dividends:
// every goal `warn`) come as a warning instead: an amber sign, no
// fireworks, and what's taxed past them.

export default function GoalReached({ goals, taxYear, onShown, onClose, onProgress = null }) {
  const reduce = useReducedMotion();
  const dialogRef = useRef(null);
  useEffect(() => {
    tap(20);
    onShown?.();
    dialogRef.current?.focus({ preventScroll: true });
    const esc = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const one = goals.length === 1 ? goals[0] : null;
  const warn = goals.every(g => g.warn);
  const amber = STATUS_TILE.tight.figure;
  const amount = g => `${fmt(g.target)}${g.perYear ? " a year" : ""}`;
  const button = primary => ({
    width: "100%", background: primary ? G : "none", color: primary ? WHITE : G, border: "none", borderRadius: "100px",
    padding: "13px", fontSize: "14px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
  });

  return (
    <div style={{position:"fixed",inset:0,zIndex:4100,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
      <motion.div aria-hidden="true" onClick={onClose} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
        style={{position:"absolute",inset:0,background:"rgba(14,34,25,0.55)"}}/>
      {!reduce && !warn && <Fireworks/>}
      <motion.div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="goal-reached-title"
        initial={reduce ? false : { opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        style={{position:"relative",width:"100%",maxWidth:"340px",background:CREAM,borderRadius:RADIUS_CARD,padding:"28px 22px 16px",textAlign:"center",outline:"none",boxShadow:"0 20px 50px rgba(14,34,25,0.35)"}}>
        <motion.div initial={reduce ? false : { scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.15 }}
          style={{width:"72px",height:"72px",margin:"0 auto",borderRadius:"50%",
            background:warn ? `radial-gradient(circle at 35% 30%, #f0a050, ${WARNING})` : `radial-gradient(circle at 35% 30%, #e2bd6e, ${GOLD})`,
            display:"flex",alignItems:"center",justifyContent:"center",boxShadow:warn ? "0 6px 18px rgba(217,130,43,0.4)" : "0 6px 18px rgba(196,150,58,0.45)"}}>
          {warn ? <TriangleAlert size={34} color={WHITE} strokeWidth={2} aria-hidden="true"/>
            : <Trophy size={36} color={WHITE} strokeWidth={2} aria-hidden="true"/>}
        </motion.div>
        <p style={{margin:"16px 0 0",fontSize:"11px",fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase",color:warn ? amber : GOLD_TEXT}}>
          {warn ? `Allowance used, ${taxYearShort(taxYear)}` : one ? "Goal reached" : `${goals.length} goals reached`}
        </p>
        <h2 id="goal-reached-title" style={{margin:"6px 0 0",fontFamily:SERIF,fontSize:"26px",fontWeight:700,color:G,lineHeight:1.2}}>
          {warn ? (one ? one.usedTitle : "Allowances used") : "Congratulations!"}
        </h2>
        {one ? <>
          <div style={{marginTop:"12px",fontFamily:SERIF,fontSize:"34px",fontWeight:700,color:TEXT,lineHeight:1.1}}>{amount(one)}</div>
          <p style={{margin:"8px 0 0",fontSize:"14px",color:MUT,lineHeight:1.5}}>
            {warn ? one.usedLine : `You've reached your ${one.label} goal${one.pot ? "" : ` for ${taxYearShort(taxYear)}`}.`}
          </p>
        </> : (
          <ul style={{listStyle:"none",margin:"14px 0 0",padding:0,textAlign:"left"}}>
            {goals.map(g => (
              <li key={g.key} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:"12px",padding:"8px 0",borderTop:"1px solid rgba(22,47,36,0.1)"}}>
                <span style={{fontSize:"14px",fontWeight:600,color:TEXT}}>{g.label}</span>
                <span style={{fontFamily:SERIF,fontSize:"17px",fontWeight:700,color:TEXT,whiteSpace:"nowrap"}}>{amount(g)}</span>
              </li>
            ))}
          </ul>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:"2px",marginTop:"20px"}}>
          {onProgress && <button type="button" onClick={onProgress} style={button(true)}>See your progress</button>}
          <button type="button" onClick={onClose} style={button(!onProgress)}>{onProgress ? "Close" : "Done"}</button>
        </div>
      </motion.div>
    </div>
  );
}

// Bursts of sparks over the screen for a couple of seconds, behind the card:
// each rises a little, opens into a ring that falls and fades.
const COLORS = [GOLD, "#e2bd6e", PROGRESS_GREEN, CTA_BLUE, WHITE];
const BURSTS = 9, SPARKS = 46, RUN_MS = 2800;
function Fireworks() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const sparks = [];
    const timers = Array.from({ length: BURSTS }, (_, b) => setTimeout(() => {
      // Above and below the card (the middle half of the screen), so it's seen.
      const x = w * (0.12 + Math.random() * 0.76), y = h * (b % 3 === 2 ? 0.78 + Math.random() * 0.1 : 0.06 + Math.random() * 0.2);
      const color = COLORS[b % COLORS.length];
      for (let i = 0; i < SPARKS; i++) {
        const a = (Math.PI * 2 * i) / SPARKS + Math.random() * 0.2, v = 2.6 + Math.random() * 3.2;
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color: i % 5 ? color : WHITE, r: 2.2 + Math.random() * 2.2 });
      }
    }, b * 280));
    let frame;
    const start = performance.now();
    const draw = now => {
      ctx.clearRect(0, 0, w, h);
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.vx *= 0.97; s.vy = s.vy * 0.97 + 0.06;
        s.x += s.vx; s.y += s.vy; s.life -= 0.012;
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      if (now - start < RUN_MS + 1500) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, h);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); timers.forEach(clearTimeout); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>;
}
