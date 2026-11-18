import { useMemo } from "react";
import { incomePosition } from "../lib/progressTracker.js";
import { areasOnHome, areasShown } from "../lib/appEntry.js";
import TrapTile, { TRAP_ZONES } from "./TrapTile.jsx";
import AreasTile from "./AreasTile.jsx";

// Home's two squares side by side, under Coming up (Harvey, 17 Nov 2026):
// the £100k tax trap, for someone in it or near it, and Areas to explore,
// while it has areas. Either alone takes the full width. The trap tile
// opened takes the full width too, and Areas wraps under it.
export default function HomeTilePair({ d, m, plan, set, onOpenModule, onSeeAll }) {
  const income = useMemo(() => incomePosition(d, m), [d, m]);
  const trap = TRAP_ZONES.includes(income.zone);
  const areas = areasShown(d, plan);
  if (!trap && !areas) return null;
  const { items, ticking } = areasOnHome(d, plan);
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:"12px",alignItems:"stretch"}}>
      {trap && <TrapTile income={income} full={!areas} onOpenTrap={() => onOpenModule("taxTrap")}/>}
      {areas && (
        <AreasTile items={items} ticking={ticking} full={!trap} onOpen={onOpenModule} onSeeAll={onSeeAll}
          onTicked={keys => set("areasTicked", [...new Set([...(d.areasTicked || []), ...keys])])}
          onDismiss={() => set("areasDismissed", items.map(p => p.key))}/>
      )}
    </div>
  );
}
