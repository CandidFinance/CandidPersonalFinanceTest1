import { useReducedMotion } from "framer-motion";
import { CDARK, CREAM, CRITICAL, G, MUT, PROGRESS_GREEN, SANS, SERIF, TEXT, WHITE } from "../../design-tokens.js";
import { fmt } from "../../lib/format.js";
import { PrimaryButton, SkipLink } from "../onboarding/OnboardingShell.jsx";
import { tap } from "../haptics.js";
import { StepPlayer } from "./StepPlayer.jsx";
import { ShareJourney, GainTaxedStack, WrapperCompare, GainWaterfall, TaxYearCalendar, AllowanceBars } from "./ExplainerScenes.jsx";
import { CashRates, InterestSteps, CashCompare, PrizeDraws, MonthsStack } from "./CashScenes.jsx";

// A module's walk-through (lib/moduleExplainer.js) and the choice before it.
// Full screen, without the tab bar, like the guess comparison before the answer.

const theme = {
  text: TEXT, muted: MUT, surface: CREAM, tile: WHITE, track: CDARK, accent: G, onAccent: WHITE,
  neutral: "#8a8578", gain: PROGRESS_GREEN, cost: CRITICAL, paleGain: "#DCEFE3", ring: G,
  stripe: "repeating-linear-gradient(135deg, rgba(22,47,36,0.24) 0 4px, rgba(22,47,36,0.08) 4px 8px)",
  glass: "rgba(255,255,255,0.72)", glassEdge: "rgba(255,255,255,0.9)",
  fontBody: SANS, fontFigure: SERIF,
};

// Over the whole window, with its content in the app's central column.
const screen = { position: "fixed", inset: 0, zIndex: 4000, background: CREAM, paddingTop: "env(safe-area-inset-top)", display: "flex", flexDirection: "column", alignItems: "center" };
const column = { width: "100%", maxWidth: "580px", boxSizing: "border-box" };

const KINDS = { journey: ShareJourney, taxed: GainTaxedStack, compare: WrapperCompare, waterfall: GainWaterfall, calendar: TaxYearCalendar, bars: AllowanceBars, cashRates: CashRates, interestSteps: InterestSteps, cashCompare: CashCompare, prizeDraws: PrizeDraws, monthsStack: MonthsStack };

// Whole pounds, except where a scene lands on pence (tax on a single share).
const format = v => { const n = Math.round(v * 100) / 100; return Number.isInteger(n) ? fmt(n) : `£${n.toFixed(2)}`; };

function drawBlock({ kind, id, gap, countMs, fill, ...props }) {
  const Scene = KINDS[kind];
  return { id, gap, countMs, fill, render: ctx => <Scene {...props} {...ctx} theme={theme} format={format}/> };
}

export default function ModuleExplainer({ pages, doneLabel, skipLabel, onStep, onDone, onSkip, onReplay }) {
  const reduceMotion = !!useReducedMotion();
  const drawn = pages.map(p => ({ ...p, blocks: p.blocks.map(drawBlock) }));
  return (
    <div style={screen}>
      <div style={{ ...column, flex: 1, minHeight: 0 }}>
        <StepPlayer pages={drawn} theme={theme} reduceMotion={reduceMotion} doneLabel={doneLabel} skipLabel={skipLabel} onStep={onStep} onSkip={onSkip} onReplay={onReplay} onDone={() => { tap(); onDone(); }}/>
      </div>
    </div>
  );
}

export function ExplainerChoice({ onWalk, onSkip }) {
  return (
    <div style={{ ...screen, justifyContent: "center", padding: "24px", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
      <div style={column}>
        <h2 style={{ fontFamily: SANS, fontSize: "26px", lineHeight: 1.25, fontWeight: 700, color: TEXT, margin: "0 0 10px" }}>Your answer is ready</h2>
        <p style={{ fontSize: "16px", lineHeight: 1.55, color: MUT, margin: "0 0 28px" }}>See how this area works first, or go straight to your figures.</p>
        <PrimaryButton onClick={onWalk}>Walk me through it</PrimaryButton>
        <p style={{ fontSize: "13px", lineHeight: 1.5, color: MUT, textAlign: "center", margin: "10px 0 0" }}>About 2 minutes. Explains where your figures come from.</p>
        <SkipLink label="Skip to my answer" onClick={onSkip}/>
      </div>
    </div>
  );
}
