import { G, WHITE, MUT, TEXT, PillSlider } from "../../CandidApp.jsx";
import { MODULE_GUIDES } from "../../lib/moduleGuide.js";
import { capField } from "../../lib/onboarding.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import MobileCashTiersList from "../onboarding/MobileCashTiersList.jsx";

// A module's answers as one form, for its tile on Edit inputs: the module's
// own questions (src/lib/moduleGuide.js), each shown only when it applies,
// just as the walk-through asks them, so the tile always has every answer
// the module uses. The shared "about you" questions (group "you") are left
// to the About you tile. Writes go through each question's `also`, as in
// the walk-through, so linked fields stay in step.
const sliderFits = options => options.length <= 3 && options.every(o => o.label.length <= 14);

export default function ModuleInputsForm({ moduleKey, d, m, set }) {
  const ctx = { d, m, regionalRows: null };
  const questions = (MODULE_GUIDES[moduleKey]?.questions || [])
    .filter(q => q.group !== "you" && (!q.showIf || q.showIf(ctx)));
  const write = (q, value) => {
    const v = q.cap && typeof value !== "object" ? capField(q.cap, value ?? "") : value;
    const patch = { [q.field]: v, ...(q.also ? q.also(v, ctx) : {}) };
    Object.entries(patch).forEach(([k, val]) => set(k, val));
  };

  const heading = { fontSize:"13.5px", fontWeight:700, color:TEXT, lineHeight:1.35, marginBottom:"8px" };
  const hint = { fontSize:"11.5px", color:MUT, lineHeight:1.5, margin:"6px 0 0" };
  const link = { background:"none", border:"none", padding:"6px 0 0", color:G, fontSize:"12px", fontWeight:700, fontFamily:"inherit", cursor:"pointer", textAlign:"left" };
  const chip = on => ({ display:"block", width:"100%", textAlign:"left", background:on ? "rgba(22,47,36,0.06)" : WHITE, border:`1.5px solid ${on ? G : "rgba(22,47,36,0.15)"}`, borderRadius:"12px", padding:"10px 14px", fontSize:"13.5px", fontWeight:600, color:TEXT, fontFamily:"inherit", cursor:"pointer" });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
      {questions.map(q => {
        // A result line (the plan worked out, the balance estimated).
        if (q.kind === "info") return (
          <div key={q.id} style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"10px 12px",fontSize:"13px",color:TEXT,lineHeight:1.5}}>
            {q.ask(ctx)}
          </div>
        );
        const raw = d[q.field];
        const note = q.note ? q.note(ctx) : null;
        // The walk-through's "not sure" answers that still mean something in
        // a form: an estimate, or one that sets something else (`also`), and
        // only when it would change the answer. A bare "None" is just
        // clearing the field, which the field itself does.
        const notSure = [q.notSure ? q.notSure(ctx) : null].flat()
          .filter(o => o && o.value !== undefined && (o.value !== "" || q.also) && String(raw ?? "") !== String(o.value));
        let control;
        if (q.kind === "choice") {
          const options = q.options(ctx);
          control = sliderFits(options)
            ? <PillSlider value={raw ?? ""} onChange={v => write(q, v)} options={options}/>
            : <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>{options.map(o => <button key={o.value} type="button" onClick={() => write(q, o.value)} style={chip(raw === o.value)}>{o.label}</button>)}</div>;
        } else if (q.kind === "custom" && q.render === "cashAccounts") {
          control = <MobileCashTiersList d={d} set={set}/>;
        } else if (["money", "percent", "years"].includes(q.kind)) {
          const filled = raw !== "" && raw != null && !isNaN(+raw);
          control = <PillMoneyInput label={q.label || ""} unit={{ percent:"%", years:"" }[q.kind] ?? "£"}
            value={filled ? +raw : (q.prefill ? q.prefill(ctx) : null)} onChange={v => write(q, v ?? "")}/>;
        } else return null;
        return (
          <div key={q.id}>
            <div style={heading}>{q.ask(ctx)}</div>
            {control}
            {note && <p style={hint}>{note}</p>}
            {notSure.map(o => <button key={o.label} type="button" onClick={() => write(q, o.value)} style={link}>{o.label}</button>)}
          </div>
        );
      })}
    </div>
  );
}
