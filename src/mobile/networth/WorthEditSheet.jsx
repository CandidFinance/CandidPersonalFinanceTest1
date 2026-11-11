import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, DeleteButton, PillMoneyInput, Sheet, SheetHeader, TextField } from "../ui";
import { TEXT, MUT, ERROR_TEXT, SANS } from "../../design-tokens.js";
import { editFieldsOf, editProblem, editPatch, removePatch, hidePatch, isHidden } from "../../lib/worthEdit.js";

// An account's figures on Progress, changed in a sheet (worthEdit.js): its
// value, rate, gains or what's been paid in, then Save. At its foot, hide
// it from the lists (still counted) or remove it from the answers. `onSave`
// takes the answers to change.
export default function WorthEditSheet({ open, onClose, d, account, onSave, onRemoved }) {
  const spec = account ? editFieldsOf(d, account) : null;
  const [values, setValues] = useState({});
  const [problem, setProblem] = useState(null);

  // Each opening starts from the answers as they are.
  useEffect(() => {
    if (!open || !spec) return;
    setValues(Object.fromEntries(spec.fields.map(f => [f.key, f.value])));
    setProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only as it opens
  }, [open, account?.id]);

  if (!spec) return null;
  const hidden = isHidden(d, account.id);
  const setField = (k, v) => { setValues(p => ({ ...p, [k]: v })); setProblem(null); };
  const save = () => {
    const typed = Object.fromEntries(spec.fields.map(f => [f.key, values[f.key] ?? f.value]));
    const wrong = editProblem(d, account, typed);
    if (wrong) { setProblem(wrong); return; }
    onSave(editPatch(d, account, typed), "edited");
    onClose();
  };
  const toggleHidden = () => { onSave(hidePatch(d, account.id, !hidden), hidden ? "shown" : "hidden"); onClose(); };
  const remove = () => {
    const patch = removePatch(d, account);
    if (!patch) return;
    onSave(patch, "removed");
    onClose();
    onRemoved?.();
  };
  const note = { margin: "4px 0 0", fontSize: 12, lineHeight: 1.45, color: MUT };

  return (
    <Sheet open={open} onClose={onClose} labelledBy="worth-edit-title">
      <div style={{ fontFamily: SANS, color: TEXT }}>
        <SheetHeader id="worth-edit-title" title={account.label} onClose={onClose}/>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
          {spec.fields.map(f => (
            <div key={f.key}>
              {f.unit === "text"
                ? <TextField label={f.label} value={values[f.key] ?? f.value} onChange={v => setField(f.key, v)} autoComplete="off"/>
                : <PillMoneyInput label={f.label} unit={f.unit} value={values[f.key] ?? f.value} onChange={v => setField(f.key, v)}/>}
              {f.hint && <p style={note}>{f.hint}</p>}
            </div>
          ))}
        </div>
        {problem && <p role="alert" style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.45, color: ERROR_TEXT }}>{problem}</p>}
        <Button fullWidth onClick={save} style={{ marginTop: 20 }}>Save</Button>

        <hr style={{ border: 0, borderTop: "1px solid rgba(22,47,36,0.09)", margin: "22px 0 14px" }}/>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{hidden ? "Hidden from your lists" : "Hide from your lists"}</div>
            <p style={note}>Still counted in your totals.</p>
          </div>
          <Button variant="secondary" icon={hidden ? Eye : EyeOff} onClick={toggleHidden}>{hidden ? "Show" : "Hide"}</Button>
        </div>
        {spec.removable && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Remove</div>
              <p style={note}>Takes it out of your answers, so every module works without it.</p>
            </div>
            {/* Room for the bin at its open width (tick and cross beside it),
                so it never runs over the words. */}
            <div style={{ flex: "0 0 128px", display: "flex", justifyContent: "flex-end" }}>
              <DeleteButton label={`Remove ${account.label}`} onConfirm={remove} style={{ flexShrink: 0 }}/>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
