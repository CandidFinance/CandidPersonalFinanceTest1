import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TEXT, PILL_HEIGHT } from "../../design-tokens.js";
import { TilePopover, anchor } from "../MobileTile.jsx";
import { fmt } from "../../lib/format.js";
import LoanBalanceEditor from "../LoanBalanceEditor.jsx";
import { PillSlider } from "../PillSlider.jsx";
import { briefQuestions } from "../../lib/moduleGuide.js";
import { capField } from "../../lib/onboarding.js";
import { withAnswered } from "../../lib/appEntry.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import YearPicker from "../YearPicker.jsx";
import WheelPicker from "../WheelPicker.jsx";
import MobileCashTiersList from "../onboarding/MobileCashTiersList.jsx";
import { answerState, estimatedFields, tileQuestions, answeredIn } from "../../lib/inputState.js";
import { MODULE_META } from "../../lib/moduleStatus.js";
import { ArrowDown, ArrowUp } from "lucide-react";
import { shortLabel } from "../../lib/inputLabels.js";
import { ESTIMATE_EDGE, EMPTY_FILL, EMPTY_TEXT, EMPTY_CLASS, OFF_FILL, OFF_EDGE, OFF_TEXT, FILLED, LINKED_FILL, HAIRLINE, stateBorder, QUESTION_GAP, QUESTION_HEADING, QUESTION_HINT, QUESTION_LINK, CHOICE_RADIUS, CHOICE_TEXT } from "../fieldState.js";

// A module's answers as one form, for its tile on Edit inputs: the module's
// own questions (src/lib/moduleGuide.js), each shown only when it applies,
// just as the walk-through asks them, so the tile always has every answer
// the module uses. The shared "about you" questions (group "you") are left
// to the About you tile. Writes go through each question's `also`, as in
// the walk-through, so linked fields stay in step.
// Each answer shows whether it's theirs, an estimate or still to fill in
// (inputState.js answerState, drawn as fieldState.js), and carries its
// field as `data-q`, for Edit inputs to bring it into view.
const sliderFits = options => options.length <= 3 && options.every(o => o.label.length <= 14);

