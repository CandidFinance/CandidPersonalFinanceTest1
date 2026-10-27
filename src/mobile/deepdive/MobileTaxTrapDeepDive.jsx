import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Check, TriangleAlert, X } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { closingTile } from "../SinceLastVisit.jsx";
import { useElementWidth } from "../useElementWidth.js";
import { fmt } from "../../lib/format.js";
import { taxTrap, trapInView, rateCurve, lostTo, pensionPath, paydayOf, TRAP_START, TRAP_END, TRAP_GROSS, TRAP_EDGE } from "../../lib/taxTrap.js";
import { PERSONAL_ALLOWANCE } from "../../lib/tax.js";
import { kidsSituation, TFC_CAP_PER_CHILD, FUNDED_HOURS_VALUE } from "../../lib/childcare.js";
import { G, MUT, TEXT, SERIF, WHITE, CDARK, CRITICAL, WARNING, CTA_BLUE } from "../../design-tokens.js";
import posthog from "posthog-js";
import { recordSacrifice, undoSacrifice } from "../../lib/taxTrapRecord.js";
import { CHOICE_IDS, choiceFor } from "../../lib/opportunityChoices.js";
import { hasAccess, PLANS } from "../../lib/entitlement.js";
import { salarySacrificeDraft } from "../emailDrafts.js";
import MobileReminderAction from "../MobileReminderAction.jsx";
import { TrapTracking } from "../PaydayCheck.jsx";
import OpportunityTile from "./OpportunityTile.jsx";
import { PlanPicker, CTA_WASH } from "./SubscribeButtons.jsx";
import CardStack from "../CardStack.jsx";

