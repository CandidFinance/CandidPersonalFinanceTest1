import { useState } from "react";
import { motion } from "framer-motion";
import StickySummaryBar, { SummaryLabel, SummaryFigure } from "./StickySummaryBar.jsx";
import { Plus, Minus, ChevronDown } from "lucide-react";
import { G, MUT, TEXT, SERIF, SANS, SC, WARNING, WHITE, PillSlider } from "../../CandidApp.jsx";
import { capField } from "../../lib/onboarding.js";
import { borrowingInputs, calcBorrowingCheck, suggestedCashAvailable, cashIsaBalance, multipleBar, LENDER_INCOME_MULTIPLE, HIGH_EARNER_MULTIPLE, BAR_MAX_MULTIPLE, EMERGENCY_KEEP_BACK_MONTHS } from "../../lib/borrowing.js";
import { fmt } from "../../lib/format.js";
import PillMoneyInput from "../PillMoneyInput.jsx";
import InfoButton from "../InfoButton.jsx";
import PillCell from "./PillCell.jsx";
import PillSelect from "./PillSelect.jsx";
import { PROPERTY_REGIONS } from "../../lib/regions.js";

// Borrowing check: the loan a purchase needs against the 4.5x income most
// lenders work to. A warning only, never a block. Logic in
// src/lib/borrowing.js. In parts so the Property screen can lead with the
// result (LoanTile), then the inputs that drive it (PurchaseInputs), with
// LoanSummaryBar keeping the result in view while those inputs are edited.

// The times-income figure as shown: one decimal normally, but a multiple just
// over a band edge would round down onto it ("4.5", "5.5") and read as the
// band below, so show two there. Null when there's no income to compare.
function multipleText(r) {
  if (r.multiple == null) return null;
  const nearEdge = [LENDER_INCOME_MULTIPLE, HIGH_EARNER_MULTIPLE].some(x => r.multiple > x && r.multiple.toFixed(1) === x.toFixed(1));
  return nearEdge ? r.multiple.toFixed(2) : r.multiple.toFixed(1);
}

// Colour and caption for calcBorrowingCheck's band: green up to 4.5x,
// orange to 5.5x, red above. Drives the times-income figure, the bar and
// the result tile's border.
// Built at render time, not module scope: this file is part of the
// circular import with CandidApp.jsx (via MobilePropertyScreen), so tokens
// imported from it can't be relied on while the module first evaluates.
function bandStyle(band) {
  return {
    within:  { color: SC.ok,       caption: `Within the ${LENDER_INCOME_MULTIPLE}x most lenders use` },
    stretch: { color: WARNING,     caption: `Above ${LENDER_INCOME_MULTIPLE}x, within the ${HIGH_EARNER_MULTIPLE}x some lenders offer higher earners` },
    beyond:  { color: SC.critical, caption: `Above ${HIGH_EARNER_MULTIPLE}x, beyond what most lenders offer` },
  }[band];
}

// The loan's income multiple on a bar with the 4.5x and 5.5x lines marked.
// The fill is green up to 4.5x, orange to 5.5x and red beyond; the scale
// stops at 10x (geometry in multipleBar, src/lib/borrowing.js).
function MultipleBar({ multiple, band }) {
  const { color, caption: text } = bandStyle(band);
  const { capped, segments, markers } = multipleBar(multiple);
  const markerLabel = { position:"absolute", fontSize:"10.5px", fontWeight:600, color:MUT, whiteSpace:"nowrap" };
  return (
    <div style={{marginTop:"14px"}}>
      <div style={{position:"relative",height:"10px"}}>
        <div style={{position:"absolute",inset:0,borderRadius:"5px",background:"rgba(22,47,36,0.08)",overflow:"hidden"}}>
          {segments.map(s => (
            <div key={s.band} style={{position:"absolute",top:0,bottom:0,left:`${s.left}%`,width:`${s.width}%`,background:bandStyle(s.band).color}}/>
          ))}
        </div>
        {markers.map(mk => (
          <div key={mk.x} style={{position:"absolute",left:`${mk.pct}%`,top:"-4px",bottom:"-4px",width:"2px",marginLeft:"-1px",background:TEXT}}/>
        ))}
      </div>
      <div style={{position:"relative",height:"16px",marginTop:"4px"}}>
        {markers.map(mk => (
          <span key={mk.x} style={{...markerLabel,left:`${mk.pct}%`,transform:"translateX(-50%)"}}>{mk.x}x</span>
        ))}
        {capped && <span style={{...markerLabel,right:0}}>{BAR_MAX_MULTIPLE}x+</span>}
      </div>
      <div style={{fontSize:"13px",fontWeight:700,color,marginTop:"4px"}}>{text}</div>
    </div>
  );
}

