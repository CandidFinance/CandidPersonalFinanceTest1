import WindfallChat from "../windfall/WindfallChat.jsx";

// The Chat tab: Candid's conversations. The first is a lump sum and where it
// could go (WindfallChat); more topics can join it here.
export default function MobileChatScreen({ d, m, set, marketRates }) {
  return <WindfallChat d={d} m={m} set={set} marketRates={marketRates}/>;
}
