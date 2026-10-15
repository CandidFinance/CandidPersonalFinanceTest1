// One way to handle a failed localStorage read or write: report it and carry
// on with the fallback. Storage can be blocked (private browsing, browser
// settings), full, or hold corrupt JSON, and none of that should stop the
// app. main.jsx sends the reports to PostHog. Each context is reported once
// per page load, so storage that's full and written on every change doesn't
// flood it. Failures before the reporter is set (reads at module load) are
// kept and sent once it is.
let reporter = null;
const pending = [];
const reported = new Set();

// `report(context, error)` is called for each failure.
export function setStorageFailureReporter(report) {
  reporter = report;
  while (pending.length) report(...pending.shift());
}

// `context` names what was being read or written, e.g. "load_inputs".
export function reportStorageFailure(context, error) {
  if (reported.has(context)) return;
  reported.add(context);
  if (reporter) reporter(context, error);
  else pending.push([context, error]);
}
