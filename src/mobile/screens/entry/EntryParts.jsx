import { useEffect, useMemo, useState } from "react";
import { SILHOUETTES } from "./art.js";
import "./entry.css";

// What the entry's screens and the guess comparison share.

// Each module's colours, name and pictures. `hero`: public/onboarding/hero-*.svg
// and its silhouette; `file`: public/tile-illustrations/*.svg.
export const LOOK = {
  cash:        { bg:"#DDF1E4", ink:"#1f5f44", flush:"#C6EBD3", name:"Cash & savings", short:"Cash", file:"cash", hero:"cash" },
  investments: { bg:"#E9E4FA", ink:"#4f3aa8", flush:"#D9D1F6", name:"Investing", short:"Investing", file:"investments", hero:"investments" },
  pension:     { bg:"#DFEAFA", ink:"#1d4c96", flush:"#C7DBF8", name:"Pension", short:"Pension", file:"pension", hero:"pension" },
  studentLoan: { bg:"#FAEBD2", ink:"#7a4e07", flush:"#F6DDB4", name:"Student loan", short:"Student loan", file:"student-loan", hero:"student" },
  taxTrap:     { bg:"#D9F0EE", ink:"#125c58", flush:"#BFE7E3", name:"£100k tax trap", short:"£100k tax trap", file:"100k-tax-trap", hero:"trap" },
  kids:        { bg:"#FBE3DD", ink:"#9a3a24", flush:"#F8D2C8", name:"Family", short:"Family", file:"kids-family", hero:"kids" },
  property:    { bg:"#F5E2EE", ink:"#832f5c", flush:"#EFCFE2", name:"Buying a home", short:"Buying a home", file:"property", hero:"property" },
};
export const tileArt = file => `/tile-illustrations/${file}.svg`;
export const greyArt = file => `/tile-illustrations/${file}-not-live.svg`;

// Designed at 760 high and at least 340 wide. A phone fills the screen with
// the stage scaled to fit; anything wider gets a phone-sized panel, centred.
const WIDE_FROM = 600, DESIGN_H = 760, MIN_W = 340, PANEL_W = 390, MAX_SCALE = 1.2, PANEL_MARGIN = 32;
function measure() {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (vw >= WIDE_FROM) {
    const s = Math.min((vh - PANEL_MARGIN) / DESIGN_H, MAX_SCALE);
    return { s, w: PANEL_W, h: DESIGN_H, left: (vw - PANEL_W * s) / 2, top: (vh - DESIGN_H * s) / 2, radius: 38 };
  }
  const s = Math.min(vw / MIN_W, vh / DESIGN_H, MAX_SCALE);
  return { s, w: Math.ceil(vw / s), h: Math.ceil(vh / s), left: 0, top: 0, radius: 0 };
}
export function useStageFit() {
  const [fit, setFit] = useState(measure);
  useEffect(() => {
    const on = () => setFit(measure());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return fit;
}
export function Stage({ fit, children, ...rest }) {
  // The cookie notice would cover the answers and the button. It waits until
  // the module, with no analytics cookies set until it's answered.
  useEffect(() => {
    document.body.classList.add("ce-open");
    return () => document.body.classList.remove("ce-open");
  }, []);
  return (
    <div className="ce-back">
      <div className="ce" {...rest} style={{ left: fit.left, top: fit.top, width: fit.w, height: fit.h, transform: `scale(${fit.s})`, borderRadius: fit.radius }}>
        {children}
      </div>
    </div>
  );
}

// The drifting pattern of module icons. They sit on a diagonal lattice, each
// diagonal keeping to one icon, so one drift step can't be seen.
const CELL_W = 58, CELL_H = 48;
function monogramSvg(keys) {
  const n = keys.length, W = 2 * CELL_W * n, H = 2 * CELL_H * n, seen = new Map();
  for (let i = -2 * n; i < 4 * n; i++) for (let j = -2 * n; j < 4 * n; j++) {
    const x = (((i + j) * CELL_W) % W + W) % W, y = (((i - j) * CELL_H) % H + H) % H;
    seen.set(`${x},${y}`, keys[((i % n) + n) % n]);
  }
  const defs = keys.map(k => `<symbol id="m-${k}" viewBox="0 0 300 244">${SILHOUETTES[k]}</symbol>`).join("");
  const uses = [...seen].map(([p, k]) => { const [x, y] = p.split(",").map(Number); return `<use href="#m-${k}" x="${x + 6}" y="${y + 5}" width="46" height="37.4"/>`; }).join("");
  return { W, H, url: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${uses}</svg>`)}")` };
}
export function Monogram({ keys }) {
  const { W, H, url } = useMemo(() => monogramSvg(keys.map(k => LOOK[k].hero)), [keys.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="patt" aria-hidden="true"><div style={{ backgroundImage: url, backgroundSize: `${W}px ${H}px` }}/></div>;
}

// Progress: the entry has four parts.
export function Segs({ at, ink = "#162f24", rest = "rgba(22,47,36,.10)" }) {
  return <div className="segs">{[1, 2, 3, 4].map(n => <i key={n} style={{ background: n <= at ? ink : rest }}/>)}</div>;
}

// Replays the small pop on a tile or chip as it's tapped.
export function pop(el) {
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}
