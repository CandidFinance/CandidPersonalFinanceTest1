import { useState } from "react";
import posthog from "posthog-js";
import { fmt } from "../../lib/format.js";
import { VAULT_NAMES, newVaultId, poundsInput, withVault, withoutVault, vaultReached } from "../../lib/progressTracker.js";
import PillMoneyInput from "../../mobile/PillMoneyInput.jsx";
import PillSelect from "../../mobile/property/PillSelect.jsx";
import { G, WHITE, MUT, TEXT, CUSTOM_GOAL_COLOR } from "../../design-tokens.js";
import { hasAccess, featureUsed } from "../../lib/entitlement.js";
import SubscribeButtons from "../../mobile/deepdive/SubscribeButtons.jsx";
import { BarTile, AddTile, Tag, ProgressBar, ReachedMark, useReachedReveal, Figure, Details, TextButton, EditorCard, TextPill, helpText } from "./ProgressParts.jsx";

// Goal pots (progressTracker.js goalVaults), in the Goals tile: an "Add a
// goal" tile at the top, then each pot as a goal tile, newest first. A home
// or big purchase picked as a goal shows from those answers; saving an edit
// keeps the user's own copy.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  .map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

// A pot is a custom goal, the user's own rather than one of the standard
// goals every user has: tagged "Custom", with a bar colour of its own that
// no module uses (CUSTOM_GOAL_COLOR). Buying a home, from Property, counts:
// it's theirs to change or remove like any pot.
const VAULT_COLOR = CUSTOM_GOAL_COLOR;

export function saveVault(d, set, vault, { added, fromGoal }) {
  set("goalVaults", withVault(d.goalVaults, vault));
  posthog.capture("goal_vault_saved", {
    name: VAULT_NAMES.includes(vault.name) ? vault.name : "other", added, from_goal: fromGoal,
    has_target: !!vault.target, has_date: !!vault.date,
  });
}
export function removeVault(d, set, vault) {
  set("goalVaults", withoutVault(d.goalVaults, vault.id, vault.fromGoal));
  posthog.capture("goal_vault_removed", { from_goal: vault.fromGoal });
}

// "£1,200 saved of £3,000, by Jun 2027. £225 a month would get there in time."
function vaultNote(v) {
  const when = v.when ? `, ${v.when.charAt(0).toLowerCase()}${v.when.slice(1)}` : "";
  const saved = v.target > 0 ? `${fmt(v.saved)} saved of ${fmt(v.target)}${when}.` : `${fmt(v.saved)} saved${when}. No target set.`;
  return v.perMonth > 0 ? `${saved} ${fmt(v.perMonth)} a month would get there in time.` : saved;
}

// The tile that adds a pot, a subscriber feature: a tap opens the form below
// it, or, for anyone else (as ScenarioModelling.jsx's rule: subscribers, and
// anyone from before the paywall), a blurred example goal and the way to
// subscribe. Pots already added stay theirs either way. `names`: the pots
// already showing, left out of its suggestions.
export function AddGoalTile({ d, names, open, onToggle, onSave }) {
  const locked = !hasAccess() && d.unlockGate === true;
  return (
    <AddTile label="Add a goal" open={open} onToggle={onToggle} locked={locked} lockedBody={<LockedGoal d={d}/>} used={featureUsed(d, "addGoal")}>
      <VaultEditor names={names} onCancel={onToggle} onSave={onSave}/>
    </AddTile>
  );
}

function LockedGoal({ d }) {
  return (
    <div style={{position:"relative",background:WHITE,borderRadius:"10px",padding:"12px",minHeight:"120px"}}>
      <div aria-hidden="true" inert="" style={{filter:"blur(5px)",userSelect:"none",pointerEvents:"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:"13.5px",fontWeight:700,color:TEXT}}><span>A new kitchen</span><span>£4,200</span></div>
        <div style={{height:"8px",borderRadius:"100px",background:`${VAULT_COLOR}33`,marginTop:"10px"}}>
          <div style={{width:"45%",height:"100%",borderRadius:"100px",background:VAULT_COLOR}}/>
        </div>
        <div style={{fontSize:"12px",color:MUT,marginTop:"8px"}}>£4,200 saved of £9,000, by Jun 2027.</div>
      </div>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"10px",textAlign:"center",padding:"12px"}}>
        <span style={{fontSize:"12.5px",fontWeight:600,color:G,lineHeight:1.45,maxWidth:"260px",background:WHITE,borderRadius:"10px",padding:"6px 10px",boxShadow:"0 2px 8px rgba(22,47,36,0.08)"}}>Add your own goals and track them here, with a subscription</span>
        <SubscribeButtons d={d} module={null} from="add_goal"/>
      </div>
    </div>
  );
}

