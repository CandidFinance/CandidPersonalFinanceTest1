import { useState, useRef, useEffect } from "react";
import { formatThousands } from "../lib/format.js";
import { MUT, TEXT } from "../CandidApp.jsx";

// Shared pill-styled £ input — starts blank (0/null just placeholders "0",
// never a hardcoded displayed value) and comma-formats as you type. Used by
// Forecast's "Lump sum today"/"Monthly surplus" pills and Pension's bonus-
// amount pill, so every mobile £ input looks and behaves identically.
export default function PillMoneyInput({ label, value, onChange }) {
  const [display, setDisplay] = useState(value ? formatThousands(value) : "");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDisplay(value ? formatThousands(value) : "");
  }, [value]);
  return (
    <div style={{flex:1,background:"#ede7db",borderRadius:"100px",padding:"9px 16px",display:"flex",flexDirection:"column"}}>
      <span style={{fontSize:"9.5px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</span>
      <div style={{display:"flex",alignItems:"center"}}>
        <span style={{fontSize:"14px",color:TEXT,fontWeight:600}}>£</span>
        <input
          type="text" inputMode="numeric" placeholder="0"
          value={display}
          onFocus={() => { focused.current = true; }}
          onBlur={() => { focused.current = false; setDisplay(value ? formatThousands(value) : ""); }}
          onChange={e => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            setDisplay(raw === "" ? "" : formatThousands(raw));
            onChange(raw === "" ? null : +raw);
          }}
          style={{border:"none",background:"none",fontSize:"14px",fontWeight:600,color:TEXT,width:"100%",outline:"none",padding:0}}/>
      </div>
    </div>
  );
}
