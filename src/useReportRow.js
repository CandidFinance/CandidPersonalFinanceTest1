import { useRef } from "react";
import posthog from "posthog-js";
import { insertRow, updateRow } from "./lib/supabase.js";
import { rowInputFields, rowReportFields } from "./lib/reportRow.js";
import { reportStorageFailure } from "./lib/storage.js";

const ROW_ID_KEY = "candid_report_row_id";

// The user's one row in Supabase's `test` table: inserting it, PATCHing it,
// and remembering its id. Rebuilt each render, so every function reads the
// latest `d`, `m` and `statuses`. The functions are named as the app shell
// uses them; the effects that decide when to save stay in the shell.
export function useReportRow(d, m, statuses) {
  const rowId = useRef(null);

  // This browser's row: the one inserted this visit, or the one an earlier
  // visit saved.
  function currentRowId() {
    if (rowId.current) return rowId.current;
    try { return localStorage.getItem(ROW_ID_KEY); } catch(e) { reportStorageFailure("read_row_id", e); return null; }
  }

  // Writes the user's row to `test` and remembers its id, in memory and in
  // localStorage so a later visit can still PATCH it. Called at the app's
  // entry (no score yet), and when a report or a Property save
  // finds this browser has no row yet (see saveRow, propertyPatch). `extra`
  // adds columns to the insert, the Property fields in that case.
  async function insertReportRow(score, extra = {}) {
    // Written once, ever, by main.jsx's getAcquisition() — read back here
    // rather than re-derived, so the ORIGINAL first-touch source (not whatever
    // UTM params happen to be in the URL right now) lands on the report row.
    let acquisition = {};
    try { acquisition = JSON.parse(localStorage.getItem('candid_acquisition') || '{}'); } catch(e) { reportStorageFailure("read_acquisition_for_row", e); }
    // Blocked storage leaves these unknown rather than stopping the insert.
    let assessmentStartedAt = null, confidenceScore = null;
    try {
      assessmentStartedAt = localStorage.getItem('candid_assessment_started_at') || null;
      const v = localStorage.getItem('candid_confidence_score');
      confidenceScore = v ? parseInt(v, 10) : null;
    } catch(e) { reportStorageFailure("read_row_markers", e); }
    const id = await insertRow("test", {
      ...extra,
      session_id: posthog.get_distinct_id?.() || null,
      ...rowInputFields(d, m),
      ...rowReportFields(statuses, score),
      modules_completed: 0,
      feedback_submitted: false,
      acquisition_source: acquisition.source || "direct",
      acquisition_medium: acquisition.medium || null,
      acquisition_campaign: acquisition.campaign || null,
      referred_by: acquisition.referred_by || null,
      first_visit_at: acquisition.first_visit_at || null,
      assessment_started_at: assessmentStartedAt,
      returned: false,
      confidence_score: confidenceScore,
    });
    if (id) {
      rowId.current = id;
      // Mirrored to localStorage (not just the in-memory ref) so a later
      // "welcome back" visit — a fresh AppShell mount — can still PATCH
      // `returned` onto the same row.
      try { localStorage.setItem(ROW_ID_KEY, id); } catch(e) { reportStorageFailure("save_row_id", e); }
    }
    return id;
  }

  // One row per user: PATCH this browser's row with `fields`, or insert it
  // if there isn't one (made before rows were created at entry, or gone).
  // `score` is for that insert.
  async function saveRow(fields, score = null) {
    const id = currentRowId();
    const outcome = await updateRow("test", id, fields);
    if (outcome === "missing") return insertReportRow(score);
    return id;
  }

  return {
    currentRowId, insertReportRow, saveRow,
    rowInputFields: () => rowInputFields(d, m),
    rowReportFields: score => rowReportFields(statuses, score),
  };
}
