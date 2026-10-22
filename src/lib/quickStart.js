// The quick-start engine: a module's first questions as one-tap choices in
// bands, the middle of each band written to the usual fields, so the usual
// calculations give a first answer before any exact figures. Pure logic,
// unit tested in quickStart.test.js; the screens are mobile/QuickStart.jsx.
//
// A module's setup (studentLoanQuick.js, cashQuick.js, pensionQuick.js):
//   module      its key
//   intro       { title, subtitle, question } for the screen before the
//               questions, or null
//   order       question ids, in the order asked
//   questions   { id: { ask, why, options(ctx), when(ctx) } }, or for a
//               slider { kind: "slider", ask, why, min, max, start(ctx),
//               live(ctx, value), when(ctx) }, answered "unsure" or a
//               number as text: `ask` a
//               string or worked out from ctx; `when` says
//               whether it's asked, from ctx = { d, m, a } (a: the answers
//               so far; d and m don't change until the last answer;
//               direct: opened on its own, not from another module's answer)
//   patch(d, m, a)    every field the answers write
//   estimateLine(d)   the line under the answer naming what's estimated
//
// Estimates are kept as quickEstimates[module].items: [{ phrase, field,
// value }], each dropped once its field no longer holds that value (the
// user has changed it). `field` can be a path such as "cashTiers.0.amount".

export const askFor = (q, ctx) => typeof q.ask === "function" ? q.ask(ctx) : q.ask;

export function questionOrder(setup, ctx) {
  return setup.order.filter(id => setup.questions[id].when(ctx));
}

const at = (d, path) => path.split(".").reduce((v, k) => (v == null ? v : v[k]), d);

export function estimateItems(d, module) {
  const items = d.quickEstimates?.[module]?.items || [];
  return items.filter(i => String(at(d, i.field) ?? "") === String(i.value ?? ""));
}
export function estimateLineFor(d, module) {
  const items = estimateItems(d, module);
  return items.length ? `Based on estimates: ${items.map(i => i.phrase).join(", ")}.` : null;
}
// The estimates record for a module, to go in the answers' patch.
export function withEstimates(d, module, items) {
  return { quickEstimates: { ...(d.quickEstimates || {}), [module]: { items } } };
}
export const addAsked = (d, fields) => ({ askedFields: [...new Set([...(d.askedFields || []), ...fields])] });

// Each band's figure is roughly its middle; the top band a step above its
// floor.
export const SALARY_BANDS = [
  { value:"u25", label:"Under £25k", figure:21000 },
  { value:"25-35", label:"£25k to £35k", figure:30000 },
  { value:"35-45", label:"£35k to £45k", figure:40000 },
  { value:"45-60", label:"£45k to £60k", figure:52500 },
  { value:"60-80", label:"£60k to £80k", figure:70000 },
  { value:"80-100", label:"£80k to £100k", figure:90000 },
  { value:"100+", label:"£100k or more", figure:120000 },
];
