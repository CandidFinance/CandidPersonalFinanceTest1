import { motion, useReducedMotion } from "framer-motion";
import { G, GOLD } from "../design-tokens.js";

// Gold sparks thrown out from the top of the block (which needs
// position: relative), once, then gone.
const SPARKS = 14;
export default function Burst() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <div aria-hidden="true" style={{position:"absolute",left:"50%",top:0,width:0,height:0,pointerEvents:"none"}}>
      {Array.from({ length: SPARKS }, (_, i) => {
        // Upwards and out, in a fan, each a little different in reach and size.
        const angle = Math.PI * (1.05 + (0.9 * i) / (SPARKS - 1));
        const reach = 70 + (i % 3) * 22;
        const size = 6 + (i % 4) * 2;
        return (
          <motion.span key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x: Math.cos(angle) * reach, y: Math.sin(angle) * reach + 30, opacity: 0, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.15 + (i % 5) * 0.04, ease: [0.2, 0.7, 0.3, 1] }}
            style={{position:"absolute",width:size,height:size,marginLeft:-size / 2,marginTop:-size / 2,borderRadius:i % 2 ? "50%" : "2px",background:i % 3 ? GOLD : G}}/>
        );
      })}
    </div>
  );
}
