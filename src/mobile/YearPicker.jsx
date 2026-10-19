import { G, WHITE, TEXT, CRITICAL } from "../design-tokens.js";
import PillMoneyInput from "./PillMoneyInput.jsx";

// A year from a known range ({ min, max }, e.g. studentLoan.js
// slFinishYearRange): one button a year when the range is short enough to
// show them all, otherwise typed, with a line saying which years fit when
// the one typed doesn't. `value` is the stored answer (a string, or "");
// `onChange` gets a string, or "" when cleared.
export const YEAR_BUTTONS_MAX = 16;
export const yearInRange = (v, { min, max }) => v !== "" && v != null && Number.isInteger(+v) && +v >= min && +v <= max;

export default function YearPicker({ value, onChange, range, label = "" }) {
  const { min, max } = range;
  if (max - min + 1 <= YEAR_BUTTONS_MAX) {
    const years = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
        {years.map(y => {
          const on = String(value) === String(y);
          return (
            <button key={y} type="button" aria-pressed={on} onClick={() => onChange(on ? "" : String(y))} style={{
              background:on ? G : WHITE, color:on ? WHITE : TEXT, border:`1.5px solid ${on ? G : "rgba(22,47,36,0.15)"}`,
              borderRadius:"100px", padding:"8px 13px", fontSize:"13.5px", fontWeight:600, fontFamily:"inherit", cursor:"pointer",
            }}>{y}</button>
          );
        })}
      </div>
    );
  }
  const filled = value !== "" && value != null && !isNaN(+value);
  // Four digits typed and still outside the range: say which years fit.
  const wrong = filled && String(Math.round(+value)).length >= 4 && !yearInRange(value, range);
  return (
    <>
      <PillMoneyInput label={label} unit="" value={filled ? +value : null} onChange={v => onChange(v == null ? "" : String(v))}/>
      {wrong && <p style={{fontSize:"12px",color:CRITICAL,lineHeight:1.5,margin:"6px 0 0"}}>Pick a year from {min} to {max}.</p>}
    </>
  );
}