// £100k tax trap (taxTrap.js), in the order the answer runs:
//  1. What the trap costs them a year: the tax on the allowance lost and
//     the childcare their income stops, in a red alert (amber within
//     £5,000 under it, as the module's card on Modules). Money, so it's the
//     module's £ on Home too. Under £100k: how far, what £1 over would do,
//     and when they'd pass it.
//  2. What it costs them, as a checklist: the allowance, and the childcare
//     support (ticked with children, a warning when planning them, greyed
//     without), asking whether a partner is over £100k if it isn't known.
//     Over £100k, "See my options" opens 3 and 4.
//  3. Salary sacrifice, any amount on a slider: what it puts in the pension
//     and brings back first, then the take-home it costs and the tax saved;
//     why behind a pill.
//  4. Other options, each way back to £100k a card in a white wallet
//     (CardStack.jsx, light), what it brings first, then what it costs.
//     The tile minimises, so the chart below is near.
//  5. Why: their marginal tax rate, on a chart of it at every income from
//     £0, the trap in red. Touching or pointing at the chart shows the rate
//     there in its parts (tax, NI, student loan), as pills beside it, or
//     below it on a phone.
const K = "£100k";
const pct = r => `${Math.round(r * 1000) / 10}%`;
const pence = r => `${Math.round(r * 1000) / 10}p`;
const signed = n => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`;
const tile = { background:WHITE, borderRadius:"16px", boxShadow:"0 2px 10px rgba(22,47,36,0.06)", padding:"16px 18px", marginBottom:"16px" };
const tileTitle = { fontSize:"15px", fontWeight:700, color:TEXT };
// A figure's cell: red for what it costs, green for what it brings.
const TONE = {
  cost: { bg: "rgba(192,57,43,0.08)", fg: "#8e2a1f" },
  gain: { bg: "rgba(47,148,97,0.16)", fg: G },
  plain: { bg: "rgba(22,47,36,0.04)", fg: G },
};
const toneOf = v => v < 0 ? "cost" : v > 0 ? "gain" : "plain";
const cellLabel = { fontSize:"10px", fontWeight:700, color:MUT, letterSpacing:"0.05em", textTransform:"uppercase" };
function Cell({ label, text, tone = "plain", wide = false }) {
  return (
    <div style={{background:TONE[tone].bg,borderRadius:"10px",padding:"8px 10px",gridColumn:wide ? "1 / -1" : undefined}}>
      <div style={cellLabel}>{label}</div>
      <div style={{fontFamily:SERIF,fontSize:"17px",fontWeight:700,color:TONE[tone].fg,marginTop:"2px"}}>{text}</div>
    </div>
  );
}

export default function MobileTaxTrapDeepDive({ d, m, set }) {
  const t = taxTrap(d, m);
  const [showOptions, setShowOptions] = useState(false);
  const [costsOpen, setCostsOpen] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(true);
  const reduceMotion = useReducedMotion();
  const recorded = choiceFor(d, CHOICE_IDS.taxTrapSacrifice);
  const apply = patch => Object.entries(patch).forEach(([k, v]) => set(k, v));
  const undo = () => {
    apply(undoSacrifice(d));
    posthog.capture("opportunity_choice_undone", { id: CHOICE_IDS.taxTrapSacrifice, choice: "done" });
  };
  if (!t || !trapInView(d, m.adjustedNetIncome)) {
    return (
      <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6}}>
        {t ? `Your income is ${fmt(t.ani)}, not near ${K}, so nothing here applies yet.` : "This works from your salary, which isn't in yet."} From {fmt(TRAP_GROSS)} of pay before pension, or heading over {K} in the next few years, this module works out what it would cost you.
      </p>
    );
  }
  const kidsFigure = t.over ? t.childcareLost : t.childcareAtRisk;
  const support = t.nation === "england" || !t.nation ? "Tax-Free Childcare and funded hours" : "Tax-Free Childcare";
  // Under £100k: the year they'd pass it, or else what a 20% bonus would do.
  const bonusTo = Math.round(t.ani + m.salary * 0.2);
  const ahead = t.crossing ? `At your expected pay growth, you'd pass it in ${t.crossing}/${String(t.crossing + 1).slice(2)}`
    : !(+d.bonusAmount > 0) ? `A 20% bonus would take you to ${fmt(bonusTo)}` : null;

  // Red over £100k, amber within £5,000 under it (moduleStatus.js has the
  // same, for the module's card), titled with their marginal rate there.
  const alert = t.amount > 0 ? { tone: "red", title: t.aboveTaper ? "Your Personal Allowance is gone" : `You're in the ${pct(t.rate.rate)} tax trap` }
    : !t.over && t.headroom <= TRAP_EDGE ? { tone: "amber", title: `Within ${fmt(TRAP_EDGE)} of the ${pct(t.trapRate)} tax trap` } : null;

  return (
    <div>
      {/* 1. The answer. */}
      <OpportunityTile stacked alert={alert} over={t.over ? `What the ${K} trap costs you` : `You're under ${K}`}
        figures={[{ value: t.over ? fmt(t.amount) : fmt(t.headroom), suffix: t.over ? " a year" : " to spare" }]}
        chips={t.over
          ? [`${fmt(t.allowance.tax)} extra tax${t.childcareLost > 0 ? "" : " on the allowance you've lost"}`, t.childcareLost > 0 && `+ ${fmt(t.childcareLost)} of ${support}`]
          : [`£1 over: a ${pct(t.trapRate)} marginal rate`, ahead, t.childcareAtRisk > 0 && `${fmt(t.childcareAtRisk)} of ${support} would stop`]}/>

      {/* What they've set up this tax year: the same switch, on; off undoes it. */}
      {recorded && (
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }}
          style={{display:"flex",alignItems:"center",gap:"12px",margin:"0 4px 16px"}}>
          <p style={{flex:1,fontSize:"12.5px",color:MUT,lineHeight:1.5,margin:0}}>
            {recorded.route === "sacrifice" ? "Salary sacrifice" : "Pension payments"} of {fmt(recorded.amount)} a year set up on {new Date(recorded.on).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}{recorded.perYear > 0 ? `: ${fmt(recorded.perYear)} a year kept` : ""}.
          </p>
          <Switch on label="I've set this up" onChange={undo}/>
        </motion.div>
      )}

      {/* Where this tax year is heading, for subscribers. */}
      {hasAccess() && d.employmentStatus === "employed" && <TrapTracking d={d} m={m} set={set}/>}

      {/* 2. What it costs them, then (over £100k) the way to their options;
          once they're open, it minimises to its title. */}
      <Costs d={d} t={t} set={set} options={t.options.length > 0 && !showOptions ? () => { setShowOptions(true); setCostsOpen(false); } : null}
        open={costsOpen} onToggle={showOptions ? () => setCostsOpen(o => !o) : null}/>

      {/* Keeping on top of it through the year comes with a subscription:
          once they've asked to see their options (or straight away, with
          none to see), until closed. */}
      <AnimatePresence initial={false}>
        {!hasAccess() && !d.trapSubscribeClosed && (showOptions || t.options.length === 0) && (
          <motion.div key="subscribe" exit={closingTile(reduceMotion)} style={{transformOrigin:"top center",marginBottom:"16px"}}>
            <PlanAhead d={d} t={t} kidsFigure={kidsFigure} onClose={() => set("trapSubscribeClosed", true)}/>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Salary sacrifice, any amount, and 4. other options, together
          in a band of their own so they read as one set, apart from the
          tiles that say what it costs and why. */}
      <AnimatePresence initial={false}>
      {showOptions && t.options.length > 0 && (
        // flow-root keeps the last tile's margin inside the band.
        <motion.section key="options" exit={closingTile(reduceMotion)} aria-label="Your options" style={{transformOrigin:"top center",display:"flow-root",background:"rgba(47,148,97,0.09)",borderRadius:"20px",padding:`14px 10px ${optionsOpen ? 0 : 14}px`,margin:"0 -6px 16px"}}>
          <button type="button" onClick={() => setOptionsOpen(o => !o)} aria-expanded={optionsOpen}
            style={{width:"100%",display:"flex",alignItems:"flex-start",gap:"10px",background:"none",border:"none",padding:`0 8px ${optionsOpen ? 12 : 0}px`,textAlign:"left",fontFamily:"inherit",cursor:"pointer"}}>
            <span style={{flex:1}}>
              <span style={{display:"block",fontSize:"11px",fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",color:G}}>Your options</span>
              <span style={{display:"block",fontSize:"12.5px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>Ways your income could come back to {K}.</span>
            </span>
            <ChevronDown size={18} color={G} aria-label={optionsOpen ? "Minimise" : "Expand"} style={{flexShrink:0,transform:optionsOpen ? "rotate(180deg)" : "none",transition:"transform 0.15s"}}/>
          </button>
          {optionsOpen && <>
            {/* Once set up, the tile fades out; the line under the answer
                says what was set up. */}
            <AnimatePresence initial={false}>
              {t.over && !recorded && (
                <motion.div key="slider" exit={closingTile(reduceMotion)} style={{transformOrigin:"top center"}}>
                  <PensionSlider d={d} m={m} t={t}
                    onRecord={(amount, route, perYear) => {
                      apply(recordSacrifice(d, m, amount, route));
                      posthog.capture("opportunity_choice", { id: CHOICE_IDS.taxTrapSacrifice, choice: "done", amount: perYear });
                    }}/>
                </motion.div>
              )}
            </AnimatePresence>
            <Options t={t}/>
          </>}
        </motion.section>
      )}
      </AnimatePresence>

      {/* 5. Why. */}
      <RateTile d={d} m={m} t={t}/>
    </div>
  );
}

// Planning ahead comes with a subscription: in a pale blue half, what's at
// stake (their childcare support, else what the trap costs or its rate);
// in a white half, the moments in the tax year Candid watches, then the
// two plans.
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
const monthName = i => new Date(2026, i - 1, 1).toLocaleString("en-GB", { month: "long" });
function PlanAhead({ d, t, kidsFigure, onClose }) {
  const planning = kidsFigure === 0 && d.kidsStatus === "planning";
  const partner = d.partnerOver100k === "single" ? "a partner" : "your partner";
  const stake = kidsFigure > 0 ? { figure: `${fmt(kidsFigure)} a year`, body: <>of childcare support stops if you or {partner} earn <b>£1 over {K}</b>. It's not worth getting wrong.</> }
    : planning ? { figure: "All your childcare support", body: <>stops if you or {partner} earn <b>£1 over {K}</b>: up to tens of thousands of pounds while children are young. It's not worth getting wrong.</> }
    : t.over ? { figure: `${fmt(t.amount)} a year`, body: <>is what the trap costs you now, at a <b>{pct(t.rate.rate)}</b> marginal rate.</> }
    : { figure: `${pct(t.trapRate)} tax`, body: <>on every £1 you earn <b>over {K}</b>, until {fmt(TRAP_END)}.</> };
  const atStake = kidsFigure > 0 ? kidsFigure : t.over ? t.amount : 0;
  // The alert comes the month before the bonus, or in February when its
  // month isn't known (src/lib/alerts.js).
  const bonus = +d.bonusMonth >= 1 && +d.bonusMonth <= 12 ? `${monthName(+d.bonusMonth === 1 ? 12 : +d.bonusMonth - 1)}, before your bonus` : "February, before any bonus";
  // Payday and bonus only for the employed, the bonus only with one given
  // (alerts.js sends nothing otherwise).
  const employed = d.employmentStatus === "employed";
  const moments = [
    employed && { when: `Every payday, the ${ordinal(paydayOf(d))}`, what: "Check-in: where your year is heading" },
    employed && +d.bonusAmount > 0 && { when: bonus, what: `How much of it keeps you under ${K}` },
    { when: "Before 5 April", what: "The top-up needed, while there's still time", last: true },
  ].filter(Boolean);
  return (
    <section aria-label={`Plan ahead for the ${K} trap`} style={{position:"relative",background:WHITE,border:`2px solid ${CTA_BLUE}`,borderRadius:"20px",overflow:"hidden",boxShadow:"0 8px 24px rgba(0,113,227,0.14)"}}>
      <div style={{background:CTA_WASH,padding:"20px 20px 18px"}}>
        <button type="button" onClick={onClose} aria-label="Close"
          style={{position:"absolute",top:"12px",right:"12px",display:"flex",alignItems:"center",justifyContent:"center",width:"28px",height:"28px",borderRadius:"50%",border:"none",background:"rgba(0,113,227,0.1)",color:CTA_BLUE,cursor:"pointer",padding:0}}>
          <X size={15} aria-hidden="true"/>
        </button>
        <h2 style={{margin:"0 32px 0 0",fontSize:"20px",lineHeight:1.25,fontWeight:700,color:G}}>Plan ahead for the {K} trap</h2>
        <div style={{marginTop:"14px",display:"flex",gap:"12px",alignItems:"flex-start",background:WHITE,border:"1.5px solid rgba(192,57,43,0.35)",borderRadius:"14px",padding:"14px"}}>
          <TriangleAlert size={22} color={CRITICAL} aria-hidden="true" style={{flexShrink:0,marginTop:"2px"}}/>
          <div>
            <div style={{fontFamily:SERIF,fontWeight:700,fontSize:"24px",lineHeight:1.1,color:"#a8301f"}}>{stake.figure}</div>
            <div style={{fontSize:"13px",lineHeight:1.45,marginTop:"4px",color:TEXT}}>{stake.body}</div>
          </div>
        </div>
      </div>
      <div style={{padding:"18px 20px 20px"}}>
        <div style={{fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:MUT}}>What you get from Candid</div>
        <ol style={{listStyle:"none",margin:"12px 0 0",padding:0}}>
          {moments.map(mo => (
            <li key={mo.when} style={{display:"flex",gap:"14px"}}>
              <span aria-hidden="true" style={{display:"flex",flexDirection:"column",alignItems:"center",width:"14px",flexShrink:0}}>
                <span style={{width:"14px",height:"14px",borderRadius:"50%",background:mo.last ? CRITICAL : CTA_BLUE,flexShrink:0,marginTop:"2px"}}/>
                {!mo.last && <span style={{flex:1,width:"2px",background:"rgba(0,113,227,0.3)"}}/>}
              </span>
              <span style={{paddingBottom: mo.last ? 0 : "16px"}}>
                <span style={{display:"block",fontSize:"11px",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:mo.last ? "#a8301f" : "#0058b0"}}>{mo.when}</span>
                <span style={{display:"block",fontSize:"14px",fontWeight:700,marginTop:"2px",color:TEXT}}>{mo.what}</span>
              </span>
            </li>
          ))}
        </ol>
        <div style={{marginTop:"18px"}}>
          <PlanPicker d={d} module="taxTrap" from="tax_trap_tracking"/>
        </div>
        {PLANS.yearly.amount < atStake / 100 && (
          <div style={{textAlign:"center",fontSize:"12px",color:MUT,marginTop:"10px"}}>{PLANS.yearly.price} a year is less than 1% of the {fmt(atStake)} at stake.</div>
        )}
      </div>
    </section>
  );
}

// Salary sacrifice (or, for the self-employed, paying in from take-home):
// any amount from £0 past what takes them back to £100k (where it starts),
// on top of what they pay in now. First what it puts in the pension and,
// back at £100k, the childcare that comes back (green), then what it costs
// in take-home (red) and the tax (and NI) saved. Without a student loan
// given, a prompt to add one: sacrifice lowers its repayments too. Why,
// behind a pill.
const SLIDER_STEP = 100, SLIDER_STEP_BIG = 500;
const note = { fontSize:"12px", color:MUT, lineHeight:1.5, margin:"6px 0 0" };
function PensionSlider({ d, m, t, onRecord }) {
  const navigate = useNavigate();
  const employed = d.employmentStatus !== "self_employed";
  const [route, setRoute] = useState(employed && d.pensionType !== "relief" ? "sacrifice" : "relief");
  const [why, setWhy] = useState(false);
  // Switched on, the knob slides across, then it's recorded and the tile goes.
  const [switched, setSwitched] = useState(false);
  const reduceMotion = useReducedMotion();
  const setUp = () => {
    if (switched) return;
    setSwitched(true);
    setTimeout(() => onRecord(amount, route, p.avoided), reduceMotion ? 0 : 450);
  };
  const step = t.needed > 20000 ? SLIDER_STEP_BIG : SLIDER_STEP;
  // Past the taper the whole way back is the range; under it, half as much again.
  const max = t.aboveTaper ? Math.ceil(t.needed / step) * step : Math.ceil(t.needed * 1.5 / SLIDER_STEP_BIG) * SLIDER_STEP_BIG;
  const [amount, setAmount] = useState(t.needed);
  const p = pensionPath(d, m, amount, route);
  const kids = t.childcareLost > 0;
  // No student loan answer at all (not "none"): it may be costing them more.
  const loanUnknown = employed && !d.studentLoan && !d.slPlanAnswer;
  // The trap's rate, then with NI, then with a student loan's 9%.
  const trapTax = m.scottish ? 67.5 : 60;
  return (
    <section style={tile}>
      <div style={tileTitle}>{route === "sacrifice" ? "Salary sacrifice" : "Pension contributions"}</div>
      <div style={{fontSize:"12.5px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>
        Paying into your pension is the most common way to beat the {K} tax trap. {fmt(t.needed)} more a year brings your income back to {K}.
      </div>
      {employed && (
        <div style={{display:"flex",gap:"6px",marginTop:"12px"}}>
          {[["sacrifice", "Salary sacrifice"], ["relief", "Relief at source"]].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setRoute(key)} aria-pressed={route === key} style={{
              border:"none",borderRadius:"100px",padding:"6px 12px",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              background:route === key ? G : CDARK, color:route === key ? WHITE : MUT,
            }}>{label}</button>
          ))}
        </div>
      )}
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginTop:"14px"}}>
        <span style={{fontSize:"12px",color:MUT}}>A year</span>
        <span style={{fontFamily:SERIF,fontSize:"24px",fontWeight:700,color:G}}>{fmt(amount)}</span>
      </div>
      <input type="range" min={0} max={max} step={step} value={amount} aria-label="Paid into your pension a year"
        onChange={e => setAmount(+e.target.value)} style={{width:"100%",accentColor:G,margin:"4px 0 0"}}/>
      <div style={{fontSize:"11.5px",color:MUT,textAlign:"center",marginTop:"2px"}}>Slide to see any amount</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginTop:"12px"}}>
        <Cell label="Into your pension" text={signed(p.pension)} tone={p.pension > 0 ? "gain" : "plain"}/>
        {kids && <Cell label="Childcare back" text={p.childcare > 0 ? signed(p.childcare) : fmt(0)} tone={p.childcare > 0 ? "gain" : "plain"}/>}
        <Cell label="Take-home" text={signed(-p.takeHome)} tone={p.takeHome > 0 ? "cost" : "plain"}/>
        <Cell label={route === "sacrifice" ? "Tax and NI saved" : "Tax saved"} text={fmt(p.taxSaved)} wide={!kids}/>
      </div>
      {kids && !p.under && <p style={note}>The childcare support comes back once your income is at {K}.</p>}
      {p.overRoom && <p style={note}>That's more than the {fmt(t.aaRoom)} of annual allowance you have left this year, so the extra would be taxed.</p>}
      {route === "relief" && <p style={note}>With relief at source, the higher-rate relief is claimed through Self Assessment.</p>}
      {loanUnknown && (
        <button type="button" onClick={() => navigate("/app/module/studentLoan")}
          style={{width:"100%",display:"flex",alignItems:"center",gap:"10px",marginTop:"12px",background:"rgba(217,130,43,0.08)",border:"1px solid rgba(217,130,43,0.3)",borderRadius:"10px",padding:"10px 12px",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <span style={{flex:1,fontSize:"12.5px",color:TEXT,lineHeight:1.45}}>
            <b>Have a student loan?</b> Salary sacrifice lowers its repayments too, so adding your loan could show a bigger saving.
          </span>
          <ChevronRight size={16} color={MUT} style={{flexShrink:0}}/>
        </button>
      )}
      {amount > 0 && (() => {
        const beside = <Switch on={switched} label="I've set this up" onChange={setUp}/>;
        return route === "sacrifice"
          ? <MobileReminderAction id="taxtrap-salary-sacrifice" who="payroll" beside={beside}
              title={`Salary sacrifice: ${fmt(amount)} a year into your pension`}
              description={`Check payroll have set up salary sacrifice of ${fmt(amount / 12)} a month into your pension.`}
              email={salarySacrificeDraft({ name: d.name, perMonth: amount / 12, perYear: amount })}/>
          : <MobileReminderAction id="taxtrap-relief" beside={beside} title={`Pay ${fmt(amount)} into your pension before 5 April`}
              description={`Paying ${fmt(amount)} into your pension before 5 April brings your income back towards ${K}. Claim the higher-rate relief through Self Assessment.`}/>;
      })()}
      {amount > 0 && p.avoided > 0 && <p style={{...note,fontSize:"11.5px"}}>Switching on "I've set this up" counts {fmt(p.avoided)} a year as saved, at the amount set above.</p>}
      <button type="button" onClick={() => setWhy(w => !w)} aria-expanded={why}
        style={{display:"inline-flex",alignItems:"center",gap:"4px",marginTop:"12px",border:"none",borderRadius:"100px",padding:"6px 12px",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:CDARK,color:TEXT}}>
        Why?<ChevronDown size={13} style={{transform:why ? "rotate(180deg)" : "none",transition:"transform 0.15s"}}/>
      </button>
      {why && (
        <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"8px 0 0"}}>
          Contributing to a pension reduces your Adjusted Net Income (ANI) pound-for-pound, helping you avoid the {K} tax trap, where you lose your tax-free Personal Allowance and face an effective marginal tax rate of {trapTax}% ({trapTax + 2}% including National Insurance, and up to {trapTax + 11}% with a student loan).
        </p>
      )}
    </section>
  );
}

// An on/off switch with its label to the left: "I've set this up".
function Switch({ on, label, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onChange}
      style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0,background:"none",border:"none",padding:"4px 0",fontSize:"12.5px",fontWeight:700,color:on ? G : TEXT,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
      {label}
      <span aria-hidden="true" style={{position:"relative",width:"38px",height:"22px",borderRadius:"11px",background:on ? "#2f9461" : "rgba(22,47,36,0.2)",transition:"background 0.25s",flexShrink:0}}>
        <span style={{position:"absolute",top:"2px",left:on ? "18px" : "2px",width:"18px",height:"18px",borderRadius:"50%",background:WHITE,boxShadow:"0 1px 3px rgba(0,0,0,0.25)",transition:"left 0.25s cubic-bezier(0.4,0,0.2,1)"}}/>
      </span>
    </button>
  );
}

