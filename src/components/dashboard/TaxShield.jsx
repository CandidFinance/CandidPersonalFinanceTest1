import { ChevronRight } from "lucide-react";
import { TRAP_EDGE } from "../../lib/progressTracker.js";
import { fmt } from "../../lib/format.js";
import { useElementWidth } from "../../mobile/useElementWidth.js";
import { DARK, LIGHT, WARN } from "../../mobile/CardStack.jsx";
import Alert from "../../mobile/AlertBox.jsx";
import { GOLD, WHITE, TEXT, SERIF, SANS } from "../../design-tokens.js";

// Where income sits against the £100k trap (progressTracker.js
// incomePosition): Progress's Tax shield view, and Home's £100k tax trap tile
// (TrapTile.jsx), each in the colours `t` it's drawn on.

// The zones' colours: the wallet stack's light card colours (CardStack.jsx),
// or its red or amber warning ones, each with the small text a step darker,
// so it stays over 4.5:1 on the deepest corner, a firmer track, and `dot` for
// Progress's caption dots.
export const TRAP_T = {
  light: { ...LIGHT, label: "#585858", body: "#585858", track: "rgba(22,47,36,0.12)", dot: "rgba(22,47,36,0.25)" },
  red: { ...WARN.red, body: "#7a4a43", track: "rgba(142,42,31,0.14)", dot: "rgba(142,42,31,0.28)" },
  amber: { ...WARN.amber, body: "#75583f", track: "rgba(134,74,15,0.14)", dot: "rgba(134,74,15,0.28)" },
};

// A view's lead figure, in the serif at the band's size, with its unit.
export const heroFig = t => ({ fontFamily:SERIF, fontSize:"var(--hero-fig)", fontWeight:700, color:t.figure, lineHeight:1, letterSpacing:"-0.01em", marginTop:"8px" });
export const unit = { fontFamily:SANS, fontSize:"0.32em", fontWeight:600, marginLeft:"5px", letterSpacing:0, whiteSpace:"nowrap" };
const cardText = t => ({ fontSize:"13px", color:t.body, lineHeight:1.45, margin:"8px 0 0" });

// The Tax shield's band, and its dot from the other views, warn: red in
// the trap, amber within £5,000 of it (progressTracker.js incomePosition's
// zone).
export const WARN_ZONE = { in: "red", edge: "amber" };

// On the band: the one figure that says where income sits against the
// trap (in it, the extra tax it costs a year; otherwise how far below
// £100,000), then the bands with a marker at their income.
export function ShieldBand({ income, t }) {
  if (income.zone === "none") {
    return <div data-band-keep="figure" style={{...heroFig(t),color:t.body,opacity:0.5}}>£–</div>;
  }
  const { figure, label } = shieldFigure(income);
  return (
    <>
      <div data-band-keep="figure" style={heroFig(t)}>{figure}<span style={unit}>{label}</span></div>
      <BandTrack income={income} t={t}/>
    </>
  );
}

// The Tax shield's one figure and what it is, the same on Progress and Home:
// in the trap, the extra tax it costs a year; otherwise how far below £100k.
export function shieldFigure(income) {
  const { trap, gap } = income;
  if (income.zone === "in") return trap ? { figure: fmt(trap.tax), label: "more tax a year" } : { figure: fmt(income.income - 100000), label: "over £100k" };
  if (gap === 0) return { figure: "£100,000", label: "the trap's edge" };
  return { figure: fmt(gap), label: income.zone === "clear" ? "below £100k" : "to £100k" };
}

// On the cream below: what the band's figure means, as figures rather than
// an instruction; in the trap or within £5,000 of it, in a red or amber
// alert. Then adjusted net income, explained, as the small print, what a
// pension contribution would do, and the way into the trap's module.
export function ShieldDetails({ income, t, onOpenTrap }) {
  if (income.zone === "none") {
    return <p style={{...cardText(t),margin:0}}>Where your income sits against the £100k trap shows here once your pay is entered.</p>;
  }
  const { trap, gap, perThousand, rise } = income;
  const trapRate = income.bands.find(b => b.name === "£100k tax trap").rateLabel;
  const past = `Past £100,000, each £1,000 more costs ${fmt(perThousand.trap)} in income tax rather than ${fmt(perThousand.now)}, as the Personal Allowance is withdrawn.`;
  const more = rise?.tax > 0 ? ` ${fmt(rise.by)} more would mean ${fmt(rise.tax)} of extra tax a year from the trap.` : "";
  const pension = trap?.takeHome == null ? null : trap.route === "sacrifice"
    ? `Salary sacrifice of ${fmt(trap.needed)} into your pension would bring it back to £100,000, for ${fmt(trap.takeHome)} less take-home pay.`
    : `Paying ${fmt(trap.needed)} more into your pension would bring it back to £100,000, for ${fmt(trap.takeHome)} less take-home pay after tax relief.`;
  return (
    <>
      {income.zone === "in" ? !trap ? (
        <p style={{...cardText(t),margin:0}}>{fmt(income.income - 100000)} over £100,000, where the Personal Allowance is withdrawn.</p>
      ) : (
        <Alert tone="red" t={t} title={trap.aboveTaper ? "Your Personal Allowance is gone" : `You're in the ${trap.rateLabel} tax trap`}>
          <p style={cardText(t)}>
            {trap.aboveTaper
              ? `${fmt(trap.tax)} more tax a year, as over £125,140 all ${fmt(trap.allowanceLost)} of your Personal Allowance is withdrawn.`
              : `${fmt(trap.tax)} more tax a year, as ${fmt(trap.over)} over £100,000 withdraws ${fmt(trap.allowanceLost)} of your Personal Allowance.`}
            {trap.childcareLost > 0 && ` ${fmt(trap.childcareLost)} a year of childcare support stops too.`}
          </p>
        </Alert>
      ) : income.zone === "edge" ? (
        <Alert tone="amber" t={t} title={gap > 0 ? `Within ${fmt(TRAP_EDGE)} of the ${trapRate} tax trap` : `At £100,000, the edge of the ${trapRate} tax trap`}>
          <p style={cardText(t)}>{past}{more}</p>
        </Alert>
      ) : (
        <p style={{...cardText(t),margin:0}}>
          {income.zone === "near" ? `${past}${more}`
            : `Clear of £100,000, where each £1,000 more starts costing ${fmt(perThousand.trap)} in income tax rather than ${fmt(perThousand.now)}.`}
        </p>
      )}
      <p style={{fontSize:"12px",color:t.body,lineHeight:1.45,margin:"12px 0 0"}}>
        <span style={{fontWeight:700,color:t.figure}}>{fmt(income.income)}</span> adjusted net income this tax year, the gold marker above, which the trap is measured on: taxable income less pension contributions and Gift Aid.{income.scottish ? " Scottish rates on pay." : ""}
      </p>
      {pension && (
        <p style={{...cardText(t),fontSize:"12px"}}>
          {pension}{!trap.fits && ` That's more than the ${fmt(trap.aaRoom)} of Annual Allowance left this year.`}
        </p>
      )}
      {trap && (
        <button type="button" onClick={onOpenTrap}
          style={{marginTop:"10px",background:"none",border:"none",padding:0,fontSize:"13px",fontWeight:700,color:t.figure,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:"2px"}}>
          Open £100k tax trap<ChevronRight size={14}/>
        </button>
      )}
    </>
  );
}