const YES_NO = [{ value:"yes", label:"Yes" }, { value:"no", label:"No" }];

// A cost taken off cash available: red with a minus sign when there is one.
function Cost({ value }) {
  return value > 0 ? <span style={{color:SC.critical}}>−{fmt(value)}</span> : <span>{fmt(0)}</span>;
}

// The "?" under Stamp duty: band by band for England and Northern Ireland,
// plus which relief or surcharge applied.
function StampDutyBreakdown({ sd, style }) {
  if (!sd.supported) {
    return <p style={style}>Candid works out stamp duty for England and Northern Ireland. Scotland (LBTT) and Wales (LTT) have their own rules, so this is the figure you entered.</p>;
  }
  const pct = rate => `${Math.round(rate * 1000) / 10}%`;
  const notes = [];
  if (sd.reliefApplies) notes.push("First-time buyer relief applied.");
  if (sd.reliefLostOverCap) notes.push("First-time buyer relief only covers homes of £500,000 or less, so standard rates apply.");
  if (sd.reliefNeedsAllBuyers) notes.push("First-time buyer relief needs both of you to be first-time buyers, so standard rates apply.");
  if (sd.surcharge > 0) notes.push(`Includes the ${pct(sd.surcharge)} surcharge for buying a home while keeping another.`);
  notes.push("Doesn't include the 2% surcharge for buyers not resident in the UK.");
  return (
    <div style={style}>
      {sd.breakdown.map(b => (
        <div key={b.from} style={{display:"flex",justifyContent:"space-between",gap:"10px"}}>
          <span>{b.from === 0 ? "Up to" : `${fmt(b.from + 1)} to`} {fmt(b.to)} at {pct(b.rate)}</span>
          <span>{fmt(b.tax)}</span>
        </div>
      ))}
      {notes.map(n => <p key={n} style={{margin:"6px 0 0"}}>{n}</p>)}
    </div>
  );
}

const BUYING_MODE_OPTIONS = [{ value:"alone", label:"Alone" }, { value:"together", label:"Together" }];

// The narrowest a column gets before a two-column row wraps to one: two
// columns and the gap between them fit on any phone 360px or wider.
const COLUMN_MIN = "140px";

