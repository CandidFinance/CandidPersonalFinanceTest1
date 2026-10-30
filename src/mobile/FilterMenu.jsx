import { useState, useRef, useEffect } from "react";
import { ListFilter, Check } from "lucide-react";
import { arrow } from "./CardStack.jsx";
import { G, WHITE, MUT, TEXT } from "../design-tokens.js";

// A round filter button opening a short menu of options, with a tick on the
// one chosen (the Modules wallet's filter, Progress's goal order). Filled
// while anything but `defaultValue` is chosen: the button is that state's
// one indicator. `options`: [{ key, label, count? }]; one with a count of 0
// can't be picked. `label` names the menu ("Filter modules").
export default function FilterMenu({ label, options, value, defaultValue, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const on = value !== defaultValue;
  const name = options.find(o => o.key === value)?.label;
  return (
    <div ref={box} style={{position:"relative"}}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label={`${label}: ${name}`}
        style={{...arrow, background:on ? G : WHITE, borderColor:on ? G : "rgba(22,47,36,0.15)"}}>
        <ListFilter size={15} color={on ? WHITE : G}/>
      </button>
      {open && (
        <div role="group" aria-label={label} style={{position:"absolute",right:0,top:"36px",zIndex:30,minWidth:"170px",background:WHITE,borderRadius:"12px",boxShadow:"0 8px 28px rgba(22,47,36,0.16)",border:"1px solid rgba(22,47,36,0.08)",padding:"6px"}}>
          {options.map(({ key, label: text, count }) => {
            const empty = count === 0;
            return (
              <button key={key} type="button" disabled={empty} aria-pressed={value === key}
                onClick={() => { onChange(key); setOpen(false); }}
                style={{display:"flex",alignItems:"center",gap:"8px",width:"100%",textAlign:"left",background:"none",border:"none",borderRadius:"8px",padding:"9px 10px",fontFamily:"inherit",fontSize:"14px",fontWeight:600,color:empty ? MUT : TEXT,opacity:empty ? 0.5 : 1,cursor:empty ? "default" : "pointer",whiteSpace:"nowrap"}}>
                <span style={{width:"14px",display:"inline-flex"}}>{value === key && <Check size={14} color={G} strokeWidth={2.6}/>}</span>
                <span style={{flex:1}}>{text}</span>
                {count != null && <span style={{fontSize:"12.5px",fontWeight:600,color:MUT}}>{count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
