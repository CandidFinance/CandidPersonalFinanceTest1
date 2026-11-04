import { useId, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { NATION_OPTIONS, nationAlso } from "../../lib/sharedQuestions.js";
import { nationOf } from "../../lib/childcare.js";
import { MUT, TEXT, CDARK, PILL_HEIGHT } from "../../design-tokens.js";
import { PillSlider } from "../PillSlider.jsx";
import { capField } from "../../lib/onboarding.js";
import PillMoneyInput, { PILL_ANSWER_TEXT, pillFieldStyle } from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import { TilePopover, anchor } from "../MobileTile.jsx";
import { aboutState, estimatedFields, modulesUsing } from "../../lib/inputState.js";
import { MODULE_META } from "../../lib/moduleStatus.js";
import { QUESTION_GAP, QUESTION_HEADING, QUESTION_HINT, QUESTION_LINK, EMPTY_PLACEHOLDER, EMPTY_CLASS, stateFill, stateBorder } from "../fieldState.js";

const TRAJECTORY_OPTIONS = [
  { value:"stable", label:"Stable" },
  { value:"moderate", label:"Steady" },
  { value:"high", label:"Rapid" },
];
const TRAJECTORY_HINT = {
  stable: "Rising with prices, about 2% a year",
  moderate: "About 5% a year for ten years, then with prices",
  high: "About 10% a year for ten years, then with prices",
};
// Not working: retired, or between jobs (pension.js inRetirement).
const NOT_WORKING_OPTIONS = [{ value:"retired", label:"Retired" }, { value:"break", label:"Between jobs or a break" }];
const EMPLOYMENT_STATUS_OPTIONS = [
  { value:"employed", label:"Employed" },
  { value:"self_employed", label:"Self-employed" },
  { value:"not_working", label:"Not working" },
];

// Which of the modules on screen (`shown`) use a figure: their icons, very
// small, at the end of its question's line. Only for a figure two or more
// of them share; one module's own figure is in its own tile.
function UsedIn({ field, shown }) {
  const keys = modulesUsing(field, shown);
  if (keys.length < 2) return null;
  const meta = keys.map(k => MODULE_META.find(mm => mm.key === k)).filter(Boolean);
  const names = meta.map(mm => mm.title);
  const said = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return (
    <span role="img" aria-label={`Used in ${said}`} title={`Used in ${said}`}
      style={{display:"inline-flex",alignItems:"center",gap:"4px",marginLeft:"auto",flexShrink:0}}>
      {meta.map(({ key, icon: Icon }) => <Icon key={key} size={11} color={MUT} strokeWidth={2.25} aria-hidden="true"/>)}
    </span>
  );
}

// The name: a text pill, as PillMoneyInput's look (fieldState.js states),
// named by the label above it.
function NamePill({ value, onChange, state }) {
  const empty = state === "empty";
  return (
    <label className={empty ? `pill-field pill-empty ${EMPTY_CLASS}` : "pill-field"}
      style={{display:"flex",flexDirection:"column",justifyContent:"center",background:stateFill(state, CDARK),border:stateBorder(state),borderRadius:"100px",padding:"0 16px",height:PILL_HEIGHT,boxSizing:"border-box",cursor:"text"}}>
      <input type="text" aria-label="Name" value={value} maxLength={60} autoComplete="given-name" placeholder={empty ? EMPTY_PLACEHOLDER : ""}
        onChange={e => onChange(e.target.value)}
        style={{...PILL_ANSWER_TEXT,border:"none",background:"none",outline:"none",padding:0,...pillFieldStyle("100%")}}/>
    </label>
  );
}

// The "About you" fields on the Edit inputs page (MobileInputsScreen), in
// three runs: who they are (name, age, email), where they live, then work
// and pay, and last their spending. Each written straight into `d`. Laid out
// as a module's tile (ModuleInputsForm): a short label over each answer
// (as inputLabels.js), the same gap between them (fieldState.js). Each shows whether it's theirs, an
// estimate or still to fill in (inputState.js aboutState). `shown`, the
// modules on the page, for the "used in" icons; `email`, the email field
// (MobileInputsScreen's EmailField), in its place after age.
export default function AboutYouFields({ d, set, shown = [], email = null }) {
  const estimated = estimatedFields(d);
  const stateOf = field => aboutState(field, d, estimated);
  const [showAdditionalIncome, setShowAdditionalIncome] = useState(false);
  const [showEmploymentInfo, setShowEmploymentInfo] = useState(false);
  // Each pill group is named by the visible question above it.
  const ids = useId();
  const employmentId = `${ids}-employment`, nationId = `${ids}-nation`, trajectoryId = `${ids}-trajectory`;
  // The label, with the "used in" icons at the end of its line.
  const heading = (text, field, { id, extra } = {}) => (
    <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:QUESTION_HEADING.marginBottom}}>
      <span id={id} style={{...QUESTION_HEADING,marginBottom:0}}>{text}</span>
      {extra}
      {field && <UsedIn field={field} shown={shown}/>}
    </div>
  );
  // An answer's block, carrying its fields for Edit inputs to bring into view.
  const block = (fields, children) => (
    <div data-q={fields} style={{scrollMarginTop:"90px",borderRadius:"14px"}}>{children}</div>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",gap:QUESTION_GAP}}>
      {block("name", <>
        {heading("Name")}
        <NamePill value={d.name || ""} onChange={v => set("name", v)} state={stateOf("name")}/>
      </>)}

      {block("age", <>
        {heading("Age", "age")}
        <div style={{display:"flex"}}>
          <PillMoneyInput label="" ariaLabel="Age" unit="" value={d.age || null} onChange={v => set("age", v ?? "")} state={stateOf("age")}/>
        </div>
      </>)}

      {email && block("email", email)}

      {/* Where they live: Scotland's own income tax rates (tax.js), and
          childcare help by nation (childcare.js). */}
      {block("ukNation", <>
        {heading("Country", "ukNation", { id: nationId })}
        <PillSlider value={nationOf(d) || ""} onChange={v => { set("ukNation", v); set("scottishTaxpayer", nationAlso(v).scottishTaxpayer); }}
          options={NATION_OPTIONS.map(o => o.value === "ni" ? { ...o, label:"N. Ireland" } : o)} labelledBy={nationId} state={stateOf("ukNation")}/>
      </>)}

      {block("employmentStatus notWorkingReason earnedThisTaxYear", <>
        <div style={anchor}>
          {heading("Employment", "employmentStatus", { id: employmentId, extra: <InfoButton onClick={() => setShowEmploymentInfo(v => !v)} open={showEmploymentInfo}/> })}
          {/* Pops out over the page, as explanations do on the module pages. */}
          <AnimatePresence>
            {showEmploymentInfo && (
              <TilePopover key="employment" title="Employment status" onClose={() => setShowEmploymentInfo(false)}>
                <p style={{fontSize:"13px",color:TEXT,lineHeight:1.55,margin:0}}>
                  Whether you're employed, self-employed or not working changes which tax breaks and schemes apply to you, so the figures only use the ones that do.
                </p>
              </TilePopover>
            )}
          </AnimatePresence>
        </div>
        <PillSlider value={d.employmentStatus || "employed"} onChange={v => { set("employmentStatus", v); set("employmentAsked", true); }} options={EMPLOYMENT_STATUS_OPTIONS} labelledBy={employmentId} state={stateOf("employmentStatus")}/>
        {d.employmentStatus === "not_working" && (
          <div style={{marginTop:"8px"}}>
            <PillSlider value={d.notWorkingReason || ""} onChange={v => set("notWorkingReason", v)} options={NOT_WORKING_OPTIONS} label="Why not working" state={stateOf("notWorkingReason")}/>
          </div>
        )}
        {/* Between jobs: pay this tax year before stopping (sets this year's tax band). */}
        {d.employmentStatus === "not_working" && d.notWorkingReason === "break" && (
          <div style={{display:"flex",marginTop:"8px"}}>
            <PillMoneyInput label="Earned this tax year, before stopping" value={d.earnedThisTaxYear === "" || d.earnedThisTaxYear == null ? null : +d.earnedThisTaxYear} onChange={v => set("earnedThisTaxYear", v == null ? "" : String(v))} state={stateOf("earnedThisTaxYear")}/>
          </div>
        )}
      </>)}

      {block("salary", <>
        {heading(d.employmentStatus === "self_employed" ? "Earnings" : "Salary", "salary")}
        <div style={{display:"flex"}}>
          <PillMoneyInput label="" ariaLabel={d.employmentStatus === "self_employed" ? "Earnings before tax" : "Salary before tax"} value={d.salary || null} onChange={v => set("salary", capField("salary", v ?? ""))} state={stateOf("salary")}/>
        </div>
      </>)}

      {block("otherIncome dividendIncome bonusAmount", <>
        {heading("Other income", "otherIncome")}
        {showAdditionalIncome && (
          <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            <div style={{display:"flex",gap:"10px"}}>
              <PillMoneyInput label="Other income /yr" value={d.otherIncome || null} onChange={v => set("otherIncome", capField("otherIncome", v ?? ""))} state={stateOf("otherIncome")}/>
              <PillMoneyInput label="Dividend income /yr" value={d.dividendIncome || null} onChange={v => set("dividendIncome", capField("dividendIncome", v ?? ""))} state={stateOf("dividendIncome")}/>
            </div>
            <div style={{display:"flex"}}>
              <PillMoneyInput label="Annual bonus" value={d.bonusAmount || null} onChange={v => set("bonusAmount", capField("bonusAmount", v ?? ""))} state={stateOf("bonusAmount")}/>
            </div>
          </div>
        )}
        <button type="button" onClick={() => setShowAdditionalIncome(v => !v)} aria-expanded={showAdditionalIncome} style={{...QUESTION_LINK,padding:0,minHeight:"44px",display:"block"}}>
          {showAdditionalIncome ? "Hide other income" : "Add a bonus or other income"}
        </button>
      </>)}

      {block("salaryTrajectory", <>
        {heading("Salary growth", "salaryTrajectory", { id: trajectoryId })}
        <PillSlider value={d.salaryTrajectory} onChange={v => { set("salaryTrajectory", v); set("salaryGrowthPct", ""); set("payByYear", []); }} options={TRAJECTORY_OPTIONS} labelledBy={trajectoryId} state={stateOf("salaryTrajectory")}/>
        <p style={QUESTION_HINT}>{TRAJECTORY_HINT[d.salaryTrajectory] || "Used to project your salary over time."}</p>
      </>)}

      {block("monthlyExpenses", <>
        {heading("Essentials spending", "monthlyExpenses")}
        <PillMoneyInput label="" ariaLabel="Essentials spending a month" value={d.monthlyExpenses || null} onChange={v => set("monthlyExpenses", capField("monthlyExpenses", v ?? ""))} state={stateOf("monthlyExpenses")}/>
        <p style={QUESTION_HINT}>A month: rent, bills, food and transport.</p>
      </>)}
    </div>
  );
}