// All of step 1's inputs, in order: alone or together and where (one row),
// first-time buyer and sole property (one row), the partner's figures when
// buying together (their first-time buyer answer among them), then price
// and cash available, with stamp duty by hand for Scotland and Wales. Fees
// sit in a collapsed "Advanced settings", defaulting to
// DEFAULT_PROPERTY_FEES. The loan they produce is LoanTile, above them on
// the screen. Every row sits in PillCells so right edges line up with the
// "?" slot.
export function PurchaseInputs({ d, m, set }) {
  const [cashInfoOpen, setCashInfoOpen] = useState(false);
  const [firstTimeInfoOpen, setFirstTimeInfoOpen] = useState(false);
  const [soleInfoOpen, setSoleInfoOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const caption = { fontSize:"11.5px", color:MUT, lineHeight:1.5, margin:0 };
  const explainer = { fontSize:"11.5px", color:MUT, lineHeight:1.5, background:"#ede7db", borderRadius:"8px", padding:"8px 10px", margin:0 };
  const fieldLabel = { fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:"6px", display:"flex", alignItems:"center", gap:"6px" };
  const columns = { display:"flex", gap:"10px", flexWrap:"wrap" };
  const column = { flex:1, minWidth:COLUMN_MIN };
  const input = borrowingInputs(d, m);
  const together = input.incomes.length > 1;
  const cashPot = m.totalLiquid + cashIsaBalance(d);
  const suggested = suggestedCashAvailable(cashPot, m.expenses);
  const sd = input.stampDutyDetail;
  // Scotland and Wales: Candid doesn't calculate LBTT or LTT, so ask.
  const manualStampDuty = sd && !sd.supported;
  const toggle = (value, onChange, options = YES_NO) => (
    <div style={{flex:1,minWidth:0}}><PillSlider value={value} onChange={onChange} options={options}/></div>
  );

  return (
    <div>
      <div style={{display:"flex",gap:"10px"}}>
        <PillCell grow={3}>{toggle(together ? "together" : "alone", v => set("propertyBuyingMode", v), BUYING_MODE_OPTIONS)}</PillCell>
        <PillCell grow={2}><PillSelect value={d.propertyRegion} onChange={v => set("propertyRegion", v)} options={PROPERTY_REGIONS} placeholder="Location"/></PillCell>
      </div>

      <div style={{...columns,marginTop:"18px"}}>
        <div style={column}>
          <div style={fieldLabel}>
            First-time buyer?
            <InfoButton open={firstTimeInfoOpen} onClick={() => setFirstTimeInfoOpen(o => !o)}/>
          </div>
          <PillCell>{toggle(d.propertyFirstTimeBuyer || "", v => set("propertyFirstTimeBuyer", v))}</PillCell>
        </div>
        <div style={column}>
          <div style={fieldLabel}>
            Sole property?
            <InfoButton open={soleInfoOpen} onClick={() => setSoleInfoOpen(o => !o)}/>
          </div>
          <PillCell>{toggle(d.propertySoleProperty || "yes", v => set("propertySoleProperty", v))}</PillCell>
        </div>
      </div>
      {firstTimeInfoOpen && (
        <p style={{...explainer,marginTop:"8px"}}>
          Someone who has never owned a home, in the UK or anywhere else. In England and Northern Ireland, first-time buyers pay no stamp duty up to £300,000 and 5% on the part from £300,001 to £500,000, on homes of £500,000 or less.{together ? " Buying together, you both need to be first-time buyers to get this." : ""}
        </p>
      )}
      {soleInfoOpen && (
        <p style={{...explainer,marginTop:"8px"}}>
          Whether this will be the only home {together ? "either of you owns" : "you own"}, in the UK or anywhere else. Keeping another home means stamp duty in England and Northern Ireland includes a 5% surcharge on the whole price.
        </p>
      )}

      {together && (
        <div style={{marginTop:"18px"}}>
          <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"3px"}}>Your partner</div>
          <p style={{fontSize:"11px",color:MUT,lineHeight:1.5,margin:"0 0 10px"}}>
            Used to check their employer match and ISA allowance, and added to your income for the borrowing check.
          </p>
          <div style={{...columns,marginBottom:"10px"}}>
            <PillCell min={COLUMN_MIN}><PillMoneyInput label="Salary" value={+d.partnerSalary || null} onChange={v => set("partnerSalary", capField("salary", v ?? ""))}/></PillCell>
            <PillCell min={COLUMN_MIN}><PillMoneyInput label="Other income" value={+d.partnerOtherIncome || null} onChange={v => set("partnerOtherIncome", capField("otherIncome", v ?? ""))}/></PillCell>
          </div>
          <div style={{...columns,marginBottom:"10px"}}>
            <PillCell min={COLUMN_MIN}><PillMoneyInput label="Pension contribution" unit="%" value={d.partnerMyContribution || null} onChange={v => set("partnerMyContribution", capField("myContribution", v ?? ""))}/></PillCell>
            <PillCell min={COLUMN_MIN}><PillMoneyInput label="Employer match cap" unit="%" value={d.partnerEmployerMatch || null} onChange={v => set("partnerEmployerMatch", capField("employerMatch", v ?? ""))}/></PillCell>
          </div>
          {/* Bottom-aligned, so the ISA pill lines up with the toggle under
              its label. */}
          <div style={{...columns,alignItems:"flex-end"}}>
            <PillCell min={COLUMN_MIN}><PillMoneyInput label="ISA paid in this tax year" value={+d.partnerIsaThisYear || null} onChange={v => set("partnerIsaThisYear", capField("isaThisYearOther", v ?? ""))}/></PillCell>
            <div style={column}>
              <div style={fieldLabel}>First-time buyer?</div>
              <PillCell>{toggle(d.partnerFirstTimeBuyer || "", v => set("partnerFirstTimeBuyer", v))}</PillCell>
            </div>
          </div>
        </div>
      )}

      <div style={{...columns,marginTop:"20px"}}>
        <PillCell min={COLUMN_MIN}><PillMoneyInput label="Property price" value={+d.propertyPrice || null} onChange={v => set("propertyPrice", v ?? "")}/></PillCell>
        <PillCell min={COLUMN_MIN} info={<InfoButton open={cashInfoOpen} onClick={() => setCashInfoOpen(o => !o)}/>}>
          <PillMoneyInput label="Cash available" value={input.cashAvailable || null} onChange={v => set("propertyCashAvailable", v ?? "")}/>
        </PillCell>
      </div>
      {cashInfoOpen && (
        <p style={{...explainer,marginTop:"8px"}}>
          Your cash savings, Premium Bonds and Cash ISAs ({fmt(cashPot)}) less {EMERGENCY_KEEP_BACK_MONTHS} months of expenses ({fmt(EMERGENCY_KEEP_BACK_MONTHS * m.expenses)}) kept back as an emergency fund: {fmt(suggested)}. Change it if some of that cash is set aside{together ? ", or to add your partner's savings" : ""}.
        </p>
      )}
      {manualStampDuty && (
        <>
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <PillCell><PillMoneyInput label="Stamp duty" value={+d.propertyStampDuty || null} onChange={v => set("propertyStampDuty", v ?? "")}/></PillCell>
            <div style={{flex:1}}/>
          </div>
          <p style={{...caption,marginTop:"8px"}}>Candid works out stamp duty for England and Northern Ireland. Scotland and Wales have their own taxes, so enter yours if you know it.</p>
        </>
      )}

      {/* Negative bottom margin cancels the button's tap padding, so the
          text sits the same distance from the divider below as a tile does. */}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:"8px",marginBottom:advancedOpen ? 0 : "-4px"}}>
        <button type="button" onClick={() => setAdvancedOpen(o => !o)} aria-expanded={advancedOpen} style={{background:"none",border:"none",padding:"4px 0",color:G,fontSize:"13px",fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px"}}>
          {advancedOpen ? <Minus size={14}/> : <Plus size={14}/>}Advanced settings
        </button>
      </div>
      {advancedOpen && (
        <div style={{display:"flex",gap:"10px",marginTop:"6px"}}>
          <PillCell><PillMoneyInput label="Legal & survey fees" value={input.fees || null} onChange={v => set("propertyFees", v ?? "")}/></PillCell>
          <div style={{flex:1}}/>
        </div>
      )}
    </div>
  );
}

