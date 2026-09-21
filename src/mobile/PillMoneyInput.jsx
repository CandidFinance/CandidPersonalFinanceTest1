import { useState, useRef, useEffect } from "react";
import { formatThousands } from "../lib/format.js";
import { MUT, TEXT } from "../CandidApp.jsx";

// Shared pill-styled £/% input — starts blank (0/null just placeholders "0",
// never a hardcoded displayed value). £ (default) comma-formats as you type
// and shows the symbol before the number; % skips thousands-formatting (these
// are always small numbers) and shows the symbol after. Used by Forecast's
// "Lump sum today"/"Monthly surplus" pills, Pension's bonus-amount pill, and
// the mobile onboarding wizard's % fields (contribution rate, employer
// match), so every mobile £/% input looks and behaves identically.
export default function PillMoneyInput({ label, value, onChange, unit = "£", placeholder = "0" }) {
  // Thousands-formatting only makes sense for money; % and plain-number
  // fields (e.g. onboarding's Age) are always small values typed digit by
  // digit, so they skip it and allow a decimal point instead.
  const useThousands = unit === "£";
  const showPrefix = unit === "£";
  const showSuffix = unit === "%";
  const displayValue = v => (v ? (useThousands ? formatThousands(v) : String(v)) : "");
  const [display, setDisplay] = useState(displayValue(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDisplay(displayValue(value));
  }, [value, useThousands]);
  return (
    // A <label> wrapping the input, not a div: tapping anywhere in the pill
    // (its padding, the caption, the £/% symbol) focuses the input. Without
    // this the % variant's auto-width input made the tap target only as wide
    // as the digits typed.
    <label style={{flex:1,background:"#ede7db",borderRadius:"100px",padding:"9px 16px",display:"flex",flexDirection:"column",cursor:"text"}}>
      <span style={{fontSize:"9.5px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</span>
      <div style={{display:"flex",alignItems:"center"}}>
        {showPrefix && <span style={{fontSize:"14px",color:TEXT,fontWeight:600}}>£</span>}
        <input
          type="text" inputMode={useThousands ? "numeric" : "decimal"} placeholder={placeholder}
          value={display}
          onFocus={() => { focused.current = true; }}
          onBlur={() => { focused.current = false; setDisplay(displayValue(value)); }}
          onChange={e => {
            const raw = useThousands ? e.target.value.replace(/[^0-9]/g, "") : e.target.value.replace(/[^0-9.]/g, "");
            setDisplay(useThousands ? (raw === "" ? "" : formatThousands(raw)) : raw);
            onChange(raw === "" ? null : +raw);
          }}
          style={showSuffix
            ? {border:"none",background:"none",fontSize:"14px",fontWeight:600,color:TEXT,width:"auto",minWidth:"1ch",maxWidth:"4em",flex:"0 1 auto",outline:"none",padding:0}
            : {border:"none",background:"none",fontSize:"14px",fontWeight:600,color:TEXT,width:"100%",outline:"none",padding:0}}
          size={showSuffix ? Math.max(1, (display || placeholder || "0").length) : undefined}/>
        {showSuffix && <span style={{fontSize:"14px",color:TEXT,fontWeight:600}}>%</span>}
      </div>
    </label>
  );
}
