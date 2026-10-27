import { TriangleAlert } from "lucide-react";
import { CRITICAL, WARNING } from "../design-tokens.js";
import { DARK } from "./CardStack.jsx";

// A red or amber alert inside a card, in whichever colours the card wears
// (`t`, CardStack.jsx: DARK in front): the card itself keeps its usual look.
// Progress's Tax shield, the £100k tax trap's card on Modules and the
// module's own Opportunity tile.
const ALERT = {
  red: { light: { bg: "rgba(192,57,43,0.10)", border: "rgba(192,57,43,0.28)", edge: CRITICAL }, dark: { bg: "rgba(232,106,90,0.16)", border: "rgba(255,150,135,0.32)", edge: "#f0806f" } },
  amber: { light: { bg: "rgba(217,130,43,0.10)", border: "rgba(217,130,43,0.32)", edge: WARNING }, dark: { bg: "rgba(240,160,80,0.16)", border: "rgba(250,190,120,0.32)", edge: "#f0a050" } },
};
export default function AlertBox({ tone, t, title, children }) {
  const a = ALERT[tone][t === DARK ? "dark" : "light"];
  return (
    <div style={{marginTop:"10px",borderRadius:"12px",padding:"12px 14px",background:a.bg,border:`1px solid ${a.border}`,borderLeft:`4px solid ${a.edge}`}}>
      <div style={{display:"flex",alignItems:"center",gap:"7px",fontSize:"13.5px",fontWeight:800,color:t.figure,lineHeight:1.3}}>
        <TriangleAlert size={14} strokeWidth={2.4} color={a.edge} aria-hidden="true" style={{flexShrink:0}}/>{title}
      </div>
      {children}
    </div>
  );
}