// The loan the purchase needs against the 4.5x most lenders use, with the
// cash-to-deposit step-through.
export function LoanTile({ d, m }) {
  const [incomeInfoOpen, setIncomeInfoOpen] = useState(false);
  const [stampDutyInfoOpen, setStampDutyInfoOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const explainer = { fontSize:"11.5px", color:MUT, lineHeight:1.5, background:"#ede7db", borderRadius:"8px", padding:"8px 10px", margin:0 };
  const row = { display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", fontSize:"13.5px", color:TEXT, padding:"6px 0" };
  const figureLabel = { fontSize:"10px", fontWeight:600, color:MUT, letterSpacing:"0.06em", textTransform:"uppercase" };
  const figure = { fontFamily:SERIF, fontSize:"26px", fontWeight:700, color:TEXT, lineHeight:1.2 };
  const input = borrowingInputs(d, m);
  const r = calcBorrowingCheck(input);
  const together = input.incomes.length > 1;
  const sd = input.stampDutyDetail;
  const bandColor = r.band ? bandStyle(r.band).color : null;
  const incomePhrase = together ? "your combined income" : "your income";
  const times = multipleText(r);

  return (
    <div>
      <div style={{fontSize:"10px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>How much you'd need to borrow</div>
      {input.price > 0 ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.4}}
            style={{background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"18px",border:bandColor ? `2px solid ${bandColor}` : "none"}}>
            <div style={{display:"flex",gap:"24px"}}>
              <div>
                <div style={figureLabel}>Loan needed</div>
                <div style={figure}>{fmt(r.loanNeeded)}</div>
              </div>
              {times && r.loanNeeded > 0 && (
                <div>
                  <div style={figureLabel}>Times income</div>
                  <div style={{...figure,color:bandColor || TEXT}}>{times}x</div>
                </div>
              )}
            </div>

            {r.loanNeeded === 0 ? (
              <p style={{fontSize:"13px",fontWeight:700,color:SC.ok,margin:"10px 0 0"}}>No mortgage needed: cash covers the price, stamp duty and fees.</p>
            ) : r.multiple == null ? (
              <p style={{fontSize:"13px",color:TEXT,lineHeight:1.5,margin:"10px 0 0"}}>Candid doesn't have an income figure to compare this against, and lenders base how much they'll lend on income.</p>
            ) : (
              <>
                <MultipleBar multiple={r.multiple} band={r.band}/>
                {r.band === "stretch" && (
                  <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"6px 0 0"}}>
                    That's {fmt(r.gapAboveMultiple)} more than {LENDER_INCOME_MULTIPLE}x {incomePhrase}. Some lenders go to 5 to {HIGH_EARNER_MULTIPLE}x for higher earners.
                  </p>
                )}
                {r.band === "beyond" && (
                  <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"6px 0 0"}}>
                    That's {fmt(r.gapAboveMultiple)} more than {LENDER_INCOME_MULTIPLE}x {incomePhrase}, and above the {HIGH_EARNER_MULTIPLE}x some lenders go to for higher earners.
                  </p>
                )}
              </>
            )}

            {/* The cash-to-deposit breakdown, collapsed by default so the
                headline result and the inputs below fit on one screen. */}
            {breakdownOpen && (<>
            <hr style={{border:"none",borderTop:"1px solid rgba(22,47,36,0.1)",margin:"16px 0 8px"}}/>
            <div style={row}><span>Cash available</span><span>{fmt(input.cashAvailable)}</span></div>
            <div style={row}>
              <span style={{display:"flex",alignItems:"center",gap:"6px"}}>
                Stamp duty
                {sd && <InfoButton open={stampDutyInfoOpen} onClick={() => setStampDutyInfoOpen(o => !o)}/>}
              </span>
              {sd ? <Cost value={input.stampDuty}/> : <span style={{color:MUT}}>Add location</span>}
            </div>
            {sd && stampDutyInfoOpen && <StampDutyBreakdown sd={sd} style={{...explainer,margin:"4px 0 6px"}}/>}
            <div style={row}><span>Legal and survey fees</span><Cost value={input.fees}/></div>
            <div style={{...row,fontWeight:700}}><span>Deposit</span><span>{fmt(r.usableDeposit)}</span></div>
            <div style={row}>
              <span style={{display:"flex",alignItems:"center",gap:"6px"}}>
                {together ? "Combined income" : "Income"}
                <InfoButton open={incomeInfoOpen} onClick={() => setIncomeInfoOpen(o => !o)}/>
              </span>
              <span>{fmt(r.income)}</span>
            </div>
            {incomeInfoOpen && (
              <p style={{...explainer,marginTop:"4px"}}>
                Salary plus other income{together ? ", for both of you" : ""}. Bonuses and dividends aren't included, as lenders treat them case by case. This is a guide, not a lending decision.
              </p>
            )}
            {r.upfrontShortfall > 0 && (
              <p style={{fontSize:"12.5px",color:TEXT,lineHeight:1.5,margin:"8px 0 0"}}>
                Cash available is {fmt(r.upfrontShortfall)} short of covering stamp duty and fees, so none of it is left for a deposit.
              </p>
            )}
            </>)}
            <button type="button" onClick={() => setBreakdownOpen(o => !o)} aria-expanded={breakdownOpen}
              aria-label={breakdownOpen ? "Hide the breakdown" : "Show the breakdown"}
              style={{display:"flex",justifyContent:"center",width:"100%",background:"none",border:"none",padding:"8px 0 0",margin:"6px 0 -6px",cursor:"pointer"}}>
              <ChevronDown size={20} color={MUT} style={{transform:breakdownOpen ? "rotate(180deg)" : "none",transition:"transform 0.15s"}}/>
            </button>
          </motion.div>
      ) : (
        <EmptyLoanCard/>
      )}
    </div>
  );
}

