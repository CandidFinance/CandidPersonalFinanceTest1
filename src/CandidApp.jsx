import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import posthog from "posthog-js";

// ── Supabase client — module level, no package needed ─────────────────────────
const SUPA_URL = import.meta.env?.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
// Only source of production visibility for Supabase failures — DEV console.warn is
// stripped from the production build, so without this, every read/write below can
// fail completely silently (this is what let the report_pdf_requests RLS gap and
// the generateDashboard AI-failure both go undetected).
function reportSupabaseFailure(table, operation, errorMessage, status) {
  if (import.meta.env.DEV) console.warn(`[Candid] Supabase ${operation} on "${table}" failed:`, errorMessage, status ? `(HTTP ${status})` : "(network error)");
  posthog.capture("supabase_operation_failed", { table, operation, error_message: errorMessage, status: status ?? null });
}
async function supaInsert(table, row) {
  if (!SUPA_URL || !SUPA_KEY) return null;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify(row),
    });
    const data = await res.json();
    // A non-2xx response (e.g. an RLS rejection or an unknown table) never throws —
    // fetch() resolves normally, so this must be checked explicitly or it silently
    // falls through to the Array.isArray check below and returns null unreported.
    if (!res.ok) {
      reportSupabaseFailure(table, "insert", data?.message || JSON.stringify(data), res.status);
      return null;
    }
    return Array.isArray(data) && data[0]?.id ? data[0].id : null;
  } catch(e) {
    reportSupabaseFailure(table, "insert", e?.message || String(e));
    return null;
  }
}
async function supaSelect(table, query = "") {
  if (!SUPA_URL || !SUPA_KEY) return null;
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}${query}`, {
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      reportSupabaseFailure(table, "select", data?.message || `HTTP ${res.status}`, res.status);
      return null;
    }
    return await res.json();
  } catch(e) {
    reportSupabaseFailure(table, "select", e?.message || String(e));
    return null;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
input,select,textarea{outline:none;font-family:inherit;}
input:focus,select:focus,textarea:focus{border-color:#162f24!important;box-shadow:0 0 0 3px rgba(22,47,36,0.08);}
button{cursor:pointer;font-family:inherit;}
button:active{transform:scale(0.98);}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
@keyframes coinFloat{0%{opacity:1;transform:translateY(0) scale(1);}100%{opacity:0;transform:translateY(-40px) scale(1.3);}}
@keyframes scorePulse{0%{box-shadow:0 0 0 0 rgba(196,150,58,0.6);}70%{box-shadow:0 0 0 14px rgba(196,150,58,0);}100%{box-shadow:0 0 0 0 rgba(196,150,58,0);}}
@keyframes badgeFadeUp{0%{opacity:0;transform:translateY(8px);}20%{opacity:1;transform:translateY(0);}70%{opacity:1;transform:translateY(0);}100%{opacity:0;transform:translateY(-6px);}}
@keyframes btnFlash{0%{background:#162f24;}40%{background:#c4963a;}100%{background:#162f24;}}
@keyframes btnGold{0%{background:#162f24;}40%{background:#c4963a;}100%{background:#162f24;}}
@keyframes scalePulse{0%{transform:scale(1);}50%{transform:scale(1.08);}100%{transform:scale(1);}}
@keyframes btnPulse{0%{transform:scale(1);}50%{transform:scale(1.08);}100%{transform:scale(1);}}
.fu {animation:fadeUp 0.45s ease forwards;}
.fu1{animation:fadeUp 0.45s ease 0.07s forwards;opacity:0;}
.fu2{animation:fadeUp 0.45s ease 0.14s forwards;opacity:0;}
.fu3{animation:fadeUp 0.45s ease 0.21s forwards;opacity:0;}
.fu4{animation:fadeUp 0.45s ease 0.28s forwards;opacity:0;}
.fu5{animation:fadeUp 0.45s ease 0.35s forwards;opacity:0;}
.fu6{animation:fadeUp 0.45s ease 0.42s forwards;opacity:0;}
.fu7{animation:fadeUp 0.45s ease 0.49s forwards;opacity:0;}
`;

export const G = "#162f24", GOLD = "#c4963a", CREAM = "#f6f0e6", CDARK = "#ede7db",
      TEXT = "#1a1a1a", MUT = "#6b6b6b", WHITE = "#ffffff",
      SERIF = "'Playfair Display',serif", SANS = "'DM Sans',sans-serif";

const INP = {
  width:"100%", padding:"11px 14px", border:"1.5px solid rgba(22,47,36,0.18)",
  borderRadius:"8px", fontSize:"15px", fontFamily:SANS, background:WHITE,
  color:TEXT, marginTop:"6px", transition:"border-color 0.2s,box-shadow 0.2s"
};
const LBL = {
  fontSize:"11px", fontWeight:600, color:MUT, letterSpacing:"0.08em",
  textTransform:"uppercase", display:"block"
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function fmt(n) {
  return new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format(Math.abs(n||0));
}

// Formats a raw numeric value for display inside an input on blur
// type: "gbp" → £12,345 | "pct" → 5.0% | else raw
function fmtInput(val, type) {
  const n = parseFloat(String(val).replace(/[£,%\s]/g,""));
  if (isNaN(n) || val === "") return val;
  if (type === "gbp") return new Intl.NumberFormat("en-GB",{minimumFractionDigits:0,maximumFractionDigits:0}).format(n);
  if (type === "pct") return n % 1 === 0 ? `${n}.0` : `${parseFloat(n.toFixed(1))}`;
  return val;
}
// Strips formatting back to raw number string for onChange
function stripFmt(val) {
  return String(val).replace(/[£,%,\s]/g,"");
}

// A formatted number input that shows £xx,xxx on blur and x.x for %
function FmtInput({ value, onChange, placeholder, fmtType, step, style }) {
  const [display, setDisplay] = useState(value ? fmtInput(value, fmtType) : "");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDisplay(value ? fmtInput(value, fmtType) : "");
  }, [value]);
  const showPrefix = fmtType === "gbp";
  const showSuffix = fmtType === "pct";
  return (
    <div style={{position:"relative", ...style}}>
      {showPrefix && (
        <span style={{position:"absolute",left:"14px",top:"50%",transform:"translateY(-50%)",fontSize:"15px",color:display?"rgba(26,26,26,0.6)":"rgba(26,26,26,0.25)",pointerEvents:"none",lineHeight:1}}>£</span>
      )}
      {showSuffix && (
        <span style={{position:"absolute",right:"14px",top:"50%",transform:"translateY(-50%)",fontSize:"15px",color:display?"rgba(26,26,26,0.6)":"rgba(26,26,26,0.25)",pointerEvents:"none",lineHeight:1}}>%</span>
      )}
      <input
        style={{...INP, paddingLeft: showPrefix ? "26px" : "14px",
                        paddingRight: showSuffix ? "30px" : "14px"}}
        value={display}
        placeholder={placeholder}
        step={step || (fmtType==="pct" ? "0.1" : "1")}
        onFocus={() => { focused.current = true; setDisplay(stripFmt(display)); }}
        onBlur={() => { focused.current = false; setDisplay(value ? fmtInput(value, fmtType) : ""); }}
        onChange={e => {
          const raw = stripFmt(e.target.value);
          setDisplay(e.target.value);
          onChange(raw);
        }}
      />
    </div>
  );
}

// ── Local score delta per module completion ───────────────────────────────────────────
function moduleScoreDelta(status) {
  if (status === "critical") return 8;
  if (status === "attention") return 4;
  if (status === "ok") return 1;
  return 0;
}

// ── User contributing to pension ────────────────────────────────────────────────────────
function isPensionContributing(d) {
  // pensionType has zero effect here — only affects return ratio
  if (d.hasPension !== "yes") return false;
  const pct = Number(d.myContribution);
  return isNaN(pct) || d.myContribution === "" ? false : pct > 0;
}

// ── Pension return ratio (salary sacrifice vs relief at source) ───────────────────────
function pensionReturnRatio(d, m) {
  const isSS = d.pensionType === "sacrifice";
  const niSaving = isSS && m.salary > 50270 ? 0.02 : 0;
  return 1 / Math.max(0.01, 1 - (m.tr + niSaving));
}
function pensionReturnLabel(d, m) {
  const ratio = pensionReturnRatio(d, m);
  if (d.pensionType === "sacrifice") return `1:${ratio.toFixed(2)} — includes income tax + NI saving (employer never sees this income)`;
  if (d.pensionType === "relief") return `1:${ratio.toFixed(2)} — income tax relief only (claim higher rate via self-assessment if applicable)`;
  const low = (1 / Math.max(0.01, 1 - m.tr)).toFixed(2);
  const high = (1 / Math.max(0.01, 1 - (m.tr + 0.02))).toFixed(2);
  return low === high ? `1:${low}` : `1:${low}–1:${high} — check your payslip: if pension deduction appears before tax, it's likely salary sacrifice`;
}

// ── Month-by-month student loan simulator ────────────────────────────────────────────
function simulateLoan(openingBalance, annualSalary, salaryGrowthRate, interestRate, repaymentThreshold, repaymentRate, maxYears = 30, extraMonthly = 0, trackYearly = false) {
  let balance = openingBalance;
  let salary = annualSalary;
  let totalInterest = 0;
  let totalPaid = 0;
  let monthsToClear = null;
  const monthlyRate = interestRate / 12;
  // yearlyInterest[y] = cumulative interest accrued through end of year y (index 0 = £0 at start)
  const yearlyInterest = trackYearly ? [0] : null;
  for (let month = 0; month < maxYears * 12; month++) {
    if (balance <= 0) break;
    const interest = balance * monthlyRate;
    balance += interest;
    totalInterest += interest;
    const annualRepayment = Math.max(0, (salary - repaymentThreshold) * repaymentRate);
    const monthlyRepayment = annualRepayment / 12 + extraMonthly;
    const payment = Math.min(monthlyRepayment, balance);
    balance -= payment;
    totalPaid += payment;
    if (balance <= 0 && monthsToClear === null) monthsToClear = month + 1;
    if ((month + 1) % 12 === 0) {
      salary *= (1 + salaryGrowthRate);
      if (trackYearly) yearlyInterest.push(Math.round(totalInterest));
    }
  }
  // Pad remaining years (if loan cleared early) so yearlyInterest[y] is always valid up to maxYears
  if (trackYearly) {
    while (yearlyInterest.length <= maxYears) yearlyInterest.push(Math.round(totalInterest));
  }
  const cleared = balance <= 0;
  return { totalInterest: Math.round(totalInterest), totalPaid: Math.round(totalPaid), cleared, writtenOff: !cleared, monthsToClear, yearlyInterest };
}

// ── Equivalence engine ────────────────────────────────────────────────────────
// Returns a witty real-world comparison for a £ saving
function getEquivalence(amount) {
  const n = Math.abs(Math.round(amount || 0));
  if (n < 20) return null;

  // Tier 1 — under £500: weekly/monthly treats
  if (n < 100) {
    const pints = Math.round(n / 6.5);
    return `That's ${pints} pints 🍺`;
  }
  if (n < 250) {
    const coffees = Math.round(n / 4.5);
    return `That's ${coffees} flat whites ☕`;
  }
  if (n < 500) {
    const dinners = Math.round(n / 80);
    if (dinners >= 2) return `That's ${dinners} proper date nights 🍽️`;
    const subs = Math.round(n / 25);
    return `That's ${subs} months of your subscription stack 📱`;
  }

  // Tier 2 — £500–£5,000: experiences
  if (n < 800) {
    const pints = Math.round(n / 6.5);
    return `A pint every Friday for ${Math.round(pints / 52)} year${Math.round(pints/52)!==1?"s":""} 🍺`;
  }
  if (n < 1500) {
    const trips = Math.round(n / 120);
    if (trips >= 3) return `That's ${trips} Eurostar weekends in Paris 🚅`;
    const months = Math.round(n / 175);
    return `That's ${months} months of rent on a great room 🏠`;
  }
  if (n < 3000) {
    const festivals = Math.round(n / 375);
    if (festivals >= 2) return `That's ${festivals} Glastonbury tickets 🎪`;
    return `That's a ski week in the Alps ⛷️`;
  }
  if (n < 5000) {
    const flights = Math.round(n / 150);
    return `That's ${flights} return flights — go somewhere 🛫`;
  }

  // Tier 3 — £5,000–£25,000: lifestyle
  if (n < 8000) {
    const months = Math.round(n / 2000);
    return `That's ${months} months of London rent 🏙️`;
  }
  if (n < 15000) {
    const years = +(n / 4200).toFixed(1);
    return `That's ${years} years of car lease payments 🚗`;
  }
  if (n < 25000) {
    return `That's a serious deposit top-up on your first home 🔑`;
  }

  // Tier 4 — £25,000+: life-stage
  if (n < 60000) {
    return `At 6% growth over 30 years, that's ~${fmt(Math.round(n * 5.74))} at retirement 📈`;
  }
  return `At 6% growth over 30 years, that's ~${fmt(Math.round(n * 5.74))} at retirement — retire earlier 🏖️`;
}

// Full marginal income tax calculation (UK 2025/26)
// Handles personal allowance taper (£100k–£125,140 → effective 60% rate)
function calcIncomeTax(gross) {
  const g = Math.max(0, gross);
  const paBase = 12570;
  const taperReduction = Math.max(0, Math.min(paBase, (g - 100000) / 2));
  const pa = Math.max(0, paBase - taperReduction);
  const taxable = Math.max(0, g - pa);
  let tax = 0;
  tax += Math.min(taxable, 37700) * 0.20;
  if (taxable > 37700) tax += Math.min(taxable - 37700, 74870) * 0.40;
  if (taxable > 112570) tax += (taxable - 112570) * 0.45;
  return Math.round(tax);
}

// Returns tax breakdown on a cash bonus given taxable salary (after sacrifice)
function calcBonusTaxBreakdown(taxableSalary, cashBonus) {
  if (cashBonus <= 0) return { tax:0, effectiveRate:0, crossesTaper:false, crossesAR:false };
  const taxTotal = calcIncomeTax(taxableSalary + cashBonus);
  const taxSalary = calcIncomeTax(taxableSalary);
  const tax = Math.max(0, taxTotal - taxSalary);
  const effectiveRate = cashBonus > 0 ? tax / cashBonus : 0;
  const crossesTaper = (taxableSalary < 125140) && (taxableSalary + cashBonus > 100000);
  const crossesAR = taxableSalary + cashBonus > 125140;
  return { tax, effectiveRate, crossesTaper, crossesAR };
}

const SALARY_GROWTH_RATES = { stable:0.02, moderate:0.05, high:0.15 };

// marketRates: { isaRate, nonIsaRate } — the live max(rate_aer) from savings_rates,
// resolved ONCE by the caller (client: Candid's useMemo; server: the PDF route) and
// passed in here as plain numbers so this function stays synchronous. Defaults
// preserve the exact prior hardcoded behaviour for any caller that omits it.
export function calcMetrics(d, marketRates = {}) {
  const { isaRate = 5.1, nonIsaRate = 5.1 } = marketRates;
  const salaryGrowthRate = SALARY_GROWTH_RATES[d.salaryTrajectory] ?? 0.02;
  const salary = +d.salary||0, expenses = +d.monthlyExpenses||0,
        bonds = +d.premiumBonds||0;
  // Cash: prefer sum of cashTiers (more granular); fall back to d.cashSavings
  const tiers = Array.isArray(d.cashTiers) ? d.cashTiers : [];
  const tiersTotal = tiers.reduce((s, t) => s + (+t.amount||0), 0);
  const tiersWeightedRate = tiersTotal > 0
    ? tiers.reduce((s, t) => s + (+t.amount||0) * (+t.rate||0), 0) / tiersTotal
    : 0;
  const effectiveSavingsRate = tiersTotal > 0 ? tiersWeightedRate : (+d.savingsRate||3.5);
  const cash = tiersTotal > 0 ? tiersTotal : (+d.cashSavings||0);
  const totalLiquid = cash + bonds,
        runwayMonths = expenses > 0 ? totalLiquid / expenses : 0,
        bufferMonths = d.higherBuffer === "yes" ? 9 : 6,
        emergencyFund = totalLiquid,
        emergencyBuffer = expenses * bufferMonths,
        emergencyShortfall = Math.max(0, emergencyBuffer - emergencyFund),
        emergencyExcess = Math.max(0, emergencyFund - emergencyBuffer),
        surplusCash = emergencyExcess,
        // ISA: always derived from granular breakdown fields
        isaUsedThisYearCalc = (+d.isaThisYearCash||0) + (+d.isaThisYearSS||0) + (+d.isaThisYearLISA||0) + (+d.isaThisYearOther||0),
        isaHeadroom = Math.max(0, 20000 - isaUsedThisYearCalc),
        myPct = +d.myContribution||0, empCapPct = +d.employerMatch||0,
        missedMatch = Math.max(0, empCapPct - myPct) * salary / 100,
        potVal = (+d.potValue||0) + (+d.potValue2||0),
        retireAge = +d.retirementAge||65,
        age = +d.age||30, years = Math.max(1, retireAge - age),
        annualContrib = (myPct + empCapPct) / 100 * salary,
        projectedPot = potVal * Math.pow(1.06, years) +
          annualContrib * ((Math.pow(1.06, years) - 1) / 0.06);
  let annualRepayment = 0, willClear = false;
  const loanBal = +d.loanBalance||0;
  const slGrow = SALARY_GROWTH_RATES[d.salaryTrajectory] ?? 0.02;
  if (d.studentLoan === "plan2") {
    annualRepayment = Math.max(0, (salary - 27295) * 0.09);
    willClear = (() => { const r = 1 + resolveSlRate(d, salary); let b = loanBal; for (let y=1; y<=30; y++) { const s = salary * Math.pow(1+slGrow,y); b = b*r - Math.max(0,(s-27295)*0.09); if(b<=0) return true; } return false; })();
  } else if (d.studentLoan === "plan5") {
    annualRepayment = Math.max(0, (salary - 25000) * 0.09);
    willClear = (() => { const r = 1 + resolveSlRate(d, salary); let b = loanBal; for (let y=1; y<=40; y++) { const s = salary * Math.pow(1+slGrow,y); b = b*r - Math.max(0,(s-25000)*0.09); if(b<=0) return true; } return false; })();
  } else if (d.studentLoan === "plan1") {
    annualRepayment = Math.max(0, (salary - 24990) * 0.09);
    willClear = (() => { const r = 1 + resolveSlRate(d, salary); let b = loanBal; for (let y=1; y<=25; y++) { const s = salary * Math.pow(1+slGrow,y); b = b*r - Math.max(0,(s-24990)*0.09); if(b<=0) return true; } return false; })();
  }
  const otherIncome = +d.otherIncome||0;
  const dividendIncome = +d.dividendIncome||0;
  const pensionSacrifice = salary * myPct / 100;
  const adjustedNetIncome = salary + otherIncome + dividendIncome - pensionSacrifice;
  const tr = adjustedNetIncome > 125140 ? 0.45
           : adjustedNetIncome > 50270  ? 0.40
           : 0.20;
  const taxBandLabel = adjustedNetIncome > 125140 ? "additional" : adjustedNetIncome > 50270 ? "higher" : "basic";
  // CGT rates on shares/other assets (non-property): 18% basic, 24% higher/additional —
  // aligned with residential property rates from the 30 Oct 2024 Budget. Not 10%/20%,
  // which were the pre-Budget rates.
  const gains = +d.unrealisedGains||0, crystallisable = Math.min(gains, 3000),
        cgtRate = tr !== 0.20 ? 0.24 : 0.18,
        cgtSaving = crystallisable * cgtRate,
        savingsRate = effectiveSavingsRate,
        // Blended, not flat: only isaHeadroom worth of CASH could actually go into an
        // ISA — the rest would realistically land in a (usually lower-rate) non-ISA
        // account. Each portion's gain is measured against the user's own current
        // rate, then summed. The non-ISA portion is floored at £0 (not left negative)
        // — if the best non-ISA rate doesn't even beat the user's current rate,
        // there's nowhere better to move that excess right now.
        // Deliberately `cash`, not `emergencyFund` (= cash + bonds) — premium bonds
        // have their own separate yield-gap calculation (bondsYieldGain, in
        // computeModuleStatuses, based on bondsSurplus). Basing this on emergencyFund
        // would silently double-count the same bonds balance in both calculations.
        isaEligiblePortion = Math.min(cash, isaHeadroom),
        nonIsaPortion = Math.max(0, cash - isaHeadroom),
        isaPortionGain = isaEligiblePortion * (isaRate - savingsRate),
        nonIsaPortionGain = nonIsaPortion * (nonIsaRate - savingsRate),
        cashExcessNotWorthMoving = nonIsaPortionGain < 0,
        annualYieldGap = (isaPortionGain + Math.max(0, nonIsaPortionGain)) / 100,
        // What to actually recommend moving: the full cash balance normally, but
        // capped to the ISA-eligible portion when the excess has nowhere better to
        // go — copy generators use this instead of the raw cash figure so they don't
        // overstate the ask.
        cashMoveAmount = cashExcessNotWorthMoving ? isaEligiblePortion : cash;
  // State pension estimate
  const niYears = +d.niYears||0;
  const statePensionWeekly = (niYears / 35) * 221.20;
  const statePensionAnnual = statePensionWeekly * 52;
  const niYearsToFull = Math.max(0, 35 - niYears);
  // Mortgage fix expiry in days
  let daysToFixExpiry = null;
  if (d.hasMortgage === "yes" && d.fixExpiryMonth && d.fixExpiryYear) {
    const expiryDate = new Date(+d.fixExpiryYear, +d.fixExpiryMonth - 1, 1);
    daysToFixExpiry = Math.round((expiryDate - new Date()) / 86400000);
  }
  // Net worth — use derived ISA totals
  const isaPrevCalc = (+d.isaPrevCash||0) + (+d.isaPrevSS||0) + (+d.isaPrevLISA||0) + (+d.isaPrevOther||0) || (+d.isaPreviousBalance||0);
  const totalIsaValue = isaUsedThisYearCalc + isaPrevCalc;
  const hasMortgage = d.hasMortgage === "yes";
  const propertyEquity = hasMortgage ? (+d.propertyEquity || 0) : (d.ownsOutright ? (+d.outrightPropertyValue || 0) : 0);
  const totalAssets = totalLiquid + totalIsaValue + (+d.unwrappedValue||0) + potVal + propertyEquity;
  const mortgageBalance = hasMortgage ? (+d.mortgageBalance||0) : 0;
  const totalLiabilities = loanBal + mortgageBalance + (d.hasPersonalLoan === "yes" ? (+d.personalLoanBalance||0) : 0);
  // Net worth excludes the mortgage — propertyEquity above is already net of it (it's
  // the equity stake the user enters, not the gross property value), so subtracting
  // mortgageBalance again here would double-count the same debt. Mortgage still shows
  // in totalLiabilities and the liabilities breakdown, just not in this figure.
  const netWorth = totalAssets - (totalLiabilities - mortgageBalance);
  const propertyValue = hasMortgage ? (propertyEquity + (+d.mortgageBalance || 0)) : 0;
  const ltv = hasMortgage && propertyValue > 0 ? Math.round((+d.mortgageBalance / propertyValue) * 100) : null;
  // Pension: user has told us they don't know their pension situation —
  // exclude from the normal "no contributions = critical" scoring
  const pensionStatus = d.pensionUnknown ? "unknown" : null;
  // Personal loan payoff projection — factor in an optional extra annual repayment
  const plMonthly = +d.personalLoanMonthly||0;
  const plAnnualExtra = +d.personalLoanAnnualExtra||0;
  const personalLoanAnnualRepayment = plMonthly * 12 + plAnnualExtra;
  let personalLoanPayoffMonths = null;
  if (d.hasPersonalLoan === "yes") {
    const plBal = +d.personalLoanBalance||0;
    const plRate = +d.personalLoanRate||0;
    const monthlyEquiv = personalLoanAnnualRepayment / 12;
    const r = plRate / 100 / 12;
    if (plBal > 0 && monthlyEquiv > 0) {
      if (r > 0 && monthlyEquiv > plBal * r) {
        personalLoanPayoffMonths = Math.ceil(Math.log(monthlyEquiv / (monthlyEquiv - plBal * r)) / Math.log(1 + r));
      } else if (r === 0) {
        personalLoanPayoffMonths = Math.ceil(plBal / monthlyEquiv);
      }
    }
  }
  // Monthly surplus — rough "free cash" per month after estimated income tax,
  // NI, pension contributions, living expenses, and existing debt repayments.
  // Used as the default monthly contribution for forecasting (see calcForecast).
  const niAnnual = 0.08 * Math.min(Math.max(0, salary - 12570), 37700) + 0.02 * Math.max(0, salary - 50270);
  const incomeTaxAnnual = calcIncomeTax(adjustedNetIncome);
  const netAnnualIncome = adjustedNetIncome - incomeTaxAnnual - niAnnual;
  const existingMortgagePmt = hasMortgage ? (+d.monthlyMortgage||0) : 0;
  const existingPersonalLoanPmt = d.hasPersonalLoan === "yes" ? plMonthly : 0;
  const monthlySurplus = Math.max(0, netAnnualIncome / 12 - expenses - existingMortgagePmt - existingPersonalLoanPmt - annualRepayment / 12);

  return {
    salary, expenses, totalLiquid, runwayMonths,
    emergencyFund, emergencyBuffer, emergencyShortfall, emergencyExcess, surplusCash,
    isaHeadroom, isaUsedThisYear: isaUsedThisYearCalc,
    missedMatch, annualRepayment, willClear, crystallisable, cgtSaving, cgtRate,
    projectedPot, years, annualYieldGap, savingsRate, loanBal, tr,
    cashMoveAmount, cashExcessNotWorthMoving,
    cash, bonds, totalAssets, totalLiabilities, netWorth,
    taxBandLabel, adjustedNetIncome, bufferMonths,
    statePensionWeekly, statePensionAnnual, niYearsToFull,
    daysToFixExpiry, effectiveSavingsRate, salaryGrowthRate,
    propertyEquity, propertyValue, ltv,
    pensionStatus, personalLoanAnnualRepayment, personalLoanPayoffMonths,
    monthlySurplus,
  };
}

// ── Forecast helpers ───────────────────────────────────────────────────────

// Static defaults — replace with live Moneyfacts API rates in future
const CASH_RATE_LOW     = 0.030; // below average, high-street loyal-customer rate
const CASH_RATE_CENTRAL = 0.045; // market-leading easy access rate
const CASH_RATE_HIGH    = 0.050; // best available, a ceiling not a guarantee

// Resolves the effective student loan interest rate for a given user.
// Uses d.studentLoanRate (user-entered, %) if supplied, otherwise falls back to
// statutory defaults. Update defaults each September when SLC publishes annual rates.
// Plan 2: RPI+0%→+3% banded (2024/25 rates; RPI 3.1% → 3.1%–6.1%)
// Plan 5: Prevailing market rate (2024/25: 7.3%)
// Plan 1: Lower of RPI or BoE base+1% (2024/25 floor: 6.25%)
function resolveSlRate(d, grossSalary) {
  if (+d.studentLoanRate > 0) return +d.studentLoanRate / 100;
  if (d.studentLoan === "plan2") return grossSalary > 49130 ? 0.061 : 0.031;
  if (d.studentLoan === "plan5") return 0.073;
  return 0.0625; // plan1 fallback
}

// Future value of a single lump sum invested today, compounded monthly.
function fvSingle(pv, annualRatePct, months) {
  if (pv <= 0 || months <= 0) return 0;
  return pv * Math.pow(1 + annualRatePct / 100 / 12, months);
}

// Future value of a stream of equal monthly contributions, compounded monthly.
// FV = PMT × (((1+r)^n - 1) / r), where r = monthly rate and n = number of months.
function fvAnnuity(pmt, annualRatePct, months) {
  if (months <= 0 || pmt <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return pmt * months;
  return pmt * ((Math.pow(1 + r, months) - 1) / r);
}

// Amortises a repayment loan/mortgage month-by-month at a fixed annual rate,
// with an optional extra monthly overpayment on top of the normal payment.
// Returns total interest paid over maxMonths, and (if the balance clears
// within that window) the month it cleared.
function simulateAmortisation(balance, annualRatePct, monthlyPayment, maxMonths) {
  const r = annualRatePct / 100 / 12;
  let bal = balance, totalInterest = 0, monthsToClear = null;
  for (let month = 1; month <= maxMonths; month++) {
    if (bal <= 0) break;
    const interest = bal * r;
    totalInterest += interest;
    bal += interest;
    const payment = Math.min(monthlyPayment, bal);
    bal -= payment;
    if (bal <= 0 && monthsToClear === null) monthsToClear = month;
  }
  return { totalInterest, monthsToClear, cleared: monthsToClear !== null };
}

// Projects low/central/high values at `horizonYears` for each way the user's
// monthly surplus could be put to work: mortgage overpayment, student loan
// overpayment, Stocks & Shares ISA, cash savings, and pension salary sacrifice.
// Returns { horizonYears, monthlySurplus, options }, where `options` only
// includes entries applicable to this user (applicable: true).
function calcForecast(d, m, surplusOverride, horizonYears, lumpSumOverride = 0) {
  const surplus = surplusOverride != null ? +surplusOverride : m.monthlySurplus;
  const lump = +lumpSumOverride || 0;
  const months = horizonYears * 12;
  const options = [];

  // ── 1. Mortgage overpayment ────────────────────────────────────────────
  const hasOverpayableMortgage = d.hasMortgage === "yes" && !d.ownsOutright && (+d.mortgageBalance||0) > 0;
  if (hasOverpayableMortgage) {
    const bal = +d.mortgageBalance||0;
    const pay = +d.monthlyMortgage||0;
    const baseRate = +d.mortgageRate||0;
    const valueAtRate = (rate) => {
      // Lump sum reduces opening balance immediately; monthly surplus added to regular payment
      const openBal = Math.max(0, bal - lump);
      const base = simulateAmortisation(bal, rate, pay, months);
      const over = simulateAmortisation(openBal, rate, pay + surplus, months);
      let value = base.totalInterest - over.totalInterest + lump;
      if (over.monthsToClear !== null && over.monthsToClear < months) {
        // Freed-up payment invested in cash savings for remaining months
        value += fvAnnuity(pay + surplus, CASH_RATE_CENTRAL * 100, months - over.monthsToClear);
      }
      return value;
    };
    options.push({
      label: "Mortgage overpayment",
      low: Math.round(valueAtRate(Math.max(0, baseRate - 0.5))),
      central: Math.round(valueAtRate(baseRate)),
      high: Math.round(valueAtRate(baseRate + 0.5)),
      applicable: true,
    });
  }

  // ── 2. Student loan overpayment ────────────────────────────────────────
  if (m.loanBal > 0) {
    const writeOffYr = d.studentLoan === "plan2" ? 30 : d.studentLoan === "plan5" ? 40 : 25;
    const threshold  = d.studentLoan === "plan2" ? 27295 : d.studentLoan === "plan5" ? 25000 : 24990;
    const baseSlRate = resolveSlRate(d, m.salary);
    // Cap simulation at write-off year — no point modelling interest past when the loan is forgiven
    const simYears = Math.min(horizonYears, writeOffYr);
    // Lump sum reduces opening balance for the overpayment scenario; baseline is unchanged
    const overBal = Math.max(0, m.loanBal - lump);

    // First check whether overpaying changes the write-off outcome at all
    const baseWriteOff = simulateLoan(m.loanBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, writeOffYr, 0);
    const overWriteOff = simulateLoan(overBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, writeOffYr, surplus);
    // If the loan is written off in both scenarios, overpaying just reduces the amount forgiven — no benefit
    const writtenOffAnyway = !baseWriteOff.cleared && !overWriteOff.cleared;

    let slCentral = 0, slLow = 0, slHigh = 0;
    if (!writtenOffAnyway) {
      // Benefit = cumulative interest saved vs baseline (not a compounding figure)
      const base = simulateLoan(m.loanBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, simYears, 0);
      const over = simulateLoan(overBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, simYears, surplus);
      const interestSaved = Math.max(0, base.totalInterest - over.totalInterest);
      // Low/high reflect salary growth uncertainty — not rate-sensitive
      slCentral = Math.round(interestSaved);
      slLow     = Math.round(interestSaved * 0.85); // slower salary growth → mandatory repayments stretch, less benefit
      slHigh    = Math.round(interestSaved * 1.05); // marginal upside from faster clearance
    }

    options.push({
      label: "Student loan overpayment",
      low: slLow, central: slCentral, high: slHigh,
      applicable: true,
      writtenOffAnyway,
      note: writtenOffAnyway
        ? "Overpaying doesn't change the outcome — this loan is likely written off before clearance regardless."
        : null,
    });
  }

  // ── 3. Stocks & Shares ISA ──────────────────────────────────────────────
  options.push({
    label: "Stocks & Shares ISA",
    low: Math.round(fvSingle(lump, 4, months) + fvAnnuity(surplus, 4, months)),
    central: Math.round(fvSingle(lump, 6, months) + fvAnnuity(surplus, 6, months)),
    high: Math.round(fvSingle(lump, 8, months) + fvAnnuity(surplus, 8, months)),
    applicable: true,
  });

  // ── 4. Cash savings ───────────────────────────────────────────────────────
  // Use hardcoded UK market defaults unless the user has supplied their own rate.
  // d.cashRate and d.savingsRate are stored as percentages (e.g. 4.5 = 4.5%).
  const userRatePct = +d.cashRate > 0 ? +d.cashRate : +d.savingsRate > 0 ? +d.savingsRate : 0;
  // Convert to decimal for spread arithmetic, then back to % for fvAnnuity/fvSingle
  const cashCentralDec = userRatePct > 0 ? userRatePct / 100 : CASH_RATE_CENTRAL;
  const cashLowDec     = userRatePct > 0 ? cashCentralDec - 0.015 : CASH_RATE_LOW;
  const cashHighDec    = Math.min(userRatePct > 0 ? cashCentralDec + 0.005 : CASH_RATE_CENTRAL + 0.005, CASH_RATE_HIGH);
  options.push({
    label: "Cash savings",
    low: Math.round(fvSingle(lump, Math.max(0, cashLowDec * 100), months) + fvAnnuity(surplus, Math.max(0, cashLowDec * 100), months)),
    central: Math.round(fvSingle(lump, cashCentralDec * 100, months) + fvAnnuity(surplus, cashCentralDec * 100, months)),
    high: Math.round(fvSingle(lump, cashHighDec * 100, months) + fvAnnuity(surplus, cashHighDec * 100, months)),
    applicable: true,
  });

  // ── 5. Pension (salary sacrifice) ──────────────────────────────────────
  if (d.pensionType === "sacrifice") {
    // Tax + NI relief boosts every £1 of surplus into the pension immediately.
    const ratio = pensionReturnRatio(d, m);
    options.push({
      label: "Pension (salary sacrifice)",
      low: Math.round(fvSingle(lump * ratio, 4, months) + fvAnnuity(surplus * ratio, 4, months)),
      central: Math.round(fvSingle(lump * ratio, 6, months) + fvAnnuity(surplus * ratio, 6, months)),
      high: Math.round(fvSingle(lump * ratio, 8, months) + fvAnnuity(surplus * ratio, 8, months)),
      applicable: true,
    });
  }

  // ── 6. Pension (relief at source) ──────────────────────────────────────
  if (d.pensionType === "relief") {
    // HMRC adds 20% basic-rate relief automatically — every £1 you put in becomes £1.25 in the pension.
    // Higher/additional rate taxpayers can claim further relief via self-assessment, but we model the
    // conservative floor (basic rate top-up only) to avoid over-stating the benefit.
    const effectiveLump = lump * 1.25;
    const effectiveMonthly = surplus * 1.25;
    options.push({
      label: "Pension (relief at source)",
      low: Math.round(fvSingle(effectiveLump, 4, months) + fvAnnuity(effectiveMonthly, 4, months)),
      central: Math.round(fvSingle(effectiveLump, 6, months) + fvAnnuity(effectiveMonthly, 6, months)),
      high: Math.round(fvSingle(effectiveLump, 8, months) + fvAnnuity(effectiveMonthly, 8, months)),
      applicable: true,
    });
  }

  return { horizonYears, monthlySurplus: surplus, options };
}

// Returns the year-by-year CENTRAL trajectory (years 0..horizonYears) for
// each applicable forecast option, for plotting on a line graph.
// Student loan uses a dedicated cumulative-interest-saved model (rises then
// flatlines once the overpayment scenario clears the loan — see note inline).
// All other options use calcForecast evaluated at each year.
function calcForecastSeries(d, m, surplusOverride, horizonYears, lumpSumOverride = 0) {
  const surplus = surplusOverride != null ? +surplusOverride : m.monthlySurplus;
  const lump = +lumpSumOverride || 0;
  const years = Array.from({ length: horizonYears + 1 }, (_, i) => i);
  const { options } = calcForecast(d, m, surplusOverride, horizonYears, lump);

  const series = options.map(opt => {
    if (opt.label === "Student loan overpayment") {
      // All-zero if written off in both scenarios
      if (opt.writtenOffAnyway) return { label: opt.label, values: years.map(() => 0) };

      const writeOffYr = d.studentLoan === "plan2" ? 30 : d.studentLoan === "plan5" ? 40 : 25;
      const threshold  = d.studentLoan === "plan2" ? 27295 : d.studentLoan === "plan5" ? 25000 : 24990;
      const baseSlRate = resolveSlRate(d, m.salary);
      const overBal = Math.max(0, m.loanBal - lump);
      // Simulate both scenarios once, capturing yearly cumulative interest snapshots
      const simYears = Math.min(horizonYears, writeOffYr);
      const base = simulateLoan(m.loanBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, simYears, 0, true);
      const over = simulateLoan(overBal, m.salary, m.salaryGrowthRate, baseSlRate, threshold, 0.09, simYears, surplus, true);
      // Flatline at the year the overpayment scenario clears: once cleared, the
      // interest saving is fully realised and the curve stops growing.
      const clearYear = over.monthsToClear !== null ? Math.ceil(over.monthsToClear / 12) : null;
      // termYear = the year where the series stops changing (loan cleared or written off)
      const flatlineAt = Math.min(clearYear !== null ? clearYear : simYears, simYears);
      const termYear = flatlineAt < horizonYears ? flatlineAt : null;
      const termLabel = termYear !== null ? (clearYear !== null ? "Cleared" : "Written off") : null;
      return {
        label: opt.label,
        termYear,
        termLabel,
        values: years.map(y => {
          const capY = Math.min(y, clearYear !== null ? clearYear : simYears, simYears);
          const baseInt = base.yearlyInterest[capY] ?? 0;
          const overInt = over.yearlyInterest[capY] ?? 0;
          return Math.max(0, Math.round(baseInt - overInt));
        }),
      };
    }

    // All other options: evaluate calcForecast at each year for the central value
    return {
      label: opt.label,
      values: years.map(y => calcForecast(d, m, surplusOverride, y, lump).options.find(o => o.label === opt.label)?.central ?? 0),
    };
  });

  return { years, series };
}

// ── Premium Bond Context Aware Surfacing ──────────────────────────────────────────
function isNearPremiumBondDraw() {
  const day = new Date().getDate()
  return day >= 29 || day <= 2
}

// ── Module product + insight config ──────────────────────────────────────────

function getModuleInsights(key, d, m, savingsRates) {
  const name = d.name ? d.name.split(" ")[0] : "You";
  switch (key) {
    case "cash": {
      const gap = m.annualYieldGap;
      const cashRate = +d.savingsRate || 3.5;
      // 5.08 fallback only covers the brief window before savingsRates loads.
      const bestISARate = topRate(savingsRates, true)?.rate_aer ?? 5.08;
      // Cash only, deliberately — premium bonds have their own separate yield
      // calculation (bondsYieldGain) and their own tile below; combining them here
      // would double-count the same bonds balance against this tile's gap figure.
      const nonIsaRow = topRate(savingsRates, false);
      const cashSplit = splitByIsaHeadroom(m.cash, m.isaHeadroom, nonIsaRow ? +nonIsaRow.rate_aer : null, cashRate);
      const moveDestination = cashSplit.fitsEntirelyInIsa
        ? `a Cash ISA at ${bestISARate}%`
        : cashSplit.nonIsaWorthMoving
          ? `a Cash ISA at ${bestISARate}% (${fmt(cashSplit.isaPortion)}) and a ${nonIsaRow ? nonIsaRow.rate_aer+"%" : "top-paying"} savings account (${fmt(cashSplit.nonIsaPortion)})`
          : `a Cash ISA at ${bestISARate}% (${fmt(cashSplit.isaPortion)}, your remaining allowance)`;
      // Premium bonds tile folds in the essential "worth keeping?" explainer that used
      // to be its own separate overlay card — same bondAdvantage logic, condensed.
      const psaLimit = m.taxBandLabel==="basic"?1000:m.taxBandLabel==="higher"?500:0;
      const taxableInterest = m.cash * cashRate / 100;
      const interestOverPsa = Math.max(0, taxableInterest - psaLimit);
      const taxOnInterest = interestOverPsa * m.tr;
      const bondAdvantage = m.bonds > 0 && taxOnInterest > 0;
      return [
        {
          // Merges the old "yield gap" and "ISA allowance remaining" tiles, plus the
          // wording from the cross-module "Explore in Investments" nudge (now removed
          // from getCrossModuleLinks to avoid saying the same thing twice) — these were
          // three separate cards all pointing at the same underlying action.
          label:"Cash ISA", value: gap > 200 ? fmt(gap)+"/yr more" : m.isaHeadroom > 0 ? fmt(m.isaHeadroom)+" left" : "Fully used", flag: gap > 200 || m.isaHeadroom > 5000,
          tooltip:`${gap > 200 ? `Gap = your cash (${fmt(m.cash)}) × your rate (${cashRate}%) vs best Cash ISA (${bestISARate}%). Annual difference: ${fmt(gap)}. Moving your surplus to ${moveDestination} would close this. ` : ""}You have ${fmt(m.isaHeadroom)} of ISA allowance remaining this tax year (up to £20,000 total, any combination of Cash and Stocks & Shares) — interest and gains inside an ISA are tax-free, permanently. Allowance resets 6 April and cannot be carried forward.`
        },
        {
          label:"Premium bonds", value: fmt(m.bonds), flag: m.bonds > 0,
          tooltip:`Premium bonds are government-backed savings (via NS&I). Returns come as monthly tax-free prize draws at ~4.4% average rate — no guaranteed return. ${bondAdvantage ? `Worth keeping, potentially worth adding more: your cash is earning ~${fmt(taxableInterest)}/yr in interest, of which ~${fmt(interestOverPsa)} exceeds your Personal Savings Allowance (£${psaLimit.toLocaleString()}) — costing ~${fmt(taxOnInterest)}/yr in tax. Bonds' winnings are entirely tax-free.` : `At your savings level and tax band, your interest likely falls within your Personal Savings Allowance (£${psaLimit.toLocaleString()}/yr), so bonds' tax-free edge over a Cash ISA matters less here — the real trade-off is no guaranteed return vs a Cash ISA's certain rate.`}`
        },
      ];
    }
    case "investments": {
      const unwrapped = +d.unwrappedValue||0;
      const gains = m.crystallisable;
      // Compound illustration: £12k ISA per year for 10 years at 7%
      const isaCompoundEx = Math.round(12000 * ((Math.pow(1.07,10)-1)/0.07));
      return [
        {
          label:"ISA allowance remaining", value: fmt(m.isaHeadroom), flag: m.isaHeadroom > 2000,
          tooltip:`🔒 ISA = tax-free for life. Every £ inside an ISA grows completely free of income tax, dividend tax, and CGT — forever. Your ${fmt(m.isaHeadroom)} of remaining allowance expires on 5 April and CANNOT be carried forward. Example: £12,000/yr invested inside an ISA for 10 years at 7% grows to ~${fmt(isaCompoundEx)} with zero tax due on gains or income, ever. Outside an ISA, you'd owe tax on every dividend and every gain above £3,000.`
        },
        {
          // Merges the old "Unwrapped investments" and "Crystallisable CGT gain" tiles —
          // both were describing the same underlying situation (money sitting outside a
          // wrapper). Leads with the actual £ saved by using this year's £3,000 CGT
          // exempt amount. The old "CGT saving if crystallised now" tile is gone — its
          // one fact (the £ saving) is now the headline number here instead of a
          // separate tile restating it. Full "how to do it / what happens if you don't"
          // mechanics live in the "Crystallise your CGT exemption" panel below, not
          // repeated here, to avoid saying it twice.
          label:"Unwrapped investments", value: gains > 0 ? fmt(m.cgtSaving)+" saved" : unwrapped > 0 ? fmt(unwrapped) : "None", flag: gains > 0 || unwrapped > 0,
          tooltip:`${fmt(unwrapped)} sits outside an ISA or pension wrapper — exposed to CGT on any gains and income tax on dividends.${gains > 0 ? ` You have ${fmt(+d.unrealisedGains||0)} of unrealised gain, of which ${fmt(gains)} falls within this year's £3,000 CGT exempt amount — realising it now costs £0 tax, saving ${fmt(m.cgtSaving)} at your ${Math.round(m.cgtRate*100)}% CGT rate (see "Crystallise your CGT exemption" below for how).` : ""} Consider a Bed & ISA: sell and immediately repurchase inside your ISA — up to ${fmt(m.isaHeadroom)} of headroom this tax year — and all future gains become tax-free.`
        },
      ];
    }
    case "pension": {
      const trPct = Math.round(m.tr * 100);
      const employerLeaving = m.missedMatch;
      const myPct = +d.myContribution||0, empPct = +d.employerMatch||0;
      const annualContrib = (myPct + empPct) / 100 * m.salary;
      const contributing = Number(d.myContribution) > 0;
      const potVal = +d.potValue||0;
      const age = +d.age||30, retireAge = +d.retirementAge||65;
      const years = Math.max(1, retireAge - age);
      const monthlyCost = m.salary > 0 ? Math.round((m.salary * 0.01 / 12) * (1 - m.tr)) : 0;
      // Early retirement: find age at which pot reaches target (25× annual spend, or £400k floor)
      const annualSpend = (m.expenses||2000) * 12;
      const targetPot = Math.max(400000, annualSpend * 25);
      // Binary search for earliest retirement age
      let earlyRetire = retireAge;
      for (let testYrs = 1; testYrs <= years; testYrs++) {
        const pot = potVal * Math.pow(1.06, testYrs) + annualContrib * ((Math.pow(1.06, testYrs) - 1) / 0.06);
        if (pot >= targetPot) { earlyRetire = age + testYrs; break; }
      }
      const yearsSaved = retireAge - earlyRetire;
      const onTrackEarly = yearsSaved > 0 && contributing;
      return [
        {
          label:"Employer match gap", value: employerLeaving > 0 ? fmt(employerLeaving)+"/yr" : "Fully captured ✓", flag: employerLeaving > 0,
          tooltip:`Your employer matches up to ${empPct}% of your salary (${fmt(empPct/100*m.salary)}/yr). You're contributing ${myPct}% (${fmt(myPct/100*m.salary)}/yr). The gap — ${fmt(employerLeaving)}/yr — is money your employer would pay that you are not claiming. This is the highest-priority fix.`
        },
        {
          label:"Pension return ratio", value: pensionReturnLabel(d, m), flag: false,
          tooltip:`For every £1 you put into your pension, you get back ${pensionReturnRatio(d,m).toFixed(2)} in pension value thanks to tax (${d.pensionType==="sacrifice"?"and NI":""}) relief. ${d.pensionType==="sacrifice"?"Salary sacrifice: contributions reduce your gross pay — you save income tax AND employee NI at 2% on earnings above £50,270.":d.pensionType==="relief"?"Relief at source / net pay: your pension provider claims basic-rate tax relief automatically. Higher-rate taxpayers must claim the extra via self-assessment.":"Check your payslip — if pension appears before the income tax calculation it is likely salary sacrifice, which also saves NI."}`
        },
        {
          label:"Projected pot at retirement", value: fmt(m.projectedPot), flag: false,
          tooltip:`Formula: (current pot × 1.06^${years}yrs) + (annual contribution × compound factor). Current pot ${fmt(potVal)} growing for ${years} years = ${fmt(potVal * Math.pow(1.06, years))}. Annual contributions of ${fmt(annualContrib)} compounded = ${fmt(m.projectedPot - potVal * Math.pow(1.06, years))}. Growth rate assumed: 6% p.a. nominal (approximate long-run global equities average). All figures in today's purchasing power terms.`
        },
        {
          label:"Net cost of 1% extra contribution", value: monthlyCost > 0 ? fmt(monthlyCost)+"/mo" : "—", flag: false,
          tooltip:`Adding 1% of your salary (${fmt(m.salary/100/12)}/mo gross) costs you only ${fmt(monthlyCost)}/mo in take-home pay after ${trPct}% tax relief. Over ${years} years at 6% growth, that 1% extra contribution adds roughly ${fmt(m.salary/100 * ((Math.pow(1.06, years)-1)/0.06))} to your pot.`
        },
        onTrackEarly ? {
          label:"Earliest viable retirement age", value: earlyRetire < retireAge ? `${earlyRetire} (${yearsSaved} yr${yearsSaved!==1?"s":""} early)` : `On track for ${retireAge}`, flag: earlyRetire < retireAge,
          tooltip:`Based on your projected pot vs a target of ${fmt(targetPot)} (25× your estimated annual spend of ${fmt(annualSpend)}), you could potentially retire at ${earlyRetire} — ${yearsSaved} year${yearsSaved!==1?"s":""} before your stated target of ${retireAge}. This assumes 6% growth, no salary change, and sustained contributions. Your current habits are working.`
        } : null,
        +d.niYears > 0 ? {
          label:"State pension estimate", value: `${fmt(m.statePensionWeekly)}/wk · ${fmt(m.statePensionAnnual)}/yr`, flag: m.niYearsToFull > 0,
          tooltip:`Based on ${d.niYears} qualifying NI years. Full state pension (£221.20/wk) requires 35 years. You need ${m.niYearsToFull} more year${m.niYearsToFull!==1?"s":""} to reach the full amount. You can check (and fill gaps) via HMRC's Check Your State Pension service.`
        } : null,
      ].filter(Boolean);
    }
    case "studentLoan": {
      const writeOffYr = d.studentLoan==="plan2" ? 30 : d.studentLoan==="plan5" ? 40 : 25;
      const slInterestRate = resolveSlRate(d, m.salary);
      const threshold = d.studentLoan==="plan2" ? 27295 : d.studentLoan==="plan5" ? 25000 : 24990;
      const annualInterest = Math.round(m.loanBal * slInterestRate);
      const annualRep = m.annualRepayment;
      const netAnnualChange = annualInterest - annualRep; // positive = balance GROWING
      const balanceGrowing = netAnnualChange > 0;
      // Inflection point: salary at which repayments equal interest accrual
      const inflectionSalary = Math.round(threshold + (m.loanBal * slInterestRate) / 0.09);
      const salaryGapToInflection = Math.max(0, inflectionSalary - m.salary);
      // Project balance at write-off (or clearance)
      let projBal = m.loanBal;
      let writeOffBal = 0;
      let clearYr = null;
      for (let yr = 1; yr <= writeOffYr; yr++) {
        projBal = projBal * (1 + slInterestRate) - annualRep;
        if (projBal <= 0 && !clearYr) { clearYr = yr; break; }
        if (yr === writeOffYr) writeOffBal = Math.max(0, projBal);
      }
      const totalRepaidProjected = clearYr
        ? Math.round(annualRep * clearYr)
        : Math.round(annualRep * writeOffYr);
      return [
        m.annualRepayment === 0 ? {
          label:"Below repayment threshold", value:"No deductions", flag: true,
          tooltip:`Your salary (${fmt(m.salary)}) is below the ${d.studentLoan.replace("plan","Plan ")} repayment threshold (${fmt(threshold)}/yr). No repayments are being deducted. Interest still accrues at ~${Math.round(slInterestRate*1000)/10}% p.a. (${fmt(annualInterest)}/yr). When your salary crosses the threshold, 9% of earnings above it will be deducted automatically via PAYE.`
        } : null,
        {
          label:"Current balance", value: fmt(m.loanBal), flag: false,
          tooltip:`Your estimated outstanding balance on a ${d.studentLoan.replace("plan","Plan ")} loan. Interest accrues daily at ~${Math.round(slInterestRate*1000)/10}% p.a. — adding approximately ${fmt(Math.round(annualInterest/12))}/month to your balance before any repayments.`
        },
        {
          label:"Annual interest accruing", value: fmt(annualInterest)+"/yr", flag: balanceGrowing,
          tooltip:`At ~${Math.round(slInterestRate*1000)/10}% p.a., your loan is growing by ${fmt(annualInterest)} per year in interest. Your mandatory repayment is ${fmt(annualRep)}/yr. Net: your balance is ${balanceGrowing ? `GROWING by ${fmt(netAnnualChange)}/yr — the interest is outrunning your repayments` : `shrinking by ${fmt(-netAnnualChange)}/yr — you are ahead of interest`}.`
        },
        {
          label: balanceGrowing ? "⚠️ Balance growing — not shrinking" : "Annual balance reduction",
          value: balanceGrowing ? `+${fmt(netAnnualChange)}/yr` : fmt(-netAnnualChange)+"/yr",
          flag: true,
          tooltip: balanceGrowing
            ? `This is the critical number. Your interest (${fmt(annualInterest)}/yr) exceeds your repayments (${fmt(annualRep)}/yr) by ${fmt(netAnnualChange)}/yr. Your balance is getting larger every year. To stop this, your salary would need to reach ${fmt(inflectionSalary)} — the "inflection point" where 9% of income above the threshold equals your annual interest charge. You are ${fmt(salaryGapToInflection)} in salary below that point.`
            : `Your mandatory repayments (${fmt(annualRep)}/yr) exceed your annual interest (${fmt(annualInterest)}/yr). Your balance is shrinking by ${fmt(-netAnnualChange)}/yr. Keep going — you are on the right side of the inflection point.`
        },
        {
          label: clearYr ? "Clears in" : "Written off after",
          value: clearYr ? `${clearYr} years` : `${writeOffYr} years`,
          flag: false,
          tooltip: clearYr
            ? `On current trajectory, your loan clears in ${clearYr} years (age ${(+d.age||30)+clearYr}). Total repaid: ~${fmt(totalRepaidProjected)}. Since you will clear the loan, overpaying today saves interest at ${Math.round(slInterestRate*1000)/10}% — compare this to your savings rate.`
            : `Your loan is written off after ${writeOffYr} years. Projected balance at write-off: ~${fmt(writeOffBal)}. Total repaid before write-off: ~${fmt(totalRepaidProjected)}. This means a significant portion of your original balance will be forgiven — overpaying reduces write-off, giving you less benefit per £ than saving or investing.`
        },
      ].filter(Boolean);
    }
    case "mortgage": {
      const rate = +d.mortgageRate||0;
      const bal  = +d.mortgageBalance||0;
      const mo   = +d.monthlyMortgage||0;
      const monthlyInterest = Math.round(bal * rate / 100 / 12);
      const monthlyPrincipal = Math.max(0, mo - monthlyInterest);
      const annualInterest = monthlyInterest * 12;
      const savRate = +d.savingsRate||4.2;
      const overpayBenefit = (rate - savRate).toFixed(1);
      const fixExpiry = d.fixExpiry||"";
      const fixUrgency = fixExpiry === "under6m" || fixExpiry === "6to12m";
      // Rough LTV assuming property value from balance (very rough — user could provide)
      // Amortisation: months to clear at current payment
      let mos = 0, remaining = bal;
      while (remaining > 0 && mos < 600) {
        remaining = remaining * (1 + rate/100/12) - mo;
        mos++;
        if (remaining <= 0) break;
      }
      const yearsLeft = mos > 0 ? Math.round(mos / 12 * 10) / 10 : null;
      const totalInterestRemaining = mo > 0 && mos > 0 ? Math.max(0, mo * mos - bal) : null;
      return [
        { label:"Monthly interest charge", value: monthlyInterest > 0 ? fmt(monthlyInterest)+"/mo" : "—", flag: false,
          tooltip:`At ${rate}%, ${fmt(monthlyInterest)} of your ${fmt(mo)} monthly payment is interest — not reducing your balance. Only ${fmt(monthlyPrincipal)} goes toward paying down the loan. Early in a mortgage, the interest:principal ratio is at its worst.` },
        { label:"Guaranteed return on overpaying", value: rate > 0 ? `${rate}%` : "—", flag: rate > 4.5,
          tooltip:`Every £1 overpaid saves ${rate}% in interest — guaranteed, risk-free. Your cash earns ${savRate}%. Net advantage of overpaying: ${+overpayBenefit > 0 ? `+${overpayBenefit}% in favour of overpaying` : `${overpayBenefit}% — investing likely wins at your rate`}. At rates above ~4.5%, overpaying typically beats investing in after-tax terms.` },
        { label:"Years remaining at current payment", value: yearsLeft ? `~${yearsLeft} years` : "—", flag: false,
          tooltip: totalInterestRemaining ? `At ${fmt(mo)}/month, you'll clear the mortgage in ~${yearsLeft} years and pay ~${fmt(totalInterestRemaining)} in total interest. Each £10,000 lump sum overpayment today saves approximately ${fmt(Math.round(10000 * rate/100 * yearsLeft * 0.5))} in interest over the remaining term.` : "Enter your monthly payment to see full amortisation." },
        { label:"Fix expiry", value: fixExpiry === "" ? "Not set" : fixExpiry === "variable" ? "Already variable" : fixExpiry.replace("under6m","< 6 months").replace("6to12m","6–12 months").replace("1to2y","1–2 years").replace("2yplus","2+ years"), flag: fixUrgency,
          tooltip: fixUrgency ? `Your fixed rate expires soon. Lenders typically allow you to lock a new rate 6 months before expiry — meaning you should be exploring your options now. A 0.5% rate difference on ${fmt(bal)} saves ${fmt(Math.round(bal*0.005))} per year. Get whole-of-market advice from a fee-free broker.` : `When your fix expires, your lender's standard variable rate (SVR) typically jumps to 7-8%+. Start exploring 6 months before expiry to avoid rolling onto the SVR.` },
        ...(m.ltv !== null ? [{
          label: "Loan to value",
          value: `${m.ltv}%`,
          flag: m.ltv > 75,
          tooltip: m.ltv < 60
            ? `${m.ltv}% LTV — excellent. You'll access the best remortgage rates available. Lenders reserve their top deals for sub-60% LTV borrowers.`
            : m.ltv < 75
            ? `${m.ltv}% LTV — good. You're close to the 75% threshold which unlocks meaningfully better rates. Reducing your balance further before remortgaging could save you.`
            : m.ltv < 85
            ? `${m.ltv}% LTV — standard. Rates improve meaningfully below 75% LTV. Focus on balance reduction to cross the next threshold.`
            : `${m.ltv}% LTV — higher LTV. Focus on reducing your balance before remortgaging. Rates drop significantly at 85%, 75%, and 60% LTV thresholds.`,
        }] : []),
      ];
    }
    default: return [];
  }
}

// ── getModuleInsights extended ─────────────────────────────────────────────────
function getModuleInsightsExtended(key, d, m) {
  switch(key) {
    case "personalLoan": {
      const bal  = +d.personalLoanBalance||0;
      const rate = +d.personalLoanRate||0;
      const mo   = +d.personalLoanMonthly||0;
      const mos  = +d.personalLoanTermRemaining||0;
      const annualInterest = Math.round(bal * rate / 100);
      const totalRemaining = mo * mos;
      const totalInterestRemaining = Math.max(0, totalRemaining - bal);
      const savingsRate = +d.savingsRate||4.2;
      const overpayBenefit = (rate - savingsRate).toFixed(1);
      const annualExtra = +d.personalLoanAnnualExtra||0;
      const monthsSaved = (m.personalLoanPayoffMonths != null && mos > 0) ? Math.max(0, mos - m.personalLoanPayoffMonths) : 0;
      return [
        { label:"Outstanding balance", value: bal > 0 ? fmt(bal) : "—", flag: bal > 5000,
          tooltip:`Your personal loan balance. At ${rate}% AER, you're paying ~${fmt(annualInterest)}/yr in interest on this balance.` },
        { label:"Interest rate", value: rate > 0 ? rate+"% AER" : "—", flag: rate > 8,
          tooltip:`${rate > 8 ? "This is a high rate." : "This is a moderate rate."} Compare to: ISA/savings rate ~${savingsRate}%, pension tax relief ${Math.round(m.tr*100)}%. Overpaying this loan gives a guaranteed ${rate}% return.` },
        { label:"Total interest remaining", value: totalInterestRemaining > 0 ? fmt(totalInterestRemaining) : "—", flag: totalInterestRemaining > 500,
          tooltip:`If you make only the minimum payments over ${mos} months, you'll pay ~${fmt(totalInterestRemaining)} in interest on top of your ${fmt(bal)} balance. Overpaying reduces this directly.` },
        { label:"vs saving: net benefit of overpaying", value: +overpayBenefit > 0 ? `+${overpayBenefit}%` : `${overpayBenefit}%`, flag: +overpayBenefit > 0,
          tooltip:`Your loan rate (${rate}%) minus your savings rate (${savingsRate}%). Overpaying the loan gives a guaranteed ${rate}% return — better than leaving cash in savings by ${overpayBenefit}%. This is the risk-free, after-tax comparison.` },
        ...(annualExtra > 0 && m.personalLoanPayoffMonths != null ? [
          { label:"Payoff time with extra repayment", value:`~${m.personalLoanPayoffMonths} months`, flag: monthsSaved > 0,
            tooltip:`Paying ${fmt(mo)}/mo plus an extra ${fmt(annualExtra)}/yr (${fmt(m.personalLoanAnnualRepayment)}/yr total) clears this loan in ~${m.personalLoanPayoffMonths} months${monthsSaved > 0 ? ` — ${monthsSaved} month${monthsSaved!==1?"s":""} sooner than the ${mos}-month minimum-payment term.` : "."}` },
        ] : []),
      ];
    }
    case "kids": {
      const ages = (d.kidsAges||"").split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
      const youngest = ages.length ? Math.min(...ages) : null;
      const runway = youngest !== null ? 18 - youngest : null;
      const jisaVal = +d.juniorISAValue||0;
      const jisaAllowance = 9000;
      const monthlyAt100 = 100;
      const fvFrom100pm = runway ? Math.round(monthlyAt100 * 12 * ((Math.pow(1.07,runway)-1)/0.07)) : null;
      const fvJISA = runway && jisaVal > 0 ? Math.round(jisaVal * Math.pow(1.07, runway)) : null;
      return [
        { label:"JISA annual allowance", value:"£9,000/yr", flag: false,
          tooltip:`Each child can receive up to £9,000 per tax year into a Junior ISA — all growth is completely tax-free. The child cannot access it until they turn 18, at which point it automatically becomes an adult ISA. Contributions from parents, grandparents, and anyone else all count toward this limit.` },
        youngest !== null ? { label:"Years until youngest turns 18", value:`${Math.max(0,18-youngest)} years`, flag: false,
          tooltip:`Time is your greatest asset when investing for children. Starting early amplifies compound growth dramatically.` } : null,
        fvFrom100pm ? { label:`£100/month from now grows to`, value:fmt(fvFrom100pm), flag: false,
          tooltip:`${fmt(monthlyAt100 * 12 * runway)} invested over ${runway} years at 7% p.a. inside a JISA grows to ~${fmt(fvFrom100pm)} completely tax-free. The same invested outside a JISA would face CGT and income tax on gains.` } : null,
        fvJISA ? { label:"Existing JISA projected at 18", value:fmt(fvJISA), flag: false,
          tooltip:`Your current ${fmt(jisaVal)} JISA balance, invested for ${runway} more years at 7% p.a., projects to ~${fmt(fvJISA)} by the time your child turns 18.` } : null,
      ].filter(Boolean);
    }
    case "inheritance": {
      const estate  = +d.estateValue||0;
      const ihtThreshold = 325000;
      const rnrb = 175000; // Residence Nil Rate Band (if main home passed to children)
      const totalThreshold = ihtThreshold + rnrb;
      const taxableEstate = Math.max(0, estate - totalThreshold);
      const ihtBill = Math.round(taxableEstate * 0.40);
      const annual7yr = 3000; // annual gifting exemption
      const smallGifts = 250;  // per person small gift
      return [
        { label:"Estate value", value: estate > 0 ? fmt(estate) : "Not entered", flag: estate > totalThreshold,
          tooltip:`Your estimated gross estate value. This includes property, savings, investments, and other assets. Pension pots are generally outside your estate for IHT purposes — one reason not to rush drawing your pension.` },
        { label:"IHT nil-rate band available", value: fmt(totalThreshold), flag: false,
          tooltip:`Every UK individual gets a £325,000 nil-rate band (NRB) plus up to £175,000 Residence Nil Rate Band (RNRB) if your main home is passed to direct descendants. Combined: £500,000 tax-free. Married couples and civil partners can combine allowances, giving £1,000,000 before IHT applies. Unused NRB transfers to a surviving spouse.` },
        { label:"Estimated IHT exposure", value: ihtBill > 0 ? `${fmt(ihtBill)} (40% on ${fmt(taxableEstate)})` : "None — within threshold", flag: ihtBill > 0,
          tooltip:`Inheritance tax is charged at 40% on the value of your estate above the available nil-rate band. ${ihtBill > 0 ? `On an estate of ${fmt(estate)}, after the ${fmt(totalThreshold)} threshold, ${fmt(taxableEstate)} is taxable — an IHT bill of ~${fmt(ihtBill)}.` : `Your estate of ${fmt(estate)} is within the available threshold — no IHT is payable on current figures.`}` },
        { label:"Annual gifting allowance", value:"£3,000/yr (carry forward 1 yr)", flag: false,
          tooltip:`You can give away £3,000 per tax year IHT-free, plus carry forward one unused year (max £6,000). Additionally: up to £250 per person to any number of people, £5,000 to a child on marriage, £2,500 to a grandchild. The 7-year rule: larger gifts fall outside your estate after 7 years (tapered relief applies between years 3–7).` },
      ];
    }
    case "mortgage":
      return getModuleInsights("mortgage", d, m);
    default: return getModuleInsights(key, d, m);
  }
}

// Highest-rate row for a given ISA/non-ISA category — returns the whole row
// (not just the number) so display keeps the DB's own "X.XX" string formatting
// rather than reformatting a coerced float. Null if no row of that category.
export function topRate(rows, isIsa) {
  const filtered = (rows || []).filter(r => r.is_isa === isIsa);
  if (!filtered.length) return null;
  return filtered.reduce((best, r) => (!best || +r.rate_aer > +best.rate_aer) ? r : best, null);
}

// Splits a £ amount into "fits within remaining ISA headroom" vs "the rest", and
// whether that rest is actually worth moving to a non-ISA account (only if its rate
// beats the given baseline). Single source of truth for every "move cash into an ISA"
// recommendation — cashMoveAmount alone isn't enough for this, since it returns the
// FULL amount whenever the excess is worth moving *somewhere* (even a non-ISA
// account), and a sentence naming only "a Cash ISA" as the destination is wrong
// whenever amount > isaHeadroom, regardless of whether cashMoveAmount looks "capped".
export function splitByIsaHeadroom(amount, isaHeadroom, nonIsaRatePct, baselineRatePct) {
  const isaPortion = Math.min(amount, isaHeadroom);
  const nonIsaPortion = Math.max(0, amount - isaHeadroom);
  const fitsEntirelyInIsa = nonIsaPortion <= 0;
  const nonIsaWorthMoving = !fitsEntirelyInIsa && nonIsaRatePct != null && nonIsaRatePct > baselineRatePct;
  return { isaPortion, nonIsaPortion, fitsEntirelyInIsa, nonIsaWorthMoving };
}

// Initial visible tile count / "See more" increment for the Cash & savings tile
// list — pagination itself lives at the render site (ModuleDeepDive), not here.
const CASH_TILE_PAGE_SIZE = 5;

function getModuleProducts(key, d, m, savingsRates) {
  switch (key) {
    case "cash": {
      const subheading = m.isaHeadroom > 0
        ? `You have ${fmt(m.isaHeadroom)} of ISA allowance remaining — any interest earned inside an ISA is tax-free, permanently.`
        : "Your ISA allowance is fully used this year. Consider a high-interest easy-access account for remaining cash.";
      const heading = "Best easy-access Cash ISAs right now";

      if (savingsRates === null || savingsRates === undefined) {
        return { heading, subheading: "Loading current rates…", products: [], disclaimer: "" };
      }
      // Tiles are ISA-specific, matching the heading — non-ISA rows still feed
      // topRate(savingsRates, false) elsewhere (e.g. Dashboard copy) but aren't shown here.
      const isaRows = savingsRates.filter(r => r.is_isa === true);
      if (isaRows.length === 0) {
        return { heading, subheading, products: [], disclaimer: "Current rates are temporarily unavailable — check back shortly." };
      }

      const sorted = [...isaRows].sort((a, b) => +b.rate_aer - +a.rate_aer);
      // Conservative "correct as of" date — the oldest row's updated_at, so the
      // disclaimer never overstates freshness for a stale entry in the list.
      const oldestUpdate = sorted.reduce((oldest, r) =>
        !oldest || new Date(r.updated_at) < new Date(oldest) ? r.updated_at : oldest, null);
      const dateLabel = oldestUpdate
        ? new Date(oldestUpdate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "recently";

      return {
        heading, subheading,
        products: sorted.map((r, i) => ({
          name: r.provider_name,
          type: r.account_type,
          rate: `${r.rate_aer}% AER`,
          badge: i === 0 ? "Highest rate" : "",
          highlight: i === 0,
          cta: "View account",
          appIcon: "🏦",
          productUrl: r.product_url,
        })),
        disclaimer: `Rates correct as of ${dateLabel} — always confirm current rates directly with the provider before applying.`,
      };
    }
    case "investments": {
      const daysToTaxYearEnd = (() => {
        const now = new Date();
        const taxEnd = new Date(now.getFullYear(), 3, 5); // April 5
        if (taxEnd < now) taxEnd.setFullYear(taxEnd.getFullYear() + 1);
        return Math.ceil((taxEnd - now) / (1000*60*60*24));
      })();
      const urgencyMsg = daysToTaxYearEnd < 30
        ? `⚠️ ${daysToTaxYearEnd} days left. After April 5th, your allowance is permanently gone.`
        : daysToTaxYearEnd < 90
        ? `${daysToTaxYearEnd} days until your allowance expires on April 5th.`
        : `Your allowance expires on April 5th — ${daysToTaxYearEnd} days away.`;
      // Forward-looking upside illustration rather than just restating the allowance
      // figure (that's already shown in the ISA allowance remaining tile above).
      // Years = UK State Pension age (67) minus current age — not d.retirementAge,
      // which is a different concept (the user's chosen *private* pension access age,
      // captured elsewhere for pension projections). 7% nominal is a common long-term
      // equity-market illustration — explicitly flagged as illustrative, not a
      // forecast, per FCA guidance-vs-advice boundaries.
      const growthRatePct = 7, retirementAge = 67, currentAge = +d.age || 30;
      const growthYears = Math.max(1, retirementAge - currentAge);
      const isaGrowthIllustration = Math.round(m.isaHeadroom * Math.pow(1 + growthRatePct/100, growthYears));
      return {
        heading: m.isaHeadroom > 0 ? `${fmt(m.isaHeadroom)} left unused could become ~${fmt(isaGrowthIllustration)}` : "Your ISA allowance is fully used — well done",
        // The growth-illustration sentence itself is now the chart below (see
        // ModuleDeepDive's "ISA compound-growth chart" block) — this subheading keeps
        // only the surrounding copy: urgency, the tax-free-for-life point, and the
        // hand-off into the provider tiles.
        subheading: m.isaHeadroom > 0
          ? `${urgencyMsg} Entirely free of income tax, dividend tax, and CGT, for life. Here's where you could actually do this:`
          : `You've used your full £20,000 ISA allowance this tax year. New allowance opens on April 6th. If you have unwrapped investments, consider a Bed & ISA strategy next tax year.`,
        products: [
          { name:"Vanguard",      type:"S&S ISA", rate:"0.15%/yr", badge:"Lowest cost",       feature:"Index fund specialist. Best for low-cost, long-term investors. No dealing fees on funds.", cta:"Open S&S ISA", highlight:true },
          { name:"Hargreaves Lansdown", type:"S&S ISA", rate:"0.45%/yr", badge:"Widest range",feature:"15,000+ funds, shares, ETFs. Best platform for active investors and fund switchers.", cta:"Open S&S ISA", highlight:false },
          { name:"Trading 212",   type:"S&S ISA", rate:"0% commission", badge:"Commission-free",feature:"Fractional shares, no dealing fees, instant deposits. Good entry-level platform.", cta:"Open S&S ISA", highlight:false },
          { name:"InvestEngine",  type:"S&S ISA", rate:"0% platform fee", badge:"ETFs only",  feature:"Zero platform fees on ETF portfolios. Very competitive for passive investors.", cta:"Open S&S ISA", highlight:false },
        ],
        disclaimer:"Platform fees shown are indicative annual charges on equity holdings. Fund OCF costs are additional. Investments can fall as well as rise. Tax treatment depends on individual circumstances. Candid may earn a referral fee — this does not affect our ranking.",
      };
    }
    case "pension":
      return {
        heading: d.hasPension === "yes" ? "Consider consolidating or topping up" : "Get started — it takes under 15 minutes",
        subheading: d.hasPension === "yes"
          ? `At your current rate, tax relief means every £${Math.round(100*(1-m.tr))} you contribute becomes £100 in your pension. A higher-rate taxpayer effectively gets ${Math.round(m.tr*100)}% added by HMRC.`
          : `Starting today, a £${Math.round(d.salary ? +d.salary * 0.05 / 12 : 200)}/month contribution would cost you roughly £${Math.round(d.salary ? +d.salary * 0.05 / 12 * (1-m.tr) : 120)} in take-home after tax relief.`,
        products: [
          { name:"PensionBee",    type:"SIPP / consolidation", rate:"0.25–0.75%/yr", badge:"Easiest consolidation", feature:"Combine old pensions in minutes. Tracked via one simple app.", cta:"Start pension", highlight:true },
          { name:"Vanguard SIPP", type:"Self-invested pension", rate:"0.15%+0.06%/yr", badge:"Lowest cost", feature:"Index funds only. Best long-term value for hands-off investors.", cta:"Open SIPP", highlight:false },
          { name:"Moneybox",      type:"Pension",  rate:"0.45%/yr", badge:"App-first",    feature:"Simple pension app with round-ups and auto-escalation.", cta:"Open pension", highlight:false },
        ],
        disclaimer:"Pension tax relief figures are illustrative. Annual allowance is £60,000 (2025/26). Lifetime allowance was abolished April 2024. Always confirm tax relief with your pension provider. Candid may earn a referral fee."
      };
    case "studentLoan": {
      const sl = calcStudentLoanScenario(d, m);
      const { writeOffYr, slInterestRate, slRatePct, annualInterest, annualRep, balanceGrowing, netAnnualChange, inflectionSalary, cashRate, effectiveBenefit, willClear, overpayAnnualBenefit } = sl;
      // Project balance trajectory for each overpayment scenario
      function projectLoan(extraOneOff) {
        let bal = Math.max(0, m.loanBal - extraOneOff);
        let totalPaid = extraOneOff;
        let clearYr = null;
        let writeOffBal = 0;
        for (let yr = 1; yr <= writeOffYr; yr++) {
          bal = bal * (1 + slInterestRate) - annualRep;
          if (bal <= 0 && !clearYr) { clearYr = yr; totalPaid += annualRep * yr; break; }
          if (yr === writeOffYr) { writeOffBal = Math.max(0, bal); totalPaid += annualRep * writeOffYr; }
        }
        const newInterestYr1 = Math.round(Math.max(0, m.loanBal - extraOneOff) * slInterestRate);
        const newNetChange = newInterestYr1 - annualRep;
        const crossesInflection = !clearYr && newNetChange <= 0 && balanceGrowing;
        return { clearYr, writeOffBal: Math.round(writeOffBal), totalPaid: Math.round(totalPaid), newNetChange, crossesInflection, newInterestYr1 };
      }
      const overpayAmounts = [5000, 10000, 20000].filter(x => x < m.loanBal);
      const scenarios = overpayAmounts.map(amt => ({ amt, ...projectLoan(amt) }));
      const baseProjection = projectLoan(0);
      return {
        // Must agree with effectiveBenefit's sign — willClear alone doesn't mean
        // overpaying is worth it; if the loan rate is below what savings could earn,
        // saving wins, and the heading needs to lead with that, not the opposite.
        heading: balanceGrowing
          ? "⚠️ Your loan balance is growing — not shrinking"
          : willClear
          ? (effectiveBenefit > 0 ? "You will clear this loan — overpaying could save interest" : "You will clear this loan — but saving beats overpaying here")
          : "Your loan will be written off — do not overpay",
        subheading: balanceGrowing
          ? `At ${slRatePct}% interest, your balance grows by ${fmt(netAnnualChange)}/yr net. Your repayments (${fmt(annualRep)}/yr) are not keeping up with interest. This is an effective ${slRatePct}% surcharge on your income above the threshold — for as long as your balance keeps growing.`
          : willClear
          ? (effectiveBenefit > 0
              ? `Your repayments are outstripping interest. You'll clear the loan in ~${baseProjection.clearYr} years. Overpaying saves interest at ${slRatePct}% — compare that to your savings rate (${cashRate}%). Net benefit of overpaying vs saving: +${effectiveBenefit}%.`
              : `Your savings rate (${cashRate}%) beats your ${slRatePct}% loan rate, so you're better off saving than overpaying here. You'll clear the loan in ~${baseProjection.clearYr} years through regular repayments alone — no need to divert extra cash to it.`)
          : `At ${slRatePct}% interest, overpaying this loan mostly reduces what gets written off — not what you repay. The better use of spare cash is almost certainly your pension or ISA.`,
        products: [
          { name:"Your pension", type:"Alternative use of funds", rate:`1:${pensionReturnRatio(d,m).toFixed(2)} return`, badge:"Best alternative", feature:`A pension contribution gives an immediate 1:${pensionReturnRatio(d,m).toFixed(2)} return via tax${d.pensionType==="sacrifice"?" and NI":""} relief. ${pensionReturnLabel(d,m)}. Even when the loan balance is growing, this outperforms the ${slRatePct}% loan rate for most people.`, cta:"Go to Pension", highlight:!willClear, internalLink:"pension" },
          { name:"Cash ISA", type:"Alternative use of funds", rate:`Up to ${topRate(savingsRates, true)?.rate_aer ?? "5"}% AER`, badge:"Tax-free", feature:`Your savings rate is ${cashRate}%. Net benefit of overpaying vs saving: ${effectiveBenefit > 0 ? `${effectiveBenefit}% in favour of overpaying` : "saving wins — keep cash in ISA"}.`, cta:"Go to Savings", highlight:false, internalLink:"cash" },
          { name:"Student Finance", type:"Official balance check", rate:"", badge:"Free", feature:"Verify your exact balance, interest rate and repayment history at studentfinance.service.gov.uk.", cta:"Check balance", highlight:false },
        ],
        disclaimer:"Interest rates are estimates based on current RPI and plan thresholds. Actual rates vary — check your SLC online account. This is guidance only. Consider speaking to an IFA before making large overpayments.",
        slSection: {
          balanceGrowing, netAnnualChange, inflectionSalary, slRatePct, scenarios,
          baseProjection, cashRate, writeOffYr, annualRep, annualInterest,
          effectiveBenefit, overpayAnnualBenefit,
          cashSavings: m.cash + m.bonds,
          willClear, belowThreshold: sl.belowThreshold, clearYr: sl.clearYr, threshold: sl.threshold,
        }
      };
    }
    case "mortgage": {
      const rate    = +d.mortgageRate||0;
      const bal     = +d.mortgageBalance||0;
      const mo      = +d.monthlyMortgage||0;
      const savRate = +d.savingsRate||4.2;
      const fixExpiry = d.fixExpiry||"";
      const fixUrgent = fixExpiry === "under6m" || fixExpiry === "6to12m";
      const overpayBenefit = +(rate - savRate).toFixed(1);
      // Overpayment scenario: how much interest does a £10k lump sum save?
      let baseMos = 0, baseRemain = bal;
      while (baseRemain > 0 && baseMos < 600) { baseRemain = baseRemain*(1+rate/100/12)-mo; baseMos++; if(baseRemain<=0) break; }
      let newMos = 0, newRemain = Math.max(0, bal - 10000);
      while (newRemain > 0 && newMos < 600) { newRemain = newRemain*(1+rate/100/12)-mo; newMos++; if(newRemain<=0) break; }
      const monthsSaved   = Math.max(0, baseMos - newMos);
      const interestSaved10k = Math.max(0, (baseMos - newMos) * mo - 10000);
      return {
        heading: fixUrgent ? "⚠️ Your fixed rate expires soon — act now" : rate >= 4.5 ? "Your rate is high — overpaying likely beats saving" : "Your mortgage looks manageable — stay disciplined",
        subheading: fixUrgent
          ? `Your fixed rate expires in ${fixExpiry === "under6m" ? "under 6 months" : "6–12 months"}. Rolling onto your lender's standard variable rate (SVR) — typically 7-8%+ — could cost you ${fmt(Math.round(bal * 0.025 / 12))}/month extra. Lock a new rate now.`
          : rate >= 4.5
          ? `At ${rate}%, overpaying gives a guaranteed ${rate}% return — net advantage vs your savings rate (${savRate}%): +${overpayBenefit}%. A £10,000 lump sum today saves ~${fmt(interestSaved10k)} in interest and cuts ${monthsSaved} months off your term.`
          : `At ${rate}%, the maths marginally favours investing surplus cash over overpaying — your ISA can earn more in expected returns. But overpaying is risk-free; investing isn't. Worth doing both.`,
        products: [
          { name:"L&C Mortgages",   type:"Fee-free whole-of-market broker", rate:"All lenders", badge:"Largest UK broker", feature:"No broker fee. Access to every major lender. Particularly strong for remortgaging — will model your current deal vs market.", cta:"Explore remortgage", highlight:fixUrgent, appIcon:"🏠", demoNote:"Would open L&C remortgage flow" },
          { name:"Habito",          type:"Fee-free digital broker",          rate:"90+ lenders", badge:"Fastest",          feature:"Whole-of-market in minutes online. Strong for employed borrowers in straightforward situations.", cta:"Get quotes", highlight:!fixUrgent && rate >= 4.5, appIcon:"💻", demoNote:"Would open Habito quote tool" },
          { name:"Mojo Mortgages",  type:"Fee-free broker",                  rate:"Whole of market", badge:"Award-winning", feature:"Human advisers + digital tools. Good for more complex cases.", cta:"Get advice", highlight:false, appIcon:"📱", demoNote:"Would open Mojo Mortgages" },
          { name:"Sprive",          type:"Mortgage overpayment app",          rate:`Saves at ${rate}%`, badge:"Overpayment", feature:"Round-up and automate overpayments. Tracks how many years you're shaving off your term in real time.", cta:"Try Sprive", highlight:false, appIcon:"⚡", demoNote:"Would open Sprive app" },
        ],
        disclaimer:"Mortgage products are subject to status and valuation. Your home may be repossessed if you do not keep up repayments. Brokers shown earn commission from lenders — no cost to you. Candid may earn a referral fee.",
        mortgageSection: { bal, rate, mo, monthsSaved, interestSaved10k, fixUrgent, fixExpiry, savRate, overpayBenefit }
      };
    }
    default:
      return null;
  }
}

// ── getModuleProducts extended ────────────────────────────────────────────────
function getModuleProductsExtended(key, d, m) {
  switch(key) {
    case "personalLoan": {
      const bal  = +d.personalLoanBalance||0;
      const rate = +d.personalLoanRate||0;
      const mo   = +d.personalLoanMonthly||0;
      const mos  = +d.personalLoanTermRemaining||0;
      const interest5yr = Math.round(bal * (rate/100) * Math.min(5, mos/12));
      return {
        heading:"Should you pay it off faster?",
        subheading: rate > 8
          ? `At ${rate}%, this loan is almost certainly your highest-priority debt. Every £ used to overpay gives a guaranteed ${rate}% return — better than any savings account, and risk-free. The only thing to weigh against it is pension tax relief.`
          : `At ${rate}%, the case for overpaying depends on your alternatives. Compare against your savings rate, ISA returns, and especially pension tax relief before paying down.`,
        products: [
          { name:"Your pension first",     type:"Priority check", rate:Math.round(m.tr*100)+"% instant return", badge:"Check this first", feature:`Pension tax relief gives an immediate ${Math.round(m.tr*100)}% return. If you haven't maxed employer match, do that before any debt overpayment.`, cta:"Go to Pension", highlight:rate < 15, internalLink:"pension", appIcon:"🏦" },
          { name:"Pay off loan early",     type:"Overpayment",    rate:rate+"% guaranteed",        badge:rate>8?"Best return":"Good return", feature:`Overpaying by even £100/month saves ${fmt(interest5yr)} in interest. Check your loan agreement — most allow 10% overpayment per year penalty-free.`, cta:"Contact your lender", highlight:rate > 8, appIcon:"💳", demoNote:"Would open lender app" },
          { name:"Consolidation loan",     type:"Refinancing",    rate:"From 5.9% AER",            badge:"Lower your rate", feature:"If your credit score has improved since taking the loan, you may qualify for a lower rate. Saves interest without locking up savings.", cta:"Compare rates", highlight:false, appIcon:"🔄", demoNote:"Would open comparison site" },
          { name:"0% balance transfer",    type:"If eligible",    rate:"0% for up to 30 months",  badge:"If eligible", feature:"Some lenders offer personal loan refinancing via 0% credit facilities. Only relevant if your balance is manageable within the 0% window.", cta:"Check eligibility", highlight:false, appIcon:"🏛️", demoNote:"Would open MoneySupermarket" },
        ],
        disclaimer:"Overpayment terms vary by lender. Check your loan agreement before making extra payments — early repayment charges may apply on some products. Candid may earn a referral fee.",
        overpaySection: { bal, rate, mo, mos }
      };
    }
    case "kids": {
      const ages = (d.kidsAges||"").split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
      const youngest = ages.length ? Math.min(...ages) : 10;
      const runway = Math.max(1, 18 - youngest);
      const monthly50 = Math.round(50 * 12 * ((Math.pow(1.07,runway)-1)/0.07));
      const monthly100 = Math.round(100 * 12 * ((Math.pow(1.07,runway)-1)/0.07));
      const childPensionNet = 2880, childPensionGross = 3600;
      const childPensionFV = Math.round(childPensionGross * Math.pow(1.07, Math.max(40, 65-youngest)));
      return {
        heading:"Building your child's financial future",
        subheading:`A Junior ISA gives every £ you invest a tax-free runway until your child turns 18. With ${runway} years of compound growth at 7%, even small monthly contributions become meaningful. The earlier you start, the more time does the heavy lifting.`,
        products: [
          { name:"Hargreaves Lansdown JISA", type:"Junior S&S ISA", rate:"0.45%/yr", badge:"Most popular",   feature:"Easy to manage alongside your own HL accounts. Wide fund choice. Max £9,000/yr.", cta:"Open Junior ISA", highlight:true, appIcon:"📱", demoNote:"Would open HL app" },
          { name:"Vanguard JISA",             type:"Junior S&S ISA", rate:"0.15%/yr", badge:"Lowest cost",    feature:"Index fund focus. Extremely low charges. Best for low-cost long-term growth.", cta:"Open Junior ISA", highlight:false, appIcon:"📱", demoNote:"Would open Vanguard app" },
          { name:"OneFamily JISA",            type:"Junior S&S ISA", rate:"0.0%/yr",  badge:"No platform fee", feature:"JISA specialist. No platform fee. Popular for grandparent contributions.", cta:"Open Junior ISA", highlight:false, appIcon:"🌐", demoNote:"Would open OneFamily site" },
          { name:"Child pension (SIPP)",      type:"Child SIPP",     rate:"Tax relief on contributions", badge:"Little-known gem", feature:`You can contribute £${childPensionNet} net/yr — HMRC tops it up to £${childPensionGross}. At 7% growth to age 65, that single year's contribution could be worth ~${fmt(childPensionFV)}.`, cta:"Open Child SIPP", highlight:false, appIcon:"🏦", demoNote:"Would open PensionBee" },
        ],
        disclaimer:`JISA allowance is £9,000 per tax year (2025/26). Money is locked until the child turns 18. Investments can fall as well as rise. Child SIPP contributions count toward the £3,600 annual pension allowance for non-earners. Candid may earn a referral fee.`,
        kidsSection: { monthly50, monthly100, runway, childPensionFV }
      };
    }
    case "inheritance": {
      const estate  = +d.estateValue||0;
      const ihtThreshold = 500000; // NRB + RNRB
      const taxable = Math.max(0, estate - ihtThreshold);
      const ihtBill = Math.round(taxable * 0.40);
      const yr7saving = Math.round(estate * 0.40 * 0.20); // approximate taper saving
      return {
        heading: ihtBill > 0 ? `~${fmt(ihtBill)} potential IHT bill — there are legal ways to reduce it` : "Your estate looks within IHT thresholds — but planning is still worthwhile",
        subheading: ihtBill > 0
          ? `At 40% on the taxable portion, HMRC could receive ${fmt(ihtBill)} from your estate. Proactive planning — gifting, trusts, pension use, and will structuring — can dramatically reduce or eliminate this. Every year of inaction is a missed opportunity.`
          : `No immediate IHT exposure on current figures. But estate values change — property growth, pension drawdown, and inheritance itself can push you into IHT territory. Planning now is always easier than planning later.`,
        products: [
          { name:"Farewill",            type:"Will writing",           rate:"From £90",           badge:"Fastest UK will", feature:"Online will in 15 minutes. Solicitor-checked. The most important document most people delay indefinitely.", cta:"Write a will", highlight:d.hasWill !== "yes", appIcon:"📄", demoNote:"Would open Farewill will-writing flow" },
          { name:"IFA / estate planner",type:"Independent advice",     rate:"One-off or ongoing", badge:"Most impactful",  feature:"A specialist IFA can model your full estate, identify gifting opportunities, and set up trusts. For estates over £500k this advice typically pays for itself many times over.", cta:"Find an IFA", highlight:ihtBill > 0, appIcon:"👔", demoNote:"Would open VouchedFor IFA search" },
          { name:"Whole-of-life policy", type:"IHT insurance",         rate:"Covers IHT bill",    badge:"Pays the bill",  feature:"A whole-of-life policy written in trust pays out on death specifically to cover the IHT liability — preserving the estate intact for your beneficiaries. Premiums depend on age and health.", cta:"Get a quote", highlight:false, appIcon:"🛡️", demoNote:"Would open Cavendish Online" },
          { name:"Lifetime ISA (LISA)",  type:"For under-40s",         rate:"25% bonus",          badge:"Bonus if eligible", feature:"If you're under 40, a Lifetime ISA gives a 25% government bonus on up to £4,000/yr — outside your estate from day one. Useful for estate planning alongside retirement saving.", cta:"Open a LISA", highlight:false, appIcon:"💰", demoNote:"Would open Moneybox LISA" },
        ],
        disclaimer:"IHT rules are complex and subject to change — the figures above are illustrative. Trusts, gifts, and insurance should be set up with professional advice. Candid may earn a referral fee.",
        inheritanceSection: { estate, ihtBill, ihtThreshold, taxable,
          sevenYrRule: `Gifts over £3,000/yr fall outside your estate after 7 years. Taper relief applies years 3–7 (declining from 80% to 20% of the potential tax). Starting gifting earlier gives time more runway.`,
          pensionNote: `Pension pots are generally outside your estate for IHT purposes. This makes leaving pension funds undrawn (and using other savings/ISAs first) a powerful estate planning strategy.`,
        }
      };
    }
    case "mortgage":
      return getModuleProducts("mortgage", d, m);
    default: return getModuleProducts(key, d, m);
  }
}

function getCrossModuleLinks(key, d, m) {
  const links = [];
  if (key === "cash" && d.hasPension !== "yes") {
    links.push({ icon:"🏦", text:"You have no pension — the tax relief on contributions will likely outperform any savings rate.", label:"Go to Pension", target:"pension" });
  }
  if (key === "studentLoan" && d.hasPension !== "yes") {
    links.push({ icon:"🏦", text:"Instead of overpaying your loan, redirecting that money into a pension gives an immediate return via tax relief — almost certainly a better use of the funds.", label:"Start a pension", target:"pension" });
  }
  if (key === "personalLoan" && d.hasPension === "yes" && m.missedMatch > 0) {
    links.push({ icon:"🏦", text:`You're missing ${fmt(m.missedMatch)}/yr of employer pension match. That's free money — clear this before overpaying your loan.`, label:"Fix pension match first", target:"pension" });
  }
  if (key === "personalLoan" && m.emergencyFund > +d.personalLoanBalance * 1.5) {
    links.push({ icon:"💷", text:`You have ${fmt(m.emergencyFund)} in accessible cash — potentially enough to clear this loan entirely. Weigh the guaranteed ${d.personalLoanRate}% return of clearing vs keeping cash liquid.`, label:"Review cash position", target:"cash" });
  }
  if (key === "kids" && m.isaHeadroom > 5000) {
    links.push({ icon:"📈", text:"Maximise your own ISA before the kids' JISAs — your tax-free allowance is larger and the principle applies equally.", label:"Review your ISA", target:"investments" });
  }
  if (key === "kids" && d.hasPension !== "yes") {
    links.push({ icon:"🏦", text:"Sorting your own pension before a child's JISA will give you more money to pass on in the long run.", label:"Set up your pension first", target:"pension" });
  }
  if (key === "mortgage" && m.isaHeadroom > 5000) {
    links.push({ icon:"📈", text:`Before overpaying your mortgage, consider whether maxing your ISA (${fmt(m.isaHeadroom)} remaining) is a better use of the same cash.`, label:"Review in Investments", target:"investments" });
  }
  return links;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Field({ label:lb, hint, children }) {
  return (
    <div style={{marginBottom:"22px"}}>
      <label style={LBL}>{lb}</label>
      {hint && <p style={{fontSize:"12px",color:MUT,marginTop:"2px",marginBottom:"2px"}}>{hint}</p>}
      {children}
    </div>
  );
}

function Toggle({ value, onChange, options }) {
  return (
    <div style={{display:"flex",gap:"8px",marginTop:"6px",flexWrap:"wrap"}}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: o.full ? "1 1 100%" : "1 1 auto", minWidth:"72px", padding:"10px 8px",
          border:`1.5px solid ${value===o.value ? G : "rgba(22,47,36,0.18)"}`,
          borderRadius:"8px", background:value===o.value ? G : WHITE,
          color:value===o.value ? WHITE : TEXT,
          fontSize:"13px", fontWeight:500, transition:"all 0.15s"
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label style={{
      display:"flex", alignItems:"flex-start", gap:"10px", cursor:"pointer",
      marginBottom:"20px", padding:"13px 16px",
      border:`1.5px solid ${checked ? G : "rgba(22,47,36,0.18)"}`,
      borderRadius:"8px", background:checked ? "rgba(196,150,58,0.08)" : WHITE,
      transition:"all 0.15s"
    }}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}
        style={{marginTop:"2px", width:"16px", height:"16px", accentColor:G, flexShrink:0, cursor:"pointer"}}/>
      <span style={{fontSize:"14px", color:TEXT, lineHeight:1.5}}>{label}</span>
    </label>
  );
}

function NavBar({ right, center }) {
  return (
    <div style={{background:G,padding:"18px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
      <span style={{fontFamily:SERIF,color:GOLD,fontSize:"22px",fontWeight:700}}>Candid.</span>
      {center && <span style={{color:"rgba(255,255,255,0.5)",fontSize:"12px",fontWeight:500}}>{center}</span>}
      {right}
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div style={{height:"3px",background:CDARK,flexShrink:0}}>
      <div style={{height:"3px",background:GOLD,width:`${pct}%`,transition:"width 0.4s ease"}}/>
    </div>
  );
}

// Tracks window width via a resize listener — shared breakpoint pattern for
// switching between mobile and desktop/tablet layouts.
function useWindowWidth() {
  const [width, setWidth] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

const STEP_SHORT_LABELS = ["Name","Email","Interests","Income","Savings","Invest.","Pension","Debt"];
const STEP_MOBILE_LABELS = ["Name","Email","Int.","Inc.","Sav.","Inv.","Pension","Debt"];

function StepProgress({ step, steps, onStepClick, isEditMode }) {
  const windowWidth = useWindowWidth();
  const isNarrow = windowWidth < 480;
  const WINDOW_SIZE = 4;
  // On narrow screens, slide a 4-circle window that keeps the current step visible
  // without overflowing past the first or last step.
  const start = isNarrow ? Math.max(0, Math.min(step - (WINDOW_SIZE - 1), steps.length - WINDOW_SIZE)) : 0;
  const visibleIndices = isNarrow
    ? Array.from({ length: Math.min(WINDOW_SIZE, steps.length) }, (_, idx) => start + idx)
    : steps.map((_, i) => i);

  return (
    <div style={{background:WHITE,borderBottom:`1px solid ${CDARK}`,padding:"20px 24px",flexShrink:0,overflow:"hidden"}}>
      <div style={{maxWidth:"580px",margin:"0 auto",display:"flex",alignItems:"center"}}>
        {visibleIndices.map((i, idx) => {
          const label = steps[i];
          const done = i < step;
          const current = i === step;
          const size = current ? 34 : 28;
          const clickable = (isEditMode || done) && !!onStepClick && i !== step;
          const shortLabel = (isNarrow ? STEP_MOBILE_LABELS[i] : STEP_SHORT_LABELS[i]) || label;
          const isLastVisible = idx === visibleIndices.length - 1;
          return (
            <div key={i} style={{display:"flex",alignItems:"center",flex: !isLastVisible ? 1 : 0}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",flexShrink:0}}>
                <div
                  onClick={clickable ? () => onStepClick(i) : undefined}
                  style={{
                    width:`${size}px`, height:`${size}px`, borderRadius:"50%",
                    background: done ? G : current ? WHITE : isEditMode ? "rgba(22,47,36,0.12)" : "rgba(22,47,36,0.08)",
                    border: current ? `2px solid ${GOLD}` : clickable ? `2px solid rgba(22,47,36,0.3)` : done ? "none" : "2px solid rgba(22,47,36,0.15)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all 0.3s ease",
                    cursor: clickable ? "pointer" : "default",
                    opacity: i > step && !isEditMode ? 0.4 : 1,
                  }}
                  title={clickable ? `Jump to ${label}` : undefined}
                >
                  {done
                    ? <span style={{color:WHITE,fontSize:"13px",fontWeight:700}}>✓</span>
                    : <span style={{color: current ? G : isEditMode ? G : MUT, fontSize:"12px", fontWeight:600}}>{i+1}</span>
                  }
                </div>
                <span style={{fontSize:"10px",fontWeight:600,color:current?G:done?G:MUT,letterSpacing:"0.04em",whiteSpace:"nowrap",opacity:current?1:done?0.7:(isEditMode?0.7:0.5)}}>{shortLabel}</span>
              </div>
              {!isLastVisible && (
                <div style={{flex:1,height:"2px",background: i < step ? G : "rgba(22,47,36,0.12)",marginBottom:"18px",marginLeft:"6px",marginRight:"6px",transition:"background 0.4s ease"}}/>
              )}
            </div>
          );
        })}
      </div>
      <div style={{maxWidth:"580px",margin:"6px auto 0",textAlign:"center",fontSize:"11px",color:MUT}}>
        {isEditMode ? "Click any step to jump directly to it" : `Step ${step + 1} of ${steps.length}`}
      </div>
    </div>
  );
}

function GhostBtn({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"6px",padding:"6px 14px",color:"rgba(255,255,255,0.6)",fontSize:"12px"}}>
      {children}
    </button>
  );
}

function PageWrap({ children }) {
  return (
    <div style={{minHeight:"100vh",background:CREAM,fontFamily:SANS,display:"flex",flexDirection:"column"}}>
      <style>{FONTS}</style>
      {children}
    </div>
  );
}

function ContentWrap({ children, maxWidth="580px" }) {
  return (
    <div style={{maxWidth,margin:"0 auto",padding:"44px 24px 80px",width:"100%"}}>
      {children}
    </div>
  );
}

// ── Full onboarding ───────────────────────────────────────────────────────────
const STEPS = ["Name","Email","Interests","About you","Cash & savings","Investments","Pension","Debt"];

function OnboardingScreen({ step, steps, d, set, insights, onBack, onBackToDashboard, onContinue, onStepClick, onClearData }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [step]);
  return (
    <PageWrap>
      <NavBar center={`Step ${step+1} of ${steps.length} — ${steps[step]}`}
        right={insights ? <GhostBtn onClick={onBackToDashboard}>← Back to report</GhostBtn> : null}/>
      <StepProgress step={step} steps={steps} onStepClick={onStepClick} isEditMode={!!insights}/>
      <ContentWrap>
        <OnboardingStep step={step} d={d} set={set}/>
        <div style={{display:"flex",gap:"10px",marginTop:"40px"}}>
          <button onClick={onBack} style={{flex:1,padding:"13px",background:"transparent",border:"1.5px solid rgba(22,47,36,0.22)",borderRadius:"8px",fontSize:"15px",color:TEXT,fontWeight:500}}>← Back</button>
          <button
            onClick={onContinue}
            disabled={step === 0 && !d.name.trim()}
            style={{flex:2,padding:"13px",background:G,border:"none",borderRadius:"8px",fontSize:"15px",fontWeight:600,color:WHITE,opacity:(step===0 && !d.name.trim()) ? 0.45 : 1,cursor:(step===0 && !d.name.trim()) ? "not-allowed" : "pointer"}}
          >
            {step===steps.length-1 ? (insights ? "Regenerate my report →" : "Generate my Candid report →") : "Continue →"}
          </button>
        </div>
        {step === 1 && (
          <p style={{textAlign:"center",marginTop:"14px"}}>
            <button type="button" onClick={onContinue} style={{background:"none",border:"none",fontSize:"13px",color:MUT,cursor:"pointer",textDecoration:"underline",padding:0}}>
              Skip
            </button>
          </p>
        )}
        <p style={{marginTop:"18px",textAlign:"center",fontSize:"11px",color:MUT,lineHeight:1.6}}>
          🔒 Your data is never sold or shared. Candid is guidance, not advice.
        </p>
        {onClearData && (
          <p style={{textAlign:"center",marginTop:"6px"}}>
            <button type="button" onClick={onClearData} style={{background:"none",border:"none",fontSize:"11px",color:MUT,cursor:"pointer",textDecoration:"underline",padding:0}}>
              Clear saved data
            </button>
          </p>
        )}
      </ContentWrap>
    </PageWrap>
  );
}

function Warn({ msg }) {
  if (!msg) return null;
  return <p style={{fontSize:"12px",color:"#c4963a",marginTop:"4px",lineHeight:1.5}}>⚠️ {msg}</p>;
}

// Hard caps — silently clamp value, no message shown
const FIELD_CAPS = {
  salary:1000000, bonusAmount:5000000, otherIncome:1000000, dividendIncome:5000000,
  monthlyExpenses:50000,
  savingsRate:10, premiumBonds:50000,
  isaThisYearCash:20000, isaThisYearSS:20000, isaThisYearLISA:4000, isaThisYearOther:20000,
  isaPrevCash:500000, isaPrevSS:500000, isaPrevLISA:500000, isaPrevOther:500000,
  unwrappedValue:10000000, unrealisedGains:5000000,
  myContribution:60, employerMatch:20,
  potValue:10000000, potValue2:10000000, niYears:35,
  loanBalance:200000, mortgageBalance:5000000, mortgageRate:15,
  personalLoanBalance:500000, personalLoanRate:50,
};
function capField(field, raw) {
  const v = parseFloat(String(raw).replace(/[£,%,\s]/g,""));
  if (isNaN(v)) return raw;
  const cap = FIELD_CAPS[field];
  if (cap !== undefined && v > cap) return String(cap);
  return raw;
}

function InfoTooltip({ text }) {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const open = (e) => {
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    // Position above the button, clamped so the 270px box stays inside the viewport
    setPos({
      bottom: window.innerHeight - r.top + 6,
      left: Math.max(140, Math.min(r.left + r.width / 2, window.innerWidth - 140)),
    });
  };
  return (
    <span style={{display:"inline-block",marginLeft:"6px",verticalAlign:"middle"}}>
      <button ref={btnRef} type="button" onClick={open}
        style={{width:"17px",height:"17px",borderRadius:"50%",background:G,border:"none",color:WHITE,fontSize:"10px",fontWeight:700,cursor:"pointer",lineHeight:1,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        ?
      </button>
      {pos && (
        <div style={{position:"fixed",bottom:pos.bottom+"px",left:pos.left+"px",transform:"translateX(-50%)",width:"270px",whiteSpace:"normal",background:G,color:WHITE,borderRadius:"10px",padding:"14px 16px",fontSize:"12px",lineHeight:1.65,zIndex:1000,boxShadow:"0 8px 24px rgba(0,0,0,0.22)"}}>
          {text}
          <button type="button" onClick={e=>{e.stopPropagation();setPos(null)}} style={{position:"absolute",top:"8px",right:"10px",background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:"15px",cursor:"pointer",lineHeight:1}}>×</button>
        </div>
      )}
    </span>
  );
}

function OnboardingStep({ step, d, set }) {
  const g2 = {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"};
  const [showAdditionalIncome, setShowAdditionalIncome] = useState(false);
  const INTEREST_TILES = [
    { key:"savings",      emoji:"💷", label:"Savings"      },
    { key:"investments",  emoji:"📈", label:"Investments"  },
    { key:"pensions",     emoji:"👵", label:"Pensions"     },
    { key:"mortgages",    emoji:"🏠", label:"Mortgages"    },
    { key:"studentLoans", emoji:"🎓", label:"Student Loans"},
    { key:"tax",          emoji:"🧾", label:"Tax"          },
  ];
  if (step === 0) return (
    <div style={{textAlign:"center",paddingTop:"20px"}}>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"12px"}}>What should we call you?</h2>
      <input
        style={{...INP,maxWidth:"340px",margin:"0 auto",display:"block",textAlign:"center",fontSize:"17px",padding:"14px 18px"}}
        value={d.name}
        onChange={e => set("name", e.target.value)}
        placeholder="Your first name"
        autoFocus
      />
    </div>
  );
  if (step === 1) return (
    <div style={{textAlign:"center",paddingTop:"20px"}}>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Where shall we send a backup version of your report?</h2>
      <p style={{fontSize:"13px",color:MUT,marginBottom:"24px",lineHeight:1.5}}>Optional — so you can refer back to it anytime.</p>
      <input
        type="email"
        style={{...INP,maxWidth:"340px",margin:"0 auto",display:"block",textAlign:"center",fontSize:"17px",padding:"14px 18px"}}
        value={d.email}
        onChange={e => set("email", e.target.value)}
        placeholder="your@email.com"
      />
    </div>
  );
  if (step === 2) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px",textAlign:"center"}}>What would you most like to understand?</h2>
      <p style={{fontSize:"13px",color:MUT,marginBottom:"28px",lineHeight:1.5,textAlign:"center"}}>Pick any that apply — we'll tailor your guidance.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"12px"}}>
        {INTEREST_TILES.map(({ key, emoji, label }) => {
          const selected = (d.interests || []).includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => set("interests", selected
                ? (d.interests || []).filter(k => k !== key)
                : [...(d.interests || []), key]
              )}
              style={{
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:"8px", padding:"18px 12px", borderRadius:"12px", cursor:"pointer",
                background: selected ? "#162F24" : "rgba(255,255,255,0.04)",
                border: selected ? `2px solid ${GOLD}` : "1px solid rgba(200,216,204,0.25)",
                color: selected ? WHITE : MUT,
                transition:"all 0.15s ease",
                transform: selected ? "scale(1.03)" : "scale(1)",
              }}
            >
              <span style={{fontSize:"28px",opacity: selected ? 1 : 0.6}}>{emoji}</span>
              <span style={{fontSize:"13px",fontWeight:600,fontFamily:SANS}}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
  if (step === 3) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Tell us about you</h2>
      <p style={{fontSize:"13px",color:MUT,fontStyle:"italic",maxWidth:"480px",marginBottom:"28px",lineHeight:1.5}}>We use your income to work out your tax band, savings potential, and which optimisations matter most for you.</p>
      <div style={g2}>
        <Field label="Age">
          <input style={INP} type="number" value={d.age} onChange={e => set("age",e.target.value)} placeholder="e.g. 29"/>
          <Warn msg={+d.age > 0 && (+d.age < 16 || +d.age > 80) ? "Unusual age — double-check this." : null}/>
        </Field>
        <Field label="Gross annual salary (£)">
          <FmtInput fmtType="gbp" value={d.salary} onChange={v=>set("salary",capField("salary",v))} placeholder="e.g. 65,000"/>
          <Warn msg={+d.salary > 500000 ? "That's a very high salary — double-check this" : null}/>
        </Field>
      </div>
      {+d.salary > 0 && (
        <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"8px",padding:"12px 14px",marginBottom:"20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
          <div>
            <div style={{fontSize:"11px",fontWeight:700,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"3px"}}>Tax band (calculated)</div>
            <div style={{fontSize:"15px",fontWeight:600,color:G}}>
              {+d.salary + (+d.otherIncome||0) + (+d.dividendIncome||0) > 125140 ? "Additional rate (45%)" :
               +d.salary + (+d.otherIncome||0) + (+d.dividendIncome||0) > 50270  ? "Higher rate (40%)" : "Basic rate (20%)"}
            </div>
          </div>
          <div style={{fontSize:"12px",color:MUT,textAlign:"right",maxWidth:"180px",lineHeight:1.5}}>
            Based on £{(+d.salary+(+d.otherIncome||0)+(+d.dividendIncome||0)).toLocaleString()} total income
          </div>
        </div>
      )}
      <Field label="Salary trajectory" hint="Used to project your salary in student loan and pension calculations.">
        <Toggle value={d.salaryTrajectory} onChange={v=>set("salaryTrajectory",v)} options={[{value:"stable",label:"Stable (~2% p.a.)"},{value:"moderate",label:"Steady growth (~5% p.a.)"},{value:"high",label:"Rapid growth (~15% p.a.)"}]}/>
      </Field>
      <button type="button" onClick={() => setShowAdditionalIncome(v => !v)} style={{background:"transparent",border:"none",color:GOLD,fontSize:"13px",fontWeight:600,cursor:"pointer",padding:"4px 0",marginTop:"8px",marginBottom:"4px",display:"block"}}>
        {showAdditionalIncome ? "− Hide additional income" : "+ Add bonus / other income"}
      </button>
      {showAdditionalIncome && (
        <div>
          <div style={g2}>
            <Field label="Other income (£/yr)" hint="Rental, freelance — leave blank if none">
              <FmtInput fmtType="gbp" value={d.otherIncome||""} onChange={v=>set("otherIncome",capField("otherIncome",v))} placeholder="e.g. 8,000"/>
              <Warn msg={+d.otherIncome > 200000 ? "Unusually high other income — double-check" : null}/>
            </Field>
            <Field label="Dividend income (£/yr)" hint="From shares or funds — leave blank if none">
              <FmtInput fmtType="gbp" value={d.dividendIncome||""} onChange={v=>set("dividendIncome",capField("dividendIncome",v))} placeholder="e.g. 2,000"/>
              <Warn msg={+d.dividendIncome > 500000 ? "Large dividend income — double-check" : null}/>
            </Field>
          </div>
          <Field label="Annual bonus (£)" hint="Leave blank if none">
            <FmtInput fmtType="gbp" value={d.bonusAmount||""} onChange={v=>set("bonusAmount",capField("bonusAmount",v))} placeholder="e.g. 10,000"/>
            <Warn msg={+d.bonusAmount > (+d.salary||0) * 3 && +d.bonusAmount > 0 ? "Bonus exceeds 3× salary — is this right?" : null}/>
          </Field>
        </div>
      )}
    </div>
  );
  if (step === 4) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Cash & savings</h2>
      <p style={{fontSize:"13px",color:MUT,fontStyle:"italic",maxWidth:"480px",marginBottom:"20px",lineHeight:1.5}}>Helps us identify yield gaps and whether your cash is working as hard as it should be.</p>
      <button type="button" onClick={() => { window.location.href = `/api/truelayer/auth-link?email=${encodeURIComponent(d.email || "")}`; }} style={{
        display:"flex",alignItems:"center",gap:"9px",width:"100%",textAlign:"left",
        background:"rgba(22,47,36,0.04)",border:`1.5px dashed ${GOLD}`,borderRadius:"10px",
        padding:"13px 16px",color:G,fontSize:"13px",fontWeight:600,cursor:"pointer",
        marginBottom:"24px",fontFamily:SANS,
      }}>
        <span style={{fontSize:"17px"}}>🏦</span>
        <span>Connect your bank (Sandbox) — auto-fill your cash balances</span>
      </button>
      <div style={g2}>
        <Field label="Monthly essential expenses (£)" hint="Rent, bills, food, transport">
        <FmtInput fmtType="gbp" value={d.monthlyExpenses} onChange={v=>set("monthlyExpenses",capField("monthlyExpenses",v))} placeholder="e.g. 2,500"/>
        <Warn msg={+d.monthlyExpenses > 0 && +d.monthlyExpenses < 300 ? "Expenses seem very low — double-check" : +d.monthlyExpenses > (+d.salary||0)/12*0.95 && +d.salary > 0 ? "Expenses exceed almost all income" : null}/>
      </Field>
        <Field label="Emergency fund target">
          <Toggle value={d.higherBuffer||"no"} onChange={v=>set("higherBuffer",v)} options={[{value:"no",label:"6 months"},{value:"yes",label:"9 months"}]}/>
          <p style={{fontSize:"11px",color:MUT,marginTop:"4px"}}>9 months if self-employed or variable income</p>
        </Field>
      </div>
      <Field label="Cash savings accounts" hint="Add each account separately for an accurate blended rate">
        {(d.cashTiers||[{amount:"",rate:""}]).map((tier,i) => (
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:"8px",marginBottom:"8px",alignItems:"flex-end"}}>
            <div>
              {i===0 && <label style={{fontSize:"12px",color:MUT,display:"block",marginBottom:"4px"}}>Amount (£)</label>}
              <FmtInput fmtType="gbp" value={tier.amount} onChange={v=>{
                const capped = capField("isaPrevCash", v); // reuse 500k cap for individual cash tier
                const t=[...(d.cashTiers||[])]; t[i]={...t[i],amount:capped}; set("cashTiers",t);
              }} placeholder="e.g. 10,000"/>
              <Warn msg={+tier.amount > 500000 ? "Large cash holding — double-check" : null}/>
            </div>
            <div>
              {i===0 && <label style={{fontSize:"12px",color:MUT,display:"block",marginBottom:"4px"}}>Rate (%)</label>}
              <FmtInput fmtType="pct" value={tier.rate} onChange={v=>{
                const capped = capField("savingsRate", v);
                const t=[...(d.cashTiers||[])]; t[i]={...t[i],rate:capped}; set("cashTiers",t);
              }} placeholder="4.5"/>
              <Warn msg={+tier.rate > 6 && +tier.rate <= 10 ? "Most accounts pay under 6% — double-check this rate" : +tier.rate > 0 && +tier.rate < 0.5 ? "Very low rate — are you sure?" : null}/>
            </div>
            <button onClick={()=>{
              const t=(d.cashTiers||[]).filter((_,j)=>j!==i);
              set("cashTiers", t.length ? t : [{amount:"",rate:""}]);
            }} style={{background:"transparent",border:"1px solid rgba(22,47,36,0.15)",borderRadius:"6px",padding:"0 10px",cursor:"pointer",color:MUT,fontSize:"16px",height:"42px",lineHeight:1}}>×</button>
          </div>
        ))}
        <button onClick={()=>set("cashTiers",[...(d.cashTiers||[]),{amount:"",rate:""}])}
          style={{background:"transparent",border:`1px dashed ${GOLD}`,borderRadius:"7px",padding:"7px 14px",color:GOLD,fontSize:"12px",fontWeight:600,cursor:"pointer",marginTop:"4px"}}>
          + Add another account
        </button>
      </Field>
      <Field label="Premium bonds (£)"><FmtInput fmtType="gbp" value={d.premiumBonds} onChange={v=>set("premiumBonds",capField("premiumBonds",v))} placeholder="e.g. 10,000"/></Field>
      <Field label="Is your cash savings in an easy-access account?" hint="Affects emergency fund accessibility assessment">
        <Toggle value={d.cashAccessType||""} onChange={v=>set("cashAccessType",v)} options={[
          {value:"yes",     label:"Yes — instant access"},
          {value:"partial", label:"Partially — some in notice accounts"},
          {value:"no",      label:"No — notice or fixed term"},
        ]}/>
        <p style={{fontSize:"11px",color:MUT,marginTop:"6px",lineHeight:1.5}}>
          {d.cashAccessType==="no" ? "Consider keeping at least 3 months of expenses in an instant-access account for emergencies." :
           d.cashAccessType==="partial" ? "Some of your cash may not be immediately accessible in an emergency." :
           "Instant-access cash can be withdrawn same day if needed."}
        </p>
      </Field>
    </div>
  );
  if (step === 5) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Investments</h2>
      <p style={{fontSize:"13px",color:MUT,fontStyle:"italic",maxWidth:"480px",marginBottom:"28px",lineHeight:1.5}}>We'll check whether your investments are sheltered efficiently and whether any CGT opportunities exist.</p>
      <Field label="Do you have investments?">
        <Toggle value={d.hasInvestments} onChange={v => set("hasInvestments",v)} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
      </Field>
      {d.hasInvestments === "yes" && (
        <div>
          {/* ISA this tax year — 4 granular fields */}
          {(() => {
            const total = (+d.isaThisYearCash||0) + (+d.isaThisYearSS||0) + (+d.isaThisYearLISA||0) + (+d.isaThisYearOther||0);
            const over = total > 20000;
            return (
              <div style={{marginBottom:"20px"}}>
                <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"10px"}}>ISA contributions this tax year <span style={{fontSize:"11px",color:MUT,fontWeight:400}}>(April 6 – April 5, £20,000 limit)</span></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                  <Field label="Cash ISA (£)"><FmtInput fmtType="gbp" value={d.isaThisYearCash} onChange={v=>set("isaThisYearCash",capField("isaThisYearCash",v))} placeholder="0"/></Field>
                  <Field label="Stocks & Shares ISA (£)"><FmtInput fmtType="gbp" value={d.isaThisYearSS} onChange={v=>set("isaThisYearSS",capField("isaThisYearSS",v))} placeholder="0"/></Field>
                  <Field label="LISA (£)"><FmtInput fmtType="gbp" value={d.isaThisYearLISA} onChange={v=>set("isaThisYearLISA",capField("isaThisYearLISA",v))} placeholder="0"/></Field>
                  <Field label="Other ISA (£)"><FmtInput fmtType="gbp" value={d.isaThisYearOther||""} onChange={v=>set("isaThisYearOther",capField("isaThisYearOther",v))} placeholder="0"/></Field>
                </div>
                {over && (
                  <div style={{marginTop:"8px",fontSize:"12px",color:"#c0392b",fontWeight:700}}>
                    ⚠️ Total this year: {fmt(total)} — exceeds the £20,000 annual ISA allowance.
                  </div>
                )}
              </div>
            );
          })()}
          {/* ISA previous years — 4 granular fields */}
          {(() => {
            const total = (+d.isaPrevCash||0) + (+d.isaPrevSS||0) + (+d.isaPrevLISA||0) + (+d.isaPrevOther||0);
            return (
              <div style={{marginBottom:"20px"}}>
                <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"10px"}}>ISA balance from previous years <span style={{fontSize:"11px",color:MUT,fontWeight:400}}>(accumulated before this tax year)</span></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                  <Field label="Cash ISA (£)"><FmtInput fmtType="gbp" value={d.isaPrevCash} onChange={v=>set("isaPrevCash",capField("isaPrevCash",v))} placeholder="0"/></Field>
                  <Field label="Stocks & Shares ISA (£)"><FmtInput fmtType="gbp" value={d.isaPrevSS} onChange={v=>set("isaPrevSS",capField("isaPrevSS",v))} placeholder="0"/></Field>
                  <Field label="LISA (£)"><FmtInput fmtType="gbp" value={d.isaPrevLISA} onChange={v=>set("isaPrevLISA",capField("isaPrevLISA",v))} placeholder="0"/></Field>
                  <Field label="Other (£)"><FmtInput fmtType="gbp" value={d.isaPrevOther} onChange={v=>set("isaPrevOther",capField("isaPrevOther",v))} placeholder="0"/></Field>
                </div>
                {total > 0 && <div style={{marginTop:"8px",fontSize:"12px",color:MUT}}>Total previous years: {fmt(total)}</div>}
                <Warn msg={total > 200000 ? "Large ISA balance — double-check" : null}/>
              </div>
            );
          })()}
          <Field label="Investments outside an ISA (£)">
            <FmtInput fmtType="gbp" value={d.unwrappedValue} onChange={v=>set("unwrappedValue",capField("unwrappedValue",v))} placeholder="e.g. 15,000"/>
            <Warn msg={+d.unwrappedValue > 1000000 ? "Very large unwrapped portfolio — double-check" : null}/>
          </Field>
          <Field label="Estimated unrealised gains (£)" hint="Profit above what you paid for your unwrapped investments.">
            <FmtInput fmtType="gbp" value={d.unrealisedGains} onChange={v=>set("unrealisedGains",capField("unrealisedGains",v))} placeholder="e.g. 4,500"/>
            <Warn msg={+d.unrealisedGains > (+d.unwrappedValue||0) && +d.unrealisedGains > 0 ? "Gains exceed total investment value — double-check" : null}/>
          </Field>
        </div>
      )}
    </div>
  );
  if (step === 6) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Pension</h2>
      <p style={{fontSize:"13px",color:MUT,fontStyle:"italic",maxWidth:"480px",marginBottom:"28px",lineHeight:1.5}}>The single biggest optimisation for most people in your income bracket. Takes 60 seconds to fill in.</p>
      <Field label="Do you contribute to a pension?">
        <Toggle value={d.pensionUnknown ? "unsure" : (d.hasPension || "no")} onChange={v => {
          if (v === "unsure") { set("pensionUnknown", true); }
          else { set("pensionUnknown", false); set("hasPension", v); }
        }} options={[
          {value:"yes",label:"Yes"},
          {value:"no",label:"No"},
          {value:"unsure",label:"I'm not sure / I don't have a pension set up", full:true},
        ]}/>
      </Field>
      {d.pensionUnknown ? (
        <div style={{background:"rgba(22,47,36,0.04)",border:"1px solid rgba(22,47,36,0.12)",borderRadius:"10px",padding:"16px",marginTop:"4px"}}>
          <p style={{fontSize:"14px",color:G,lineHeight:1.6}}>No problem — this is really common. Your full report will walk you through exactly how to find out, and we won't hold it against your score.</p>
        </div>
      ) : d.hasPension === "yes" ? (
        <div>
          <div style={g2}>
            <Field label="Your contribution (%)">
              <FmtInput fmtType="pct" value={d.myContribution} onChange={v=>set("myContribution",capField("myContribution",v))} placeholder="e.g. 5"/>
              <Warn msg={+d.myContribution > 30 ? "Very high contribution — double-check" : null}/>
            </Field>
            <Field label="Employer match cap (%)" hint="Max employer will contribute">
              <FmtInput fmtType="pct" value={d.employerMatch} onChange={v=>set("employerMatch",capField("employerMatch",v))} placeholder="e.g. 5"/>
              <Warn msg={+d.employerMatch > 10 ? "Unusually generous employer match — double-check" : null}/>
            </Field>
          </div>
          <div style={g2}>
            <Field label="Main pot value (£)">
              <FmtInput fmtType="gbp" value={d.potValue} onChange={v=>set("potValue",capField("potValue",v))} placeholder="e.g. 35,000"/>
              <Warn msg={+d.potValue > 2000000 ? "Large pension pot — double-check (lifetime allowance context)" : null}/>
            </Field>
            <Field label="Other pots combined (£)" hint="Old employer pensions etc.">
              <FmtInput fmtType="gbp" value={d.potValue2||""} onChange={v=>set("potValue2",capField("potValue2",v))} placeholder="e.g. 8,000"/>
              <Warn msg={+d.potValue2 > 2000000 ? "Large pension pot — double-check" : null}/>
            </Field>
          </div>
          <div style={g2}>
            <Field label="Target retirement age">
              <input style={INP} type="number" value={d.retirementAge} onChange={e => {
                const v = Math.min(80, +e.target.value || 0);
                set("retirementAge", v > 0 ? String(v) : e.target.value);
              }} placeholder="65"/>
              <Warn msg={+d.retirementAge > 0 && +d.retirementAge < 55 ? "Pension access age is currently 57 from 2028 — double-check" : null}/>
            </Field>
            <Field label={<>NI years completed <InfoTooltip text="Your National Insurance record determines your State Pension. You need 35 qualifying years for the full new State Pension (currently £221.20/week). Fewer qualifying years = a proportionally smaller State Pension. Check your record for free at gov.uk/check-state-pension — you can also fill gaps by paying voluntary contributions."/></>} hint="Check via HMRC / Personal Tax Account">
              <input style={INP} type="number" value={d.niYears||""} onChange={e => {
                const v = Math.min(35, Math.max(0, +e.target.value || 0));
                set("niYears", e.target.value === "" ? "" : String(v));
              }} placeholder="e.g. 12"/>
            </Field>
          </div>
          <Field label="How are your pension contributions made?" hint="Affects the exact return ratio — salary sacrifice saves NI too">
            <Toggle value={d.pensionType||""} onChange={v=>set("pensionType",v)} options={[
              {value:"sacrifice", label:"Salary sacrifice"},
              {value:"relief",   label:"Relief at source / net pay"},
              {value:"",         label:"Not sure"},
            ]}/>
            <p style={{fontSize:"11px",color:MUT,marginTop:"6px",lineHeight:1.5}}>
              {d.pensionType==="sacrifice" ? "Contributions come off your gross pay before tax — check your payslip for a deduction labelled 'pension' before income tax." :
               d.pensionType==="relief"   ? "Contributions come from your take-home pay — your provider claims basic rate relief from HMRC, higher rate via self-assessment." :
               "Check your payslip — if the pension deduction appears before tax is calculated, it's likely salary sacrifice."}
            </p>
          </Field>
        </div>
      ) : (
        <div style={{background:"rgba(196,150,58,0.08)",border:"1px solid rgba(196,150,58,0.3)",borderRadius:"10px",padding:"16px",marginTop:"4px"}}>
          <p style={{fontSize:"14px",color:G,lineHeight:1.6}}><strong>This is likely your biggest financial gap.</strong> We'll quantify exactly what it's costing you.</p>
        </div>
      )}
    </div>
  );
  if (step === 7) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Debt</h2>
      <p style={{fontSize:"13px",color:MUT,fontStyle:"italic",maxWidth:"480px",marginBottom:"28px",lineHeight:1.5}}>Understanding your debt profile lets us prioritise what to pay down first and in what order.</p>
      <Field label="Student loan">
        <select style={INP} value={d.studentLoan} onChange={e => set("studentLoan",e.target.value)}>
          <option value="none">No student loan</option>
          <option value="plan1">Plan 1 — before 2012 (Scotland/NI)</option>
          <option value="plan2">Plan 2 — England/Wales 2012–2023</option>
          <option value="plan5">Plan 5 — 2023 onwards</option>
        </select>
      </Field>
      {d.studentLoan !== "none" && (
        <>
          <Field label="Outstanding balance (£)">
            <FmtInput fmtType="gbp" value={d.loanBalance} onChange={v=>set("loanBalance",capField("loanBalance",v))} placeholder="e.g. 35,000"/>
            <Warn msg={+d.loanBalance > 100000 ? "Very large loan balance — double-check" : null}/>
          </Field>
          <Field label="Current interest rate (%) — find on your SLC online account (optional)">
            <FmtInput fmtType="pct" value={d.studentLoanRate} onChange={v=>set("studentLoanRate",v)} placeholder="e.g. 6.1"/>
          </Field>
        </>
      )}
      <Field label="Do you have a mortgage?">
        <Toggle value={d.ownsOutright ? "outright" : (d.hasMortgage || "no")} onChange={v => {
          if (v === "outright") { set("ownsOutright", true); }
          else { set("ownsOutright", false); set("hasMortgage", v); }
        }} options={[
          {value:"yes",label:"Yes"},
          {value:"no",label:"Not yet"},
          {value:"outright",label:"I own my home outright", full:true},
        ]}/>
      </Field>
      {d.ownsOutright ? (
        <Field label="Estimated value of your home (£)">
          <FmtInput fmtType="gbp" value={d.outrightPropertyValue||""} onChange={v=>set("outrightPropertyValue",v)} placeholder="e.g. 350,000"/>
        </Field>
      ) : d.hasMortgage === "yes" && (
        <div>
          <Field label="Mortgage type">
            <Toggle value={d.mortgageType||"fixed"} onChange={v=>set("mortgageType",v)} options={[{value:"fixed",label:"Fixed rate"},{value:"variable",label:"Variable (SVR/tracker)"}]}/>
          </Field>
          <div style={g2}>
            <Field label="Outstanding balance (£)">
              <FmtInput fmtType="gbp" value={d.mortgageBalance} onChange={v=>set("mortgageBalance",capField("mortgageBalance",v))} placeholder="e.g. 280,000"/>
              <Warn msg={+d.mortgageBalance > 2000000 ? "Large mortgage — double-check" : null}/>
            </Field>
            <Field label="Interest rate (%)">
              <FmtInput fmtType="pct" value={d.mortgageRate} onChange={v=>set("mortgageRate",capField("mortgageRate",v))} placeholder="e.g. 4.5"/>
              <Warn msg={+d.mortgageRate > 7 ? "High mortgage rate — double-check (current rates are 4–6%)" : null}/>
            </Field>
          </div>
          <Field label="Monthly payment (£)">
            <FmtInput fmtType="gbp" value={d.monthlyMortgage} onChange={v=>set("monthlyMortgage",capField("monthlyExpenses",v))} placeholder="e.g. 1,400"/>
            {(() => {
              const expected = +d.mortgageBalance * (+d.mortgageRate/100) / 12;
              const actual = +d.monthlyMortgage;
              const warn = actual > 0 && expected > 0 && (actual > expected * 2.5 || actual < expected * 0.1);
              return <Warn msg={warn ? "Monthly payment looks unusual for this balance and rate — double-check" : null}/>;
            })()}
          </Field>
          {(d.mortgageType||"fixed") === "fixed" && (
            <Field label="Fixed rate expiry" hint="When does your current deal end? Leave blank if not yet known.">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                <select style={INP} value={d.fixExpiryMonth||""} onChange={e=>set("fixExpiryMonth",e.target.value)}>
                  <option value="">Month…</option>
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((mn,i)=>(
                    <option key={i+1} value={String(i+1)}>{mn}</option>
                  ))}
                </select>
                <input style={INP} type="number" value={d.fixExpiryYear||""} onChange={e=>set("fixExpiryYear",e.target.value)} placeholder="e.g. 2026" min="2024" max="2040"/>
              </div>
            </Field>
          )}
          <Field label="Mortgage provider" hint="Helps us surface better deals when available.">
            <select style={INP} value={d.mortgageProvider||""} onChange={e=>set("mortgageProvider",e.target.value)}>
              <option value="">Select provider…</option>
              <option value="barclays">Barclays</option>
              <option value="hsbc">HSBC</option>
              <option value="lloyds">Lloyds Bank</option>
              <option value="halifax">Halifax</option>
              <option value="natwest">NatWest</option>
              <option value="santander">Santander</option>
              <option value="nationwide">Nationwide</option>
              <option value="yorkshire">Yorkshire Building Society</option>
              <option value="virgin">Virgin Money</option>
              <option value="tesco">Tesco Bank</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Estimated equity (£)" hint="Your approximate ownership stake — property value minus outstanding mortgage">
            <FmtInput fmtType="gbp" value={d.propertyEquity||""} onChange={v=>set("propertyEquity",v)} placeholder="e.g. 150,000"/>
          </Field>
        </div>
      )}
      <Field label="Do you have a personal loan?">
        <Toggle value={d.hasPersonalLoan} onChange={v => set("hasPersonalLoan",v)} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
      </Field>
      {d.hasPersonalLoan === "yes" && (
        <div>
          <div style={g2}>
            <Field label="Outstanding balance (£)">
              <FmtInput fmtType="gbp" value={d.personalLoanBalance} onChange={v=>set("personalLoanBalance",capField("personalLoanBalance",v))} placeholder="e.g. 8,000"/>
              <Warn msg={+d.personalLoanBalance > 100000 ? "Large personal loan — double-check" : null}/>
            </Field>
            <Field label="Interest rate (%)">
              <FmtInput fmtType="pct" value={d.personalLoanRate} onChange={v=>set("personalLoanRate",capField("personalLoanRate",v))} placeholder="e.g. 9.9"/>
              <Warn msg={+d.personalLoanRate > 30 ? "Very high loan rate — double-check" : null}/>
            </Field>
          </div>
          <div style={g2}>
            <Field label="Monthly payment (£)"><FmtInput fmtType="gbp" value={d.personalLoanMonthly} onChange={v=>set("personalLoanMonthly",v)} placeholder="e.g. 180"/></Field>
            <Field label="Months remaining"><input style={INP} type="number" value={d.personalLoanTermRemaining} onChange={e=>set("personalLoanTermRemaining",e.target.value)} placeholder="e.g. 36"/></Field>
          </div>
          <Field label="Additional annual repayment (optional)" hint="E.g. a lump sum from a bonus, on top of your monthly repayment">
            <FmtInput fmtType="gbp" value={d.personalLoanAnnualExtra||""} onChange={v=>set("personalLoanAnnualExtra",v)} placeholder="e.g. 1,000"/>
          </Field>
          <Field label="Loan provider" hint="Helps us surface better refinancing deals when available.">
            <select style={INP} value={d.personalLoanProvider||""} onChange={e=>set("personalLoanProvider",e.target.value)}>
              <option value="">Select provider…</option>
              <option value="barclays">Barclays</option>
              <option value="hsbc">HSBC</option>
              <option value="lloyds">Lloyds Bank</option>
              <option value="natwest">NatWest</option>
              <option value="santander">Santander</option>
              <option value="tesco">Tesco Bank</option>
              <option value="m&s">M&S Bank</option>
              <option value="sainsburys">Sainsbury's Bank</option>
              <option value="zopa">Zopa</option>
              <option value="novuna">Novuna (formerly Hitachi)</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>
      )}

    </div>
  );
  return null;
}

// ── Loading ───────────────────────────────────────────────────────────────────
function LoadingScreen({ name, msgs }) {
  const all = msgs || ["Analysing your position...","Running the numbers...","Building your report..."];
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(i=>(i+1)%all.length), 1800); return () => clearInterval(t); }, []);
  return (
    <div style={{minHeight:"100vh",background:G,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:SANS}}>
      <style>{FONTS}</style>
      <div style={{textAlign:"center",padding:"0 24px"}}>
        <div style={{width:"44px",height:"44px",border:"3px solid rgba(196,150,58,0.3)",borderTop:`3px solid ${GOLD}`,borderRadius:"50%",animation:"spin 0.9s linear infinite",margin:"0 auto 32px"}}/>
        <p style={{fontFamily:SERIF,fontSize:"24px",color:WHITE,marginBottom:"12px",lineHeight:1.3}}>{name ? `Crunching the numbers, ${name.split(" ")[0]}…` : "Crunching the numbers…"}</p>
        <p style={{color:"rgba(255,255,255,0.45)",fontSize:"14px"}}>{all[idx]}</p>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function ScoreRing({ score, delta = 0 }) {
  const r = 50, circ = 2 * Math.PI * r;
  const col = score >= 86 ? G : score >= 66 ? "#2d6b4a" : score >= 41 ? GOLD : "#c0392b";
  const lb  = score >= 86 ? "Optimised" : score >= 66 ? "On track" : score >= 41 ? "Room to improve" : "Needs attention";
  const [fadeDelta, setFadeDelta] = useState(false);
  const prevDelta = useRef(0);
  useEffect(() => {
    if (delta > prevDelta.current) {
      setFadeDelta(false);
      const t = setTimeout(() => setFadeDelta(true), 1800);
      prevDelta.current = delta;
      return () => clearTimeout(t);
    }
    prevDelta.current = delta;
  }, [delta]);
  const baseScore = Math.max(0, score - delta);
  const baseDash  = (baseScore / 100) * circ;
  const totalDash = (score   / 100) * circ;
  const deltaDash = Math.max(0, totalDash - baseDash);
  return (
    <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:"8px"}}>
      <div style={{position:"relative",width:"124px",height:"124px"}}>
        <svg width="124" height="124" style={{transform:"rotate(-90deg)"}}>
          <circle cx="62" cy="62" r={r} fill="none" stroke={`${col}28`} strokeWidth="9"/>
          <circle cx="62" cy="62" r={r} fill="none" stroke={col} strokeWidth="9"
            strokeDasharray={`${baseDash} ${circ}`} strokeLinecap="round"
            style={{transition:"stroke-dasharray 0.8s ease"}}/>
          {delta > 0 && (
            <circle cx="62" cy="62" r={r} fill="none"
              stroke={fadeDelta ? col : GOLD}
              strokeWidth="9"
              strokeDasharray={`${deltaDash} ${circ}`}
              strokeDashoffset={-baseDash}
              strokeLinecap="round"
              style={{transition: fadeDelta ? "stroke 1.5s ease, stroke-dasharray 0.8s ease" : "stroke-dasharray 0.6s ease"}}/>
          )}
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:WHITE,lineHeight:1}}>{score}</span>
          {delta > 0 && (
            <span style={{fontSize:"11px",color:fadeDelta?"rgba(255,255,255,0.4)":GOLD,fontWeight:600,marginTop:"2px",transition:"color 1.5s ease"}}>+{delta} pts</span>
          )}
        </div>
      </div>
      <span style={{fontSize:"10px",fontWeight:700,color:col,letterSpacing:"0.07em",textTransform:"uppercase"}}>{lb}</span>
    </div>
  );
}

export const SC = { ok:"#2d6b4a", attention:GOLD, critical:"#c0392b", na:MUT, unknown:MUT };
const SL = { ok:"On track", attention:"Review", critical:"Action needed", na:"N/A", unknown:"Find out" };

// ── Dashboard module tiles — category pill + short context, keyed to MODULE_META ──
// "Today" = act now for an immediate saving; "Future opportunity" = value that builds
// over a longer horizon (growth, compounding, tax-free wrappers).
const MODULE_TAG = {
  cash:         { label:"Today",             color:GOLD },
  investments:  { label:"Future opportunity", color:"#2d6b4a" },
  pension:      { label:"Future opportunity", color:"#2d6b4a" },
  studentLoan:  { label:"Today",             color:GOLD },
  mortgage:     { label:"Today",             color:GOLD },
  personalLoan: { label:"Today",             color:GOLD },
  kids:         { label:"Future opportunity", color:"#2d6b4a" },
};

function TagPill({ label, color }) {
  return (
    <span style={{fontSize:"10px",fontWeight:700,color,background:`${color}18`,padding:"3px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</span>
  );
}

// Short "alongside" context for a module's headline £ figure — deliberately not just
// impactLabel verbatim, since several modules' impactLabel leads with a different £
// figure than mm.amount (e.g. investments' ISA headroom vs. the tax saving shown).
function moduleContext(mm, d, m) {
  switch (mm.key) {
    case "cash":
      return mm.impactLabel ? mm.impactLabel.replace(/^~?£[\d,]+(?:\.\d+)?(?:\/yr)?\s*/, "") : null;
    case "investments":
      return "ISA allowance + CGT tax saving";
    case "pension":
      if (!isPensionContributing(d)) return "no pension — tax relief foregone";
      if (m.missedMatch > 0) return "missed employer match";
      return "bonus sacrifice saving";
    case "studentLoan":
      return mm.impactLabel ? mm.impactLabel.replace(/^£[\d,]+(?:\.\d+)?(?:\/yr)?,?\s*/, "") : null;
    case "mortgage":
      return mm.impactLabel || null;
    case "personalLoan":
      return mm.impactLabel ? mm.impactLabel.replace(/^£[\d,]+(?:\.\d+)?\s*/, "") : null;
    case "kids":
      return "JISA growth potential by 18";
    default:
      return null;
  }
}

// ── Your Forecast — per-option line colours (chart + legend + table dots) ─────
const FORECAST_COLORS = {
  "Mortgage overpayment": "#c0392b",
  "Student loan overpayment": "#8a4fae",
  "Stocks & Shares ISA": GOLD,
  "Cash savings": "#1a6fa3",
  "Pension (salary sacrifice)": "#2d6b4a",
  "Pension (relief at source)": "#1e7a5a",
};

export const MODULE_META = [
  { key:"cash",        icon:"💷", title:"Cash & savings"  },
  { key:"investments", icon:"📈", title:"Investments"     },
  { key:"pension",     icon:"🏦", title:"Pension"         },
  { key:"studentLoan", icon:"🎓", title:"Student loan"    },
  { key:"mortgage",    icon:"🏠", title:"Mortgage"        },
  { key:"personalLoan",icon:"💳", title:"Personal loan"   },
  { key:"kids",        icon:"👶", title:"Kids & family"   },
];

// ── Cash waterfall optimiser: ISA → Personal Savings Allowance → Premium Bonds ──
// Single source of truth for "what could this cash + Premium Bonds pot earn if
// optimally allocated, vs what it earns today" — shared by the Cash & Savings
// module's "Optimise your cash" win and computeModuleStatuses below, so the
// Dashboard and the module page never show two different numbers for the same
// underlying opportunity. isaRatePct/nonIsaRatePct are percentage numbers (e.g.
// 5.1) or null/undefined, in which case the same pre-data-load fallbacks apply.
export function calcCashOptimisation(m, isaRatePct, nonIsaRatePct) {
  const bondsVal = m.bonds || 0;
  const psaLimit = m.taxBandLabel === "basic" ? 1000 : m.taxBandLabel === "higher" ? 500 : 0;
  // 0.049/0.045 fallbacks only cover the brief window before savingsRates loads.
  const isaRateDecimal = isaRatePct != null ? +isaRatePct / 100 : 0.049;
  const isaRateDisplay = isaRatePct != null ? `${isaRatePct}%` : "4.9%";
  const nonIsaRateDecimal = nonIsaRatePct != null ? +nonIsaRatePct / 100 : 0.045;
  const nonIsaRateDisplay = nonIsaRatePct != null ? `${nonIsaRatePct}%` : "4.5%";
  // NS&I's long-run prize-fund average — the same figure used everywhere else in
  // this file for Premium Bonds' effective tax-free return.
  const PB_RATE = 0.044;

  const currentTaxableInterest = Math.round(m.cash * m.savingsRate / 100);
  const currentPbInterest = Math.round(bondsVal * PB_RATE);
  const currentGrossTotal = currentTaxableInterest + currentPbInterest;
  const currentTaxableAmount = Math.max(0, currentTaxableInterest - psaLimit);
  const trPct = Math.round(m.tr * 100);
  const currentTaxCost = Math.round(currentTaxableAmount * m.tr);
  const currentAfterTaxTotal = currentTaxableInterest - currentTaxCost + currentPbInterest;

  // The full reallocation pot — cash (already outside any ISA) plus premium bonds.
  // Deliberately the WHOLE amount, not just the surplus above the buffer: ISAs and
  // Premium Bonds are both easy/near-instant access, so there's no liquidity reason
  // to exclude the buffer portion from this.
  const totalPot = m.cash + bondsVal;
  const step1Isa = Math.min(totalPot, m.isaHeadroom);
  const step1IsaInterest = Math.round(step1Isa * isaRateDecimal);
  const afterStep1 = totalPot - step1Isa;
  // Only worth filling the PSA with ordinary savings if the best available non-ISA
  // rate actually beats the Premium Bonds average — otherwise the "tax-free"
  // comparison is a wash and Premium Bonds are simply better.
  const savingsWorthIt = nonIsaRateDecimal > PB_RATE;
  const step2Savings = savingsWorthIt ? Math.min(afterStep1, psaLimit / nonIsaRateDecimal) : 0;
  const step2SavingsInterest = Math.round(step2Savings * nonIsaRateDecimal);
  const afterStep2 = afterStep1 - step2Savings;
  // Once the ISA and PSA are filled, what's left is a genuine choice (Step 3 vs
  // Step 4) rather than something this function should silently decide.
  const discretionaryAmount = afterStep2;
  const step3Pb = Math.min(discretionaryAmount, 50000); // £50,000 is a hard NS&I product limit, not a preference
  const step3PbInterest = Math.round(step3Pb * PB_RATE);
  const step3UpliftVsCurrent = step3PbInterest - Math.round(step3Pb * m.savingsRate / 100);
  const beyondPbCap = Math.max(0, discretionaryAmount - step3Pb); // only nonzero above the £50,000 cap

  // "Optimised interest income" and the top-line gain default to the cash-safe path
  // (Step 3) — the same-unit, guaranteed comparison. Step 4's long-term illustration
  // is a separate, non-guaranteed figure and isn't folded into this £/yr total.
  const optimisedTotal = step1IsaInterest + step2SavingsInterest + step3PbInterest;
  const keptAmount = step1Isa + step2Savings + step3Pb;
  const todayBlendedRate = totalPot > 0 ? (currentTaxableInterest + currentPbInterest) / totalPot : 0;
  const currentInterestOnKeptAmount = Math.round(keptAmount * todayBlendedRate);
  const optimisationGain = optimisedTotal - currentInterestOnKeptAmount;

  return {
    psaLimit, isaRateDecimal, isaRateDisplay, nonIsaRateDecimal, nonIsaRateDisplay, PB_RATE,
    currentTaxableInterest, currentPbInterest, currentGrossTotal, currentTaxableAmount, trPct, currentTaxCost, currentAfterTaxTotal,
    totalPot, step1Isa, step1IsaInterest, afterStep1, savingsWorthIt,
    step2Savings, step2SavingsInterest, afterStep2, discretionaryAmount,
    step3Pb, step3PbInterest, step3UpliftVsCurrent, beyondPbCap,
    optimisedTotal, keptAmount, todayBlendedRate, currentInterestOnKeptAmount, optimisationGain,
  };
}

// ── Student loan plan constants — single source for write-off year + repayment
// threshold, previously duplicated independently in getModuleInsights,
// getModuleProducts, and the marginal-return chart memo.
function studentLoanPlanConstants(studentLoanType) {
  const writeOffYr = studentLoanType==="plan2" ? 30 : studentLoanType==="plan5" ? 40 : 25;
  const threshold = studentLoanType==="plan2" ? 27295 : studentLoanType==="plan5" ? 25000 : 24990;
  return { writeOffYr, threshold };
}

// ── Student loan core scenario — single source of truth for "is this loan
// growing, will it clear before write-off, and is overpaying actually worth
// it" — shared by computeModuleStatuses (Dashboard figure) and the module's
// own Win/info tile, so the two can't disagree (same pattern as
// calcCashOptimisation above).
export function calcStudentLoanScenario(d, m) {
  const { writeOffYr, threshold } = studentLoanPlanConstants(d.studentLoan);
  const slInterestRate = resolveSlRate(d, m.salary);
  const slRatePct = Math.round(slInterestRate * 1000) / 10;
  const annualInterest = Math.round(m.loanBal * slInterestRate);
  const annualRep = m.annualRepayment;
  const belowThreshold = d.studentLoan !== "none" && annualRep === 0;
  const netAnnualChange = annualInterest - annualRep; // positive = balance GROWING
  const balanceGrowing = netAnnualChange > 0;
  // Inflection point: salary at which repayments equal interest accrual
  const inflectionSalary = Math.round(threshold + (m.loanBal * slInterestRate) / 0.09);
  const salaryGapToInflection = Math.max(0, inflectionSalary - m.salary);

  let projBal = m.loanBal, writeOffBal = 0, clearYr = null;
  for (let yr = 1; yr <= writeOffYr; yr++) {
    projBal = projBal * (1 + slInterestRate) - annualRep;
    if (projBal <= 0 && !clearYr) { clearYr = yr; break; }
    if (yr === writeOffYr) writeOffBal = Math.max(0, projBal);
  }
  const willClear = clearYr !== null;
  const totalRepaidProjected = clearYr ? Math.round(annualRep * clearYr) : Math.round(annualRep * writeOffYr);

  const cashRate = +d.savingsRate || 4.2;
  const effectiveBenefit = Math.round((slInterestRate*100 - cashRate) * 10) / 10; // % — overpaying vs holding cash
  // A genuine £/yr figure: the rate differential applied to the current balance
  // — same shape as Cash's annualYieldGap (rate gap × principal) — rather than a
  // one-off lump sum, so it stays comparable to every other module's £/yr amount.
  const overpayAnnualBenefit = (willClear && effectiveBenefit > 0) ? Math.round(m.loanBal * effectiveBenefit / 100) : 0;

  return {
    writeOffYr, threshold, slInterestRate, slRatePct, annualInterest, annualRep,
    belowThreshold, netAnnualChange, balanceGrowing, inflectionSalary, salaryGapToInflection,
    clearYr, writeOffBal: Math.round(writeOffBal), willClear, totalRepaidProjected,
    cashRate, effectiveBenefit, overpayAnnualBenefit,
  };
}

// ── Local module status computation ──────────────────────────────────────────
// Computes status + £ impact for all 8 modules from user data alone.
// AI response takes precedence for narrative summary; this drives sorting + visibility.
// marketRates: same shape/contract as calcMetrics — resolved once by the caller.
export function computeModuleStatuses(d, m, marketRates = {}) {
  const { isaRate = 5, nonIsaRate = 4.5 } = marketRates;
  const daysToTaxEnd = (() => {
    const now = new Date(), taxEnd = new Date(now.getFullYear(), 3, 5);
    if (taxEnd < now) taxEnd.setFullYear(taxEnd.getFullYear() + 1);
    return Math.ceil((taxEnd - now) / (1000*60*60*24));
  })();
  const isaUrgencyBoost = daysToTaxEnd < 30 ? 3 : daysToTaxEnd < 90 ? 1.5 : 1;

  const s = {};

  // Cash — access type + emergency buffer + the ISA→PSA→Premium Bonds waterfall
  // (calcCashOptimisation), the same calculation the Cash & Savings module's
  // "Optimise your cash" win uses — so the Dashboard shows the identical £/yr figure
  // rather than a cruder approximation. This also supersedes the old separate
  // Premium-Bonds-only calc: the optimiser already reallocates cash + bonds together.
  const cashOpt = calcCashOptimisation(m, isaRate, nonIsaRate);
  const cashImpact = Math.max(0, Math.round(cashOpt.optimisationGain));
  // Approaching-deadline urgency is a sort-priority-only nudge, kept separate from
  // the £/yr figures shown to the user (see pension's +99999 sentinel below for the
  // same pattern).
  const cashSortPriority = cashImpact + Math.round(m.isaHeadroom * (isaRate / 100) * (isaUrgencyBoost - 1));
  const tooMuchCash = m.emergencyBuffer > 0 && m.emergencyFund > m.emergencyBuffer * 2;
  const genuinelyLowCash = m.emergencyFund === 0 && m.expenses > 0;
  const accessType = d.cashAccessType || "partial";
  const accessOk = m.emergencyFund >= m.emergencyBuffer;
  // Emergency access warnings — only critical when truly no cash at all
  let accessLabel = null;
  if (accessType === "no" && accessOk) {
    accessLabel = `Cash not in easy-access — consider keeping ${m.bufferMonths} months in instant-access`;
  } else if (accessType === "partial") {
    accessLabel = accessOk ? "Some cash may not be immediately accessible" : null;
  }

  let cashImpactLabel;
  if (tooMuchCash) {
    // emergencyExcess is a principal (the £ sitting above the buffer), not a £/yr
    // figure — never label it "/yr" or use it as the amount. The actual annual
    // benefit is the same optimisation-gain figure used below, just called out
    // alongside the excess for context.
    cashImpactLabel = cashImpact > 0
      ? `${fmt(cashImpact)}/yr in tax-efficiency gain available — ${fmt(Math.round(m.emergencyExcess))} of it sits above your buffer`
      : `${fmt(Math.round(m.emergencyExcess))} sits above your buffer, earning below its potential`;
  } else if (accessLabel) {
    cashImpactLabel = accessLabel;
  } else if (cashImpact > 0) {
    cashImpactLabel = `${fmt(cashImpact)}/yr in tax-efficiency gain available`;
  } else {
    cashImpactLabel = null;
  }
  // amount: a clean, always-£/yr figure for consumers (e.g. the PDF report) that need a
  // real monetary saving rather than `impact` (a sort-priority score — see pension below,
  // where impact includes a +99999 sentinel that must never be summed or displayed).
  // Note: tooMuchCash intentionally falls through to cashImpact here too — emergencyExcess
  // is a principal, not an annual figure, and must never be used as the £/yr amount.
  const cashAmount = cashImpact > 0 ? cashImpact : 0; // accessLabel-only attention has no £ figure
  s.cash = {
    status: tooMuchCash || cashImpact > 800 ? "critical"
          : cashImpact > 200 || (genuinelyLowCash && accessType !== "yes") || (accessType === "no" && !accessOk) ? "attention" : "ok",
    impact: cashSortPriority,
    impactLabel: cashImpactLabel,
    amount: cashAmount,
  };

  // Investments — ISA headroom × tax saving proxy + CGT saving
  const isaImpact = Math.round(m.isaHeadroom * 0.07 * m.tr * isaUrgencyBoost + m.cgtSaving);
  s.investments = {
    status: (m.isaHeadroom > 10000 && daysToTaxEnd < 60) ? "critical"
          : m.isaHeadroom > 2000 || m.cgtSaving > 0 ? "attention" : "ok",
    impact: isaImpact,
    impactLabel: isaImpact > 0 ? `${fmt(m.isaHeadroom)} ISA headroom` : null,
    amount: isaImpact > 0 ? isaImpact : 0, // the projected tax saving, not the headroom itself
  };

// Pension — missed match + contribution check
const contributing = isPensionContributing(d);
const bonusSacrificeOpportunity = (+d.bonusAmount||0) * m.tr;
const pensionImpact = !contributing
  ? Math.round(m.salary * 0.05 * m.tr + m.missedMatch + 99999) // not contributing = highest priority sentinel
  : Math.round(m.missedMatch + bonusSacrificeOpportunity);
// Clean £/yr figure mirroring impactLabel below, without the sentinel baked into pensionImpact
const pensionAmount = !contributing
  ? Math.round(m.salary * 0.05 * m.tr)
  : m.missedMatch > 0
    ? m.missedMatch
    : bonusSacrificeOpportunity > 0
      ? Math.round(bonusSacrificeOpportunity)
      : 0;

s.pension = m.pensionStatus === "unknown" ? {
  // User told us they don't know their pension situation — neutral/informational,
  // not a scored "missed opportunity"
  status: "unknown",
  impact: 0,
  impactLabel: null,
  amount: 0,
} : {
  // Only "critical" when genuinely missing match or not contributing at all
  status: !contributing ? "critical" : m.missedMatch > 0 ? "critical" : "attention",
  impact: pensionImpact,
  impactLabel: !contributing
    ? `No pension — ${fmt(Math.round(m.salary * 0.05 * m.tr))}/yr tax relief foregone`
    : m.missedMatch > 0
      ? `${fmt(m.missedMatch)}/yr in missed employer match`
      : bonusSacrificeOpportunity > 0
        ? `Up to ${fmt(Math.round(bonusSacrificeOpportunity))} bonus sacrifice saving`
        : null,
  amount: pensionAmount,
};

  // Student loan — calcStudentLoanScenario is the single source of truth, shared
  // with the module's own Win/info tile (see there for the full scenario logic).
  // Overpaying only genuinely matters when the loan will actually clear before
  // write-off AND beats the user's cash rate — that's the only case with a
  // non-zero £/yr amount; everything else (written off regardless, or clears
  // but saving beats overpaying, or below threshold) has nothing actionable.
  const sl = calcStudentLoanScenario(d, m);
  const slWorthOverpaying = sl.willClear && sl.effectiveBenefit > 0;
  const slAmount = slWorthOverpaying ? sl.overpayAnnualBenefit : 0;
  s.studentLoan = {
    status: d.studentLoan === "none" ? "na"
          : slWorthOverpaying ? (sl.balanceGrowing ? "critical" : "attention")
          : sl.belowThreshold ? "attention"
          : "ok",
    impact: slAmount,
    impactLabel: sl.belowThreshold
      ? "Below repayment threshold — no deductions currently"
      : slWorthOverpaying
        ? `${fmt(sl.overpayAnnualBenefit)}/yr effective benefit from overpaying vs your cash rate`
        : sl.balanceGrowing
          ? `${fmt(Math.round(sl.netAnnualChange))}/yr, balance growing — but will be written off regardless`
          : null,
    belowThreshold: sl.belowThreshold,
    amount: slAmount,
  };

  // Mortgage
  const mortgageImpact = d.hasMortgage === "yes" ? Math.round(+d.mortgageBalance * +d.mortgageRate / 100 * 0.05) : 0;
  s.mortgage = {
    status: d.hasMortgage !== "yes" ? "na" : +d.mortgageRate > 4.5 ? "attention" : "ok",
    impact: mortgageImpact,
    impactLabel: d.hasMortgage === "yes" ? `${d.mortgageRate}% rate — ${+d.mortgageRate > 4.5 ? "above average" : "below average"}` : null,
    amount: mortgageImpact, // only surfaced when status is "attention" (rate above average)
  };

  // Personal loan
  const plBal = +d.personalLoanBalance||0, plRate = +d.personalLoanRate||0;
  const plMo = +d.personalLoanMonthly||0, plTerm = +d.personalLoanTermRemaining||0;
  const plInterestRemaining = Math.max(0, plMo * plTerm - plBal);
  s.personalLoan = {
    status: d.hasPersonalLoan !== "yes" || plBal === 0 ? "na"
          : plRate > 10 ? "critical" : plRate > 6 ? "attention" : "ok",
    impact: plInterestRemaining,
    impactLabel: plBal > 0 ? `${fmt(plInterestRemaining)} interest remaining at ${plRate}%` : null,
    amount: plInterestRemaining,
  };

  // Kids
  const kidsAge = d.hasKids === "yes" && d.kidsAges ? parseInt(d.kidsAges.split(",")[0]) : null;
  const kidsRunway = kidsAge !== null ? Math.max(0, 18 - kidsAge) : 10;
  const kidsImpact = d.hasKids === "yes" && d.hasJISA !== "yes"
    ? Math.round(100 * 12 * ((Math.pow(1.07, kidsRunway)-1)/0.07)) : 0;
  s.kids = {
    status: d.hasKids !== "yes" ? "na" : d.hasJISA !== "yes" ? "attention" : "ok",
    impact: kidsImpact,
    impactLabel: kidsImpact > 0 ? `~${fmt(kidsImpact)} JISA growth potential (£100/mo at 7%)` : null,
    amount: kidsImpact,
    amountIsLumpSum: true, // projected total by age 18, not a £/yr figure — exclude from /yr sums
  };

  return s;
}

// Merges a module's local (deterministic) status with the AI-generated narrative summary,
// applying the pension false-positive guard. Single source of truth for the explainer copy
// shown in the "Module breakdown" cards, ModuleDeepDive's header, and the PDF report.
export function getModuleSummary(mm, d, m, statuses, insights) {
  const local = statuses[mm.key] || { status:"na", impact:0 };
  const aiMod = insights?.modules?.[mm.key];
  // Pension + personalLoan: always trust local status — AI stale data causes false positives
  const status = (mm.key === "pension" || mm.key === "personalLoan")
    ? local.status
    : (aiMod?.status && aiMod.status !== "na") ? aiMod.status : local.status;
  const rawSummary = aiMod?.summary || (local.status !== "na" ? `Review your ${mm.title.toLowerCase()} situation.` : "N/A");
  // For pension: if contributing, never show AI copy that says "no pension" or "start contributions"
  const pensionContrib = mm.key === "pension" && isPensionContributing(d);
  const aiHasFalsePositive = pensionContrib && (
    rawSummary.toLowerCase().includes("no pension") ||
    rawSummary.toLowerCase().includes("start contribution") ||
    rawSummary.toLowerCase().includes("not contributing")
  );
  const summary = aiHasFalsePositive
    ? `Contributing ${d.myContribution||""}% with ${d.employerMatch||"0"}% employer match. ${m.missedMatch > 0 ? `Increase to ${d.employerMatch}% to capture ${fmt(m.missedMatch)}/yr in free employer match.` : "Review your projected pot and bonus sacrifice options."}`
    : rawSummary;
  // Always use local impact for sorting — AI doesn't provide numeric impact
  const impact = local.impact || 0;
  return { ...mm, status, summary, impact, impactLabel: local.impactLabel, amount: local.amount || 0, amountIsLumpSum: !!local.amountIsLumpSum };
}

function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const G2 = "#162f24", GOLD2 = "#c4963a", WHITE2 = "#ffffff", MUT2 = "#6b6b6b";
  const SANS2 = "'DM Sans',sans-serif", SERIF2 = "'Playfair Display',serif";
  return createPortal(
    <>
      {!open && (
        <button onClick={() => setOpen(true)} style={{
          position:"fixed", bottom:"100px", right:"0",
          background:G2, border:`2px solid ${GOLD2}`,
          borderRadius:"10px 0 0 10px", borderRight:"none",
          padding:"14px 12px", display:"flex", flexDirection:"column",
          alignItems:"center", gap:"8px", cursor:"pointer", zIndex:5000,
          boxShadow:"-3px 3px 12px rgba(0,0,0,0.18)",
        }}>
          <span style={{fontSize:"16px"}}>💬</span>
          <span style={{fontSize:"9px",fontWeight:700,color:GOLD2,letterSpacing:"0.1em",textTransform:"uppercase",writingMode:"vertical-rl",transform:"rotate(180deg)"}}>Feedback</span>
        </button>
      )}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position:"fixed",top:0,left:0,right:0,bottom:0,
          zIndex:9999, background:"rgba(22,47,36,0.7)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:"24px",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:WHITE2, borderRadius:"18px", maxWidth:"460px", width:"100%",
            overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,0.25)",
          }}>
            <div style={{background:GOLD2,padding:"14px 24px",display:"flex",alignItems:"center",gap:"10px"}}>
              <span style={{fontSize:"20px"}}>💬</span>
              <div>
                <div style={{fontFamily:SERIF2,fontSize:"16px",fontWeight:700,color:G2}}>How was your Candid report?</div>
                <div style={{fontSize:"11px",color:"rgba(22,47,36,0.65)",marginTop:"1px"}}>60 seconds — helps us build this right</div>
              </div>
              <button onClick={() => setOpen(false)} style={{marginLeft:"auto",background:"transparent",border:"none",fontSize:"20px",color:"rgba(22,47,36,0.4)",cursor:"pointer",lineHeight:1}}>×</button>
            </div>
            <div style={{padding:"24px"}}>
              <p style={{fontSize:"14px",color:MUT2,lineHeight:1.65,marginBottom:"20px"}}>
                Five quick questions — completely anonymous unless you choose to leave your email.
              </p>
              <a href="https://tally.so/r/aQrNKE" target="_blank" rel="noreferrer" style={{
                display:"block",width:"100%",background:G2,borderRadius:"10px",padding:"15px",
                textAlign:"center",fontSize:"15px",fontWeight:600,color:WHITE2,
                cursor:"pointer",fontFamily:SANS2,textDecoration:"none",marginBottom:"10px",
              }}>Share my feedback →</a>
              <button onClick={() => setOpen(false)} style={{
                display:"block",width:"100%",background:"transparent",
                border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"10px",
                padding:"12px",fontSize:"13px",color:MUT2,cursor:"pointer",fontFamily:SANS2,
              }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

function ScenarioPanel({ scenarios, currentScore, onEditInputs }) {
  const [activeId, setActiveId] = useState(null);
  const active = scenarios.find(s => s.id === activeId);
  return (
    <div style={{marginBottom:"24px"}}>
      <h3 style={{fontFamily:SERIF,fontSize:"18px",color:G,marginBottom:"12px"}}>What if you made one change?</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"10px"}}>
        {scenarios.map(sc => (
          <div key={sc.id}
            onClick={() => setActiveId(activeId === sc.id ? null : sc.id)}
            style={{background:WHITE,border:activeId===sc.id?`1.5px solid ${GOLD}`:"1px solid rgba(22,47,36,0.1)",borderRadius:"10px",padding:"14px",cursor:"pointer",transition:"border 0.15s"}}>
            <p style={{fontSize:"13px",fontWeight:600,color:G,margin:"0 0 4px"}}>{sc.label}</p>
            <p style={{fontSize:"12px",color:MUT,margin:"0 0 8px",lineHeight:1.45}}>{sc.description}</p>
            <span style={{fontSize:"11px",fontWeight:700,color:GOLD}}>See the impact →</span>
          </div>
        ))}
      </div>
      {active && (
        <div style={{marginTop:"12px",background:"rgba(196,150,58,0.07)",border:`1.5px solid ${GOLD}`,borderRadius:"10px",padding:"16px 18px",display:"flex",flexWrap:"wrap",alignItems:"center",gap:"16px"}}>
          <div style={{flex:1,minWidth:"180px"}}>
            <p style={{fontSize:"13px",fontWeight:700,color:G,margin:"0 0 4px"}}>{active.label}</p>
            <p style={{fontSize:"12px",color:MUT,margin:0,lineHeight:1.5}}>{active.description}</p>
          </div>
          <div style={{display:"flex",gap:"20px",alignItems:"center",flexWrap:"wrap"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"11px",color:MUT,marginBottom:"2px"}}>Financial impact</div>
              <div style={{fontSize:"18px",fontWeight:700,color:GOLD}}>{active.impactLabel}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"11px",color:MUT,marginBottom:"2px"}}>Score boost</div>
              <div style={{fontSize:"18px",fontWeight:700,color:"#2d6b4a"}}>+{active.scoreBoost} pts</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"11px",color:MUT,marginBottom:"2px"}}>New score</div>
              <div style={{fontSize:"18px",fontWeight:700,color:"#2d6b4a"}}>{Math.min(100, currentScore + active.scoreBoost)}</div>
            </div>
          </div>
          <button onClick={onEditInputs}
            style={{background:GOLD,border:"none",borderRadius:"8px",padding:"9px 18px",color:G,fontSize:"13px",fontWeight:700,cursor:"pointer",flexShrink:0}}>
            Apply this change
          </button>
          <button onClick={() => setActiveId(null)}
            style={{background:"transparent",border:"none",fontSize:"16px",color:MUT,cursor:"pointer",padding:"4px"}}>×</button>
        </div>
      )}
    </div>
  );
}

function Dashboard({ insights, d, m, statuses, savingsRates, onReset, onOpenModule, completedModules, onEditInputs, prevInsights, whatChangedOpen, onDismissWhatChanged, showScorePulse, lastScoreDelta, lastCompletedModule, prevScoreRef, scoreDeltas }) {
  const totalDelta = (scoreDeltas||[]).reduce((sum, s) => sum + s.delta, 0);
  const displayScore = Math.min(100, (insights?.score || 0) + totalDelta);
  const [netWorthExpanded, setNetWorthExpanded] = useState(false);
  const [scoreTextExpanded, setScoreTextExpanded] = useState(false); // mobile-only collapse for the AI narrative
  const [forecastHorizon, setForecastHorizon] = useState(5);
  const [forecastSurplus, setForecastSurplus] = useState(null); // null = use calculated default
  const [forecastLumpSum, setForecastLumpSum] = useState(null); // null = 0
  const [forecastTip, setForecastTip] = useState(null); // label of active assumption panel, or null
  const isMobile = useWindowWidth() < 768;
      if (!insights) return null;

  // Net worth breakdown
  const netWorthPositive = m.netWorth >= 0;
  const isaThisYear = m.isaUsedThisYear; // derived from granular fields in calcMetrics
  const isaPrev = (+d.isaPrevCash||0) + (+d.isaPrevSS||0) + (+d.isaPrevLISA||0) + (+d.isaPrevOther||0) || (+d.isaPreviousBalance||0);
  const totalIsa    = isaThisYear + isaPrev;
  const assetItems = [
    { label:"Cash & savings", value: m.cash + m.bonds, icon:"💷" },
    ...(totalIsa > 0 ? [
      { label:`ISA — this tax year${d.isaType ? ` (${d.isaType==="cash"?"Cash":d.isaType==="ss"?"S&S":d.isaType==="both"?"Cash + S&S":"—"})` : ""}`, value: isaThisYear, icon:"📈", sub:true },
      ...(isaPrev > 0 ? [{ label:"ISA — previous years", value: isaPrev, icon:"📈", sub:true }] : []),
      { label:"ISA total", value: totalIsa, icon:"📈", bold:true },
    ] : []),
    { label:"Unwrapped investments", value: +d.unwrappedValue||0, icon:"📊" },
    { label:"Pension pot", value: +d.potValue||0, icon:"🏦" },
    { label:"Property equity", value: m.propertyEquity||0, icon:"🏠" },
  ].filter(a => a.value > 0);
  const liabilityItems = [
    { label:"Mortgage", value: d.hasMortgage === "yes" ? (+d.mortgageBalance||0) : 0, icon:"🏠", excludedFromNetWorth:true },
    { label:"Student loan", value: m.loanBal||0, icon:"🎓" },
    { label:"Personal loan", value: d.hasPersonalLoan === "yes" ? (+d.personalLoanBalance||0) : 0, icon:"💳" },
  ].filter(l => l.value > 0);

  // Build merged module data: local computation provides status/impact, AI provides summary
  const localStatuses = statuses;
  const statusOrder = { critical:0, attention:1, ok:2, na:3 };

  const allModules = MODULE_META.map(mm => getModuleSummary(mm, d, m, localStatuses, insights));

  const activeModules = allModules.filter(mm => mm.status !== "na");

  // Module breakdown list — descending by the clean £/yr `amount` figure (not the
  // sort-priority `impact`, which carries a +99999 sentinel for an uncontributed
  // pension). Modules with nothing actionable (amount === 0) sink to the bottom.
  // Kids & Family is excluded from the ranking and always placed last — its `amount`
  // is a lump sum by age 18, not a £/yr figure, so it isn't comparable to the others.
  const rankedModules = activeModules.filter(mm => mm.key !== "kids");
  const kidsModule     = activeModules.find(mm => mm.key === "kids") || null;
  const modulesWithRec = rankedModules.filter(mm => mm.amount > 0).sort((a,b) => b.amount - a.amount);
  const modulesNoRec   = rankedModules.filter(mm => mm.amount === 0);
  const moduleList     = [...modulesWithRec, ...modulesNoRec, ...(kidsModule ? [kidsModule] : [])];
  const needActionCount = modulesWithRec.length + (kidsModule && kidsModule.amount > 0 ? 1 : 0);
  const onTrackCount    = modulesNoRec.length + (kidsModule && kidsModule.amount === 0 ? 1 : 0);

  const totalOpp = modulesWithRec.filter(mm => !mm.amountIsLumpSum).reduce((sum, mm) => sum + mm.amount, 0);

  // ── Your Forecast — recalculates live as horizon/surplus controls change ────
  const forecast = calcForecast(d, m, forecastSurplus, forecastHorizon, forecastLumpSum ?? 0);
  const forecastSeries = calcForecastSeries(d, m, forecastSurplus, forecastHorizon, forecastLumpSum ?? 0);
  const forecastSlRatePct = Math.round(resolveSlRate(d, m.salary) * 1000) / 10;
  const FORECAST_ASSUMPTIONS = {
    "Mortgage overpayment": {
      lines: [
        `Interest saved by overpaying at your current mortgage rate.`,
        `If cleared early, freed-up payments earn ${(CASH_RATE_CENTRAL*100).toFixed(1)}% in savings for the remaining period.`,
        `Low / High shift the mortgage rate ±0.5%.`,
      ],
      rates: {
        low: `${Math.max(0, (+d.mortgageRate||0) - 0.5).toFixed(1)}%`,
        central: `${(+d.mortgageRate||0).toFixed(1)}%`,
        high: `${((+d.mortgageRate||0) + 0.5).toFixed(1)}%`,
      },
    },
    "Student loan overpayment": {
      lines: [
        `Cumulative interest saved vs making no extra repayments.`,
        `Interest rate: ${forecastSlRatePct}% p.a. (${+d.studentLoanRate > 0 ? "your entered rate" : "SLC 2024/25 default"}).`,
        `Low / High reflect salary growth uncertainty — not a rate variation.`,
        `Benefit is zero if the loan is written off regardless of overpayment.`,
      ],
      rates: {
        low: `${forecastSlRatePct}%`,
        central: `${forecastSlRatePct}%`,
        high: `${forecastSlRatePct}%`,
      },
    },
    "Stocks & Shares ISA": {
      lines: [
        `Globally diversified index fund, returns compound monthly.`,
        `Tax-free inside an ISA.`,
        `Past performance is not a reliable guide to future returns.`,
      ],
      rates: { low: "4% p.a.", central: "6% p.a.", high: "8% p.a." },
    },
    "Cash savings": {
      lines: [
        `Easy-access savings account or Cash ISA.`,
        `UK market defaults (Sep 2024). Your entered rate used as central if provided, with a ±1.5% spread.`,
      ],
      rates: {
        low: `${(CASH_RATE_LOW*100).toFixed(1)}% p.a.`,
        central: `${(CASH_RATE_CENTRAL*100).toFixed(1)}% p.a.`,
        high: `${(CASH_RATE_HIGH*100).toFixed(1)}% p.a.`,
      },
    },
    "Pension (salary sacrifice)": {
      lines: [
        `Surplus paid before tax and NI — HMRC effectively tops it up immediately.`,
        `Uplift reflects your marginal tax rate plus the employer NI saving passed through.`,
        `Excludes employer contributions on the extra amount.`,
      ],
      rates: { low: "4% p.a.", central: "6% p.a.", high: "8% p.a." },
    },
    "Pension (relief at source)": {
      lines: [
        `Every £1 you contribute becomes £1.25 in the pension (20% HMRC basic-rate top-up).`,
        `Higher-rate relief via self-assessment not modelled — conservative estimate.`,
      ],
      rates: { low: "4% p.a.", central: "6% p.a.", high: "8% p.a." },
    },
  };
  const forecastChart = (() => {
    const { years, series } = forecastSeries;
    const allValues = series.flatMap(s => s.values);
    const yMax = Math.max(1, ...allValues);
    const horizonYrs = years[years.length - 1] || 1;
    const VW = 680, VH = 280, PL = 60, PR = 16, PT = 16, PB = 32;
    const cW = VW - PL - PR, cH = VH - PT - PB;
    const sx = yr => PL + (yr / horizonYrs) * cW;
    const sy = v => PT + cH - (v / yMax) * cH;
    const paths = series.map(s => {
      const endIdx = s.termYear != null ? s.termYear : s.values.length - 1;
      const d = s.values.slice(0, endIdx + 1).map((v, i) => `${i===0?"M":"L"}${sx(years[i]).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
      const termDot = s.termYear != null ? {
        x: +sx(s.termYear).toFixed(1),
        y: +sy(s.values[s.termYear]).toFixed(1),
        label: s.termLabel,
      } : null;
      return { label: s.label, d, termDot };
    });
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => yMax * f);
    const xTicks = [...new Set([0, Math.round(horizonYrs*0.25), Math.round(horizonYrs*0.5), Math.round(horizonYrs*0.75), horizonYrs])];
    return { VW, VH, PL, PR, PT, PB, cW, cH, sx, sy, paths, yTicks, xTicks };
  })();

  return (
    <PageWrap>
      <FeedbackButton />
      <NavBar right={<div style={{display:"flex",gap:"8px",alignItems:"center"}}>
        <button onClick={onEditInputs} style={{background:GOLD,border:"none",borderRadius:"8px",padding:"9px 18px",color:G,fontSize:"13px",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:"6px"}}>✏️ Edit inputs</button>
        <GhostBtn onClick={onReset}>Start over</GhostBtn>
      </div>}/>
      <ContentWrap maxWidth="780px">
        {/* Score improvement banner (on regeneration) */}
        {prevScoreRef?.current !== null && insights.score > (prevScoreRef?.current||0) && whatChangedOpen && (
          <div style={{background:"rgba(45,107,74,0.1)",border:"1px solid rgba(45,107,74,0.3)",borderRadius:"10px",padding:"12px 18px",marginBottom:"16px",display:"flex",alignItems:"center",gap:"12px"}}>
            <span style={{fontSize:"20px"}}>📈</span>
            <div>
              <div style={{fontSize:"13px",fontWeight:700,color:"#2D6B4A"}}>Your score improved by +{insights.score - (prevScoreRef?.current||0)} points</div>
              <div style={{fontSize:"12px",color:MUT}}>Your recent changes moved your Candid score from {prevScoreRef?.current} to {insights.score}</div>
            </div>
          </div>
        )}

        {/* What changed banner */}
        {prevInsights && whatChangedOpen && (() => {
          const scoreDelta = insights.score - prevInsights.score;
          const changed = Object.keys(insights.modules||{}).filter(k => insights.modules[k]?.status !== prevInsights.modules?.[k]?.status);
          return (
            <div style={{background:"rgba(22,47,36,0.05)",border:"1px solid rgba(22,47,36,0.15)",borderRadius:"10px",padding:"14px 16px",marginBottom:"20px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}}>
                <div>
                  <div style={{fontSize:"12px",fontWeight:700,color:G,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"6px"}}>What changed in your report</div>
                  <div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
                    <span style={{fontFamily:SERIF,fontSize:"22px",fontWeight:700,color:scoreDelta >= 0 ? "#2d6b4a" : "#c0392b"}}>
                      {scoreDelta >= 0 ? "+" : ""}{scoreDelta} points
                    </span>
                    {changed.length > 0 && (
                      <span style={{fontSize:"13px",color:MUT}}>{changed.map(k => {
                        const from = prevInsights.modules[k]?.status, to = insights.modules[k]?.status;
                        const pretty = {cash:"Cash",investments:"Investments",pension:"Pension",studentLoan:"Student loan",mortgage:"Mortgage",personalLoan:"Personal loan",kids:"Kids"};
                        return `${pretty[k]||k}: ${from} → ${to}`;
                      }).join(" · ")}</span>
                    )}
                  </div>
                </div>
                <button onClick={onDismissWhatChanged} style={{background:"transparent",border:"none",color:MUT,fontSize:"18px",cursor:"pointer",padding:"2px 6px",flexShrink:0,lineHeight:1}}>×</button>
              </div>
            </div>
          );
        })()}

        {/* Tax year countdown banner */}
        {(() => {
          const now = new Date();
          const taxYearEnd = new Date(now.getFullYear(), 3, 5); // April 5
          if (taxYearEnd < now) taxYearEnd.setFullYear(taxYearEnd.getFullYear() + 1);
          const days = Math.round((taxYearEnd - now) / 86400000);
          if (days > 90) return null;
          return (
            <div style={{borderLeft:`4px solid ${GOLD}`,background:"rgba(196,150,58,0.07)",borderRadius:"0 8px 8px 0",padding:"13px 16px",marginBottom:"20px",display:"flex",alignItems:"center",gap:"12px"}}>
              <span style={{fontSize:"20px"}}>📅</span>
              <div>
                <div style={{fontSize:"12px",fontWeight:700,color:GOLD,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"2px"}}>Tax year ends in {days} day{days!==1?"s":""}</div>
                <p style={{fontSize:"13px",color:G,margin:0}}>ISA allowance ({fmt(m.isaHeadroom)} remaining) and other tax reliefs reset on April 6th — use them or lose them.</p>
              </div>
            </div>
          );
        })()}

        {/* Greeting */}
        <h1 style={{fontFamily:SERIF,fontSize:"clamp(22px,4vw,28px)",color:G,fontWeight:700,marginBottom:"20px",lineHeight:1.2}}>
          {d.name ? `Hi ${d.name},` : "Hi,"} here's your Candid report.
        </h1>

        {/* Score card — mobile stacks title → ring → (collapsible) body text →
            update-inputs, all centered except the body text itself; desktop keeps
            the original ring-left / text-right row layout unchanged. */}
        <div className="fu" style={{background:G,borderRadius:"16px",padding:"20px 28px",display:"flex",flexDirection:isMobile?"column":"row",alignItems:isMobile?"center":"center",gap:"24px",marginBottom:"20px",flexWrap:"wrap"}}>
          {isMobile ? (
            <div style={{width:"100%",textAlign:"center"}}>
              <div style={{fontSize:"10px",fontWeight:700,color:GOLD,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"14px"}}>Your Candid Score</div>
              <div style={{display:"flex",justifyContent:"center",marginBottom:"16px"}}>
                <ScoreRing score={displayScore} delta={totalDelta}/>
              </div>
              <div style={{textAlign:"left"}}>
                <h2 style={{fontFamily:SERIF,color:WHITE,fontSize:"18px",lineHeight:1.35,margin:0}}>{insights.headline}</h2>
                {scoreTextExpanded && (
                  <>
                    <p style={{color:"rgba(255,255,255,0.65)",fontSize:"14px",lineHeight:1.7,marginTop:"8px",marginBottom:insights.isFallback?"10px":0}}>{insights.narrative}</p>
                    {insights.isFallback && (
                      <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",fontStyle:"italic",margin:0}}>
                        We couldn't generate your personalised analysis just now, so you're seeing a general summary — try regenerating shortly.
                      </p>
                    )}
                  </>
                )}
                <button type="button" onClick={() => setScoreTextExpanded(v => !v)} style={{background:"transparent",border:"none",color:GOLD,fontSize:"12px",fontWeight:700,cursor:"pointer",padding:0,marginTop:"10px"}}>
                  {scoreTextExpanded ? "Show less ↑" : "Show more ↓"}
                </button>
              </div>
              <div style={{textAlign:"center",marginTop:"18px",paddingTop:"16px",borderTop:"1px solid rgba(255,255,255,0.12)"}}>
                <p style={{fontSize:"12px",color:"rgba(255,255,255,0.5)",lineHeight:1.5,marginBottom:"8px"}}>Changed your circumstances? Update your inputs for a fresh score.</p>
                <button onClick={onEditInputs} style={{background:"transparent",border:`1.5px solid ${GOLD}`,borderRadius:"7px",padding:"7px 14px",color:GOLD,fontSize:"12px",fontWeight:700,cursor:"pointer"}}>Update inputs</button>
              </div>
            </div>
          ) : (
            <>
              <ScoreRing score={displayScore} delta={totalDelta}/>
              <div style={{flex:1,minWidth:"200px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:GOLD,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"6px"}}>Your Candid Score</div>
                <h2 style={{fontFamily:SERIF,color:WHITE,fontSize:"20px",lineHeight:1.35,marginBottom:"8px"}}>{insights.headline}</h2>
                <p style={{color:"rgba(255,255,255,0.65)",fontSize:"14px",lineHeight:1.7,marginBottom:insights.isFallback?"10px":0}}>{insights.narrative}</p>
                {insights.isFallback && (
                  <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",fontStyle:"italic",margin:0}}>
                    We couldn't generate your personalised analysis just now, so you're seeing a general summary — try regenerating shortly.
                  </p>
                )}
              </div>
              <div style={{flexShrink:0,textAlign:"right",maxWidth:"210px"}}>
                <p style={{fontSize:"12px",color:"rgba(255,255,255,0.5)",lineHeight:1.5,marginBottom:"8px"}}>Changed your circumstances? Update your inputs for a fresh score.</p>
                <button onClick={onEditInputs} style={{background:"transparent",border:`1.5px solid ${GOLD}`,borderRadius:"7px",padding:"7px 14px",color:GOLD,fontSize:"12px",fontWeight:700,cursor:"pointer"}}>Update inputs</button>
              </div>
            </>
          )}
        </div>


        {/* Premium bonds countdown */}
        {isNearPremiumBondDraw() && (+d.premiumBonds||0) > 0 && (() => {
          const now = new Date();
          // First working day of next month
          function firstWorkingDay(year, month) {
            const d = new Date(year, month, 1);
            const day = d.getDay(); // 0=Sun, 6=Sat
            if (day === 0) d.setDate(2); // Sunday → Monday
            if (day === 6) d.setDate(3); // Saturday → Monday
            return d;
          }
          const thisMonthDraw = firstWorkingDay(now.getFullYear(), now.getMonth());
          const nextMonthDraw = firstWorkingDay(now.getFullYear(), now.getMonth() + 1);
          const isDrawDay = now.toDateString() === thisMonthDraw.toDateString();
          const target = isDrawDay ? thisMonthDraw : nextMonthDraw;
          const daysUntil = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
          return (
            <div className="fu1" style={{background:"rgba(196,150,58,0.08)",border:"1px solid rgba(196,150,58,0.28)",borderRadius:"12px",padding:"14px 18px",marginBottom:"16px",display:"flex",alignItems:"center",gap:"14px"}}>
              <span style={{fontSize:"24px",flexShrink:0}}>🏆</span>
              <div style={{flex:1}}>
                <div style={{fontSize:"13px",fontWeight:700,color:G,marginBottom:"3px"}}>
                  {isDrawDay ? "It's Premium Bond draw day!" : `${daysUntil} day${daysUntil!==1?"s":""} until the next Premium Bond draw`}
                </div>
                <div style={{fontSize:"13px",color:MUT,lineHeight:1.5}}>
                  {isDrawDay
                    ? `NS&I results are out. Did you win? You hold ${fmt(+d.premiumBonds)} — your expected monthly return is ~${fmt(Math.round(+d.premiumBonds * 0.044 / 12))} on average.`
                    : `Results are published on the first working day of each month. You hold ${fmt(+d.premiumBonds)} — expected ~${fmt(Math.round(+d.premiumBonds * 0.044 / 12))}/month. A good time to review your Candid score when they're out.`
                  }
                </div>
              </div>
              <button type="button" onClick={() => onOpenModule("cash")} style={{background:G,border:"none",borderRadius:"6px",padding:"7px 12px",color:WHITE,fontSize:"12px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>Review savings →</button>
            </div>
          );
        })()}

        {/* Total opportunity — lighter green than the score card, label-above-value
            template. Mobile stacks title → £ figure → body text, all centered
            except the body text; desktop keeps the figure-column / text-column
            row aligned with the score card's ring column above it. */}
        {totalOpp >= 500 && (() => {
          const eq = getEquivalence(totalOpp);
          const bodyText = (
            <>
              <div style={{fontSize:"14px",color:MUT}}>You could be leaving <span style={{fontWeight:700,color:G}}>{fmt(totalOpp)}</span> on the table.</div>
              {eq && <div style={{fontSize:"12px",color:"#a67c2e",fontWeight:600,marginTop:"6px"}}>{eq}</div>}
              <div style={{fontSize:"11px",color:MUT,marginTop:"10px",lineHeight:1.6}}>
                Sum of yield gaps, missed tax relief, and interest costs — across all open modules below.
              </div>
            </>
          );
          return (
            <div className="fu1" style={{background:WHITE,border:`2px solid ${G}`,borderRadius:"14px",padding:"20px 28px",marginBottom:"20px",display:"flex",flexDirection:isMobile?"column":"row",alignItems:"center",gap:"24px",flexWrap:"wrap"}}>
              {isMobile ? (
                <div style={{width:"100%",textAlign:"center"}}>
                  <div style={{fontSize:"10px",fontWeight:800,color:G,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"10px"}}>Your total opportunity</div>
                  <div style={{marginBottom:"16px"}}>
                    <span style={{fontFamily:SERIF,fontSize:"32px",fontWeight:700,color:G,lineHeight:1.1}}>{fmt(totalOpp)}</span>
                    <div style={{fontSize:"10px",color:MUT,fontWeight:500,marginTop:"3px"}}>per year</div>
                  </div>
                  <div style={{textAlign:"left"}}>{bodyText}</div>
                </div>
              ) : (
                <>
                  <div style={{width:"124px",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
                    <span style={{fontFamily:SERIF,fontSize:"32px",fontWeight:700,color:G,lineHeight:1.1}}>{fmt(totalOpp)}</span>
                    <span style={{fontSize:"10px",color:MUT,fontWeight:500,marginTop:"3px"}}>per year</span>
                  </div>
                  <div style={{flex:1,minWidth:"200px"}}>
                    <div style={{fontSize:"10px",fontWeight:800,color:G,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"8px"}}>Your total opportunity</div>
                    {bodyText}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Module breakdown — full-width, stacked, sorted by £ opportunity descending.
            Tile format mirrors the numbered "Win N" cards inside each module: the
            module title leads, the £ figure is a supporting line underneath it. */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
          <h3 style={{fontFamily:SERIF,fontSize:"21px",color:G}}>Module breakdown</h3>
          <span style={{fontSize:"12px",color:MUT}}>{needActionCount} need action · {onTrackCount} on track</span>
        </div>

        <div style={{marginBottom:"24px"}}>
          {(() => {
            let winNumber = 0;
            return moduleList.map((mm, i) => {
              const reviewed = completedModules.includes(mm.key);
              const hasRec = mm.amount > 0;
              if (hasRec) winNumber++;
              const tag = hasRec ? MODULE_TAG[mm.key] : null;
              const context = hasRec ? moduleContext(mm, d, m) : null;
              // Reviewed tiles grey out a little on top of the base (no-recommendation)
              // dimming — kept as a separate multiplier so the two states stack rather
              // than fight each other.
              const baseOpacity = hasRec ? 1 : 0.6;
              const tileOpacity = reviewed ? +(baseOpacity * 0.75).toFixed(2) : baseOpacity;
              return (
                <div key={mm.key} onClick={() => onOpenModule(mm.key)} className={`fu${Math.min(i+1,7)}`}
                  style={{background:reviewed?"#f6f6f4":WHITE,border:`1.5px solid ${hasRec ? "rgba(22,47,36,0.14)" : "rgba(22,47,36,0.08)"}`,borderRadius:"12px",padding:"16px 18px",marginBottom:"10px",cursor:"pointer",opacity:tileOpacity,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:"12px",minWidth:0,flex:1}}>
                    <div style={{width:"24px",height:"24px",borderRadius:"50%",background:hasRec?G:"rgba(22,47,36,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>
                      {hasRec ? (
                        <span style={{fontSize:"12px",fontWeight:700,color:CREAM}}>{winNumber}</span>
                      ) : (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke={WHITE} strokeWidth="1.8" strokeLinecap="round"/></svg>
                      )}
                    </div>
                    {/* Icon trails the title (rather than leading it) so the title and the
                        body line below both start flush at the same left edge. */}
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:"16px",fontWeight:700,color:G,lineHeight:1.3}}>{mm.title} <span style={{fontSize:"14px"}}>{mm.icon}</span></div>
                      {hasRec ? (
                        <div style={{fontSize:"14px",color:TEXT,marginTop:"4px",lineHeight:1.4}}>
                          <span style={{fontWeight:700,color:G}}>{fmt(mm.amount)}{mm.amountIsLumpSum ? " by 18" : "/yr"}</span>
                          {context && <span style={{color:MUT}}> — {context}</span>}
                        </div>
                      ) : (
                        <div style={{fontSize:"13px",color:MUT,marginTop:"4px",lineHeight:1.4}}>{mm.impactLabel || "On track — no action needed"}</div>
                      )}
                    </div>
                  </div>
                  {/* Tag pill always occupies the top slot; the reviewed tick sits below
                      it in the same column so its appearance never shifts the tag. */}
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px",flexShrink:0}}>
                    {tag && <TagPill label={tag.label} color={tag.color}/>}
                    {hasRec && reviewed && <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="#2d6b4a" strokeWidth="2" strokeLinecap="round"/></svg>}
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Your Forecast */}
        <div className="fu1" style={{background:WHITE,borderRadius:"16px",padding:isMobile?"18px":"24px",border:"1px solid rgba(22,47,36,0.09)",marginBottom:"24px"}}>
          <h3 style={{fontFamily:SERIF,fontSize:"21px",color:G,marginBottom:"4px"}}>Your Forecast</h3>
          <p style={{fontSize:"13px",color:MUT,marginBottom:"18px"}}>See what your surplus could become under different strategies.</p>

          {/* Controls row */}
          <div style={{display:"flex",gap:"20px",flexWrap:"wrap",alignItems:"flex-start",marginBottom:"22px"}}>
            <div style={{flex:"1 1 280px"}}>
              <label style={LBL}>Time horizon</label>
              <Toggle value={forecastHorizon} onChange={setForecastHorizon} options={[
                {value:5,label:"5 years"},{value:10,label:"10 years"},{value:20,label:"20 years"},{value:40,label:"40 years"},
              ]}/>
            </div>
            <div style={{flex:"0 0 160px"}}>
              <label style={LBL}>Monthly surplus</label>
              <FmtInput
                value={forecastSurplus != null ? forecastSurplus : Math.round(m.monthlySurplus)}
                onChange={v => setForecastSurplus(v === "" ? null : +v)}
                fmtType="gbp"
                style={{marginTop:"6px"}}
              />
              <div style={{fontSize:"11px",color:MUT,marginTop:"4px"}}>per month</div>
            </div>
            <div style={{flex:"0 0 160px"}}>
              <label style={LBL}>Lump sum today</label>
              <FmtInput
                value={forecastLumpSum != null ? forecastLumpSum : 0}
                onChange={v => setForecastLumpSum(v === "" ? null : +v)}
                fmtType="gbp"
                style={{marginTop:"6px"}}
              />
              <div style={{fontSize:"11px",color:MUT,marginTop:"4px"}}>one-off today</div>
            </div>
          </div>

          {/* Line graph */}
          <svg viewBox={`0 0 ${forecastChart.VW} ${forecastChart.VH}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{display:"block",overflow:"visible",marginBottom:"12px"}}>
            <rect x={forecastChart.PL} y={forecastChart.PT} width={forecastChart.cW} height={forecastChart.cH} fill="rgba(22,47,36,0.03)" rx="4"/>
            {forecastChart.yTicks.map((v,i) => (
              <g key={i}>
                <line x1={forecastChart.PL} x2={forecastChart.VW-forecastChart.PR} y1={forecastChart.sy(v)} y2={forecastChart.sy(v)} stroke="rgba(22,47,36,0.09)" strokeWidth="1.5"/>
                <text x={forecastChart.PL-10} y={forecastChart.sy(v)+4} fontSize="12" fontWeight="700" fill={MUT} textAnchor="end">{v >= 1000 ? `£${Math.round(v/1000)}k` : fmt(v)}</text>
              </g>
            ))}
            {forecastChart.paths.map(p => {
              const color = FORECAST_COLORS[p.label] || MUT;
              return (
                <g key={p.label}>
                  <path d={p.d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  {p.termDot && (
                    <>
                      <circle cx={p.termDot.x} cy={p.termDot.y} r="5" fill={color}/>
                      <text x={p.termDot.x + 8} y={p.termDot.y + 4} fontSize="10" fontWeight="600" fill={color}>{p.termDot.label}</text>
                    </>
                  )}
                </g>
              );
            })}
            <line x1={forecastChart.PL} x2={forecastChart.VW-forecastChart.PR} y1={forecastChart.VH-forecastChart.PB} y2={forecastChart.VH-forecastChart.PB} stroke="rgba(22,47,36,0.25)" strokeWidth="2"/>
            {forecastChart.xTicks.map((yr,i) => (
              <text key={i} x={forecastChart.sx(yr)} y={forecastChart.VH-forecastChart.PB+20} fontSize="12" fontWeight="700" fill={MUT} textAnchor="middle">Yr {yr}</text>
            ))}
            <line x1={forecastChart.PL} x2={forecastChart.PL} y1={forecastChart.PT} y2={forecastChart.VH-forecastChart.PB} stroke="rgba(22,47,36,0.25)" strokeWidth="2"/>
          </svg>

          {/* Legend */}
          <div style={{display:"flex",gap:"16px",flexWrap:"wrap",marginBottom:"22px"}}>
            {forecastChart.paths.map(p => (
              <div key={p.label} style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",color:TEXT}}>
                <span style={{width:"10px",height:"10px",borderRadius:"50%",background:FORECAST_COLORS[p.label]||MUT,display:"inline-block",flexShrink:0}}/>
                {p.label}
              </div>
            ))}
          </div>

          {/* Summary table */}
          <div style={{overflowX:"auto",marginBottom:"12px"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
              <thead>
                <tr>
                  <th style={{textAlign:"left",padding:"8px 10px",borderBottom:"1.5px solid rgba(22,47,36,0.12)",color:MUT,fontSize:"11px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Option</th>
                  <th style={{textAlign:"right",padding:"8px 10px",borderBottom:"1.5px solid rgba(22,47,36,0.12)",color:MUT,fontSize:"11px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Low</th>
                  <th style={{textAlign:"right",padding:"8px 10px",borderBottom:"1.5px solid rgba(22,47,36,0.12)",color:MUT,fontSize:"11px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Central</th>
                  <th style={{textAlign:"right",padding:"8px 10px",borderBottom:"1.5px solid rgba(22,47,36,0.12)",color:MUT,fontSize:"11px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>High</th>
                </tr>
              </thead>
              <tbody>
                {forecast.options.map(o => {
                  const isOpen = forecastTip === o.label;
                  const assumptions = FORECAST_ASSUMPTIONS[o.label];
                  const rowBorder = isOpen ? "none" : "1px solid rgba(22,47,36,0.06)";
                  return (
                    <>
                      <tr key={o.label}>
                        <td style={{padding:"10px",borderBottom:rowBorder,color:TEXT,fontWeight:600}}>
                          <div style={{display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap"}}>
                            <span style={{width:"10px",height:"10px",borderRadius:"50%",background:FORECAST_COLORS[o.label]||MUT,display:"inline-block",flexShrink:0}}/>
                            {o.label}
                            {assumptions && (
                              <button type="button"
                                onClick={() => setForecastTip(isOpen ? null : o.label)}
                                style={{width:"16px",height:"16px",borderRadius:"50%",background:isOpen ? MUT : "rgba(22,47,36,0.18)",border:"none",color:WHITE,fontSize:"10px",fontWeight:700,cursor:"pointer",lineHeight:1,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                ?
                              </button>
                            )}
                          </div>
                          {o.note && <div style={{fontSize:"11px",color:MUT,fontWeight:400,marginTop:"3px",whiteSpace:"normal"}}>{o.note}</div>}
                        </td>
                        <td style={{padding:"10px",borderBottom:rowBorder,textAlign:"right",color:MUT}}>{fmt(o.low)}</td>
                        <td style={{padding:"10px",borderBottom:rowBorder,textAlign:"right",color:G,fontWeight:700}}>{fmt(o.central)}</td>
                        <td style={{padding:"10px",borderBottom:rowBorder,textAlign:"right",color:MUT}}>{fmt(o.high)}</td>
                      </tr>
                      {isOpen && assumptions && (
                        <tr key={o.label+"-tip"}>
                          <td style={{padding:"8px 10px 14px",borderBottom:"1px solid rgba(22,47,36,0.06)",background:"#f8f7f4",verticalAlign:"top"}}>
                            {assumptions.lines.map((line, i) => (
                              <div key={i} style={{fontSize:"12px",color:TEXT,lineHeight:1.65,paddingTop: i===0 ? 0 : "4px"}}>{line}</div>
                            ))}
                          </td>
                          <td style={{padding:"8px 10px 14px",borderBottom:"1px solid rgba(22,47,36,0.06)",background:"#f8f7f4",textAlign:"right",verticalAlign:"top",color:MUT,fontSize:"12px",whiteSpace:"nowrap"}}>{assumptions.rates.low}</td>
                          <td style={{padding:"8px 10px 14px",borderBottom:"1px solid rgba(22,47,36,0.06)",background:"#f8f7f4",textAlign:"right",verticalAlign:"top",color:G,fontSize:"12px",fontWeight:700,whiteSpace:"nowrap"}}>{assumptions.rates.central}</td>
                          <td style={{padding:"8px 10px 14px",borderBottom:"1px solid rgba(22,47,36,0.06)",background:"#f8f7f4",textAlign:"right",verticalAlign:"top",color:MUT,fontSize:"12px",whiteSpace:"nowrap"}}>{assumptions.rates.high}</td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Disclaimer */}
          <p style={{fontSize:"11px",color:MUT,lineHeight:1.5,margin:0}}>
            These are illustrative projections based on assumed rates of return, which are not guaranteed and may vary significantly. This is guidance, not financial advice — the right strategy depends on your full circumstances.
          </p>
        </div>

        {/* Net worth summary — relegated to the bottom of the dashboard */}
        {(assetItems.length > 0 || liabilityItems.length > 0) && (
          <div
            className="fu1"
            onClick={() => setNetWorthExpanded(v => !v)}
            style={{
              background: WHITE,
              borderRadius: "12px",
              padding: "14px 18px",
              border: "1px solid rgba(22,47,36,0.09)",
              marginBottom: "16px",
              cursor: "pointer",
            }}
          >
            {/* Collapsed row: title + net worth + assets/liabilities + toggle — all on one line */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:"8px"}}>
                <span style={{fontFamily:SERIF,fontSize:"14px",color:G,fontWeight:600}}>Net worth</span>
                <span style={{fontFamily:SERIF,fontSize:"28px",fontWeight:700,color:netWorthPositive?"#2d6b4a":"#c0392b",lineHeight:1}}>{fmt(Math.abs(m.netWorth))}</span>
                <span style={{fontSize:"11px",color:MUT}}>{netWorthPositive?"net positive":"net negative"}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"14px",flexWrap:"wrap"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:"#2d6b4a",letterSpacing:"0.07em",textTransform:"uppercase"}}>Assets {fmt(m.totalAssets)}</div>
                <div style={{fontSize:"10px",fontWeight:700,color:"#c0392b",letterSpacing:"0.07em",textTransform:"uppercase"}}>Liabilities {fmt(m.totalLiabilities)}</div>
                <span style={{fontSize:"10px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase",userSelect:"none"}}>{netWorthExpanded?"↑":"↓"}</span>
              </div>
            </div>

            {/* Detailed breakdown (toggle) */}
            {netWorthExpanded && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    {assetItems.map((a, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: a.bold ? "6px 0 5px" : "4px 0",
                          borderBottom: `1px solid rgba(22,47,36,${a.bold ? 0.1 : 0.05})`,
                          borderTop: a.bold ? "1px solid rgba(22,47,36,0.08)" : undefined,
                          marginLeft: a.sub ? "10px" : undefined
                        }}
                      >
                        <span
                          style={{
                            fontSize: a.bold ? "13px" : "12.5px",
                            color: a.bold ? G : MUT,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontWeight: a.bold ? 700 : 400
                          }}
                        >
                          {!a.sub && !a.bold && <span>{a.icon}</span>}
                          {a.sub && <span style={{ fontSize: "10px", color: "rgba(22,47,36,0.3)" }}>└</span>}
                          {a.label}
                        </span>
                        <span
                          style={{
                            fontSize: a.bold ? "13px" : "12.5px",
                            fontWeight: a.bold ? 700 : 600,
                            color: a.bold ? G : TEXT
                          }}
                        >
                          {fmt(a.value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div>
                    {liabilityItems.length > 0 ? (
                      liabilityItems.map((l, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "5px 0",
                            borderBottom: "1px solid rgba(22,47,36,0.05)"
                          }}
                        >
                          <span style={{ fontSize: "13px", color: MUT, display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>{l.icon}</span>
                            {l.label}
                            {l.excludedFromNetWorth && (
                              <span style={{fontSize:"9.5px",fontWeight:700,color:GOLD,background:"rgba(196,150,58,0.12)",padding:"1.5px 6px",borderRadius:"100px",textTransform:"uppercase",letterSpacing:"0.03em",whiteSpace:"nowrap"}}>Excl. net worth</span>
                            )}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#c0392b" }}>
                            {fmt(l.value)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: "13px", color: MUT, padding: "5px 0" }}>
                        No liabilities recorded 🎉
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid rgba(22,47,36,0.08)",
                    fontSize: "11px",
                    color: MUT,
                    lineHeight: 1.5
                  }}
                >
                  Note: Pension pot shown at current value, not projected. Property is excluded — connect your accounts via
                  Open Banking (coming soon) for a complete picture. Mortgage debt isn't subtracted from the net worth figure
                  above (your property equity is already net of it) but is still included in total liabilities.
                </div>
              </>
            )}
          </div>
        )}

        <p style={{fontSize:"12px",color:MUT,lineHeight:1.7,borderTop:"1px solid rgba(22,47,36,0.12)",paddingTop:"20px"}}>
          Candid provides financial education and guidance only — not regulated financial advice. All projections are estimates. Tax rules may change. Consider speaking to an IFA for personalised advice.{" "}
          <a href="/privacy.html" target="_blank" rel="noreferrer" style={{color:MUT}}>Privacy Policy</a>
          {" · "}
          <a href="/terms.html" target="_blank" rel="noreferrer" style={{color:MUT}}>Terms of Service</a>
        </p>
      </ContentWrap>
    </PageWrap>
  );
}

// ── Global feedback modal (rendered at router level, works across all screens) ──
function FeedbackModal({ onDismiss }) {
  return createPortal(
    <div onClick={onDismiss} style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(22,47,36,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:WHITE,borderRadius:"18px",maxWidth:"460px",width:"100%",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.25)"}}>
        <div style={{background:GOLD,padding:"14px 24px",display:"flex",alignItems:"center",gap:"10px"}}>
          <span style={{fontSize:"20px"}}>💬</span>
          <div>
            <div style={{fontFamily:SERIF,fontSize:"16px",fontWeight:700,color:G}}>How was your Candid report?</div>
            <div style={{fontSize:"11px",color:"rgba(22,47,36,0.65)",marginTop:"1px"}}>60 seconds — helps us build this right</div>
          </div>
          <button onClick={onDismiss} style={{marginLeft:"auto",background:"transparent",border:"none",fontSize:"20px",color:"rgba(22,47,36,0.4)",cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{padding:"24px"}}>
          <p style={{fontSize:"14px",color:MUT,lineHeight:1.65,marginBottom:"20px"}}>Five quick questions — completely anonymous unless you choose to leave your email.</p>
          <a href="https://tally.so/r/aQrNKE" target="_blank" rel="noreferrer" onClick={() => { posthog.capture("feedback_submitted"); supaUpdate({ feedback_submitted: true }); }} style={{display:"block",width:"100%",background:G,borderRadius:"10px",padding:"15px",textAlign:"center",fontSize:"15px",fontWeight:600,color:WHITE,cursor:"pointer",fontFamily:SANS,textDecoration:"none",marginBottom:"10px"}}>Share my feedback →</a>
          <button onClick={onDismiss} style={{display:"block",width:"100%",background:"transparent",border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"10px",padding:"12px",fontSize:"13px",color:MUT,cursor:"pointer",fontFamily:SANS}}>Close — I'll use the tab</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PdfReportModal({ email, insights, d, onDismiss }) {
  const hadPrefill = !!(email && email.trim());
  const [value, setValue] = useState(email || "");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [error, setError] = useState(false);
  const [phase, setPhase] = useState("form");      // "form" | "confirm" | "exit"
  const [contentIn, setContentIn] = useState(true); // drives the form→confirm content crossfade
  const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  // Hold the confirmation on screen just long enough to read, then fade the whole modal out.
  useEffect(() => {
    if (phase !== "confirm") return;
    const t = setTimeout(() => setPhase("exit"), 1800);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "exit") return;
    const t = setTimeout(onDismiss, 300);
    return () => clearTimeout(t);
  }, [phase]);

  function submit() {
    const trimmed = value.trim();
    if (!isValidEmail(trimmed)) { setError(true); return; }
    const emailSource = !hadPrefill ? "new" : trimmed === email.trim() ? "prefilled" : "edited";
    if (import.meta.env.DEV) {
      console.log("[Candid] PDF report requested —", { email: trimmed, emailSource, marketingOptIn });
    }
    posthog.capture("pdf_report_requested", { email_source: emailSource, marketing_opt_in: marketingOptIn });
    fetch("/api/generate-report-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        d,
        insights,
        email: trimmed,
        email_source: emailSource,
        marketing_opt_in: marketingOptIn,
        session_id: posthog.get_distinct_id?.() || null,
        candid_score: insights?.score ?? null,
      }),
    })
      .then(res => res.json().then(data => {
        if (import.meta.env.DEV) console.log("[Candid] generate-report-pdf response —", res.status, data);
      }))
      .catch(e => { if (import.meta.env.DEV) console.warn("[Candid] generate-report-pdf request failed:", e); });

    // Crossfade into the confirmation state — fade the form out, swap content
    // while invisible, then fade the confirmation in. Purely visual; the
    // request above has already been fired and isn't gated on this.
    setContentIn(false);
    setTimeout(() => { setPhase("confirm"); setContentIn(true); }, 200);
  }

  return createPortal(
    <div onClick={phase === "form" ? onDismiss : undefined} style={{
      position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,
      background:"rgba(22,47,36,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",
      opacity: phase === "exit" ? 0 : 1, transition:"opacity 0.3s ease",
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:WHITE,borderRadius:"18px",maxWidth:"460px",width:"100%",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.25)",
        transform: phase === "form" ? "scale(1)" : "scale(0.96)", transition:"transform 0.3s ease",
      }}>
        <div style={{opacity: contentIn ? 1 : 0, transition:"opacity 0.2s ease"}}>
          {phase === "form" ? (
            <>
              <div style={{background:GOLD,padding:"14px 24px",display:"flex",alignItems:"center",gap:"10px"}}>
                <span style={{fontSize:"20px"}}>📄</span>
                <div>
                  <div style={{fontFamily:SERIF,fontSize:"16px",fontWeight:700,color:G}}>Get your full report as a PDF</div>
                  <div style={{fontSize:"11px",color:"rgba(22,47,36,0.65)",marginTop:"1px"}}>Keep it, share it, come back to it anytime</div>
                </div>
                <button onClick={onDismiss} style={{marginLeft:"auto",background:"transparent",border:"none",fontSize:"20px",color:"rgba(22,47,36,0.4)",cursor:"pointer",lineHeight:1}}>×</button>
              </div>
              <div style={{padding:"24px"}}>
                <label style={LBL}>{hadPrefill ? `We'll send your report to ${email}` : "Email address"}</label>
                <input
                  type="email"
                  style={{...INP, border: error ? "1.5px solid #c0392b" : INP.border}}
                  value={value}
                  onChange={e => { setValue(e.target.value); if (error) setError(false); }}
                  placeholder="your@email.com"
                  autoFocus
                />
                {error && <div style={{fontSize:"12px",color:"#c0392b",marginTop:"6px"}}>Enter a valid email address</div>}

                <div style={{marginTop:"18px"}}>
                  <Checkbox checked={marketingOptIn} onChange={setMarketingOptIn} label="Also send me quarterly check-ins and early access to new features" />
                </div>

                <button onClick={submit} style={{display:"block",width:"100%",background:G,borderRadius:"10px",padding:"15px",textAlign:"center",fontSize:"15px",fontWeight:600,color:WHITE,cursor:"pointer",fontFamily:SANS,border:"none",marginBottom:"10px"}}>Email my report</button>
                <button onClick={onDismiss} style={{display:"block",width:"100%",background:"transparent",border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"10px",padding:"12px",fontSize:"13px",color:MUT,cursor:"pointer",fontFamily:SANS}}>No thanks</button>
              </div>
            </>
          ) : (
            <div style={{padding:"38px 24px",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center"}}>
              <span style={{fontSize:"28px",marginBottom:"12px"}}>📬</span>
              <div style={{fontFamily:SERIF,fontSize:"17px",fontWeight:700,color:G}}>Report on its way — check your emails →</div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Module deep-dive ──────────────────────────────────────────────────────────
// ── Take Me There demo CTA ────────────────────────────────────────────────────
// ── Starter affiliate link (demo state) ───────────────────────────────────────
function TakeMeThere({ app, icon, message, demoNote }) {
  const [tapped, setTapped] = useState(false);
  return (
    <div style={{marginTop:"8px"}}>
      <button type="button" onClick={() => setTapped(true)} style={{
        width:"100%", padding:"13px 16px",
        background: tapped ? "rgba(22,47,36,0.08)" : G,
        border: tapped ? `1.5px solid rgba(22,47,36,0.2)` : "none",
        borderRadius:"10px", display:"flex", alignItems:"center", gap:"12px",
        cursor: tapped ? "default" : "pointer", transition:"all 0.2s"
      }}>
        <span style={{fontSize:"20px",flexShrink:0}}>{icon}</span>
        <div style={{flex:1,textAlign:"left"}}>
          <div style={{fontSize:"13px",fontWeight:700,color:tapped?G:WHITE,marginBottom:"2px"}}>{tapped ? `↗ Opening ${app}…` : message}</div>
          <div style={{fontSize:"11px",color:tapped?"rgba(22,47,36,0.5)":"rgba(255,255,255,0.5)"}}>{tapped ? demoNote : `Tap to open ${app}`}</div>
        </div>
        {!tapped && <span style={{fontSize:"14px",color:GOLD,flexShrink:0}}>→</span>}
      </button>
    </div>
  );
}

function ProductCard({ p, onInternalLink }) {
  const superlative = p.badge && ["Highest rate","Best buy","Top pick","Lowest cost","Largest UK broker","Easiest consolidation","Best alternative","Best return"].includes(p.badge);

  // Real outbound links (savings_rates rows) get a compact horizontal row — rate in a
  // box on the right — instead of the taller stacked layout below, since these lists
  // can run to a dozen+ tiles and the stacked form wastes a lot of vertical space for
  // what's just "provider, rate, click through".
  if (p.productUrl) {
    return (
      <a href={p.productUrl} target="_blank" rel="noopener noreferrer" style={{
        background:WHITE,borderRadius:"10px",padding:"12px 14px",border:`1.5px solid ${p.highlight ? GOLD : "rgba(22,47,36,0.09)"}`,
        display:"flex",alignItems:"center",gap:"12px",textDecoration:"none",color:"inherit",cursor:"pointer",
      }}>
        <div style={{width:"32px",height:"32px",background:p.highlight ? G : "rgba(22,47,36,0.07)",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:"16px"}}>{p.appIcon||"🏦"}</span>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:"14px",color:TEXT,lineHeight:1.3}}>{p.name}</div>
          <div style={{fontSize:"12px",color:MUT}}>{p.type}</div>
          {p.badge && (
            <span style={{display:"inline-block",marginTop:"4px",fontSize:superlative?"11px":"10px",fontWeight:700,color:superlative?G:GOLD,background:superlative?GOLD:"rgba(196,150,58,0.12)",padding:superlative?"3px 9px":"2px 7px",borderRadius:"100px",letterSpacing:"0.04em"}}>
              {superlative ? `⭐ ${p.badge}` : p.badge}
            </span>
          )}
        </div>
        <div style={{textAlign:"center",flexShrink:0,background:p.highlight?G:"rgba(22,47,36,0.05)",borderRadius:"8px",padding:"8px 14px",minWidth:"76px"}}>
          <div style={{fontFamily:SERIF,fontSize:"16px",fontWeight:700,color:p.highlight?WHITE:G,whiteSpace:"nowrap"}}>{p.rate}</div>
          <div style={{fontSize:"9px",color:p.highlight?"rgba(255,255,255,0.7)":MUT,marginTop:"1px"}}>{p.cta} ↗</div>
        </div>
      </a>
    );
  }

  return (
    <div style={{background:WHITE,borderRadius:"12px",padding:"18px",border:`1.5px solid ${p.highlight ? GOLD : "rgba(22,47,36,0.09)"}`,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"8px"}}>
        <div style={{width:"36px",height:"36px",background:p.highlight ? G : "rgba(22,47,36,0.07)",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:"18px"}}>{p.appIcon||"💳"}</span>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:"14px",color:TEXT,lineHeight:1.3}}>{p.name}</div>
          <div style={{fontSize:"12px",color:MUT}}>{p.type}</div>
          {p.badge && (
            <span style={{display:"inline-block",marginTop:"5px",fontSize:superlative?"11px":"10px",fontWeight:700,color:superlative?G:GOLD,background:superlative?GOLD:"rgba(196,150,58,0.12)",padding:superlative?"4px 10px":"3px 8px",borderRadius:"100px",letterSpacing:"0.04em"}}>
              {superlative ? `⭐ ${p.badge}` : p.badge}
            </span>
          )}
        </div>
      </div>
      {p.rate && <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginBottom:"6px"}}>{p.rate}</div>}
      <button type="button" onClick={() => p.internalLink ? onInternalLink(p.internalLink) : null}
        style={{width:"100%",padding:"9px",background:p.highlight?G:"transparent",border:`1.5px solid ${p.highlight?G:"rgba(22,47,36,0.22)"}`,borderRadius:"8px",color:p.highlight?WHITE:G,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s",marginBottom:"10px"}}>
        {p.cta}
      </button>
      {p.feature && <p style={{fontSize:"13px",color:MUT,lineHeight:1.55,marginBottom:"12px",flex:1}}>{p.feature}</p>}
      {!p.internalLink && (
        <div style={{marginTop:"8px",fontSize:"11px",color:"rgba(22,47,36,0.4)",textAlign:"center",fontStyle:"italic"}}>
          Demo: {p.demoNote || `Would open ${p.name} — not yet a live link in this preview`}
        </div>
      )}
    </div>
  );
}

// ── Collapsible non-win section — same eyebrow/title/subtitle type hierarchy as
// ExpandableInvestmentItem's Win tiles, but with no numbered badge and no score-
// affecting tag: used for "explore further, not a recommendation" content like
// Investments' "Beyond the basics" and Cash's "Other cash-like options". ───────
function NonWinExpandable({ eyebrow, title, subtitle, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{marginTop:"8px"}}>
      <button type="button" onClick={() => setOpen(v=>!v)} style={{width:"100%",padding:"16px 18px",background:open?G:WHITE,border:`1.5px solid ${open?G:"rgba(22,47,36,0.12)"}`,borderRadius:"12px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",transition:"all 0.2s",marginBottom:open?"16px":"0"}}>
        <div style={{textAlign:"left"}}>
          <div style={{fontSize:"11px",fontWeight:800,color:GOLD,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"3px"}}>{eyebrow}</div>
          <div style={{fontSize:"14px",fontWeight:600,color:open?WHITE:G}}>{title}</div>
          <div style={{fontSize:"13px",color:open?"rgba(255,255,255,0.75)":MUT,marginTop:"3px",lineHeight:1.5}}>{subtitle}</div>
        </div>
        <span style={{fontSize:"18px",color:open?GOLD:MUT,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0,marginLeft:"12px"}}>›</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ── Alternative investments section (age-gated framing) ───────────────────────
function AlternativeInvestments({ age }) {
  const youngUser = (+age||30) < 45;
  const eyebrow = youngUser
    ? "Higher-risk & alternative investments"
    : "Alternatives & passion assets";
  const label = youngUser ? "Beyond the basics 🚀" : "Advanced investing 📈";
  const subLabel = youngUser
    ? "Higher-risk, higher-potential. For when your ISA and pension are sorted."
    : "Growth-oriented strategies worth understanding — even if you'd advise caution.";
  const higherRisk = [
    { icon:"₿", name:"Crypto (Bitcoin / Ethereum)", type:"Digital assets", risk:"Very high",
      desc:"Bitcoin and Ethereum are the most liquid. No FSCS protection. Extreme volatility — down 70%+ drawdowns are normal. Best treated as a small allocation (1-5%) in a diversified portfolio. Hold via a regulated UK exchange.",
      platforms:["Coinbase","Kraken","Gemini"], demoApp:"Coinbase" },
    { icon:"🚀", name:"EIS / SEIS (Venture tax relief)", type:"Enterprise Investment Scheme", risk:"High",
      desc:"Invest in early-stage UK companies and get 30-50% income tax relief upfront, plus loss relief. SEIS gives 50% relief on up to £200,000/yr invested. Returns are high-variance but the tax relief dramatically changes the risk/reward profile.",
      platforms:["Seedrs","Crowdcube","SyndicateRoom"], demoApp:"Seedrs" },
    { icon:"🏗️", name:"Private equity / LTAF", type:"Long-term asset funds", risk:"High",
      desc:"Long-Term Asset Funds (LTAFs) are a newer UK vehicle allowing retail access to PE-style returns. Illiquid — 90-180 day notice periods typical. Returns historically outperform public markets over 10+ year horizons.",
      platforms:["Schroders","Aviva","Aegon (pension)"], demoApp:"Schroders LTAF" },
    { icon:"🏘️", name:"Property / REITs", type:"Real estate investment trusts", risk:"Medium-high",
      desc:"REITs give property exposure without buying bricks-and-mortar. Tradeable on the LSE, ISA-eligible, and dividend-paying. FTSE NAREIT index historically returns ~9% p.a. long-term. Avoids stamp duty, mortgage complexity.",
      platforms:["British Land","Segro","LXi REIT"], demoApp:"HL (REIT search)" },
  ];
  const alternatives = [
    { icon:"🎨", name:"Art", type:"Collectible asset", risk:"Variable",
      desc:"Blue-chip art (Basquiat, Hirst) has outperformed equities over 25-year horizons. Low liquidity, high transaction costs, requires authentication/storage. Platforms now offer fractional ownership from £50.",
      platforms:["Masterworks","ArtMoney"], gate:"Best for: diversified net worth £500k+" },
    { icon:"🍷", name:"Fine wine", type:"Collectible asset", risk:"Variable",
      desc:"Bordeaux, Burgundy, and Champagne have strong 20-year track records. Liquid at auction (Christie's, Sotheby's). Storage and insurance required. Cult wines (Pétrus, DRC) can appreciate 15%+ p.a. in bull markets.",
      platforms:["Cult Wines","Vinovest","Wine Owners"], gate:"Best for: genuine interest + £50k+ to allocate" },
    { icon:"⌚", name:"Watches & jewellery", type:"Collectible asset", risk:"High",
      desc:"Rolex Submariner, Patek Philippe Nautilus — certain references have outperformed equities. Market is volatile post-2022 correction. Requires expertise to avoid fakes and market timing risk.",
      platforms:["Watches of Switzerland","Chrono24","WatchBox"], gate:"Best for: passion investment, not core portfolio" },
    { icon:"🚗", name:"Classic cars", type:"Collectible asset", risk:"High",
      desc:"The Hagerty Blue Chip index has returned ~12% p.a. over 10 years. Storage, insurance, and maintenance costs are substantial. Niche expertise required. More liquid than art via specialist auctions.",
      platforms:["RM Sotheby's","Bonhams","Historics"], gate:"Best for: genuine enthusiasm + deep pockets" },
  ];
  return (
    <NonWinExpandable eyebrow={eyebrow} title={label} subtitle={subLabel}>
      <div style={{background:"rgba(196,150,58,0.07)",border:"1px solid rgba(196,150,58,0.2)",borderRadius:"10px",padding:"12px 14px",marginBottom:"16px"}}>
        <p style={{fontSize:"13px",color:TEXT,lineHeight:1.7}}>These should only be considered once your ISA allowance is maxed, pension is on track, and you have a solid emergency fund. Think of them as the layer on top — not the foundation.</p>
      </div>
      <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Higher-risk, regulated</div>
      <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:"20px"}}>
        {higherRisk.map((h,i) => (
          <div key={i} style={{background:WHITE,borderRadius:"10px",padding:"16px",border:"1px solid rgba(22,47,36,0.09)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px",marginBottom:"8px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <span style={{fontSize:"22px"}}>{h.icon}</span>
                <div>
                  <div style={{fontWeight:600,fontSize:"14px",color:TEXT}}>{h.name}</div>
                  <div style={{fontSize:"11px",color:MUT}}>{h.type}</div>
                </div>
              </div>
              <span style={{fontSize:"10px",fontWeight:700,color:"#c0392b",background:"rgba(192,57,43,0.08)",padding:"3px 8px",borderRadius:"100px",whiteSpace:"nowrap",flexShrink:0}}>Risk: {h.risk}</span>
            </div>
            <p style={{fontSize:"13px",color:MUT,lineHeight:1.6,marginBottom:"10px"}}>{h.desc}</p>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:"11px",color:MUT}}>Platforms:</span>
              {h.platforms.map(pl => (
                <span key={pl} style={{fontSize:"11px",fontWeight:600,color:G,background:"rgba(22,47,36,0.07)",padding:"2px 8px",borderRadius:"100px"}}>{pl}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Alternative & passion assets</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"10px",marginBottom:"12px"}}>
        {alternatives.map((a,i) => (
          <div key={i} style={{background:WHITE,borderRadius:"10px",padding:"14px 16px",border:"1px solid rgba(22,47,36,0.09)"}}>
            <div style={{fontSize:"22px",marginBottom:"8px"}}>{a.icon}</div>
            <div style={{fontWeight:600,fontSize:"14px",color:TEXT,marginBottom:"3px"}}>{a.name}</div>
            <div style={{fontSize:"11px",color:MUT,marginBottom:"8px"}}>{a.type}</div>
            <p style={{fontSize:"12px",color:MUT,lineHeight:1.55,marginBottom:"8px"}}>{a.desc}</p>
            <div style={{fontSize:"11px",color:GOLD,fontWeight:600,background:"rgba(196,150,58,0.08)",padding:"4px 8px",borderRadius:"6px"}}>{a.gate}</div>
          </div>
        ))}
      </div>
      <p style={{fontSize:"11px",color:MUT,lineHeight:1.6,padding:"10px 0",borderTop:"1px solid rgba(22,47,36,0.08)"}}>
        Alternative investments are illiquid, unregulated (in most cases), and carry significant risk of total loss. EIS/SEIS are regulated by the FCA. This section is for information only — not a recommendation. Candid may earn a referral fee for EIS/SEIS platform introductions.
      </p>
    </NonWinExpandable>
  );
}

// ── Expandable step-through item (Investments module) ─────────────────────────
// Collapsed: numbered badge + title + one-line headline + category tag.
// Expanded: arbitrary children, set off from the next item by a bottom divider
// so it's clear where one optimisation ends and the next begins.
function ExpandableInvestmentItem({ number, title, headline, tag, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{marginBottom: open ? "24px" : "14px", paddingBottom: open ? "20px" : 0, borderBottom: open ? "1px solid rgba(22,47,36,0.14)" : "none"}}>
      <div style={{background: open ? G : WHITE, border:`1.5px solid ${open ? G : "rgba(22,47,36,0.12)"}`, borderRadius:"12px", overflow:"hidden"}}>
        <button type="button" onClick={() => setOpen(v=>!v)} style={{width:"100%", padding:"16px 18px", background:"transparent", border:"none", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"12px", cursor:"pointer", textAlign:"left"}}>
          <div style={{display:"flex", alignItems:"flex-start", gap:"12px", minWidth:0, flex:1}}>
            {number != null && (
              <div style={{width:"24px", height:"24px", borderRadius:"50%", background:G, border:"1.5px solid rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:"1px"}}>
                <span style={{fontSize:"12px", fontWeight:700, color:CREAM}}>{number}</span>
              </div>
            )}
            <div style={{minWidth:0}}>
              {number != null && (
                <div style={{fontSize:"11px", fontWeight:800, color:GOLD, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"3px"}}>Win {number}</div>
              )}
              <div style={{fontSize:"14px", fontWeight:600, color: open ? WHITE : G}}>{title}</div>
              <div style={{fontSize:"13px", color: open ? "rgba(255,255,255,0.75)" : MUT, marginTop:"3px", lineHeight:1.5}}>{headline}</div>
            </div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:"8px", flexShrink:0}}>
            {tag && (
              <span style={{fontSize:"10px", fontWeight:700, color:tag.color, background:`${tag.color}18`, padding:"3px 9px", borderRadius:"100px", letterSpacing:"0.04em", textTransform:"uppercase", whiteSpace:"nowrap"}}>{tag.label}</span>
            )}
            <span style={{fontSize:"18px", color: open ? GOLD : MUT, transform: open ? "rotate(180deg)" : "none", transition:"transform 0.2s"}}>›</span>
          </div>
        </button>
      </div>
      {open && <div style={{marginTop:"12px"}}>{children}</div>}
    </div>
  );
}

// ── Compact expandable callout — collapsed to a single line (icon + label +
// one-liner) so two can sit side by side without dead space; click reveals the
// fuller mechanics in `children`. Used for the CGT "Bed & breakfasting rule"
// and "Use it or lose it" callouts. ─────────────────────────────────────────
function MiniExpandTile({ icon, label, color, summary, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{background:`${color}0D`, border:`1.5px solid ${color}38`, borderRadius:"10px", overflow:"hidden"}}>
      <button type="button" onClick={() => setOpen(v=>!v)} style={{width:"100%", padding:"10px 12px", background:"transparent", border:"none", cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:"2px"}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:"6px"}}>
          <div style={{display:"flex", alignItems:"center", gap:"6px", minWidth:0}}>
            <span style={{fontSize:"13px"}}>{icon}</span>
            <span style={{fontSize:"10px", fontWeight:700, color, letterSpacing:"0.05em", textTransform:"uppercase", whiteSpace:"nowrap"}}>{label}</span>
          </div>
          <span style={{fontSize:"14px", color, transform: open ? "rotate(180deg)" : "none", transition:"transform 0.2s", flexShrink:0}}>›</span>
        </div>
        <p style={{fontSize:"12px", color:TEXT, lineHeight:1.5, margin:0}}>{summary}</p>
      </button>
      {open && <div style={{padding:"0 12px 12px"}}>{children}</div>}
    </div>
  );
}

function ModuleDeepDive({ moduleKey, insights, d, m, statuses, savingsRates, openSection, goBack, goToDashboard, onComplete, isComplete, onOpenModule, nextModule }) {
  const [openTip,   setOpenTip]   = useState(null);
  const [bonusInput,setBonusInput]= useState(+d.bonusAmount||"");
  const [sacrificePct, setSacrificePct] = useState(100);
  const [extraPct, setExtraPct] = useState(1); // pension "what if you contributed more" stepper
  const [showCoins, setShowCoins] = useState(false);
  const [animating, setAnimating] = useState(false);
  // Tile pagination (currently only Cash & savings has enough rows for this to matter —
  // harmless no-op elsewhere since other modules never exceed the page size).
  const [visibleTileCount, setVisibleTileCount] = useState(CASH_TILE_PAGE_SIZE);
  useEffect(() => { setVisibleTileCount(CASH_TILE_PAGE_SIZE); }, [moduleKey]);

  // The bonus-sacrifice Win opens itself via ExpandableInvestmentItem's defaultOpen
  // (see below) — this just handles the scroll-into-view for the deep link.
  useEffect(() => {
    if (openSection === "bonusSacrifice") {
      setTimeout(() => {
        const el = document.getElementById("bonus-sacrifice-panel");
        if (el) el.scrollIntoView({ behavior:"smooth", block:"start" });
      }, 200);
    }
  }, [openSection]);


  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  // Use extended functions for new modules, original for existing
  const newModules = ["personalLoan","kids","inheritance","mortgage"];
  const modInsights = newModules.includes(moduleKey)
    ? getModuleInsightsExtended(moduleKey, d, m)
    : getModuleInsights(moduleKey, d, m, savingsRates);
  const products = newModules.includes(moduleKey)
    ? getModuleProductsExtended(moduleKey, d, m)
    : getModuleProducts(moduleKey, d, m, savingsRates);
  const crossLinks = getCrossModuleLinks(moduleKey, d, m);
  // Used by the Premium bonds sections below — a single source for "best Cash ISA rate"
  // rather than each section computing its own. isaRatePct is the DB's own "X.XX"
  // string (null while loading/unavailable) — each usage site below handles its own
  // grammatical fallback since "5.08%" doesn't drop cleanly into every sentence shape.
  const topIsaRow = topRate(savingsRates, true);
  const isaRatePct = topIsaRow ? topIsaRow.rate_aer : null;
  const topNonIsaRow = topRate(savingsRates, false);
  const nonIsaRatePct = topNonIsaRow ? topNonIsaRow.rate_aer : null;

  // Marginal-return curve for student loan overpayments — runs ~38 loan
  // simulations, so memoize it to avoid rerunning on unrelated re-renders
  // (e.g. opening an accordion elsewhere on the page).
  const loanCurve = useMemo(() => {
    const slSection = products.slSection;
    if (!slSection?.willClear || m.loanBal <= 0) return null;
    const writeOffYr = slSection.writeOffYr;
    const pensionReturn = pensionReturnRatio(d, m);
    const mortRate = d.hasMortgage === "yes" && +d.mortgageRate > 0 ? +d.mortgageRate : 4.5;
    const mortReturn = 1 + mortRate / 100;
    const planRate = d.studentLoan === "plan1" ? 0.05 : 0.075;
    const planThreshold = d.studentLoan === "plan2" ? 27295 : d.studentLoan === "plan5" ? 25000 : 24990;
    const growthRate = SALARY_GROWTH_RATES[d.salaryTrajectory] ?? 0.03;
    const baseCase = simulateLoan(m.loanBal, m.salary, growthRate, planRate, planThreshold, 0.09, writeOffYr);
    const tiny = simulateLoan(Math.max(0, m.loanBal - 100), m.salary, growthRate, planRate, planThreshold, 0.09, writeOffYr);
    const tinyIntSaved = Math.max(0, baseCase.totalInterest - tiny.totalInterest);
    const yIntercept = 1 + tinyIntSaved / 100;
    const STEPS = 36;
    const data = [{ amt: 0, ratio: yIntercept }, ...Array.from({ length: STEPS }, (_, i) => {
      const amt = (m.loanBal * (i + 1)) / STEPS;
      if (amt >= m.loanBal) return { amt: m.loanBal, ratio: 1.0 };
      const oc = simulateLoan(m.loanBal - amt, m.salary, growthRate, planRate, planThreshold, 0.09, writeOffYr);
      const intSaved = Math.max(0, baseCase.totalInterest - oc.totalInterest);
      return { amt, ratio: (amt + intSaved) / amt };
    })];
    // Base yMax on the pension/mortgage reference lines, not data[0].ratio — the marginal
    // return at amt≈0 can spike to 4-8x+ for loans that stay outstanding almost the entire
    // write-off window, which would compress every tick into a sliver near the axis floor.
    const yMax = Math.max(pensionReturn + 0.3, 1.6);
    const yMin = 0.92;
    const VW = 680, VH = 320, PL = 64, PR = 20, PT = 24, PB = 56;
    const cW = VW - PL - PR, cH = VH - PT - PB;
    const sx = a => PL + (a / m.loanBal) * cW;
    const sy = r => PT + cH - ((r - yMin) / (yMax - yMin)) * cH;
    // Clamp plotted points to yMax so an outlier ratio flattens visually at the top of the
    // chart instead of stretching the axis (crossover detection below still uses raw ratios).
    const path = data.map((p,i) => `${i===0?"M":"L"}${sx(p.amt).toFixed(1)},${sy(Math.min(p.ratio, yMax)).toFixed(1)}`).join(" ");
    let crossAmt = null;
    for (let i = 0; i < data.length - 1; i++) {
      if (data[i].ratio >= pensionReturn && data[i+1].ratio < pensionReturn) {
        const t = (pensionReturn - data[i].ratio) / (data[i+1].ratio - data[i].ratio);
        crossAmt = data[i].amt + t * (data[i+1].amt - data[i].amt);
        break;
      }
    }
    const yTicks = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5].filter(r => r >= yMin && r <= yMax + 0.05);
    const xTicks = [0, 0.25, 0.5, 0.75, 1].map(f => m.loanBal * f);
    const crossX = crossAmt !== null ? sx(crossAmt) : null;
    const crossY = sy(pensionReturn);
    return { writeOffYr, pensionReturn, mortRate, mortReturn, data, yMax, yMin, VW, VH, PL, PR, PT, PB, cW, cH, sx, sy, path, crossAmt, crossX, crossY, yTicks, xTicks };
  }, [products.slSection, m.loanBal, m.salary, m.tr, d.studentLoan, d.salaryTrajectory, d.pensionType, d.hasMortgage, d.mortgageRate]);

  const modSummary = insights?.modules?.[moduleKey];
  // Pension: user told us they don't know their pension situation — show a
  // dedicated "find out" guide instead of the normal critical/attention framing
  const isPensionUnknown = moduleKey === "pension" && m.pensionStatus === "unknown";
  // ISA headroom grown to UK State Pension age (67, fixed — see the compound-growth
  // chart below for the same assumption) at 7% p.a. nominal. Used both by the "Utilise
  // unused ISA allowance" tile headline and the top-of-page opportunity summary.
  const isaProjectionYears = Math.max(1, 67 - (+d.age||30));
  const isaProjectedValue = (m.isaHeadroom||0) * Math.pow(1.07, isaProjectionYears);
  const col = isPensionUnknown ? MUT : (SC[modSummary?.status] || MUT);
  const bondsVal = m.bonds || 0;

  // Premium Bonds have their own dedicated Win tile below when the user holds none;
  // Fixed-term savings folds into the "higher-earning account" Win. This list is
  // deliberately just the two genuinely different asset types worth a quick explainer.
  const altProducts = [
    { name:"UK Gilts (via ETF)", type:"Government bonds", rate:"~4.3–4.6% yield", badge:"Capital secure", feature:"UK government debt — effectively risk-free to maturity. Tradeable ETF wrappers available on HL and Vanguard. Interest taxable (unless in ISA).", cta:"Explore gilts", highlight:false },
    { name:"Money market funds", type:"Near-cash fund", rate:"~5.0% (variable)", badge:"Institutional quality", feature:"Very low risk funds that hold short-term government debt. Available inside ISA wrappers — unlike cash savings. Royal London, BlackRock, Fidelity all offer these.", cta:"Explore options", highlight:false },
  ];

  // ── Bonus sacrifice maths (pension module only) ──────────────────────────────
  const bonus = Math.max(0, +bonusInput||0);
  // Taxable salary = salary minus ongoing pension sacrifice (salary sacrifice scheme)
  const ongoingSacrifice = (+d.myContribution||0) / 100 * m.salary;
  const taxableSalary = Math.max(0, m.salary - ongoingSacrifice);
  // NI rate on bonus: above £50,270 threshold it's 2%, below 8%
  // Bonus sits on top of salary, so if salary already above threshold, all bonus at 2%
  const niRateOnBonus = m.salary >= 50270 ? 0.02 : 0.08;
  // Student loan on bonus
  const slThreshold = d.studentLoan==="plan2" ? 27295 : d.studentLoan==="plan5" ? 25000 : d.studentLoan==="plan1" ? 24990 : 0;
  const bonusSlRate = (d.studentLoan !== "none" && m.salary > slThreshold) ? 0.09 : 0;
  // Full bonus (no sacrifice) — effective income tax rate
  const fullBonusTax = calcBonusTaxBreakdown(taxableSalary, bonus);
  const fullTaxPct = Math.round(fullBonusTax.effectiveRate * 100);
  const fullNIPct = Math.round(niRateOnBonus * 100);
  const fullSLPct = Math.round(bonusSlRate * 100);
  const fullKeepPct = 100 - fullTaxPct - fullNIPct - fullSLPct;
  // Per-sacrifice-percentage: compute what changes at the chosen slider setting
  const sacrificedAmt    = Math.round(bonus * sacrificePct / 100);
  const cashPortionBonus = bonus - sacrificedAmt;
  const bonusTaxDetail   = calcBonusTaxBreakdown(taxableSalary, cashPortionBonus);
  const taxOnCash  = bonusTaxDetail.tax;
  const niOnCash   = Math.round(cashPortionBonus * niRateOnBonus);
  const slOnCash   = Math.round(cashPortionBonus * bonusSlRate);
  const takeHomeCash    = cashPortionBonus - taxOnCash - niOnCash - slOnCash;
  const totalDeducted   = taxOnCash + niOnCash + slOnCash;
  const totalReceived   = sacrificedAmt + takeHomeCash;
  const employerNISave  = Math.round(sacrificedAmt * 0.138);
  // Taper / additional rate flags
  const crossesTaper = fullBonusTax.crossesTaper;
  const crossesAR    = fullBonusTax.crossesAR;
  const taperSavingIfFullSacrifice = crossesTaper
    ? Math.round(calcBonusTaxBreakdown(taxableSalary, 0).tax - calcBonusTaxBreakdown(taxableSalary, bonus).tax)
    : 0;
  const age = +d.age||30, retireAge = +d.retirementAge||65;
  const years = Math.max(1, retireAge - age);
  const bonusFVpartial = (pct) => Math.round(bonus * pct/100 * Math.pow(1.06, years));
  // Student loan tooltip: months saved / interest saved from bonus SL repayment
  const loanBal = m.loanBal || 0;
  const slRepaymentFromBonus = Math.round(bonus * bonusSlRate);
  const slInterestRate = d.studentLoan==="plan2" ? 0.075 : d.studentLoan==="plan5" ? 0.075 : 0.05;
  const slInterestSaved = Math.round(slRepaymentFromBonus * slInterestRate * Math.max(1, loanBal/Math.max(1,m.annualRepayment)));
  const showSacrificeCalc = moduleKey === "pension" && m.adjustedNetIncome >= 80000 && m.adjustedNetIncome <= 125140;
  // ── Personal Allowance taper maths (Win 2 + opportunity strip) ──────────────
  // Every £2 of adjusted net income above £100,000 withdraws £1 of Personal
  // Allowance, up to the full withdrawal at £125,140 — an effective 60% marginal
  // rate across that band. Pension sacrifice reduces adjusted net income, so it
  // can restore some or all of the allowance.
  const taperStart = 100000, taperEnd = 125140;
  const ani = m.adjustedNetIncome;
  const inTaper = ani > taperStart && ani < taperEnd;
  const taperSacrificeNeeded = inTaper ? Math.ceil((ani - taperStart) / 2) : Math.max(0, taperStart - ani);
  const taperNiSaving = Math.round(taperSacrificeNeeded * 0.02);
  const taperTaxSaving = inTaper ? Math.round(taperSacrificeNeeded * 0.60) : 0;
  const taperTotalSaving = taperNiSaving + taperTaxSaving;

  return (
    <PageWrap>
      <FeedbackButton />
      <NavBar center={meta?.title} right={<GhostBtn onClick={goBack}>← Back</GhostBtn>}/>
      <ContentWrap maxWidth="680px">

        {/* Header */}
        <div className="fu" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"16px",marginBottom:"24px",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <span style={{fontSize:"32px"}}>{meta?.icon}</span>
            <div>
              <h2 style={{fontFamily:SERIF,fontSize:"26px",color:G,lineHeight:1.2}}>{meta?.title}</h2>
              {(isPensionUnknown || modSummary?.status) && (
                <span style={{fontSize:"11px",fontWeight:700,color:col,background:`${col}18`,padding:"3px 10px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",display:"inline-block",marginTop:"6px"}}>{isPensionUnknown ? SL.unknown : SL[modSummary.status]}</span>
              )}
            </div>
          </div>
          {isComplete && (
            <div style={{display:"flex",alignItems:"center",gap:"6px",background:"rgba(45,107,74,0.1)",borderRadius:"100px",padding:"6px 14px"}}>
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="#2d6b4a" strokeWidth="2" strokeLinecap="round"/></svg>
              <span style={{fontSize:"12px",fontWeight:600,color:"#2d6b4a"}}>Reviewed</span>
            </div>
          )}
        </div>

        {/* Pension: "I don't know" guidance — replaces the normal AI summary */}
        {isPensionUnknown && (
          <div className="fu1" style={{background:G,borderRadius:"12px",padding:"18px 22px",marginBottom:"24px"}}>
            <p style={{fontSize:"15px",color:"rgba(255,255,255,0.85)",lineHeight:1.75,marginBottom:"12px"}}>
              Not knowing your pension situation isn't a failure — it's incredibly common, and it's costing you the ability to plan. Here's how to find out in about 10 minutes:
            </p>
            <ol style={{fontSize:"15px",color:"rgba(255,255,255,0.85)",lineHeight:1.75,paddingLeft:"20px",marginBottom:"12px"}}>
              <li>Check your payslip for pension deductions</li>
              <li>Ask your employer's HR or payroll team which scheme you're in and what they contribute</li>
              <li>Search gov.uk/find-pension-contact-details for any pensions from previous employers</li>
              <li>Check for a State Pension forecast at gov.uk/check-state-pension</li>
            </ol>
            <p style={{fontSize:"15px",color:"rgba(255,255,255,0.85)",lineHeight:1.75}}>
              Once you know these details, come back and update this section — it's likely one of your biggest opportunities.
            </p>
          </div>
        )}

        {/* AI summary — omitted for Investments, Cash, Pension, and Student loan:
            their content is now the collapsed headlines of the Win tiles below. */}
        {!isPensionUnknown && modSummary?.summary && moduleKey !== "investments" && moduleKey !== "cash" && moduleKey !== "pension" && moduleKey !== "studentLoan" && (
          <div className="fu1" style={{background:G,borderRadius:"12px",padding:"18px 22px",marginBottom:"24px"}}>
            <p style={{fontSize:"15px",color:"rgba(255,255,255,0.85)",lineHeight:1.75}}>{modSummary.summary}</p>
          </div>
        )}

        {/* Investments: top-of-page opportunity summary — quantifies what's on the
            table (ISA headroom grown to 67, CGT saving available this year) before
            the user drills into the individual win tiles below. */}
        {moduleKey === "investments" && !isPensionUnknown && (m.isaHeadroom > 0 || m.crystallisable > 0) && (() => {
          const cols = [];
          if (m.isaHeadroom > 0) cols.push({
            label: "Unused ISA allowance", value: fmt(m.isaHeadroom),
            sub: `→ ~${fmt(Math.round(isaProjectedValue))} tax-free by 67 if invested`,
          });
          if (m.crystallisable > 0) cols.push({
            label: "CGT saving available", value: fmt(m.cgtSaving),
            sub: "if crystallised this tax year",
          });
          return (
            <div className="fu1" style={{background:G,borderRadius:"12px",padding:"18px 22px",marginBottom:"24px"}}>
              <div style={{fontSize:"11px",fontWeight:800,color:GOLD,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"12px"}}>Your opportunity right now</div>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${cols.length},1fr)`,gap:"14px"}}>
                {cols.map((c,i) => (
                  <div key={i}>
                    <div style={{fontFamily:SERIF,fontSize:"22px",color:WHITE,fontWeight:700}}>{c.value}</div>
                    <div style={{fontSize:"12px",color:"rgba(255,255,255,0.85)",fontWeight:600,marginTop:"2px"}}>{c.label}</div>
                    <div style={{fontSize:"11px",color:"rgba(255,255,255,0.55)",marginTop:"2px"}}>{c.sub}</div>
                  </div>
                ))}
              </div>
              <p style={{fontSize:"12px",color:"rgba(255,255,255,0.6)",lineHeight:1.6,marginTop:"14px",paddingTop:"12px",borderTop:"1px solid rgba(255,255,255,0.12)"}}>See the wins below to act on these.</p>
            </div>
          );
        })()}

        {/* Computed metrics with tooltips — omitted for Investments, Cash, Pension,
            and Student loan: folded into their Win tiles below. */}
        {!isPensionUnknown && modInsights.length > 0 && moduleKey !== "investments" && moduleKey !== "cash" && moduleKey !== "pension" && moduleKey !== "studentLoan" && (
          <div className="fu2" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"10px",marginBottom:"20px"}}>
            {modInsights.map((ins,i) => (
              <div key={i} style={{background:ins.flag ? "rgba(196,150,58,0.08)" : WHITE,borderRadius:"10px",padding:"14px 16px",border:`1px solid ${ins.flag ? "rgba(196,150,58,0.3)" : "rgba(22,47,36,0.09)"}`,position:"relative"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}>
                  <div style={{fontSize:"11px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",lineHeight:1.3,paddingRight:"4px"}}>{ins.label}</div>
                  {ins.tooltip && (
                    <button type="button" onClick={() => setOpenTip(openTip===i ? null : i)} style={{width:"18px",height:"18px",borderRadius:"50%",border:"1.5px solid rgba(22,47,36,0.25)",background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,color:MUT,fontSize:"10px",fontWeight:700,lineHeight:1}}>?</button>
                  )}
                </div>
                <div style={{fontFamily:SERIF,fontSize:"18px",color:ins.flag ? G : TEXT,fontWeight:ins.flag ? 700 : 500,marginBottom:openTip===i?"8px":"0"}}>{ins.value}</div>
                {openTip===i && ins.tooltip && (
                  <div style={{marginTop:"8px",padding:"10px 12px",background:"rgba(22,47,36,0.06)",borderRadius:"6px",fontSize:"12px",color:TEXT,lineHeight:1.65,borderTop:"1px solid rgba(22,47,36,0.08)",whiteSpace:"pre-wrap"}}>
                    {ins.tooltip}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Pension: opportunity strip + numbered wins + growth trajectory ──
            Mirrors the Cash & Savings / Investments pattern: a summary strip up
            top, numbered ExpandableInvestmentItem wins for anything actionable,
            and a non-numbered info tile (styled like Cash's runway tile) for
            supporting context that isn't a single action. */}
        {moduleKey === "pension" && !isPensionUnknown && (() => {
          const contributing = isPensionContributing(d);
          const trPct = Math.round(m.tr * 100);
          const myPct = +d.myContribution||0, empCapPct = +d.employerMatch||0;

          const showMatchWin = !contributing || m.missedMatch > 0;
          const matchWinTitle = !contributing ? "Start your pension" : "Capture your employer match";
          const matchWinHeadline = !contributing
            ? `Every £${100-trPct} you put in becomes £100 with ${trPct}% tax relief${empCapPct > 0 ? ` — plus an unclaimed ${empCapPct}% employer match` : ""}`
            : `${fmt(m.missedMatch)}/yr in employer contributions you're not claiming`;

          // Only a numbered, actionable Win when the user told us during onboarding
          // they expect a bonus — otherwise it's just background info, not a "win".
          const hasStatedBonus = (+d.bonusAmount||0) > 0;

          let winCounter = 0;
          const win1Num = showMatchWin ? ++winCounter : null;
          const win2Num = showSacrificeCalc ? ++winCounter : null;
          const win3Num = hasStatedBonus ? ++winCounter : null;

          // ── Opportunity strip ──
          const oppCols = [];
          if (!contributing) {
            oppCols.push({ label:"Tax relief foregone", value: fmt(Math.round(m.salary*0.05*m.tr)), sub:"by not contributing at all" });
          } else if (m.missedMatch > 0) {
            oppCols.push({ label:"Missed employer match", value: fmt(m.missedMatch), sub:"free money left unclaimed" });
          }
          if (inTaper && taperTotalSaving > 0) {
            oppCols.push({ label:"Personal Allowance recoverable", value: fmt(taperTotalSaving), sub:"by sacrificing into your pension" });
          }
          if (hasStatedBonus) {
            oppCols.push({ label:"Bonus sacrifice saving", value: fmt(Math.round(bonus*m.tr)), sub:"if sacrificed in full" });
          }

          // ── Growth trajectory chart data (unchanged maths, now inside the info tile) ──
          const salary = m.salary, potVal = +d.potValue||0;
          const retireAge = +d.retirementAge||65, age = +d.age||30;
          const years = Math.max(1, retireAge - age);
          const annualContrib = (myPct + empCapPct) / 100 * salary;
          const currentPot = m.projectedPot;
          const optimisedContrib = (empCapPct * 2) * salary / 100;
          const optimisedPot = potVal * Math.pow(1.06, years) + optimisedContrib * ((Math.pow(1.06, years) - 1) / 0.06);
          const bonusExtra = (+d.bonusAmount||0) * 0.9;
          const withBonusAnnual = optimisedContrib + bonusExtra;
          const withBonusPot = potVal * Math.pow(1.06, years) + withBonusAnnual * ((Math.pow(1.06, years) - 1) / 0.06);
          const hasMissedMatch = m.missedMatch > 0;
          const hasBonus = (+d.bonusAmount||0) > 0;
          const showOptimised = hasMissedMatch || hasBonus;

          // "What if you contributed more?" — generalises the old static 1% nudge
          // chip into an adjustable +1/+2/+3/+5% stepper. Computed before `bars` so
          // the chart itself can show a live bar for the selected percentage.
          const extraGrowth = Math.round(salary * extraPct/100 * ((Math.pow(1.06, years) - 1) / 0.06));
          const extraNetCostMonthly = Math.round(salary * extraPct/100 / 12 * (1 - m.tr));
          const withExtraPot = Math.round(currentPot) + extraGrowth;

          const bars = [
            { value: potVal, label: "Now", color: "rgba(196,150,58,0.4)", textCol: G },
            { value: currentPot, label: `At retirement\n(age ${retireAge})`, color: GOLD, textCol: G },
            ...(hasMissedMatch ? [{ value: optimisedPot, label: `Optimised\n(match cap)`, color: "#2d6b4a", textCol: WHITE }] : []),
            ...(hasBonus ? [{ value: withBonusPot, label: "With bonus\nsacrifice", color: "rgba(45,107,74,0.7)", textCol: WHITE }] : []),
            { value: withExtraPot, label: `With +${extraPct}%\ncontribution`, color: "#8a4fae", textCol: WHITE },
          ];
          const maxVal = Math.max(...bars.map(b => b.value)) * 1.15;
          const VW = 680, VH = 300, PL = 20, PR = 20, PT = 44, PB = 72;
          const cW = VW - PL - PR, cH = VH - PT - PB;
          const barW = 110, gap = (cW - bars.length * barW) / (bars.length + 1);
          const sy = v => PT + cH - (v / maxVal) * cH;
          const barX = i => PL + gap + i * (barW + gap);
          const refY = sy(showOptimised ? optimisedPot : currentPot);

          // "Earliest viable retirement age" — binary search for when the pot
          // reaches 25× estimated annual spend (or a £400k floor).
          const annualSpend = (m.expenses||2000) * 12;
          const targetPot = Math.max(400000, annualSpend * 25);
          let earlyRetire = retireAge;
          for (let testYrs = 1; testYrs <= years; testYrs++) {
            const pot = potVal * Math.pow(1.06, testYrs) + annualContrib * ((Math.pow(1.06, testYrs) - 1) / 0.06);
            if (pot >= targetPot) { earlyRetire = age + testYrs; break; }
          }
          const yearsSaved = retireAge - earlyRetire;
          const onTrackEarly = yearsSaved > 0 && contributing;

          const showTrajectory = d.hasPension === "yes" && (potVal > 0 || myPct > 0);

          return (
            <>
              {oppCols.length > 0 && (
                <div className="fu1" style={{background:G,borderRadius:"12px",padding:"18px 22px",marginBottom:"24px"}}>
                  <div style={{fontSize:"11px",fontWeight:800,color:GOLD,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"12px"}}>Your opportunity right now</div>
                  <div style={{display:"grid",gridTemplateColumns:`repeat(${oppCols.length},1fr)`,gap:"14px"}}>
                    {oppCols.map((c,i) => (
                      <div key={i}>
                        <div style={{fontFamily:SERIF,fontSize:"22px",color:WHITE,fontWeight:700}}>{c.value}</div>
                        <div style={{fontSize:"12px",color:"rgba(255,255,255,0.85)",fontWeight:600,marginTop:"2px"}}>{c.label}</div>
                        <div style={{fontSize:"11px",color:"rgba(255,255,255,0.55)",marginTop:"2px"}}>{c.sub}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{fontSize:"12px",color:"rgba(255,255,255,0.6)",lineHeight:1.6,marginTop:"14px",paddingTop:"12px",borderTop:"1px solid rgba(255,255,255,0.12)"}}>See the wins below to act on these.</p>
                </div>
              )}

              {showMatchWin && (
                <ExpandableInvestmentItem number={win1Num} title={matchWinTitle} headline={matchWinHeadline} tag={{ label:"Today", color:GOLD }}>
                  {(() => {
                    const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT };
                    const totalRowStyle = { ...rowStyle, paddingTop:"7px", borderTop:"1px dashed rgba(22,47,36,0.18)", fontWeight:700 };
                    const stepCardStyle = { background:"rgba(22,47,36,0.03)", border:"1px solid rgba(22,47,36,0.12)", borderRadius:"12px", padding:"14px 16px", marginBottom:"10px" };
                    const stepEyebrowStyle = { fontSize:"10px", fontWeight:700, color:GOLD, letterSpacing:"0.05em", textTransform:"uppercase", marginBottom:"6px" };
                    const stepWhyStyle = { fontSize:"12px", color:MUT, lineHeight:1.6, marginTop:"6px", marginBottom:0 };

                    const perOnePctValue = Math.round(m.salary/100);
                    const myContribAnnual = Math.round(myPct/100 * m.salary);
                    const currentMatchReceived = Math.round(Math.min(myPct, empCapPct)/100 * m.salary);
                    const fullMatchAvailable = Math.round(empCapPct/100 * m.salary);
                    const effectiveSalaryNow = m.salary + currentMatchReceived;
                    const effectiveSalaryFullMatch = m.salary + fullMatchAvailable;

                    return (
                      <>
                        <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"14px"}}>
                          Here's how your contribution and your employer's match add up to your effective pay from this job — and what's still on the table.
                        </p>

                        <div style={stepCardStyle}>
                          <div style={stepEyebrowStyle}>Step 1 — Your contribution</div>
                          <div style={rowStyle}>
                            <span>{myPct > 0 ? `${myPct}% of salary, from your pay` : "Not contributing yet"}</span>
                            <span style={{fontWeight:700,color:G}}>{fmt(myContribAnnual)}/yr</span>
                          </div>
                          <p style={stepWhyStyle}>Every 1% of salary you contribute is worth {fmt(perOnePctValue)}/yr — before tax relief is even added on top.</p>
                        </div>

                        <div style={{...stepCardStyle, background: m.missedMatch>0 ? "rgba(196,150,58,0.07)" : "rgba(45,107,74,0.06)", border:`1px solid ${m.missedMatch>0 ? "rgba(196,150,58,0.28)" : "rgba(45,107,74,0.22)"}`}}>
                          <div style={{...stepEyebrowStyle, color: m.missedMatch>0 ? GOLD : "#2d6b4a"}}>Step 2 — Employer match {m.missedMatch>0 ? "(not fully claimed)" : "(fully claimed ✓)"}</div>
                          <div style={rowStyle}>
                            <span>Matched up to {empCapPct}% of salary</span>
                            <span style={{fontWeight:700,color:"#2d6b4a"}}>{fmt(currentMatchReceived)}/yr</span>
                          </div>
                          {m.missedMatch > 0 && (
                            <div style={{...rowStyle,color:"#c0392b",marginTop:"4px"}}>
                              <span>Left on the table</span>
                              <span style={{fontWeight:700}}>{fmt(Math.round(m.missedMatch))}/yr</span>
                            </div>
                          )}
                          <p style={stepWhyStyle}>Every 1% you're not yet contributing (up to {empCapPct}%) is another {fmt(perOnePctValue)}/yr of free employer money left unclaimed.</p>
                        </div>

                        <div style={{...stepCardStyle, marginBottom:"14px"}}>
                          <div style={stepEyebrowStyle}>Your effective pay from this job</div>
                          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                            <div style={rowStyle}><span>Salary before pension</span><span>{fmt(m.salary)}</span></div>
                            <div style={rowStyle}><span>+ Employer match (today)</span><span style={{color:"#2d6b4a",fontWeight:600}}>{fmt(currentMatchReceived)}</span></div>
                            <div style={totalRowStyle}><span>Effective total pay today</span><span>{fmt(effectiveSalaryNow)}</span></div>
                            {m.missedMatch > 0 && (
                              <div style={{...rowStyle,marginTop:"4px",color:GOLD,fontWeight:700}}>
                                <span>If you claimed the full match</span>
                                <span>{fmt(effectiveSalaryFullMatch)} <span style={{fontWeight:400,color:MUT}}>(+{fmt(fullMatchAvailable-currentMatchReceived)})</span></span>
                              </div>
                            )}
                          </div>
                        </div>

                        <p style={{fontSize:"12px",color:MUT,lineHeight:1.6}}>
                          Adding 1% of salary costs just {fmt(Math.round(m.salary*0.01/12*(1-m.tr)))}/mo in take-home pay after {trPct}% tax relief — see the growth trajectory below for what closing this gap does to your pot.
                        </p>
                      </>
                    );
                  })()}
                  {d.hasPension !== "yes" && products?.products?.length > 0 && (
                    <>
                      <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase",margin:"18px 0 10px"}}>Where to start a pension</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"12px",marginBottom:"12px"}}>
                        {products.products.map((p,i) => <ProductCard key={i} p={p} onInternalLink={onOpenModule}/>)}
                      </div>
                      {products.disclaimer && <p style={{fontSize:"11px",color:MUT,lineHeight:1.6,padding:"12px 0 0",borderTop:"1px solid rgba(22,47,36,0.08)"}}>{products.disclaimer}</p>}
                    </>
                  )}
                </ExpandableInvestmentItem>
              )}

              {showSacrificeCalc && (
                <ExpandableInvestmentItem
                  number={win2Num}
                  title={inTaper ? "Recover your Personal Allowance" : "Get ahead of the £100k taper"}
                  headline={inTaper
                    ? `Sacrificing ${fmt(taperSacrificeNeeded)} recovers your full Personal Allowance — worth ~${fmt(taperTotalSaving)}`
                    : `You're ${fmt(Math.max(0, taperStart - ani))} below the £100k taper — sacrifice now to stay ahead of it`}
                  tag={{ label:"Today", color:GOLD }}
                >
                  <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"14px"}}>
                    {inTaper
                      ? `Between £100,000 and £125,140, your Personal Allowance is withdrawn at £1 for every £2 earned above £100,000 — creating an effective 60% marginal tax rate on that band. Salary sacrifice reduces your adjusted net income, restoring the allowance and saving roughly ${fmt(taperTotalSaving)} in tax and NI.`
                      : `Your adjusted net income is in the £80,000–£100,000 zone. Sacrificing into your pension now builds wealth efficiently — and if a bonus or pay rise pushes you over £100,000 later, prior sacrifice reduces how hard the taper bites.`}
                  </p>
                  {inTaper && taperTotalSaving > 0 && (
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",marginBottom:"16px",textAlign:"center"}}>
                      <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"8px",padding:"12px 8px"}}>
                        <div style={{fontFamily:SERIF,fontSize:"20px",color:G,fontWeight:700}}>{fmt(taperSacrificeNeeded)}</div>
                        <div style={{fontSize:"11px",color:MUT,marginTop:"3px"}}>sacrifice needed</div>
                      </div>
                      <div style={{background:"rgba(45,107,74,0.08)",borderRadius:"8px",padding:"12px 8px"}}>
                        <div style={{fontFamily:SERIF,fontSize:"20px",color:"#2d6b4a",fontWeight:700}}>{fmt(taperTaxSaving)}</div>
                        <div style={{fontSize:"11px",color:MUT,marginTop:"3px"}}>tax saved</div>
                      </div>
                      <div style={{background:"rgba(196,150,58,0.18)",borderRadius:"8px",padding:"12px 8px"}}>
                        <div style={{fontFamily:SERIF,fontSize:"20px",color:G,fontWeight:700}}>{fmt(taperTotalSaving)}</div>
                        <div style={{fontSize:"11px",color:G,marginTop:"3px",fontWeight:600}}>total saving</div>
                      </div>
                    </div>
                  )}
                  {d.hasKids === "yes" && (
                    <div style={{background:"rgba(192,57,43,0.05)",border:"1px solid rgba(192,57,43,0.18)",borderRadius:"10px",padding:"14px 16px",marginBottom:"12px"}}>
                      <div style={{fontSize:"11px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"6px"}}>Also at stake: your childcare support</div>
                      <p style={{fontSize:"13px",color:TEXT,lineHeight:1.7,margin:0}}>
                        Tax-Free Childcare (worth up to £2,000 per child a year, £4,000 if disabled) and the free childcare hours scheme are both lost <strong>entirely</strong> — not tapered — the moment either parent's adjusted net income crosses £100,000. Staying under that line can be worth roughly £5,000–£7,500 per child a year in free hours alone, on top of the tax and NI saving above. Actual value depends on your child's age and how many hours you'd use.
                      </p>
                    </div>
                  )}
                  <p style={{fontSize:"12px",color:MUT,lineHeight:1.6}}>
                    This is separate from your Personal Savings Allowance, which isn't affected by the £100k taper itself — it only falls to £0 once income crosses £125,140 (additional rate). You're currently in the {m.taxBandLabel}-rate band.
                  </p>
                </ExpandableInvestmentItem>
              )}

              {hasStatedBonus ? (
                <div id="bonus-sacrifice-panel">
                  <ExpandableInvestmentItem
                    number={win3Num}
                    title="Model bonus sacrifice"
                    headline={`Sacrificing your ${fmt(bonus)} bonus could save up to ${fmt(Math.round(bonus*m.tr))} in tax`}
                    tag={{ label:"Today", color:GOLD }}
                    defaultOpen={openSection === "bonusSacrifice"}
                  >
                    <p style={{fontSize:"13px",color:MUT,lineHeight:1.6,marginBottom:"12px"}}>
                      Sacrificing your bonus before it hits your payslip means you never pay tax, NI{bonusSlRate > 0 ? ", or student loan repayments" : ""} on that money. It goes into your pension gross, grows free of tax, and is only taxed when you draw it — typically at a lower rate in retirement.
                    </p>
                    <div style={{marginBottom:"12px"}}>
                      <label style={{...LBL,marginBottom:"5px"}}>Bonus amount to model (£)</label>
                      <input type="number" style={{...INP,fontSize:"16px",fontWeight:600,fontFamily:SERIF,padding:"8px 12px",marginTop:"4px"}}
                        value={bonusInput} onChange={e => setBonusInput(Math.max(0,+e.target.value))} placeholder="e.g. 10,000"/>
                    </div>
                    {(crossesTaper || crossesAR) && (
                      <div style={{background:"rgba(192,57,43,0.05)",border:"1px solid rgba(192,57,43,0.2)",borderRadius:"8px",padding:"8px 10px",marginBottom:"10px",display:"flex",gap:"8px",alignItems:"flex-start"}}>
                        <span style={{fontSize:"13px",flexShrink:0}}>⚠️</span>
                        <div>
                          <div style={{fontSize:"12px",fontWeight:600,color:"#c0392b",marginBottom:"2px"}}>
                            {crossesTaper && !crossesAR ? "Your bonus crosses the 60% taper zone (£100k–£125,140)" : "Your bonus spans the 40% → 60% taper → 45% rate bands"}
                          </div>
                          <div style={{fontSize:"11px",color:MUT,lineHeight:1.45}}>Between £100,000 and £125,140 your personal allowance is progressively withdrawn — creating an effective 60% marginal rate. Sacrificing the portion of your bonus that lands here is especially valuable. The rate shown is the average across the full bonus.</div>
                        </div>
                      </div>
                    )}
                    <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"8px",padding:"10px 12px",marginBottom:"12px"}}>
                      <div style={{fontSize:"10px",fontWeight:700,color:G,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"8px"}}>For every £1 of your bonus — with no sacrifice</div>
                      <div style={{display:"grid",gridTemplateColumns:`repeat(${bonusSlRate > 0 ? 4 : 3},1fr)`,gap:"6px"}}>
                        <div style={{textAlign:"center",padding:"7px 6px",background:"rgba(192,57,43,0.06)",borderRadius:"7px"}}>
                          <div style={{fontFamily:SERIF,fontSize:"18px",color:"#c0392b",fontWeight:700}}>{fullTaxPct}p</div>
                          <div style={{fontSize:"9px",color:MUT,marginTop:"2px",lineHeight:1.25}}>income tax<br/>({fullTaxPct}% eff.)</div>
                        </div>
                        <div style={{textAlign:"center",padding:"7px 6px",background:"rgba(196,150,58,0.08)",borderRadius:"7px"}}>
                          <div style={{fontFamily:SERIF,fontSize:"18px",color:GOLD,fontWeight:700}}>{fullNIPct}p</div>
                          <div style={{fontSize:"9px",color:MUT,marginTop:"2px",lineHeight:1.25}}>NI<br/>({fullNIPct}%)</div>
                        </div>
                        {bonusSlRate > 0 && (
                          <div style={{textAlign:"center",padding:"7px 6px",background:"rgba(22,47,36,0.06)",borderRadius:"7px"}}>
                            <div style={{fontFamily:SERIF,fontSize:"18px",color:"#1e4030",fontWeight:700}}>{fullSLPct}p</div>
                            <div style={{fontSize:"9px",color:MUT,marginTop:"2px",lineHeight:1.25}}>student<br/>loan (9%)</div>
                            {loanBal > 0 && <div style={{marginTop:"3px",fontSize:"8px",color:"#2d6b4a",fontWeight:600,lineHeight:1.25}}>{m.willClear ? "clears faster" : "likely written off"}</div>}
                          </div>
                        )}
                        <div style={{textAlign:"center",padding:"7px 6px",background:"rgba(45,107,74,0.08)",borderRadius:"7px"}}>
                          <div style={{fontFamily:SERIF,fontSize:"18px",color:"#2d6b4a",fontWeight:700}}>{fullKeepPct}p</div>
                          <div style={{fontSize:"9px",color:MUT,marginTop:"2px",lineHeight:1.25}}>you keep</div>
                        </div>
                      </div>
                      {bonusSlRate > 0 && loanBal > 0 && (
                        <div style={{marginTop:"8px",padding:"6px 8px",background:"rgba(22,47,36,0.04)",borderRadius:"5px",fontSize:"10px",color:MUT,lineHeight:1.5}}>
                          {m.willClear
                            ? `📌 The ${fmt(slRepaymentFromBonus)} student loan deduction from this bonus brings your clear date forward, saving roughly ${fmt(slInterestSaved)} in interest.`
                            : `📌 Your loan is unlikely to clear before write-off. The ${fmt(slRepaymentFromBonus)} that would be deducted from this bonus would almost certainly be written off anyway — sacrificing avoids it entirely.`}
                        </div>
                      )}
                    </div>
                    <div style={{marginBottom:"12px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}>
                        <label style={LBL}>How much to sacrifice?</label>
                        <span style={{fontFamily:SERIF,fontSize:"16px",fontWeight:700,color:G}}>{sacrificePct}%</span>
                      </div>
                      <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
                        {[0,25,50,75,100].map(pct => (
                          <button key={pct} type="button" onClick={() => setSacrificePct(pct)} style={{flex:1,padding:"6px 4px",background:sacrificePct===pct?G:"transparent",border:`1.5px solid ${sacrificePct===pct?G:"rgba(22,47,36,0.2)"}`,borderRadius:"7px",color:sacrificePct===pct?WHITE:G,fontSize:"12px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{pct}%</button>
                        ))}
                      </div>
                      <input type="range" min="0" max="100" step="1" value={sacrificePct} onChange={e => setSacrificePct(+e.target.value)} style={{width:"100%",accentColor:G}}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
                      <div style={{background:"rgba(45,107,74,0.06)",border:"1px solid rgba(45,107,74,0.22)",borderRadius:"8px",padding:"10px 12px"}}>
                        <div style={{fontSize:"9px",fontWeight:700,color:"#2d6b4a",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>You receive</div>
                        <div style={{fontFamily:SERIF,fontSize:"17px",color:G,fontWeight:700,marginBottom:"5px"}}>{fmt(totalReceived)}</div>
                        <div style={{fontSize:"11px",color:MUT,display:"flex",flexDirection:"column",gap:"2px"}}>
                          {sacrificedAmt > 0 && <span style={{color:"#2d6b4a",fontWeight:500}}>Pension: {fmt(sacrificedAmt)}</span>}
                          {takeHomeCash > 0 && <span>Cash: {fmt(takeHomeCash)}</span>}
                          {employerNISave > 0 && <span style={{color:"#2d6b4a",marginTop:"3px"}}>+ {fmt(employerNISave)} employer NI saved*</span>}
                        </div>
                      </div>
                      <div style={{background:"rgba(192,57,43,0.05)",border:"1px solid rgba(192,57,43,0.18)",borderRadius:"8px",padding:"10px 12px"}}>
                        <div style={{fontSize:"9px",fontWeight:700,color:"#c0392b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Paid to HMRC{bonusSlRate>0?" + SLC":""}</div>
                        <div style={{fontFamily:SERIF,fontSize:"17px",color:TEXT,fontWeight:700,marginBottom:"5px"}}>{sacrificePct===100?fmt(0):fmt(totalDeducted)}</div>
                        <div style={{fontSize:"11px",color:MUT,display:"flex",flexDirection:"column",gap:"2px"}}>
                          {sacrificePct===100
                            ? <span style={{color:"#2d6b4a",fontWeight:600}}>Nothing — full sacrifice 🎉</span>
                            : <>{taxOnCash>0&&<span>Tax: {fmt(taxOnCash)} ({Math.round(bonusTaxDetail.effectiveRate*100)}% eff.)</span>}{niOnCash>0&&<span>NI: {fmt(niOnCash)}</span>}{slOnCash>0&&<span>Student loan: {fmt(slOnCash)}</span>}</>}
                        </div>
                      </div>
                    </div>
                    <div style={{background:G,borderRadius:"8px",padding:"10px 12px",marginBottom:"8px"}}>
                      <div style={{fontSize:"10px",fontWeight:700,color:GOLD,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>If sacrificed today — value at retirement (age {retireAge})</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}}>
                        {[100,50,0].map(pct => {
                          const active = sacrificePct === pct;
                          return (
                            <div key={pct} onClick={() => setSacrificePct(pct)} style={{textAlign:"center",padding:"8px 6px",borderRadius:"7px",background:active?"rgba(196,150,58,0.18)":"rgba(255,255,255,0.05)",cursor:"pointer",border:`1px solid ${active?"rgba(196,150,58,0.4)":"transparent"}`,transition:"all 0.2s"}}>
                              <div style={{fontSize:"10px",color:active?GOLD:"rgba(255,255,255,0.5)",marginBottom:"4px",fontWeight:active?700:400}}>{pct}% sacrificed</div>
                              <div style={{fontFamily:SERIF,fontSize:"clamp(13px,3vw,18px)",color:active?GOLD:WHITE,fontWeight:700,marginBottom:"1px"}}>{fmt(bonusFVpartial(pct))}</div>
                              <div style={{fontSize:"8px",color:"rgba(255,255,255,0.35)"}}>in {years} yrs at 6%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p style={{fontSize:"10.5px",color:MUT,lineHeight:1.5}}>
                      Tax rate shown is the effective average across the bonus — it may exceed your salary tax band if total income crosses the £100k personal allowance taper or £125,140 additional rate threshold. * Employer NI of 13.8% on sacrificed amount — some employers pass this on. Future values assume 6% p.a. growth, undrawn until retirement.
                    </p>
                  </ExpandableInvestmentItem>
                </div>
              ) : (
                <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"12px",padding:"16px 18px",marginBottom:"20px"}}>
                  <div style={{fontSize:"13px",fontWeight:600,color:G,marginBottom:"6px"}}>💰 Getting a bonus? Sacrifice it before it's paid</div>
                  <p style={{fontSize:"13px",color:MUT,lineHeight:1.65,margin:0}}>
                    Sacrificing a bonus into your pension before it hits your payslip means you never pay tax or NI on that money — it goes in gross, grows tax-free, and is only taxed (typically at a lower rate) when you draw it in retirement. If you're expecting one this year, update your inputs to model it here.
                  </p>
                </div>
              )}

              {/* ── Pension growth trajectory — non-numbered info tile, styled like
                  Cash's runway tile: supporting context, not a single action. ── */}
              {showTrajectory && (
                <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"12px",padding:"18px 22px",marginBottom:"20px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
                    <span style={{width:"9px",height:"9px",borderRadius:"50%",background:col,flexShrink:0,display:"inline-block"}}/>
                    <span style={{fontSize:"13px",fontWeight:600,color:G}}>Pension growth trajectory</span>
                  </div>
                  <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{display:"block",overflow:"visible"}}>
                    {showOptimised && (
                      <>
                        <line x1={PL} x2={VW-PR} y1={refY} y2={refY} stroke="#e8d5a3" strokeWidth="1.5" strokeDasharray="8,5" opacity="0.7"/>
                        <text x={VW-PR-6} y={refY-7} fontSize="13" fill="#e8d5a3" textAnchor="end" fontWeight="600">Potential</text>
                      </>
                    )}
                    {bars.map((bar, i) => {
                      const x = barX(i);
                      const barH = Math.max(4, (bar.value / maxVal) * cH);
                      const y = PT + cH - barH;
                      const lines = bar.label.split("\n");
                      return (
                        <g key={i}>
                          <rect x={x} y={y} width={barW} height={barH} rx="6" fill={bar.color}/>
                          <text x={x + barW/2} y={y - 10} fontSize="18" fontWeight="700" fill={G} textAnchor="middle">{fmt(Math.round(bar.value/1000)*1000)}</text>
                          {lines.map((ln, li) => (
                            <text key={li} x={x + barW/2} y={VH - PB + 20 + li * 18} fontSize="13" fontWeight={li===0?"700":"400"} fill={MUT} textAnchor="middle">{ln}</text>
                          ))}
                          {i === 0 && (
                            <line x1={x+barW+8} x2={barX(1)-8} y1={(y + PT+cH)/2} y2={(sy(bars[1].value) + PT+cH)/2}
                              stroke={GOLD} strokeWidth="2.5" markerEnd="url(#arrowGold)"/>
                          )}
                        </g>
                      );
                    })}
                    <defs>
                      <marker id="arrowGold" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L8,3 z" fill={GOLD}/>
                      </marker>
                    </defs>
                    <line x1={PL} x2={VW-PR} y1={PT+cH} y2={PT+cH} stroke="rgba(200,216,204,0.55)" strokeWidth="2"/>
                  </svg>
                  <div style={{fontSize:"12px",color:MUT,marginTop:"4px",lineHeight:1.6}}>
                    Based on 6% annual growth over {years} year{years!==1?"s":""} to age {retireAge}. Contributions shown in today's money.
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"10px",marginTop:"18px"}}>
                    <div>
                      <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Projected pot at {retireAge}</div>
                      <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>{fmt(m.projectedPot)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Pension return ratio</div>
                      <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>1:{pensionReturnRatio(d,m).toFixed(2)}</div>
                    </div>
                    {onTrackEarly && (
                      <div>
                        <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Earliest viable retirement</div>
                        <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>{earlyRetire} <span style={{fontSize:"12px",fontWeight:400,color:MUT}}>({yearsSaved} yr{yearsSaved!==1?"s":""} early)</span></div>
                      </div>
                    )}
                    {+d.niYears > 0 && (
                      <div>
                        <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>State pension estimate</div>
                        <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>{fmt(m.statePensionAnnual)}/yr</div>
                      </div>
                    )}
                  </div>
                  <p style={{fontSize:"12px",color:MUT,lineHeight:1.6,marginTop:"10px"}}>{pensionReturnLabel(d,m)}</p>

                  {/* "What if you contributed more?" — adjustable version of the old static 1% chip */}
                  <div style={{marginTop:"16px",borderLeft:`4px solid ${GOLD}`,background:"rgba(196,150,58,0.07)",borderRadius:"0 8px 8px 0",padding:"14px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px",flexWrap:"wrap",gap:"8px"}}>
                      <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.06em",textTransform:"uppercase"}}>What if you contributed more?</div>
                      <div style={{display:"flex",gap:"6px"}}>
                        {[1,2,3,5].map(pct => (
                          <button key={pct} type="button" onClick={() => setExtraPct(pct)} style={{padding:"6px 12px",background:extraPct===pct?G:"transparent",border:`1.5px solid ${extraPct===pct?G:"rgba(22,47,36,0.2)"}`,borderRadius:"7px",color:extraPct===pct?WHITE:G,fontSize:"12px",fontWeight:700,cursor:"pointer"}}>+{pct}%</button>
                        ))}
                      </div>
                    </div>
                    <p style={{fontSize:"13px",color:G,lineHeight:1.6,margin:0}}>
                      An extra <strong>{extraPct}%</strong> of salary costs just <strong>{fmt(extraNetCostMonthly)}/mo</strong> after tax relief, and could add roughly <strong>{fmt(extraGrowth)}</strong> to your pot by retirement — <strong>{fmt(Math.round(m.projectedPot) + extraGrowth)}</strong> total.
                    </p>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Cross-module links */}
        {crossLinks.length > 0 && (
          <div className="fu3" style={{marginBottom:"28px",display:"flex",flexDirection:"column",gap:"10px"}}>
            {crossLinks.map((link,i) => (
              <div key={i} onClick={() => onOpenModule(link.target, link.section)} style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"14px 18px",border:"1px solid rgba(22,47,36,0.1)",cursor:"pointer",display:"flex",alignItems:"center",gap:"14px"}}>
                <span style={{fontSize:"20px",flexShrink:0}}>{link.icon}</span>
                <div style={{flex:1}}>
                  <p style={{fontSize:"13px",color:TEXT,lineHeight:1.6}}>{link.text}</p>
                </div>
                <span style={{fontSize:"12px",fontWeight:600,color:GOLD,whiteSpace:"nowrap",flexShrink:0}}>{link.label} →</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Cash & Savings: Win tiles. Deliberately NOT a straight copy of the
            Investments pattern — the wins here are genuinely interlinked (ISA, PSA,
            and Premium Bonds all draw from the same pot), so instead of three
            separate wins covering ISA / rate-switching / Premium Bonds, there's one
            multi-step "Optimise your cash" win that walks the whole allocation, plus
            a conditional "Build your emergency fund" win when the buffer isn't met
            yet. */}
        {moduleKey === "cash" && !isPensionUnknown && (() => {
          const {
            psaLimit, isaRateDisplay, nonIsaRateDisplay, PB_RATE,
            currentTaxableInterest, currentPbInterest, currentGrossTotal, currentTaxableAmount, trPct, currentTaxCost, currentAfterTaxTotal,
            totalPot, step1Isa, step1IsaInterest,
            step2Savings, step2SavingsInterest, discretionaryAmount,
            step3Pb, step3PbInterest, step3UpliftVsCurrent, beyondPbCap,
            optimisedTotal, keptAmount, currentInterestOnKeptAmount, optimisationGain,
          } = calcCashOptimisation(m, isaRatePct, nonIsaRatePct);

          const displayTiers = [
            ...((Array.isArray(d.cashTiers) && d.cashTiers.some(t => +t.amount > 0))
              ? d.cashTiers.filter(t => +t.amount > 0).map(t => ({ amount:+t.amount||0, rate:+t.rate||0, isPb:false }))
              : (m.cash > 0 ? [{ amount:m.cash, rate:m.savingsRate, isPb:false }] : [])),
            ...(bondsVal > 0 ? [{ amount:bondsVal, rate:PB_RATE*100, isPb:true }] : []),
          ];

          // Step 4 growth illustration — same 10yr/7% nominal illustrative assumption
          // used elsewhere in this file (e.g. the Investments module's ISA growth chart).
          const growthYears = 10;
          const investedIllustration = Math.round(discretionaryAmount * Math.pow(1.07, growthYears));
          const pbIllustration = Math.round(discretionaryAmount * Math.pow(1 + PB_RATE, growthYears));

          const nearTaperZone = m.adjustedNetIncome >= 100000 && m.adjustedNetIncome < 125140;

          // A separate, genuinely different list from the Cash ISA grid below — non-ISA
          // rows, for the portion of the pot that doesn't fit in the ISA.
          const nonIsaProducts = (savingsRates||[])
            .filter(r => r.is_isa === false)
            .sort((a,b) => +b.rate_aer - +a.rate_aer)
            .slice(0, 4)
            .map((r,i) => ({ name:r.provider_name, type:r.account_type, rate:`${r.rate_aer}% AER`, badge:i===0?"Highest rate":"", highlight:i===0, cta:"View account", appIcon:"🏦", productUrl:r.product_url }));

          const showEmergencyWin = m.emergencyShortfall > 0;
          const monthsToCloseGap = m.monthlySurplus > 0 ? Math.ceil(m.emergencyShortfall / m.monthlySurplus) : null;
          let winCounter = 0;
          const emergencyWinNumber = showEmergencyWin ? ++winCounter : null;
          const optimiseWinNumber = ++winCounter;

          // Cash runway status — shown as a plain (non-numbered) tile below the wins.
          // pctRaw is uncapped so a 10-month runway against a 6-month target doesn't
          // look identical to an 18-month one; the bar itself is a fixed 0–2× target
          // scale with a marker at the real position, same reasoning.
          const runwayTarget = m.emergencyBuffer;
          const runwayCurrent = m.totalLiquid;
          const runwayPctRaw = runwayTarget > 0 ? (runwayCurrent / runwayTarget) * 100 : 0;
          const runwayTierColor = runwayPctRaw >= 100 ? "#2d6b4a" : runwayPctRaw >= 33 ? GOLD : "#c0392b";
          const runwayStatusLabel = runwayPctRaw >= 150 ? "More than sufficient" : runwayPctRaw >= 100 ? "Sufficient" : runwayPctRaw >= 33 ? "Borderline" : "Insufficient";
          const runwayMarkerPct = runwayTarget > 0 ? Math.min(100, (runwayPctRaw / 200) * 100) : 0;

          const opportunityCols = [];
          if (showEmergencyWin) opportunityCols.push({ label:"Emergency fund shortfall", value:fmt(m.emergencyShortfall), sub:`to reach your ${m.bufferMonths}-month target` });
          if (optimisationGain > 50) opportunityCols.push({ label:"Tax-efficiency gain available", value:`${fmt(optimisationGain)}/yr`, sub:"by reordering into ISA → PSA → Premium Bonds" });

          return (
            <div className="fu4">
              {opportunityCols.length > 0 && (
                <div className="fu1" style={{background:G,borderRadius:"12px",padding:"18px 22px",marginBottom:"24px"}}>
                  <div style={{fontSize:"11px",fontWeight:800,color:GOLD,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"12px"}}>Your opportunity right now</div>
                  <div style={{display:"grid",gridTemplateColumns:`repeat(${opportunityCols.length},1fr)`,gap:"14px"}}>
                    {opportunityCols.map((c,i) => (
                      <div key={i}>
                        <div style={{fontFamily:SERIF,fontSize:"22px",color:WHITE,fontWeight:700}}>{c.value}</div>
                        <div style={{fontSize:"12px",color:"rgba(255,255,255,0.85)",fontWeight:600,marginTop:"2px"}}>{c.label}</div>
                        <div style={{fontSize:"11px",color:"rgba(255,255,255,0.55)",marginTop:"2px"}}>{c.sub}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{fontSize:"12px",color:"rgba(255,255,255,0.6)",lineHeight:1.6,marginTop:"14px",paddingTop:"12px",borderTop:"1px solid rgba(255,255,255,0.12)"}}>See the wins below to act on these.</p>
                </div>
              )}

              {showEmergencyWin && (
                <ExpandableInvestmentItem
                  number={emergencyWinNumber}
                  title="Build your emergency fund"
                  headline={`${fmt(m.emergencyShortfall)} more needed to reach your ${m.bufferMonths}-month target`}
                  tag={{ label:"Priority", color:"#c0392b" }}
                >
                  <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"12px"}}>
                    You currently hold {fmt(m.totalLiquid)} against a {fmt(m.emergencyBuffer)} target ({m.bufferMonths} months of expenses) — a {fmt(m.emergencyShortfall)} gap. This comes before any tax-efficiency optimisation below: a real buffer protects you from having to sell investments or borrow at a bad time.
                  </p>
                  {monthsToCloseGap && (
                    <div style={{background:"rgba(196,150,58,0.07)",border:"1px solid rgba(196,150,58,0.28)",borderRadius:"10px",padding:"12px 14px",marginBottom:"12px",fontSize:"13px",color:TEXT,lineHeight:1.6}}>
                      At your current surplus of ~{fmt(Math.round(m.monthlySurplus))}/month, putting all of it aside would close this gap in <strong>~{monthsToCloseGap} month{monthsToCloseGap===1?"":"s"}</strong>.
                    </div>
                  )}
                  <p style={{fontSize:"13px",color:MUT,lineHeight:1.7}}>Keep it somewhere instant-access while you build it up — see "Optimise your cash" below for the best rate available right now on whatever you're building it in.</p>
                </ExpandableInvestmentItem>
              )}

              <ExpandableInvestmentItem
                number={optimiseWinNumber}
                title="Optimise your cash"
                headline={totalPot <= 0 ? "Add your cash and savings details to see this" : optimisationGain > 50 ? `You can earn ${fmt(optimisationGain)}/yr more, tax-efficiently` : "Your cash is already well-placed for tax."}
                tag={{ label:"Today", color:GOLD }}
              >
                {totalPot > 0 ? (() => {
                  const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT };
                  const totalRowStyle = { ...rowStyle, paddingTop:"7px", borderTop:"1px dashed rgba(22,47,36,0.18)", fontWeight:700 };
                  const stepCardStyle = { background:"rgba(22,47,36,0.03)", border:"1px solid rgba(22,47,36,0.12)", borderRadius:"12px", padding:"14px 16px", marginBottom:"10px" };
                  const stepEyebrowStyle = { fontSize:"10px", fontWeight:700, color:GOLD, letterSpacing:"0.05em", textTransform:"uppercase", marginBottom:"6px" };
                  const stepWhyStyle = { fontSize:"12px", color:MUT, lineHeight:1.6, marginTop:"6px", marginBottom:0 };
                  return (
                  <>
                    <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"16px"}}>
                      Here's the full working for your {fmt(totalPot)} of cash and Premium Bonds — what it earns today, then the tax-efficient order to hold it in instead.
                    </p>

                    {/* ── 1. Today's allocation ─────────────────────────────── */}
                    <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"10px"}}>1. Today's allocation</div>
                    <div style={{...stepCardStyle,padding:"16px 18px",marginBottom:"12px"}}>
                      <div style={{display:"flex",flexDirection:"column",gap:"7px"}}>
                        {displayTiers.map((t,i) => (
                          <div key={i} style={rowStyle}>
                            <span>{t.isPb ? "Premium Bonds" : `Account ${i+1}`} — {fmt(t.amount)} at {t.rate.toFixed(2)}%{t.isPb ? " (tax-free avg.)" : ""}</span>
                            <span style={{fontWeight:600}}>{fmt(Math.round(t.amount * t.rate / 100))}/yr</span>
                          </div>
                        ))}
                        <div style={totalRowStyle}>
                          <span>Gross interest income</span>
                          <span>{fmt(currentGrossTotal)}/yr</span>
                        </div>
                      </div>
                    </div>

                    {m.cash > 0 && (
                      <div style={{...stepCardStyle,padding:"16px 18px",marginBottom:"16px",background:"rgba(192,57,43,0.04)",border:"1px solid rgba(192,57,43,0.18)"}}>
                        <div style={{fontSize:"11px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"12px"}}>Tax on that interest</div>
                        <div style={{display:"flex",flexDirection:"column",gap:"7px",marginBottom:"12px"}}>
                          <div style={rowStyle}><span>Taxable interest (outside an ISA, excluding Premium Bonds)</span><span style={{fontWeight:600}}>{fmt(currentTaxableInterest)}</span></div>
                          <div style={rowStyle}><span>Less: your Personal Savings Allowance</span><span>−{fmt(Math.min(currentTaxableInterest, psaLimit))}</span></div>
                          <div style={{...rowStyle,paddingTop:"7px",borderTop:"1px dashed rgba(192,57,43,0.25)"}}><span>Taxable amount</span><span style={{fontWeight:600}}>{fmt(currentTaxableAmount)}</span></div>
                          <div style={{...rowStyle,color:"#c0392b",fontWeight:700}}><span>Tax due at {trPct}%</span><span>{fmt(currentTaxCost)}</span></div>
                        </div>
                        <div style={{background:"rgba(45,107,74,0.08)",borderRadius:"8px",padding:"10px 12px",fontSize:"13px",color:TEXT}}>
                          Net interest income, after tax: <strong>{fmt(currentAfterTaxTotal)}/yr</strong>
                        </div>
                      </div>
                    )}

                    {/* ── 2. Optimised allocation ───────────────────────────── */}
                    <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"10px"}}>2. Optimised allocation</div>

                    {step1Isa > 0 && (
                      <div style={stepCardStyle}>
                        <div style={stepEyebrowStyle}>Step 1 — Fill your ISA</div>
                        <div style={rowStyle}>
                          <span>{fmt(step1Isa)} into a Cash ISA at {isaRateDisplay}</span>
                          <span style={{fontWeight:700,color:"#2d6b4a"}}>{fmt(step1IsaInterest)}/yr</span>
                        </div>
                        <p style={stepWhyStyle}>Why: interest inside an ISA is completely tax-free, for life, and doesn't touch your Personal Savings Allowance — so it's always the first place to fill.</p>
                      </div>
                    )}
                    {step2Savings > 0 && (
                      <div style={stepCardStyle}>
                        <div style={stepEyebrowStyle}>Step 2 — Fill your Personal Savings Allowance</div>
                        <div style={rowStyle}>
                          <span>{fmt(step2Savings)} into savings at {nonIsaRateDisplay}</span>
                          <span style={{fontWeight:700,color:"#2d6b4a"}}>{fmt(step2SavingsInterest)}/yr</span>
                        </div>
                        <p style={stepWhyStyle}>Why: interest within your {fmt(psaLimit)} allowance is also effectively tax-free — and {nonIsaRateDisplay} beats the ~4.4% Premium Bonds average, so this comes next.</p>
                      </div>
                    )}
                    {discretionaryAmount > 0 && (
                      <>
                        <div style={stepCardStyle}>
                          <div style={stepEyebrowStyle}>Step 3 — Cash-focused: near-term need, or risk-averse</div>
                          <div style={rowStyle}>
                            <span>{fmt(step3Pb)} in Premium Bonds at ~4.4% (tax-free avg.)</span>
                            <span style={{fontWeight:700,color:"#2d6b4a"}}>{fmt(step3PbInterest)}/yr</span>
                          </div>
                          <p style={stepWhyStyle}>Why: once your allowance is used, ordinary savings interest is taxed at your {trPct}% marginal rate — Premium Bonds aren't.{step3UpliftVsCurrent > 0 ? ` That's ~${fmt(step3UpliftVsCurrent)}/yr more than your current ${m.savingsRate.toFixed(2)}% blended rate on this amount,` : ""} with no risk of loss and nothing locked in — the right choice for money you might need before you'd want it exposed to markets.{beyondPbCap > 0 ? ` Capped at the £50,000 NS&I product limit — ${fmt(beyondPbCap)} wouldn't fit here.` : ""}</p>
                        </div>
                        <div style={stepCardStyle}>
                          <div style={stepEyebrowStyle}>Step 4 — Growth-focused: no near-term need</div>
                          <div style={rowStyle}>
                            <span>{fmt(discretionaryAmount)} invested instead (e.g. a General Investment Account)</span>
                            <span style={{fontWeight:700,color:MUT}}>not guaranteed</span>
                          </div>
                          <p style={stepWhyStyle}>Why: for money you won't touch for several years, long-term capital growth has historically outgrown cash — illustratively, {fmt(discretionaryAmount)} could grow to ~{fmt(investedIllustration)} over {growthYears} years at a typical (not guaranteed) 7% nominal return, versus ~{fmt(pbIllustration)} left in Premium Bonds at ~4.4%. Capital gains are taxed at 18%/24% (with a £3,000 annual exempt amount), not your income tax rate. Real trade-off, not a free upgrade: you could lose money, and it only suits cash you're genuinely not going to need soon.</p>
                        </div>
                      </>
                    )}

                    <div style={{...stepCardStyle,padding:"16px 18px",marginTop:"6px",marginBottom:"16px"}}>
                      <div style={{display:"flex",flexDirection:"column",gap:"7px"}}>
                        <div style={rowStyle}><span>Optimised interest income (on the {fmt(keptAmount)} kept as cash)</span><span style={{fontWeight:700}}>{fmt(optimisedTotal)}/yr</span></div>
                        <div style={rowStyle}><span>That same {fmt(keptAmount)}, at today's blended rate</span><span>{fmt(currentInterestOnKeptAmount)}/yr</span></div>
                        <div style={{...totalRowStyle, color: optimisationGain > 0 ? "#2d6b4a" : TEXT}}>
                          <span>{optimisationGain > 0 ? "You can earn" : "Difference"}</span>
                          <span>{optimisationGain > 0 ? "+" : ""}{fmt(optimisationGain)}/yr</span>
                        </div>
                      </div>
                      {discretionaryAmount > 0 && (
                        <div style={{marginTop:"10px",background:"rgba(45,107,74,0.08)",borderRadius:"8px",padding:"10px 12px",fontSize:"13px",color:TEXT,lineHeight:1.6}}>
                          This total assumes the cash-safe route (Step 3) for the {fmt(discretionaryAmount)} beyond your ISA and PSA. Prefer to invest it instead? See Step 4 above.
                        </div>
                      )}
                    </div>

                    {step1Isa > 0 && products.products.length > 0 && (
                      <>
                        <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:"10px"}}>{products.heading}</div>
                        <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"12px"}}>
                          {products.products.map((p,i) => <ProductCard key={i} p={p} onInternalLink={onOpenModule}/>)}
                        </div>
                      </>
                    )}
                    {step2Savings > 0 && nonIsaProducts.length > 0 && (
                      <>
                        <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:"10px"}}>Best non-ISA easy-access accounts</div>
                        <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"12px"}}>
                          {nonIsaProducts.map((p,i) => <ProductCard key={i} p={p} onInternalLink={onOpenModule}/>)}
                        </div>
                      </>
                    )}
                    {step3Pb > 0 && bondsVal === 0 && (
                      <div style={{background:"rgba(196,150,58,0.07)",border:"1px solid rgba(196,150,58,0.28)",borderRadius:"10px",padding:"12px 14px",marginBottom:"12px",fontSize:"13px",color:TEXT,lineHeight:1.65}}>
                        <strong>New to Premium Bonds?</strong> They're via NS&amp;I, backed directly by HM Treasury, and don't pay interest — instead every £1 bond is entered into a monthly prize draw, with prizes from £25 up to £1 million. Nothing is guaranteed in any single month, but averaged out, the prize fund pays the equivalent of ~4.4% a year, entirely tax-free. Minimum £25, maximum £50,000 holding, and penalty-free to cash out any time.
                      </div>
                    )}
                    <p style={{fontSize:"11px",color:MUT,lineHeight:1.6,padding:"12px 0",borderTop:"1px solid rgba(22,47,36,0.08)"}}>Rates change frequently — always confirm the current rate directly with the provider before moving money. Premium Bonds pay no guaranteed return; the ~4.4% is a long-run average, not a promise.</p>

                    {discretionaryAmount > 500 && (
                      <div style={{marginTop:"8px"}}>
                        <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:"10px"}}>Ready to go the Step 4 route? — {fmt(discretionaryAmount)}</div>
                        <p style={{fontSize:"13px",color:MUT,lineHeight:1.7,marginBottom:"12px"}}>If you won't need this for several years, here's how to actually put it to work — two options worth weighing up:</p>
                        <div onClick={() => onOpenModule("investments")} style={{display:"flex",alignItems:"flex-start",gap:"10px",padding:"14px 16px",background:"rgba(22,47,36,0.04)",borderRadius:"10px",cursor:"pointer",marginBottom:"8px"}}>
                          <span style={{fontSize:"16px",flexShrink:0}}>📈</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:"13px",fontWeight:700,color:G,marginBottom:"3px"}}>Invest it (a General Investment Account)</div>
                            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.6,margin:0}}>Over the long term, capital growth taxed at CGT rates (18%/24%, with a £3,000 annual exempt amount) often comes out ahead of interest taxed at your full {Math.round(m.tr*100)}% marginal rate — and equities have historically outgrown cash over long periods. But this is genuinely higher risk: you could lose money, and it only suits cash you won't need for several years. Consider your objectives and time horizon before moving anything.</p>
                          </div>
                          <span style={{fontSize:"12px",color:GOLD,fontWeight:600,flexShrink:0}}>Investments →</span>
                        </div>
                        <div onClick={() => onOpenModule("pension")} style={{display:"flex",alignItems:"flex-start",gap:"10px",padding:"14px 16px",background:"rgba(22,47,36,0.04)",borderRadius:"10px",cursor:"pointer"}}>
                          <span style={{fontSize:"16px",flexShrink:0}}>🏦</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:"13px",fontWeight:700,color:G,marginBottom:"3px"}}>Contribute to your pension</div>
                            <p style={{fontSize:"13px",color:TEXT,lineHeight:1.6,margin:0}}>
                              A pension contribution gets tax relief at your marginal rate — {Math.round(m.tr*100)}% for a {m.taxBandLabel}-rate taxpayer — though if it's not made via salary sacrifice or net pay, you may need to claim the higher-rate portion back via self-assessment.
                              {nearTaperZone
                                ? ` This matters even more for you: between £100,000 and £125,140 of adjusted net income you lose £1 of your tax-free Personal Allowance for every £2 earned — an effective 60% marginal rate in that band. A pension contribution that brings your adjusted net income back under £100,000 restores it.`
                                : ` If your income ever moves into the £100,000–£125,140 band, this becomes especially powerful — the Personal Allowance taper there creates an effective 60% marginal rate, which a pension contribution can undo.`
                              }
                            </p>
                          </div>
                          <span style={{fontSize:"12px",color:GOLD,fontWeight:600,flexShrink:0}}>Pension →</span>
                        </div>
                      </div>
                    )}
                  </>
                  );
                })() : (
                  <p style={{fontSize:"14px",color:MUT,lineHeight:1.7}}>Add your cash savings and any Premium Bonds in your onboarding details to see a personalised, tax-efficient allocation.</p>
                )}
              </ExpandableInvestmentItem>

              {/* Cash runway status — styled like a collapsed Win tile (white, bordered)
                  rather than the dark green used at the top of other modules, since this
                  now sits below the wins as supporting context, not the headline. */}
              <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"12px",padding:"18px 22px",marginBottom:"20px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px",flexWrap:"wrap",gap:"8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <span style={{width:"9px",height:"9px",borderRadius:"50%",background:runwayTierColor,flexShrink:0,display:"inline-block"}}/>
                    <span style={{fontSize:"13px",fontWeight:600,color:G}}>Cash runway — {runwayStatusLabel}</span>
                  </div>
                  <span style={{fontSize:"13px",color:MUT}}>{m.runwayMonths.toFixed(1)} months</span>
                </div>
                <div style={{position:"relative",width:"100%",height:"14px",borderRadius:"7px",background:`linear-gradient(90deg, #c0392b 0%, ${GOLD} 33%, #2d6b4a 60%, #1e4d35 100%)`,overflow:"visible"}}>
                  <div style={{position:"absolute",left:"50%",top:"-3px",bottom:"-3px",width:"2px",background:"rgba(255,255,255,0.65)",transform:"translateX(-1px)"}}/>
                  <div style={{position:"absolute",left:`${runwayMarkerPct}%`,top:"-4px",bottom:"-4px",width:"3px",borderRadius:"2px",background:WHITE,boxShadow:"0 0 0 1px rgba(0,0,0,0.3)",transform:"translateX(-1.5px)",transition:"left 0.4s ease"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:"5px"}}>
                  <span style={{fontSize:"10px",color:MUT}}>0 mo</span>
                  <span style={{fontSize:"10px",color:TEXT,fontWeight:600}}>{m.bufferMonths}mo target</span>
                  <span style={{fontSize:"10px",color:MUT}}>{m.bufferMonths*2}mo+</span>
                </div>
                <div style={{marginTop:"8px",fontSize:"13px",color:TEXT}}>
                  {runwayPctRaw >= 150
                    ? <span style={{color:"#2d6b4a",fontWeight:600}}>✓ More than sufficient — {fmt(runwayCurrent)} saved, {(runwayPctRaw/100).toFixed(1)}× your {m.bufferMonths}-month target ({fmt(runwayTarget)})</span>
                    : runwayPctRaw >= 100
                      ? <span style={{color:"#2d6b4a",fontWeight:600}}>✓ Fully funded — {fmt(runwayCurrent)} of {fmt(runwayTarget)} target</span>
                      : `${fmt(runwayCurrent)} of ${fmt(runwayTarget)} emergency fund target (${Math.round(runwayPctRaw)}% covered)`}
                </div>
              </div>

              <NonWinExpandable
                eyebrow="Other low-risk places for cash"
                title="Other cash-like options"
                subtitle="Beyond savings accounts — different trade-offs on rate, liquidity, and tax."
              >
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"12px",marginBottom:"12px"}}>
                  {altProducts.map((p,i) => <ProductCard key={i} p={p} onInternalLink={onOpenModule}/>)}
                </div>
                <p style={{fontSize:"11px",color:MUT,lineHeight:1.6,padding:"10px 0",borderTop:"1px solid rgba(22,47,36,0.08)"}}>All rates indicative as of early 2026. Gilts and money market funds carry low but non-zero risk. Candid may earn a referral fee.</p>
              </NonWinExpandable>
            </div>
          );
        })()}

        {/* ── Investments: two expandable step-through items ──────────────────
            Replaces the old flat tile stack. "Unused ISA allowance" nests the
            compound-growth chart and ISA provider comparison; "CGT allowance
            crystallisation" nests the existing "Action before April 5th" panel.
            The score-affecting action remains the separate "Mark as reviewed"
            button at the bottom of this page. */}
        {moduleKey === "investments" && products && !isPensionUnknown && (() => {
          const unwrappedVal = +d.unwrappedValue||0;
          const surplusSources = [];
          if (m.surplusCash > 5000) surplusSources.push(`${fmt(m.surplusCash)} of surplus cash above your ${m.bufferMonths}-month emergency fund`);
          if (unwrappedVal > 0) surplusSources.push(`${fmt(unwrappedVal)} of unwrapped investments`);
          const showMoveMsg = m.isaHeadroom > 0 && surplusSources.length > 0;
          const isaHeadline = m.isaHeadroom > 0
            ? `${fmt(m.isaHeadroom)} of ISA allowance remaining — invested, that could grow to ~${fmt(Math.round(isaProjectedValue))} tax-free by 67`
            : "You've used your full £20,000 ISA allowance this tax year.";
          const cgtHeadline = m.crystallisable > 0
            ? `${fmt(m.cgtSaving)} saved this tax year`
            : "No unrealised gains to crystallise this tax year.";
          return (
            <div className="fu4">
              <ExpandableInvestmentItem
                number={1}
                title="Utilise unused ISA allowance"
                headline={isaHeadline}
                tag={{ label: "Future opportunity", color: "#2d6b4a" }}
              >
                <p style={{fontSize:"14px",color:MUT,lineHeight:1.65,marginBottom:"14px"}}>{products.subheading}</p>

                {showMoveMsg && (
                  <div style={{background:"rgba(196,150,58,0.07)",border:"1px solid rgba(196,150,58,0.28)",borderRadius:"12px",padding:"16px 18px",marginBottom:"16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                      <span style={{fontSize:"16px"}}>💷</span>
                      <span style={{fontSize:"12px",fontWeight:700,color:GOLD,letterSpacing:"0.06em",textTransform:"uppercase"}}>Move this into your S&S ISA</span>
                    </div>
                    <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7}}>
                      You have {surplusSources.join(" and ")} — {fmt(m.isaHeadroom)} of ISA allowance is available to shelter it from tax, permanently. The providers below are where you'd actually do this.
                    </p>
                  </div>
                )}

                {/* ISA compound-growth chart — real inline SVG (matches the pension/
                    student-loan charts elsewhere in this file): actual compound values
                    plotted at each step, not a straight line. Single lump sum, no
                    further contributions. */}
                {m.isaHeadroom > 0 && (() => {
                  const principal = m.isaHeadroom;
                  const growthRatePct = 7;
                  // UK State Pension age (67) — fixed, since we don't capture it as a
                  // user input (d.retirementAge is a different concept: the user's
                  // chosen private pension access age, used for pension projections).
                  const retirementAge = 67;
                  const currentAge = +d.age || 30;
                  const years = Math.max(1, retirementAge - currentAge);
                  const finalValue = principal * Math.pow(1 + growthRatePct/100, years);
                  const STEPS = Math.min(years, 60);
                  const points = Array.from({ length: STEPS + 1 }, (_, i) => {
                    const yr = (years * i) / STEPS;
                    return { yr, val: principal * Math.pow(1 + growthRatePct/100, yr) };
                  });
                  const VW = 640, VH = 200, PL = 18, PR = 18, PT = 48, PB = 30;
                  const cW = VW - PL - PR, cH = VH - PT - PB;
                  const maxVal = finalValue * 1.05;
                  const sx = yr => PL + (yr / years) * cW;
                  const sy = val => PT + cH - (val / maxVal) * cH;
                  const linePath = points.map((p, i) => `${i===0?"M":"L"}${sx(p.yr).toFixed(1)},${sy(p.val).toFixed(1)}`).join(" ");
                  const areaPath = `${linePath} L${sx(years).toFixed(1)},${(PT+cH).toFixed(1)} L${sx(0).toFixed(1)},${(PT+cH).toFixed(1)} Z`;
                  return (
                    <div style={{background:"#F4EEE2",borderRadius:"12px",padding:"16px 18px 12px",marginBottom:"16px"}}>
                      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{display:"block",overflow:"visible"}}>
                        <defs>
                          <linearGradient id="isaGrowthFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#153524" stopOpacity="0.24"/>
                            <stop offset="100%" stopColor="#153524" stopOpacity="0.02"/>
                          </linearGradient>
                        </defs>
                        <path d={areaPath} fill="url(#isaGrowthFill)"/>
                        <path d={linePath} fill="none" stroke="#C79A3D" strokeWidth="3" strokeLinecap="round"/>
                        <text x={VW-PR} y={PT-20} textAnchor="end" fontSize="21" fontWeight="700" fill="#153524" fontFamily={SERIF}>{`~${fmt(Math.round(finalValue))}`}</text>
                        <text x={VW-PR} y={PT-5} textAnchor="end" fontSize="11" fill="#153524" opacity="0.75">{`at ${growthRatePct}% p.a., tax-free`}</text>
                        <text x={PL} y={PT+cH+20} fontSize="11" fontWeight="600" fill="#153524" opacity="0.8">{`Today · ${fmt(Math.round(principal))}`}</text>
                        <text x={VW-PR} y={PT+cH+20} textAnchor="end" fontSize="11" fill="#153524" opacity="0.6">{`${years} years`}</text>
                      </svg>
                      <p style={{fontSize:"11px",color:"#153524",opacity:0.65,lineHeight:1.5,marginTop:"2px"}}>
                        Illustrative only — assumes {growthRatePct}% p.a. nominal growth (not guaranteed) and retirement at {retirementAge}. Real returns could be lower or negative.
                      </p>
                    </div>
                  );
                })()}

                <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:"10px"}}>Where to open a Stocks &amp; Shares ISA</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"12px",marginBottom:"12px"}}>
                  {products.products.map((p,i) => <ProductCard key={i} p={p} onInternalLink={onOpenModule}/>)}
                </div>
                {products.disclaimer && <p style={{fontSize:"11px",color:MUT,lineHeight:1.6,padding:"12px 0 0",borderTop:"1px solid rgba(22,47,36,0.08)"}}>{products.disclaimer}</p>}
              </ExpandableInvestmentItem>

              <ExpandableInvestmentItem
                number={2}
                title="Crystallise paper gains not shielded by tax"
                headline={cgtHeadline}
                tag={{ label: "Today", color: GOLD }}
              >
                {m.crystallisable > 0 ? (() => {
                  const totalGains = +d.unrealisedGains||0;
                  const cgtRatePct = Math.round(m.cgtRate*100);
                  const yearsNeeded = Math.ceil(totalGains / 3000);
                  const taxpayerBand = m.tr !== 0.20 ? "higher/additional-rate" : "basic-rate";
                  const taxIfWait = Math.round((totalGains - 3000) * m.cgtRate);
                  return (
                  <div>
                    <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"12px"}}>
                      You have ~{fmt(totalGains)} of unrealised gain. £3,000 is exempt from CGT every year — realising it now banks {fmt(m.crystallisable)} of gain with £0 tax.
                    </p>
                    <p style={{fontSize:"13px",color:MUT,lineHeight:1.7,marginBottom:"14px"}}>
                      Every tax year you're entitled to shield up to £3,000 of capital gains from tax completely — but it's a "use it or lose it" allowance that resets each 6 April and can't be carried forward. To use it, you sell (crystallise) shares or funds held outside an ISA or pension that have gains attached; any gain above £3,000 in a single tax year is taxed at your {cgtRatePct}% CGT rate.
                      {yearsNeeded > 1 && ` With ${fmt(totalGains)} of unrealised, unshielded gains in total, it would take ${yearsNeeded} tax years of this allowance to crystallise all of it tax-free.`}
                    </p>

                    {yearsNeeded > 1 && (
                      <div style={{background:"rgba(22,47,36,0.03)",border:"1px solid rgba(22,47,36,0.12)",borderRadius:"12px",padding:"16px 18px",marginBottom:"14px"}}>
                        <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"12px"}}>Wait and sell it all at once, vs shielding £3,000/yr</div>
                        <div style={{display:"flex",flexDirection:"column",gap:"7px",marginBottom:"12px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:"13px",color:TEXT}}><span>Total unrealised gain</span><span style={{fontWeight:600}}>{fmt(totalGains)}</span></div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:"13px",color:MUT}}><span>Less: one year's CGT exemption</span><span>−{fmt(3000)}</span></div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:"13px",color:TEXT,paddingTop:"7px",borderTop:"1px dashed rgba(22,47,36,0.18)"}}><span>Taxable gain</span><span style={{fontWeight:600}}>{fmt(totalGains-3000)}</span></div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:"13px",color:"#c0392b",fontWeight:700}}><span>Tax due at {cgtRatePct}%</span><span>{fmt(taxIfWait)}</span></div>
                        </div>
                        <div style={{background:"rgba(45,107,74,0.08)",borderRadius:"8px",padding:"10px 12px",fontSize:"13px",color:TEXT,lineHeight:1.6}}>
                          Shield {fmt(3000)} a year instead — spread across {yearsNeeded} tax years — and the same {fmt(totalGains)} of gain costs <strong>£0</strong> in total: a saving of <strong>{fmt(taxIfWait)}</strong> versus leaving it all until you sell.
                        </div>
                      </div>
                    )}

                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                      <MiniExpandTile icon="🔄" label="Bed &amp; breakfasting" color={GOLD} summary="Repurchase inside an ISA immediately, or wait 30 days outside it.">
                        <p style={{fontSize:"12px",color:MUT,lineHeight:1.6,margin:0}}>
                          HMRC's "30-day rule" matches a repurchase of the same holding within 30 days against the shares you just bought back — not your original, cheaper ones — which cancels out the gain you were trying to bank. Buying back inside an ISA or pension sidesteps the rule entirely, since that's a different tax wrapper, so you can crystallise and reinvest immediately there. Outside a wrapper, you either wait the full 30 days before repurchasing the same holding, or buy a different (but similarly-exposed) fund instead.
                        </p>
                      </MiniExpandTile>
                      <MiniExpandTile icon="⏳" label="Use it or lose it" color="#c0392b" summary="This year's £3,000 exemption doesn't carry over — unused, it's gone on April 5th.">
                        <p style={{fontSize:"12px",color:MUT,lineHeight:1.6,margin:0}}>
                          The £3,000 annual exempt amount is flat — every taxpayer gets the same allowance regardless of income, and it can't be carried forward once the tax year ends. What income does change is the rate charged on any gain above it: basic-rate taxpayers pay 18%, higher and additional-rate taxpayers pay 24%. You're a {taxpayerBand} taxpayer, so gains above your exemption are taxed at {cgtRatePct}%.
                        </p>
                      </MiniExpandTile>
                    </div>
                  </div>
                  );
                })() : (
                  <p style={{fontSize:"14px",color:MUT,lineHeight:1.7}}>You have no unrealised gains recorded outside an ISA or pension this tax year, so there's nothing to crystallise. If that changes, come back before April 5th to use your £3,000 exempt amount.</p>
                )}
              </ExpandableInvestmentItem>
            </div>
          );
        })()}

        {/* Products — omitted for Investments, Cash, Pension, and Student loan: folded into their Win tiles. */}
        {products && !isPensionUnknown && moduleKey !== "investments" && moduleKey !== "cash" && moduleKey !== "pension" && moduleKey !== "studentLoan" && (
          <div className="fu4">
            <div style={{marginBottom:"16px"}}>
              <h3 style={{fontFamily:SERIF,fontSize:"20px",color:G,marginBottom:"6px"}}>{products.heading}</h3>
              <p style={{fontSize:"14px",color:MUT,lineHeight:1.65}}>{products.subheading}</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"12px",marginBottom:"14px"}}>
              {products.products.slice(0, visibleTileCount).map((p,i) => (
                <ProductCard key={i} p={p} onInternalLink={onOpenModule}/>
              ))}
            </div>
            {products.products.length > visibleTileCount && (
              <button type="button" onClick={() => setVisibleTileCount(c => c + CASH_TILE_PAGE_SIZE)} style={{
                display:"block",width:"100%",padding:"10px",background:"transparent",
                border:"1.5px dashed rgba(22,47,36,0.25)",borderRadius:"8px",color:G,
                fontSize:"13px",fontWeight:600,cursor:"pointer",marginBottom:"14px",fontFamily:SANS,
              }}>
                See {Math.min(CASH_TILE_PAGE_SIZE, products.products.length - visibleTileCount)} more ({products.products.length - visibleTileCount} remaining) ↓
              </button>
            )}
            {products.disclaimer && <p style={{fontSize:"11px",color:MUT,lineHeight:1.6,padding:"12px 0",borderTop:"1px solid rgba(22,47,36,0.08)"}}>{products.disclaimer}</p>}
          </div>
        )}

        {/* ── Student loan: opportunity strip + win + trajectory info tile ──
            A student loan is genuinely one decision ("should I overpay?"), not
            several independent wins — same reasoning as Cash's single multi-step
            "Optimise your cash" win. Overpaying is only a real Win when the loan
            will actually clear before write-off AND beats the user's cash rate;
            every other case (written off regardless, clears but saving already
            wins, or below threshold) is a quiet note in the info tile instead. */}
        {moduleKey === "studentLoan" && !isPensionUnknown && d.studentLoan !== "none" && products?.slSection && (() => {
          const sl = products.slSection;
          const worthOverpaying = sl.willClear && sl.effectiveBenefit > 0;

          const surplusCash = m.surplusCash || 0;

          return (
            <>
              {worthOverpaying && (
                <div className="fu1" style={{background:G,borderRadius:"12px",padding:"18px 22px",marginBottom:"24px"}}>
                  <div style={{fontSize:"11px",fontWeight:800,color:GOLD,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"12px"}}>Your opportunity right now</div>
                  <div>
                    <div style={{fontFamily:SERIF,fontSize:"22px",color:WHITE,fontWeight:700}}>{fmt(sl.overpayAnnualBenefit)}/yr</div>
                    <div style={{fontSize:"12px",color:"rgba(255,255,255,0.85)",fontWeight:600,marginTop:"2px"}}>Effective benefit from overpaying</div>
                    <div style={{fontSize:"11px",color:"rgba(255,255,255,0.55)",marginTop:"2px"}}>vs keeping that money as cash</div>
                  </div>
                  <p style={{fontSize:"12px",color:"rgba(255,255,255,0.6)",lineHeight:1.6,marginTop:"14px",paddingTop:"12px",borderTop:"1px solid rgba(255,255,255,0.12)"}}>See the win below to act on this.</p>
                </div>
              )}

              {/* ── Your loan trajectory — promoted to sit directly under the
                  opportunity strip, non-numbered info tile styled like Cash's
                  runway / Pension's growth-trajectory tile. ── */}
              <div style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"12px",padding:"18px 22px",marginBottom:"20px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
                  <span style={{width:"9px",height:"9px",borderRadius:"50%",background:col,flexShrink:0,display:"inline-block"}}/>
                  <span style={{fontSize:"13px",fontWeight:600,color:G}}>Your loan trajectory</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:"10px",marginBottom:"14px"}}>
                  <div>
                    <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Current balance</div>
                    <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>{fmt(m.loanBal)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Interest rate</div>
                    <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>{sl.slRatePct}%</div>
                  </div>
                  <div>
                    <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Annual interest</div>
                    <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>{fmt(sl.annualInterest)}/yr</div>
                  </div>
                  <div>
                    <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>Annual repayments</div>
                    <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>{fmt(sl.annualRep)}/yr</div>
                  </div>
                  <div>
                    <div style={{fontSize:"10px",color:MUT,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>{sl.clearYr ? "Clears in" : "Written off after"}</div>
                    <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginTop:"2px"}}>{sl.clearYr ? `${sl.clearYr} yrs` : `${sl.writeOffYr} yrs`}</div>
                  </div>
                </div>
                {sl.belowThreshold ? (
                  <p style={{fontSize:"13px",color:MUT,lineHeight:1.7,margin:0}}>Your salary is below the repayment threshold, so no deductions are being made yet. Interest still accrues at {sl.slRatePct}% (~{fmt(sl.annualInterest)}/yr) — deductions start automatically once your salary crosses {fmt(sl.threshold)}.</p>
                ) : !sl.willClear ? (
                  <p style={{fontSize:"13px",color:MUT,lineHeight:1.7,margin:0}}>Your loan is projected to be written off before you'd clear it — overpaying mostly reduces what gets written off, not what you repay. Redirect any spare cash to your pension or ISA instead.</p>
                ) : sl.effectiveBenefit <= 0 ? (
                  <p style={{fontSize:"13px",color:MUT,lineHeight:1.7,margin:0}}>You're on track to clear this loan in ~{sl.clearYr} years through regular repayments alone. Your savings rate ({sl.cashRate}%) beats your loan rate ({sl.slRatePct}%), so saving beats overpaying here.</p>
                ) : (
                  <p style={{fontSize:"13px",color:MUT,lineHeight:1.7,margin:0}}>See the win below for what overpaying could save you.</p>
                )}
              </div>

              {worthOverpaying && (
                <ExpandableInvestmentItem
                  number={1}
                  title={sl.balanceGrowing ? "Your loan balance is growing" : "Overpay your student loan"}
                  headline={sl.balanceGrowing
                    ? `Growing by ${fmt(sl.netAnnualChange)}/yr — overpaying could still save ${fmt(sl.overpayAnnualBenefit)}/yr in interest`
                    : `${fmt(sl.overpayAnnualBenefit)}/yr effective benefit vs keeping the cash`}
                  tag={{ label:"Today", color:GOLD }}
                >
                  {(() => {
                    const rowStyle = { display:"flex", justifyContent:"space-between", fontSize:"13px", color:TEXT };
                    const stepCardStyle = { background:"rgba(22,47,36,0.03)", border:"1px solid rgba(22,47,36,0.12)", borderRadius:"12px", padding:"14px 16px", marginBottom:"10px" };
                    const stepEyebrowStyle = { fontSize:"10px", fontWeight:700, color:GOLD, letterSpacing:"0.05em", textTransform:"uppercase", marginBottom:"6px" };
                    const stepWhyStyle = { fontSize:"12px", color:MUT, lineHeight:1.6, marginTop:"6px", marginBottom:0 };
                    return (
                      <>
                        {sl.balanceGrowing && (
                          <div style={{background:"rgba(192,57,43,0.05)",border:"1.5px solid rgba(192,57,43,0.22)",borderRadius:"12px",padding:"16px 18px",marginBottom:"12px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                              <span style={{fontSize:"16px"}}>🚨</span>
                              <span style={{fontSize:"12px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase"}}>Effective 9% income surcharge</span>
                            </div>
                            <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"10px"}}>
                              Your loan balance is growing faster than you repay it. Every £1 of income above the threshold ({fmt(sl.threshold)}) is taxed an extra 9% — and your balance compounds upward. This continues until you either reach the <strong>inflection point</strong> or the loan is written off.
                            </p>
                            <div style={{background:WHITE,borderRadius:"8px",padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
                              <div>
                                <div style={{fontSize:"11px",color:MUT,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px"}}>Inflection point salary</div>
                                <div style={{fontFamily:SERIF,fontSize:"20px",color:G,fontWeight:700}}>{fmt(sl.inflectionSalary)}</div>
                                <div style={{fontSize:"12px",color:MUT,marginTop:"2px"}}>where repayments = interest</div>
                              </div>
                              <div style={{fontSize:"13px",color:MUT,lineHeight:1.6,flex:1,minWidth:"160px"}}>
                                At this salary, 9% of income above the threshold exactly matches your annual interest charge. Above this point, every pay rise reduces your balance. Below it, every year adds to it.
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Step 1 — the loan itself (full detail is in the trajectory tile above) */}
                        <div style={stepCardStyle}>
                          <div style={stepEyebrowStyle}>Step 1 — Your student loan</div>
                          <div style={rowStyle}><span>Outstanding balance at {sl.slRatePct}% interest</span><span style={{fontWeight:700,color:G}}>{fmt(m.loanBal)}</span></div>
                        </div>

                        {/* Step 2 — do you have spare cash to work with */}
                        <div style={stepCardStyle}>
                          <div style={stepEyebrowStyle}>Step 2 — Your spare cash</div>
                          {surplusCash > 0 ? (
                            <div style={rowStyle}><span>Held above your {m.bufferMonths}-month emergency buffer</span><span style={{fontWeight:700,color:G}}>{fmt(surplusCash)}</span></div>
                          ) : (
                            <p style={{fontSize:"13px",color:MUT,margin:0}}>You don't currently hold cash above your emergency buffer — the comparison below still applies to any spare cash you build up or hold elsewhere.</p>
                          )}
                        </div>

                        {/* Step 3 — does repaying actually beat leaving it as cash */}
                        <div style={{...stepCardStyle, background:"rgba(45,107,74,0.06)", border:"1px solid rgba(45,107,74,0.22)"}}>
                          <div style={{...stepEyebrowStyle, color:"#2d6b4a"}}>Step 3 — Does repaying beat cash?</div>
                          <div style={rowStyle}><span>Loan rate {sl.slRatePct}% vs your cash rate {sl.cashRate}%</span><span style={{fontWeight:700,color:"#2d6b4a"}}>Yes, by {sl.effectiveBenefit}%</span></div>
                          <p style={stepWhyStyle}>Every £1 put toward the loan instead of left as cash earns an extra {sl.effectiveBenefit}% a year. That's where the {fmt(sl.overpayAnnualBenefit)}/yr figure above comes from — the {sl.effectiveBenefit}% differential applied to your full {fmt(m.loanBal)} balance.</p>
                        </div>

                        {sl.scenarios.length > 0 && (
                    <div style={{marginBottom:"12px"}}>
                      <div style={stepEyebrowStyle}>
                        Step 4 — What overpaying could save you
                      </div>
                      <p style={{fontSize:"12px",color:MUT,lineHeight:1.6,marginBottom:"10px"}}>If you put some of that spare cash toward the loan today:</p>
                      <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"14px 16px",marginBottom:"8px",display:"flex",gap:"16px",flexWrap:"wrap",alignItems:"center"}}>
                        <div style={{flex:"0 0 auto"}}>
                          <div style={{fontSize:"10px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"3px"}}>No overpayment</div>
                          <div style={{fontFamily:SERIF,fontSize:"17px",color:TEXT,fontWeight:600}}>
                            {sl.baseProjection.clearYr
                              ? `Clears in ${sl.baseProjection.clearYr} yrs`
                              : `${fmt(sl.baseProjection.writeOffBal)} written off`}
                          </div>
                        </div>
                        <div style={{flex:1,minWidth:"140px",fontSize:"12px",color:MUT,lineHeight:1.6}}>
                          Total repaid: {fmt(sl.baseProjection.totalPaid)} over {sl.writeOffYr} years. Interest accruing: {fmt(sl.annualInterest)}/yr.
                        </div>
                      </div>
                      {sl.scenarios.map((s,i) => {
                        const reaches = s.crossesInflection;
                        const clears = !!s.clearYr;
                        const bg = clears ? "rgba(45,107,74,0.06)" : reaches ? "rgba(196,150,58,0.06)" : WHITE;
                        const bdr = clears ? "rgba(45,107,74,0.22)" : reaches ? "rgba(196,150,58,0.3)" : "rgba(22,47,36,0.09)";
                        const savedVsBase = sl.baseProjection.totalPaid - s.totalPaid;
                        return (
                          <div key={i} style={{background:bg,border:`1.5px solid ${bdr}`,borderRadius:"10px",padding:"14px 16px",marginBottom:"8px"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:"wrap",marginBottom:"8px"}}>
                              <div>
                                <div style={{fontSize:"10px",fontWeight:700,color:clears?"#2d6b4a":reaches?GOLD:G,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"3px"}}>
                                  {clears ? "✓ Clears the loan" : reaches ? "✓ Reaches inflection point" : `Overpay ${fmt(s.amt)} today`}
                                </div>
                                <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700}}>
                                  {clears ? `Clears in ${s.clearYr} yrs (vs ${sl.baseProjection.clearYr||sl.writeOffYr})` : `${fmt(s.writeOffBal)} written off`}
                                </div>
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}>
                                <div style={{fontSize:"10px",color:MUT,textTransform:"uppercase",fontWeight:600,marginBottom:"2px"}}>Overpayment</div>
                                <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700}}>{fmt(s.amt)}</div>
                              </div>
                            </div>
                            <div style={{display:"flex",gap:"16px",flexWrap:"wrap",fontSize:"12px",color:MUT,lineHeight:1.6}}>
                              <span>Total repaid: {fmt(s.totalPaid)}</span>
                              {savedVsBase > 0 && <span style={{color:"#2d6b4a",fontWeight:600}}>Saves: {fmt(savedVsBase)} vs doing nothing</span>}
                              {!clears && s.newNetChange <= 0 && <span style={{color:"#2d6b4a",fontWeight:600}}>Balance now shrinking by {fmt(-s.newNetChange)}/yr</span>}
                              {!clears && s.newNetChange > 0 && <span style={{color:GOLD}}>Balance still growing by {fmt(s.newNetChange)}/yr</span>}
                            </div>
                            {reaches && !clears && (
                              <div style={{marginTop:"8px",fontSize:"12px",color:"#1e4030",background:"rgba(45,107,74,0.06)",borderRadius:"6px",padding:"8px 10px",lineHeight:1.5}}>
                                This overpayment brings you to the inflection point — your balance will now start shrinking with every repayment. This is the most impactful outcome possible without clearing the loan entirely.
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {loanCurve && (() => {
                        const { pensionReturn, mortRate, mortReturn, data, VW, VH, PL, PR, PT, PB, cW, cH, sx, sy, path, crossAmt, crossX, crossY, yTicks, xTicks } = loanCurve;
                        return (
                          <div style={{marginTop:"16px",marginBottom:"16px"}}>
                            <div style={{fontSize:"12px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:"10px"}}>Return per £1 overpaid — where the maths tips</div>
                            <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{display:"block",overflow:"visible"}}>
                              <rect x={PL} y={PT} width={cW} height={cH} fill="rgba(22,47,36,0.03)" rx="4"/>
                              {yTicks.map(r => (
                                <g key={r}>
                                  <line x1={PL} x2={VW-PR} y1={sy(r)} y2={sy(r)} stroke="rgba(22,47,36,0.09)" strokeWidth="1.5"/>
                                  <text x={PL-10} y={sy(r)+5} fontSize="16" fontWeight="700" fill={MUT} textAnchor="end">{r.toFixed(2)}</text>
                                </g>
                              ))}
                              <line x1={PL} x2={VW-PR} y1={sy(pensionReturn)} y2={sy(pensionReturn)} stroke="#d4b97a" strokeWidth="2.5" strokeDasharray="10,5"/>
                              <text x={VW-PR-8} y={sy(pensionReturn) + (crossX !== null ? 20 : -10)} fontSize="14" fontWeight="700" fill="#d4b97a" textAnchor="end">Pension {d.pensionType==="sacrifice"?"(salary sacrifice)":d.pensionType==="relief"?"(relief at source)":"return"} {pensionReturn.toFixed(2)}×</text>
                              {sy(mortReturn) > PT + 20 && sy(mortReturn) < VH-PB - 20 && (
                                <>
                                  <line x1={PL} x2={VW-PR} y1={sy(mortReturn)} y2={sy(mortReturn)} stroke={MUT} strokeWidth="1.5" strokeDasharray="8,5" opacity="0.55"/>
                                  <text x={VW-PR-8} y={sy(mortReturn)-8} fontSize="13" fill={MUT} textAnchor="end" opacity="0.7">Mortgage {mortRate}%</text>
                                </>
                              )}
                              <path d={path} fill="none" stroke={GOLD} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                              {crossX !== null && (
                                <>
                                  <line x1={crossX} x2={crossX} y1={PT} y2={VH-PB} stroke={GOLD} strokeWidth="1.5" strokeDasharray="6,4" opacity="0.45"/>
                                  <circle cx={crossX} cy={crossY} r="14" fill={GOLD} opacity="0.22"/>
                                  <circle cx={crossX} cy={crossY} r="8" fill={GOLD}/>
                                </>
                              )}
                              <line x1={PL} x2={VW-PR} y1={VH-PB} y2={VH-PB} stroke="rgba(22,47,36,0.25)" strokeWidth="3"/>
                              {xTicks.map((amt,i) => (
                                <text key={i} x={sx(amt)} y={VH-PB+22} fontSize="16" fontWeight="700" fill={MUT} textAnchor="middle">
                                  {i===0?"£0":i===4?fmt(amt):"£"+Math.round(amt/1000)+"k"}
                                </text>
                              ))}
                              <text x={VW/2} y={VH-6} fontSize="15" fill={MUT} textAnchor="middle" opacity="0.7">Overpayment amount →</text>
                              <line x1={PL} x2={PL} y1={PT} y2={VH-PB} stroke="rgba(22,47,36,0.25)" strokeWidth="3"/>
                              {crossX !== null && (() => {
                                const bx = Math.min(crossX - 10, VW - PR - 270);
                                const by = crossY - 74;
                                return (
                                  <g>
                                    <rect x={bx} y={by} width={258} height={56} rx="8" fill={G}/>
                                    <polygon points={`${crossX-8},${crossY-18} ${crossX},${crossY-4} ${crossX+8},${crossY-18}`} fill={G}/>
                                    <text x={bx+14} y={by+24} fontSize="14" fontWeight="700" fill={WHITE}>Beyond {fmt(Math.round(crossAmt/1000)*1000)}: pension wins</text>
                                    <text x={bx+14} y={by+44} fontSize="13" fill="rgba(255,255,255,0.75)">Your {pensionReturn.toFixed(2)}× return beats the loan rate</text>
                                  </g>
                                );
                              })()}
                            </svg>
                            {crossAmt === null && (() => {
                              const lastRatio = data[data.length - 1]?.ratio ?? 1;
                              if (data[0].ratio < pensionReturn) {
                                return <div style={{marginTop:"8px",fontSize:"13px",color:MUT,lineHeight:1.6}}>Every £1 works harder in your pension than on your loan — your {pensionReturn.toFixed(2)}× pension return ({pensionReturnLabel(d,m)}) exceeds the loan marginal return at all overpayment levels.</div>;
                              }
                              if (lastRatio > pensionReturn) {
                                return <div style={{marginTop:"8px",fontSize:"13px",color:MUT,lineHeight:1.6}}>Overpaying your loan may beat your pension at current contribution levels — your loan marginal return exceeds your {pensionReturn.toFixed(2)}× pension return throughout. Consider clearing the loan before maximising pension contributions.</div>;
                              }
                              return null;
                            })()}
                          </div>
                        );
                      })()}
                    </div>
                        )}
                      </>
                    );
                  })()}
                </ExpandableInvestmentItem>
              )}

            </>
          );
        })()}

        {/* ── Alternative investments (investments module) ── */}
        {moduleKey === "investments" && (
          <AlternativeInvestments age={d.age}/>
        )}

        {/* ── Kids compound growth visualisation ── */}
        {moduleKey === "kids" && products?.kidsSection && (
          <div style={{background:G,borderRadius:"12px",padding:"18px 20px",marginTop:"16px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:GOLD,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:"12px"}}>
              What £100/month from today looks like at age 18
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
              <div style={{background:"rgba(255,255,255,0.07)",borderRadius:"8px",padding:"12px 14px",textAlign:"center"}}>
                <div style={{fontSize:"11px",color:"rgba(255,255,255,0.5)",marginBottom:"4px"}}>Inside a JISA (tax-free)</div>
                <div style={{fontFamily:SERIF,fontSize:"22px",color:GOLD,fontWeight:700}}>{fmt(products.kidsSection.monthly100)}</div>
                <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",marginTop:"2px"}}>7% p.a. for {products.kidsSection.runway} yrs</div>
              </div>
              <div style={{background:"rgba(255,255,255,0.07)",borderRadius:"8px",padding:"12px 14px",textAlign:"center"}}>
                <div style={{fontSize:"11px",color:"rgba(255,255,255,0.5)",marginBottom:"4px"}}>£50/month instead</div>
                <div style={{fontFamily:SERIF,fontSize:"22px",color:WHITE,fontWeight:700}}>{fmt(products.kidsSection.monthly50)}</div>
                <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",marginTop:"2px"}}>Half the amount, same timeframe</div>
              </div>
            </div>
            <p style={{fontSize:"12px",color:"rgba(255,255,255,0.5)",lineHeight:1.6}}>
              The JISA wrapper means zero CGT or income tax on any gains, ever. Outside a JISA, a {Math.round(m.tr*100)}% taxpayer would owe tax on dividends and any gains above the £3k annual CGT exempt amount.
            </p>
          </div>
        )}

        {/* ── Take Me There (kids module) ── */}
        {moduleKey === "kids" && (
          <div style={{marginTop:"16px",background:"rgba(22,47,36,0.03)",border:"1px solid rgba(22,47,36,0.1)",borderRadius:"12px",padding:"16px 18px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Take me there</div>
            <TakeMeThere app="Hargreaves Lansdown" icon="📱" message="Open a Junior ISA for my child" demoNote="Would open HL Junior ISA application"/>
            <TakeMeThere app="PensionBee" icon="🏦" message="Set up a child pension (SIPP)" demoNote="Would open PensionBee child SIPP setup"/>
          </div>
        )}

        {/* ── Personal loan overpayment scenarios ── */}
        {moduleKey === "personalLoan" && products?.overpaySection && (() => {
          const { bal, rate, mo, mos } = products.overpaySection;
          const totalInterest = Math.max(0, mo * mos - bal);
          const overpays = [bal*0.25, bal*0.5, bal].map(Math.round).filter((v,i,a) => a.indexOf(v)===i && v > 0 && v <= bal);
          return (
            <div style={{marginTop:"16px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"12px"}}>What if you overpaid today?</div>
              <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"14px 16px",marginBottom:"8px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
                <div>
                  <div style={{fontSize:"10px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"3px"}}>No overpayment — pay minimum</div>
                  <div style={{fontFamily:SERIF,fontSize:"17px",color:TEXT}}>{fmt(mo)}/mo for {mos} months</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:"10px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"3px"}}>Total interest cost</div>
                  <div style={{fontFamily:SERIF,fontSize:"17px",color:"#c0392b"}}>{fmt(totalInterest)}</div>
                </div>
              </div>
              {overpays.map((extra,i) => {
                const newBal = bal - extra;
                const newInterest = Math.max(0, mo*mos - newBal);
                const interestSaved = Math.round(totalInterest - newInterest);
                const label = i===0?"25% lump sum":i===1?"50% lump sum":"Clear it entirely";
                const clears = extra >= bal;
                return (
                  <div key={i} style={{background:clears?"rgba(45,107,74,0.06)":WHITE,border:`1.5px solid ${clears?"rgba(45,107,74,0.22)":"rgba(22,47,36,0.09)"}`,borderRadius:"10px",padding:"14px 16px",marginBottom:"8px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:"wrap",marginBottom:"6px"}}>
                      <div>
                        <div style={{fontSize:"10px",fontWeight:700,color:clears?"#2d6b4a":G,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"3px"}}>{label}</div>
                        <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700}}>Pay {fmt(extra)} today</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:"10px",color:MUT,textTransform:"uppercase",fontWeight:600,marginBottom:"2px"}}>Interest saved</div>
                        <div style={{fontFamily:SERIF,fontSize:"18px",color:"#2d6b4a",fontWeight:700}}>{fmt(interestSaved)}</div>
                      </div>
                    </div>
                    <p style={{fontSize:"12px",color:MUT,lineHeight:1.6}}>
                      {clears ? `Clears the loan entirely. Zero remaining interest. Guaranteed ${rate}% return on the lump sum.` : `Remaining balance: ${fmt(newBal)}. Continue ${mos} months of ${fmt(mo)} payments. Interest saved: ${fmt(interestSaved)} vs doing nothing.`}
                    </p>
                  </div>
                );
              })}
              <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"12px 14px",marginTop:"4px"}}>
                <p style={{fontSize:"12px",color:MUT,lineHeight:1.6}}>
                  💡 Compare: clearing the loan gives a guaranteed {rate}% return. Your pension gets {Math.round(m.tr*100)}% tax relief. Pension wins first — then throw spare cash at this loan.
                </p>
              </div>
              <div style={{marginTop:"12px"}}>
                <TakeMeThere app="your loan provider" icon="💳" message="Contact my lender about overpayment options" demoNote="Would open lender app or website — most allow 10%/yr penalty-free"/>
              </div>
            </div>
          );
        })()}


        {/* ── Mortgage: overpayment scenarios + remortgage timing + Take Me There ── */}
        {moduleKey === "mortgage" && products?.mortgageSection && (() => {
          const { bal, rate, mo, monthsSaved, interestSaved10k, fixUrgent, fixExpiry, savRate, overpayBenefit } = products.mortgageSection;
          const isVariable = d.mortgageType === "variable";
          const fixedSavings = isVariable && rate > 4.2 ? Math.round(bal * (rate - 4.2) / 100 / 12) : 0;
          const scenarios = [5000, 10000, 25000].filter(x => x < bal);
          return (
            <div style={{marginTop:"16px"}}>
              {isVariable && (
                <div style={{background:"rgba(192,57,43,0.05)",border:"1.5px solid rgba(192,57,43,0.22)",borderRadius:"12px",padding:"16px 18px",marginBottom:"14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                    <span style={{fontSize:"16px"}}>⚠️</span>
                    <span style={{fontSize:"12px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase"}}>You're on a variable rate — already exposed to rate movements</span>
                  </div>
                  <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"10px"}}>
                    Variable rates (SVR/tracker) move with the Bank of England base rate. You have no protection if rates rise. Locking into a fixed deal now at ~4.2% could save you
                    {fixedSavings > 0 ? <strong> {fmt(fixedSavings)}/month</strong> : " significantly"} compared to your current {rate}% rate — and gives you certainty for 2–5 years.
                  </p>
                  <div style={{background:WHITE,borderRadius:"8px",padding:"12px 14px",fontSize:"13px",color:TEXT,lineHeight:1.6}}>
                    A fee-free broker can search the whole market and confirm whether fixing now makes sense for your situation — no obligation.
                  </div>
                </div>
              )}
              {fixUrgent && (
                <div style={{background:"rgba(192,57,43,0.05)",border:"1.5px solid rgba(192,57,43,0.22)",borderRadius:"12px",padding:"16px 18px",marginBottom:"14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                    <span style={{fontSize:"16px"}}>🚨</span>
                    <span style={{fontSize:"12px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase"}}>Fixed rate expiring soon</span>
                  </div>
                  <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"10px"}}>
                    Your fixed rate expires {fixExpiry === "under6m" ? "within 6 months" : "in 6–12 months"}. After expiry you roll onto your lender's Standard Variable Rate (SVR) — typically 7–8%+, costing you <strong>{fmt(Math.round(bal * 0.025 / 12))}/month more</strong> than a competitive fixed deal. Start the process now.
                  </p>
                  <div style={{background:WHITE,borderRadius:"8px",padding:"12px 14px",fontSize:"13px",color:TEXT,lineHeight:1.6}}>
                    Most lenders allow you to lock a new rate up to 6 months before your current deal ends — without paying early repayment charges. A fee-free broker searches the whole market in one go.
                  </div>
                </div>
              )}
              {mo > 0 && scenarios.length > 0 && (
                <div style={{marginBottom:"14px"}}>
                  <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"12px"}}>Overpayment scenarios</div>
                  {scenarios.map((extra, i) => {
                    let baseMos = 0, baseRem = bal;
                    while (baseRem > 0 && baseMos < 600) { baseRem = baseRem*(1+rate/100/12)-mo; baseMos++; if(baseRem<=0) break; }
                    let newMos = 0, newRem = Math.max(0, bal - extra);
                    while (newRem > 0 && newMos < 600) { newRem = newRem*(1+rate/100/12)-mo; newMos++; if(newRem<=0) break; }
                    const mosSaved = Math.max(0, baseMos - newMos);
                    const intSaved = Math.max(0, mosSaved * mo - extra);
                    return (
                      <div key={i} style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.09)",borderRadius:"10px",padding:"14px 16px",marginBottom:"8px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:"wrap",marginBottom:"6px"}}>
                          <div>
                            <div style={{fontSize:"10px",fontWeight:700,color:G,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"3px"}}>Overpay {fmt(extra)} today</div>
                            <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700}}>{mosSaved > 0 ? `${mosSaved} months shorter` : "Minimal impact"}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:"10px",color:MUT,textTransform:"uppercase",fontWeight:600,marginBottom:"2px"}}>Interest saved</div>
                            <div style={{fontFamily:SERIF,fontSize:"18px",color:"#2d6b4a",fontWeight:700}}>{intSaved > 0 ? fmt(intSaved) : "—"}</div>
                          </div>
                        </div>
                        <p style={{fontSize:"12px",color:MUT,lineHeight:1.6}}>
                          Guaranteed {rate}% return. vs saving at {savRate}%: {+overpayBenefit > 0 ? `overpaying wins by ${overpayBenefit}%` : `saving wins by ${Math.abs(+overpayBenefit)}%`}.
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{background:"rgba(22,47,36,0.03)",border:"1px solid rgba(22,47,36,0.1)",borderRadius:"12px",padding:"16px 18px"}}>
                <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Take me there</div>
                <TakeMeThere app="L&C Mortgages" icon="🏠" message={fixUrgent ? "Find my best remortgage deal now" : "Compare mortgage overpayment options"} demoNote="Would open L&C whole-of-market comparison"/>
                <TakeMeThere app="Sprive" icon="⚡" message="Set up automatic mortgage overpayments" demoNote="Would open Sprive app to connect your mortgage"/>
              </div>
            </div>
          );
        })()}

        {/* ── Inheritance: IHT breakdown + gifting strategy + Take Me There ── */}
        {moduleKey === "inheritance" && products?.inheritanceSection && (
          <div style={{marginTop:"16px"}}>
            {products.inheritanceSection.ihtBill > 0 && (
              <div style={{background:"rgba(192,57,43,0.05)",border:"1.5px solid rgba(192,57,43,0.18)",borderRadius:"12px",padding:"16px 18px",marginBottom:"14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                  <span style={{fontSize:"16px"}}>📋</span>
                  <span style={{fontSize:"12px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase"}}>IHT bill breakdown</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"12px"}}>
                  <div style={{background:WHITE,borderRadius:"8px",padding:"12px 14px"}}>
                    <div style={{fontSize:"11px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"4px"}}>Estate value</div>
                    <div style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700}}>{fmt(products.inheritanceSection.estate)}</div>
                  </div>
                  <div style={{background:WHITE,borderRadius:"8px",padding:"12px 14px"}}>
                    <div style={{fontSize:"11px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"4px"}}>Tax-free threshold</div>
                    <div style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700}}>{fmt(products.inheritanceSection.ihtThreshold)}</div>
                  </div>
                  <div style={{background:"rgba(192,57,43,0.06)",borderRadius:"8px",padding:"12px 14px"}}>
                    <div style={{fontSize:"11px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"4px"}}>Taxable portion</div>
                    <div style={{fontFamily:SERIF,fontSize:"20px",color:"#c0392b",fontWeight:700}}>{fmt(products.inheritanceSection.taxable)}</div>
                  </div>
                  <div style={{background:"rgba(192,57,43,0.06)",borderRadius:"8px",padding:"12px 14px"}}>
                    <div style={{fontSize:"11px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"4px"}}>Estimated IHT bill (40%)</div>
                    <div style={{fontFamily:SERIF,fontSize:"20px",color:"#c0392b",fontWeight:700}}>{fmt(products.inheritanceSection.ihtBill)}</div>
                  </div>
                </div>
              </div>
            )}
            <div style={{background:WHITE,border:"1px solid rgba(22,47,36,0.09)",borderRadius:"12px",overflow:"hidden",marginBottom:"14px"}}>
              <div style={{padding:"14px 18px",background:"rgba(22,47,36,0.04)",borderBottom:"1px solid rgba(22,47,36,0.08)"}}>
                <span style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase"}}>Key planning levers</span>
              </div>
              {[
                { icon:"🎁", title:"Annual gifting (£3,000/yr + carry forward)", body:"Use your annual exemption every year. After 7 years, any gift falls completely outside your estate. Start the clock as early as possible." },
                { icon:"🏛️", title:"The 7-year rule", body:products.inheritanceSection.sevenYrRule },
                { icon:"🏦", title:"Leave pensions undrawn", body:products.inheritanceSection.pensionNote },
                { icon:"📄", title:"Write — or update — your will", body:`Without a will, intestacy rules dictate who inherits. A will also lets you direct assets to the most tax-efficient beneficiaries and minimise probate complexity. ${d.hasWill === "yes" ? "You have a will in place — review it if more than 5 years old or after any major life change." : "You don't have a will — this is your highest-priority action."}` },
              ].map((item, i) => (
                <div key={i} style={{padding:"14px 18px",borderBottom:i<3?"1px solid rgba(22,47,36,0.07)":"none",display:"flex",gap:"12px",alignItems:"flex-start"}}>
                  <span style={{fontSize:"18px",flexShrink:0}}>{item.icon}</span>
                  <div>
                    <div style={{fontWeight:600,fontSize:"13px",color:TEXT,marginBottom:"4px"}}>{item.title}</div>
                    <p style={{fontSize:"13px",color:MUT,lineHeight:1.6}}>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(22,47,36,0.03)",border:"1px solid rgba(22,47,36,0.1)",borderRadius:"12px",padding:"16px 18px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Take me there</div>
              <TakeMeThere app="Farewill" icon="📄" message={d.hasWill === "yes" ? "Review and update my will" : "Write my will — takes 15 minutes"} demoNote="Would open Farewill will-writing flow"/>
              <TakeMeThere app="VouchedFor" icon="👔" message="Find a specialist estate planning IFA" demoNote="Would open VouchedFor IFA search filtered to estate planning"/>
            </div>
          </div>
        )}

        {/* Actions — mark reviewed + navigation */}
        <div className="fu5" style={{marginTop:"32px"}}>
          <div style={{position:"relative"}}>
            {showCoins && (() => {
              const localDelta = moduleScoreDelta(statuses[moduleKey]?.status);
              return (
                <div style={{position:"relative",pointerEvents:"none",height:0}}>
                  <span style={{position:"absolute",top:"-8px",left:"calc(50% - 16px)",fontSize:"20px",animation:"coinFloat 0.9s ease-out forwards"}}>🪙</span>
                  <span style={{position:"absolute",top:"-8px",left:"calc(50% + 4px)",fontSize:"20px",animation:"coinFloat 0.9s ease-out 0.15s forwards"}}>🪙</span>
                  {localDelta > 0 && (
                    <span style={{position:"absolute",top:"-12px",right:"calc(50% - 60px)",background:"#2D6B4A",color:WHITE,borderRadius:"100px",padding:"3px 10px",fontSize:"13px",fontWeight:700,animation:"coinFloat 0.9s ease-out 0.05s forwards",whiteSpace:"nowrap"}}>+{localDelta} pts</span>
                  )}
                </div>
              );
            })()}
            <button type="button"
              onClick={() => {
                if (!isComplete) {
                  onComplete();
                  setAnimating(true);
                  setShowCoins(true);
                  setTimeout(() => setShowCoins(false), 900);
                  setTimeout(() => setAnimating(false), 400);
                } else {
                  onComplete();
                }
              }}
              style={{
                width:"100%",padding:"15px",
                background: isComplete ? "transparent" : G,
                border: isComplete ? `1.5px solid ${GOLD}` : "none",
                borderRadius:"10px",
                color: isComplete ? GOLD : WHITE,
                fontSize:"15px",fontWeight:600,
                display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",
                cursor:"pointer",
                animation: animating ? "btnGold 0.4s ease-out" : "none",
              }}>
              {isComplete ? (
                <><svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d="M1 6L5 10L13 1" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round"/></svg>{meta?.title}: Optimised ✓</>
              ) : (
                <><svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d="M1 6L5 10L13 1" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round"/></svg>Mark as reviewed</>
              )}
            </button>
          </div>
          <div style={{display:"flex",gap:"10px",marginTop:"10px"}}>
            <button type="button" onClick={goToDashboard} style={{flex:1,padding:"13px",background:"transparent",border:"1.5px solid rgba(22,47,36,0.18)",borderRadius:"10px",color:G,fontSize:"14px",fontWeight:500,cursor:"pointer"}}>
              ← Dashboard
            </button>
            {nextModule && (
              <button type="button" onClick={() => onOpenModule(nextModule.key)} style={{flex:2,padding:"13px",background:G,border:"none",borderRadius:"10px",color:WHITE,fontSize:"14px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                <span style={{fontSize:"15px"}}>{nextModule.icon}</span>
                <span>Next: {nextModule.title} →</span>
              </button>
            )}
          </div>
        </div>
      </ContentWrap>
    </PageWrap>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
const BLANK_DATA = {
  name:"", email:"", interests:[],
  age:"", salary:"", otherIncome:"", dividendIncome:"", bonusAmount:"", salaryTrajectory:"stable",
  monthlyExpenses:"", higherBuffer:"no",
  cashSavings:"", savingsRate:"", premiumBonds:"", cashAccessType:"",
  cashTiers:[{amount:"",rate:""}],
  hasInvestments:"no", isaUsedThisYear:"", isaPreviousBalance:"", isaType:"none", unwrappedValue:"", unrealisedGains:"",
  isaThisYearCash:"", isaThisYearSS:"", isaThisYearLISA:"", isaThisYearOther:"",
  isaPrevCash:"", isaPrevSS:"", isaPrevLISA:"", isaPrevOther:"",
  hasPension:"no", myContribution:"", employerMatch:"", potValue:"", potValue2:"", retirementAge:"65", pensionType:"",
  pensionUnknown:false,
  niYears:"",
  studentLoan:"none", loanBalance:"", studentLoanRate:"",
  hasMortgage:"no", mortgageType:"fixed", mortgageBalance:"", mortgageRate:"", monthlyMortgage:"",
  fixExpiryMonth:"", fixExpiryYear:"", mortgageProvider:"", propertyEquity:"",
  ownsOutright:false, outrightPropertyValue:"",
  savingsGoal:"goals", investHorizon:"5to10",
  inheritDirection:"", estateValue:"", hasWill:"no",
  hasPersonalLoan:"no", personalLoanBalance:"", personalLoanRate:"", personalLoanMonthly:"", personalLoanTermRemaining:"", personalLoanAnnualExtra:"", personalLoanProvider:"",
  hasKids:"no", numKids:"", kidsAges:"", hasJISA:"no", juniorISAValue:"",
  // Supabase schema note: isa_this_year_other NUMERIC
};

function loadInitialData() {
  try {
    const saved = localStorage.getItem('candid_inputs');
    if (saved) return { ...BLANK_DATA, ...JSON.parse(saved) };
  } catch(e) { if (import.meta.env.DEV) console.warn("[Candid] Failed to load saved inputs from localStorage:", e); }
  return BLANK_DATA;
}

function loadSavedInsights() {
  try {
    const saved = localStorage.getItem('candid_insights');
    if (saved) return JSON.parse(saved);
  } catch(e) { if (import.meta.env.DEV) console.warn("[Candid] Failed to load saved insights from localStorage:", e); }
  return null;
}

export default function Candid({ onGoHome = () => {}, initialScreen = "onboarding" }) {
  const [screen,           setScreen]           = useState(initialScreen);
  const [step,             setStep]             = useState(0);
  const [d,                setD]                = useState(loadInitialData);
  const [insights,         setInsights]         = useState(loadSavedInsights);
  const [prevInsights,     setPrevInsights]     = useState(null);
  const [whatChangedOpen,  setWhatChangedOpen]  = useState(false);
  const [activeModule,     setActiveModule]     = useState(null);
  const [activeSection,    setActiveSection]    = useState(null);
  const [completedModules, setCompletedModules] = useState([]);
  const [prevScreen,       setPrevScreen]       = useState("dashboard");
  const [feedbackOpen,    setFeedbackOpen]    = useState(false);
  const [pdfModalOpen,    setPdfModalOpen]    = useState(false);
  const [showScorePulse,  setShowScorePulse]  = useState(false);
  const [lastScoreDelta,  setLastScoreDelta]  = useState(0);
  const [lastCompletedModule, setLastCompletedModule] = useState(null);
  const [scoreDeltas, setScoreDeltas] = useState([]);
  const feedbackFired = useRef(false);
  const pdfModalFired = useRef(false);
  const supaRowId = useRef(null);
  const prevScoreRef = useRef(null);

  async function supaUpdate(patch) {
    if (!supaRowId.current || !SUPA_URL || !SUPA_KEY) return;
    try {
      await fetch(`${SUPA_URL}/rest/v1/test?id=eq.${supaRowId.current}`, {
        method: "PATCH",
        headers: { "Content-Type":"application/json", "apikey":SUPA_KEY, "Authorization":`Bearer ${SUPA_KEY}`, "Prefer":"return=minimal" },
        body: JSON.stringify(patch),
      });
    } catch(e) { if (import.meta.env.DEV) console.warn("[Candid] Supabase update failed:", e); }
  }

  const set = (k, v) => setD(p => ({...p, [k]:v}));

  useEffect(() => {
    try { localStorage.setItem('candid_inputs', JSON.stringify(d)); }
    catch(e) { if (import.meta.env.DEV) console.warn("[Candid] Failed to persist inputs to localStorage:", e); }
  }, [d]);

  // ── Savings rates — fetched once here (not per-component) since both Dashboard's
  // copy and ModuleDeepDive's Cash tiles need it. null = still loading.
  const [savingsRates, setSavingsRates] = useState(null);
  useEffect(() => {
    let cancelled = false;
    supaSelect("savings_rates", "?select=provider_name,account_type,rate_aer,product_url,updated_at,is_isa&order=rate_aer.desc")
      .then(rows => { if (!cancelled) setSavingsRates(rows || []); });
    return () => { cancelled = true; };
  }, []);

  // ── Return from TrueLayer bank-connect redirect — runs once on mount ─────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tlStatus = params.get("truelayer");
    if (!tlStatus) return;
    const reason = params.get("reason");
    // Strip the query string immediately so a refresh doesn't reprocess it.
    window.history.replaceState({}, "", window.location.pathname);

    if (tlStatus === "success") {
      // The mapped data lives server-side in a one-time HttpOnly cookie set by
      // the callback — fetched here rather than read off the URL, so it never
      // touches browser history, server logs, or Referer headers.
      fetch("/api/truelayer/session-data")
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
        .then(parsed => {
          setD(p => ({
            ...p,
            cashSavings: parsed.cashSavings != null ? String(parsed.cashSavings) : p.cashSavings,
            cashTiers: parsed.cashTiers?.length ? parsed.cashTiers : p.cashTiers,
            monthlyExpenses: parsed.monthlyExpenses != null ? String(parsed.monthlyExpenses) : p.monthlyExpenses,
          }));
          setScreen("onboarding");
          setStep(4);
          posthog.capture("truelayer_connected", { accounts: parsed.accountsConnected ?? null });
        })
        .catch(e => { if (import.meta.env.DEV) console.warn("[Candid] Failed to fetch TrueLayer session data:", e); });
    } else if (tlStatus === "error") {
      posthog.capture("truelayer_connect_failed", { reason: reason || null });
    }
  }, []);

  // Resolved once here from the already-fetched savings_rates and threaded into both
  // functions as plain numbers — calcMetrics/computeModuleStatuses stay synchronous.
  // rate_aer comes back from PostgREST as a string (numeric columns are stringified
  // for precision) — converted explicitly here rather than relying on JS's implicit
  // coercion throughout the downstream arithmetic.
  const marketRates = useMemo(() => {
    const topIsa = topRate(savingsRates, true);
    const topNonIsa = topRate(savingsRates, false);
    return {
      isaRate: topIsa ? +topIsa.rate_aer : undefined,
      nonIsaRate: topNonIsa ? +topNonIsa.rate_aer : undefined,
    };
  }, [savingsRates]);
  const m = useMemo(() => calcMetrics(d, marketRates), [d, marketRates]);
  const statuses = useMemo(() => computeModuleStatuses(d, m, marketRates), [d, m, marketRates]);

  // One-shot PDF-email-capture trigger: 5s after the report/dashboard finishes rendering
  useEffect(() => {
    if (screen !== "dashboard" || pdfModalFired.current) return;
    const t5 = setTimeout(() => {
      if (!pdfModalFired.current) { pdfModalFired.current = true; setPdfModalOpen(true); posthog.capture("pdf_modal_shown"); }
    }, 5000);
    return () => clearTimeout(t5);
  }, [screen]);

  // One-shot feedback trigger: 90s after dashboard loads OR 3s after all modules reviewed
  useEffect(() => {
    if (screen !== "dashboard" || feedbackFired.current) return;
    const t90 = setTimeout(() => {
      if (!feedbackFired.current) { feedbackFired.current = true; setFeedbackOpen(true); posthog.capture("feedback_modal_shown", { trigger: "timer" }); }
    }, 90 * 1000);
    return () => clearTimeout(t90);
  }, [screen]);

  useEffect(() => {
    if (feedbackFired.current || !insights) return;
    const activeCount = Object.values(statuses).filter(s => s.status !== "na").length;
    if (activeCount > 0 && completedModules.length >= activeCount) {
      const t3 = setTimeout(() => {
        if (!feedbackFired.current) { feedbackFired.current = true; setFeedbackOpen(true); posthog.capture("feedback_modal_shown", { trigger: "completion" }); }
      }, 3000);
      return () => clearTimeout(t3);
    }
  }, [completedModules]);

  function openModule(key, from, section) {
    setActiveModule(key);
    setActiveSection(section || null);
    setPrevScreen(from || screen);
    setScreen("moduleDeepDive");
    posthog.capture("module_opened", { module_key: key, from });
    setTimeout(() => {
      const appEl = document.getElementById("candid-app");
      if (appEl) appEl.scrollIntoView({ behavior: "instant", block: "start" });
    }, 0);
  }
  function markModuleComplete(key) {
    setCompletedModules(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      if (!prev.includes(key)) {
        posthog.capture("module_completed", { module_key: key, total_completed: next.length });
        supaUpdate({ modules_completed: next.length });
        const delta = moduleScoreDelta(statuses[key]?.status);
        if (delta > 0) {
          setScoreDeltas(sd => [...sd, { key, delta, timestamp: Date.now() }]);
          setLastScoreDelta(delta);
          setLastCompletedModule(key);
          setShowScorePulse(true);
          setTimeout(() => setShowScorePulse(false), 2500);
        }
      } else {
        // Unmark: remove that module's delta from the running total
        setScoreDeltas(sd => sd.filter(s => s.key !== key));
      }
      return next;
    });
  }

  async function callClaude(prompt, maxTokens=1200) {
  // TEMPORARY diagnostic — unconditional (not DEV-gated) so it shows in production.
  // Remove once the empty-Vercel-log mystery is root-caused.
  console.log("[Candid][DIAG] callClaude() entered — about to fetch /api/claude", { promptLength: prompt.length, maxTokens });
  const timeout = new Promise((_,reject) => setTimeout(() => reject(new Error("timeout")), 28000));
  const call = fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:maxTokens,messages:[{role:"user",content:prompt}]})
  });
  const res = await Promise.race([call, timeout]);
  console.log("[Candid][DIAG] fetch /api/claude responded — status:", res.status);
  const json = await res.json();
  console.log("[Candid][DIAG] response JSON keys:", Object.keys(json), json.error ? { error: json.error } : {});
  const raw = (json.content?.[0]?.text||"").replace(/```json|```/g,"").trim();
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("[Candid][DIAG] Claude returned malformed JSON — falling back. Raw text:", raw);
    throw new Error("Claude response was truncated or malformed");
  }
}

  async function generateDashboard() {
    // TEMPORARY diagnostic — unconditional. Remove once root-caused.
    console.log("[Candid][DIAG] generateDashboard() entered");
    if (insights) { setPrevInsights(insights); prevScoreRef.current = insights.score; }
    setScreen("loading");

    // ── Reuse the metrics/statuses already computed for this render — no need to recalculate ──
    const metrics = m;
    const isaPrev = (+d.isaPrevCash||0)+(+d.isaPrevSS||0)+(+d.isaPrevLISA||0)+(+d.isaPrevOther||0);
    const totalOppForSummary = Object.entries(statuses).reduce((sum, [,v]) => sum + Math.min(v.impact||0, 99998), 0);
    console.log("[Candid][DIAG] metrics/statuses in scope:", { hasMetrics: !!metrics, hasStatuses: !!statuses, isaPrev, totalOppForSummary });

    const financialSummary = {
      name: d.name || "User",
      age: +d.age || null,

      // Income
      grossSalary: fmt(+d.salary||0),
      adjustedNetIncome: fmt(metrics.adjustedNetIncome||0),
      taxBand: metrics.tr >= 0.45 ? "Additional rate (45%)" : metrics.tr === 0.40 ? "Higher rate (40%)" : metrics.adjustedNetIncome > 100000 ? "60% taper zone (£100k–£125,140)" : "Basic rate (20%)",
      otherIncome: +d.otherIncome > 0 ? fmt(+d.otherIncome) : null,
      dividendIncome: +d.dividendIncome > 0 ? fmt(+d.dividendIncome) : null,
      bonusAmount: +d.bonusAmount > 0 ? fmt(+d.bonusAmount) : null,

      // Cash
      cashSavings: fmt(metrics.cash||0),
      premiumBonds: fmt(+d.premiumBonds||0),
      totalLiquid: fmt(metrics.totalLiquid||0),
      monthlyExpenses: fmt(metrics.expenses||0),
      runwayMonths: +metrics.runwayMonths.toFixed(1),
      emergencyStatus: metrics.emergencyFund >= metrics.emergencyBuffer
        ? `Adequate (${metrics.runwayMonths.toFixed(1)} months)`
        : `Shortfall of ${fmt(metrics.emergencyBuffer - metrics.emergencyFund)}`,
      effectiveSavingsRate: metrics.effectiveSavingsRate.toFixed(2) + "%",
      annualYieldGap: fmt(Math.round(metrics.annualYieldGap||0)),

      // ISA
      isaUsedThisYear: fmt(metrics.isaUsedThisYear||0),
      isaHeadroom: fmt(metrics.isaHeadroom||0),
      isaPreviousBalance: isaPrev > 0 ? fmt(isaPrev) : null,

      // Investments
      hasInvestments: d.hasInvestments === "yes",
      unwrappedValue: +d.unwrappedValue > 0 ? fmt(+d.unwrappedValue) : null,
      unrealisedGains: +d.unrealisedGains > 0 ? fmt(+d.unrealisedGains) : null,
      cgtSaving: metrics.cgtSaving > 0 ? fmt(Math.round(metrics.cgtSaving)) : null,

      // Pension
      pensionContributing: isPensionContributing(d),
      myContributionPct: isPensionContributing(d) ? (+d.myContribution||0) + "%" : null,
      employerMatchCap: (+d.employerMatch||0) + "%",
      missedMatchAnnual: metrics.missedMatch > 0 ? fmt(Math.round(metrics.missedMatch)) + "/yr" : "None",
      pensionPot: (+d.potValue||0) + (+d.potValue2||0) > 0 ? fmt((+d.potValue||0)+(+d.potValue2||0)) : null,
      projectedPotAtRetirement: fmt(Math.round(metrics.projectedPot||0)),
      retirementAge: +d.retirementAge||65,
      pensionReturnRatio: "1:" + pensionReturnRatio(d, metrics).toFixed(2),
      pensionType: d.pensionType === "sacrifice" ? "Salary sacrifice" : d.pensionType === "relief" ? "Relief at source" : "Unknown",

      // Student loan
      studentLoan: d.studentLoan !== "none" ? {
        plan: d.studentLoan,
        balance: fmt(+d.loanBalance||0),
        annualRepayment: fmt(Math.round(metrics.annualRepayment||0)),
        willClear: metrics.willClear ? "Yes — before write-off" : "No — likely written off",
      } : null,

      // Mortgage
      mortgage: d.hasMortgage === "yes" ? {
        balance: fmt(+d.mortgageBalance||0),
        rate: (+d.mortgageRate||0) + "%",
        monthlyPayment: fmt(+d.monthlyMortgage||0),
        daysToFixExpiry: metrics.daysToFixExpiry || null,
      } : null,

      // Personal loan
      personalLoan: d.hasPersonalLoan === "yes" ? {
        balance: fmt(+d.personalLoanBalance||0),
        rate: (+d.personalLoanRate||0) + "%",
      } : null,

      // Kids
      kids: d.hasKids === "yes" ? {
        numKids: d.numKids,
        ages: d.kidsAges,
        hasJISA: d.hasJISA === "yes",
        jisaValue: d.hasJISA === "yes" ? fmt(+d.juniorISAValue||0) : null,
      } : null,

      // Net worth
      netWorth: fmt(metrics.netWorth||0),
      totalAssets: fmt(metrics.totalAssets||0),
      totalLiabilities: fmt(metrics.totalLiabilities||0),

      // Pre-calculated module statuses — Claude uses these, does not recalculate
      moduleStatuses: Object.fromEntries(
        Object.entries(statuses).map(([key, s]) => [key, {
          status: s.status,
          impact: s.impact > 0 ? fmt(Math.min(s.impact, 99998)) : null,
          impactLabel: s.impactLabel || null,
        }])
      ),

      totalOpportunity: fmt(Math.round(totalOppForSummary / 100) * 100),
    };

    if (import.meta.env.DEV) {
      console.log("Metrics sent to Claude:", financialSummary);
    }

    const prompt = `You are Candid, a UK personal finance guidance tool. A user has completed their financial health assessment. Below are their pre-calculated financial metrics. Your job is to generate a personalised financial health report based ONLY on these figures — do not recalculate or re-derive any numbers.

USER FINANCIAL SUMMARY:
${JSON.stringify(financialSummary, null, 2)}

Generate a JSON response with exactly this structure:
{"score":<integer 0-100 based on moduleStatuses>,"headline":"<one punchy sentence: the single most important thing to address>","narrative":"<2-3 sentences of personalised narrative using specific figures from the summary. Use first name if provided. Tone: direct, like a knowledgeable friend.>","priorities":[{"title":"<max 6 words>","impact":"<£ figure>","description":"<1-2 sentences explaining why this matters for this specific person>","urgency":"<immediate|soon|this tax year>","module":"<cash|investments|pension|studentLoan|mortgage|personalLoan|kids|inheritance>"}],"modules":{"cash":{"status":"<ok|attention|critical>","summary":"<one sentence>"},"investments":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"},"pension":{"status":"<ok|attention|critical>","summary":"<one sentence>"},"studentLoan":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"},"mortgage":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"},"personalLoan":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"},"kids":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"}}}

Rules:
- Use ONLY the figures in the summary above. Do not invent or recalculate numbers.
- If a module has status "na" in moduleStatuses, set its status to "na" and summary to "Not applicable based on your inputs."
- Pension summary MUST reflect pensionContributing: ${financialSummary.pensionContributing} — never say "no contributions" or "start contributing" if pensionContributing is true.
- Priorities ordered by urgency then impact. Maximum 4 priorities. No insurance priorities.
- Module summaries must be direct and specific, not hedgy — cite the actual £ figure from the summary above (e.g. "£8,000 of unused ISA allowance") rather than vague phrasing like "may not be fully utilised".
- Score should correlate with moduleStatuses: each critical module reduces score significantly.
- Write in British English. Do not use "silently", "quietly", or "invisible".
- Return valid JSON only. No preamble, no markdown, no backticks.`;

    const fallback = {
      isFallback:true,
      score:46, headline:"You're leaving meaningful money on the table — but it's all fixable.",
      narrative:`${d.name?d.name.split(" ")[0]:""}, your finances have a solid foundation with clear optimisation gaps. The pension and ISA opportunities alone could significantly boost your long-term wealth.`,
      priorities:[
        {title:"Review your pension contributions",impact:"£3,000+",description:"Tax relief plus employer match means a £100 contribution costs ~£80 in take-home. Higher-rate taxpayers get even more back.",urgency:"immediate"},
        {title:"Maximise ISA allowance before April",impact:"£800+",description:"You have unused ISA allowance expiring April 5th. Moving surplus cash protects all future growth from tax permanently.",urgency:"this tax year"},
        {title:"Review student loan strategy",impact:"Varies",description:"Most Plan 2/5 borrowers won't clear before write-off. That money works harder in a pension.",urgency:"soon"},
      ],
      modules:{
        cash:{status:"attention",summary:"Cash position looks reasonable but yield could be higher."},
        investments:{status:"attention",summary: metrics.isaHeadroom > 0
          ? `You have ${fmt(metrics.isaHeadroom)} of unused ISA allowance this tax year — shelter it before April 5th or lose it for good.`
          : "Your ISA allowance is fully used this tax year — well done."},
        pension:{status:"attention",summary:"Review your pension contributions and projected retirement pot."},
        studentLoan:{status:"attention",summary:"Overpayment strategy worth reviewing at your income level."},
        mortgage:{status:"na",summary:"Not applicable based on your inputs."},
        personalLoan:{status:"na",summary:"Not applicable based on your inputs."},
        kids:{status:"na",summary:"Not applicable based on your inputs."},
      }
    };
    console.log("[Candid][DIAG] financialSummary/prompt/fallback built OK — about to call callClaude()");
    try {
      const result = await callClaude(prompt, 1400);
      setInsights(result);
      try {
        localStorage.setItem('candid_insights', JSON.stringify(result));
        localStorage.setItem('candid_insights_date', new Date().toISOString());
      } catch(e) { if (import.meta.env.DEV) console.warn("[Candid] Failed to persist insights to localStorage:", e); }
      setWhatChangedOpen(true);
      posthog.capture("report_generated", { score: result.score, tax_band: metrics.taxBandLabel });
      // ── Supabase insert — reuse pre-computed statuses ──
      const criticals = Object.entries(statuses).filter(([,v]) => v.status === "critical").map(([k]) => k).join(",");
      const totalOpp = totalOppForSummary;
      // test table requires columns: email (text), name (text), interests (text) — all nullable
      if (import.meta.env.DEV) {
        console.log("[Candid] Supabase insert starting — score:", result.score, "session:", posthog.get_distinct_id?.());
      }
      const rowId = await supaInsert("test", {
        session_id: posthog.get_distinct_id?.() || null,
        email: d.email || null,
        name: d.name || null,
        interests: (d.interests || []).join(", ") || null,
        age: +d.age||null,
        salary: +d.salary||null,
        other_income: +d.otherIncome||null,
        tax_band: metrics.taxBandLabel,
        salary_trajectory: d.salaryTrajectory||null,
        monthly_expenses: +d.monthlyExpenses||null,
        cash_savings: +d.cashSavings||null,
        savings_rate: +d.savingsRate||null,
        premium_bonds: +d.premiumBonds||null,
        has_investments: d.hasInvestments === "yes",
        isa_this_year: metrics.isaUsedThisYear||null,
        isa_previous: (+d.isaPrevCash||0)+(+d.isaPrevSS||0)+(+d.isaPrevLISA||0)+(+d.isaPrevOther||0)||null,
        isa_type: d.isaType||null,
        unwrapped_investments: +d.unwrappedValue||null,
        has_pension: d.hasPension === "yes",
        pension_my_pct: +d.myContribution||null,
        pension_employer_pct: +d.employerMatch||null,
        pension_pot: +d.potValue||null,
        retirement_age: +d.retirementAge||null,
        has_student_loan: d.studentLoan !== "none",
        student_loan_plan: d.studentLoan !== "none" ? d.studentLoan : null,
        student_loan_balance: +d.loanBalance||null,
        has_mortgage: d.hasMortgage === "yes",
        mortgage_balance: +d.mortgageBalance||null,
        mortgage_rate: +d.mortgageRate||null,
        mortgage_provider: d.mortgageProvider||null,
        has_personal_loan: d.hasPersonalLoan === "yes",
        personal_loan_balance: +d.personalLoanBalance||null,
        personal_loan_rate: +d.personalLoanRate||null,
        personal_loan_provider: d.personalLoanProvider||null,
        has_bonus: d.hasBonus === "yes",
        bonus_amount: +d.bonusAmount||null,
        has_kids: d.hasKids === "yes",
        num_kids: +d.numKids||null,
        candid_score: result.score,
        total_opportunity_gbp: Math.round(totalOpp / 100) * 100,
        critical_modules: criticals,
        modules_completed: 0,
        feedback_submitted: false,
      });
      if (import.meta.env.DEV) {
        console.log("[Candid] Supabase insert complete — rowId:", rowId, "SUPA_URL set:", !!SUPA_URL, "SUPA_KEY set:", !!SUPA_KEY);
      }
      if (rowId) supaRowId.current = rowId;
    }
    catch(e) {
      // TEMPORARY diagnostic — unconditional, full error + stack. Remove once root-caused.
      console.error("[Candid][DIAG] generateDashboard() caught an error — falling back:", e?.message, "\nstack:", e?.stack, "\nfull error object:", e);
      setInsights(fallback);
      try {
        localStorage.setItem('candid_insights', JSON.stringify(fallback));
        localStorage.setItem('candid_insights_date', new Date().toISOString());
      } catch(e) { if (import.meta.env.DEV) console.warn("[Candid] Failed to persist fallback insights to localStorage:", e); }
      posthog.capture("report_generated", { score: fallback.score, fallback: true, error: e?.message });
      // Dedicated event (distinct from report_generated's fallback:true flag) so this
      // failure mode is directly filterable/alertable in PostHog without needing to
      // know to filter report_generated by fallback — this is what silently masked
      // the AI-generation failure that led to this whole investigation.
      posthog.capture("ai_generation_failed", {
        error_message: e?.message || "unknown",
        error_name: e?.name || null,
        fallback_served: "static_generic_fallback",
      });
    }
    finally { setScreen("dashboard"); }
  }

  function resetAll() {
    onGoHome();
  }

  function clearSavedData() {
    localStorage.removeItem('candid_inputs');
    setD(BLANK_DATA);
    setInsights(null);
    setStep(0);
    setScreen("onboarding");
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ── Router ──
  if (screen === "onboarding") return (
    <OnboardingScreen step={step} steps={STEPS} d={d} set={set} insights={insights}
      onBack={() => step>0 ? setStep(s=>s-1) : onGoHome()}
      onBackToDashboard={() => setScreen("dashboard")}
      onStepClick={i => setStep(i)}
      onClearData={clearSavedData}
      onContinue={() => {
        posthog.capture("onboarding_step_completed", { step: step + 1, step_name: STEPS[step] });
        step<STEPS.length-1 ? setStep(s=>s+1) : generateDashboard();
      }}
    />
  );

  if (screen === "loading") return <LoadingScreen name={d.name} msgs={["Analysing your cash position...","Calculating pension tax relief...","Reviewing ISA headroom...","Modelling your student loan...","Building your Candid report..."]}/>;

  if (screen === "dashboard") return (
    <>
      <Dashboard insights={insights} d={d} m={m} statuses={statuses} savingsRates={savingsRates} onReset={resetAll} completedModules={completedModules}
        onOpenModule={key => openModule(key, "dashboard")}
        onEditInputs={() => { setStep(0); setScreen("onboarding"); }}
        prevInsights={prevInsights} whatChangedOpen={whatChangedOpen} onDismissWhatChanged={() => setWhatChangedOpen(false)}
        showScorePulse={showScorePulse} lastScoreDelta={lastScoreDelta} lastCompletedModule={lastCompletedModule}
        prevScoreRef={prevScoreRef} scoreDeltas={scoreDeltas}/>
      {pdfModalOpen && <PdfReportModal email={d.email} insights={insights} d={d} onDismiss={() => setPdfModalOpen(false)} />}
      {feedbackOpen && <FeedbackModal onDismiss={() => setFeedbackOpen(false)} />}
    </>
  );

  if (screen === "moduleDeepDive") {
    const localStatuses = statuses;
    const statusOrder = { critical:0, attention:1, ok:2, na:3 };
    const allMods = MODULE_META.map(mm => {
      const local = localStatuses[mm.key] || { status:"na", impact:0 };
      const aiMod = insights?.modules?.[mm.key];
      // Use same logic as Dashboard — local always wins for pension/personalLoan
      const status = (mm.key === "pension" || mm.key === "personalLoan")
        ? local.status
        : (aiMod?.status && aiMod.status !== "na") ? aiMod.status : local.status;
      return { ...mm, status, impact: local.impact||0 };
    }).filter(mm => mm.status !== "na");
    const sortedMods = [...allMods].sort((a,b) => {
      const aDone = completedModules.includes(a.key) ? 1 : 0;
      const bDone = completedModules.includes(b.key) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const sd = (statusOrder[a.status]||3) - (statusOrder[b.status]||3);
      return sd !== 0 ? sd : b.impact - a.impact;
    });
    // Find the next module: highest-priority unreviewed module that isn't the current one.
    // Do NOT slice from currentIdx — after marking reviewed the current module moves to the
    // bottom of sortedMods, which would make slice return empty and lose the button.
    const nextMod = sortedMods.find(mm => mm.key !== activeModule && !completedModules.includes(mm.key)) || null;
    return (
      <>
        <ModuleDeepDive moduleKey={activeModule} insights={insights} d={d} m={m} statuses={statuses} savingsRates={savingsRates}
          openSection={activeSection}
          goBack={() => setScreen("dashboard")}
          goToDashboard={() => setScreen("dashboard")}
          onComplete={() => markModuleComplete(activeModule)}
          isComplete={completedModules.includes(activeModule)}
          onOpenModule={(key, section) => openModule(key, "moduleDeepDive", section)}
          nextModule={nextMod}/>
        {feedbackOpen && <FeedbackModal onDismiss={() => setFeedbackOpen(false)} />}
      </>
    );
  }

  return null;
}
