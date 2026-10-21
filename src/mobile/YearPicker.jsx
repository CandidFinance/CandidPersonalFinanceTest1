import WheelPicker from "./WheelPicker.jsx";

// A year from a known range ({ min, max }, e.g. studentLoan.js
// slFinishYearRange), on the tombola wheel (WheelPicker.jsx), newest year at
// the top. `blankLabel`: a first row meaning no answer ("" — "Not sure"), or
// null for none. `value` is the stored answer (a string, or ""); `onChange`
// gets a string, or "".
export const yearInRange = (v, { min, max }) => v !== "" && v != null && Number.isInteger(+v) && +v >= min && +v <= max;

export default function YearPicker({ value, onChange, range, label = "", blankLabel = "Not sure" }) {
  const { min, max } = range;
  const items = [
    ...(blankLabel ? [{ value: "", label: blankLabel }] : []),
    ...Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => ({ value: String(max - i), label: String(max - i) })),
  ];
  return <WheelPicker items={items} value={yearInRange(value, range) ? String(+value) : ""} onChange={onChange} label={label || "Year"}/>;
}