// Before there's a property price: the result card's shape in grey,
// blurred, with one line saying what fills it in. Placeholder bars only, no
// made-up figures.
function EmptyLoanCard() {
  const bar = (width, height = 8) => <div style={{width,height,borderRadius:"4px",background:"rgba(22,47,36,0.12)"}}/>;
  return (
    <div style={{position:"relative",background:WHITE,borderRadius:"16px",boxShadow:"0 2px 10px rgba(22,47,36,0.06)",padding:"18px",overflow:"hidden"}}>
      <div aria-hidden="true" style={{filter:"blur(3px)",opacity:0.7}}>
        <div style={{display:"flex",gap:"24px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>{bar("70px")}{bar("130px",26)}</div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>{bar("70px")}{bar("56px",26)}</div>
        </div>
        <div style={{marginTop:"18px"}}>{bar("100%",10)}</div>
        <div style={{marginTop:"12px"}}>{bar("75%")}</div>
        <div style={{marginTop:"8px",marginBottom:"8px"}}>{bar("55%")}</div>
      </div>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
        <p style={{fontSize:"13.5px",fontWeight:600,color:TEXT,lineHeight:1.5,margin:0,textAlign:"center",background:"rgba(255,255,255,0.85)",borderRadius:"10px",padding:"10px 14px"}}>
          Update your assumptions below to see what you could borrow.
        </p>
      </div>
    </div>
  );
}

// The sticky bar for this step: the loan and times income, while the full
// result is scrolled out of view. Nothing until there's a price.
export function LoanSummaryBar({ d, m, watchRef }) {
  const input = borrowingInputs(d, m);
  if (!(input.price > 0)) return null;
  const r = calcBorrowingCheck(input);
  const times = multipleText(r);
  const bandColor = r.band ? bandStyle(r.band).color : TEXT;

  return (
    <StickySummaryBar watchRef={watchRef} label="Back to how much you'd need to borrow">
      {r.loanNeeded === 0 ? (
        <span style={{fontSize:"13px",fontWeight:700,color:SC.ok}}>No mortgage needed</span>
      ) : (
        <>
          <SummaryLabel>Loan needed</SummaryLabel>
          <SummaryFigure color={TEXT}>{fmt(r.loanNeeded)}</SummaryFigure>
          {times && <SummaryFigure color={bandColor}>{times}x <span style={{fontFamily:SANS,fontSize:"12px",fontWeight:600,color:MUT}}>income</span></SummaryFigure>}
        </>
      )}
    </StickySummaryBar>
  );
}
