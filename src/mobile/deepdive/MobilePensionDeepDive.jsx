import { useEffect, useState } from "react";
import { GROWTH_NOMINAL_PCT, INFLATION_PCT } from "../../lib/growth.js";
import { pensionReveal } from "../../lib/moduleReveal.js";
import { pensionOutlook, cliffEdge, retirementAdequacy } from "../../lib/crossModule.js";
import { choiceFor, CHOICE_IDS } from "../../lib/opportunityChoices.js";
import OpportunityChoice from "../OpportunityChoice.jsx";
import { AlertTriangle, Check, ChevronRight, Bell, BellRing, Mail, Info, Pencil, Gift, History, HandCoins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  isPensionContributing,
  calcAnnualAllowanceTaper, calcBonusSacrificePotential,
  calcCarryForward, defaultCarryForwardYears, calcBonusSacrifice, calcPensionGrowthTrajectory,
  missedPensionRelief, calcTaxFreeCash, inRetirement, LUMP_SUM_ALLOWANCE, LSA_INFLECTION_POT, MONEY_PURCHASE_ANNUAL_ALLOWANCE,
  sacrificeNiRate, minimumPensionAge,
} from "../../lib/pension.js";
import { bestDrawdown, defaultDrawdownYears } from "../../lib/drawdown.js";
import { taxYearFor } from "../../lib/taxYear.js";
import { taxTrap, thisTaxYear } from "../../lib/taxTrap.js";
import { capField } from "../../lib/onboarding.js";
import { fmt, fmtCompact, fmtBig } from "../../lib/format.js";
import { PillSlider } from "../PillSlider.jsx";
import { getModuleProducts } from "../moduleProducts.js";
import MobileTile, { TileRow, RowText, ROW, withIcon, Nested } from "../MobileTile.jsx";
import MobileProductListTile from "../MobileProductListTile.jsx";
import MobileDrawdown from "./MobileDrawdown.jsx";
import { EMPLOYER_NI_RATE } from "../../lib/tax.js";
import { ADVISER_LINK } from "../GuidanceNote.jsx";
import InfoButton from "../InfoButton.jsx";
import PillMoneyInput from "../PillMoneyInput.jsx";
import { buildReminderSubject } from "../reminders.js";
import { useReminder } from "../MobileReminderAction.jsx";
import { firstName } from "../copy.js";
import { pensionMatchDraft, bonusSacrificeDraft, buildMailtoUrl } from "../emailDrafts.js";
import { G, GOLD, WHITE, MUT, TEXT, SERIF, CARD, CDARK, SUCCESS, CRITICAL, MUT_ON_CDARK, NOTICE_LABEL } from "../../design-tokens.js";
import OpportunityTile from "./OpportunityTile.jsx";
import { EXTRA_COLOR, PayInMore, CliffEdge, LookingAhead } from "./PensionLookingAhead.jsx";

const SACRIFICE_OPTIONS = [0,25,50,75,100].map(p => ({ value:p, label:`${p}%` }));
const EXTRA_PCT_OPTIONS = [0,1,2,3,5].map(p => ({ value:p, label:p ? `+${p}%` : "0%" }));

// A breakdown's lines, inside one row.
const rowStyle = { display:"flex", justifyContent:"space-between", gap:"12px", fontSize:"13px", color:TEXT, padding:"4px 0" };
const priorityTag = <span style={{fontSize:"11px",fontWeight:700,color:CRITICAL,background:`${CRITICAL}18`,padding:"2px 8px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase"}}>Priority</span>;

// Full mobile version of desktop's Pension deep dive (ModuleDeepDive,
// moduleKey==="pension" — CandidApp.jsx), as MobileTiles (rows on the tile,
// actions in its menu): growth to retirement, the employer match, drawing
// the pension, the what-ifs (a bonus, past years' allowance, salary
// sacrifice, one open at a time under its row), looking ahead, and the
// providers. The growth chart is vertical columns sized for a narrow screen.
function YearToggle({ value, onChange }) {
  return (
    <div style={{display:"flex",gap:"6px"}}>
      {[{v:true,label:"Had a scheme"},{v:false,label:"No scheme"}].map(opt => (
        <button key={String(opt.v)} type="button" aria-pressed={value===opt.v} onClick={() => onChange(opt.v)} className="tap44" style={{
          border:"none",borderRadius:"100px",padding:"6px 12px",fontSize:"11.5px",fontWeight:600,cursor:"pointer",
          background:value===opt.v?G:CDARK,color:value===opt.v?WHITE:MUT_ON_CDARK,
        }}>{opt.label}</button>
      ))}
    </div>
  );
}

// The actual "acted on this" control — distinct from "Mark as reviewed"
// (MobileModuleDeepDive's footer button, which only tracks that you've read
// the advice). Pre-filled with the suggested contribution %, editable in case
// they only want to close part of the gap. Submitting writes the real value
// into `d` via `set`, which is what makes the Candid score move: it's a pure
// function of `statuses`, which recomputes the instant `d` changes — no
// regenerate, no API call, no waiting.
function QuickUpdateContribution({ d, myPct, suggested, set }) {
  const [draft, setDraft] = useState(suggested);
  const applied = draft != null && myPct > 0 && String(draft) === String(myPct);
  return (
    <TileRow align>
      <div style={{...NOTICE_LABEL,marginBottom:"8px"}}>Acted on this?</div>
      <div style={{display:"flex",gap:"8px",alignItems:"flex-end"}}>
        <PillMoneyInput label="New contribution" unit="%" value={draft} onChange={setDraft}/>
        <button type="button" disabled={applied || draft == null}
          onClick={() => {
            set("myContribution", capField("myContribution", String(draft)));
            if (d.hasPension !== "yes") set("hasPension", "yes");
          }}
          style={{
            background: applied ? MUT : G, color:WHITE, border:"none", borderRadius:"100px",
            padding:"11px 18px", fontSize:"13px", fontWeight:700, cursor: applied ? "default" : "pointer",
            whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:"5px",
          }}>
          {applied ? <><Check size={13}/> Updated</> : "Update"}
        </button>
      </div>
      {applied && <p style={{fontSize:"11px",color:SUCCESS,marginTop:"6px",lineHeight:1.5}}>Saved — your Candid score now reflects this.</p>}
    </TileRow>
  );
}