export function VaultTile({ vault: v, fresh = false, names, open, onToggle, editing, onEdit, onCancel, onSave, onRemove }) {
  const reached = vaultReached(v);
  const [ref, phase] = useReachedReveal(fresh);
  return (
    <BarTile title={v.name} tag={<Tag color={VAULT_COLOR}>Custom</Tag>} open={open} onToggle={onToggle} innerRef={ref}
      bar={v.target > 0 ? <ProgressBar pct={v.pct} color={VAULT_COLOR} label={v.name} reached={reached} phase={phase}/> : <span style={{fontSize:"12px",color:MUT}}>No target set</span>}
      figure={reached ? <ReachedMark phase={phase}/> : <Figure current={v.saved} target={v.target}/>}>
      <Details text={vaultNote(v)} action={!editing && <TextButton onClick={onEdit}>Edit</TextButton>}/>
      {editing && <VaultEditor vault={v} names={names} onCancel={onCancel} onSave={onSave} onRemove={onRemove}/>}
    </BarTile>
  );
}

// Adding or editing a pot: a name (or one of the usual ones), the target,
// what's saved and, if they like, the month to reach it by.
function VaultEditor({ vault = null, names, onCancel, onSave, onRemove }) {
  const [name, setName] = useState(vault?.name || "");
  const [target, setTarget] = useState(vault?.target || null);
  const [saved, setSaved] = useState(vault?.saved || null);
  const [year, setYear] = useState(vault?.date ? vault.date.slice(0, 4) : "none");
  const [month, setMonth] = useState(vault?.date ? vault.date.slice(5, 7) : "");
  const thisYear = new Date().getFullYear();
  const years = [{ value: "none", label: "No date" },
    ...Array.from({ length: 31 }, (_, i) => ({ value: String(thisYear + i), label: String(thisYear + i) }))];
  const dated = year !== "none";
  const suggestions = vault ? [] : VAULT_NAMES.filter(s => !names.includes(s));
  const chip = on => ({
    background:on ? G : WHITE, color:on ? WHITE : TEXT, border:`1.5px solid ${on ? G : "rgba(22,47,36,0.18)"}`, borderRadius:"100px",
    padding:"7px 13px", fontSize:"13px", fontWeight:600, fontFamily:"inherit", cursor:"pointer",
  });
  const submit = () => onSave({
    id: vault?.id || newVaultId(), name: name.trim(),
    target: poundsInput(target), saved: poundsInput(saved),
    // A year on its own means by the end of it.
    date: dated ? `${year}-${month || "12"}` : "",
  });

  return (
    <EditorCard title={vault ? "Edit goal" : "New goal"} onCancel={onCancel} onSave={submit} saveDisabled={!name.trim()}
      footer={vault && (
        <div style={{textAlign:"center",marginTop:"12px"}}>
          <TextButton muted onClick={onRemove}>Remove this goal</TextButton>
        </div>
      )}>
      {suggestions.length > 0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
          {suggestions.map(s => <button key={s} type="button" aria-pressed={name === s} onClick={() => setName(s)} style={chip(name === s)}>{s}</button>)}
        </div>
      )}
      <TextPill label="Name" value={name} onChange={setName} placeholder="A new kitchen, say"/>
      <div style={{display:"flex",gap:"8px"}}>
        <PillMoneyInput label="Target" value={target} onChange={setTarget}/>
        <PillMoneyInput label="Saved so far" value={saved} onChange={setSaved}/>
      </div>
      <div style={{display:"flex",gap:"8px"}}>
        <PillSelect label="By month" value={dated ? month || "12" : month} onChange={setMonth} options={MONTHS} placeholder="Month"/>
        <PillSelect label="Year" value={year} onChange={setYear} options={years} placeholder="No date"/>
      </div>
      {vault?.id === "home" && vault.fromGoal && (
        <p style={helpText}>Saved so far starts as the cash available in Property. Once saved here, these figures are kept for this goal.</p>
      )}
    </EditorCard>
  );
}
