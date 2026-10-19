import { useState } from "react";
import posthog from "posthog-js";
import { G, TEXT } from "../design-tokens.js";
import { checkEmail, requestEmailCheck, EMAIL_PROBLEMS } from "../lib/emailCheck.js";

// The checks an email gets before it's taken (src/lib/emailCheck.js): its
// shape and domain here, a likely typo offered once (submitting again as
// typed goes ahead), then the server's, which also emails the link that
// confirms it's theirs (`confirm`, api/email.js). `run` resolves to the
// tidied address and what happened to the link ({ email, sent }), or to
// null with `error` or `suggestion` set. Used by the
// unlock and rate-alert forms (MobileUnlock.jsx) and Edit inputs.
export function useEmailCheck(source) {
  const [error, setError] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const reject = problem => { posthog.capture("email_rejected", { source, problem }); setError(EMAIL_PROBLEMS[problem]); return null; };
  const run = async (raw, confirm) => {
    setError(null);
    const checked = checkEmail(raw);
    if (checked.problem) { setSuggestion(null); return reject(checked.problem); }
    if (checked.suggestion && suggestion?.for !== checked.email) { setSuggestion({ for: checked.email, to: checked.suggestion }); return null; }
    setSuggestion(null); setBusy(true);
    const { problem, sent } = await requestEmailCheck(checked.email, { confirm });
    setBusy(false);
    return problem ? reject(problem) : { email: checked.email, sent };
  };
  const use = (to, setEmail) => { posthog.capture("email_suggestion_used", { source }); setEmail(to); setSuggestion(null); };
  return { run, busy, error, suggestion, use, clear: () => { setError(null); setSuggestion(null); } };
}

export function DidYouMean({ suggestion, onUse, align = "center" }) {
  if (!suggestion) return null;
  return (
    <div role="alert" style={{fontSize:"13px",color:TEXT,margin:"8px 0 0",textAlign:align}}>
      Did you mean <button type="button" onClick={() => onUse(suggestion.to)}
        style={{background:"none",border:"none",padding:0,color:G,fontSize:"13px",fontWeight:700,fontFamily:"inherit",textDecoration:"underline",cursor:"pointer",overflowWrap:"anywhere"}}>{suggestion.to}</button>?
    </div>
  );
}
