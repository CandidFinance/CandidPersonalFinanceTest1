import posthog from "posthog-js";
import { G, WHITE, MUT } from "../design-tokens.js";
import { choiceFor, withChoice, withoutChoice } from "../lib/opportunityChoices.js";
import { bankChange, unbankChange } from "../lib/moduleStatus.js";
import { taxYearOf } from "../lib/taxYear.js";
import { fmt } from "../lib/format.js";

// The user's own answer to an opportunity with no £ in the module's total
// (the bonus, the retirement income gap): "I've done this" or "Not for me".
// Either stops it counting as something to act on until 6 April
// (opportunityChoices.js). `bank`: { moduleKey, perYear } for a "done" that
// counts as Saved (moduleStatus.js bankChange), taken back with it on Undo.
// Sits at the top of its tile, so it's spaced below rather than above.
export default function OpportunityChoice({ id, d, set, bank = null }) {
  const chosen = choiceFor(d, id);
  const nextApril = taxYearOf(new Date()) + 1;
  const choose = choice => {
    const on = new Date().toISOString().slice(0, 10);
    const perYear = choice === "done" && bank ? Math.round(bank.perYear) : 0;
    if (perYear > 0) set("moduleBaselines", bankChange(d, bank.moduleKey, perYear, on));
    set("opportunityChoices", withChoice(d, id, choice, perYear > 0 ? { perYear, on, moduleKey: bank.moduleKey } : {}));
    posthog.capture("opportunity_choice", { id, choice, amount: perYear });
  };
  const undo = () => {
    if (chosen.perYear > 0) set("moduleBaselines", unbankChange(d, chosen.moduleKey, chosen.perYear, chosen.on));
    set("opportunityChoices", withoutChoice(d, id));
    posthog.capture("opportunity_choice_undone", { id, choice: chosen.choice });
  };
  const link = { background: "none", border: "none", padding: 0, color: G, fontSize: "12.5px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", textDecoration: "underline" };

  if (chosen) {
    return (
      <p style={{fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:"0 0 14px"}}>
        {chosen.choice === "done"
          ? `Marked as done for this tax year${chosen.perYear > 0 ? `: ${fmt(chosen.perYear)} counted as saved` : ""}. `
          : `Set aside until 6 April ${nextApril}. `}
        <button type="button" onClick={undo} style={link}>{chosen.choice === "done" ? "Undo" : "Show it again"}</button>
      </p>
    );
  }
  const button = primary => ({
    background: primary ? G : WHITE, color: primary ? WHITE : G, border: `1.5px solid ${G}`, borderRadius: "100px",
    padding: "8px 14px", fontSize: "12.5px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
  });
  return (
    <div style={{marginBottom:"14px"}}>
      <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
        <button type="button" onClick={() => choose("done")} style={button(true)}>I've done this</button>
        <button type="button" onClick={() => choose("notForMe")} style={button(false)}>Not for me</button>
      </div>
      <p style={{fontSize:"11.5px",color:MUT,lineHeight:1.5,margin:"6px 0 0"}}>
        {bank && bank.perYear > 0 ? `Done counts ${fmt(Math.round(bank.perYear))} as saved, at the amount set below. ` : ""}Either one stops this counting as something to act on until 6 April.
      </p>
    </div>
  );
}
