import { useState } from "react";
import { G, WHITE, MUT, TEXT, SANS, CREAM, CDARK, GOLD_TEXT, SUCCESS } from "../../design-tokens.js";
import { fmt } from "../../lib/format.js";
import { ratesFigures, impactFigures, childcareFigures } from "../../lib/chatTopics.js";

// The one visual in a Q&A chat answer: small, on the user's own figures
// where Candid has them (chatTopics.js says when it's an example instead).
// When fresh (build), its bars grow and its rows come in one after another
// (keyframes in ChatParts' SheenKeyframes); shown whole otherwise.

const card = {alignSelf:"flex-start",width:"92%",boxSizing:"border-box",background:WHITE,border:"1px solid rgba(22,47,36,0.1)",borderRadius:"18px",padding:"14px 15px",display:"flex",flexDirection:"column",gap:"10px",fontFamily:SANS};
const cardTitle = {fontSize:"12px",fontWeight:700,color:MUT,letterSpacing:"0.02em"};
const foot = {fontSize:"12px",color:MUT,lineHeight:1.4};
const pair = {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"};
const tileStyle = {background:CREAM,borderRadius:"12px",padding:"10px 12px",display:"flex",flexDirection:"column",gap:"2px"};
const num = {fontFamily:SANS,fontVariantNumeric:"tabular-nums lining-nums"};
// The class and stagger for the i-th piece to come in.
const step = (build, i, cls = "chat-in") => (build ? { className: cls, style: { "--i": i } } : { style: {} });

function Tile({ label, value, sub, build, i = 0 }) {
  const s = step(build, i);
  return (
    <div className={s.className} style={{...tileStyle,...s.style}}>
      <span style={{fontSize:"11.5px",color:MUT}}>{label}</span>
      <span style={{...num,fontSize:"22px",color:G,lineHeight:1.2}}>{value}</span>
      {sub && <span style={{fontSize:"11.5px",color:MUT}}>{sub}</span>}
    </div>
  );
}

const k = n => `£${Math.round(n / 1000)}k`;

function RatesBars({ d, m, build }) {
  const f = ratesFigures(d, m);
  const max = Math.max(...f.bars.map(b => b.pence));
  return (
    <div style={card}>
      <div style={cardTitle}>Tax and NI on each extra £1</div>
      <div role="img" aria-label={f.bars.map(b => `${b.pence}p at ${k(b.income)}`).join(", ")}
        style={{display:"grid",gridTemplateColumns:"56px 1fr 38px",gap:"7px 10px",alignItems:"center",fontSize:"12.5px"}}>
        {f.bars.map((b, i) => {
          const on = i === f.band;
          const row = step(build, i), bar = step(build, i, "chat-grow");
          return [
            <span key={`l${i}`} className={row.className} style={{...row.style,color:on ? G : MUT,fontWeight:on ? 700 : 400}}>at {k(b.income)}</span>,
            <span key={`b${i}`} className={bar.className} style={{...bar.style,height:"12px",borderRadius:"6px",background:on ? G : CDARK,width:`${b.pence / max * 100}%`}}/>,
            <span key={`v${i}`} className={row.className} style={{...row.style,...num,fontSize:"15px",textAlign:"right",color:on ? G : MUT,fontWeight:on ? 700 : 400}}>{b.pence}p</span>,
          ];
        })}
      </div>
      <div {...step(build, 4)} style={{...foot,...step(build, 4).style}}>
        {f.example ? "Example. Add your salary for your own band."
          : f.band >= 0 ? `Highlighted: your band, at ${fmt(f.ani)} adjusted net income.`
          : `At your ${fmt(f.ani)} adjusted net income: ${f.own}p.`}
      </div>
    </div>
  );
}

function ImpactTile({ d, m, build }) {
  const [monthly, setMonthly] = useState(350);
  const f = impactFigures(d, m, monthly);
  return (
    <div style={card}>
      <label htmlFor="chat-impact" style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:"12.5px",color:MUT}}>
        <span>{f.route === "relief" ? "Into pension, from take-home" : "Into pension by salary sacrifice"}</span>
        <span style={{...num,fontSize:"16px",color:G}}>{fmt(monthly)}/mo</span>
      </label>
      <input id="chat-impact" type="range" min="0" max="1000" step="25" value={monthly}
        onChange={e => setMonthly(+e.target.value)} style={{width:"100%",accentColor:G,margin:0}}/>
      <div style={pair}>
        <Tile label="Into pension" value={`+${fmt(monthly)}`} sub="a month" build={build} i={0}/>
        <Tile label="Take-home pay" value={`−${fmt(f.takeHomeMonthly)}`} sub="a month" build={build} i={1}/>
      </div>
      <div {...step(build, 2)} style={{...foot,...step(build, 2).style}}>
        {f.example ? "Example salary £110,000." : `On your salary of ${fmt(f.salary)}.`}
        {f.allowanceBack > 0 && ` Allowance back: ${fmt(f.allowanceBack)} a year.`}
      </div>
    </div>
  );
}