// `brief`: only the questions asked on the short route from Student loan
// (moduleGuide.js briefQuestions), for a module not answered in full, and
// changing them doesn't count as answering it.
// `owners` (the modules answered in full) and `order` (the tiles as they
// sit on the page): a question another tile holds (inputState.js
// answeredIn) is a link to it instead, one per tile, which `onJump(key,
// field, from)` follows; the link carries `data-q="link-<key>"` to come
// back to. `linked`: the answers here another module works from, after
// following its link, filled green (fieldState.js LINKED_FILL).
const LINK_HEADING = { pension: "Pension contributions", kids: "Children and childcare" };
export default function ModuleInputsForm({ moduleKey, d, m, set, brief = false, owners = [], order = [], onJump, linked: linkedFields = null }) {
  const [editingLoan, setEditingLoan] = useState(false);
  const ctx = { d, m, regionalRows: null };
  const questions = tileQuestions(moduleKey, ctx, brief ? briefQuestions(moduleKey, "studentLoan") || [] : undefined);
  const estimated = estimatedFields(d);
  const write = (q, value) => {
    const v = q.cap && typeof value !== "object" ? capField(q.cap, value ?? "") : value;
    // Changing an answer here counts as answering the module.
    const patch = { [q.field]: v, ...(q.also ? q.also(v, ctx) : {}), ...(Array.isArray(d.answeredModules) && !brief ? withAnswered(d, moduleKey) : {}) };
    Object.entries(patch).forEach(([k, val]) => set(k, val));
  };

  // A choice too long for a slider, one per row: the picked one filled (its
  // edge dashed if it's an estimate), the rest stepping back; none picked,
  // all of them gold (fieldState.js).
  const chip = (on, state) => {
    const empty = state === "empty" && !on;
    return { display:"block", width:"100%", minHeight:PILL_HEIGHT, boxSizing:"border-box", textAlign:"left", borderRadius:CHOICE_RADIUS, padding:"11px 18px", ...CHOICE_TEXT, fontFamily:"inherit", cursor:"pointer",
      background:empty ? EMPTY_FILL : on ? FILLED : OFF_FILL,
      border:empty ? "1px solid transparent" : on ? (state === "estimate" ? ESTIMATE_EDGE : HAIRLINE) : OFF_EDGE,
      color:empty ? EMPTY_TEXT : on ? TEXT : OFF_TEXT };
  };

  const linked = new Set();
  const link = (owner, q) => {
    if (linked.has(owner)) return null;
    linked.add(owner);
    const { title, icon: Icon } = MODULE_META.find(mm => mm.key === owner);
    const Arrow = order.indexOf(owner) < order.indexOf(moduleKey) ? ArrowUp : ArrowDown;
    return (
      <div key={`link-${owner}`} data-q={`link-${owner}`} style={{scrollMarginTop:"90px",borderRadius:"14px"}}>
        <div style={QUESTION_HEADING}>{LINK_HEADING[owner] || title}</div>
        <button type="button" onClick={() => onJump?.(owner, q.field, moduleKey)}
          style={{width:"100%",display:"flex",alignItems:"center",gap:"10px",height:PILL_HEIGHT,boxSizing:"border-box",padding:"0 16px",borderRadius:"100px",background:OFF_FILL,border:OFF_EDGE,...CHOICE_TEXT,fontFamily:"inherit",cursor:"pointer",textAlign:"left"}}>
          {Icon && <Icon size={15} color={TEXT} aria-hidden="true"/>}
          <span style={{flex:1}}>In your {title} answers</span>
          <Arrow size={15} color={TEXT} aria-hidden="true"/>
        </button>
        <p style={QUESTION_HINT}>One answer, used by both.</p>
      </div>
    );
  };

  // After following another module's link: each unbroken run of the answers
  // it works from in one ring (index.html .q-ring), `data-ring` to land on.
  const ringed = els => {
    if (!linkedFields) return els;
    const runs = [];
    els.forEach((el, i) => {
      if (!el) return;
      const on = linkedFields.has(questions[i].field);
      const last = runs[runs.length - 1];
      if (on && last?.on) last.els.push(el);
      else runs.push({ on, els: [el], key: questions[i].id });
    });
    return runs.flatMap(r => r.on
      ? [<div key={`ring-${r.key}`} className="q-ring" data-ring style={{display:"flex",flexDirection:"column",gap:QUESTION_GAP,borderRadius:"14px",scrollMarginTop:"90px"}}>{r.els}</div>]
      : r.els);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:QUESTION_GAP}}>
      {ringed(questions.map(q => {
        const owner = answeredIn(moduleKey, q.field, owners);
        if (owner) return link(owner, q);
        // A result line (the plan worked out, the balance estimated).
        if (q.kind === "info") return (
          <div key={q.id} style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"10px 12px",fontSize:"13px",color:TEXT,lineHeight:1.5}}>
            {q.ask(ctx)}
          </div>
        );
        const raw = d[q.field];
        // Named in a word or two (inputLabels.js), which also names the
        // control, so a pill needs no caption of its own.
        const name = shortLabel(q, ctx);
        const st = answerState(q, ctx, estimated);
        const state = st;
        const note = q.note ? q.note(ctx) : null;
        // The walk-through's "not sure" answers that still mean something in
        // a form: an estimate, or one that sets something else (`also`), and
        // only when it would change the answer. A bare "None" is just
        // clearing the field, which the field itself does.
        const notSure = [q.notSure ? q.notSure(ctx) : null].flat()
          .filter(o => o && o.value !== undefined && (o.value !== "" || q.also) && String(raw ?? "") !== String(o.value));
        let control;
        if (q.kind === "choice" && q.wheel) {
          control = <WheelPicker label={name} items={[{ value:"", label:q.wheel }, ...q.options(ctx)]} value={raw ?? ""} onChange={v => write(q, v)} state={state}/>;
        } else if (q.kind === "choice") {
          const options = q.options(ctx);
          control = sliderFits(options)
            ? <PillSlider value={raw ?? ""} onChange={v => write(q, v)} options={options} state={state}/>
            : <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>{options.map(o => <button key={o.value} type="button" onClick={() => write(q, o.value)} className={state === "empty" && raw !== o.value ? EMPTY_CLASS : undefined} style={chip(raw === o.value, state)}>{o.label}{o.sub && <span style={{fontWeight:500,color:"inherit",opacity:0.8}}> · {o.sub}</span>}</button>)}</div>;
        } else if (q.kind === "custom" && q.render === "cashAccounts") {
          control = <MobileCashTiersList d={d} set={set} estimated={estimated}/>;
        } else if (q.field === "loanBalance" && raw !== "" && raw != null && !isNaN(+raw)) {
          // The balance, once there is one: updated in two steps, so an
          // overpayment's source is asked (LoanBalanceEditor).
          // The balance shows as a pill, as every other answer; Update pops
          // out over the page (TilePopover), as on Student loan's own page.
          control = (
            <div style={{...anchor,display:"flex",alignItems:"center",gap:"10px",background:FILLED,border:stateBorder(state),borderRadius:"100px",padding:"0 8px 0 16px",height:PILL_HEIGHT,boxSizing:"border-box"}}>
              <span style={{flex:1,minWidth:0,...CHOICE_TEXT}}>{fmt(Math.round(+raw))}</span>
              <button type="button" onClick={() => setEditingLoan(o => !o)} aria-expanded={editingLoan} style={{...QUESTION_LINK,padding:"8px 10px",minHeight:"44px"}}>Update</button>
              <AnimatePresence>
                {editingLoan && (
                  <TilePopover key="balance" title="Update your balance" onClose={() => setEditingLoan(false)}>
                    <LoanBalanceEditor bare d={d} m={m} set={set} onClose={() => setEditingLoan(false)}/>
                  </TilePopover>
                )}
              </AnimatePresence>
            </div>
          );
        } else if (q.yearRange) {
          control = <YearPicker label={name} range={q.yearRange(ctx)} value={raw ?? ""} onChange={v => write(q, v)} blankLabel={q.required ? "Pick a year" : "Not sure"} state={state}/>;
        } else if (["money", "percent", "years"].includes(q.kind)) {
          const filled = raw !== "" && raw != null && !isNaN(+raw);
          control = <PillMoneyInput label="" ariaLabel={name} unit={{ percent:"%", years:"" }[q.kind] ?? "£"}
            value={filled ? +raw : (q.prefill ? q.prefill(ctx) : null)} onChange={v => write(q, v ?? "")} state={state}/>;
        } else return null;
        return (
          <div key={q.id} data-q={q.field} style={{scrollMarginTop:"90px",borderRadius:"14px",...(linkedFields?.has(q.field) && { "--filled": LINKED_FILL })}}>
            <div style={QUESTION_HEADING}>{name}</div>
            {control}
            {note && <p style={QUESTION_HINT}>{note}</p>}
            {notSure.map(o => <button key={o.label} type="button" onClick={() => write(q, o.value)} style={QUESTION_LINK}>{o.label}</button>)}
          </div>
        );
      }))}
    </div>
  );
}
