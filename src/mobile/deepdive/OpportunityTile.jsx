import AlertBox from "../AlertBox.jsx";
import { DARK } from "../CardStack.jsx";
import { SERIF, OPPORTUNITY_TILE_BG, OPPORTUNITY_TILE_BORDER, OPPORTUNITY_TILE_SHADOW, OPPORTUNITY_TILE_LABEL, OPPORTUNITY_TILE_FIGURE, OPPORTUNITY_TILE_BODY, OPPORTUNITY_TILE_RADIUS, OPPORTUNITY_TILE_SHEEN } from "../../design-tokens.js";

// Each module page's Opportunity tile: the page's key figure, large, on the
// one dark surface on the page. `figures` is [{ value, suffix?, label? }]:
// one figure is 58px (84px on desktop, where it sits beside its label and
// chips); two or more share a wrapping row at a smaller size. `chips` are
// short facts under the label; `note` is a sentence kept for a caveat.
// `children` go at the bottom (Student loan's locked panel). `tour`: the
// data-tour hook a guided tour lights up. `stacked`: keep one figure above
// its chips on desktop too, for a wide figure with no label (Tax trap).
// `alert`: { tone: "red" | "amber", title }, the figure and its chips in a
// red or amber alert under the overline, as Progress's Tax shield has it
// (AlertBox.jsx); one figure only.
// The desktop breakpoint is MobileLayout's (1000px, its 720px column).
const CSS = `
.opp-tile { position: relative; overflow: hidden; padding: 20px; }
.opp-tile > * { position: relative; z-index: 1; }
.opp-tile::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 260%; z-index: 0; pointer-events: none;
  background: linear-gradient(112deg, transparent 32%, rgba(255,255,255,${OPPORTUNITY_TILE_SHEEN}) 46%, transparent 60%);
  will-change: transform; animation: opp-sheen 7s ease-in-out infinite; }
@keyframes opp-sheen { 0% { transform: translateX(-75%); } 55%, 100% { transform: translateX(25%); } }
@media (prefers-reduced-motion: reduce) { .opp-tile::after { animation: none; transform: translateX(-30%); } }
/* Shrinks with the screen below 375px, so a six-figure sum never clips. */
.opp-tile { --opp-figure: min(58px, 15.5vw); }
.opp-tile.opp-multi { --opp-figure: min(44px, 11.5vw); }
.opp-label { font-size: 15px; }
@media (min-width: 1000px) {
  .opp-tile { padding: 28px 32px; --opp-figure: 84px; }
  .opp-tile.opp-multi { --opp-figure: 64px; }
  .opp-label { font-size: 17px; }
  .opp-split { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 32px; align-items: center; }
  .opp-split .opp-side { border-left: 1px solid rgba(216,208,187,0.3); padding-left: 30px; }
  .opp-split .opp-side > :first-child { margin-top: 0 !important; }
}
`;

const over = { fontSize:"11px", fontWeight:800, color:OPPORTUNITY_TILE_LABEL, letterSpacing:"0.1em", textTransform:"uppercase" };
const figure = { fontFamily:SERIF, fontSize:"var(--opp-figure)", fontWeight:700, color:OPPORTUNITY_TILE_FIGURE, lineHeight:1, letterSpacing:"-0.01em", marginTop:"8px" };
const label = { fontWeight:600, color:OPPORTUNITY_TILE_LABEL, lineHeight:1.35, marginTop:"10px" };
const chip = { display:"inline-flex", fontSize:"12.5px", fontWeight:600, color:OPPORTUNITY_TILE_BODY, border:"1px solid rgba(180,189,178,0.45)", borderRadius:"999px", padding:"5px 11px", lineHeight:1.3 };

const Figure = ({ f }) => (
  <div style={figure}>{f.value}{f.suffix && <span style={{fontSize:"0.4em",fontWeight:600}}>{f.suffix}</span>}</div>
);

export default function OpportunityTile({ over: overline = "Opportunity", figures, chips = [], note, tour, stacked = false, alert, style, children }) {
  const shown = chips.filter(Boolean);
  const multi = figures.length > 1;
  const extras = (
    <>
      {shown.length > 0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginTop:"12px"}}>{shown.map((c, i) => <span key={i} style={chip}>{c}</span>)}</div>
      )}
      {note && <div style={{fontSize:"13px",color:OPPORTUNITY_TILE_BODY,lineHeight:1.5,marginTop:"10px"}}>{note}</div>}
    </>
  );
  return (
    <div data-tour={tour} className={`opp-tile${multi ? " opp-multi" : ""}`}
      style={{background:OPPORTUNITY_TILE_BG,border:OPPORTUNITY_TILE_BORDER,boxShadow:OPPORTUNITY_TILE_SHADOW,borderRadius:OPPORTUNITY_TILE_RADIUS,marginBottom:"16px",...style}}>
      <style>{CSS}</style>
      {alert ? (
        <>
          <div style={over}>{overline}</div>
          <AlertBox tone={alert.tone} t={DARK} title={alert.title}><Figure f={figures[0]}/>{extras}</AlertBox>
        </>
      ) : multi ? (
        <>
          <div style={over}>{overline}</div>
          <div style={{display:"flex",gap:"8px 28px",flexWrap:"wrap"}}>
            {figures.map((f, i) => (
              <div key={i} style={{minWidth:0}}>
                <Figure f={f}/>
                {f.label && <div className="opp-label" style={label}>{f.label}</div>}
              </div>
            ))}
          </div>
          {extras}
        </>
      ) : (
        <div className={stacked ? undefined : "opp-split"}>
          <div><div style={over}>{overline}</div><Figure f={figures[0]}/></div>
          <div className="opp-side" style={{minWidth:0}}>
            {figures[0].label && <div className="opp-label" style={label}>{figures[0].label}</div>}
            {extras}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
