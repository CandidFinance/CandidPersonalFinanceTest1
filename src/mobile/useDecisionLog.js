import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { updateRow } from "../lib/supabase.js";
import { decisionRowFields } from "../lib/valueMetrics.js";
import { storedRowId } from "../useReportRow.js";

// Logs an either/or answer the user has seen (valueMetrics.js): once it has
// settled for 2 seconds (any change to its result or gap starts the wait
// again, so a figure being typed is logged as typed, not half-way), and only
// when the result differs from the last one seen for that question, kept
// with the answers (`d.decisionsInformed`), so it's once per answer per user
// and again only if the answer flips. `decision` is null until there's an
// answer. A row missed here (none yet) is sent when the app next opens
// (CandidApp).
export default function useDecisionLog(d, set, decision) {
  const latest = useRef(d);
  latest.current = d;
  const key = decision ? `${decision.id}:${decision.result}:${decision.gap}:${decision.years}` : null;
  useEffect(() => {
    if (!decision) return;
    const t = setTimeout(() => {
      const seen = latest.current.decisionsInformed || {};
      const last = seen[decision.id];
      if (last?.result === decision.result) return;
      const { id, result, gap, years } = decision;
      posthog.capture("decision_informed", { id, result, gap_gbp: gap, years, flipped: !!last });
      const next = { ...seen, [id]: { result, gap, years, on: new Date().toISOString().slice(0, 10) } };
      set("decisionsInformed", next);
      const rowId = storedRowId();
      if (rowId) updateRow("test", rowId, decisionRowFields({ decisionsInformed: next }));
    }, 2000);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
