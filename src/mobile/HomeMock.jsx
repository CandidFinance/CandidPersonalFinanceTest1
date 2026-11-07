import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Landmark, ChevronRight } from "lucide-react";
import { TilePopover, anchor } from "./MobileTile.jsx";
import { G, GOLD, TEXT, MUT, SANS, CARD, HAIRLINE, SUCCESS, CRITICAL } from "../design-tokens.js";

// MOCK ONLY (7 Nov 2026): Activity on Home, with sample figures, for Harvey
// to look at on his phone. Shown with ?mock on /app/home in dev. Nothing here
// reads the user's data.

// The neutral tile header (as MobileTile's).
const TILE_HEAD = { margin:0, fontFamily:SANS, fontSize:"17px", fontWeight:700, color:G, lineHeight:1.3 };
const TILE = { ...CARD, paddingLeft:"16px" };


// Activity, after Monzo's: the area's illustration with the provider's logo
// small in its corner, a short name, where the money came from under it, and
// the £ large at the right in the sans. Colour only for a change to the user's
// £ a year: + green for a gain, − red for a loss. Money that's only moved
// (paid in, repaid, overpaid) stays plain with no sign. No date on the row; a
// tap opens the details (what it does to the figures, the date, the source).
// `bank`: needs a connected account (TrueLayer, premium); the rest come from
// what Candid already knows.
const ACTIVITY = [
  { art: "investments", logo: "vanguardinvestor.co.uk", name: "Paid into ISA", sub: "From Monzo", pounds: "500",
    detail: "£500 paid into your Vanguard ISA. £5,800 of this year's £20,000 allowance left.", date: "6 Nov", bank: "Monzo" },
  { art: "cash", logo: "chase.co.uk", name: "Savings rate down", sub: "Chase Saver, now 3.80%", pounds: "48", sign: "−", unit: "/yr", tone: "loss",
    detail: "Rate down from 4.10% to 3.80%. On your £16,000, that's about £48 a year less.", date: "5 Nov" },
  { art: "pension", name: "Pension raised", sub: "Now 8% of pay", pounds: "1,240", sign: "+", unit: "/yr", tone: "gain",
    detail: "You recorded a pension contribution of 8%, up from 5%. With tax relief, £1,240 a year more into your pension.", date: "3 Nov" },
  { art: "student-loan", name: "Student loan repaid", sub: "From your pay", pounds: "186",
    detail: "£186 repaid through your payslip. £14,900 left. On your current pay, repaid by March 2031.", date: "28 Oct" },
  { art: "mortgages", name: "Mortgage overpaid", sub: "From Monzo", pounds: "200",
    detail: "£200 overpaid. On current figures, your mortgage ends 4 months sooner.", date: "28 Oct", bank: "Monzo" },
  { art: "cash", logo: "chase.co.uk", name: "Moved to savings", sub: "From Monzo", pounds: "1,000",
    detail: "£1,000 moved from Monzo to Chase Saver, earning 3.80% instead of 0%.", date: "15 Oct", bank: "Monzo" },
];
const TONE = { gain: SUCCESS, loss: CRITICAL };

function ActivityIcon({ art, logo }) {
  return (
    <span aria-hidden="true" style={{position:"relative",width:"46px",height:"46px",flexShrink:0}}>
      <span style={{display:"flex",alignItems:"flex-end",justifyContent:"center",width:"46px",height:"46px",borderRadius:"12px",background:"rgba(22,47,36,0.05)",overflow:"hidden"}}>
        <img src={`/tile-illustrations/${art}.svg`} alt="" width="46" height="37" draggable="false" style={{display:"block",width:"46px",height:"auto"}}/>
      </span>
      {logo && (
        <img src={`/logos/${logo}.png`} alt="" width="22" height="22"
          style={{position:"absolute",right:"-5px",bottom:"-5px",width:"22px",height:"22px",borderRadius:"6px",background:"#fff",objectFit:"contain",border:"2px solid #fff",boxShadow:"0 0 0 1px rgba(22,47,36,0.1)",boxSizing:"border-box"}}/>
      )}
    </span>
  );
}

export function HomeActivity() {
  const [open, setOpen] = useState(null);
  return (
    <section aria-label="Activity" style={TILE}>
      <div style={{padding:"16px 6px 8px 0"}}><h2 style={TILE_HEAD}>Activity</h2></div>
      {ACTIVITY.map((a, i) => (
        <div key={i} style={anchor}>
          <button type="button" onClick={() => setOpen(i)} aria-haspopup="dialog" aria-expanded={open === i}
            style={{display:"flex",alignItems:"center",gap:"14px",width:"100%",background:"none",border:"none",borderTop:i ? HAIRLINE : "none",padding:"12px 16px 12px 0",textAlign:"left",font:"inherit",color:"inherit",cursor:"pointer"}}>
            <ActivityIcon art={a.art} logo={a.logo}/>
            <span style={{flex:1,minWidth:0}}>
              <span style={{display:"block",fontSize:"15.5px",fontWeight:600,color:TEXT,lineHeight:1.3}}>{a.name}</span>
              <span style={{display:"block",fontSize:"13px",color:MUT,lineHeight:1.35,marginTop:"2px"}}>{a.sub}</span>
            </span>
            {/* The £ sits on the row's centre line with its right edge in line
                with every other row's; "a year" hangs under it, out of the
                flow, so it moves neither. */}
            <span style={{position:"relative",fontFamily:SANS,fontWeight:600,color:TONE[a.tone] || TEXT,whiteSpace:"nowrap",lineHeight:1,letterSpacing:"-0.01em"}}>
              <span style={{fontSize:"17px"}}>{a.sign}£</span>
              <span style={{fontSize:"25px"}}>{a.pounds}</span>
              {a.unit && <span style={{position:"absolute",top:"100%",right:0,marginTop:"3px",fontSize:"11.5px",fontWeight:600,color:MUT,letterSpacing:0}}>a year</span>}
            </span>
          </button>
          <AnimatePresence>
            {open === i && (
              <TilePopover title={a.name} onClose={() => setOpen(null)}>
                <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.5,margin:0}}>{a.detail}</p>
                <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"12px",color:MUT,marginTop:"10px"}}>
                  {a.date}
                  {a.bank && <><span aria-hidden="true">·</span><Landmark size={12} aria-hidden="true"/>Seen in your {a.bank} account</>}
                </div>
              </TilePopover>
            )}
          </AnimatePresence>
        </div>
      ))}
      <button type="button" style={{background:"none",border:"none",borderTop:HAIRLINE,width:"100%",textAlign:"left",padding:"14px 0",fontSize:"14px",fontWeight:700,color:G,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"2px"}}>
        See all<ChevronRight size={15} aria-hidden="true"/>
      </button>
    </section>
  );
}

// Where the bank entries come from, under the tile.
export function HomeActivityBankLine() {
  return (
    <div style={{display:"flex",alignItems:"center",gap:"10px",fontSize:"12.5px",color:MUT,lineHeight:1.45,padding:"0 4px"}}>
      <Landmark size={14} color={GOLD} aria-hidden="true" style={{flexShrink:0}}/>
      Entries from a bank need a connected account (Candid Premium, once bank linking is live).
    </div>
  );
}