const SCALE_TO = 150000;
// Which threshold labels to keep when they'd overlap: the trap's first.
const TICK_PRIORITY = { "£100k tax trap": 0, "Additional rate": 1, "Top rate": 1, "Higher rate": 2, "Advanced rate": 3 };

// The bands as one bar, shaded deeper the higher the income tax rate on the
// next £1 (one hue, so the trap reads as the deepest band), the rate inside
// each band where it fits, a gold marker at their income, and threshold
// labels under it, left out where they'd collide.
export function BandTrack({ income, t }) {
  const [ref, width] = useElementWidth(300);
  const dark = t === DARK;
  const ink = dark ? "246,234,208" : "22,47,36";
  const x = v => Math.min(1, v / SCALE_TO) * width;
  const bands = income.bands.filter(b => b.from < SCALE_TO);
  const marker = Math.min(Math.max(x(income.income) - 2, 0), width - 4);
  // A band's rate sits in its middle, or beside the marker when the marker
  // would cover it, on whichever side has room; with room on neither, it's
  // left out (the band's name and rate are written under the bar anyway).
  const rateAt = (left, w, label) => {
    const lw = label.length * 6.5 + 10, mid = marker + 2;
    if (w < lw) return null;
    if (Math.abs(mid - (left + w / 2)) >= lw / 2 + 4) return left + w / 2 - lw / 2;
    const before = mid - 4 - left, after = left + w - (mid + 4);
    if (Math.max(before, after) < lw) return null;
    return after >= before ? mid + 4 + (after - lw) / 2 : left + (before - lw) / 2;
  };
  const ticks = [];
  for (const b of bands.slice(1).sort((p, q) => (TICK_PRIORITY[p.name] ?? 4) - (TICK_PRIORITY[q.name] ?? 4))) {
    // About 5.5px a character at 10.5px ("£100,000" is 44px), a little over.
    const text = fmt(b.from), w = text.length * 5.6 + 2;
    const left = Math.min(Math.max(x(b.from) - w / 2, 0), width - w);
    if (!ticks.some(tk => left < tk.left + tk.w + 4 && tk.left < left + w + 4)) ticks.push({ text, w, left });
  }
  return (
    <div aria-hidden="true">
      <div ref={ref} style={{position:"relative",height:"22px",marginTop:"16px"}}>
        {bands.map((b, i) => {
          const left = x(b.from) + (i ? 1 : 0);
          const w = Math.max(0, x(Math.min(b.to, SCALE_TO)) - (i < bands.length - 1 ? 1 : 0) - left);
          const alpha = 0.12 + b.rate * 1.2;
          const labelAt = rateAt(left, w, b.rateLabel);
          return (
            <div key={b.from}>
              <div style={{position:"absolute",top:0,bottom:0,left:`${left}px`,width:`${w}px`,background:`rgba(${ink},${alpha})`,
                borderRadius:i === 0 ? "6px 0 0 6px" : i === bands.length - 1 ? "0 6px 6px 0" : 0}}/>
              {labelAt != null && (
                <span style={{position:"absolute",top:0,bottom:0,left:`${labelAt}px`,width:`${b.rateLabel.length * 6.5 + 10}px`,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:"10.5px",fontWeight:700,color:alpha >= 0.5 ? (dark ? "#0e2219" : WHITE) : (dark ? t.figure : TEXT),whiteSpace:"nowrap"}}>{b.rateLabel}</span>
              )}
            </div>
          );
        })}
        <div style={{position:"absolute",top:"-5px",bottom:"-5px",left:`${marker}px`,width:"4px",borderRadius:"2px",background:GOLD,boxShadow:`0 0 0 2px ${dark ? "#0e2219" : WHITE}`}}/>
      </div>
      <div style={{position:"relative",height:"14px",marginTop:"6px"}}>
        {ticks.map(tk => (
          <span key={tk.text} style={{position:"absolute",left:`${tk.left}px`,width:`${tk.w}px`,textAlign:"center",fontSize:"10.5px",color:t.body,whiteSpace:"nowrap"}}>{tk.text}</span>
        ))}
      </div>
    </div>
  );
}
