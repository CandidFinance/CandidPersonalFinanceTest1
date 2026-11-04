import { useCallback, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { G, SANS } from "../../design-tokens.js";
import QAChat, { useQAChat } from "../chat/QAChat.jsx";
import WindfallChat from "../windfall/WindfallChat.jsx";

// The Chat tab: questions and answers (QAChat), with the lump-sum
// conversation (WindfallChat) as one of its topics. The Q&A's state is held
// here so it's still there on the way back from the lump sum.
export default function MobileChatScreen({ d, m, set, marketRates, answerModule, onGoTo }) {
  const [view, setView] = useState("qa");
  const openWindfall = useCallback(() => { setView("windfall"); window.scrollTo(0, 0); }, []);
  const chat = useQAChat(d, m, { onWindfall: openWindfall, set, marketRates, answerModule });

  if (view === "windfall") return (
    <>
      <button type="button" onClick={() => setView("qa")}
        style={{display:"inline-flex",alignItems:"center",gap:"4px",margin:"-8px 0 14px -6px",padding:"6px",background:"none",border:"none",color:G,fontFamily:SANS,fontSize:"14px",fontWeight:600,cursor:"pointer"}}>
        <ChevronLeft size={18} aria-hidden="true"/>All topics
      </button>
      <WindfallChat d={d} m={m} set={set} marketRates={marketRates}/>
    </>
  );
  return <QAChat chat={chat} d={d} m={m} onGoTo={onGoTo}/>;
}