// Their marginal tax rate, and the chart of it at every income. Where they
// touch or point is shown in its parts; until then, where they are.
function RateTile({ d, m, t }) {
  const [ref, width] = useElementWidth(300);
  const points = rateCurve(d, m);
  const [at, setAt] = useState(null);
  const you = points.reduce((best, p) => Math.abs(p.income - t.ani) < Math.abs(best.income - t.ani) ? p : best, points[0]);
  // Where they are, as it is (not the chart's plain-salary figure).
  const shown = at || { ...t.rate, income: t.ani };
  // Beside the chart where there's room (a computer), below it on a phone.
  const side = width >= 420;
  const chartWidth = side ? Math.round(width * 0.75) : width;
  const pill = { display:"inline-flex", alignItems:"baseline", gap:"6px", background:CDARK, borderRadius:"100px", padding:"6px 10px", fontSize:"12px", color:TEXT, whiteSpace:"nowrap" };
  const pills = (
    <div style={{display:"flex",flexDirection:side ? "column" : "row",flexWrap:"wrap",gap:"6px",alignItems:side ? "stretch" : "center"}}>
      <div style={{fontSize:"11px",fontWeight:700,color:MUT,width:side ? "auto" : "100%"}}>At {fmt(Math.round(shown.income))}{at ? "" : ", you"}</div>
      <span style={pill}>Tax <b>{pct(shown.tax)}</b></span>
      {shown.ni > 0 && <span style={pill}>NI <b>{pct(shown.ni)}</b></span>}
      {shown.sl > 0 && <span style={pill}>Student loan <b>{pct(shown.sl)}</b></span>}
      <span style={{...pill,background:G,color:WHITE}}>Total <b>{pct(shown.rate)}</b></span>
    </div>
  );
  return (
    <section style={tile}>
      <div style={tileTitle}>Marginal tax rate by income</div>
      <div style={{display:"flex",alignItems:"baseline",gap:"8px",marginTop:"4px"}}>
        <span style={{fontFamily:SERIF,fontSize:"28px",fontWeight:700,color:G,lineHeight:1.1}}>{pct(t.rate.rate)}</span>
        <span style={{fontSize:"12.5px",color:TEXT,lineHeight:1.4}}>
          {t.over ? `yours: ${pence(t.rate.rate)} of every extra £1 you earn goes in ${lostTo(t.rate)}.` : `yours now. Past ${K} it's ${pct(t.trapRate)}.`}
        </span>
      </div>
      <div ref={ref} style={{display:"flex",flexDirection:side ? "row" : "column",gap:"12px",marginTop:"12px"}}>
        <RateChart points={points} you={you} at={at} onAt={setAt} width={chartWidth}/>
        <div style={{flex:1}}>{pills}</div>
      </div>
      <div style={{fontSize:"11.5px",color:MUT,marginTop:"8px"}}>The trap, {K} to {fmt(TRAP_END)}, in red. Touch the chart to see the rate at any income.</div>
    </section>
  );
}

