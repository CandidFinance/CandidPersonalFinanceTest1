// One input pill with a narrow slot on its right, so a "?" can sit beside a
// pill without taking a line of its own, and pills with and without one
// still line up. Used for every pill row on the Property screen.
export default function PillCell({ children, info = null }) {
  return (
    <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:"8px"}}>
      {children}
      <div style={{width:"15px",flexShrink:0,display:"flex"}}>{info}</div>
    </div>
  );
}
