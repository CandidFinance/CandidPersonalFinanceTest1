import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { fmt } from "../../lib/format.js";
import { childcareSupport, kidsSituation, CHILDCARE_INCOME_LIMIT, CHILDCARE_HOURLY_PRICE, TFC_CAP_PER_CHILD } from "../../lib/childcare.js";
import { childBenefitCharge } from "../../lib/pension.js";
import { thisTaxYear, allowanceLeft } from "../../lib/taxTrap.js";
import { G, MUT, TEXT, SERIF } from "../../design-tokens.js";
import OpportunityTile from "./OpportunityTile.jsx";

// Kids & family: childcare support (Tax-Free Childcare and, in England, the
// funded hours) and what crossing £100,000 costs, plus the Child Benefit
// charge. The same figures as the module's status and its answer step by
// step (childcare.js, pension.js childBenefitCharge). Where a pension
// payment would restore it, the link goes to Pension, which has the tax side.
const NATION_NAME = { england: "England", wales: "Wales", scotland: "Scotland", ni: "Northern Ireland" };

export default function MobileKidsDeepDive({ d: answers, m: metrics }) {
  const navigate = useNavigate();
  // This tax year, as the module's status has it (moduleStatus.js).
  const { d, m } = useMemo(() => thisTaxYear(answers, metrics), [answers, metrics]);
  const cc = childcareSupport(d, m);
  const cb = childBenefitCharge(d, m);
  const cbKeep = cb && cb.charge > 0 && cb.payInNeeded <= allowanceLeft(d, m) ? cb.charge : 0;
  // The same lead figure as the answer step by step (moduleReveal.js
  // kidsReveal): childcare a pension payment would restore, else Tax-Free
  // Childcare not claimed, else Child Benefit. Child Benefit alongside the
  // first two is a line under it; Home and Modules show the total.
  const partner = cc?.state === "partner";
  // Lost to their own income over £100,000: the £100k tax trap's figure
  // (taxTrap.js), so not led with here.
  const ownLost = cc?.state === "lost" && !cc.planning;
  const ccLead = (cc?.recoverable && !ownLost) || cc?.planning ? cc.atStake : cc?.unclaimed || 0;
  const lead = ccLead > 0 ? ccLead : cbKeep;
  const label = cc?.planning ? "Childcare support you could get once your child arrives"
    : cc?.recoverable ? (partner ? "Childcare support you and your partner could get" : "Childcare support you could keep")
    : cc?.unclaimed > 0 ? "Tax-Free Childcare you could claim"
    : "Child Benefit you could keep";
  // The pension payment that would open it up: theirs, their partner's, or both.
  const payLine = !cc?.recoverable || ownLost ? null
    : partner ? `A pension payment of ${fmt(cc.partnerPayIn)} from your partner (including the tax relief added) would bring their income to ${fmt(CHILDCARE_INCOME_LIMIT)}${cc.payInNeeded > 0 ? `, and ${fmt(cc.payInNeeded)} from you would do the same for yours` : ""}.`
    : `A pension payment of ${fmt(cc.payInNeeded)} (including the tax relief added) would bring your income to ${fmt(CHILDCARE_INCOME_LIMIT)} and ${cc.planning ? "keep it open to you" : "restore it"}.`;
  const row = { display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:"12px", padding:"12px 0", borderBottom:"1px solid rgba(22,47,36,0.08)" };
  const rowLabel = { fontSize:"13.5px", color:TEXT, fontWeight:600 };
  const rowNote = { fontSize:"12px", color:MUT, marginTop:"2px", lineHeight:1.45 };
  const rowFigure = { fontFamily:SERIF, fontSize:"17px", color:G, fontWeight:700, whiteSpace:"nowrap" };
  const stateLine = !cc ? null
    : cc.state === "lost" ? `Your income is ${fmt(Math.round(cc.ani))}, over the ${fmt(CHILDCARE_INCOME_LIMIT)} limit, so this support stops for the whole year.`
    : cc.state === "partner" ? (cc.recoverable
        ? `Your partner's income is over ${fmt(CHILDCARE_INCOME_LIMIT)}, so this support stops for you both, until a pension payment brings it back under.`
        : cc.partnerPayIn == null
          ? `Your partner's income is over ${fmt(CHILDCARE_INCOME_LIMIT)}, so this support stops for you both. Their income, in Edit inputs, shows the pension payment that would open it up.`
          : `Your partner's income is over ${fmt(CHILDCARE_INCOME_LIMIT)}. Bringing it back would take a pension payment of ${fmt(cc.partnerPayIn)}, more than the usual ${fmt(60000)} allowance.`)
    : cc.state === "near" ? `You're ${fmt(cc.headroom)} under the ${fmt(CHILDCARE_INCOME_LIMIT)} limit. A pay rise or bonus that takes you over would stop it for the whole year.`
    : cc.state === "notWorking" ? "Tax-Free Childcare needs each parent to be working."
    : cc.planning ? `You're under the ${fmt(CHILDCARE_INCOME_LIMIT)} limit, so this support would be yours: both of you need to be working, and each under it, when you apply.`
    : `You're under the ${fmt(CHILDCARE_INCOME_LIMIT)} limit, so this support is yours.`;

  // No children, and none planned: nothing here applies.
  if (kidsSituation(d) === "no") {
    return (
      <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6}}>
        You told us you don't have children and aren't planning any in the next year or two, so nothing here applies. If that changes, Edit inputs brings it in.
      </p>
    );
  }

  return (
    <div>
      {lead > 0 && (
        <OpportunityTile style={{marginBottom:"18px"}} figures={[{ value: fmt(lead), label: `${label} a year` }]}
          chips={[
            cc?.recoverable && !ownLost && cc.payValue > 0 && `Worth about ${fmt(cc.payValue)} of pay before tax`,
            ccLead > 0 && cbKeep > 0 && `+ ${fmt(cbKeep)} Child Benefit paid back in tax`,
          ]}
          note={payLine}/>
      )}

      {cc && (
        <section style={{marginBottom:"18px"}}>
          <div style={{fontSize:"10.5px",fontWeight:700,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>{cc.planning ? "Childcare support once your child arrives" : "Your childcare support"}, {NATION_NAME[cc.nation]}</div>
          <div style={row}>
            <div>
              <div style={rowLabel}>Tax-Free Childcare</div>
              <div style={rowNote}>
                {cc.billKnown ? `20% of your ${fmt(Math.round(+d.childcareMonthly * 12))} a year of childcare, up to ${fmt(TFC_CAP_PER_CHILD)} a child.`
                  : cc.planning ? `${fmt(TFC_CAP_PER_CHILD)} a year, typical for full-time nursery.`
                  : `${fmt(TFC_CAP_PER_CHILD)} for each child not yet at school, typical for full-time nursery.`}
              </div>
            </div>
            <div style={rowFigure}>{fmt(cc.tfc)}</div>
          </div>
          {cc.nation === "england" && cc.preschool > 0 && (
            <div style={row}>
              <div>
                <div style={rowLabel}>30 funded hours</div>
                <div style={rowNote}>30 hours a week for 38 weeks, at about £{CHILDCARE_HOURLY_PRICE.toFixed(2)} an hour, {cc.planning ? "from when your child is 9 months old" : `for ${cc.preschool === 1 ? "your child" : `your ${cc.preschool} children`} not yet at school`}.</div>
              </div>
              <div style={rowFigure}>{fmt(cc.hours)}</div>
            </div>
          )}
          <p style={{fontSize:"13px",color:TEXT,lineHeight:1.55,margin:"12px 0 0"}}>{stateLine}</p>
          {cc.nation === "wales" && cc.preschool > 0 && (
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>Wales's Childcare Offer for 3 and 4 year olds is tested on gross income, which a pension payment doesn't change, so it isn't counted here.</p>
          )}
          {cc.nation === "scotland" && cc.preschool > 0 && (
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,margin:"8px 0 0"}}>Scotland's 1,140 funded hours have no income limit, so they aren't affected.</p>
          )}
        </section>
      )}

      {cb && cb.charge > 0 && (
        <section style={{marginBottom:"18px"}}>
          <div style={{fontSize:"10.5px",fontWeight:700,color:MUT,letterSpacing:"0.09em",textTransform:"uppercase"}}>Child Benefit</div>
          <div style={row}>
            <div>
              <div style={rowLabel}>Paid back in tax</div>
              <div style={rowNote}>1% of your Child Benefit for every £200 of income over £60,000.{cbKeep > 0 ? ` A pension payment of ${fmt(cb.payInNeeded)} would bring your income to £60,000 and keep it all.` : ""}</div>
            </div>
            <div style={rowFigure}>{fmt(cb.charge)}</div>
          </div>
        </section>
      )}

      {ownLost && (
        <button type="button" onClick={() => navigate("/app/module/taxTrap")} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"none",border:"none",borderTop:"1px solid rgba(22,47,36,0.1)",padding:"14px 0",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <span>
            <span style={{display:"block",fontSize:"14px",fontWeight:700,color:G}}>The ways back under £100,000</span>
            <span style={{display:"block",fontSize:"12.5px",color:MUT,marginTop:"2px"}}>In the £100k tax trap, with what each costs in take-home pay</span>
          </span>
          <ChevronRight size={18} color={G}/>
        </button>
      )}
      {cc?.recoverable && !ownLost && (
        <button type="button" onClick={() => navigate("/app/module/pension")} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"none",border:"none",borderTop:"1px solid rgba(22,47,36,0.1)",padding:"14px 0",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <span>
            <span style={{display:"block",fontSize:"14px",fontWeight:700,color:G}}>The tax a pension payment saves</span>
            <span style={{display:"block",fontSize:"12.5px",color:MUT,marginTop:"2px"}}>Worked out in Pension, on the same figures</span>
          </span>
          <ChevronRight size={18} color={G}/>
        </button>
      )}

      {!cc && !(cb && cb.charge > 0) && (
        <p style={{fontSize:"13.5px",color:TEXT,lineHeight:1.6}}>No childcare support or Child Benefit to check on what you've told us. Changing your answers in Edit inputs brings it in.</p>
      )}
    </div>
  );
}