// What being over £100k costs, or would, as a checklist: the allowance
// always; the childcare support ticked with children 11 or under, a warning
// when planning one, greyed without. Childcare goes if either parent's
// income is £1 over, each on their own: with children in view and a
// partner's not known, it asks. Over £100k, "See my options" (`options`)
// opens the ways back; then it minimises (`open`, `onToggle`) to its title
// and what's ticked, so the options lead.
function Costs({ d, t, set, options, open = true, onToggle }) {
  const cc = t.childcare;
  const parent = !!cc && !cc.planning;
  const england = !t.nation || t.nation === "england";
  const showHours = england && (parent ? cc.preschool > 0 : true);
  const lostRate = t.allowance.lost ? Math.round(t.allowance.tax / t.allowance.lost * 100) : 40;
  const kids = !cc ? "off" : cc.planning ? "warn" : "on";
  const kidsLine = !cc ? (kidsSituation(d) === "no" ? "Only for children under 12" : "For parents of children under 12")
    : cc.planning ? `Would stop once your child arrives, if either of you is over ${K}`
    : cc.state === "partner" ? `Already stopped: your partner's income is over ${K}`
    : t.over ? `Stopped: your income is over ${K}` : `Stops if either parent goes over ${K}`;
  const askPartner = !!cc && !d.partnerOver100k && !!set;
  const nationNote = t.nation === "scotland" ? "Scotland's funded hours have no income limit, so they aren't affected."
    : t.nation === "wales" ? "Wales's Childcare Offer is tested on gross income, so it isn't counted here." : null;
  const answer = v => { set("partnerOver100k", v); if (v === "single") set("cbHigherEarner", "yes"); };
  const title = t.over ? "What it costs you" : `What passing ${K} would cost you`;
  // Minimised: what's ticked, in a line.
  const ticked = ["Tax-free allowance", kids === "on" && showHours && "30 funded hours", kids === "on" && "Tax-Free Childcare"].filter(Boolean).join(", ");
  return (
    <section style={tile}>
      {onToggle ? (
        <button type="button" onClick={onToggle} aria-expanded={open}
          style={{width:"100%",display:"flex",alignItems:"flex-start",gap:"10px",background:"none",border:"none",padding:0,textAlign:"left",fontFamily:"inherit",cursor:"pointer"}}>
          <span style={{flex:1}}>
            <span style={{...tileTitle,display:"block"}}>{title}</span>
            {!open && <span style={{display:"block",fontSize:"12.5px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>{ticked}</span>}
          </span>
          <ChevronDown size={18} color={MUT} aria-label={open ? "Minimise" : "Expand"} style={{flexShrink:0,marginTop:"1px",transform:open ? "rotate(180deg)" : "none",transition:"transform 0.15s"}}/>
        </button>
      ) : <div style={tileTitle}>{title}</div>}
      {open && <>
      <CheckRow state="on" topic="Tax-free allowance" line={t.over ? `${fmt(t.allowance.lost)} of your ${fmt(PERSONAL_ALLOWANCE)} lost` : `50p lost for every £1 over ${K}`}
        value={t.over ? fmt(t.allowance.tax) : `${lostRate / 2}p per £1`}/>
      {showHours && <CheckRow state={kids} topic="30 funded hours" line={kidsLine} value={fmt(parent ? cc.hours : FUNDED_HOURS_VALUE)}/>}
      <CheckRow state={kids} topic="Tax-Free Childcare" line={kidsLine} value={fmt(parent ? cc.tfc : TFC_CAP_PER_CHILD)}/>
      {nationNote && kids !== "off" && <p style={note}>{nationNote}</p>}
      {askPartner && (
        <div style={{marginTop:"12px",background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"10px 12px"}}>
          <div style={{fontSize:"13px",fontWeight:700,color:TEXT}}>Is your partner's income over £100,000?</div>
          <div style={{fontSize:"12px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>Either parent over £100,000 stops this childcare support for both of you.</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginTop:"8px"}}>
            {[["no", "No"], ["yes", "Yes"], ["single", "I don't have a partner"]].map(([v, label]) => (
              <button key={v} type="button" onClick={() => answer(v)}
                style={{border:"1px solid rgba(22,47,36,0.15)",borderRadius:"100px",padding:"6px 12px",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:WHITE,color:TEXT}}>{label}</button>
            ))}
          </div>
        </div>
      )}
      {!t.over && (
        <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"12px 0 0"}}>A rise or bonus that would take you over can go into your pension by salary sacrifice instead.</p>
      )}
      {options && (
        <button type="button" onClick={options}
          style={{width:"100%",marginTop:"14px",background:CTA_BLUE,color:WHITE,border:"none",borderRadius:"12px",padding:"13px",fontSize:"14.5px",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(0,113,227,0.28)"}}>
          See my options
        </button>
      )}
      </>}
    </section>
  );
}

// One cost as a checklist row: ticked where it applies to them, a warning
// where it would (a child on the way), an empty box where not. Its £ is
// grey unless it applies now (no children yet), its name too where not.
function CheckRow({ state, topic, line, value }) {
  const box = { width:"18px", height:"18px", borderRadius:"5px", flexShrink:0, display:"inline-flex", alignItems:"center", justifyContent:"center" };
  return (
    <div style={{display:"flex",alignItems:"center",gap:"10px",borderTop:"1px solid rgba(22,47,36,0.08)",marginTop:"10px",paddingTop:"10px"}}>
      {state === "on" ? <span role="img" aria-label="Applies to you" style={{...box,background:G}}><Check size={12} strokeWidth={3.2} color={WHITE}/></span>
        : state === "warn" ? <TriangleAlert size={18} strokeWidth={2.2} color={WARNING} role="img" aria-label="Would apply" style={{flexShrink:0}}/>
        : <span role="img" aria-label="Doesn't apply" style={{...box,border:"1.5px solid rgba(22,47,36,0.3)"}}/>}
      <span style={{flex:1,minWidth:0}}>
        <span style={{display:"block",fontSize:"14px",fontWeight:700,color:state === "off" ? MUT : TEXT}}>{topic}</span>
        <span style={{display:"block",fontSize:"12.5px",color:MUT,marginTop:"2px"}}>{line}</span>
      </span>
      <span style={{fontFamily:SERIF,fontSize:"18px",fontWeight:700,color:state === "on" ? G : MUT,whiteSpace:"nowrap"}}>{value}</span>
    </div>
  );
}

// Other options: each way back to £100k a card in a white wallet
// (CardStack.jsx), in a set order: the pension, a 4-day week, Gift Aid,
// then other salary sacrifice. Each card's top line is what it brings; in
// front, what it takes, then what it brings (green) and what it costs (red).
// The tile minimises to its title.
const ORDER = ["pension", "fourDay", "giftAid", "sacrifice"];
function Options({ t }) {
  const [open, setOpen] = useState(true);
  const ways = ORDER.map(k => t.options.find(o => o.key === k)).filter(Boolean).map(o => ({ ...o, ...WAY[o.key](o, t) }));
  const cards = ways.map(w => ({
    key: w.key, label: w.option, amount: w.top,
    body: () => (
      <>
        <div style={{fontSize:"13px",color:TEXT,lineHeight:1.45,marginTop:"8px"}}>{w.needed}</div>
        {/* Two to a row; an odd last one across both. */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginTop:"10px"}}>
          {w.outcome.map((c, i) => (
            <Cell key={c.label} label={c.label} text={c.text ?? signed(c.value)} tone={c.tone ?? toneOf(c.value)}
              wide={i === w.outcome.length - 1 && w.outcome.length % 2 === 1}/>
          ))}
        </div>
      </>
    ),
  }));
  return (
    <section style={tile}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{width:"100%",display:"flex",alignItems:"flex-start",gap:"10px",background:"none",border:"none",padding:0,textAlign:"left",fontFamily:"inherit",cursor:"pointer"}}>
        <span style={{flex:1}}>
          <span style={{...tileTitle,display:"block"}}>Other options</span>
          <span style={{display:"block",fontSize:"12.5px",color:MUT,lineHeight:1.45,marginTop:"2px"}}>Common ways to bring your income back to {K}, and what each would mean for you a year.</span>
        </span>
        <ChevronDown size={18} color={MUT} aria-label={open ? "Minimise" : "Expand"} style={{flexShrink:0,marginTop:"1px",transform:open ? "rotate(180deg)" : "none",transition:"transform 0.15s"}}/>
      </button>
      {open && <div style={{marginTop:"12px"}}><CardStack light cards={cards} peek={40} turnLabels={["Show the previous option", "Show the next option"]}/></div>}
    </section>
  );
}

// Each way: its name, the top line its card shows behind (what it brings),
// what it takes, and its outcome a year (taxTrap.js options): what it
// brings first (pension, days off, the charity's, with children the
// childcare back), then what it costs in take-home.
const share = s => `${Math.round(s * 1000) / 10}% of salary`;
const childcareChip = o => o.childcare > 0 ? [{ label: "Childcare back", value: o.childcare }] : [];
const takeHome = (o, label = "Take-home") => ({ label, value: -o.takeHome });
const WAY = {
  pension: (o, t) => ({
    option: o.route === "sacrifice" ? "Salary sacrifice" : "Pension contributions",
    top: `+${fmt(o.pension)}`,
    needed: `Add ${fmt(o.amount)} to your pension (${share(o.share)}) by ${o.route === "sacrifice" ? "salary sacrifice" : "relief at source"}${o.fits ? "" : `: more than the ${fmt(t.aaRoom)} allowance left this year`}.`,
    outcome: [{ label: "Into your pension", value: o.pension }, ...childcareChip(o), takeHome(o)],
  }),
  fourDay: o => ({
    option: "Reduced hours",
    top: `+${o.daysOff} days off`,
    needed: `Work a 4-day week: ${fmt(o.gross)} less salary${o.under ? "" : `, still over ${K}`}.`,
    outcome: [{ label: "Days off a year", value: o.daysOff, text: `+${o.daysOff}` }, ...childcareChip(o), takeHome(o)],
  }),
  giftAid: o => ({
    option: "Charitable donations",
    top: `+${fmt(o.charity)}`,
    needed: `Give ${fmt(o.given)} with Gift Aid: the charity gets ${fmt(o.charity)}.`,
    outcome: [{ label: "Charity gets", value: o.charity }, ...childcareChip(o), takeHome(o, "Cost to you")],
  }),
  sacrifice: o => ({
    option: "Other salary sacrifice",
    top: "Car or bike",
    needed: `Swap ${fmt(o.amount)} of salary (${share(o.share)}) for an electric car or cycle to work.`,
    outcome: [{ label: "You get", text: "Car or bike", tone: "gain" }, ...childcareChip(o), takeHome(o)],
  }),
};

// The marginal tax rate at every income from £0 to £130,000, the trap in
// red, where they are dashed, and where they've touched or pointed solid.
function RateChart({ points, you, at, onAt, width }) {
  if (!points.length || !width) return null;
  const VW = width, VH = 180, PL = 34, PR = 8, PT = 16, PB = 22;
  const from = points[0].income, to = points[points.length - 1].income;
  const maxRate = Math.max(0.85, ...points.map(p => p.rate));
  const sx = x => PL + (x - from) / (to - from) * (VW - PL - PR);
  const sy = r => PT + (1 - r / maxRate) * (VH - PT - PB);
  const line = pts => pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.income).toFixed(1)},${sy(p.rate).toFixed(1)}`).join(" ");
  const trap = points.filter(p => p.income >= TRAP_START && p.income <= TRAP_END);
  const label = { fontSize:"10px", fill:MUT, fontFamily:"inherit" };
  // The point under the pointer or finger.
  const pick = e => {
    const box = e.currentTarget.getBoundingClientRect();
    const income = from + (e.clientX - box.left - PL) / (VW - PL - PR) * (to - from);
    const p = points.reduce((best, q) => Math.abs(q.income - income) < Math.abs(best.income - income) ? q : best, points[0]);
    onAt(p);
  };
  const youX = sx(you.income);
  return (
    <svg width={VW} height={VH} role="img" aria-label="Marginal tax rate at each income, from £0 to £130,000, with the £100k trap in red"
      onPointerDown={pick} onPointerMove={e => (e.buttons || e.pointerType === "mouse") && pick(e)} style={{touchAction:"pan-y",cursor:"crosshair",flexShrink:0}}>
      <rect x={sx(TRAP_START)} y={PT} width={sx(TRAP_END) - sx(TRAP_START)} height={VH - PT - PB} fill={CRITICAL} opacity="0.1"/>
      {[0.2, 0.4, 0.6, 0.8].map(r => (
        <g key={r}>
          <line x1={PL} x2={VW - PR} y1={sy(r)} y2={sy(r)} stroke="rgba(22,47,36,0.08)"/>
          <text x={PL - 6} y={sy(r) + 3} textAnchor="end" style={label}>{Math.round(r * 100)}%</text>
        </g>
      ))}
      <path d={line(points)} fill="none" stroke={G} strokeWidth="2.2" strokeLinejoin="round"/>
      {trap.length > 1 && <path d={line(trap)} fill="none" stroke={CRITICAL} strokeWidth="2.6" strokeLinejoin="round"/>}
      <line x1={youX} x2={youX} y1={PT} y2={VH - PB} stroke={G} strokeDasharray="3 3"/>
      <text x={youX} y={PT - 4} textAnchor={youX > VW - 40 ? "end" : "middle"} style={{...label,fill:G,fontWeight:700}}>You</text>
      {at && (
        <g>
          <line x1={sx(at.income)} x2={sx(at.income)} y1={PT} y2={VH - PB} stroke={TEXT} strokeWidth="1"/>
          <circle cx={sx(at.income)} cy={sy(at.rate)} r="4" fill={WHITE} stroke={TEXT} strokeWidth="1.5"/>
        </g>
      )}
      {[0, 50000, TRAP_START, TRAP_END].map(x => (
        <text key={x} x={sx(x)} y={VH - 6} textAnchor={x === 0 ? "start" : "middle"} style={label}>£{Math.round(x / 1000)}k{x === TRAP_END ? "+" : ""}</text>
      ))}
    </svg>
  );
}