// In no particular order: unnumbered, so it reads as a list, not steps.
function LowersList({ build }) {
  const items = [
    ["Pension by salary sacrifice", "Taken off pay before it counts"],
    ["Personal pension contributions", "The gross amount comes off"],
    ["Gift Aid donations", "The grossed-up amount comes off"],
  ];
  return (
    <div style={card}>
      <ul style={{margin:0,padding:0,listStyle:"none"}}>
        {items.map(([t, s], i) => (
          <li key={t} {...step(build, i)} style={{...step(build, i).style,display:"flex",gap:"10px",padding:i ? "8px 0" : "0 0 8px",borderTop:i ? `1px solid ${CDARK}` : "none",fontSize:"13.5px",lineHeight:1.4,color:TEXT}}>
            <span aria-hidden="true" style={{width:"6px",height:"6px",borderRadius:"50%",background:GOLD_TEXT,flex:"none",marginTop:"7px"}}/>
            <span>{t}<span style={{display:"block",color:MUT,fontSize:"12px"}}>{s}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VersusCard({ build }) {
  const cols = [
    ["Salary sacrifice", ["Before tax and NI", "Set up through payroll", "Needs an employer scheme"]],
    ["Personal", ["From take-home pay", "20% added by provider", "Rest claimed on a tax return"]],
  ];
  return (
    <div style={card}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px",fontSize:"13px"}}>
        {cols.map(([head, rows]) => (
          <div key={head}>
            <div style={{fontSize:"12.5px",fontWeight:700,color:G,marginBottom:"4px"}}>{head}</div>
            {rows.map((r, i) => <p key={r} {...step(build, i)} style={{...step(build, i).style,margin:0,padding:"6px 0",borderTop:`1px solid ${CDARK}`,lineHeight:1.35,color:TEXT}}>{r}</p>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChildcareTile({ d, m, build }) {
  const f = childcareFigures(d, m);
  const tone = f.over ? { bg:"#f6e6da", fg:"#9a4d1c" } : { bg:"#e3efe6", fg:SUCCESS };
  const who = f.example ? "Example £110,000" : "Your income";
  return (
    <div style={card}>
      <span style={{alignSelf:"flex-start",display:"inline-flex",alignItems:"center",gap:"6px",fontSize:"12.5px",fontWeight:700,padding:"5px 10px",borderRadius:"100px",background:tone.bg,color:tone.fg}}>
        <span aria-hidden="true" style={{width:"7px",height:"7px",borderRadius:"50%",background:"currentColor"}}/>
        {who}: {fmt(f.gap)} {f.over ? "over" : "under"}
      </span>
      <div style={pair}>
        <Tile label="Tax-Free Childcare" value={fmt(f.tfcCap)} sub="per child, per year" build={build} i={1}/>
        {!f.example && f.atStake > 0
          ? <Tile label="Yours in all" value={fmt(f.atStake)} sub="a year, at stake" build={build} i={2}/>
          : f.hoursRule && <Tile label="Funded hours (England)" value="30" sub="a week, term time" build={build} i={2}/>}
      </div>
      {f.partner && <div style={foot}>Your partner's income is tested too.</div>}
    </div>
  );
}

const VISUALS = { rates: RatesBars, impact: ImpactTile, lowers: LowersList, versus: VersusCard, childcare: ChildcareTile };

export default function ChatVisual({ id, d, m, build }) {
  const V = VISUALS[id];
  return V ? <V d={d} m={m} build={build}/> : null;
}
