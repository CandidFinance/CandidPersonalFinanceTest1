// One input pill with a narrow slot on its right, so a "?" can sit beside a
// pill without taking a line of its own, and pills with and without one
// still line up. Used for every pill row on the Property screen. `min` lets
// a two-column row wrap to one column on narrow phones (the row needs
// flexWrap: "wrap").
export default function PillCell({ children, info = null, grow = 1, min = 0 }) {
  return (
    <div style={{flex:grow,minWidth:min,display:"flex",alignItems:"center",gap:"8px"}}>
      {children}
      <div style={{width:"15px",flexShrink:0,display:"flex"}}>{info}</div>
    </div>
  );
}
