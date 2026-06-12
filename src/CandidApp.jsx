import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import posthog from "posthog-js";

// ── Supabase client — module level, no package needed ─────────────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
    return Array.isArray(data) && data[0]?.id ? data[0].id : null;
  } catch(e) {
    if (import.meta.env.DEV) console.warn(`[Candid] Supabase insert into "${table}" failed:`, e);
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

const G = "#162f24", GOLD = "#c4963a", CREAM = "#f6f0e6", CDARK = "#ede7db",
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
function fmt(n) {
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
function simulateLoan(openingBalance, annualSalary, salaryGrowthRate, interestRate, repaymentThreshold, repaymentRate, maxYears = 30) {
  let balance = openingBalance;
  let salary = annualSalary;
  let totalInterest = 0;
  let totalPaid = 0;
  const monthlyRate = interestRate / 12;
  for (let month = 0; month < maxYears * 12; month++) {
    if (balance <= 0) break;
    const interest = balance * monthlyRate;
    balance += interest;
    totalInterest += interest;
    const annualRepayment = Math.max(0, (salary - repaymentThreshold) * repaymentRate);
    const monthlyRepayment = annualRepayment / 12;
    const payment = Math.min(monthlyRepayment, balance);
    balance -= payment;
    totalPaid += payment;
    if ((month + 1) % 12 === 0) salary *= (1 + salaryGrowthRate);
  }
  return { totalInterest: Math.round(totalInterest), totalPaid: Math.round(totalPaid), cleared: balance <= 0 };
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

function calcMetrics(d) {
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
    // Project with salary growth: will compound salary clear the loan within 30 years?
    willClear = (() => { let b = loanBal; for (let y=1; y<=30; y++) { const s = salary * Math.pow(1+slGrow,y); b = b*(1.054) - Math.max(0,(s-27295)*0.09); if(b<=0) return true; } return false; })();
  } else if (d.studentLoan === "plan5") {
    annualRepayment = Math.max(0, (salary - 25000) * 0.09);
    willClear = (() => { let b = loanBal; for (let y=1; y<=40; y++) { const s = salary * Math.pow(1+slGrow,y); b = b*(1.073) - Math.max(0,(s-25000)*0.09); if(b<=0) return true; } return false; })();
  } else if (d.studentLoan === "plan1") {
    annualRepayment = Math.max(0, (salary - 24990) * 0.09);
    willClear = (() => { let b = loanBal; for (let y=1; y<=25; y++) { const s = salary * Math.pow(1+slGrow,y); b = b*(1.050) - Math.max(0,(s-24990)*0.09); if(b<=0) return true; } return false; })();
  }
  const otherIncome = +d.otherIncome||0;
  const dividendIncome = +d.dividendIncome||0;
  const pensionSacrifice = salary * myPct / 100;
  const adjustedNetIncome = salary + otherIncome + dividendIncome - pensionSacrifice;
  const tr = adjustedNetIncome > 125140 ? 0.45
           : adjustedNetIncome > 50270  ? 0.40
           : 0.20;
  const taxBandLabel = adjustedNetIncome > 125140 ? "additional" : adjustedNetIncome > 50270 ? "higher" : "basic";
  const gains = +d.unrealisedGains||0, crystallisable = Math.min(gains, 3000),
        cgtRate = tr !== 0.20 ? 0.20 : 0.10,
        cgtSaving = crystallisable * cgtRate,
        savingsRate = effectiveSavingsRate,
        annualYieldGap = emergencyFund * (5.1 - savingsRate) / 100;
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
  const totalLiabilities = loanBal + (hasMortgage ? (+d.mortgageBalance||0) : 0) + (d.hasPersonalLoan === "yes" ? (+d.personalLoanBalance||0) : 0);
  const netWorth = totalAssets - totalLiabilities;
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
  return {
    salary, expenses, totalLiquid, runwayMonths,
    emergencyFund, emergencyBuffer, emergencyShortfall, emergencyExcess, surplusCash,
    isaHeadroom, isaUsedThisYear: isaUsedThisYearCalc,
    missedMatch, annualRepayment, willClear, crystallisable, cgtSaving,
    projectedPot, years, annualYieldGap, savingsRate, loanBal, tr,
    cash, bonds, totalAssets, totalLiabilities, netWorth,
    taxBandLabel, adjustedNetIncome, bufferMonths,
    statePensionWeekly, statePensionAnnual, niYearsToFull,
    daysToFixExpiry, effectiveSavingsRate, salaryGrowthRate,
    propertyEquity, propertyValue, ltv,
    pensionStatus, personalLoanAnnualRepayment, personalLoanPayoffMonths,
  };
}

// ── Premium Bond Context Aware Surfacing ──────────────────────────────────────────
function isNearPremiumBondDraw() {
  const day = new Date().getDate()
  return day >= 29 || day <= 2
}

// ── Module product + insight config ──────────────────────────────────────────

function getModuleInsights(key, d, m) {
  const name = d.name ? d.name.split(" ")[0] : "You";
  switch (key) {
    case "cash": {
      const gap = m.annualYieldGap;
      const cashRate = +d.savingsRate || 3.5;
      const bestISARate = 5.08;
      const totalCash = m.cash + m.bonds;
      return [
        {
          label:"Current yield gap vs best Cash ISA", value: gap > 0 ? fmt(gap)+"/yr" : "None", flag: gap > 200,
          tooltip:`Gap = your cash (${fmt(totalCash)}) × your rate (${cashRate}%) vs best Cash ISA (${bestISARate}%). Annual difference: ${fmt(gap)}. Moving your surplus to a Cash ISA at ${bestISARate}% would close this.`
        },
        {
          label:"Cash runway", value: m.runwayMonths.toFixed(1)+" months", flag: m.runwayMonths > m.bufferMonths * 2 || m.runwayMonths < m.bufferMonths,
          tooltip:`Runway = total liquid assets (${fmt(m.totalLiquid)}) ÷ monthly expenses (${fmt(m.expenses)}). Your target buffer is ${m.bufferMonths} months. Yours is ${m.runwayMonths > m.bufferMonths * 2 ? "well above — consider putting surplus to work" : m.runwayMonths < m.bufferMonths ? "below your target — build this up before investing" : "in the ideal range"}.`
        },
        {
          label:"ISA allowance remaining", value: fmt(m.isaHeadroom), flag: m.isaHeadroom > 5000,
          tooltip:`You can deposit up to £20,000 per tax year into ISAs (any combination of Cash and Stocks & Shares). You've used ${fmt(20000 - m.isaHeadroom)} so far this tax year. Allowance resets on 6 April — unused allowance cannot be carried forward.`
        },
        {
          label:"Premium bonds held", value: fmt(m.bonds), flag: m.bonds > 0,
          tooltip:`Premium bonds are government-backed savings (via NS&I). Returns come as monthly tax-free prize draws at ~4.4% average rate. No guaranteed return — all winnings are tax-free, which makes them attractive if your savings interest exceeds your Personal Savings Allowance (£${m.taxBandLabel==="basic"?"1,000":m.taxBandLabel==="higher"?"500":"0"} for your tax band).`
        },
      ];
    }
    case "investments": {
      const unwrapped = +d.unwrappedValue||0;
      const gains = m.crystallisable;
      const cgtRate = m.tr !== 0.20 ? 0.20 : 0.10;
      // What CGT would cost if gains NOT crystallised and exceed £3k next year
      const gainsAbove3k = Math.max(0, (+d.unrealisedGains||0) - 3000);
      const futureCgtIfUnused = Math.round(gainsAbove3k * cgtRate);
      // Compound illustration: £12k ISA per year for 10 years at 7%
      const isaCompoundEx = Math.round(12000 * ((Math.pow(1.07,10)-1)/0.07));
      return [
        {
          label:"ISA allowance remaining", value: fmt(m.isaHeadroom), flag: m.isaHeadroom > 2000,
          tooltip:`🔒 ISA = tax-free for life. Every £ inside an ISA grows completely free of income tax, dividend tax, and CGT — forever. Your ${fmt(m.isaHeadroom)} of remaining allowance expires on 5 April and CANNOT be carried forward. Example: £12,000/yr invested inside an ISA for 10 years at 7% grows to ~${fmt(isaCompoundEx)} with zero tax due on gains or income, ever. Outside an ISA, you'd owe tax on every dividend and every gain above £3,000.`
        },
        {
          label:"Unwrapped investments", value: unwrapped > 0 ? fmt(unwrapped) : "None", flag: unwrapped > 0,
          tooltip:`${fmt(unwrapped)} sits outside an ISA or pension wrapper — exposed to CGT on any gains and income tax on dividends. Consider a Bed & ISA: sell the holding, immediately repurchase inside your ISA, and all future gains are tax-free. You can move up to ${fmt(m.isaHeadroom)} this tax year before your allowance expires.`
        },
        {
          label:"Crystallisable CGT gain (within £3k exempt)", value: gains > 0 ? fmt(gains) : "—", flag: gains > 0,
          tooltip:`USE IT OR LOSE IT — the £3,000 CGT annual exempt amount does not carry forward. If you don't use it this tax year, it is permanently gone.\n\nYou can sell enough to realise up to ${fmt(gains)} of gain right now — completely tax-free. You can then repurchase the same assets after 30 days (bed & breakfasting rules) or buy something similar immediately.\n\nIf you don't crystallise this year and your gains grow: next year you'd owe CGT on everything above £3,000. At your rate (${Math.round(cgtRate*100)}%), a ${fmt((+d.unrealisedGains||0))} gain would cost ${fmt(futureCgtIfUnused)} in CGT on the portion above the exempt amount. Doing this every year is one of the most consistently overlooked tax-saving habits.`
        },
        {
          label:"CGT saving if crystallised now", value: gains > 0 ? fmt(m.cgtSaving)+" this year" : "—", flag: gains > 0,
          tooltip:`By realising ${fmt(gains)} of gain within the annual exempt amount, you pay zero CGT today. If left unrealised and the gain grows further, the tax owed grows too — and you still only get one £3,000 exemption per year. Acting now locks in today's tax-free treatment and resets your cost basis upward.`
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
      // SL interest rates (simplified — Plan 2 higher earners RPI+3%, Plan 5 RPI+4%, Plan 1 ~5%)
      const slInterestRate = d.studentLoan==="plan2" ? (m.salary > 49130 ? 0.075 : 0.054)
        : d.studentLoan==="plan5" ? 0.073
        : 0.050;
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

function getModuleProducts(key, d, m) {
  switch (key) {
    case "cash":
      return {
        heading: "Best easy-access Cash ISAs right now",
        subheading: m.isaHeadroom > 0
          ? `You have ${fmt(m.isaHeadroom)} of ISA allowance remaining — any interest earned inside an ISA is tax-free, permanently.`
          : "Your ISA allowance is fully used this year. Consider a high-interest easy-access account for remaining cash.",
        products: [
          { name:"Trading 212", type:"Cash ISA", rate:"5.08% AER", badge:"Highest rate", feature:"Flexible ISA — withdraw and replace within the same tax year", cta:"Open Cash ISA", highlight:true },
          { name:"Plum",         type:"Cash ISA", rate:"4.92% AER", badge:"",             feature:"App-based, instant access, no minimum deposit", cta:"Open Cash ISA", highlight:false },
          { name:"Chip",         type:"Cash ISA", rate:"4.84% AER", badge:"",             feature:"FSCS protected, instant access, auto-save features", cta:"Open Cash ISA", highlight:false },
          { name:"Chase",        type:"Easy access", rate:"4.10% AER", badge:"High street", feature:"No ISA wrapper but highly rated for ease of use", cta:"View account", highlight:false },
        ],
        disclaimer:"Rates are indicative as of early 2026 and subject to change. Candid may earn a referral fee if you open an account via these links — this does not affect our ranking."
      };
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
      return {
        heading: m.isaHeadroom > 0 ? `You have ${fmt(m.isaHeadroom)} of TAX-FREE ISA allowance left` : "Your ISA allowance is fully used — well done",
        subheading: m.isaHeadroom > 0
          ? `${urgencyMsg} Once it expires, it's gone forever — you can't bank it for next year. Every £ inside an ISA is completely free of CGT and income tax for life. This is the single most efficient personal finance decision most people never fully use.`
          : `You've used your full £20,000 ISA allowance this tax year. New allowance opens on April 6th. If you have unwrapped investments, consider a Bed & ISA strategy next tax year.`,
        products: [
          { name:"Vanguard",      type:"S&S ISA", rate:"0.15%/yr", badge:"Lowest cost",       feature:"Index fund specialist. Best for low-cost, long-term investors. No dealing fees on funds.", cta:"Open S&S ISA", highlight:true },
          { name:"Hargreaves Lansdown", type:"S&S ISA", rate:"0.45%/yr", badge:"Widest range",feature:"15,000+ funds, shares, ETFs. Best platform for active investors and fund switchers.", cta:"Open S&S ISA", highlight:false },
          { name:"Trading 212",   type:"S&S ISA", rate:"0% commission", badge:"Commission-free",feature:"Fractional shares, no dealing fees, instant deposits. Good entry-level platform.", cta:"Open S&S ISA", highlight:false },
          { name:"InvestEngine",  type:"S&S ISA", rate:"0% platform fee", badge:"ETFs only",  feature:"Zero platform fees on ETF portfolios. Very competitive for passive investors.", cta:"Open S&S ISA", highlight:false },
        ],
        disclaimer:"Platform fees shown are indicative annual charges on equity holdings. Fund OCF costs are additional. Investments can fall as well as rise. Tax treatment depends on individual circumstances. Candid may earn a referral fee — this does not affect our ranking.",
        cgtSection: m.crystallisable > 0 ? {
          heading:"Crystallise your CGT exemption before April 5th",
          body:`You have an estimated ${fmt(m.crystallisable)} of unrealised gain that falls within the annual £3,000 CGT exempt amount — meaning you could realise it right now and pay zero tax. The 30-day bed & breakfasting rule means you can't immediately repurchase the identical holding in an unwrapped account, but you can: (1) repurchase inside your ISA immediately (Bed & ISA — the clean solution), or (2) wait 30 days and repurchase the same asset outside the ISA. Either way, you reset your cost basis upward and eliminate future CGT on those gains.`,
          warning:`The £3,000 annual exempt amount does not roll over. If unused, it is permanently lost on April 5th. And if your gains continue to grow next year, you'll owe ${Math.round(m.tr!==0.20?20:10)}% CGT on everything above £3,000 — with no way to reclaim this year's unused exemption.`
        } : null
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
      const slInterestRate = d.studentLoan==="plan2" ? (m.salary > 49130 ? 0.075 : 0.054)
        : d.studentLoan==="plan5" ? 0.073 : 0.050;
      const slRatePct = Math.round(slInterestRate * 1000) / 10;
      const writeOffYr = d.studentLoan==="plan2" ? 30 : d.studentLoan==="plan5" ? 40 : 25;
      const threshold = d.studentLoan==="plan2" ? 27295 : d.studentLoan==="plan5" ? 25000 : 24990;
      const annualInterest = Math.round(m.loanBal * slInterestRate);
      const annualRep = m.annualRepayment;
      const balanceGrowing = annualInterest > annualRep;
      const inflectionSalary = Math.round(threshold + (m.loanBal * slInterestRate) / 0.09);
      const cashRate = +d.savingsRate || 4.2;
      const effectiveBenefit = slInterestRate * 100 - cashRate; // benefit of overpaying vs holding cash (if clearing)
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
      // Ratio table — only meaningful if loan will clear
      const ratioAmounts = [1000, 2000, 5000, 10000, 20000, Math.round(m.loanBal)].filter((x,i,a) => x <= m.loanBal && a.indexOf(x)===i);
      const ratioTable = m.willClear ? ratioAmounts.map(amt => {
        const proj = projectLoan(amt);
        const basePaid = baseProjection.clearYr ? baseProjection.totalPaid : baseProjection.totalPaid;
        const interestSaved = Math.max(0, basePaid - proj.totalPaid);
        const totalBenefit = amt + interestSaved;
        const ratio = totalBenefit / amt;
        return { amt, interestSaved, totalBenefit, ratio };
      }) : null;
      return {
        heading: balanceGrowing
          ? "⚠️ Your loan balance is growing — not shrinking"
          : m.willClear ? "You will clear this loan — overpaying could save interest" : "Your loan will be written off — do not overpay",
        subheading: balanceGrowing
          ? `At ${slRatePct}% interest, your balance grows by ${fmt(annualInterest - annualRep)}/yr net. Your repayments (${fmt(annualRep)}/yr) are not keeping up with interest. This is an effective ${slRatePct}% surcharge on your income above the threshold — for as long as your balance keeps growing.`
          : m.willClear
          ? `Your repayments are outstripping interest. You'll clear the loan in ~${baseProjection.clearYr} years. Overpaying saves interest at ${slRatePct}% — compare that to your savings rate (${cashRate}%). Net benefit of overpaying vs saving: ${effectiveBenefit > 0 ? `+${Math.round(effectiveBenefit*10)/10}%` : "negative — save instead"}.`
          : `At ${slRatePct}% interest, overpaying this loan mostly reduces what gets written off — not what you repay. The better use of spare cash is almost certainly your pension or ISA.`,
        products: [
          { name:"Your pension", type:"Alternative use of funds", rate:`1:${pensionReturnRatio(d,m).toFixed(2)} return`, badge:"Best alternative", feature:`A pension contribution gives an immediate 1:${pensionReturnRatio(d,m).toFixed(2)} return via tax${d.pensionType==="sacrifice"?" and NI":""} relief. ${pensionReturnLabel(d,m)}. Even when the loan balance is growing, this outperforms the ${slRatePct}% loan rate for most people.`, cta:"Go to Pension", highlight:!m.willClear, internalLink:"pension" },
          { name:"Cash ISA", type:"Alternative use of funds", rate:`Up to 5.08% AER`, badge:"Tax-free", feature:`Your savings rate is ${cashRate}%. Net benefit of overpaying vs saving: ${effectiveBenefit > 0 ? `${Math.round(effectiveBenefit*10)/10}% in favour of overpaying` : "saving wins — keep cash in ISA"}.`, cta:"Go to Savings", highlight:false, internalLink:"cash" },
          { name:"Student Finance", type:"Official balance check", rate:"", badge:"Free", feature:"Verify your exact balance, interest rate and repayment history at studentfinance.service.gov.uk.", cta:"Check balance", highlight:false },
        ],
        disclaimer:"Interest rates are estimates based on current RPI and plan thresholds. Actual rates vary — check your SLC online account. This is guidance only. Consider speaking to an IFA before making large overpayments.",
        slSection: {
          balanceGrowing, inflectionSalary, slRatePct, scenarios,
          baseProjection, cashRate, writeOffYr, annualRep, annualInterest,
          effectiveBenefit: Math.round(effectiveBenefit * 10) / 10,
          cashSavings: m.cash + m.bonds,
          ratioTable, willClear: m.willClear,
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
  if (key === "cash" && m.isaHeadroom > 2000) {
    links.push({ icon:"📈", text:`You have ${fmt(m.isaHeadroom)} of ISA allowance remaining this tax year — surplus cash could be sheltered from tax permanently.`, label:"Explore in Investments", target:"investments" });
  }
  if (key === "cash" && d.hasPension !== "yes") {
    links.push({ icon:"🏦", text:"You have no pension — the tax relief on contributions will likely outperform any savings rate.", label:"Go to Pension", target:"pension" });
  }
  if (key === "investments" && m.surplusCash > 5000) {
    links.push({ icon:"💷", text:`You have ${fmt(m.surplusCash)} of surplus cash above your 6-month emergency fund. Consider moving some into your ISA.`, label:"Review in Savings", target:"cash" });
  }
  if (key === "pension" && (+d.bonusAmount||0) > 0) {
    links.push({ icon:"💰", text:`You receive a bonus of ~${fmt(+d.bonusAmount)}. Sacrificing some or all into your pension before it's paid saves both income tax and National Insurance.`, label:"Model bonus sacrifice", target:"pension", section:"bonusSacrifice" });
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
          flex:"1 1 auto", minWidth:"72px", padding:"10px 8px",
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

const STEP_SHORT_LABELS = ["Name","Email","Interests","Income","Savings","Invest.","Pension","Debt"];

function StepProgress({ step, steps, onStepClick, isEditMode }) {
  return (
    <div style={{background:WHITE,borderBottom:`1px solid ${CDARK}`,padding:"20px 24px",flexShrink:0}}>
      <div style={{maxWidth:"580px",margin:"0 auto",display:"flex",alignItems:"center"}}>
        {steps.map((label, i) => {
          const done = i < step;
          const current = i === step;
          const size = current ? 34 : 28;
          const clickable = (isEditMode || done) && !!onStepClick && i !== step;
          const shortLabel = STEP_SHORT_LABELS[i] || label;
          return (
            <div key={i} style={{display:"flex",alignItems:"center",flex: i < steps.length - 1 ? 1 : 0}}>
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
              {i < steps.length - 1 && (
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
  const [show, setShow] = useState(false);
  return (
    <span style={{position:"relative",display:"inline-block",marginLeft:"6px",verticalAlign:"middle"}}>
      <button type="button" onClick={e=>{e.stopPropagation();setShow(v=>!v)}}
        style={{width:"17px",height:"17px",borderRadius:"50%",background:G,border:"none",color:WHITE,fontSize:"10px",fontWeight:700,cursor:"pointer",lineHeight:1,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        ?
      </button>
      {show && (
        <div style={{position:"absolute",bottom:"24px",left:"50%",transform:"translateX(-50%)",width:"270px",background:G,color:WHITE,borderRadius:"10px",padding:"14px 16px",fontSize:"12px",lineHeight:1.65,zIndex:200,boxShadow:"0 8px 24px rgba(0,0,0,0.22)"}}>
          {text}
          <button type="button" onClick={e=>{e.stopPropagation();setShow(false)}} style={{position:"absolute",top:"8px",right:"10px",background:"transparent",border:"none",color:"rgba(255,255,255,0.5)",fontSize:"15px",cursor:"pointer",lineHeight:1}}>×</button>
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
      <p style={{fontSize:"13px",color:MUT,fontStyle:"italic",maxWidth:"480px",marginBottom:"28px",lineHeight:1.5}}>Helps us identify yield gaps and whether your cash is working as hard as it should be.</p>
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
      <Checkbox checked={!!d.pensionUnknown} onChange={v=>set("pensionUnknown",v)} label="I'm not sure / I don't have a pension set up"/>
      {d.pensionUnknown ? (
        <div style={{background:"rgba(22,47,36,0.04)",border:"1px solid rgba(22,47,36,0.12)",borderRadius:"10px",padding:"16px",marginTop:"4px"}}>
          <p style={{fontSize:"14px",color:G,lineHeight:1.6}}>No problem — this is really common. Your full report will walk you through exactly how to find out, and we won't hold it against your score.</p>
        </div>
      ) : (<>
      <Field label="Do you contribute to a pension?">
        <Toggle value={d.hasPension} onChange={v => set("hasPension",v)} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
      </Field>
      {d.hasPension === "yes" ? (
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
      </>)}
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
        <Field label="Outstanding balance (£)">
          <FmtInput fmtType="gbp" value={d.loanBalance} onChange={v=>set("loanBalance",capField("loanBalance",v))} placeholder="e.g. 35,000"/>
          <Warn msg={+d.loanBalance > 100000 ? "Very large loan balance — double-check" : null}/>
        </Field>
      )}
      <Checkbox checked={!!d.ownsOutright} onChange={v=>set("ownsOutright",v)} label="I own my home outright (no mortgage)"/>
      {d.ownsOutright ? (
        <Field label="Estimated value of your home (£)">
          <FmtInput fmtType="gbp" value={d.outrightPropertyValue||""} onChange={v=>set("outrightPropertyValue",v)} placeholder="e.g. 350,000"/>
        </Field>
      ) : (<>
      <Field label="Do you have a mortgage?">
        <Toggle value={d.hasMortgage} onChange={v => set("hasMortgage",v)} options={[{value:"yes",label:"Yes"},{value:"no",label:"Not yet"}]}/>
      </Field>
      {d.hasMortgage === "yes" && (
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
      </>)}
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

const SC = { ok:"#2d6b4a", attention:GOLD, critical:"#c0392b", na:MUT, unknown:MUT };
const SL = { ok:"On track", attention:"Review", critical:"Action needed", na:"N/A", unknown:"Find out" };
const UG = { immediate:"#c0392b", soon:GOLD, "this tax year":"#2d6b4a" };

const MODULE_META = [
  { key:"cash",        icon:"💷", title:"Cash & savings"  },
  { key:"investments", icon:"📈", title:"Investments"     },
  { key:"pension",     icon:"🏦", title:"Pension"         },
  { key:"studentLoan", icon:"🎓", title:"Student loan"    },
  { key:"mortgage",    icon:"🏠", title:"Mortgage"        },
  { key:"personalLoan",icon:"💳", title:"Personal loan"   },
  { key:"kids",        icon:"👶", title:"Kids & family"   },
];

function priorityModuleKey(title) {
  const t = (title||"").toLowerCase();
  if (t.includes("pension") || t.includes("sacrifice") || t.includes("contribution")) return "pension";
  if (t.includes("isa") || t.includes("invest") || t.includes("cgt") || t.includes("capital gains")) return "investments";
  if (t.includes("cash") || t.includes("saving") || t.includes("bond") || t.includes("rate")) return "cash";
  if (t.includes("student")) return "studentLoan";
  if (t.includes("personal loan") || t.includes("credit")) return "personalLoan";
  if (t.includes("mortgage") || t.includes("overpay")) return "mortgage";
  if (t.includes("kid") || t.includes("child") || t.includes("jisa") || t.includes("family")) return "kids";
  return "cash";
}

// ── Local module status computation ──────────────────────────────────────────
// Computes status + £ impact for all 8 modules from user data alone.
// AI response takes precedence for narrative summary; this drives sorting + visibility.
function computeModuleStatuses(d, m) {
  const daysToTaxEnd = (() => {
    const now = new Date(), taxEnd = new Date(now.getFullYear(), 3, 5);
    if (taxEnd < now) taxEnd.setFullYear(taxEnd.getFullYear() + 1);
    return Math.ceil((taxEnd - now) / (1000*60*60*24));
  })();
  const isaUrgencyBoost = daysToTaxEnd < 30 ? 3 : daysToTaxEnd < 90 ? 1.5 : 1;

  const s = {};

  // Cash — access type + yield gap + emergency buffer
  const cashImpact = Math.round(m.annualYieldGap + m.isaHeadroom * 0.05 * isaUrgencyBoost);
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
  // Premium bonds: surplus above emergency buffer could earn more in Cash ISA
  const bondsHeld = +d.premiumBonds||0;
  const bondsSurplus = Math.max(0, bondsHeld - m.emergencyBuffer);
  const bondsYieldGain = Math.round(bondsSurplus * (0.049 - 0.044));
  const hasBondOpportunity = bondsSurplus > 1000 && bondsYieldGain > 50;

  let cashImpactLabel;
  if (tooMuchCash) {
    cashImpactLabel = `${fmt(Math.round(m.emergencyExcess))}/yr earning below potential above buffer`;
  } else if (hasBondOpportunity) {
    cashImpactLabel = `${fmt(bondsYieldGain)}/yr by switching surplus bonds to Cash ISA`;
  } else if (accessLabel) {
    cashImpactLabel = accessLabel;
  } else if (cashImpact > 0) {
    cashImpactLabel = `${fmt(cashImpact)}/yr in yield gap vs best-buy rate`;
  } else {
    cashImpactLabel = null;
  }
  s.cash = {
    status: tooMuchCash || m.annualYieldGap > 800 ? "critical"
          : m.annualYieldGap > 200 || hasBondOpportunity || (genuinelyLowCash && accessType !== "yes") || (accessType === "no" && !accessOk) ? "attention" : "ok",
    impact: Math.max(cashImpact, hasBondOpportunity ? bondsYieldGain : 0),
    impactLabel: cashImpactLabel,
  };

  // Investments — ISA headroom × tax saving proxy + CGT saving
  const isaImpact = Math.round(m.isaHeadroom * 0.07 * m.tr * isaUrgencyBoost + m.cgtSaving);
  s.investments = {
    status: (m.isaHeadroom > 10000 && daysToTaxEnd < 60) ? "critical"
          : m.isaHeadroom > 2000 || m.cgtSaving > 0 ? "attention" : "ok",
    impact: isaImpact,
    impactLabel: isaImpact > 0 ? `${fmt(m.isaHeadroom)} ISA headroom` : null,
  };

// Pension — missed match + contribution check
const contributing = isPensionContributing(d);
const bonusSacrificeOpportunity = (+d.bonusAmount||0) * m.tr;
const pensionImpact = !contributing
  ? Math.round(m.salary * 0.05 * m.tr + m.missedMatch + 99999) // not contributing = highest priority sentinel
  : Math.round(m.missedMatch + bonusSacrificeOpportunity);

s.pension = m.pensionStatus === "unknown" ? {
  // User told us they don't know their pension situation — neutral/informational,
  // not a scored "missed opportunity"
  status: "unknown",
  impact: 0,
  impactLabel: null,
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
};

  // Student loan
  const slBalance = m.loanBal;
  const belowThreshold = d.studentLoan !== "none" && m.annualRepayment === 0;
  const slImpact = m.willClear ? Math.round(slBalance * 0.075 * 0.1) : 0;
  s.studentLoan = {
    status: d.studentLoan === "none" ? "na" : "attention",
    impact: slImpact,
    impactLabel: belowThreshold
      ? "Below repayment threshold — no deductions currently"
      : slBalance > 0 ? `${fmt(slBalance)} outstanding` : null,
    belowThreshold,
  };

  // Mortgage
  s.mortgage = {
    status: d.hasMortgage !== "yes" ? "na" : +d.mortgageRate > 4.5 ? "attention" : "ok",
    impact: d.hasMortgage === "yes" ? Math.round(+d.mortgageBalance * +d.mortgageRate / 100 * 0.05) : 0,
    impactLabel: d.hasMortgage === "yes" ? `${d.mortgageRate}% rate — ${+d.mortgageRate > 4.5 ? "above average" : "below average"}` : null,
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
  };

  return s;
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

function ActionPlanAccordion({ priorities, scenarioMap, currentScore, onOpenModule }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [impactIdx, setImpactIdx] = useState(null);
  return (
    <div className="fu1" style={{marginBottom:"24px"}}>
      <h2 style={{fontFamily:SERIF,fontSize:"26px",color:G,marginBottom:"4px",borderLeft:`4px solid ${GOLD}`,paddingLeft:"14px"}}>Your action plan</h2>
      <p style={{fontSize:"13px",color:MUT,marginBottom:"16px",paddingLeft:"18px"}}>Ranked by urgency — biggest financial wins first.</p>
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {priorities.map((p, i) => {
          const urgCol = UG[p.urgency] || MUT;
          const modKey = priorityModuleKey(p.title + " " + (p.description||""));
          const modMeta = MODULE_META.find(mm => mm.key === modKey);
          const scenario = scenarioMap[modKey];
          const isOpen = expandedIdx === i;
          const isImpactOpen = impactIdx === i;
          return (
            <div key={i} style={{background:WHITE,borderRadius:"12px",border:"1px solid rgba(22,47,36,0.09)",borderLeft:`4px solid ${urgCol}`,overflow:"hidden"}}>
              {/* Collapsed header — always visible */}
              <div
                onClick={() => { setExpandedIdx(isOpen ? null : i); setImpactIdx(null); }}
                style={{padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}
              >
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:urgCol,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"3px"}}>{p.urgency}</div>
                  <h3 style={{fontFamily:SERIF,fontSize:"17px",color:G,lineHeight:1.25,margin:0}}>{p.title}</h3>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"10px",flexShrink:0}}>
                  {p.impact && (
                    <div style={{background:GOLD,borderRadius:"7px",padding:"6px 12px",textAlign:"center"}}>
                      <div style={{fontSize:"17px",fontWeight:800,color:G,fontFamily:SERIF,lineHeight:1}}>{p.impact}</div>
                      <div style={{fontSize:"9px",color:"rgba(22,47,36,0.65)",fontWeight:600,marginTop:"1px"}}>potential saving</div>
                    </div>
                  )}
                  <span style={{fontSize:"18px",color:MUT,transition:"transform 0.2s",display:"inline-block",transform:isOpen?"rotate(90deg)":"none"}}>›</span>
                </div>
              </div>
              {/* Expanded body */}
              {isOpen && (
                <div style={{padding:"0 14px 12px",borderTop:"1px solid rgba(22,47,36,0.07)"}}>
                  <p style={{fontSize:"12px",color:MUT,lineHeight:1.65,margin:"12px 0 12px"}}>{p.description}</p>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                    {scenario && (
                      <button type="button"
                        onClick={e=>{e.stopPropagation();setImpactIdx(isImpactOpen?null:i);}}
                        style={{background:"transparent",border:`1.5px solid ${GOLD}`,borderRadius:"7px",padding:"7px 14px",color:GOLD,fontSize:"12px",fontWeight:700,cursor:"pointer"}}>
                        {isImpactOpen ? "Hide impact ↑" : "See the impact →"}
                      </button>
                    )}
                    {modMeta && (
                      <button type="button"
                        onClick={e=>{e.stopPropagation();onOpenModule(modKey);}}
                        style={{background:G,border:"none",borderRadius:"7px",padding:"7px 14px",color:WHITE,fontSize:"12px",fontWeight:700,cursor:"pointer"}}>
                        Go to {modMeta.title} →
                      </button>
                    )}
                  </div>
                  {isImpactOpen && scenario && (
                    <div style={{marginTop:"12px",background:"rgba(196,150,58,0.07)",border:`1px solid ${GOLD}`,borderRadius:"10px",padding:"14px 16px",display:"flex",flexWrap:"wrap",gap:"16px",alignItems:"center"}}>
                      <div style={{flex:1,minWidth:"160px"}}>
                        <p style={{fontSize:"12px",color:MUT,margin:0,lineHeight:1.5}}>{scenario.description}</p>
                      </div>
                      <div style={{display:"flex",gap:"18px",flexWrap:"wrap"}}>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontSize:"10px",color:MUT,marginBottom:"2px"}}>Financial impact</div>
                          <div style={{fontSize:"17px",fontWeight:700,color:GOLD}}>{scenario.impactLabel}</div>
                        </div>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontSize:"10px",color:MUT,marginBottom:"2px"}}>Score boost</div>
                          <div style={{fontSize:"17px",fontWeight:700,color:"#2d6b4a"}}>+{scenario.scoreBoost} pts</div>
                        </div>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontSize:"10px",color:MUT,marginBottom:"2px"}}>New score</div>
                          <div style={{fontSize:"17px",fontWeight:700,color:"#2d6b4a"}}>{Math.min(100, currentScore + scenario.scoreBoost)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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

function Dashboard({ insights, d, m, statuses, onReset, onOpenModule, completedModules, onEditInputs, prevInsights, whatChangedOpen, onDismissWhatChanged, showScorePulse, lastScoreDelta, lastCompletedModule, prevScoreRef, scoreDeltas }) {
  const totalDelta = (scoreDeltas||[]).reduce((sum, s) => sum + s.delta, 0);
  const displayScore = Math.min(100, (insights?.score || 0) + totalDelta);
  const [showAllModules, setShowAllModules] = useState(false);
  const [netWorthExpanded, setNetWorthExpanded] = useState(false);
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
    { label:"Mortgage", value: d.hasMortgage === "yes" ? (+d.mortgageBalance||0) : 0, icon:"🏠" },
    { label:"Student loan", value: m.loanBal||0, icon:"🎓" },
    { label:"Personal loan", value: d.hasPersonalLoan === "yes" ? (+d.personalLoanBalance||0) : 0, icon:"💳" },
  ].filter(l => l.value > 0);

  // Build merged module data: local computation provides status/impact, AI provides summary
  const localStatuses = statuses;
  const statusOrder = { critical:0, attention:1, ok:2, na:3 };

  const allModules = MODULE_META.map(mm => {
    const local = localStatuses[mm.key] || { status:"na", impact:0 };
    const aiMod = insights.modules?.[mm.key];
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
    return { ...mm, status, summary, impact, impactLabel: local.impactLabel };
  });

  const activeModules = allModules.filter(mm => mm.status !== "na");
  const sortedModules = [...activeModules].sort((a,b) => {
    const aDone = completedModules.includes(a.key) ? 1 : 0;
    const bDone = completedModules.includes(b.key) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone; // reviewed sink to bottom
    const statDiff = (statusOrder[a.status]||3) - (statusOrder[b.status]||3);
    if (statDiff !== 0) return statDiff;
    return b.impact - a.impact;
  });

  const unreviewedModules = sortedModules.filter(mm => !completedModules.includes(mm.key));
  const reviewedModules   = sortedModules.filter(mm =>  completedModules.includes(mm.key));

  const SHOW_DEFAULT = 3;
  const visibleUnreviewed = unreviewedModules.slice(0, SHOW_DEFAULT);
  const hiddenUnreviewed  = unreviewedModules.slice(SHOW_DEFAULT);
  const hiddenCount = hiddenUnreviewed.length;

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

        {/* Biggest win this week */}
        {(() => {
          const pensionFullyMatched = isPensionContributing(d) && m.missedMatch === 0 && !(+d.bonusAmount > 0);
          const topModule = activeModules
            .filter(mm => {
                  if (completedModules.includes(mm.key)) return false;
              if (mm.key === "pension" && (pensionFullyMatched || m.pensionStatus === "unknown")) return false;
              return true;
            })
            .sort((a,b) => b.impact - a.impact)[0];
          if (!topModule) return null;
          const directives = {
            pension: !isPensionContributing(d)
              ? `Start a pension today — every £${100-Math.round(m.tr*100)} you put in becomes £100 with ${Math.round(m.tr*100)}% tax relief.`
              : m.missedMatch > 0
                ? `Increase your pension to ${+d.employerMatch||0}% to capture your employer match — ${fmt(m.missedMatch)}/yr in free money.`
                : (+d.bonusAmount||0) > 0
                  ? `Sacrifice your bonus into your pension — saves up to ${fmt(Math.round((+d.bonusAmount||0)*m.tr))} in tax this year.`
                  : `Boost your pension by 1% — costs only ${fmt(Math.round(m.salary*0.01/12*(1-m.tr)))}/mo after ${Math.round(m.tr*100)}% tax relief.`,
            cash: m.emergencyFund > 0 && m.emergencyBuffer > 0 && m.emergencyFund > m.emergencyBuffer * 2
              ? `You're holding ${fmt(Math.round(m.emergencyExcess))} above your ${m.bufferMonths}-month buffer — move the excess to a 4.9% Cash ISA.`
              : m.annualYieldGap > 0
                ? `Move your cash to a Cash ISA at 4.9% — earns you ${fmt(Math.round(m.annualYieldGap))} more per year.`
                : `Review your savings rate — best-buy Cash ISAs are paying 4.9% AER right now.`,
            investments: `Use your remaining ${fmt(m.isaHeadroom)} ISA allowance before April 5th — shelters your gains from tax permanently.`,
            studentLoan: "Review your student loan strategy — your salary trajectory determines whether overpaying beats investing.",
            mortgage: d.daysToFixExpiry !== null && d.daysToFixExpiry < 180
              ? `Your mortgage fix expires in ${Math.round(d.daysToFixExpiry/30)} months — lock a new rate now before rolling onto SVR.`
              : "Review your mortgage — overpaying at your rate may beat savings.",
            kids: "Open a Junior ISA for your child — up to £9,000/yr grows completely tax-free until they turn 18.",
            inheritance: "Review your estate planning — IHT threshold is £325,000 and every year without a plan can cost your estate.",
            personalLoan: `Pay down your personal loan at ${+d.personalLoanRate||0}% — a guaranteed ${+d.personalLoanRate||0}% return, better than any savings account.`,
          };
          const text = directives[topModule.key] || `Review your ${topModule.title.toLowerCase()} — there's money to unlock here.`;
          return (
            <div className="fu" style={{background:G,borderLeft:`6px solid ${GOLD}`,borderRadius:"14px",padding:"20px 24px",marginBottom:"20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:"200px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:GOLD,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"8px"}}>Your biggest win this week</div>
                <p style={{fontSize:"18px",color:WHITE,fontWeight:500,lineHeight:1.5,margin:0}}>{text}</p>
              </div>
              <button type="button" onClick={() => onOpenModule(topModule.key)}
                style={{background:GOLD,border:"none",borderRadius:"10px",padding:"13px 22px",color:G,fontSize:"14px",fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                Do this now →
              </button>
            </div>
          );
        })()}

        {/* Greeting */}
        <h1 style={{fontFamily:SERIF,fontSize:"clamp(22px,4vw,28px)",color:G,fontWeight:700,marginBottom:"20px",lineHeight:1.2}}>
          {d.name ? `Hi ${d.name},` : "Hi,"} here's your Candid report.
        </h1>

        {/* Score card */}
        <div className="fu" style={{background:G,borderRadius:"16px",padding:"28px 32px",display:"flex",alignItems:"center",gap:"28px",marginBottom:"28px",flexWrap:"wrap"}}>
          <ScoreRing score={displayScore} delta={totalDelta}/>
          <div style={{flex:1,minWidth:"200px"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:GOLD,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>Your Candid Score</div>
            <h2 style={{fontFamily:SERIF,color:WHITE,fontSize:"20px",lineHeight:1.35,marginBottom:"10px"}}>{insights.headline}</h2>
            <p style={{color:"rgba(255,255,255,0.65)",fontSize:"14px",lineHeight:1.7,marginBottom:"16px"}}>{insights.narrative}</p>
            {insights.isFallback && (
              <p style={{color:"rgba(255,255,255,0.4)",fontSize:"11px",fontStyle:"italic",marginBottom:"16px"}}>
                We couldn't generate your personalised analysis just now, so you're seeing a general summary — try regenerating shortly.
              </p>
            )}
          </div>
        </div>

        {/* Action plan — accordion with inline scenarios */}
        {insights.priorities?.length > 0 && (() => {
          // Sort priorities: urgency first (immediate→this tax year→soon), then keep relative AI order
          const urgencyRank = { immediate:0, "this tax year":1, soon:2, when_ready:3 };
          const sortedPriorities = [...insights.priorities]
            .filter(p => {
              const t = ((p.title||"")+" "+(p.description||"")).toLowerCase();
              // Strip any insurance-related priorities entirely
              if (t.includes("insur") || t.includes("life cover") || t.includes("income protect") || t.includes("critical illness")) return false;
              // Never show "start contributions" when already contributing and no missed match
              if (isPensionContributing(d) && m.missedMatch === 0) {
                if (t.includes("start pension") || t.includes("start contribution") || t.includes("no pension")) return false;
              }
              return true;
            })
            .sort((a, b) => {
              const ra = urgencyRank[a.urgency] ?? 2, rb = urgencyRank[b.urgency] ?? 2;
              return ra - rb;
            });
          if (!sortedPriorities.length) return null;

          // Build scenario lookup by module key
          const scenarioMap = {};
          if (m.missedMatch > 0) scenarioMap["pension"] = {
            impactLabel: `+${fmt(m.missedMatch)}/yr from employer`,
            scoreBoost: Math.min(12, Math.round(m.missedMatch / 500)),
            description: `Contribute ${+d.employerMatch||0}% to capture the full employer match.`,
          };
          if (m.annualYieldGap > 200) scenarioMap["cash"] = {
            impactLabel: `+${fmt(m.annualYieldGap)}/yr in yield`,
            scoreBoost: Math.min(8, Math.round(m.annualYieldGap / 200)),
            description: `Move up to ${fmt(Math.min(m.emergencyFund, m.isaHeadroom))} of your ${fmt(m.totalLiquid)} in liquid savings into a 5.08% Cash ISA. This is your remaining ISA allowance for this tax year.`,
          };
          if (m.isaHeadroom > 3000) scenarioMap["investments"] = {
            impactLabel: `${fmt(m.isaHeadroom)} sheltered from tax`,
            scoreBoost: Math.min(6, Math.round(m.isaHeadroom / 3000)),
            description: `Up to ${fmt(m.isaHeadroom)} can still be placed in an ISA before April 5th — your remaining allowance for this tax year.`,
          };
          if (d.studentLoan !== "none" && !m.willClear && m.annualRepayment > 0) scenarioMap["studentLoan"] = {
            impactLabel: `Redirect ${fmt(Math.min(2000, m.annualRepayment * 0.5))}/yr`,
            scoreBoost: 4,
            description: "Your loan is unlikely to clear before write-off — voluntary overpayments will be lost. Redirect that money to ISA or pension instead.",
          };

          return (
            <ActionPlanAccordion
              priorities={sortedPriorities}
              scenarioMap={scenarioMap}
              currentScore={insights.score}
              onOpenModule={onOpenModule}
            />
          );
        })()}

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

        {/* Net worth summary */}
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
          Open Banking (coming soon) for a complete picture.
        </div>
      </>
    )}
  </div>
)}

        {/* Total opportunity banner */}
        {(() => {
          const totalOpp = activeModules.reduce((sum, mm) => {
            const raw = mm.impact || 0;
            // Exclude pension sentinel value (99999 + tax relief) used for sorting
            const capped = Math.min(raw, 99998);
            return sum + (capped > 0 ? capped : 0);
          }, 0);
          if (totalOpp < 500) return null;
          const eq = getEquivalence(totalOpp);
          return (
            <div className="fu1" style={{background:G,borderRadius:"14px",padding:"20px 24px",marginBottom:"20px",display:"flex",alignItems:"center",gap:"20px",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:"200px"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:GOLD,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"6px"}}>Your total opportunity</div>
                <div style={{display:"flex",alignItems:"baseline",gap:"10px",flexWrap:"wrap"}}>
                  <span style={{fontFamily:SERIF,fontSize:"32px",fontWeight:700,color:WHITE}}>{fmt(totalOpp)}</span>
                  <span style={{fontSize:"14px",color:"rgba(255,255,255,0.55)"}}>you could be leaving on the table</span>
                </div>
                {eq && <div style={{fontSize:"12px",color:GOLD,marginTop:"6px"}}>{eq}</div>}
              </div>
              <div style={{fontSize:"12px",color:"rgba(255,255,255,0.4)",maxWidth:"220px",lineHeight:1.6}}>
                Sum of yield gaps, missed tax relief, and interest costs — across all open modules below.
              </div>
            </div>
          );
        })()}


        {/* Edit inputs banner */}
        <div style={{background:"rgba(196,150,58,0.08)",border:"1px solid rgba(196,150,58,0.25)",borderRadius:"10px",padding:"13px 16px",marginBottom:"20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
          <p style={{fontSize:"13px",color:G,lineHeight:1.5,margin:0}}>Changed your circumstances? Update your inputs for a fresh score.</p>
          <button onClick={onEditInputs} style={{background:"transparent",border:`1.5px solid ${GOLD}`,borderRadius:"7px",padding:"7px 14px",color:GOLD,fontSize:"12px",fontWeight:700,cursor:"pointer",flexShrink:0}}>Update inputs</button>
        </div>

        {/* Module breakdown — sorted, collapsible */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
          <h3 style={{fontFamily:SERIF,fontSize:"21px",color:G}}>Module breakdown</h3>
          <span style={{fontSize:"12px",color:MUT}}>{completedModules.filter(k => activeModules.some(mm => mm.key === k)).length} of {activeModules.length} reviewed</span>
        </div>

        {/* Unreviewed modules — top 3 always visible */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"10px"}}>
          {visibleUnreviewed.map((mm,i) => {
            const col = SC[mm.status] || MUT;
            return (
              <div key={mm.key} onClick={() => onOpenModule(mm.key)} className={`fu${Math.min(i+1,7)}`}
                style={{background:WHITE,borderRadius:"12px",padding:"18px",border:`1px solid rgba(22,47,36,0.09)`,cursor:"pointer",borderTop:`3px solid ${col}`,display:"flex",flexDirection:"column"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                  <span style={{fontSize:"16px"}}>{mm.icon}</span>
                  <span style={{fontWeight:600,fontSize:"13px",color:TEXT}}>{mm.title}</span>
                </div>
                <span style={{fontSize:"10px",fontWeight:700,color:col,background:`${col}18`,padding:"3px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",display:"inline-block",marginBottom:"8px"}}>{SL[mm.status]}</span>
                <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginBottom:"6px"}}>{mm.summary}</p>
                <div style={{marginTop:"auto",paddingTop:"8px"}}>
                  {mm.impactLabel && (
                    <div style={{fontSize:"11px",color:G,fontWeight:600,background:"rgba(22,47,36,0.05)",borderRadius:"5px",padding:"4px 8px",marginBottom:"4px"}}>{mm.impactLabel}</div>
                  )}
                  {mm.impact > 0 && (() => {
                    const eq = getEquivalence(mm.impact);
                    return eq ? (
                      <div style={{fontSize:"10.5px",color:MUT,background:"rgba(196,150,58,0.07)",borderRadius:"5px",padding:"4px 8px",marginBottom:"8px",lineHeight:1.35}}>{eq}</div>
                    ) : null;
                  })()}
                  <p style={{fontSize:"12px",color:G,fontWeight:500}}>View details →</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Show more — grid appears first, button stays at bottom */}
        {hiddenCount > 0 && (
          <>
            {showAllModules && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"10px"}}>
                {hiddenUnreviewed.map((mm) => {
                  const col = SC[mm.status] || MUT;
                  return (
                    <div key={mm.key} onClick={() => onOpenModule(mm.key)}
                      style={{background:WHITE,borderRadius:"12px",padding:"18px",border:`1px solid rgba(22,47,36,0.09)`,cursor:"pointer",borderTop:`3px solid ${col}`,display:"flex",flexDirection:"column"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                        <span style={{fontSize:"16px"}}>{mm.icon}</span>
                        <span style={{fontWeight:600,fontSize:"13px",color:TEXT}}>{mm.title}</span>
                      </div>
                      <span style={{fontSize:"10px",fontWeight:700,color:col,background:`${col}18`,padding:"3px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",display:"inline-block",marginBottom:"8px"}}>{SL[mm.status]}</span>
                      <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginBottom:"6px"}}>{mm.summary}</p>
                      <div style={{marginTop:"auto",paddingTop:"8px"}}>
                        {mm.impactLabel && (
                          <div style={{fontSize:"11px",color:G,fontWeight:600,background:"rgba(22,47,36,0.05)",borderRadius:"5px",padding:"4px 8px",marginBottom:"4px"}}>{mm.impactLabel}</div>
                        )}
                        {mm.impact > 0 && (() => {
                          const eq = getEquivalence(mm.impact);
                          return eq ? (
                            <div style={{fontSize:"10.5px",color:MUT,background:"rgba(196,150,58,0.07)",borderRadius:"5px",padding:"4px 8px",marginBottom:"8px",lineHeight:1.35}}>{eq}</div>
                          ) : null;
                        })()}
                        <p style={{fontSize:"12px",color:G,fontWeight:500}}>View details →</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button type="button" onClick={() => setShowAllModules(v=>!v)}
              style={{width:"100%",padding:"12px",background:"transparent",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"10px",color:G,fontSize:"14px",fontWeight:500,cursor:"pointer",marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}}>
              <span style={{transform:showAllModules?"rotate(90deg)":"none",transition:"transform 0.2s",display:"inline-block",fontSize:"16px"}}>›</span>
              {showAllModules ? "Show fewer modules" : `Show ${hiddenCount} more module${hiddenCount!==1?"s":""}`}
            </button>
          </>
        )}

        {/* Reviewed modules — dimmed, at bottom */}
        {reviewedModules.length > 0 && (
          <div style={{marginBottom:"24px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:MUT,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px",display:"flex",alignItems:"center",gap:"6px"}}>
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1" stroke="#2d6b4a" strokeWidth="2" strokeLinecap="round"/></svg>
              Reviewed
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"8px"}}>
              {reviewedModules.map(mm => (
                <div key={mm.key} onClick={() => onOpenModule(mm.key)} style={{background:WHITE,borderRadius:"12px",padding:"14px 16px",border:`1.5px solid ${GOLD}`,cursor:"pointer",display:"flex",alignItems:"center",gap:"10px",transition:"all 0.15s"}}>
                  <div style={{width:"22px",height:"22px",background:"#2d6b4a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke={WHITE} strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </div>
                  <span style={{fontSize:"16px"}}>{mm.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:"13px",color:TEXT}}>{mm.title}</div>
                    <div style={{fontSize:"11px",color:GOLD,fontWeight:600}}>{mm.title}: Optimised ✓</div>
                  </div>
                </div>
              ))}
            </div>
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
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.55,marginBottom:"12px",flex:1}}>{p.feature}</p>
      <button type="button" onClick={() => p.internalLink ? onInternalLink(p.internalLink) : null}
        style={{width:"100%",padding:"9px",background:p.highlight?G:"transparent",border:`1.5px solid ${p.highlight?G:"rgba(22,47,36,0.22)"}`,borderRadius:"8px",color:p.highlight?WHITE:G,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
        {p.cta}
      </button>
      {!p.internalLink && (
        <div style={{marginTop:"8px",fontSize:"11px",color:"rgba(22,47,36,0.4)",textAlign:"center",fontStyle:"italic"}}>
          Demo: {p.demoNote || `Would open ${p.name} — not yet a live link in this preview`}
        </div>
      )}
    </div>
  );
}

// ── Alternative investments section (age-gated framing) ───────────────────────
function AlternativeInvestments({ age }) {
  const [open, setOpen] = useState(false);
  const youngUser = (+age||30) < 45;
  const label = youngUser
    ? "Beyond the basics: higher-risk & alternative investments 🚀"
    : "Advanced investing: alternatives & passion assets 📈";
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
    <div style={{marginTop:"8px"}}>
      <button type="button" onClick={() => setOpen(v=>!v)} style={{width:"100%",padding:"13px 18px",background:open?G:"rgba(22,47,36,0.04)",border:`1px solid ${open?G:"rgba(22,47,36,0.12)"}`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",transition:"all 0.2s",marginBottom:open?"16px":"0"}}>
        <div style={{textAlign:"left"}}>
          <div style={{fontSize:"14px",fontWeight:600,color:open?WHITE:G}}>{label}</div>
          <div style={{fontSize:"12px",color:open?"rgba(255,255,255,0.55)":MUT,marginTop:"2px"}}>{subLabel}</div>
        </div>
        <span style={{fontSize:"16px",color:open?GOLD:MUT,transform:open?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0,marginLeft:"12px"}}>›</span>
      </button>
      {open && (
        <div>
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
        </div>
      )}
    </div>
  );
}

function ModuleDeepDive({ moduleKey, insights, d, m, statuses, openSection, goBack, goToDashboard, onComplete, isComplete, onOpenModule, nextModule }) {
  const [openTip,   setOpenTip]   = useState(null);
  const [expandAlt, setExpandAlt] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const [bonusInput,setBonusInput]= useState(+d.bonusAmount||"");
  const [sacrificePct, setSacrificePct] = useState(100);
  const [showCoins, setShowCoins] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (openSection === "bonusSacrifice") {
      setShowBonus(true);
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
    : getModuleInsights(moduleKey, d, m);
  const products = newModules.includes(moduleKey)
    ? getModuleProductsExtended(moduleKey, d, m)
    : getModuleProducts(moduleKey, d, m);
  const crossLinks = getCrossModuleLinks(moduleKey, d, m);

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
    const yMax = Math.max(pensionReturn + 0.3, data[0].ratio + 0.15, 1.6);
    const yMin = 0.92;
    const VW = 680, VH = 320, PL = 64, PR = 20, PT = 24, PB = 56;
    const cW = VW - PL - PR, cH = VH - PT - PB;
    const sx = a => PL + (a / m.loanBal) * cW;
    const sy = r => PT + cH - ((r - yMin) / (yMax - yMin)) * cH;
    const path = data.map((p,i) => `${i===0?"M":"L"}${sx(p.amt).toFixed(1)},${sy(p.ratio).toFixed(1)}`).join(" ");
    let crossAmt = null;
    for (let i = 0; i < data.length - 1; i++) {
      if (data[i].ratio >= pensionReturn && data[i+1].ratio < pensionReturn) {
        const t = (pensionReturn - data[i].ratio) / (data[i+1].ratio - data[i].ratio);
        crossAmt = data[i].amt + t * (data[i+1].amt - data[i].amt);
        break;
      }
    }
    const trPct = Math.round(m.tr * 100);
    const yTicks = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5].filter(r => r >= yMin && r <= yMax + 0.05);
    const xTicks = [0, 0.25, 0.5, 0.75, 1].map(f => m.loanBal * f);
    const crossX = crossAmt !== null ? sx(crossAmt) : null;
    const crossY = sy(pensionReturn);
    return { writeOffYr, pensionReturn, mortRate, mortReturn, data, yMax, yMin, VW, VH, PL, PR, PT, PB, cW, cH, sx, sy, path, crossAmt, crossX, crossY, trPct, yTicks, xTicks };
  }, [products.slSection, m.loanBal, m.salary, m.tr, d.studentLoan, d.salaryTrajectory, d.pensionType, d.hasMortgage, d.mortgageRate]);

  const modSummary = insights?.modules?.[moduleKey];
  // Pension: user told us they don't know their pension situation — show a
  // dedicated "find out" guide instead of the normal critical/attention framing
  const isPensionUnknown = moduleKey === "pension" && m.pensionStatus === "unknown";
  const col = isPensionUnknown ? MUT : (SC[modSummary?.status] || MUT);
  const surplus = m.surplusCash;
  const showRunwayCallout = moduleKey === "cash" && m.runwayMonths > m.bufferMonths * 2;
  const bondsVal = m.bonds || 0;
  const showBondsOverlay = moduleKey === "cash" && bondsVal > 0;
  const cashRate = +d.savingsRate || 3.5;
  const taxableInterest = m.cash * cashRate / 100;
  const psaLimit = m.taxBandLabel === "basic" ? 1000 : m.taxBandLabel === "higher" ? 500 : 0;
  const interestOverPsa = Math.max(0, taxableInterest - psaLimit);
  const taxOnInterest = interestOverPsa * m.tr;
  const bondAdvantage = bondsVal > 0 && taxOnInterest > 0;

  const altProducts = [
    { name:"NS&I Premium Bonds", type:"Government-backed savings", rate:"~4.4% tax-free (avg)", badge:"Tax-free winnings", feature:"All winnings are 100% tax-free. Max £50,000 holding. FSCS unlimited (government-backed). No guaranteed return.", cta:"Apply via NS&I", highlight:true },
    { name:"UK Gilts (via ETF)", type:"Government bonds", rate:"~4.3–4.6% yield", badge:"Capital secure", feature:"UK government debt — effectively risk-free to maturity. Tradeable ETF wrappers available on HL and Vanguard. Interest taxable (unless in ISA).", cta:"Explore gilts", highlight:false },
    { name:"Fixed-term savings", type:"Fixed rate bond", rate:"Up to 5.2% AER (1yr)", badge:"Highest fixed rate", feature:"Higher rates than easy access in exchange for locking funds. FSCS protected to £85k. Consider if runway is high and cash not needed soon.", cta:"Compare fixed rates", highlight:false },
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
  const showBonusPanel = moduleKey === "pension" && ((+d.bonusAmount||0) > 0 || showBonus);
  const showSacrificeCalc = moduleKey === "pension" && m.adjustedNetIncome >= 80000 && m.adjustedNetIncome <= 125140;

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

        {/* AI summary */}
        {!isPensionUnknown && modSummary?.summary && (
          <div className="fu1" style={{background:G,borderRadius:"12px",padding:"18px 22px",marginBottom:"24px"}}>
            <p style={{fontSize:"15px",color:"rgba(255,255,255,0.85)",lineHeight:1.75}}>{modSummary.summary}</p>
          </div>
        )}

        {/* Computed metrics with tooltips */}
        {!isPensionUnknown && modInsights.length > 0 && (
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

        {/* ── Pension projection chart ── */}
        {moduleKey === "pension" && d.hasPension === "yes" && ((+d.potValue||0) > 0 || +d.myContribution > 0) && (() => {
          const salary = m.salary, potVal = +d.potValue||0;
          const myPct = +d.myContribution||0, empCapPct = +d.employerMatch||0;
          const retireAge = +d.retirementAge||65, age = +d.age||30;
          const years = Math.max(1, retireAge - age);
          const annualContrib = (myPct + empCapPct) / 100 * salary;
          const currentPot = m.projectedPot;

          const optimisedContrib = (empCapPct * 2) * salary / 100;
          const bonusExtra = (+d.bonusAmount||0) * 0.9;
          const optimisedAnnual = optimisedContrib + bonusExtra;
          const optimisedPot = potVal * Math.pow(1.06, years) + optimisedAnnual * ((Math.pow(1.06, years) - 1) / 0.06);

          const hasMissedMatch = m.missedMatch > 0;
          const hasBonus = (+d.bonusAmount||0) > 0;
          const showOptimised = hasMissedMatch || hasBonus;

          // Bars: [now, projected, (optimised?), (with-bonus?)]
          const bars = [
            { value: potVal, label: "Now", color: "rgba(196,150,58,0.4)", textCol: G },
            { value: currentPot, label: `At retirement\n(age ${retireAge})`, color: GOLD, textCol: G },
            ...(hasMissedMatch ? [{ value: optimisedPot, label: `Optimised\n(match cap)`, color: "#2d6b4a", textCol: WHITE }] : []),
            ...(hasBonus ? [{ value: optimisedPot + bonusExtra * ((Math.pow(1.06, years)-1)/0.06), label: "With bonus\nsacrifice", color: "rgba(45,107,74,0.7)", textCol: WHITE }] : []),
          ];

          const maxVal = Math.max(...bars.map(b => b.value)) * 1.15;
          const VW = 680, VH = 300, PL = 20, PR = 20, PT = 44, PB = 72;
          const cW = VW - PL - PR, cH = VH - PT - PB;
          const barW = 110, gap = bars.length > 2 ? (cW - bars.length * barW) / (bars.length + 1) : (cW - bars.length * barW) / (bars.length + 1);
          const sy = v => PT + cH - (v / maxVal) * cH;
          const barX = i => PL + gap + i * (barW + gap);
          const nudge1pct = Math.round(salary * 0.01 * ((Math.pow(1.06, years) - 1) / 0.06));
          const refY = sy(showOptimised ? optimisedPot : currentPot);

          return (
            <div className="fu2" style={{marginBottom:"20px"}}>
              <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{display:"block",overflow:"visible"}}>
                {/* Dashed "potential" reference line */}
                {showOptimised && (
                  <>
                    <line x1={PL} x2={VW-PR} y1={refY} y2={refY} stroke="#e8d5a3" strokeWidth="1.5" strokeDasharray="8,5" opacity="0.7"/>
                    <text x={VW-PR-6} y={refY-7} fontSize="13" fill="#e8d5a3" textAnchor="end" fontWeight="600">Potential</text>
                  </>
                )}
                {/* Bars */}
                {bars.map((bar, i) => {
                  const x = barX(i);
                  const barH = Math.max(4, (bar.value / maxVal) * cH);
                  const y = PT + cH - barH;
                  const lines = bar.label.split("\n");
                  return (
                    <g key={i}>
                      {/* Bar */}
                      <rect x={x} y={y} width={barW} height={barH} rx="6" fill={bar.color}/>
                      {/* Value label above bar */}
                      <text x={x + barW/2} y={y - 10} fontSize="18" fontWeight="700" fill={G} textAnchor="middle">{fmt(Math.round(bar.value/1000)*1000)}</text>
                      {/* X-axis label (multi-line) */}
                      {lines.map((ln, li) => (
                        <text key={li} x={x + barW/2} y={VH - PB + 20 + li * 18} fontSize="13" fontWeight={li===0?"700":"400"} fill={MUT} textAnchor="middle">{ln}</text>
                      ))}
                      {/* Gold arrow between bar 0 and bar 1 */}
                      {i === 0 && (
                        <g>
                          <line x1={x+barW+8} x2={barX(1)-8} y1={(y + PT+cH)/2} y2={(sy(bars[1].value) + PT+cH)/2}
                            stroke={GOLD} strokeWidth="2.5" markerEnd="url(#arrowGold)"/>
                        </g>
                      )}
                    </g>
                  );
                })}
                {/* Arrow marker def */}
                <defs>
                  <marker id="arrowGold" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill={GOLD}/>
                  </marker>
                </defs>
                {/* Baseline */}
                <line x1={PL} x2={VW-PR} y1={PT+cH} y2={PT+cH} stroke="rgba(200,216,204,0.55)" strokeWidth="2"/>
              </svg>
              <div style={{fontSize:"12px",color:MUT,marginTop:"4px",lineHeight:1.6}}>
                Based on 6% annual growth over {years} year{years!==1?"s":""} to age {retireAge}. Contributions shown in today's money.
              </div>
              {/* 1% nudge chip */}
              <div style={{marginTop:"10px",borderLeft:`4px solid ${GOLD}`,background:"rgba(196,150,58,0.07)",borderRadius:"0 8px 8px 0",padding:"10px 14px",fontSize:"13px",color:G,lineHeight:1.5}}>
                ↑ <strong>1% more contribution = ~{fmt(nudge1pct)} more at retirement</strong> — return ratio {pensionReturnLabel(d, m)}, net cost {fmt(Math.round(salary*0.01/12*(1-m.tr)))}/mo after tax relief.
              </div>
            </div>
          );
        })()}

        {/* Cash runway callout */}
        {showRunwayCallout && (
          <div className="fu2" style={{background:"rgba(196,150,58,0.07)",border:"1px solid rgba(196,150,58,0.28)",borderRadius:"12px",padding:"18px 20px",marginBottom:"20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
              <span style={{fontSize:"16px"}}>💡</span>
              <span style={{fontSize:"12px",fontWeight:700,color:GOLD,letterSpacing:"0.06em",textTransform:"uppercase"}}>Your cash is working hard — maybe too hard</span>
            </div>
            <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"12px"}}>
              You have <strong>{m.runwayMonths.toFixed(0)} months</strong> of runway — that's {(m.runwayMonths / m.bufferMonths).toFixed(1)}× your {m.bufferMonths}-month target. The excess ({fmt(surplus)}) is sitting in cash while likely losing ground to inflation. Consider putting it to work:
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {[
                d.hasPension === "yes" && (+d.myContribution||0) < (+d.employerMatch||0) && { icon:"🏦", text:`Top up pension — every £ contributes ${Math.round(m.tr*100)}% tax relief instantly`, target:"pension" },
                d.hasMortgage === "yes" && (+d.mortgageRate||0) >= 4 && { icon:"🏠", text:`Overpay mortgage — guaranteed ${d.mortgageRate}% return, risk-free`, target:"mortgage" },
                d.studentLoan !== "none" && m.willClear && { icon:"🎓", text:"Student loan — your salary means you'll clear before write-off; overpaying saves interest at 7.5%", target:"studentLoan" },
                m.isaHeadroom > 2000 && { icon:"📈", text:`ISA — ${fmt(m.isaHeadroom)} of allowance remaining; shelter returns from tax permanently`, target:"investments" },
              ].filter(Boolean).map((s,i) => (
                <div key={i} onClick={() => onOpenModule(s.target)} style={{display:"flex",alignItems:"flex-start",gap:"10px",padding:"10px 12px",background:"rgba(255,255,255,0.6)",borderRadius:"8px",cursor:"pointer",border:"1px solid transparent",transition:"border-color 0.15s"}}>
                  <span style={{fontSize:"14px",flexShrink:0}}>{s.icon}</span>
                  <span style={{fontSize:"13px",color:TEXT,lineHeight:1.5,flex:1}}>{s.text}</span>
                  <span style={{fontSize:"12px",color:GOLD,fontWeight:600,flexShrink:0}}>→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Premium bonds overlay */}
        {showBondsOverlay && (
          <div className="fu3" style={{background:WHITE,border:"1px solid rgba(22,47,36,0.09)",borderRadius:"12px",padding:"18px 20px",marginBottom:"20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
              <span style={{fontSize:"18px"}}>🏆</span>
              <h4 style={{fontFamily:SERIF,fontSize:"16px",color:G}}>About your premium bonds ({fmt(bondsVal)})</h4>
            </div>
            <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"10px"}}>
              Premium bonds are a cash-like asset backed by the government (NS&I). Your "interest" comes as monthly prize draws — <strong>100% tax-free</strong>. The current prize fund rate is approximately 4.4% AER across all bonds, though your personal return will vary by luck.
            </p>
            {bondAdvantage ? (
              <div style={{background:"rgba(45,107,74,0.07)",borderRadius:"8px",padding:"12px 14px",fontSize:"13px",color:TEXT,lineHeight:1.65}}>
                <strong>Worth keeping, potentially worth adding more.</strong> Your cash savings ({fmt(m.cash)}) are earning ~{fmt(taxableInterest)}/yr in interest. After your Personal Savings Allowance (£{psaLimit.toLocaleString()}), roughly {fmt(interestOverPsa)} is taxable — costing you ~{fmt(taxOnInterest)}/yr in {Math.round(m.tr*100)}% tax.
                {bondsVal < 50000 && ` Shifting more into bonds (up to the £50k max) could eliminate that tax exposure entirely.`}
              </div>
            ) : (
              <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"8px",padding:"12px 14px",fontSize:"13px",color:TEXT,lineHeight:1.65}}>
                At your savings level and tax band, your interest income likely falls within your Personal Savings Allowance (£{psaLimit.toLocaleString()}/yr), so the tax-free benefit of bonds over a Cash ISA is less critical. The key trade-off is: <strong>bonds offer no guaranteed return</strong> whereas a Cash ISA at 5.08% is certain.
              </div>
            )}
          </div>
        )}

        {/* Premium bonds yield opportunity */}
        {moduleKey === "cash" && bondsVal > 0 && (() => {
          const bondsSurplusAmt = Math.max(0, bondsVal - m.emergencyBuffer);
          const annualGain = Math.round(bondsSurplusAmt * (0.049 - 0.044));
          if (bondsSurplusAmt < 1000 || annualGain <= 0) return null;
          return (
            <div className="fu3" style={{background:"rgba(196,150,58,0.06)",border:`1px solid ${GOLD}`,borderRadius:"12px",padding:"16px 18px",marginBottom:"20px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
                <span style={{fontSize:"16px"}}>💰</span>
                <span style={{fontSize:"12px",fontWeight:700,color:GOLD,letterSpacing:"0.06em",textTransform:"uppercase"}}>Yield opportunity: surplus premium bonds</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",marginBottom:"12px"}}>
                <div style={{background:"rgba(255,255,255,0.7)",borderRadius:"8px",padding:"10px 12px",textAlign:"center"}}>
                  <div style={{fontSize:"10px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"4px"}}>Your bonds surplus</div>
                  <div style={{fontFamily:SERIF,fontSize:"17px",color:G,fontWeight:700}}>{fmt(bondsSurplusAmt)}</div>
                  <div style={{fontSize:"10px",color:MUT,marginTop:"2px"}}>above buffer</div>
                </div>
                <div style={{background:"rgba(255,255,255,0.7)",borderRadius:"8px",padding:"10px 12px",textAlign:"center"}}>
                  <div style={{fontSize:"10px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"4px"}}>Prize draw equiv.</div>
                  <div style={{fontFamily:SERIF,fontSize:"17px",color:GOLD,fontWeight:700}}>~4.4%</div>
                  <div style={{fontSize:"10px",color:MUT,marginTop:"2px"}}>tax-free avg.</div>
                </div>
                <div style={{background:"rgba(45,107,74,0.08)",borderRadius:"8px",padding:"10px 12px",textAlign:"center"}}>
                  <div style={{fontSize:"10px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"4px"}}>Best Cash ISA</div>
                  <div style={{fontFamily:SERIF,fontSize:"17px",color:"#2d6b4a",fontWeight:700}}>4.9%</div>
                  <div style={{fontSize:"10px",color:"#2d6b4a",marginTop:"2px"}}>guaranteed</div>
                </div>
              </div>
              <div style={{background:"rgba(45,107,74,0.06)",borderRadius:"8px",padding:"10px 12px",fontSize:"13px",color:TEXT,lineHeight:1.65}}>
                Moving {fmt(bondsSurplusAmt)} of surplus bonds to a 4.9% Cash ISA would earn <strong>{fmt(annualGain)}/yr more</strong> — a guaranteed return vs the bond prize draw average. Premium bonds are government-backed and penalty-free to withdraw; this is a personal risk decision based on whether you value guaranteed income over the chance of tax-free prizes.
              </div>
            </div>
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

        {/* Products */}
        {products && !isPensionUnknown && (
          <div className="fu4">
            <div style={{marginBottom:"16px"}}>
              <h3 style={{fontFamily:SERIF,fontSize:"20px",color:G,marginBottom:"6px"}}>{products.heading}</h3>
              <p style={{fontSize:"14px",color:MUT,lineHeight:1.65}}>{products.subheading}</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"12px",marginBottom:"14px"}}>
              {products.products.map((p,i) => (
                <ProductCard key={i} p={p} onInternalLink={onOpenModule}/>
              ))}
            </div>
            <p style={{fontSize:"11px",color:MUT,lineHeight:1.6,padding:"12px 0",borderTop:"1px solid rgba(22,47,36,0.08)"}}>{products.disclaimer}</p>

            {/* CGT crystallisation action panel */}
            {products.cgtSection && (
              <div style={{marginTop:"16px",background:"rgba(22,47,36,0.03)",border:"1.5px solid rgba(22,47,36,0.15)",borderRadius:"12px",overflow:"hidden"}}>
                <div style={{background:G,padding:"12px 18px",display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{fontSize:"14px"}}>⏳</span>
                  <span style={{fontSize:"12px",fontWeight:700,color:GOLD,letterSpacing:"0.06em",textTransform:"uppercase"}}>Action before April 5th</span>
                </div>
                <div style={{padding:"16px 18px"}}>
                  <h4 style={{fontFamily:SERIF,fontSize:"16px",color:G,marginBottom:"10px"}}>{products.cgtSection.heading}</h4>
                  <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"12px"}}>{products.cgtSection.body}</p>
                  <div style={{background:"rgba(192,57,43,0.05)",border:"1px solid rgba(192,57,43,0.18)",borderRadius:"8px",padding:"12px 14px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"5px"}}>Use it or lose it</div>
                    <p style={{fontSize:"13px",color:TEXT,lineHeight:1.65}}>{products.cgtSection.warning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Student loan overpayment scenarios */}
            {products.slSection && (
              <div style={{marginTop:"16px"}}>
                {/* Inflection point warning */}
                {products.slSection.balanceGrowing && (
                  <div style={{background:"rgba(192,57,43,0.05)",border:"1.5px solid rgba(192,57,43,0.22)",borderRadius:"12px",padding:"16px 18px",marginBottom:"12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                      <span style={{fontSize:"16px"}}>🚨</span>
                      <span style={{fontSize:"12px",fontWeight:700,color:"#c0392b",letterSpacing:"0.06em",textTransform:"uppercase"}}>Effective 9% income surcharge</span>
                    </div>
                    <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"10px"}}>
                      Your loan balance is growing faster than you repay it. Every £1 of income above the threshold (£{products.slSection.balanceGrowing ? "27,295" : "—"}) is taxed an extra 9% — and your balance compounds upward. This continues until you either reach the <strong>inflection point</strong> or the loan is written off.
                    </p>
                    <div style={{background:WHITE,borderRadius:"8px",padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:"11px",color:MUT,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px"}}>Inflection point salary</div>
                        <div style={{fontFamily:SERIF,fontSize:"20px",color:G,fontWeight:700}}>{fmt(products.slSection.inflectionSalary)}</div>
                        <div style={{fontSize:"12px",color:MUT,marginTop:"2px"}}>where repayments = interest</div>
                      </div>
                      <div style={{fontSize:"13px",color:MUT,lineHeight:1.6,flex:1,minWidth:"160px"}}>
                        At this salary, 9% of income above the threshold exactly matches your annual interest charge. Above this point, every pay rise reduces your balance. Below it, every year adds to it.
                      </div>
                    </div>
                  </div>
                )}

                {/* Overpayment scenario cards */}
                {products.slSection.scenarios.length > 0 && (
                  <div style={{marginBottom:"12px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:"12px"}}>
                      What if you overpaid today?
                    </div>
                    {/* Baseline */}
                    <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"14px 16px",marginBottom:"8px",display:"flex",gap:"16px",flexWrap:"wrap",alignItems:"center"}}>
                      <div style={{flex:"0 0 auto"}}>
                        <div style={{fontSize:"10px",color:MUT,fontWeight:600,textTransform:"uppercase",marginBottom:"3px"}}>No overpayment</div>
                        <div style={{fontFamily:SERIF,fontSize:"17px",color:TEXT,fontWeight:600}}>
                          {products.slSection.baseProjection.clearYr
                            ? `Clears in ${products.slSection.baseProjection.clearYr} yrs`
                            : `${fmt(products.slSection.baseProjection.writeOffBal)} written off`}
                        </div>
                      </div>
                      <div style={{flex:1,minWidth:"140px",fontSize:"12px",color:MUT,lineHeight:1.6}}>
                        Total repaid: {fmt(products.slSection.baseProjection.totalPaid)} over {products.slSection.writeOffYr} years. Interest accruing: {fmt(products.slSection.annualInterest)}/yr.
                      </div>
                    </div>
                    {products.slSection.scenarios.map((s,i) => {
                      const reaches = s.crossesInflection;
                      const clears = !!s.clearYr;
                      const bg = clears ? "rgba(45,107,74,0.06)" : reaches ? "rgba(196,150,58,0.06)" : WHITE;
                      const bdr = clears ? "rgba(45,107,74,0.22)" : reaches ? "rgba(196,150,58,0.3)" : "rgba(22,47,36,0.09)";
                      const savedVsBase = products.slSection.baseProjection.totalPaid - s.totalPaid;
                      return (
                        <div key={i} style={{background:bg,border:`1.5px solid ${bdr}`,borderRadius:"10px",padding:"14px 16px",marginBottom:"8px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",flexWrap:"wrap",marginBottom:"8px"}}>
                            <div>
                              <div style={{fontSize:"10px",fontWeight:700,color:clears?"#2d6b4a":reaches?GOLD:G,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"3px"}}>
                                {clears ? "✓ Clears the loan" : reaches ? "✓ Reaches inflection point" : `Overpay ${fmt(s.amt)} today`}
                              </div>
                              <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700}}>
                                {clears ? `Clears in ${s.clearYr} yrs (vs ${products.slSection.baseProjection.clearYr||products.slSection.writeOffYr})` : `${fmt(s.writeOffBal)} written off`}
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

                    {/* Personalised marginal return curve — only when loan will clear */}
                    {loanCurve && (() => {
                      const { writeOffYr, pensionReturn, mortRate, mortReturn, data, yMax, yMin, VW, VH, PL, PR, PT, PB, cW, cH, sx, sy, path, crossAmt, crossX, crossY, trPct, yTicks, xTicks } = loanCurve;
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
                            {/* Pension return reference */}
                            <line x1={PL} x2={VW-PR} y1={sy(pensionReturn)} y2={sy(pensionReturn)} stroke="#d4b97a" strokeWidth="2.5" strokeDasharray="10,5"/>
                            <text x={VW-PR-8} y={sy(pensionReturn)-10} fontSize="14" fontWeight="700" fill="#d4b97a" textAnchor="end">Pension {d.pensionType==="sacrifice"?"(salary sacrifice)":d.pensionType==="relief"?"(relief at source)":"return"} {pensionReturn.toFixed(2)}×</text>
                            {/* Mortgage reference */}
                            {sy(mortReturn) > PT + 20 && sy(mortReturn) < VH-PB - 20 && (
                              <>
                                <line x1={PL} x2={VW-PR} y1={sy(mortReturn)} y2={sy(mortReturn)} stroke={MUT} strokeWidth="1.5" strokeDasharray="8,5" opacity="0.55"/>
                                <text x={VW-PR-8} y={sy(mortReturn)-8} fontSize="13" fill={MUT} textAnchor="end" opacity="0.7">Mortgage {mortRate}%</text>
                              </>
                            )}
                            {/* Loan curve */}
                            <path d={path} fill="none" stroke={GOLD} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                            {/* Crossover: drop line + glow + dot */}
                            {crossX !== null && (
                              <>
                                <line x1={crossX} x2={crossX} y1={PT} y2={VH-PB} stroke={GOLD} strokeWidth="1.5" strokeDasharray="6,4" opacity="0.45"/>
                                <circle cx={crossX} cy={crossY} r="14" fill={GOLD} opacity="0.22"/>
                                <circle cx={crossX} cy={crossY} r="8" fill={GOLD}/>
                              </>
                            )}
                            {/* X-axis */}
                            <line x1={PL} x2={VW-PR} y1={VH-PB} y2={VH-PB} stroke="rgba(22,47,36,0.25)" strokeWidth="3"/>
                            {xTicks.map((amt,i) => (
                              <text key={i} x={sx(amt)} y={VH-PB+22} fontSize="16" fontWeight="700" fill={MUT} textAnchor="middle">
                                {i===0?"£0":i===4?fmt(amt):"£"+Math.round(amt/1000)+"k"}
                              </text>
                            ))}
                            <text x={VW/2} y={VH-6} fontSize="15" fill={MUT} textAnchor="middle" opacity="0.7">Overpayment amount →</text>
                            {/* Y-axis */}
                            <line x1={PL} x2={PL} y1={PT} y2={VH-PB} stroke="rgba(22,47,36,0.25)" strokeWidth="3"/>
                            {/* Speech bubble at crossover */}
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

                    {!products.slSection.willClear && (
                      <div style={{background:"rgba(196,150,58,0.07)",border:`1px solid ${GOLD}`,borderRadius:"10px",padding:"14px 16px",marginBottom:"12px"}}>
                        <div style={{fontSize:"11px",fontWeight:700,color:GOLD,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"6px"}}>Overpaying is almost certainly not worth it</div>
                        <p style={{fontSize:"13px",color:TEXT,lineHeight:1.65,margin:0}}>Your loan is projected to be written off before you can clear it. Voluntary overpayments reduce the amount written off — but you never see that money again. Redirect any spare cash to your pension (free tax relief) or ISA (tax-free growth) instead.</p>
                      </div>
                    )}

                    {/* Cash comparison callout */}
                    {products.slSection.cashSavings > 5000 && (
                      <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"14px 16px",marginTop:"4px"}}>
                        <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"6px"}}>vs holding cash</div>
                        <p style={{fontSize:"13px",color:TEXT,lineHeight:1.65}}>
                          You hold {fmt(products.slSection.cashSavings)} in cash earning ~{products.slSection.cashRate}%. Your loan accrues at ~{products.slSection.slRatePct}%.
                          {products.slSection.effectiveBenefit > 0
                            ? ` Overpaying has an effective advantage of ${products.slSection.effectiveBenefit}% over keeping that cash — but only if you will actually clear the loan before write-off.`
                            : ` The loan will be written off before you'd clear it, so the effective benefit of overpaying is negative. Keep the cash earning ${products.slSection.cashRate}%.`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Expandable: other cash-like options (cash module only) */}
            {moduleKey === "cash" && (
              <div style={{marginTop:"8px"}}>
                <button type="button" onClick={() => setExpandAlt(v => !v)} style={{width:"100%",padding:"13px 18px",background:"rgba(22,47,36,0.04)",border:"1px solid rgba(22,47,36,0.12)",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",marginBottom: expandAlt ? "12px" : "0"}}>
                  <span style={{fontSize:"14px",fontWeight:600,color:G}}>Explore other cash-like options</span>
                  <span style={{fontSize:"18px",color:MUT,transform: expandAlt ? "rotate(180deg)" : "none",transition:"transform 0.2s"}}>›</span>
                </button>
                {expandAlt && (
                  <div>
                    <p style={{fontSize:"13px",color:MUT,lineHeight:1.65,marginBottom:"14px"}}>Beyond easy-access savings accounts, there are other low-risk places to park cash — each with different trade-offs on rate, liquidity, and tax efficiency.</p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"12px",marginBottom:"12px"}}>
                      {altProducts.map((p,i) => <ProductCard key={i} p={p} onInternalLink={onOpenModule}/>)}
                    </div>
                    <p style={{fontSize:"11px",color:MUT,lineHeight:1.6,padding:"10px 0",borderTop:"1px solid rgba(22,47,36,0.08)"}}>All rates indicative as of early 2026. Premium bonds prize rate is an average — individual returns vary. Gilts and money market funds carry low but non-zero risk. Candid may earn a referral fee.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Alternative investments (investments module) ── */}
        {moduleKey === "investments" && (
          <AlternativeInvestments age={d.age}/>
        )}

        {/* ── Take Me There (investments module) ── */}
        {moduleKey === "investments" && m.isaHeadroom > 0 && (
          <div style={{marginTop:"16px",background:"rgba(22,47,36,0.03)",border:"1px solid rgba(22,47,36,0.1)",borderRadius:"12px",padding:"16px 18px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Take me there</div>
            <p style={{fontSize:"13px",color:MUT,lineHeight:1.6,marginBottom:"12px"}}>
              Ready to act? In the full app, these would deep-link directly into your existing investment platforms.
            </p>
            <TakeMeThere app="Hargreaves Lansdown" icon="📱" message={`Top up my HL ISA — ${fmt(m.isaHeadroom)} allowance left before April 5th`} demoNote="Would open HL app to ISA top-up screen"/>
            <TakeMeThere app="Vanguard" icon="📱" message="Open Vanguard S&S ISA" demoNote="Would open Vanguard app to ISA setup"/>
          </div>
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

        {/* ── Salary sacrifice calculator (taper zone: £80k–£125,140) ── */}
        {showSacrificeCalc && (() => {
          const ani = m.adjustedNetIncome;
          const taperStart = 100000, taperEnd = 125140;
          const inTaper = ani > taperStart;
          const sacrificeToEscape = inTaper ? Math.ceil((ani - taperStart) / 2) : 0; // each £2 sacrifice restores £1 PA
          const sacrificeToFullPA = inTaper ? Math.ceil((ani - taperStart) / 2) : Math.max(0, taperStart - ani);
          const niSaving = Math.round(sacrificeToFullPA * 0.02); // employee NI 2% on this band
          const taxSaving = inTaper ? Math.round(sacrificeToFullPA * 0.60) : 0; // effective 60% in taper
          const totalSaving = niSaving + taxSaving;
          return (
            <div style={{background:"rgba(192,57,43,0.04)",border:"1px solid rgba(192,57,43,0.2)",borderRadius:"12px",padding:"20px 22px",marginBottom:"16px"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:"#c0392b",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"8px"}}>
                {inTaper ? "⚠️ You're in the 60% effective rate zone" : "📌 Salary sacrifice opportunity"}
              </div>
              <h3 style={{fontFamily:SERIF,fontSize:"17px",color:G,marginBottom:"8px",lineHeight:1.3}}>
                {inTaper
                  ? `Sacrificing ${fmt(sacrificeToFullPA)} recovers your full personal allowance`
                  : `You're ${fmt(Math.max(0, taperStart - ani))} below the £100k taper — sacrifice could be very powerful`}
              </h3>
              <p style={{fontSize:"13px",color:MUT,lineHeight:1.65,marginBottom:"12px"}}>
                {inTaper
                  ? `Between £100,000 and £125,140, your personal allowance is withdrawn at £1 for every £2 earned — creating an effective 60% tax rate. Salary sacrifice reduces your adjusted net income, restoring the allowance and saving roughly ${fmt(totalSaving)} in tax and NI on that portion.`
                  : `Your income is in the £80k–£100k zone. Sacrificing into your pension now builds wealth efficiently — and if your income rises above £100k (through bonus or growth), pre-existing sacrifice reduces the taper impact.`}
              </p>
              {inTaper && totalSaving > 0 && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",textAlign:"center"}}>
                  <div style={{background:WHITE,borderRadius:"8px",padding:"12px 8px"}}>
                    <div style={{fontFamily:SERIF,fontSize:"20px",color:G,fontWeight:700}}>{fmt(sacrificeToFullPA)}</div>
                    <div style={{fontSize:"11px",color:MUT,marginTop:"3px"}}>sacrifice needed</div>
                  </div>
                  <div style={{background:WHITE,borderRadius:"8px",padding:"12px 8px"}}>
                    <div style={{fontFamily:SERIF,fontSize:"20px",color:"#2d6b4a",fontWeight:700}}>{fmt(taxSaving)}</div>
                    <div style={{fontSize:"11px",color:MUT,marginTop:"3px"}}>tax saved</div>
                  </div>
                  <div style={{background:GOLD,borderRadius:"8px",padding:"12px 8px"}}>
                    <div style={{fontFamily:SERIF,fontSize:"20px",color:G,fontWeight:700}}>{fmt(totalSaving)}</div>
                    <div style={{fontSize:"11px",color:G,marginTop:"3px",fontWeight:600}}>total saving</div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Bonus sacrifice calculator (pension module) ── */}
        {moduleKey === "pension" && (
          <div id="bonus-sacrifice-panel" style={{marginTop:"8px"}}>
            {!showBonus && (
              <div style={{background:"rgba(196,150,58,0.07)",border:"1px solid rgba(196,150,58,0.25)",borderRadius:"12px",padding:"16px 20px",marginBottom:"8px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:"15px",fontWeight:600,color:G,marginBottom:"4px"}}>Lucky you — you're getting a bonus 🎉</div>
                  <div style={{fontSize:"13px",color:MUT,lineHeight:1.5}}>Have you heard of salary sacrifice? You could keep significantly more.</div>
                </div>
                <button type="button" onClick={() => setShowBonus(true)} style={{background:G,border:"none",borderRadius:"8px",padding:"10px 18px",color:WHITE,fontSize:"13px",fontWeight:700,cursor:"pointer",flexShrink:0}}>
                  Learn more {"&"} earn more →
                </button>
              </div>
            )}
            <button type="button" onClick={() => setShowBonus(v => !v)} style={{width:"100%",padding:"13px 18px",background:showBonus?G:"rgba(22,47,36,0.04)",border:`1px solid ${showBonus?G:"rgba(22,47,36,0.12)"}`,borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",marginBottom:showBonus?"16px":"0",transition:"all 0.2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <span style={{fontSize:"16px"}}>💰</span>
                <span style={{fontSize:"14px",fontWeight:600,color:showBonus?WHITE:G}}>Model bonus sacrifice</span>
              </div>
              <span style={{fontSize:"16px",color:showBonus?GOLD:MUT,transform:showBonus?"rotate(180deg)":"none",transition:"transform 0.2s"}}>›</span>
            </button>
            {showBonus && (
              <div style={{background:WHITE,border:"1px solid rgba(22,47,36,0.09)",borderRadius:"12px",padding:"22px",marginBottom:"8px"}}>
                <p style={{fontSize:"14px",color:MUT,lineHeight:1.7,marginBottom:"20px"}}>
                  Sacrificing your bonus before it hits your payslip means you never pay tax, NI{bonusSlRate > 0 ? ", or student loan repayments" : ""} on that money. It goes into your pension gross, grows free of tax, and is only taxed when you draw it — typically at a lower rate in retirement.
                </p>
                <div style={{marginBottom:"20px"}}>
                  <label style={{...LBL,marginBottom:"6px"}}>Bonus amount to model (£)</label>
                  <input type="number" style={{...INP,fontSize:"18px",fontWeight:600,fontFamily:SERIF}}
                    value={bonusInput} onChange={e => setBonusInput(Math.max(0,+e.target.value))} placeholder="e.g. 10,000"/>
                </div>
                {bonus > 0 && (
                  <>
                    {(crossesTaper || crossesAR) && (
                      <div style={{background:"rgba(192,57,43,0.05)",border:"1px solid rgba(192,57,43,0.2)",borderRadius:"10px",padding:"12px 16px",marginBottom:"16px",display:"flex",gap:"10px",alignItems:"flex-start"}}>
                        <span style={{fontSize:"15px",flexShrink:0}}>⚠️</span>
                        <div>
                          <div style={{fontSize:"13px",fontWeight:600,color:"#c0392b",marginBottom:"3px"}}>
                            {crossesTaper && !crossesAR ? "Your bonus crosses the 60% taper zone (£100k–£125,140)" : "Your bonus spans the 40% → 60% taper → 45% rate bands"}
                          </div>
                          <div style={{fontSize:"12px",color:MUT,lineHeight:1.5}}>Between £100,000 and £125,140 your personal allowance is progressively withdrawn — creating an effective 60% marginal rate. Sacrificing the portion of your bonus that lands here is especially valuable. The rate shown is the average across the full bonus.</div>
                        </div>
                      </div>
                    )}
                    <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"10px",padding:"16px 18px",marginBottom:"20px"}}>
                      <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:"12px"}}>For every £1 of your bonus — with no sacrifice</div>
                      <div style={{display:"grid",gridTemplateColumns:`repeat(${bonusSlRate > 0 ? 4 : 3},1fr)`,gap:"8px"}}>
                        <div style={{textAlign:"center",padding:"10px 6px",background:"rgba(192,57,43,0.06)",borderRadius:"8px"}}>
                          <div style={{fontFamily:SERIF,fontSize:"22px",color:"#c0392b",fontWeight:700}}>{fullTaxPct}p</div>
                          <div style={{fontSize:"10px",color:MUT,marginTop:"3px",lineHeight:1.3}}>income tax<br/>({fullTaxPct}% eff.)</div>
                        </div>
                        <div style={{textAlign:"center",padding:"10px 6px",background:"rgba(196,150,58,0.08)",borderRadius:"8px"}}>
                          <div style={{fontFamily:SERIF,fontSize:"22px",color:GOLD,fontWeight:700}}>{fullNIPct}p</div>
                          <div style={{fontSize:"10px",color:MUT,marginTop:"3px",lineHeight:1.3}}>NI<br/>({fullNIPct}%)</div>
                        </div>
                        {bonusSlRate > 0 && (
                          <div style={{textAlign:"center",padding:"10px 6px",background:"rgba(22,47,36,0.06)",borderRadius:"8px"}}>
                            <div style={{fontFamily:SERIF,fontSize:"22px",color:"#1e4030",fontWeight:700}}>{fullSLPct}p</div>
                            <div style={{fontSize:"10px",color:MUT,marginTop:"3px",lineHeight:1.3}}>student<br/>loan (9%)</div>
                            {loanBal > 0 && <div style={{marginTop:"4px",fontSize:"9px",color:"#2d6b4a",fontWeight:600,lineHeight:1.3}}>{m.willClear ? "clears faster" : "likely written off"}</div>}
                          </div>
                        )}
                        <div style={{textAlign:"center",padding:"10px 6px",background:"rgba(45,107,74,0.08)",borderRadius:"8px"}}>
                          <div style={{fontFamily:SERIF,fontSize:"22px",color:"#2d6b4a",fontWeight:700}}>{fullKeepPct}p</div>
                          <div style={{fontSize:"10px",color:MUT,marginTop:"3px",lineHeight:1.3}}>you keep</div>
                        </div>
                      </div>
                      {bonusSlRate > 0 && loanBal > 0 && (
                        <div style={{marginTop:"10px",padding:"8px 10px",background:"rgba(22,47,36,0.04)",borderRadius:"6px",fontSize:"11px",color:MUT,lineHeight:1.6}}>
                          {m.willClear
                            ? `📌 The ${fmt(slRepaymentFromBonus)} student loan deduction from this bonus brings your clear date forward, saving roughly ${fmt(slInterestSaved)} in interest.`
                            : `📌 Your loan is unlikely to clear before write-off. The ${fmt(slRepaymentFromBonus)} that would be deducted from this bonus would almost certainly be written off anyway — sacrificing avoids it entirely.`
                          }
                        </div>
                      )}
                    </div>
                    <div style={{marginBottom:"20px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
                        <label style={LBL}>How much to sacrifice?</label>
                        <span style={{fontFamily:SERIF,fontSize:"18px",fontWeight:700,color:G}}>{sacrificePct}%</span>
                      </div>
                      <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
                        {[0,25,50,75,100].map(pct => (
                          <button key={pct} type="button" onClick={() => setSacrificePct(pct)} style={{flex:1,padding:"9px 4px",background:sacrificePct===pct?G:"transparent",border:`1.5px solid ${sacrificePct===pct?G:"rgba(22,47,36,0.2)"}`,borderRadius:"8px",color:sacrificePct===pct?WHITE:G,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{pct}%</button>
                        ))}
                      </div>
                      <input type="range" min="0" max="100" step="1" value={sacrificePct} onChange={e => setSacrificePct(+e.target.value)} style={{width:"100%",accentColor:G}}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"16px"}}>
                      <div style={{background:"rgba(45,107,74,0.06)",border:"1px solid rgba(45,107,74,0.22)",borderRadius:"10px",padding:"14px 16px"}}>
                        <div style={{fontSize:"10px",fontWeight:700,color:"#2d6b4a",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"10px"}}>You receive</div>
                        <div style={{fontFamily:SERIF,fontSize:"20px",color:G,fontWeight:700,marginBottom:"8px"}}>{fmt(totalReceived)}</div>
                        <div style={{fontSize:"12px",color:MUT,display:"flex",flexDirection:"column",gap:"3px"}}>
                          {sacrificedAmt > 0 && <span style={{color:"#2d6b4a",fontWeight:500}}>Pension: {fmt(sacrificedAmt)}</span>}
                          {takeHomeCash > 0 && <span>Cash: {fmt(takeHomeCash)}</span>}
                          {employerNISave > 0 && <span style={{color:"#2d6b4a",marginTop:"4px"}}>+ {fmt(employerNISave)} employer NI saved*</span>}
                        </div>
                      </div>
                      <div style={{background:"rgba(192,57,43,0.05)",border:"1px solid rgba(192,57,43,0.18)",borderRadius:"10px",padding:"14px 16px"}}>
                        <div style={{fontSize:"10px",fontWeight:700,color:"#c0392b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"10px"}}>Paid to HMRC{bonusSlRate>0?" + SLC":""}</div>
                        <div style={{fontFamily:SERIF,fontSize:"20px",color:TEXT,fontWeight:700,marginBottom:"8px"}}>{sacrificePct===100?fmt(0):fmt(totalDeducted)}</div>
                        <div style={{fontSize:"12px",color:MUT,display:"flex",flexDirection:"column",gap:"3px"}}>
                          {sacrificePct===100
                            ? <span style={{color:"#2d6b4a",fontWeight:600}}>Nothing — full sacrifice 🎉</span>
                            : <>{taxOnCash>0&&<span>Tax: {fmt(taxOnCash)} ({Math.round(bonusTaxDetail.effectiveRate*100)}% eff.)</span>}{niOnCash>0&&<span>NI: {fmt(niOnCash)}</span>}{slOnCash>0&&<span>Student loan: {fmt(slOnCash)}</span>}</>
                          }
                        </div>
                      </div>
                    </div>
                    <div style={{background:G,borderRadius:"10px",padding:"16px 18px",marginBottom:"12px"}}>
                      <div style={{fontSize:"11px",fontWeight:700,color:GOLD,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"12px"}}>If sacrificed today — value at retirement (age {retireAge})</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px"}}>
                        {[100,50,0].map(pct => {
                          const active = sacrificePct === pct;
                          return (
                            <div key={pct} onClick={() => setSacrificePct(pct)} style={{textAlign:"center",padding:"12px 8px",borderRadius:"8px",background:active?"rgba(196,150,58,0.18)":"rgba(255,255,255,0.05)",cursor:"pointer",border:`1px solid ${active?"rgba(196,150,58,0.4)":"transparent"}`,transition:"all 0.2s"}}>
                              <div style={{fontSize:"11px",color:active?GOLD:"rgba(255,255,255,0.5)",marginBottom:"6px",fontWeight:active?700:400}}>{pct}% sacrificed</div>
                              <div style={{fontFamily:SERIF,fontSize:"clamp(14px,3vw,20px)",color:active?GOLD:WHITE,fontWeight:700,marginBottom:"2px"}}>{fmt(bonusFVpartial(pct))}</div>
                              <div style={{fontSize:"9px",color:"rgba(255,255,255,0.35)"}}>in {years} yrs at 6%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p style={{fontSize:"11px",color:MUT,lineHeight:1.6}}>
                      Tax rate shown is the effective average across the bonus — it may exceed your salary tax band if total income crosses the £100k personal allowance taper or £125,140 additional rate threshold. * Employer NI of 13.8% on sacrificed amount — some employers pass this on. Future values assume 6% p.a. growth, undrawn until retirement.
                    </p>
                  </>
                )}
              </div>
            )}
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
              <button type="button" onClick={() => { if (!isComplete) onComplete(); onOpenModule(nextModule.key); }} style={{flex:2,padding:"13px",background:G,border:"none",borderRadius:"10px",color:WHITE,fontSize:"14px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
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
  studentLoan:"none", loanBalance:"",
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
  const [showScorePulse,  setShowScorePulse]  = useState(false);
  const [lastScoreDelta,  setLastScoreDelta]  = useState(0);
  const [lastCompletedModule, setLastCompletedModule] = useState(null);
  const [scoreDeltas, setScoreDeltas] = useState([]);
  const feedbackFired = useRef(false);
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

  const m = useMemo(() => calcMetrics(d), [d]);
  const statuses = useMemo(() => computeModuleStatuses(d, m), [d, m]);

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
  const timeout = new Promise((_,reject) => setTimeout(() => reject(new Error("timeout")), 28000));
  const call = fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:maxTokens,messages:[{role:"user",content:prompt}]})
  });
  const res = await Promise.race([call, timeout]);
  const json = await res.json();
  const raw = (json.content?.[0]?.text||"").replace(/```json|```/g,"").trim();
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("[Candid] Claude returned malformed JSON — falling back.", raw);
    throw new Error("Claude response was truncated or malformed");
  }
}

  async function generateDashboard() {
    if (insights) { setPrevInsights(insights); prevScoreRef.current = insights.score; }
    setScreen("loading");

    // ── Reuse the metrics/statuses already computed for this render — no need to recalculate ──
    const metrics = m;
    const isaPrev = (+d.isaPrevCash||0)+(+d.isaPrevSS||0)+(+d.isaPrevLISA||0)+(+d.isaPrevOther||0);
    const totalOppForSummary = Object.entries(statuses).reduce((sum, [,v]) => sum + Math.min(v.impact||0, 99998), 0);

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
        investments:{status:"attention",summary:"ISA allowance may not be fully utilised this tax year."},
        pension:{status:"attention",summary:"Review your pension contributions and projected retirement pot."},
        studentLoan:{status:"attention",summary:"Overpayment strategy worth reviewing at your income level."},
        mortgage:{status:"na",summary:"Not applicable based on your inputs."},
        personalLoan:{status:"na",summary:"Not applicable based on your inputs."},
        kids:{status:"na",summary:"Not applicable based on your inputs."},
      }
    };
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
      if (import.meta.env.DEV) console.warn("[Candid] AI generation failed, using fallback insights:", e);
      setInsights(fallback);
      try {
        localStorage.setItem('candid_insights', JSON.stringify(fallback));
        localStorage.setItem('candid_insights_date', new Date().toISOString());
      } catch(e) { if (import.meta.env.DEV) console.warn("[Candid] Failed to persist fallback insights to localStorage:", e); }
      posthog.capture("report_generated", { score: fallback.score, fallback: true, error: e?.message });
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
      <Dashboard insights={insights} d={d} m={m} statuses={statuses} onReset={resetAll} completedModules={completedModules}
        onOpenModule={key => openModule(key, "dashboard")}
        onEditInputs={() => { setStep(0); setScreen("onboarding"); }}
        prevInsights={prevInsights} whatChangedOpen={whatChangedOpen} onDismissWhatChanged={() => setWhatChangedOpen(false)}
        showScorePulse={showScorePulse} lastScoreDelta={lastScoreDelta} lastCompletedModule={lastCompletedModule}
        prevScoreRef={prevScoreRef} scoreDeltas={scoreDeltas}/>
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
        <ModuleDeepDive moduleKey={activeModule} insights={insights} d={d} m={m} statuses={statuses}
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
