import { useState, useRef, useEffect, useId } from "react";
import { ListFilter, Check } from "lucide-react";
import { pill } from "./CardStack.jsx";
import { G, WHITE, MUT, TEXT } from "../design-tokens.js";

// A pill filter button opening a short menu of options, with a tick on the
// one chosen (the Modules wallet's filter, Progress's goal order). Filled
// while anything but `defaultValue` is chosen: the button is that state's
// one indicator. `options`: [{ key, label, count? }]; one with a count of 0
// can't be picked. `label` names the menu ("Filter modules").
// The options are a radio group: opening it puts focus on the one chosen,
// the up and down arrows move between them, and Escape (or a pick) closes it
// and hands focus back to the button.
export default function FilterMenu({ label, options, value, defaultValue, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const button = useRef(null);
  const list = useRef(null);
  const id = useId();
  const close = (refocus = true) => { setOpen(false); if (refocus) button.current?.focus(); };
  const radios = () => [...(list.current?.querySelectorAll('[role="radio"]:not(:disabled)') ?? [])];
  useEffect(() => {
    if (!open) return;
    (radios().find(r => r.getAttribute("aria-checked") === "true") ?? radios()[0])?.focus();
    const away = e => { if (box.current && !box.current.contains(e.target)) close(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const onKeyDown = e => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    const dir = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!dir || !list.current?.contains(document.activeElement)) return;
    e.preventDefault();
    const items = radios();
    const i = items.indexOf(document.activeElement);
    items[(i + dir + items.length) % items.length]?.focus();
  };
  const on = value !== defaultValue;
  const name = options.find(o => o.key === value)?.label;
  return (
    <div ref={box} onKeyDown={open ? onKeyDown : undefined} style={{position:"relative"}}>
      <button ref={button} type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={open ? id : undefined} aria-label={`${label}: ${name}`} className="tap44"
        style={{...pill, background:on ? G : WHITE, borderColor:on ? G : "rgba(22,47,36,0.15)"}}>
        <ListFilter size={15} color={on ? WHITE : G}/>
      </button>
      {open && (
        <div ref={list} id={id} role="radiogroup" aria-label={label}
          style={{position:"absolute",right:0,top:"30px",zIndex:30,minWidth:"170px",background:WHITE,borderRadius:"12px",boxShadow:"0 8px 28px rgba(22,47,36,0.16)",border:"1px solid rgba(22,47,36,0.08)",padding:"6px"}}>
          {options.map(({ key, label: text, count }) => {
            const empty = count === 0;
            return (
              <button key={key} type="button" role="radio" disabled={empty} aria-checked={value === key}
                tabIndex={value === key ? 0 : -1}
                onClick={() => { onChange(key); close(); }}
                style={{display:"flex",alignItems:"center",gap:"8px",width:"100%",textAlign:"left",background:"none",border:"none",borderRadius:"8px",padding:"9px 10px",minHeight:"44px",fontFamily:"inherit",fontSize:"14px",fontWeight:600,color:empty ? MUT : TEXT,opacity:empty ? 0.5 : 1,cursor:empty ? "default" : "pointer",whiteSpace:"nowrap"}}>
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
