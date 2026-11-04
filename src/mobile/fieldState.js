import { G, MUT, TEXT, CREAM, WHITE, GOLD_TEXT, FONT_SIZE } from "../design-tokens.js";

// How an answer's state (src/lib/inputState.js) shows on its control, on
// Edit inputs. A filled answer sits on the page's own cream with a hairline
// edge; an estimate swaps the hairline for a dashed one; an empty answer is
// pale gold with a sheen, its words in gold ("Add" where it takes typing).
// Of a set of options, the one picked is the filled one and the rest step
// back: white, a faint edge, grey words. A control not given a `state`
// looks as it does everywhere else in the app.
export const HAIRLINE = "1px solid rgba(22,47,36,0.14)";
export const ESTIMATE_EDGE = `1.5px dashed ${G}`;
export const FILLED = CREAM;
export const EMPTY_FILL = "rgba(196,150,58,0.3)"; // GOLD, pale
export const EMPTY_PLACEHOLDER = "Add";
export const EMPTY_TEXT = GOLD_TEXT;
// The sheen over an empty answer (index.html .field-empty).
export const EMPTY_CLASS = "field-empty";
// Options not picked: grey that still reads (4.5:1 on white).
export const OFF_FILL = WHITE;
export const OFF_EDGE = "1px solid rgba(22,47,36,0.1)";
export const OFF_TEXT = "#767676";

// The edge, drawn inside the control so nothing around it moves.
export const stateOutline = state =>
  state === "estimate" ? { outline: ESTIMATE_EDGE, outlineOffset: "-1.5px" }
  : state === "actual" ? { outline: HAIRLINE, outlineOffset: "-1px" }
  : {};
// The same edge as a border, for a control whose outline is its focus ring.
export const stateBorder = state => state === "estimate" ? ESTIMATE_EDGE : state === "actual" ? HAIRLINE : undefined;
export const stateFill = (state, fill) => state === "empty" ? EMPTY_FILL : state ? FILLED : fill;

// One layout for every answer on Edit inputs: the question, its control,
// a note under it, a link under that, and the same gap between answers.
export const QUESTION_GAP = "20px";
export const QUESTION_HEADING = { fontSize: "13.5px", fontWeight: 700, color: TEXT, lineHeight: 1.35, marginBottom: "8px" };
export const QUESTION_HINT = { fontSize: "11.5px", color: MUT, lineHeight: 1.5, margin: "6px 0 0" };
export const QUESTION_LINK = { background: "none", border: "none", padding: "6px 0 0", color: G, fontSize: "12px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", textAlign: "left" };
// A choice too long for a slider, one per row: pill-shaped on one line.
export const CHOICE_RADIUS = "22px";
export const CHOICE_TEXT = { fontSize: FONT_SIZE.BODY, fontWeight: 600, color: TEXT };
