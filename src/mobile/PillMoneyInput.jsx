import { useState, useRef, useEffect } from "react";
import { formatThousands } from "../lib/format.js";
import { MUT, TEXT, CDARK, PILL_HEIGHT, FONT_SIZE } from "../CandidApp.jsx";

// ── Answer text inside a pill: the same as PillSlider's options (body size,
// 600 weight, the app's sans font), so a typed £ figure and a Yes/No choice
// read identically. Native inputs and selects can't simply be set that small:
// iOS Safari zooms the page on focusing any field under 16px. So the field
// keeps a 16px font and is scaled down to body size on screen, with its
// width enlarged and the spare width given back through a negative margin,
// so it still fills exactly the same space in the layout.
export const PILL_ANSWER_TEXT = { fontSize:FONT_SIZE.BODY, fontWeight:600, fontFamily:"inherit", color:TEXT };
const FIELD_FONT_PX = 16;
const FIELD_SCALE = parseFloat(FONT_SIZE.BODY) / FIELD_FONT_PX;
// `width` is how wide the field should look once scaled (e.g. "100%" of the pill).
export function pillFieldStyle(width) {
  const layoutWidth = `(${width}) / ${FIELD_SCALE}`;
  return {
    fontSize:`${FIELD_FONT_PX}px`, fontWeight:600, fontFamily:"inherit",
    width:`calc(${layoutWidth})`,
    marginRight:`calc(${layoutWidth} * ${FIELD_SCALE - 1})`,
    transform:`scale(${FIELD_SCALE})`, transformOrigin:"left center",
  };
}

// Shared pill-styled £/% input — starts blank (0/null just placeholders "0",
// never a hardcoded displayed value). £ (default) comma-formats as you type
// and shows the symbol before the number; % skips thousands-formatting (these
// are always small numbers) and shows the symbol after. Used by Forecast's
// "Lump sum today"/"Monthly surplus" pills, Pension's bonus-amount pill, and
// the mobile onboarding wizard's % fields (contribution rate, employer
// match), so every mobile £/% input looks and behaves identically.

// `allowNegative` (% fields only) accepts a leading minus and adds a "±"
// button at the pill's right end, since iOS's decimal keypad has no minus
// key. The button sits after the input so the <label> still focuses the
// input, not the button, when the pill is tapped.
export default function PillMoneyInput({ label, value, onChange, unit = "£", placeholder = "0", allowNegative = false }) {
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
    <label style={{flex:1,minWidth:0,background:CDARK,borderRadius:"100px",padding:"0 16px",height:PILL_HEIGHT,boxSizing:"border-box",display:"flex",flexDirection:"column",justifyContent:"center",cursor:"text"}}>
      <span style={{fontSize:"9.5px",fontWeight:600,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</span>
      <div style={{display:"flex",alignItems:"center"}}>
        {/* The input itself is 16px scaled down (see pillFieldStyle): iOS
            Safari zooms the page in on focusing any input under 16px. */}
        {showPrefix && <span style={PILL_ANSWER_TEXT}>£</span>}
        {/* % variant: an invisible copy of the text, in the on-screen answer
            text, sets the width so the % sits right after the digits whatever
            the characters; the input is laid over it. */}
        <span style={showSuffix ? {position:"relative",flex:"0 0 auto",display:"inline-block",maxWidth:"60%"} : {display:"contents"}}>
        {showSuffix && <span aria-hidden="true" style={{...PILL_ANSWER_TEXT,visibility:"hidden",whiteSpace:"pre",paddingRight:"1px"}}>{display || placeholder || "0"}</span>}
        <input
          type="text" inputMode={useThousands ? "numeric" : "decimal"} placeholder={placeholder}
          value={display}
          onFocus={() => { focused.current = true; }}
          onBlur={() => { focused.current = false; setDisplay(displayValue(value)); }}
          onChange={e => {
            let raw = useThousands ? e.target.value.replace(/[^0-9]/g, "") : e.target.value.replace(/[^0-9.-]/g, "");
            if (!useThousands) raw = (allowNegative && raw.startsWith("-") ? "-" : "") + raw.replace(/-/g, "");
            setDisplay(useThousands ? (raw === "" ? "" : formatThousands(raw)) : raw);
            onChange(raw === "" || isNaN(+raw) ? null : +raw);
          }}
          style={showSuffix
            ? {border:"none",background:"none",color:TEXT,outline:"none",padding:0,margin:0,...pillFieldStyle("100%"),position:"absolute",left:0,top:"50%",transform:`translateY(-50%) scale(${FIELD_SCALE})`}
            : {border:"none",background:"none",color:TEXT,flex:"0 0 auto",outline:"none",padding:0,...pillFieldStyle("100%")}}/>
        </span>
        {showSuffix && <span style={PILL_ANSWER_TEXT}>%</span>}
        {allowNegative && !useThousands && (
          <button type="button" aria-label="Switch between a rise and a fall"
            onClick={e => {
              e.preventDefault();
              const next = display.startsWith("-") ? display.slice(1) : `-${display}`;
              setDisplay(next);
              // A lone "-" waits for digits rather than clearing the field.
              if (next !== "-" && !isNaN(+next)) onChange(next === "" ? null : +next);
            }}
            style={{marginLeft:"auto",flexShrink:0,background:"rgba(22,47,36,0.1)",color:TEXT,border:"none",borderRadius:"100px",padding:"1px 8px",fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",lineHeight:1.4}}>±</button>
        )}
      </div>
    </label>
  );
}