// A tile's visible actions: open the drafted email to HR, and add a
// calendar reminder (with the draft in it). Two rows, as a page can hand
// off to the phone only once per tap.
function ReminderRows({ reminder, email }) {
  const [emailOpened, setEmailOpened] = useState(false);
  return (
    <>
      {email && (
        <TileRow align onClick={() => { setEmailOpened(true); window.location.href = buildMailtoUrl(email); }}>
          <span style={ROW.action}>{emailOpened ? <Check size={18} aria-hidden="true"/> : <Mail size={18} aria-hidden="true"/>}{emailOpened ? "Email draft opened" : "Draft an email to HR"}</span>
        </TileRow>
      )}
      <TileRow align onClick={reminder.isSet ? undefined : reminder.setReminder}>
        <span style={ROW.action}>
          {reminder.isSet ? <BellRing size={18} aria-hidden="true"/> : <Bell size={18} aria-hidden="true"/>}
          {reminder.isSet ? `Reminder set for ${reminder.dateLabel}` : `Remind me on ${reminder.dateLabel}`}
        </span>
      </TileRow>
    </>
  );
}

export default function MobilePensionDeepDive({ d, m, set, onEditInputs }) {
  const navigate = useNavigate();
  // From the £100k module, past the annual allowance: straight to carry forward.
  const toCarryForward = typeof window !== "undefined" && window.location.hash === "#carry-forward";
  useEffect(() => {
    if (!toCarryForward) return;
    const timer = setTimeout(() => document.getElementById("carry-forward")?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    return () => clearTimeout(timer);
  }, [toCarryForward]);
  const [cfYears, setCfYears] = useState(defaultCarryForwardYears());
  const [bonusInput, setBonusInput] = useState(+d.bonusAmount || null);
  const [sacrificePct, setSacrificePct] = useState(100);
  const [extraPct, setExtraPct] = useState(0);
  const [showFVInfo, setShowFVInfo] = useState(false);
  // Each tile's explanation, from its menu.
  const [notes, setNotes] = useState({});
  const toggleNote = k => setNotes(n => ({ ...n, [k]: !n[k] }));
  // The what-if open under its row in What ifs: one at a time.
  const [whatIf, setWhatIf] = useState(toCarryForward ? "carryForward" : null);
  const toggleWhatIf = k => setWhatIf(w => w === k ? null : k);

  const editItem = onEditInputs && { icon: Pencil, label: "Edit my figures", onClick: onEditInputs };
  const howItem = (k, label = "How this is worked out") => ({ icon: Info, label: notes[k] ? "Hide the explanation" : label, onClick: () => toggleNote(k) });
  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Not sure, or a final salary scheme: the answer's own steps, since
  // there's no pot to chart (moduleReveal.js pensionReveal).
  if (m.pensionStatus === "unknown" || (d.pensionKind === "db" && !inRetirement(d))) {
    const steps = pensionReveal(d, m) || [];
    return (
      <MobileTile title="Your pension" menu={[editItem]}>
        {steps.map((s, i) => (
          <TileRow key={i} first={i === 0} align>
            <RowText label={s.label} figure={s.figure}/>
            <p style={{...ROW.text,marginTop:"4px"}}>{s.title}</p>
            {s.body && <p style={ROW.note}>{s.body}</p>}
          </TileRow>
        ))}
      </MobileTile>
    );
  }

  const contributing = isPensionContributing(d);
  // Not paying in is a gap only with earnings to pay in from (see
  // computeModuleStatuses): retired, there's no relief to miss.
  const missedRelief = missedPensionRelief(d, m);
  const notPayingIn = !contributing && missedRelief > 0;
  const taxFreeCash = calcTaxFreeCash(d);
  const retired = inRetirement(d);
  const trPct = Math.round(m.tr * 100);
  const showMatchWin = notPayingIn || (contributing && m.missedMatch > 0);

  // Over £100,000: the £100k tax trap module's own figures, on this tax year
  // as it has them (taxTrap.js, moduleStatus.js), so the two always agree.
  const trapYear = thisTaxYear(d, m);
  const trap = taxTrap(trapYear.d, trapYear.m);
  const trapRatePct = trap ? `${Math.round(trap.rate.rate * 1000) / 10}%` : null;
  // The £80k-£100k zone, on the same year's income as the trap tile, so the
  // screen never shows both; over £100k the trap tile has it.
  const trapAni = trap ? trap.ani : m.adjustedNetIncome;
  const showSacrifice = !trap?.over && trapAni >= 80000 && trapAni <= 100000;
  const belowTrap = trap ? trap.headroom : Math.max(0, Math.round(100000 - trapAni));

  const aa = calcAnnualAllowanceTaper(d, m);
  const cf = calcCarryForward(d, m, aa.approxAA, cfYears);

  const hasStatedBonus = (+d.bonusAmount||0) > 0;
  const bonusSacrifice = calcBonusSacrificePotential(d, m);
  // Done or set aside this tax year (opportunityChoices.js).
  const bonusChoice = choiceFor(d, CHOICE_IDS.bonus);
  // Short of the retirement income they'd like: the same 5% margin as the
  // module's status (computeModuleStatuses).
  const adequacy = retirementAdequacy(d, m);
  const showRetirementGap = !!adequacy && adequacy.gap > adequacy.target * 0.05;

  const products = getModuleProducts("pension", d, m);

  const opportunityCols = [];
  if (notPayingIn) opportunityCols.push({ label:"Tax relief you're missing", value: fmtCompact(missedRelief) });
  else if (contributing && m.missedMatch > 0) opportunityCols.push({ label:"Employer match you're not getting", value: fmtCompact(m.missedMatch) });

  // Drawdown planning: from the minimum pension age (55, 57 from April
  // 2028), or once retired, for anyone with a pot.
  const showDrawdown = d.hasPension === "yes" && taxFreeCash.pot > 0 && (retired || (+d.age || 0) >= minimumPensionAge(taxYearFor(d)));
  const drawdownBest = showDrawdown ? bestDrawdown(d, m, defaultDrawdownYears(d)) : null;
  // The what-ifs: growth to retirement, past years' allowance, the bonus.
  // Not for someone retired with no earnings.
  const showExplore = !(retired && !(m.salary > 0));
  const traj = calcPensionGrowthTrajectory(d, m, extraPct);
  const showChart = showExplore && traj.showTrajectory;

  // Looking ahead: what the pension's path, with salary growth, means for
  // tax later on (src/lib/crossModule.js), leading on to Investments.
  const outlook = pensionOutlook(d, m);
  const showAhead = !!outlook?.flags.length;
  // The pot passing the tax-free cash limit, flagged under the chart.
  const cliff = cliffEdge(outlook, m);
  const showProviders = !!products.products?.length;

  // The money purchase annual allowance note: in What ifs, or with drawing
  // the pension when there are no what-ifs.
  const mpaa = d.pensionAccess === "income";
  const mpaaText = <p style={ROW.text}>Having drawn an income, up to {fmt(MONEY_PURCHASE_ANNUAL_ALLOWANCE)} a year can go into your pensions with tax relief: the Money Purchase Annual Allowance. Employer payments count towards it.</p>;
  const mpaaRow = <TileRow align>{mpaaText}</TileRow>;

  // Tax-free cash explained, from the menu of the tile it's in.
  const taxFreeCashText = (taxFreeCash.taken > 0
    ? `Of your ${fmt(taxFreeCash.allowance)} limit, ${fmt(taxFreeCash.taken)} has been taken. ${taxFreeCash.capped ? `25% of the part you haven't touched would be about ${fmt(taxFreeCash.quarter)}, so the limit decides it.` : `25% of the part you haven't touched is about ${fmt(taxFreeCash.quarter)}.`} The rest is taxed as income when it's taken out.`
    : taxFreeCash.capped
    ? `25% of your pot would be ${fmtBig(taxFreeCash.quarter)}, but tax-free cash stops at ${fmtBig(taxFreeCash.allowance)}${taxFreeCash.allowance === LUMP_SUM_ALLOWANCE ? `, the Lump Sum Allowance, for any pot above ${fmtBig(LSA_INFLECTION_POT)}` : ", your protected limit"}. The other ${fmtBig(taxFreeCash.overCap)} is taxed as income when it's taken out.`
    : `Up to 25% of your pot can be taken tax-free, to a limit of ${fmt(taxFreeCash.allowance)}. The rest is taxed as income when it's taken out.`)
    + (!d.pensionProtection && taxFreeCash.capped ? " A Fixed or Individual Protection from 2012 to 2016 allows more, up to £450,000." : "");
  const taxFreeRows = (first) => (
    <>
      <TileRow first={first} align>
        <RowText label={`Tax-free cash${taxFreeCash.taken > 0 ? " left" : ""}`} figure={fmt(taxFreeCash.taxFree)}/>
      </TileRow>
      {notes.taxFree && <TileRow><p style={ROW.text}>{taxFreeCashText}</p></TileRow>}
    </>
  );

  // What ifs: each row's figure, and its calculator opened under it.
  const bonusPotential = bonusSacrifice.standalone;
  const bonusRow = {
    figure: hasStatedBonus && bonusSacrifice.room > 0 && bonusPotential > 0 ? fmt(bonusPotential) : null,
    note: !hasStatedBonus ? "No tax or NI on a bonus paid in by salary sacrifice"
      : bonusSacrifice.room <= 0 ? "No pension allowance left this year"
      : bonusSacrifice.standaloneSacrifice < bonusSacrifice.bonus ? `Tax and NI it could save, on the ${fmt(bonusSacrifice.standaloneSacrifice)} your allowance has room for`
      : `Tax and NI it could save on your ${fmt(bonusSacrifice.bonus)} bonus`,
  };

  return (
    <div>
      {opportunityCols.length > 0 && (
        <OpportunityTile figures={opportunityCols}
          chips={[bonusSacrifice.beyondTaper > 0 && !bonusChoice && `Up to ${fmt(bonusSacrifice.beyondTaper)} more from sacrificing a bonus`]}
          action={{ label: "See how", onClick: () => scrollTo("pension-match") }}/>
      )}

      {/* The hero: how the pot could grow to retirement, and any gap to the
          income they'd like under it. */}
      {(showChart || showRetirementGap) && (
        <MobileTile id="pension-growth" title={showChart ? "Growth to retirement" : "Retirement income"}
          menu={[showChart && howItem("growth"), editItem]}>
          {showChart && <GrowthChart traj={traj} d={d} m={m} extraPct={extraPct}/>}
          {showChart && notes.growth && (
            <TileRow>
              <p style={ROW.text}>In today's money: growth of {GROWTH_NOMINAL_PCT}% a year, less {INFLATION_PCT}% inflation, over {traj.years} year{traj.years!==1?"s":""} to age {traj.retireAge}.</p>
            </TileRow>
          )}
          {showRetirementGap && (
            <>
              <TileRow first={!showChart} align>
                <RowText label="Short of the income you'd like" figure={`${fmt(adequacy.gap)}/yr`}
                  note={`About ${fmt(adequacy.net)} a year after tax, from your pension and a full State Pension, against the ${fmt(adequacy.target)} you'd like, in today's money`}/>
              </TileRow>
              {set && <TileRow align style={{paddingBottom:0}}><OpportunityChoice id={CHOICE_IDS.retirementGap} d={d} set={set}/></TileRow>}
            </>
          )}
          {showChart && +d.niYears > 0 && (
            <TileRow align>
              <RowText label="State Pension estimate" note="From your recorded National Insurance years" figure={`${fmt(m.statePensionAnnual)}/yr`}/>
            </TileRow>
          )}
          {/* Paying in more, as what it costs against what it adds, rather
              than another bar, so the chart shows the pension as it stands. */}
          {showChart && (
            <TileRow align>
              <div style={{...NOTICE_LABEL,marginBottom:"8px"}}>What if you paid in more?</div>
              <PillSlider compact label="What if you paid in more?" value={extraPct} onChange={setExtraPct} options={EXTRA_PCT_OPTIONS}/>
              <PayInMore traj={traj} tr={m.tr || 0}/>
            </TileRow>
          )}
          {showChart && cliff && <CliffEdge cliff={cliff} onSeeMore={() => scrollTo("looking-ahead")}/>}
        </MobileTile>
      )}

      {/* Over £100,000: paying in is one way out of the trap, so it sits
          under the growth tile, closed, leading on to the £100k tax trap
          module. */}
      {trap?.over && <TrapTile trap={trap} ratePct={trapRatePct} onOpenModule={() => navigate("/app/module/taxTrap")}/>}

      {showMatchWin && (
        <EmployerMatchTile m={m} d={d} trPct={trPct} contributing={contributing} set={set} taxFreeCash={taxFreeCash} editItem={editItem}/>
      )}

      {/* Tax-free cash on its own: a pot capped by the Lump Sum Allowance,
          before drawdown planning applies. */}
      {d.hasPension === "yes" && taxFreeCash.pot > 0 && taxFreeCash.capped && !drawdownBest && (
        <MobileTile title="Tax-free cash" menu={[howItem("taxFree", "How tax-free cash works"), editItem]}>
          {taxFreeRows(true)}
        </MobileTile>
      )}

      {drawdownBest && (
        <MobileTile id="pension-drawdown" title="Drawing your pension" menu={[howItem("taxFree", "How tax-free cash works"), editItem]}>
          <TileRow first align>
            <RowText label="Pension pot" figure={fmt(taxFreeCash.pot)}/>
          </TileRow>
          {taxFreeRows(false)}
          <TileRow><MobileDrawdown d={d} m={m} bare/></TileRow>
          {mpaa && !showExplore && mpaaRow}
        </MobileTile>
      )}
      {mpaa && !showExplore && !drawdownBest && (
        <MobileTile title="Paying in after drawing" menu={[editItem]}>
          {mpaaRow}
        </MobileTile>
      )}

      {/* The what-ifs: a row each with its figure, its calculator opening
          under it, one at a time. Retired with no earnings, they don't apply. */}
      {showExplore && (
        <MobileTile id="pension-whatifs" title="What ifs" subtitle="Calculators, worked out on your figures" menu={[editItem]}>
          <TileRow onClick={() => toggleWhatIf("bonus")} expanded={whatIf === "bonus"}>
            {withIcon(Gift, <RowText label={hasStatedBonus ? "Your bonus into your pension" : "A bonus into your pension"} note={bonusRow.note} figure={bonusRow.figure} figureStyle={{color:SUCCESS}}/>)}
          </TileRow>
          {whatIf === "bonus" && (
            <Nested><BonusCalc hasStatedBonus={hasStatedBonus} bonusPotential={bonusPotential} d={d} set={set} sacrificePct={sacrificePct} setSacrificePct={setSacrificePct} bonusInput={bonusInput} setBonusInput={setBonusInput} setShowFVInfo={setShowFVInfo} showFVInfo={showFVInfo} m={m} onEditInputs={onEditInputs}/></Nested>
          )}

          {aa.inAATaper && (
            <TileRow align>
              {withIcon(Info, <>
                <p style={{...ROW.text,fontWeight:600}}>Your Annual Allowance may be reduced to about {fmt(aa.approxAA)} this tax year, from £60,000.</p>
                <p style={ROW.note}>
                  Once adjusted income passes £260,000, your allowance shrinks £1 for every £2 above that, down to a £10,000 floor.{" "}
                  {cf.showCarryForward
                    ? "Unused allowance from the last 3 tax years can be carried forward, so more can go in without a charge."
                    : "Unused allowance from the last 3 tax years can be carried forward to pay in more without a charge: your provider's statements or HMRC account have the exact figures."}
                </p>
              </>, true)}
            </TileRow>
          )}
          {mpaa && <TileRow align>{withIcon(Info, mpaaText, true)}</TileRow>}

          {cf.showCarryForward && (
            <TileRow id="carry-forward" onClick={() => toggleWhatIf("carryForward")} expanded={whatIf === "carryForward"}>
              {withIcon(History, <RowText label="Past years' allowance" figure={cf.cfTotalUnused > 0 && fmt(cf.cfMaxContributable)}
                note={cf.cfTotalUnused > 0 ? "Could go into your pension this tax year, using carry forward" : "Fill in your last 3 tax years to see what could go in"}/>)}
            </TileRow>
          )}
          {cf.showCarryForward && whatIf === "carryForward" && <Nested><CarryForwardCalc cf={cf} setCfYears={setCfYears} aa={aa}/></Nested>}

          {showSacrifice && (
            <TileRow onClick={() => toggleWhatIf("sacrifice")} expanded={whatIf === "sacrifice"}>
              {withIcon(HandCoins, <RowText label="Salary sacrifice" note="Below the £100,000 taper" figure={fmt(belowTrap)}/>)}
            </TileRow>
          )}
          {showSacrifice && whatIf === "sacrifice" && <Nested><SacrificeCalc d={d} m={m} trPct={trPct} extraPct={extraPct} setExtraPct={setExtraPct} chartSlider={showChart}/></Nested>}
        </MobileTile>
      )}

      {showAhead && <LookingAhead d={d} outlook={outlook} cliff={cliff} menu={[editItem]}/>}

      {/* Places to look, not steps: a row per provider. */}
      {showProviders && (
        <MobileTile id="pension-providers" title="Pension providers" subtitle="Yearly charges, listed alphabetically" menu={[howItem("providers", "About this list"), editItem]}>
          <MobileProductListTile embedded flush noun="providers" products={products.products}/>
          {notes.providers && products.disclaimer && (
            <TileRow><p style={{...ROW.note,marginTop:0}}>{products.disclaimer}</p></TileRow>
          )}
        </MobileTile>
      )}
    </div>
  );
}

// The £100k tax trap, from the pension's side: a pale red tile, closed at
// first to its alert and what the trap costs; opened, the figures behind it
// (taxTrap.js, as the £100k module has them). Its last row leads to that
// module, open or closed.
function TrapTile({ trap, ratePct, onOpenModule }) {
  const [open, setOpen] = useState(false);
  const red = trap.amount > 0;
  return (
    <section id="pension-trap" style={{...CARD,background:red ? "#fdf0ee" : WHITE,border:`1.5px solid ${red ? "rgba(192,57,43,0.28)" : "rgba(22,47,36,0.08)"}`,paddingLeft:"16px",marginBottom:"12px",scrollMarginTop:"80px"}}>
      <h2 style={{margin:0,fontSize:"inherit",fontWeight:"inherit"}}>
        <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
          style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",padding:"14px 16px 12px 0",background:"none",border:"none",textAlign:"left",font:"inherit",color:"inherit",cursor:"pointer"}}>
          {/* As a What ifs row: the label and its note, the icon in line
              with the label (the size of the cliff-edge row's above it). */}
          <span style={{display:"block",flex:1,minWidth:0}}>
            <span style={{display:"flex",alignItems:"center",gap:"8px",...ROW.label,fontWeight:600,color:CRITICAL}}>
              <AlertTriangle size={18} color={CRITICAL} aria-hidden="true" style={{flexShrink:0}}/>
              {trap.aboveTaper ? "Your Personal Allowance is gone" : "You're in the £100k tax trap"}
            </span>
            <span style={{display:"block",...ROW.note}}>
              {red ? `Over £100k costs you ${fmt(trap.amount)}/yr. ` : ""}Pensions can be used to fix the trap.
            </span>
          </span>
          <ChevronRight size={16} color={MUT} aria-hidden="true" style={{flexShrink:0,transform:open ? "rotate(90deg)" : "none",transition:"transform 0.15s"}}/>
        </button>
      </h2>
      {open && (
        <>
          {red && (
            <TileRow align>
              <RowText label="What it costs you" tool={priorityTag} figure={`${fmt(trap.amount)}/yr`} figureStyle={{color:CRITICAL}}
                note={`${fmt(trap.allowance.tax)} of tax-free allowance${trap.childcareLost > 0 ? ` and ${fmt(trap.childcareLost)} of childcare support` : ""}`}/>
            </TileRow>
          )}
          <TileRow align>
            <RowText label="Taken from your next £1" figure={ratePct} figureStyle={{color:CRITICAL}}
              note={`Tax, NI${trap.rate.sl > 0 ? " and student loan" : ""} together${trap.aboveTaper ? ", above £125,140 with no Personal Allowance left" : ", as the Personal Allowance is taken away between £100,000 and £125,140"}`}/>
          </TileRow>
          <TileRow align>
            <RowText label="Over £100,000 by" figure={fmt(trap.needed)}
              note={trap.fits ? "Paying that into your pension would fit in the allowance you have left this year" : `More than the ${fmt(trap.aaRoom)} of pension allowance you have left this year`}/>
          </TileRow>
        </>
      )}
      <TileRow onClick={onOpenModule}>
        <span style={ROW.action}>See the ways back under £100k</span>
      </TileRow>
    </section>
  );
}

// The hero: how the pot could grow to retirement, with what paying in
// more would add on top. The first row of the growth tile.
function GrowthChart({ traj, d, m, extraPct }) {
  // What paying more in adds sits on top of every bar after Now (the
  // same extra, grown the same, whichever path it joins), so each bar
  // shows the whole pot. Scaled for the largest extra on offer, so the
  // bars don't shrink as the slider moves.
  const extra = traj.extraGain;
  const maxExtra = calcPensionGrowthTrajectory(d, m, EXTRA_PCT_OPTIONS.at(-1).value).extraGain;
  const maxBar = Math.max(...traj.bars.map(b => b.value + (b.key === "now" ? 0 : maxExtra)), 1);
  const barColors = { now:"rgba(196,150,58,0.5)", retirement:GOLD, optimised:SUCCESS, bonus:"rgba(45,107,74,0.7)" };
  // Short labels for narrow mobile columns — the bars themselves are a
  // cumulative staircase (see calcPensionGrowthTrajectory), so each
  // label after "Optimised" is a running "+lever" on top of the last,
  // not an independent scenario.
  const shortLabel = {
    now: "Now",
    retirement: `Retire (${traj.retireAge})`,
    optimised: `Optimised (+${traj.matchCapIncreasePct}%)`,
    bonus: "+ Bonus",
  };
  return (
    <TileRow first>
      <div style={{display:"flex",alignItems:"stretch",justifyContent:"space-between",gap:"4px",height:"150px"}}>
        {traj.bars.map(bar => {
          const added = bar.key === "now" ? 0 : extra;
          const total = bar.value + added;
          // More than the pension as it stands, with everything on this bar.
          const uplift = bar.key !== "now" ? total - traj.currentPot : 0;
          return (
            <div key={bar.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%"}}>
              {/* Fixed-height label area (whether or not the uplift badge renders) so
                  it never eats into the bar's own space below — otherwise columns with
                  a badge got a shorter effective track and drew a shorter bar even when
                  their value was higher. */}
              <div style={{height:"36px",flexShrink:0,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}}>
                {uplift > 0 && (
                  <div style={{fontSize:"9px",fontWeight:700,color:SUCCESS,background:"rgba(45,107,74,0.12)",borderRadius:"100px",padding:"1px 6px",whiteSpace:"nowrap",marginBottom:"3px"}}>+{fmtBig(uplift)}</div>
                )}
                <div style={{fontSize:"13px",fontWeight:700,fontFamily:SERIF,color:TEXT,whiteSpace:"nowrap"}}>{fmtBig(total)}</div>
              </div>
              <div style={{flex:1,width:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end"}}>
                <div style={{width:"100%",maxWidth:"52px",borderRadius:"5px 5px 0 0",background:EXTRA_COLOR,height:`${(added/maxBar)*100}%`,transition:"height 0.3s ease"}}/>
                <div style={{width:"100%",maxWidth:"52px",borderRadius:added > 0 ? 0 : "5px 5px 0 0",background:barColors[bar.key]||G,height:`${Math.max(3,(bar.value/maxBar)*100)}%`}}/>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",gap:"4px",marginTop:"6px"}}>
        {traj.bars.map(bar => (
          <div key={bar.key} style={{flex:1,textAlign:"center",fontSize:"9.5px",color:MUT,lineHeight:1.25}}>{shortLabel[bar.key] || bar.label}</div>
        ))}
      </div>
      {extraPct > 0 && (
        <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"8px"}}>
          <span style={{width:"10px",height:"10px",borderRadius:"3px",background:EXTRA_COLOR,display:"inline-block"}}/>
          <span style={{fontSize:"11px",color:MUT}}>Paying in {extraPct}% more of your salary</span>
        </div>
      )}
    </TileRow>
  );
}

// The employer match tile: what's being left unclaimed, or, without a
// pension yet, what starting one would cost after tax relief.
function EmployerMatchTile({ m, d, trPct, contributing, set, taxFreeCash, editItem }) {
  const myPct = +d.myContribution || 0;
  const empCapPct = +d.employerMatch || 0;
  // Not paying in: "Starting" only when there's no pension yet.
  const title = contributing ? "Employer match" : taxFreeCash.pot > 0 ? "Paying into your pension" : "Starting a pension";
  const yourContribAmount = m.salary * myPct / 100;
  const employerCapAmount = m.salary * empCapPct / 100;
  const illustrativeRate = empCapPct > 0 ? empCapPct : 5;
  const illustrativeAmount = m.salary * illustrativeRate / 100;
  const illustrativeRelief = Math.round(illustrativeAmount * m.tr);
  const illustrativeNetCost = Math.round(illustrativeAmount - illustrativeRelief);
  const email = pensionMatchDraft({ name: d.name, contributing, myPct });
  const reminder = useReminder({
    id: "pension-employer-match",
    title: empCapPct > 0 ? buildReminderSubject(`${fmt(m.missedMatch)}/yr`, "Pension employer match") : "Candid: Pension employer match",
    // Informational, not directive — states what the numbers show and
    // leaves the decision and the "how" to HR/payroll, rather than
    // instructing the person to act (avoids reading as financial advice).
    // Shown even when the employer cap is unknown (empCapPct 0) — the
    // HR email is exactly how they'd find it out.
    description: empCapPct === 0
      ? `${firstName(d) ? firstName(d)+", y" : "Y"}our employer's pension match cap isn't known yet. Any match is paid on top of your ${trPct}% tax relief.\n\nHR or Payroll can say what the match is and how it's set up.`
      : contributing
      ? `${firstName(d) ? firstName(d)+", b" : "B"}ased on your salary (${fmt(m.salary)}), increasing your contribution from ${myPct}% to ${empCapPct}% is worth ${fmt(m.missedMatch)}/yr in employer match.\n\nTo capture it, the change needs actioning with HR or Payroll. It usually takes effect from the next month.`
      : `${firstName(d) ? firstName(d)+", b" : "B"}ased on your salary (${fmt(m.salary)}), contributing at least ${empCapPct}% would unlock your employer's full match, worth ${fmt(m.missedMatch)}/yr on top of ${trPct}% tax relief.\n\nTo capture it, this needs actioning with HR or Payroll. It usually takes effect from the next month.`,
    email,
  });
  return (
    <MobileTile id="pension-match" title={title}
      menu={[!reminder.isSet && { icon: Bell, label: "Remind me", onClick: reminder.setReminder }, editItem]}>
      <TileRow first align>
        {contributing ? (
          <RowText label="Match you're not getting" figure={`+${fmt(m.missedMatch)}/yr`} figureStyle={{color:SUCCESS}}
            note={`At ${empCapPct}%, your employer would add the rest, on top of your own ${trPct}% tax relief`}/>
        ) : (
          <RowText label="Tax relief on what you pay in" figure={`${trPct}%`}
            note={`Every £${100-trPct} becomes £100${empCapPct > 0 ? `, and your employer matches up to ${empCapPct}% of salary if you pay in at least that much` : ""}`}/>
        )}
      </TileRow>
      <TileRow align>
        {contributing ? (
          <>
            <div style={rowStyle}><span>Your contribution, {myPct}% of salary</span><span>{fmt(yourContribAmount)}/yr</span></div>
            <div style={rowStyle}><span>Employer match cap, {empCapPct}% of salary</span><span>{fmt(employerCapAmount)}/yr</span></div>
            <div style={{...rowStyle,fontWeight:700,color:SUCCESS}}><span>Uplift if you match the cap</span><span>+{fmt(m.missedMatch)}/yr</span></div>
          </>
        ) : (
          <>
            <div style={rowStyle}><span>Pay in {illustrativeRate}% of salary</span><span>{fmt(illustrativeAmount)}/yr</span></div>
            <div style={rowStyle}><span>Tax relief at {trPct}%</span><span>−{fmt(illustrativeRelief)}/yr</span></div>
            {empCapPct > 0 && <div style={{...rowStyle,color:SUCCESS}}><span>Employer matches {empCapPct}%</span><span>+{fmt(employerCapAmount)}/yr</span></div>}
            <div style={{...rowStyle,fontWeight:700}}><span>Net cost to you</span><span>{fmt(illustrativeNetCost)}/yr</span></div>
            <div style={{...rowStyle,fontWeight:700,color:SUCCESS}}><span>Goes into your pension</span><span>{fmt(illustrativeAmount + (empCapPct>0?employerCapAmount:0))}/yr</span></div>
          </>
        )}
        <div style={ROW.note}>Money in a pension usually can't be taken out until you're 55 (57 from 2028).</div>
      </TileRow>
      {set && <QuickUpdateContribution d={d} myPct={myPct} suggested={contributing ? empCapPct : illustrativeRate} set={set}/>}
      <ReminderRows reminder={reminder} email={email}/>
    </MobileTile>
  );
}

// Past years' allowance (carry forward), year by year: rows under its What
// ifs row.
function CarryForwardCalc({ cf, setCfYears, aa }) {
  const setYear = (i, patch) => setCfYears(prev => prev.map((yy, idx) => idx === i ? { ...yy, ...patch } : yy));
  return (
    <>
      <TileRow align>
        <p style={ROW.text}>Had a scheme in earlier years but didn't use the full £60,000 allowance? The unused part carries forward for up to 3 years, capped at 100% of this year's earnings ({fmt(cf.cfRelevantEarnings)}).</p>
      </TileRow>
      {cf.cfBreakdown.map((y, i) => (
        <TileRow key={y.label} align>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
            <span style={{...ROW.label,fontWeight:600}}>{y.label}</span>
            <YearToggle value={y.hadScheme} onChange={v => setYear(i, { hadScheme: v })}/>
          </div>
          {y.hadScheme && (
            <div style={{marginTop:"8px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",flexWrap:"wrap"}}>
              <label style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"12px",color:MUT}}>
                Paid in (£)
                <input type="number" value={y.contribution} placeholder="0"
                  onChange={e => setYear(i, { contribution: e.target.value })}
                  style={{width:"96px",padding:"5px 8px",fontSize:"16px",border:"1.5px solid rgba(22,47,36,0.18)",borderRadius:"6px",background:WHITE}}/>
              </label>
              <span style={{fontSize:"13px",color:SUCCESS,fontWeight:600}}>{fmt(y.unused)} unused</span>
            </div>
          )}
        </TileRow>
      ))}
      <TileRow align>
        <div style={rowStyle}><span>This year's allowance{aa.inAATaper?" (tapered)":""}</span><span>{fmt(aa.approxAA)}</span></div>
        <div style={rowStyle}><span>Unused from the last 3 years</span><span>+{fmt(cf.cfTotalUnused)}</span></div>
        <div style={{...rowStyle,fontWeight:700}}><span>Theoretical maximum</span><span>{fmt(cf.cfTheoreticalMax)}</span></div>
        {cf.cfEarningsCapped && (
          <div style={{...rowStyle,color:CRITICAL}}><span>Capped at 100% of earnings</span><span style={{fontWeight:700}}>{fmt(cf.cfMaxContributable)}</span></div>
        )}
      </TileRow>
      {aa.showVctEis && (
        <TileRow align>
          <div style={{...NOTICE_LABEL,marginBottom:"4px"}}>If pension contributions alone can't fix this</div>
          <p style={ROW.text}>
            Even with carry forward, pension contributions alone may not bring Threshold Income below £200,000 here. The other routes carry much more risk, and this is a position where people usually take regulated advice. <a href={ADVISER_LINK.href} target="_blank" rel="noopener noreferrer" style={{color:G,fontWeight:700}}>{ADVISER_LINK.label}</a>
          </p>
        </TileRow>
      )}
    </>
  );
}

// A bonus into the pension: what sacrificing some of a stated bonus keeps,
// or, with no bonus stated, a way to add one. Rows under its What ifs row.
function BonusCalc({ hasStatedBonus, bonusPotential, d, set, sacrificePct, setSacrificePct, bonusInput, setBonusInput, setShowFVInfo, showFVInfo, m, onEditInputs }) {
  const bs = calcBonusSacrifice(d, m, bonusInput, sacrificePct);
  // What the slider's choice keeps from tax, NI and student loan: what
  // "I've done this" counts as saved.
  const sliderSaving = Math.max(0, calcBonusSacrifice(d, m, bonusInput, 0).totalDeducted - bs.totalDeducted);
  const email = bonusSacrificeDraft({ name: d.name });
  const reminder = useReminder({
    id: "pension-bonus-sacrifice",
    title: buildReminderSubject(fmt(bonusPotential), "Bonus sacrifice"),
    // Informational, not directive — states the figures and the action
    // needed (an email to HR/Payroll) rather than instructing the
    // person to sacrifice their bonus, avoiding reading as advice.
    description: `${firstName(d) ? firstName(d)+", y" : "Y"}our bonus may be able to go into your pension by salary sacrifice. Based on your bonus (${fmt(+d.bonusAmount)}), up to ${fmt(bonusPotential)} of tax and National Insurance on it is avoidable this way.\n\nTo capture it, this needs actioning with HR or Payroll before the bonus is paid, as it usually can't be done retrospectively.`,
    email,
  });

  if (!hasStatedBonus) return (
    <>
      <TileRow align>
        <p style={ROW.text}>A bonus paid into your pension through salary sacrifice has no tax or NI taken from it, but it has to be arranged before the bonus is paid. With a bonus in your figures, this works out what it saves.</p>
      </TileRow>
      {onEditInputs && (
        <TileRow align onClick={onEditInputs}>
          <span style={ROW.action}><Pencil size={18} aria-hidden="true"/>Add a bonus to your figures</span>
        </TileRow>
      )}
    </>
  );

  return (
    <>
      <TileRow align>
        {set && bonusPotential > 0 && <OpportunityChoice id={CHOICE_IDS.bonus} d={d} set={set} bank={{ moduleKey: "pension", perYear: sliderSaving }}/>}
        <p style={{...ROW.text,marginBottom:"12px"}}>
          A bonus sacrificed before it reaches your payslip has no tax, NI{bs.bonusSlRate > 0 ? " or student loan repayments" : ""} taken from it. It goes into your pension in full and grows tax-free.
        </p>
        <div style={{...NOTICE_LABEL,marginBottom:"8px"}}>How much to sacrifice</div>
        {/* Stacked: indented under its row, the two don't fit side by side. */}
        <div style={{display:"grid",gap:"8px"}}>
          <PillMoneyInput label="Bonus" value={bonusInput} onChange={setBonusInput}/>
          <PillSlider label="How much to sacrifice" value={sacrificePct} onChange={setSacrificePct} options={SACRIFICE_OPTIONS}/>
        </div>
      </TileRow>

      {(bs.crossesTaper || bs.crossesAR) && (
        <TileRow align>
          <div style={{display:"flex",gap:"10px",alignItems:"flex-start"}}>
            <AlertTriangle size={16} color={CRITICAL} aria-hidden="true" style={{flexShrink:0,marginTop:"2px"}}/>
            <p style={{...ROW.text,fontSize:"12.5px"}}>
              {bs.crossesTaper && !bs.crossesAR ? "Your bonus crosses the 60% taper zone (£100k–£125,140)." : "Your bonus spans the 40% → 60% taper → 45% rate bands."} Sacrificing the part in that zone saves the most.
            </p>
          </div>
        </TileRow>
      )}

      <TileRow align>
        <RowText label="You receive" figure={fmt(bs.totalReceived)}
          note={[
            bs.sacrificedAmt > 0 && `${fmt(bs.sacrificedAmt)} into your pension`,
            bs.takeHomeCash > 0 && `${fmt(bs.takeHomeCash)} as cash`,
            bs.employerNISave > 0 && d.employmentStatus !== "self_employed" && `${fmt(bs.employerNISave)} employer NI saved*`,
          ].filter(Boolean).join(" · ")}/>
      </TileRow>
      <TileRow align>
        <RowText label={`Paid to HMRC${bs.bonusSlRate>0?" and the SLC":""}`} figure={sacrificePct===100?fmt(0):fmt(bs.totalDeducted)} figureStyle={{color:TEXT}}
          note={sacrificePct !== 100 && [bs.taxOnCash>0 && `Tax ${fmt(bs.taxOnCash)}`, bs.niOnCash>0 && `NI ${fmt(bs.niOnCash)}`, bs.slOnCash>0 && `Student loan ${fmt(bs.slOnCash)}`].filter(Boolean).join(" · ")}/>
      </TileRow>
      <TileRow align>
        <RowText label={`At retirement (age ${bs.retireAge})`} tool={<InfoButton onClick={() => setShowFVInfo(o => !o)} open={showFVInfo}/>} figure={fmtCompact(bs.bonusFVpartial(sacrificePct))}/>
        {showFVInfo && (
          <p style={{...ROW.note,marginTop:"6px"}}>
            Assumes this amount is left untouched in your pension until retirement, growing {GROWTH_NOMINAL_PCT}% a year less {INFLATION_PCT}% inflation, so it's in today's money.
            {bs.bonusSlRate > 0 && bs.loanBal > 0 && (bs.slOnCash <= 0
              ? " None of the bonus is taken as cash, so no student loan deduction applies to it."
              : m.willClear
                ? ` The ${fmt(bs.slOnCash)} student loan deduction on the cash portion also brings your clear date forward, saving roughly ${fmt(bs.slInterestSaved)} in interest.`
                : ` Your loan is unlikely to clear before write-off, so the ${fmt(bs.slOnCash)} student loan deduction on the cash portion would likely be written off anyway.`)}
            {d.employmentStatus !== "self_employed" && ` *Employer NI of ${Math.round(EMPLOYER_NI_RATE * 100)}% on the sacrificed amount is also saved — some employers pass this on.`}
          </p>
        )}
      </TileRow>
      {bonusPotential > 0 && <ReminderRows reminder={reminder} email={email}/>}
    </>
  );
}

// Salary sacrifice in the £80k-£100k zone, with a custom amount to try:
// rows under its What ifs row. The amount follows "What if you paid in
// more?" in the growth tile (`chartSlider`), or, with no chart, a slider here.
function SacrificeCalc({ d, m, trPct, extraPct, setExtraPct, chartSlider }) {
  const isSalarySacrifice = d.pensionType === "sacrifice";
  // NI saved by salary sacrifice: 8% in the basic band, 2% above (pension.js).
  const niSavingPct = isSalarySacrifice ? Math.round(sacrificeNiRate(d, m) * 100) : 0;
  const totalReliefPct = trPct + niSavingPct;
  const sacrificeExtraPct = extraPct || 1;
  const extraAmt = m.salary * sacrificeExtraPct / 100;
  const extraRelief = Math.round(extraAmt * (m.tr + niSavingPct/100));
  const extraNetCost = Math.round(extraAmt - extraRelief);
  const newAdjustedIncome = Math.max(0, m.adjustedNetIncome - extraAmt);
  const newBandLabel = newAdjustedIncome > 125140 ? "additional" : newAdjustedIncome > 50270 ? "higher" : "basic";
  // Personal Savings Allowance — a band fact, not something £100k itself
  // changes (it shifts at £50,270 and £125,140, not £100k).
  const psaAmount = m.taxBandLabel === "additional" ? 0 : m.taxBandLabel === "higher" ? 500 : 1000;
  return (
    <>
      <TileRow align>
        <p style={ROW.text}>Your income sits in the £80k–£100k zone. Salary sacrifice saves tax and NI on what goes in, and leaves room if a bonus or rise would take you over £100k later. It lowers your take-home pay, and the money usually can't be taken out until you're 55 (57 from 2028).</p>
      </TileRow>
      <TileRow align>
        <div style={{...NOTICE_LABEL,marginBottom:"4px"}}>An extra {sacrificeExtraPct}% of salary</div>
        {!chartSlider && (
          <div style={{margin:"4px 0 8px"}}>
            <PillSlider compact label="An extra share of salary" value={sacrificeExtraPct} onChange={setExtraPct} options={EXTRA_PCT_OPTIONS.filter(o => o.value > 0)}/>
          </div>
        )}
        <div style={rowStyle}><span>Comes off your taxable income</span><span>−{fmt(Math.round(extraAmt))}</span></div>
        <div style={rowStyle}><span>Tax{niSavingPct>0?" and NI":""} relief at {totalReliefPct}%</span><span>−{fmt(extraRelief)}</span></div>
        <div style={{...rowStyle,fontWeight:700}}><span>Net cost to your take-home</span><span>{fmt(extraNetCost)}</span></div>
        <div style={ROW.note}>
          That leaves your taxable income at about {fmt(Math.round(newAdjustedIncome))}{newBandLabel !== m.taxBandLabel ? `, in the ${newBandLabel}-rate band.` : `, still in the ${m.taxBandLabel}-rate band.`}{chartSlider && ` "What if you paid in more?" in Growth to retirement changes the amount.`}
        </div>
      </TileRow>
      <TileRow align>
        <p style={ROW.note}>
          Your Personal Savings Allowance is {psaAmount>0?fmt(psaAmount):"£0"} as a {m.taxBandLabel}-rate taxpayer{psaAmount>0?": savings interest above that is taxed at your marginal rate":""}. It would recover to £1,000 if sacrifice took you back under £50,270.
        </p>
      </TileRow>
    </>
  );
}
