import { useState, useEffect } from "react";

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

// ── User contributing to pension ────────────────────────────────────────────────────────
function isPensionContributing(d) {
  return Number(d.myContribution) > 0;
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

function calcMetrics(d) {
  const salary = +d.salary||0, expenses = +d.monthlyExpenses||0,
        cash = +d.cashSavings||0, bonds = +d.premiumBonds||0,
        totalLiquid = cash + bonds,
        runwayMonths = expenses > 0 ? totalLiquid / expenses : 0,
        surplusCash = Math.max(0, totalLiquid - expenses * 6),
        isaHeadroom = 20000 - (+d.isaUsedThisYear||0),
        myPct = +d.myContribution||0, empPct = +d.employerMatch||0,
        missedMatch = Math.max(0, empPct - myPct) * salary / 100,
        potVal = +d.potValue||0, retireAge = +d.retirementAge||65,
        age = +d.age||30, years = Math.max(1, retireAge - age),
        annualContrib = (myPct + empPct) / 100 * salary,
        projectedPot = potVal * Math.pow(1.06, years) +
          annualContrib * ((Math.pow(1.06, years) - 1) / 0.06);
  let annualRepayment = 0, willClear = false;
  const loanBal = +d.loanBalance||0;
  if (d.studentLoan === "plan2") {
    annualRepayment = Math.max(0, (salary - 27295) * 0.09);
    willClear = annualRepayment > 0 && loanBal / annualRepayment <= 30;
  } else if (d.studentLoan === "plan5") {
    annualRepayment = Math.max(0, (salary - 25000) * 0.09);
    willClear = annualRepayment > 0 && loanBal / annualRepayment <= 40;
  } else if (d.studentLoan === "plan1") {
    annualRepayment = Math.max(0, (salary - 24990) * 0.09);
    willClear = annualRepayment > 0 && loanBal / annualRepayment <= 25;
  }
  // Derive tax band automatically from adjusted net income (salary + other income - pension sacrifice)
  const otherIncome = +d.otherIncome||0;
  const pensionSacrifice = salary * (+d.myContribution||0) / 100; // salary sacrifice reduces ANI
  const adjustedNetIncome = salary + otherIncome - pensionSacrifice;
  const tr = adjustedNetIncome > 125140 ? 0.45
           : adjustedNetIncome > 50270  ? 0.40
           : 0.20;
  const taxBandLabel = adjustedNetIncome > 125140 ? "additional" : adjustedNetIncome > 50270 ? "higher" : "basic";
  const gains = +d.unrealisedGains||0, crystallisable = Math.min(gains, 3000),
        cgtRate = tr !== 0.20 ? 0.20 : 0.10,
        cgtSaving = crystallisable * cgtRate,
        savingsRate = +d.savingsRate||3.5,
        annualYieldGap = surplusCash * (5.1 - savingsRate) / 100;
  // Net worth
  const totalIsaValue = (+d.isaUsedThisYear||0) + (+d.isaPreviousBalance||0);
  const totalAssets = totalLiquid + totalIsaValue + (+d.unwrappedValue||0) + potVal;
  const totalLiabilities = loanBal + (+d.mortgageBalance||0) + (+d.personalLoanBalance||0);
  const netWorth = totalAssets - totalLiabilities;
  return {
    salary, expenses, totalLiquid, runwayMonths, surplusCash, isaHeadroom,
    missedMatch, annualRepayment, willClear, crystallisable, cgtSaving,
    projectedPot, years, annualYieldGap, savingsRate, loanBal, tr,
    cash, bonds, totalAssets, totalLiabilities, netWorth,
    taxBandLabel, adjustedNetIncome
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
          label:"Cash runway", value: m.runwayMonths.toFixed(1)+" months", flag: m.runwayMonths > 9 || m.runwayMonths < 3,
          tooltip:`Runway = total liquid assets (${fmt(m.totalLiquid)}) ÷ monthly expenses (${fmt(m.expenses)}). The recommended buffer is 3–6 months. Yours is ${m.runwayMonths > 9 ? "well above — consider putting surplus to work" : m.runwayMonths < 3 ? "below the safe minimum — build this up before investing" : "in the ideal range"}.`
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
          label:"Tax relief rate", value: trPct+"%", flag: false,
          tooltip:`Every £${100-trPct} you contribute, the government adds £${trPct} via tax relief — making the effective contribution ${fmt(100)}. A ${trPct}% rate taxpayer contributing £1,000/yr actually costs them £${100-trPct}0 in take-home pay. Higher-rate relief is claimed via self-assessment if not applied at source.`
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
      ];
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
      return [
        { label:"Outstanding balance", value: bal > 0 ? fmt(bal) : "—", flag: bal > 5000,
          tooltip:`Your personal loan balance. At ${rate}% AER, you're paying ~${fmt(annualInterest)}/yr in interest on this balance.` },
        { label:"Interest rate", value: rate > 0 ? rate+"% AER" : "—", flag: rate > 8,
          tooltip:`${rate > 8 ? "This is a high rate." : "This is a moderate rate."} Compare to: ISA/savings rate ~${savingsRate}%, pension tax relief ${Math.round(m.tr*100)}%. Overpaying this loan gives a guaranteed ${rate}% return.` },
        { label:"Total interest remaining", value: totalInterestRemaining > 0 ? fmt(totalInterestRemaining) : "—", flag: totalInterestRemaining > 500,
          tooltip:`If you make only the minimum payments over ${mos} months, you'll pay ~${fmt(totalInterestRemaining)} in interest on top of your ${fmt(bal)} balance. Overpaying reduces this directly.` },
        { label:"vs saving: net benefit of overpaying", value: +overpayBenefit > 0 ? `+${overpayBenefit}%` : `${overpayBenefit}%`, flag: +overpayBenefit > 0,
          tooltip:`Your loan rate (${rate}%) minus your savings rate (${savingsRate}%). Overpaying the loan gives a guaranteed ${rate}% return — better than leaving cash in savings by ${overpayBenefit}%. This is the risk-free, after-tax comparison.` },
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
    case "insurance": {
      const hasMortgage = d.hasMortgage === "yes";
      const hasKids = d.hasKids === "yes";
      const noLife = d.hasLifeInsurance !== "yes";
      const noIP   = d.hasIncomeProtection !== "yes";
      const noCI   = d.hasCriticalIllness !== "yes";
      const salary = m.salary;
      const ipCostEst = Math.round(salary * 0.015 / 12);
      const lifeCostEst = 15;
      return [
        { label:"Life insurance", value: d.hasLifeInsurance==="yes" ? "✓ In place" : "Not held", flag: noLife && (hasMortgage || hasKids),
          tooltip:`Life insurance pays a lump sum if you die. ${hasMortgage ? "With a mortgage, this ensures your partner isn't left with a debt they can't service." : ""} ${hasKids ? "With children, it replaces your income until they're independent." : ""} Level term cover (same payout throughout) is the most common and cheapest form. A healthy 29-year-old can get £500,000 of cover for ~£${lifeCostEst}/month.` },
        { label:"Income protection", value: d.hasIncomeProtection==="yes" ? "✓ In place" : "Not held", flag: noIP,
          tooltip:`Income protection pays a proportion of your salary (typically 50-70%) if you can't work due to illness or injury. State sick pay (SSP) is only £116/week — far below your ${fmt(salary/52)}/week salary. At your income, this is arguably the most important insurance you can hold. Estimated cost: ~${fmt(ipCostEst)}/month.` },
        { label:"Critical illness", value: d.hasCriticalIllness==="yes" ? "✓ In place" : "Not held", flag: noCI,
          tooltip:`Critical illness cover pays a tax-free lump sum on diagnosis of a serious illness (cancer, heart attack, stroke, etc.). Unlike income protection it's a one-off payment — useful for clearing a mortgage or adapting your home. Often bundled with life insurance.` },
        { label:"Contents / buildings", value: d.hasContentsInsurance==="yes" ? "✓ In place" : d.hasContentsInsurance==="na" ? "Renting (N/A)" : "Not held", flag: d.hasContentsInsurance==="no",
          tooltip:`${hasMortgage ? "Buildings insurance is a legal requirement for most mortgages." : "Contents insurance protects your possessions against theft, fire, and accidental damage."} As a renter, your landlord covers buildings — but contents insurance is still worth having.` },
      ];
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
          { name:"Your pension", type:"Alternative use of funds", rate:Math.round(m.tr*100)+"% instant return", badge:"Best alternative", feature:`A pension contribution gives an immediate ${Math.round(m.tr*100)}% return via tax relief. Even if your loan balance is growing, this outperforms the ${slRatePct}% loan rate for most people.`, cta:"Go to Pension", highlight:!m.willClear, internalLink:"pension" },
          { name:"Cash ISA", type:"Alternative use of funds", rate:`Up to 5.08% AER`, badge:"Tax-free", feature:`Your savings rate is ${cashRate}%. Net benefit of overpaying vs saving: ${effectiveBenefit > 0 ? `${Math.round(effectiveBenefit*10)/10}% in favour of overpaying` : "saving wins — keep cash in ISA"}.`, cta:"Go to Savings", highlight:false, internalLink:"cash" },
          { name:"Student Finance", type:"Official balance check", rate:"", badge:"Free", feature:"Verify your exact balance, interest rate and repayment history at studentfinance.service.gov.uk.", cta:"Check balance", highlight:false },
        ],
        disclaimer:"Interest rates are estimates based on current RPI and plan thresholds. Actual rates vary — check your SLC online account. This is guidance only. Consider speaking to an IFA before making large overpayments.",
        slSection: {
          balanceGrowing, inflectionSalary, slRatePct, scenarios,
          baseProjection, cashRate, writeOffYr, annualRep, annualInterest,
          effectiveBenefit: Math.round(effectiveBenefit * 10) / 10,
          cashSavings: m.cash + m.bonds,
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
          { name:"Your pension first",     type:"Priority check", rate:Math.round(m.tr*100)+"% instant return", badge:"Check this first", feature:`Pension tax relief gives an immediate ${Math.round(m.tr*100)}% return. If you haven't maxed employer match, do that before any debt overpayment.`, cta:"Go to Pension", highlight:rate < 15, internalLink:"pension", appIcon:"🏦", demoNote:"Would open Pension module" },
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
    case "insurance": {
      const hasMortgage = d.hasMortgage === "yes";
      const hasKids = d.hasKids === "yes";
      const salary = m.salary;
      const ipReplacement = Math.round(salary * 0.6 / 12);
      return {
        heading:"Your protection gaps — and how to close them",
        subheading: `Insurance isn't exciting — but the absence of it at the wrong moment is catastrophic. Based on your profile, ${[d.hasLifeInsurance!=="yes"&&"life insurance",d.hasIncomeProtection!=="yes"&&"income protection",d.hasCriticalIllness!=="yes"&&"critical illness cover"].filter(Boolean).join(", ")} ${[d.hasLifeInsurance,d.hasIncomeProtection,d.hasCriticalIllness].filter(v=>v!=="yes").length>1?"are":"is"} not in place.`,
        products: [
          { name:"Life insurance",       type:"Term cover",          rate:"From ~£10/month", badge: (!d.hasLifeInsurance||d.hasLifeInsurance!=="yes") ? "Not held" : "✓ Held", feature:`A healthy 29-year-old can get £500,000 of cover for as little as £10-15/month. ${hasMortgage?"Essential with a mortgage.":""} ${hasKids?"Critical with dependants.":""}`, cta:"Compare quotes", highlight:d.hasLifeInsurance!=="yes" && (hasMortgage||hasKids), appIcon:"🛡️", demoNote:"Would open Compare the Market" },
          { name:"Income protection",    type:"Long-term sick pay",  rate:"50–70% of salary", badge:d.hasIncomeProtection!=="yes"?"Not held":"✓ Held", feature:`Replaces ~${fmt(ipReplacement)}/month of your income if illness stops you working. State sick pay covers only £116/week. This is the most overlooked insurance for high earners.`, cta:"Get a quote", highlight:d.hasIncomeProtection!=="yes", appIcon:"💼", demoNote:"Would open Drewberry" },
          { name:"Critical illness",     type:"Lump sum on diagnosis",rate:"From ~£20/month", badge:d.hasCriticalIllness!=="yes"?"Not held":"✓ Held", feature:"Pays a tax-free lump sum on serious diagnosis. Often used to clear a mortgage or cover adaptation costs. Often bundled with life insurance for better value.", cta:"Get a quote", highlight:false, appIcon:"❤️", demoNote:"Would open Cavendish Online" },
          { name:"Contents insurance",   type:"Home & possessions",  rate:"From ~£5/month",  badge:d.hasContentsInsurance==="no"?"Not held":"✓ Held / N/A", feature:`Protects your possessions against theft, fire, and damage. If renting, your landlord covers buildings — but your contents aren't covered unless you arrange your own policy.`, cta:"Compare quotes", highlight:d.hasContentsInsurance==="no", appIcon:"🏡", demoNote:"Would open MoneySupermarket" },
        ],
        disclaimer:"Insurance premiums vary by age, health, and circumstances. Quotes shown are illustrative. Always read the full policy terms. A financial adviser can help identify the right level of cover. Candid may earn a referral fee."
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
  if (key === "personalLoan" && m.surplusCash > +d.personalLoanBalance * 1.5) {
    links.push({ icon:"💷", text:`You have ${fmt(m.surplusCash)} of surplus cash — enough to clear this loan entirely. Weigh the guaranteed ${d.personalLoanRate}% return of clearing vs keeping cash liquid.`, label:"Review cash position", target:"cash" });
  }
  if (key === "kids" && m.isaHeadroom > 5000) {
    links.push({ icon:"📈", text:"Maximise your own ISA before the kids' JISAs — your tax-free allowance is larger and the principle applies equally.", label:"Review your ISA", target:"investments" });
  }
  if (key === "kids" && d.hasPension !== "yes") {
    links.push({ icon:"🏦", text:"Sorting your own pension before a child's JISA will give you more money to pass on in the long run.", label:"Set up your pension first", target:"pension" });
  }
  if (key === "insurance" && d.hasMortgage === "yes" && d.hasLifeInsurance !== "yes") {
    links.push({ icon:"🏠", text:"Most mortgage providers recommend life insurance — your outstanding mortgage could become a burden on your estate or partner without it.", label:"Review mortgage", target:"mortgage" });
  }
  if (key === "mortgage" && m.isaHeadroom > 5000) {
    links.push({ icon:"📈", text:`Before overpaying your mortgage, consider whether maxing your ISA (${fmt(m.isaHeadroom)} remaining) is a better use of the same cash.`, label:"Review in Investments", target:"investments" });
  }
  return links;
}

// ── Concern config (unchanged from v3) ────────────────────────────────────────
const CONCERN_LIST = [
  { id:"mortgage",     icon:"🏠", label:"Mortgage",        tagline:"Rate, overpayment & timing" },
  { id:"studentLoan",  icon:"🎓", label:"Student loan",    tagline:"Write-off vs overpay strategy" },
  { id:"pension",      icon:"🏦", label:"Pension",         tagline:"Contributions, sacrifice & projection" },
  { id:"savings",      icon:"💷", label:"Savings",         tagline:"ISA, rates & emergency fund" },
  { id:"investments",  icon:"📈", label:"Investments",     tagline:"Risk, wrappers & CGT" },
  { id:"personalLoan", icon:"💳", label:"Personal loan",   tagline:"Rate, payoff & alternatives" },
  { id:"kids",         icon:"👶", label:"Kids & family",   tagline:"JISAs, savings & protection" },
  { id:"insurance",    icon:"🛡️", label:"Insurance",       tagline:"Life, income & property cover" },
  { id:"inheritance",  icon:"📜", label:"Inheritance",     tagline:"IHT, gifting & estate planning" },
  { id:"other",        icon:"💬", label:"Something else",  tagline:"Tell us what's on your mind" },
];

const CONCERN_QUESTIONS = {
  mortgage:[
    { id:"overpaying",    type:"toggle", label:"Are you currently making overpayments?", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"}] },
    { id:"mortgageConcern",type:"toggle",label:"What's your main worry?", options:[{value:"rate",label:"Rising rates"},{value:"payoff",label:"Paying it off faster"},{value:"afford",label:"Affordability"},{value:"move",label:"Planning to move"}] },
  ],
  studentLoan:[
    { id:"everOverpaid",  type:"toggle", label:"Have you ever made voluntary overpayments?", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"}] },
    { id:"loanWorry",     type:"toggle", label:"What concerns you most?", options:[{value:"writeoff",label:"Will it get written off?"},{value:"overpay",label:"Should I overpay?"},{value:"impact",label:"Impact on mortgage"},{value:"understand",label:"I just don't understand it"}] },
  ],
  pension:[
    { id:"sacrificeAware",type:"toggle", label:"Is your pension set up as salary sacrifice?", hint:"Salary sacrifice saves NI on top of tax relief", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unsure",label:"Not sure"}] },
    { id:"pensionWorry",  type:"toggle", label:"What's your main pension concern?", options:[{value:"enough",label:"Am I saving enough?"},{value:"start",label:"I haven't started"},{value:"multipots",label:"I have multiple pots"},{value:"understand",label:"I don't understand it"}] },
  ],
  savings:[
    { id:"cashIsaHeld",   type:"toggle", label:"Do you currently hold a Cash ISA?", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"}] },
    { id:"timeHorizon",   type:"toggle", label:"When might you need this money?", options:[{value:"under1",label:"Under 1 year"},{value:"1to3",label:"1–3 years"},{value:"3to5",label:"3–5 years"},{value:"5plus",label:"5+ years"}] },
  ],
  investments:[
    { id:"riskAppetite",  type:"toggle", label:"How would you describe your risk appetite?", options:[{value:"cautious",label:"Cautious"},{value:"balanced",label:"Balanced"},{value:"growth",label:"Growth"},{value:"aggressive",label:"Aggressive"}] },
    { id:"investWorry",   type:"toggle", label:"What's your main concern?", options:[{value:"start",label:"How to start"},{value:"tax",label:"Tax efficiency"},{value:"platform",label:"Choosing a platform"},{value:"strategy",label:"Strategy"}] },
  ],
  inheritance:[
    { id:"ihtAware",      type:"toggle", label:"How familiar are you with inheritance tax?", options:[{value:"yes",label:"Know it well"},{value:"basic",label:"Vaguely aware"},{value:"no",label:"Not familiar"}] },
    { id:"giftingDone",   type:"toggle", label:"Has any estate planning been done?", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unsure",label:"Not sure"}] },
  ],
  other:[
    { id:"freeText", type:"textarea", label:"What's on your mind?", hint:"The more specific, the better the guidance." },
  ],
  personalLoan:[
    { id:"loanPurpose", type:"toggle", label:"What was the loan for?", options:[{value:"car",label:"Car"},{value:"home",label:"Home improvements"},{value:"consolidation",label:"Debt consolidation"},{value:"other",label:"Other"}] },
    { id:"loanWorry",   type:"toggle", label:"What concerns you most?", options:[{value:"rate",label:"My rate seems high"},{value:"payoff",label:"Paying it off faster"},{value:"afford",label:"Monthly affordability"},{value:"consolidate",label:"Consolidating debts"}] },
  ],
  kids:[
    { id:"kidsWorry",   type:"toggle", label:"What's your main concern for your kids?", options:[{value:"savings",label:"Building their savings"},{value:"university",label:"University costs"},{value:"firsthome",label:"Their first home"},{value:"protection",label:"Protecting them if I die"}] },
    { id:"currentlyInvesting", type:"toggle", label:"Are you currently investing for your children?", options:[{value:"yes",label:"Yes"},{value:"no",label:"Not yet"},{value:"savings",label:"Just a savings account"}] },
  ],
  insurance:[
    { id:"hasPartner",  type:"toggle", label:"Do you have a partner or dependants?", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"}] },
    { id:"insureWorry", type:"toggle", label:"What keeps you up at night?", options:[{value:"death",label:"Protecting my family if I die"},{value:"illness",label:"If I couldn't work due to illness"},{value:"property",label:"Protecting my home & contents"},{value:"unsure",label:"I just don't know what I need"}] },
  ],
};

const TRIAGE_GROUPS = {
  core: { heading:"About you", fields:[
    { id:"name",        label:"First name",              type:"text",   placeholder:"e.g. Harvey" },
    { id:"age",         label:"Age",                     type:"number", placeholder:"e.g. 29" },
    { id:"salary",      label:"Gross annual salary (£)", type:"number", placeholder:"e.g. 65,000" },
    { id:"otherIncome", label:"Other income (£/yr)",     type:"number", placeholder:"e.g. 8,000", hint:"Rental, freelance, dividends — leave blank if none" },
  ]},
  studentLoan: { heading:"Student loan", concerns:["studentLoan"], fields:[
    { id:"studentLoan",     label:"Loan plan type", type:"select", options:[
      {value:"none",label:"No student loan"},{value:"plan1",label:"Plan 1 — before 2012"},
      {value:"plan2",label:"Plan 2 — England/Wales 2012–2023"},{value:"plan5",label:"Plan 5 — 2023 onwards"},
    ]},
    { id:"loanBalance",     label:"Estimated outstanding balance (£)", type:"number", placeholder:"e.g. 35,000", hint:"Check your Student Finance account", showIf:{studentLoan:["plan1","plan2","plan5"]} },
    { id:"hasBonus",        label:"Do you receive a bonus?",           type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"}] },
    { id:"bonusAmount",     label:"Approximate annual bonus (£)",      type:"number", placeholder:"e.g. 10,000", showIf:{hasBonus:"yes"} },
    { id:"salaryTrajectory",label:"Salary trajectory in 10 years?",   type:"toggle", options:[{value:"flat",label:"Roughly same"},{value:"moderate",label:"Moderate growth"},{value:"high",label:"Significant growth"}] },
  ]},
  pension: { heading:"Pension", concerns:["pension"], fields:[
    { id:"hasPension",    label:"Do you contribute to a pension?", type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"}] },
    { id:"myContribution",label:"Your contribution (% of salary)", type:"number", placeholder:"e.g. 5",      showIf:{hasPension:"yes"} },
    { id:"employerMatch", label:"Employer match (% of salary)",    type:"number", placeholder:"e.g. 5",      showIf:{hasPension:"yes"} },
    { id:"potValue",      label:"Estimated current pot value (£)", type:"number", placeholder:"e.g. 35,000", showIf:{hasPension:"yes"} },
    { id:"retirementAge", label:"Target retirement age",           type:"number", placeholder:"65" },
    { id:"hasBonus",      label:"Do you receive a bonus?",         type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"}] },
    { id:"bonusAmount",   label:"Approximate annual bonus (£)",    type:"number", placeholder:"e.g. 10,000",  showIf:{hasBonus:"yes"} },
  ]},
  savings: { heading:"Cash & savings", concerns:["savings"], fields:[
    { id:"monthlyExpenses",label:"Monthly essential expenses (£)", type:"number", placeholder:"e.g. 2,500", hint:"Rent, bills, food, transport" },
    { id:"cashSavings",    label:"Total cash savings (£)",         type:"number", placeholder:"e.g. 25,000" },
    { id:"savingsRate",    label:"Current savings interest rate (%)", type:"number", placeholder:"e.g. 4.5", step:"0.1" },
    { id:"premiumBonds",   label:"Premium bonds (£)",              type:"number", placeholder:"e.g. 10,000", hint:"Max £50,000." },
    { id:"savingsGoal",    label:"What are these savings for?",    type:"toggle", options:[{value:"emergency",label:"Emergency fund"},{value:"house",label:"House deposit"},{value:"goals",label:"Future goals"},{value:"unsure",label:"Just saving"}] },
  ]},
  investments: { heading:"Investments", concerns:["investments"], fields:[
    { id:"hasInvestments", label:"Do you have investments?",        type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"}] },
    { id:"isaUsedThisYear",label:"Paid into ISA this tax year (£)", type:"number", placeholder:"e.g. 8,000", hint:"£20,000 annual limit.", showIf:{hasInvestments:"yes"} },
    { id:"unwrappedValue", label:"Investments outside an ISA (£)", type:"number", placeholder:"e.g. 15,000",  showIf:{hasInvestments:"yes"} },
    { id:"unrealisedGains",label:"Estimated unrealised gains (£)", type:"number", placeholder:"e.g. 4,500",   showIf:{hasInvestments:"yes"} },
    { id:"investHorizon",  label:"Investment time horizon",         type:"toggle", options:[{value:"under5",label:"Under 5 yrs"},{value:"5to10",label:"5–10 yrs"},{value:"10plus",label:"10+ yrs"}], showIf:{hasInvestments:"yes"} },
  ]},
  mortgage: { heading:"Mortgage", concerns:["mortgage"], fields:[
    { id:"hasMortgage",    label:"Do you have a mortgage?",          type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"Not yet"}] },
    { id:"mortgageBalance",label:"Outstanding balance (£)",          type:"number", placeholder:"e.g. 280,000", showIf:{hasMortgage:"yes"} },
    { id:"mortgageRate",   label:"Current interest rate (%)",        type:"number", placeholder:"e.g. 4.5", step:"0.1", showIf:{hasMortgage:"yes"} },
    { id:"monthlyMortgage",label:"Monthly mortgage payment (£)",     type:"number", placeholder:"e.g. 1,400", showIf:{hasMortgage:"yes"} },
    { id:"fixExpiry",      label:"When does your fixed rate expire?", type:"select", showIf:{hasMortgage:"yes"}, options:[
      {value:"",label:"Select…"},{value:"under6m",label:"Within 6 months"},{value:"6to12m",label:"6–12 months"},
      {value:"1to2y",label:"1–2 years"},{value:"2yplus",label:"2+ years"},{value:"variable",label:"Already variable"},
    ]},
  ]},
  inheritance: { heading:"Inheritance", concerns:["inheritance"], fields:[
    { id:"inheritDirection",label:"Receiving or passing on wealth?", type:"toggle", options:[{value:"receiving",label:"Expecting to inherit"},{value:"passing",label:"Passing on"},{value:"both",label:"Both"}] },
    { id:"estateValue",    label:"Approximate estate value (£)",     type:"number", placeholder:"e.g. 800,000", hint:"Rough figure is fine." },
    { id:"hasWill",        label:"Is there a will in place?",        type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"na",label:"Not applicable yet"}] },
  ]},
  personalLoan: { heading:"Personal loan", concerns:["personalLoan"], fields:[
    { id:"hasPersonalLoan",   label:"Do you currently have a personal loan?", type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"}] },
    { id:"personalLoanBalance",label:"Outstanding balance (£)",    type:"number", placeholder:"e.g. 8,000",  showIf:{hasPersonalLoan:"yes"} },
    { id:"personalLoanRate",   label:"Interest rate (% AER)",      type:"number", placeholder:"e.g. 9.9", step:"0.1", showIf:{hasPersonalLoan:"yes"} },
    { id:"personalLoanMonthly",label:"Monthly payment (£)",        type:"number", placeholder:"e.g. 180",  showIf:{hasPersonalLoan:"yes"} },
    { id:"personalLoanTermRemaining", label:"Months remaining",    type:"number", placeholder:"e.g. 36",   showIf:{hasPersonalLoan:"yes"} },
  ]},
  kids: { heading:"Kids & family", concerns:["kids"], fields:[
    { id:"hasKids",    label:"Do you have children?",               type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"Not yet"}] },
    { id:"numKids",    label:"How many children?",                  type:"number", placeholder:"e.g. 2", showIf:{hasKids:"yes"} },
    { id:"kidsAges",   label:"Ages (comma separated)",              type:"text",   placeholder:"e.g. 3, 7", hint:"Helps us calculate JISA runway and university costs.", showIf:{hasKids:"yes"} },
    { id:"hasJISA",    label:"Do any of them have a Junior ISA?",   type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"}], showIf:{hasKids:"yes"} },
    { id:"juniorISAValue", label:"Total JISA value (£)",            type:"number", placeholder:"e.g. 5,000", showIf:{hasJISA:"yes"} },
  ]},
  insurance: { heading:"Insurance", concerns:["insurance"], fields:[
    { id:"hasLifeInsurance",     label:"Do you have life insurance?",           type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unsure",label:"Unsure"}] },
    { id:"hasIncomeProtection",  label:"Do you have income protection?",        type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unsure",label:"Unsure"}] },
    { id:"hasCriticalIllness",   label:"Do you have critical illness cover?",   type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unsure",label:"Unsure"}] },
    { id:"hasContentsInsurance", label:"Do you have contents / buildings cover?", type:"toggle", options:[{value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"na",label:"Renting / N/A"}] },
  ]},
};

const CONCERN_TO_GROUPS = {
  studentLoan:["core","studentLoan"], pension:["core","pension"],
  savings:["core","savings"], investments:["core","investments"],
  mortgage:["core","mortgage"], inheritance:["core","inheritance"],
  personalLoan:["core","personalLoan"], kids:["core","kids"],
  insurance:["core","insurance"], other:["core"],
};

function getTriageGroupsForConcerns(selected) {
  const needed = new Set(["core"]);
  selected.forEach(c => (CONCERN_TO_GROUPS[c]||["core"]).forEach(g => needed.add(g)));
  return Array.from(needed).map(k => ({ key:k, ...TRIAGE_GROUPS[k] }));
}

function fieldVisible(field, d) {
  if (!field.showIf) return true;
  return Object.entries(field.showIf).every(([k,v]) => Array.isArray(v) ? v.includes(d[k]) : d[k] === v);
}

function getConcernIntro(id, d, m) {
  const name = d.name ? d.name.split(" ")[0] : "";
  const g = name ? name+", " : "";
  switch(id) {
    case "mortgage":    return d.hasMortgage === "yes" ? `${g}you have a ${fmt(+d.mortgageBalance)} mortgage at ${d.mortgageRate}%.` : `${g}you don't have a mortgage yet.`;
    case "studentLoan": return d.studentLoan && d.studentLoan !== "none" ? `${g}you have ~${fmt(m.loanBal)} on a ${d.studentLoan.replace("plan","Plan ")} loan. Mandatory repayment: ~${fmt(m.annualRepayment)}/yr.` : `${g}you don't have a student loan.`;
    case "pension":     return d.hasPension === "yes" ? `${g}you're contributing ${d.myContribution}% with ${d.employerMatch}% employer match — ${fmt((+d.myContribution + +d.employerMatch)/100*(+d.salary||0))}/yr total.` : `${g}you're not currently contributing to a pension.`;
    case "savings":     return `${g}you're holding ${fmt(m.totalLiquid)} in cash and bonds — ${m.runwayMonths.toFixed(1)} months runway.`;
    case "investments": return d.hasInvestments === "yes" ? `${g}you have investments. You have ${fmt(m.isaHeadroom)} of ISA allowance remaining.` : `${g}you haven't started investing yet.`;
    case "inheritance": return `${g}let's work out what inheritance tax planning looks like for your situation.`;
    case "other":       return `${g}tell us what's on your mind in as much detail as you like.`;
    default: return "";
  }
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

// ── Landing ────────────────────────────────────────────────────────────────────
function Landing({ onFullJourney, onConcernOnly, onStarterFlow, activePersona, onSwitchPersona }) {
  return (
    <div style={{minHeight:"100vh",background:G,fontFamily:SANS,display:"flex",flexDirection:"column"}}>
      <style>{FONTS}</style>
      <nav style={{padding:"22px 40px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px",flexWrap:"wrap"}}>
        <span style={{fontFamily:SERIF,color:GOLD,fontSize:"24px",fontWeight:700}}>Candid.</span>
        <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
          <div style={{display:"flex",background:"rgba(255,255,255,0.08)",borderRadius:"8px",padding:"3px",gap:"2px"}}>
            <span style={{fontSize:"10px",color:"rgba(255,255,255,0.4)",padding:"5px 8px",letterSpacing:"0.06em",textTransform:"uppercase",alignSelf:"center"}}>Demo</span>
            {[{id:"harvey",label:"Harvey",desc:"Higher rate, investments, bonus"},{id:"sophie",label:"Sophie",desc:"Basic rate, no pension, mortgage"}].map(p => (
              <button key={p.id} type="button" onClick={() => onSwitchPersona(p.id)} title={p.desc}
                style={{background:activePersona===p.id?GOLD:"transparent",border:"none",borderRadius:"5px",padding:"6px 14px",color:activePersona===p.id?G:WHITE,fontSize:"12px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onFullJourney} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.25)",borderRadius:"6px",padding:"8px 20px",color:WHITE,fontSize:"13px",fontWeight:500}}>Sign in</button>
        </div>
      </nav>
      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"40px 40px 60px",maxWidth:"760px"}}>
        <div className="fu"  style={{fontSize:"11px",fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:GOLD,marginBottom:"20px"}}>Personal finance, honestly</div>
        <h1  className="fu1" style={{fontFamily:SERIF,fontSize:"clamp(38px,6vw,66px)",color:WHITE,lineHeight:1.08,fontWeight:700,marginBottom:"24px"}}>Your finances<br/>deserve better.</h1>
        <p   className="fu2" style={{fontSize:"17px",color:"rgba(255,255,255,0.65)",lineHeight:1.7,maxWidth:"520px",marginBottom:"40px"}}>Most people are quietly leaving thousands of pounds behind every year. Where do you want to start?</p>

        {/* The fork */}
        <div className="fu3" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",maxWidth:"600px"}}>
          <button type="button" onClick={onStarterFlow} style={{background:"rgba(255,255,255,0.07)",border:"1.5px solid rgba(255,255,255,0.2)",borderRadius:"12px",padding:"22px 20px",textAlign:"left",cursor:"pointer",transition:"all 0.2s"}}>
            <div style={{fontSize:"28px",marginBottom:"12px"}}>🌱</div>
            <div style={{fontFamily:SERIF,fontSize:"18px",color:WHITE,fontWeight:600,marginBottom:"8px",lineHeight:1.2}}>I'm new to this</div>
            <div style={{fontSize:"13px",color:"rgba(255,255,255,0.55)",lineHeight:1.6}}>Just starting out, or not sure where to begin. I want simple, clear steps.</div>
          </button>
          <button type="button" onClick={onFullJourney} style={{background:GOLD,border:"none",borderRadius:"12px",padding:"22px 20px",textAlign:"left",cursor:"pointer",transition:"all 0.2s"}}>
            <div style={{fontSize:"28px",marginBottom:"12px"}}>📊</div>
            <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:600,marginBottom:"8px",lineHeight:1.2}}>I know my way around</div>
            <div style={{fontSize:"13px",color:"rgba(22,47,36,0.65)",lineHeight:1.6}}>I have savings, investments, or a pension and want to optimise.</div>
          </button>
        </div>
        <div className="fu4" style={{marginTop:"16px",maxWidth:"600px"}}>
          <button type="button" onClick={onConcernOnly} style={{width:"100%",background:"transparent",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"10px",padding:"13px 20px",color:"rgba(255,255,255,0.55)",fontSize:"14px",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>I have a specific question in mind</span><span style={{opacity:0.5}}>→</span>
          </button>
        </div>
      </div>
      <div className="fu5" style={{padding:"0 40px 40px",display:"flex",gap:"10px",flexWrap:"wrap"}}>
        {["ISA optimisation","Pension gap","Student loan strategy","CGT crystallisation","Cash runway","Bonus sacrifice"].map(f => (
          <div key={f} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"100px",padding:"7px 14px",fontSize:"12px",color:"rgba(255,255,255,0.6)",fontWeight:500}}>{f}</div>
        ))}
      </div>
    </div>
  );
}

// ── Starter flow (new to this path) ───────────────────────────────────────────

const STARTER_QUESTIONS = [
  {
    id: "situation",
    q: "First — which of these sounds most like you?",
    hint: "No wrong answers. Just pick the closest.",
    options: [
      { value:"paycheck", icon:"💸", label:"Living paycheck to paycheck", sub:"Not much left over at the end of the month" },
      { value:"saving",   icon:"🏦", label:"Saving a little each month",  sub:"Something goes away, but not sure it's in the right place" },
      { value:"decent",   icon:"📈", label:"Doing okay, want to do better", sub:"I have savings but feel like I'm missing something" },
      { value:"sorted",   icon:"🎯", label:"Fairly sorted, but gaps exist",  sub:"Pension, ISA — I know the words, just not sure I'm maximising" },
    ],
  },
  {
    id: "biggestWorry",
    q: "What worries you most about money?",
    hint: "Pick one — the thing that keeps you up at night.",
    options: [
      { value:"emergency",  icon:"🚨", label:"Not having a safety net",          sub:"If something went wrong tomorrow, I'd struggle" },
      { value:"retirement", icon:"👴", label:"Not saving enough for retirement",  sub:"I know I should be doing more but haven't started" },
      { value:"debt",       icon:"💳", label:"Debt or loans",                     sub:"Student loan, credit card, or personal loan" },
      { value:"growth",     icon:"🌱", label:"My money isn't growing",            sub:"It's just sitting in a bank doing nothing" },
    ],
  },
  // Debt detail — only shown when biggestWorry === "debt"
  {
    id: "debtType",
    showIf: a => a.biggestWorry === "debt",
    q: "What type of debt is it?",
    hint: "Pick the one that's causing the most stress.",
    options: [
      { value:"creditcard",   icon:"💳", label:"Credit card",       sub:"High interest, minimum payments" },
      { value:"personal",     icon:"🏦", label:"Personal loan",     sub:"Fixed monthly repayments" },
      { value:"car",          icon:"🚗", label:"Car finance",        sub:"PCP, HP, or personal loan for a vehicle" },
      { value:"studentloan",  icon:"🎓", label:"Student loan",       sub:"Plan 1, 2, or 5" },
      { value:"multiple",     icon:"📚", label:"Multiple debts",     sub:"A mix of the above" },
    ],
  },
  {
    id: "debtSize",
    showIf: a => a.biggestWorry === "debt",
    q: "Roughly how much do you owe in total?",
    hint: "Ballpark is fine.",
    options: [
      { value:"under5k",   icon:"💷", label:"Under £5,000",     sub:"" },
      { value:"5to15k",    icon:"💷", label:"£5,000 – £15,000", sub:"" },
      { value:"15to30k",   icon:"💷", label:"£15,000 – £30,000",sub:"" },
      { value:"over30k",   icon:"💷", label:"Over £30,000",      sub:"" },
    ],
  },
  {
    id: "debtRate",
    showIf: a => a.biggestWorry === "debt",
    q: "What interest rate are you paying — roughly?",
    hint: "Check your statement or app. If you have multiple debts, use the highest rate.",
    options: [
      { value:"low",    icon:"🟢", label:"Under 5%",    sub:"e.g. student loan, some car finance" },
      { value:"medium", icon:"🟡", label:"5% – 15%",   sub:"e.g. personal loan" },
      { value:"high",   icon:"🔴", label:"15% – 30%",  sub:"e.g. credit card" },
      { value:"unsure", icon:"🤷", label:"I'm not sure", sub:"I'd have to check" },
    ],
  },
  {
    id: "hasPension",
    q: "Do you pay into a pension?",
    hint: "Even a small amount counts.",
    options: [
      { value:"yes_employer", icon:"✅", label:"Yes — through my employer", sub:"It comes out of my pay automatically" },
      { value:"yes_own",      icon:"✅", label:"Yes — I set one up myself",  sub:"I pay into it separately" },
      { value:"no",           icon:"❌", label:"No — I don't have one",      sub:"I haven't got round to it" },
      { value:"unsure",       icon:"🤷", label:"I'm not sure",               sub:"I might have one but don't really know" },
    ],
  },
  {
    id: "salary",
    q: "Roughly, what do you earn per year?",
    hint: "A ballpark is fine. This helps us prioritise the right things.",
    options: [
      { value:"under25", icon:"💷", label:"Under £25,000",     sub:"" },
      { value:"25to40",  icon:"💷", label:"£25,000 – £40,000", sub:"" },
      { value:"40to60",  icon:"💷", label:"£40,000 – £60,000", sub:"" },
      { value:"over60",  icon:"💷", label:"Over £60,000",       sub:"" },
    ],
  },
  // Risk question — only shown when growth/ISA path is likely
  {
    id: "riskProfile",
    showIf: a => a.biggestWorry === "growth" || a.situation === "decent" || a.situation === "sorted",
    q: "How do you feel about risk with your money?",
    hint: "There's no wrong answer — it's about what lets you sleep at night.",
    options: [
      { value:"safe",     icon:"🔒", label:"I want it safe",            sub:"I'd rather earn less and know it's protected" },
      { value:"balanced", icon:"⚖️", label:"A bit of both",             sub:"Some risk is okay if there's more upside" },
      { value:"growth",   icon:"🚀", label:"I want maximum growth",     sub:"I'm happy with ups and downs if the long-term trend is up" },
    ],
  },
];

function buildStarterActions(answers) {
  const { situation, biggestWorry, hasPension, salary, riskProfile, debtType, debtSize, debtRate } = answers;
  const isHighEarner = salary === "over60" || salary === "40to60";
  const noPension = hasPension === "no" || hasPension === "unsure";
  const wantsGrowth = biggestWorry === "growth" || situation === "decent" || situation === "sorted";
  const prefersGrowth = riskProfile === "growth" || riskProfile === "balanced";
  const actions = [];

  // Emergency fund
  if (situation === "paycheck" || biggestWorry === "emergency") {
    actions.push({
      priority:"First", col:"#c0392b", icon:"🚨",
      title:"Build your emergency fund",
      why:"Before anything else, you need a financial cushion. Aim for 3 months of essential expenses in an easy-access savings account. This is the foundation everything else sits on — without it, any unexpected bill could push you into debt.",
      how:"Open a free easy-access savings account. Set up a standing order for the day you get paid — even £50/month. Don't touch it.",
      notYet:["Stocks and shares","Overpaying loans","ISAs — do this first"],
      equivalenceAmount: 600,
      eduNote:"💡 Did you know? Only 37% of UK adults could cover an unexpected £1,000 bill without borrowing. An emergency fund is the single most impactful thing most people can do.",
      linksLabel:"Best easy-access savings accounts right now",
      linksTooltip:"These are currently the highest-rate easy-access savings accounts available in the UK, based on their published AER. No lock-in periods.",
      links:[
        { label:"Marcus by Goldman Sachs — 4.75% AER", icon:"🏦", app:"Marcus" },
        { label:"Chase UK — 4.1% AER, great app", icon:"📱", app:"Chase UK" },
        { label:"Chip — auto-saves spare change for you", icon:"🤖", app:"Chip" },
      ],
    });
  }

  // Debt — with rich detail from debt questions
  if (biggestWorry === "debt") {
    const isStudentLoan = debtType === "studentloan";
    const isHighRate = debtRate === "high" || debtRate === "medium";
    const isLargeDebt = debtSize === "over30k" || debtSize === "15to30k";
    const debtTypeName = debtType === "creditcard" ? "credit card debt"
      : debtType === "personal" ? "a personal loan"
      : debtType === "car" ? "car finance"
      : debtType === "studentloan" ? "a student loan"
      : debtType === "multiple" ? "multiple debts"
      : "debt";

    const debtWhy = isStudentLoan
      ? "Student loans work differently to other debts — in most cases, you should NOT rush to pay them off. The debt is written off after 25–40 years, and repayments are automatically deducted from your salary once you earn above the threshold. Overpaying is usually money lost."
      : isHighRate
      ? `At your interest rate (${debtRate === "high" ? "15–30%" : "5–15%"}), this debt is almost certainly the highest-priority financial issue you have. Every £1 used to pay it off gives a guaranteed ${debtRate === "high" ? "15–30%" : "5–15%"} return — better than any investment available to you.`
      : "At a low interest rate, your debt is less urgent — but a plan to clear it still frees up cash flow for investing.";

    const debtHow = isStudentLoan
      ? "Don't overpay your student loan. Check your plan type (Plan 1, 2, or 5) — repayments come out automatically via payroll. Focus spare cash on an emergency fund and ISA instead."
      : debtType === "multiple"
      ? "List all your debts with their interest rates. Pay the minimum on everything, then throw all spare cash at the highest-rate debt first. Clear it completely, then move to the next. This is called the avalanche method."
      : `Contact your ${debtType === "creditcard" ? "card provider" : "lender"} to check if you can overpay without penalty. Even an extra £50/month can dramatically cut the interest you pay.`;

    // Estimate interest saving from clearing/reducing debt
    const debtSizeMap = { "under5k":3000, "5to15k":8000, "15to30k":20000, "over30k":35000 };
    const debtRateMap = { "low":0.05, "medium":0.12, "high":0.22 };
    const debtPrincipal = debtSizeMap[debtSize] || 5000;
    const debtRatePct = debtRateMap[debtRate] || 0.10;
    const debtEquiv = isStudentLoan ? 0 : Math.round(debtPrincipal * debtRatePct);

    actions.push({
      priority: actions.length === 0 ? "First" : "Second",
      col:"#c0392b", icon:"💳",
      title: isStudentLoan ? "Your student loan — don't panic" : `Clear your ${debtTypeName} — this is urgent`,
      why: debtWhy,
      how: debtHow,
      notYet: isStudentLoan ? ["Overpaying — almost always a bad idea for student loans"] : ["Investing until expensive debt is cleared","New credit products"],
      equivalenceAmount: debtEquiv,
      eduNote: isStudentLoan
        ? `💡 Student loan myth-busting: ${isLargeDebt ? "Large balances are common and not as scary as they look" : "Most people repay less than the full balance"}. Repayments are capped at 9% of income above the threshold — you'll never owe more per month than your salary dictates.`
        : `💡 The maths: if you're paying ${debtRate === "high" ? "20%" : "10%"} interest, every £100 of debt cleared saves you £${debtRate === "high" ? "20" : "10"} per year — guaranteed, risk-free. No investment can match that certainty.`,
      linksLabel: isStudentLoan ? "Check your student loan details" : "Options for clearing debt faster",
      linksTooltip: isStudentLoan
        ? "Official sources to check your student loan balance, plan type, and repayment threshold."
        : "Options to reduce your interest rate or get free debt advice. We never recommend taking on new debt to clear old debt without proper advice.",
      links: isStudentLoan ? [
        { label:"Check your balance — Student Finance (gov.uk)", icon:"🎓", app:"Student Finance England" },
        { label:"Understand your repayment plan — MoneySavingExpert", icon:"📖", app:"MoneySavingExpert student loan guide" },
      ] : debtType === "creditcard" ? [
        { label:"Compare 0% balance transfer cards", icon:"💳", app:"MoneySuperMarket" },
        { label:"Check your credit score free", icon:"📊", app:"ClearScore" },
        { label:"Free debt advice — StepChange charity", icon:"❤️", app:"StepChange" },
      ] : [
        { label:"Free debt advice — StepChange charity", icon:"❤️", app:"StepChange" },
        { label:"Check if you qualify for a lower-rate loan", icon:"🔄", app:"ClearScore" },
        { label:"Citizens Advice — free, impartial help", icon:"📋", app:"Citizens Advice" },
      ],
    });
  }

  // Pension
  if (noPension) {
    const pensionEquiv = isHighEarner ? 3000 : 1800;
    actions.push({
      priority: actions.length === 0 ? "First" : actions.length === 1 ? "Second" : "Third",
      col:GOLD, icon:"🏦",
      title:"Start a pension — this week",
      why:`A pension is a savings account where the government adds at least 20% to everything you put in${isHighEarner ? " — and 40% if you're a higher-rate taxpayer" : ""}. If your employer matches contributions, that's free money on top. Every month without one costs you compound growth you can never get back.`,
      how:"Ask your employer if they offer a workplace pension — most do, and most will match your contributions. If not, open a personal pension (SIPP) online in under 15 minutes.",
      notYet:["Stocks and shares ISA (pension comes first for most people)"],
      equivalenceAmount: pensionEquiv,
      eduNote:"💡 A workplace pension is essentially a 100% instant return on your contributions — if your employer matches you, they double your money before any investment growth. If you have a pension through work and aren't enrolled, you're turning down free money every month.",
      linksLabel:"Open a personal pension (SIPP)",
      linksTooltip:"These are the most popular personal pension providers for people starting from scratch. All are FCA-regulated. Employer pensions are separate — ask your HR team.",
      links:[
        { label:"PensionBee — easiest to set up, great app", icon:"🐝", app:"PensionBee" },
        { label:"Vanguard SIPP — lowest ongoing cost", icon:"📉", app:"Vanguard UK" },
        { label:"Find lost old pensions (free, gov.uk)", icon:"🔍", app:"Pension Tracing Service" },
      ],
    });
  }

  // ISA / growth — risk fork
  if (wantsGrowth) {
    if (prefersGrowth) {
      actions.push({
        priority: actions.length === 0 ? "First" : actions.length === 1 ? "Second" : actions.length === 2 ? "Third" : "Fourth",
        col:"#2d6b4a", icon:"🚀",
        title:"Open a Stocks & Shares ISA",
        why:"You said you're comfortable with some ups and downs in exchange for better returns. Historically, a globally diversified index fund has returned around 7% per year over the long term — compared to 4–5% in a cash savings account. The ISA wrapper means you never pay tax on the gains.",
        how:"Open a Stocks & Shares ISA with one of the providers below. Choose a single global index fund (e.g. Vanguard FTSE All-World or Fidelity Index World). Set up a monthly payment and leave it alone — time does the work.",
        notYet:["Individual company shares until you're comfortable","Crypto — that's a different conversation"],
        equivalenceAmount: 1400,
        eduNote:"💡 What's an index fund? Instead of picking individual companies, you buy a tiny slice of thousands of them at once. If one company fails, it barely moves the needle. If global markets grow — as they have over every 20-year period in modern history — your money grows with them.",
        linksLabel:"Best Stocks & Shares ISA platforms for beginners",
        linksTooltip:"Ranked by cost and ease of use for someone starting out. All are FCA-regulated and FSCS-protected up to £85,000. Investments can go down as well as up.",
        links:[
          { label:"Vanguard S&S ISA — 0.15%/yr, index fund specialist", icon:"📉", app:"Vanguard UK" },
          { label:"Trading 212 — no commission, great for beginners", icon:"📈", app:"Trading 212" },
          { label:"InvestEngine — zero platform fee on ETFs", icon:"🌐", app:"InvestEngine" },
        ],
      });
    } else {
      const isaEquiv = isHighEarner ? 2000 : 900;
      actions.push({
        priority: actions.length === 0 ? "First" : actions.length === 1 ? "Second" : actions.length === 2 ? "Third" : "Fourth",
        col:"#2d6b4a", icon:"📈",
        title:"Put your savings in a Cash ISA",
        why:"You said you'd rather keep things safe — a Cash ISA is the right call. It works exactly like a normal savings account, except you never pay tax on the interest, ever. The government lets you put up to £20,000 in per year, and the allowance resets every April.",
        how:"Open a Cash ISA with one of the providers below. Move your existing savings there. Takes 10 minutes. Your money is fully protected up to £85,000 by the FSCS (a government scheme).",
        notYet: isHighEarner ? ["Stocks & Shares ISA — once you're comfortable, this could give better long-term returns"] : [],
        equivalenceAmount: isaEquiv,
        eduNote:"💡 What makes a Cash ISA different from a normal savings account? Just one thing: tax. Any interest you earn in a Cash ISA is completely tax-free, permanently. Outside an ISA, if your interest exceeds your Personal Savings Allowance (£500–£1,000/yr), you pay income tax on the rest.",
        linksLabel:"Best Cash ISAs available right now (easy-access)",
        linksTooltip:"These are currently the highest-rate easy-access Cash ISAs available in the UK, ranked by their published AER savings rate. All are FSCS-protected up to £85,000.",
        links:[
          { label:"Trading 212 Cash ISA — 5.08% AER", icon:"📈", app:"Trading 212" },
          { label:"Plum Cash ISA — 4.92% AER", icon:"📱", app:"Plum" },
          { label:"Chip Cash ISA — 4.84% AER", icon:"💰", app:"Chip" },
        ],
      });
    }
  }

  // S&S for sorted users who already have pension
  if ((situation === "sorted" || situation === "decent") && (hasPension === "yes_employer" || hasPension === "yes_own") && !prefersGrowth && !wantsGrowth) {
    actions.push({
      priority: actions.length === 0 ? "First" : actions.length === 1 ? "Second" : actions.length === 2 ? "Third" : "Fourth",
      col:"#2d6b4a", icon:"🌱",
      title:"Top up your ISA before April 5th",
      why:"You have a pension sorted — the next step is making sure your savings are in an ISA wrapper so you're not paying unnecessary tax on interest or gains.",
      how:"Check what you've already put into an ISA this tax year. You can put up to £20,000 in total. Any unused allowance expires on April 5th and cannot be rolled over.",
      notYet:[],
      equivalenceAmount: 1000,
      eduNote:"💡 The ISA allowance is use-it-or-lose-it. Unlike pension allowances, unused ISA allowance cannot be carried forward to next year. If you miss it, it's gone permanently.",
      linksLabel:"Open or top up an ISA",
      linksTooltip:"A mix of Cash and Stocks & Shares ISA options. Both count toward the same £20,000 annual limit.",
      links:[
        { label:"Trading 212 Cash ISA — 5.08% AER", icon:"📈", app:"Trading 212" },
        { label:"Vanguard S&S ISA — low cost investing", icon:"📉", app:"Vanguard UK" },
      ],
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority:"First", col:GOLD, icon:"💷",
      title:"Start with your savings rate",
      why:"The single most important financial habit is paying yourself first. Every month, move money out of your current account the day you get paid — before you spend it.",
      how:"Open a high-interest easy-access savings account and set up a standing order for the day after payday.",
      notYet:[],
      equivalenceAmount: 600,
      eduNote:"💡 Paying yourself first means treating saving like a bill — non-negotiable, automatic. People who automate saving save 2–3× more than those who save whatever's 'left over' at the end of the month.",
      linksLabel:"Best easy-access savings accounts right now",
      linksTooltip:"Ranked by AER savings rate. All are FSCS-protected. No lock-in periods.",
      links:[
        { label:"Marcus easy-access — 4.75% AER", icon:"🏦", app:"Marcus by Goldman Sachs" },
        { label:"Chase savings — 4.1% AER", icon:"🏦", app:"Chase UK" },
      ],
    });
  }

  return actions;
}

function StarterFlow({ onBack, onUpgrade }) {
  const [answers, setAnswers] = useState({});
  const [history, setHistory] = useState([]); // stack of question ids answered
  const [done, setDone]       = useState(false);
  const [openTip, setOpenTip] = useState(null);

  // Compute current question: first STARTER_QUESTIONS entry whose showIf passes and hasn't been answered
  const currentQ = STARTER_QUESTIONS.find(q => {
    if (answers[q.id] !== undefined) return false; // already answered
    if (q.showIf && !q.showIf(answers)) return false; // condition not met — skip
    return true;
  });

  const answeredCount = history.length;
  const totalVisible = STARTER_QUESTIONS.filter(q => !q.showIf || q.showIf(answers)).length;

  function pick(qId, val) {
    const next = { ...answers, [qId]: val };
    setAnswers(next);
    setHistory(h => [...h, qId]);
    // Check if any more questions remain
    const remaining = STARTER_QUESTIONS.find(q => {
      if (next[q.id] !== undefined) return false;
      if (q.showIf && !q.showIf(next)) return false;
      return true;
    });
    if (!remaining) setDone(true);
  }

  function goBack() {
    if (history.length === 0) { onBack(); return; }
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setAnswers(a => { const n = {...a}; delete n[prev]; return n; });
    setDone(false);
  }

  const actions = done ? buildStarterActions(answers) : [];

  if (done) {
    return (
      <div style={{minHeight:"100vh",background:CREAM,fontFamily:SANS}}>
        <style>{FONTS}</style>
        <div style={{background:G,padding:"18px 32px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontFamily:SERIF,color:GOLD,fontSize:"22px",fontWeight:700}}>Candid.</span>
          <button type="button" onClick={goBack} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"6px",padding:"6px 14px",color:"rgba(255,255,255,0.6)",fontSize:"12px",cursor:"pointer"}}>← Start over</button>
        </div>
        <div style={{maxWidth:"640px",margin:"0 auto",padding:"44px 24px 80px"}}>
          <div className="fu" style={{marginBottom:"36px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:GOLD,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"10px"}}>Your action plan</div>
            <h1 style={{fontFamily:SERIF,fontSize:"clamp(28px,4vw,38px)",color:G,lineHeight:1.15,marginBottom:"12px"}}>
              {actions.length === 1 ? "One thing to focus on right now." : `${actions.length} things, in this order.`}
            </h1>
            <p style={{fontSize:"15px",color:MUT,lineHeight:1.7}}>
              Personal finance is mostly about doing a small number of things in the right order. Here's yours.
            </p>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:"16px",marginBottom:"40px"}}>
            {actions.map((a, i) => (
              <div key={i} className={`fu${i+1}`} style={{background:WHITE,borderRadius:"14px",overflow:"hidden",border:"1px solid rgba(22,47,36,0.08)"}}>
                {/* Coloured header */}
                <div style={{background:a.col,padding:"12px 20px",display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",
                    color:a.col==="rgba(22,47,36,1)"||a.col==="#2d6b4a"?"rgba(255,255,255,0.8)":a.col===GOLD?"rgba(22,47,36,0.85)":"rgba(255,255,255,0.8)"}}>{a.priority}</span>
                  <span style={{fontSize:"18px"}}>{a.icon}</span>
                  <span style={{fontFamily:SERIF,fontSize:"17px",fontWeight:600,color:a.col===GOLD?"#162e1f":WHITE,lineHeight:1.2}}>{a.title}</span>
                </div>
                <div style={{padding:"18px 20px"}}>
                  {/* Why */}
                  <div style={{marginBottom:"12px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"5px"}}>Why this matters</div>
                    <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7}}>{a.why}</p>
                  </div>
                  {/* How */}
                  <div style={{marginBottom:"14px"}}>
                    <div style={{fontSize:"11px",fontWeight:700,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"5px"}}>How to start</div>
                    <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7}}>{a.how}</p>
                  </div>
                  {/* Equivalence chip */}
                  {a.equivalenceAmount > 0 && (() => {
                    const eq = getEquivalence(a.equivalenceAmount);
                    return eq ? (
                      <div style={{display:"inline-flex",alignItems:"center",gap:"7px",background:"rgba(196,150,58,0.1)",border:"1px solid rgba(196,150,58,0.25)",borderRadius:"100px",padding:"5px 12px",marginBottom:"14px"}}>
                        <span style={{fontSize:"11px",fontWeight:700,color:GOLD}}>💡 {fmt(a.equivalenceAmount)}/yr</span>
                        <span style={{fontSize:"11px",color:MUT}}>—</span>
                        <span style={{fontSize:"11px",color:TEXT}}>{eq}</span>
                      </div>
                    ) : null;
                  })()}
                  {/* Educational note — TikTok video placeholder */}
                  {a.eduNote && (
                    <div style={{background:"rgba(196,150,58,0.08)",border:"1px solid rgba(196,150,58,0.22)",borderRadius:"10px",padding:"12px 14px",marginBottom:"14px",display:"flex",gap:"10px",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <p style={{fontSize:"13px",color:TEXT,lineHeight:1.65,marginBottom:"8px"}}>{a.eduNote}</p>
                        {/* Video placeholder */}
                        <div style={{background:"rgba(22,47,36,0.06)",borderRadius:"8px",padding:"10px 12px",display:"flex",alignItems:"center",gap:"10px",cursor:"pointer"}}>
                          <div style={{width:"36px",height:"36px",background:G,borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            <span style={{fontSize:"16px"}}>▶</span>
                          </div>
                          <div>
                            <div style={{fontSize:"12px",fontWeight:600,color:G,marginBottom:"2px"}}>60-second explainer — coming soon</div>
                            <div style={{fontSize:"11px",color:MUT}}>Short video breaking this down in plain English</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Where to go — affiliate links with tooltip */}
                  {a.links?.length > 0 && (
                    <div style={{borderTop:"1px solid rgba(22,47,36,0.07)",paddingTop:"14px",marginTop:"2px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
                        <div style={{fontSize:"11px",fontWeight:700,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase"}}>{a.linksLabel || "Where to go"}</div>
                        {a.linksTooltip && (
                          <button type="button" onClick={() => setOpenTip(openTip===i?null:i)}
                            style={{width:"17px",height:"17px",borderRadius:"50%",border:"1.5px solid rgba(22,47,36,0.25)",background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:MUT,fontSize:"9px",fontWeight:700,flexShrink:0}}>?</button>
                        )}
                      </div>
                      {openTip===i && a.linksTooltip && (
                        <div style={{background:"rgba(22,47,36,0.05)",borderRadius:"8px",padding:"10px 12px",marginBottom:"10px",fontSize:"12px",color:TEXT,lineHeight:1.65}}>
                          {a.linksTooltip}
                        </div>
                      )}
                      {a.links.map((lnk,j) => (
                        <StarterLink key={j} label={lnk.label} icon={lnk.icon} app={lnk.app}/>
                      ))}
                      <p style={{fontSize:"10px",color:MUT,marginTop:"6px",lineHeight:1.5,fontStyle:"italic"}}>
                        Candid may earn a referral fee — this doesn't affect our ranking or recommendations.
                      </p>
                    </div>
                  )}
                  {/* Not yet */}
                  {a.notYet?.length > 0 && (
                    <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"8px",padding:"10px 12px",marginTop:"12px"}}>
                      <div style={{fontSize:"11px",fontWeight:700,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"4px"}}>Not yet</div>
                      <p style={{fontSize:"13px",color:MUT,lineHeight:1.6}}>{a.notYet.join(" · ")}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Upgrade nudge */}
          <div style={{background:G,borderRadius:"14px",padding:"24px",marginBottom:"24px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:GOLD,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"10px"}}>Want to go deeper?</div>
            <h3 style={{fontFamily:SERIF,fontSize:"19px",color:WHITE,marginBottom:"8px",lineHeight:1.3}}>Once you've got the basics in place, there's a lot more to explore.</h3>
            <p style={{fontSize:"14px",color:"rgba(255,255,255,0.6)",lineHeight:1.7,marginBottom:"18px"}}>
              Candid's full report covers ISA allowances, pension tax relief, student loan strategy, CGT optimisation, salary sacrifice, and more — with specific £ figures for your situation.
            </p>
            <button type="button" onClick={onUpgrade} style={{background:GOLD,border:"none",borderRadius:"8px",padding:"13px 24px",color:G,fontSize:"15px",fontWeight:700,cursor:"pointer"}}>
              Get my full Candid report →
            </button>
          </div>

          <p style={{fontSize:"12px",color:MUT,lineHeight:1.7,borderTop:"1px solid rgba(22,47,36,0.1)",paddingTop:"16px"}}>
            Candid provides financial education and guidance only — not regulated financial advice. Always consider your personal circumstances and consult a qualified adviser for complex situations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:CREAM,fontFamily:SANS}}>
      <style>{FONTS}</style>
      <div style={{background:G,padding:"18px 32px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontFamily:SERIF,color:GOLD,fontSize:"22px",fontWeight:700}}>Candid.</span>
        <span style={{color:"rgba(255,255,255,0.45)",fontSize:"12px"}}>Question {answeredCount+1} of ~{totalVisible}</span>
      </div>
      <div style={{height:"3px",background:"rgba(255,255,255,0.1)"}}>
        <div style={{height:"3px",background:GOLD,width:`${((answeredCount)/Math.max(totalVisible,1))*100}%`,transition:"width 0.4s ease"}}/>
      </div>
      <div style={{maxWidth:"580px",margin:"0 auto",padding:"48px 24px 80px"}}>
        {currentQ && (
          <div className="fu">
            <h2 style={{fontFamily:SERIF,fontSize:"clamp(22px,3.5vw,30px)",color:G,lineHeight:1.2,marginBottom:"8px"}}>{currentQ.q}</h2>
            {currentQ.hint && <p style={{fontSize:"14px",color:MUT,marginBottom:"32px",lineHeight:1.6}}>{currentQ.hint}</p>}
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {currentQ.options.map((o,i) => (
                <button key={o.value} type="button" onClick={() => pick(currentQ.id, o.value)} className={`fu${i+1}`}
                  style={{background:WHITE,border:"1.5px solid rgba(22,47,36,0.12)",borderRadius:"12px",padding:"16px 18px",textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:"14px",transition:"all 0.15s"}}>
                  <span style={{fontSize:"24px",flexShrink:0}}>{o.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:"15px",color:TEXT,marginBottom:o.sub?"3px":"0"}}>{o.label}</div>
                    {o.sub && <div style={{fontSize:"13px",color:MUT,lineHeight:1.4}}>{o.sub}</div>}
                  </div>
                  <span style={{fontSize:"16px",color:MUT,flexShrink:0}}>›</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {history.length > 0 && (
          <button type="button" onClick={goBack} style={{marginTop:"20px",background:"transparent",border:"none",color:MUT,fontSize:"14px",cursor:"pointer",padding:"8px 0"}}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

// ── Full onboarding ───────────────────────────────────────────────────────────
const STEPS = ["About you","Cash & savings","Investments","Pension","Debt"];

function OnboardingStep({ step, d, set }) {
  const g2 = {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"};
  if (step === 0) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Tell us about you</h2>
      <p style={{color:MUT,marginBottom:"32px",lineHeight:1.6,fontSize:"15px"}}>A few basics to calibrate your report.</p>
      <Field label="First name"><input style={INP} value={d.name} onChange={e => set("name",e.target.value)} placeholder="e.g. Harvey"/></Field>
      <div style={g2}>
        <Field label="Age"><input style={INP} type="number" value={d.age} onChange={e => set("age",e.target.value)} placeholder="e.g. 29"/></Field>
        <Field label="Gross annual salary (£)"><input style={INP} type="number" value={d.salary} onChange={e => set("salary",e.target.value)} placeholder="e.g. 65,000"/></Field>
      </div>
      {/* Auto tax band display */}
      {+d.salary > 0 && (
        <div style={{background:"rgba(22,47,36,0.04)",borderRadius:"8px",padding:"12px 14px",marginBottom:"20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
          <div>
            <div style={{fontSize:"11px",fontWeight:700,color:MUT,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"3px"}}>Tax band (calculated)</div>
            <div style={{fontSize:"15px",fontWeight:600,color:G}}>
              {+d.salary + (+d.otherIncome||0) > 125140 ? "Additional rate (45%)" :
               +d.salary + (+d.otherIncome||0) > 50270  ? "Higher rate (40%)" : "Basic rate (20%)"}
            </div>
          </div>
          <div style={{fontSize:"12px",color:MUT,textAlign:"right",maxWidth:"180px",lineHeight:1.5}}>
            Based on {+d.otherIncome > 0 ? `£${(+d.salary+(+d.otherIncome)).toLocaleString()} adjusted` : `£${(+d.salary).toLocaleString()} salary`}
          </div>
        </div>
      )}
      <Field label="Other income (£/yr)" hint="Rental income, freelance, dividends — leave blank if none">
        <input style={INP} type="number" value={d.otherIncome||""} onChange={e => set("otherIncome",e.target.value)} placeholder="e.g. 8,000"/>
      </Field>
    </div>
  );
  if (step === 1) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Cash & savings</h2>
      <p style={{color:MUT,marginBottom:"32px",lineHeight:1.6,fontSize:"15px"}}>How your liquid money is sitting right now.</p>
      <Field label="Monthly essential expenses (£)" hint="Rent, bills, food, transport"><input style={INP} type="number" value={d.monthlyExpenses} onChange={e => set("monthlyExpenses",e.target.value)} placeholder="e.g. 2,500"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"16px"}}>
        <Field label="Total cash savings (£)"><input style={INP} type="number" value={d.cashSavings} onChange={e => set("cashSavings",e.target.value)} placeholder="e.g. 25,000"/></Field>
        <Field label="Interest rate (%)"><input style={INP} type="number" step="0.1" value={d.savingsRate} onChange={e => set("savingsRate",e.target.value)} placeholder="4.5"/></Field>
      </div>
      <Field label="Premium bonds (£)" hint="Max £50,000. Enter 0 if none."><input style={INP} type="number" value={d.premiumBonds} onChange={e => set("premiumBonds",e.target.value)} placeholder="e.g. 10,000"/></Field>
    </div>
  );
  if (step === 2) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Investments</h2>
      <p style={{color:MUT,marginBottom:"32px",lineHeight:1.6,fontSize:"15px"}}>Stocks, funds, anything in a brokerage.</p>
      <Field label="Do you have investments?">
        <Toggle value={d.hasInvestments} onChange={v => set("hasInvestments",v)} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
      </Field>
      {d.hasInvestments === "yes" && (
        <div>
          <Field label="Paid into ISA this tax year (£)" hint="£20,000 annual limit — resets every April 5th.">
            <input style={INP} type="number" value={d.isaUsedThisYear} onChange={e => set("isaUsedThisYear",e.target.value)} placeholder="e.g. 8,000"/>
          </Field>
          <Field label="Total ISA value from previous years (£)" hint="Your ISA balance before this tax year's contributions.">
            <input style={INP} type="number" value={d.isaPreviousBalance} onChange={e => set("isaPreviousBalance",e.target.value)} placeholder="e.g. 24,000"/>
          </Field>
          <Field label="ISA type">
            <Toggle value={d.isaType} onChange={v => set("isaType",v)} options={[{value:"cash",label:"Cash ISA"},{value:"ss",label:"Stocks & Shares"},{value:"both",label:"Both"},{value:"none",label:"Neither yet"}]}/>
          </Field>
          <Field label="Investments outside an ISA (£)"><input style={INP} type="number" value={d.unwrappedValue} onChange={e => set("unwrappedValue",e.target.value)} placeholder="e.g. 15,000"/></Field>
          <Field label="Estimated unrealised gains (£)" hint="Profit above what you paid for your unwrapped investments."><input style={INP} type="number" value={d.unrealisedGains} onChange={e => set("unrealisedGains",e.target.value)} placeholder="e.g. 4,500"/></Field>
        </div>
      )}
    </div>
  );
  if (step === 3) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Pension</h2>
      <p style={{color:MUT,marginBottom:"32px",lineHeight:1.6,fontSize:"15px"}}>The most powerful savings vehicle most people underuse.</p>
      <Field label="Do you contribute to a pension?">
        <Toggle value={d.hasPension} onChange={v => set("hasPension",v)} options={[{value:"yes",label:"Yes"},{value:"no",label:"No"}]}/>
      </Field>
      {d.hasPension === "yes" ? (
        <div>
          <div style={g2}>
            <Field label="Your contribution (%)"><input style={INP} type="number" value={d.myContribution} onChange={e => set("myContribution",e.target.value)} placeholder="e.g. 5"/></Field>
            <Field label="Employer match (%)"><input style={INP} type="number" value={d.employerMatch} onChange={e => set("employerMatch",e.target.value)} placeholder="e.g. 5"/></Field>
          </div>
          <div style={g2}>
            <Field label="Pot value (£)"><input style={INP} type="number" value={d.potValue} onChange={e => set("potValue",e.target.value)} placeholder="e.g. 35,000"/></Field>
            <Field label="Target retirement age"><input style={INP} type="number" value={d.retirementAge} onChange={e => set("retirementAge",e.target.value)} placeholder="65"/></Field>
          </div>
        </div>
      ) : (
        <div style={{background:"rgba(196,150,58,0.08)",border:"1px solid rgba(196,150,58,0.3)",borderRadius:"10px",padding:"16px",marginTop:"4px"}}>
          <p style={{fontSize:"14px",color:G,lineHeight:1.6}}><strong>This is likely your biggest financial gap.</strong> We'll quantify exactly what it's costing you.</p>
        </div>
      )}
    </div>
  );
  if (step === 4) return (
    <div>
      <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>Debt</h2>
      <p style={{color:MUT,marginBottom:"32px",lineHeight:1.6,fontSize:"15px"}}>Student loans and mortgages — both need their own strategy.</p>
      <Field label="Student loan">
        <select style={INP} value={d.studentLoan} onChange={e => set("studentLoan",e.target.value)}>
          <option value="none">No student loan</option>
          <option value="plan1">Plan 1 — before 2012 (Scotland/NI)</option>
          <option value="plan2">Plan 2 — England/Wales 2012–2023</option>
          <option value="plan5">Plan 5 — 2023 onwards</option>
        </select>
      </Field>
      {d.studentLoan !== "none" && <Field label="Outstanding balance (£)"><input style={INP} type="number" value={d.loanBalance} onChange={e => set("loanBalance",e.target.value)} placeholder="e.g. 35,000"/></Field>}
      <Field label="Do you have a mortgage?">
        <Toggle value={d.hasMortgage} onChange={v => set("hasMortgage",v)} options={[{value:"yes",label:"Yes"},{value:"no",label:"Not yet"}]}/>
      </Field>
      {d.hasMortgage === "yes" && (
        <div>
          <div style={g2}>
            <Field label="Outstanding balance (£)"><input style={INP} type="number" value={d.mortgageBalance} onChange={e => set("mortgageBalance",e.target.value)} placeholder="e.g. 280,000"/></Field>
            <Field label="Interest rate (%)"><input style={INP} type="number" step="0.1" value={d.mortgageRate} onChange={e => set("mortgageRate",e.target.value)} placeholder="e.g. 4.5"/></Field>
          </div>
          <Field label="Monthly payment (£)"><input style={INP} type="number" value={d.monthlyMortgage} onChange={e => set("monthlyMortgage",e.target.value)} placeholder="e.g. 1,400"/></Field>
        </div>
      )}
    </div>
  );
  return null;
}

// ── Concern selector ──────────────────────────────────────────────────────────
function ConcernSelector({ selected, onToggle, onContinue, onBack }) {
  const count = selected.length;
  return (
    <PageWrap>
      <NavBar right={<GhostBtn onClick={onBack}>← Back</GhostBtn>}/>
      <ContentWrap maxWidth="680px">
        <div className="fu">
          <h1 style={{fontFamily:SERIF,fontSize:"clamp(26px,4vw,38px)",color:G,lineHeight:1.15,marginBottom:"10px"}}>What's on your mind?</h1>
          <p style={{fontSize:"15px",color:MUT,lineHeight:1.7,marginBottom:"36px"}}>Select everything that's relevant. We'll collect the right data for each concern and work through them one by one.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:"10px",marginBottom:"36px"}}>
          {CONCERN_LIST.map((c,i) => {
            const on = selected.includes(c.id);
            return (
              <div key={c.id} className={`fu${Math.min(i+1,7)}`} onClick={() => onToggle(c.id)} style={{background:on?G:WHITE,borderRadius:"12px",padding:"18px 16px",border:`1.5px solid ${on?G:"rgba(22,47,36,0.13)"}`,cursor:"pointer",transition:"all 0.15s",boxShadow:on?"0 2px 12px rgba(22,47,36,0.18)":"none"}}>
                <div style={{fontSize:"22px",marginBottom:"10px"}}>{c.icon}</div>
                <div style={{fontWeight:600,fontSize:"14px",color:on?WHITE:TEXT,marginBottom:"4px"}}>{c.label}</div>
                <div style={{fontSize:"12px",color:on?"rgba(255,255,255,0.6)":MUT,lineHeight:1.4}}>{c.tagline}</div>
                {on && (
                  <div style={{marginTop:"10px",width:"18px",height:"18px",background:GOLD,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke={G} strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button onClick={onContinue} disabled={count===0} style={{width:"100%",padding:"16px",background:count>0?G:"rgba(22,47,36,0.2)",border:"none",borderRadius:"10px",color:count>0?WHITE:"rgba(255,255,255,0.4)",fontSize:"16px",fontWeight:600,cursor:count>0?"pointer":"not-allowed",transition:"all 0.2s"}}>
          {count===0 ? "Select at least one concern" : count===1 ? "Collect my details →" : `Collect details for ${count} concerns →`}
        </button>
      </ContentWrap>
    </PageWrap>
  );
}

// ── Concern triage ────────────────────────────────────────────────────────────
function ConcernTriage({ selectedConcerns, d, set, onContinue, onBack }) {
  const groups = getTriageGroupsForConcerns(selectedConcerns);
  const coreComplete = d.name && d.salary;
  function renderField(field) {
    if (!fieldVisible(field, d)) return null;
    const key = field.id;
    return (
      <Field key={key} label={field.label} hint={field.hint}>
        {field.type==="text"    && <input style={INP} value={d[key]||""} onChange={e=>set(key,e.target.value)} placeholder={field.placeholder||""}/>}
        {field.type==="number"  && <input style={INP} type="number" step={field.step||"1"} value={d[key]||""} onChange={e=>set(key,e.target.value)} placeholder={field.placeholder||""}/>}
        {field.type==="select"  && <select style={INP} value={d[key]||""} onChange={e=>set(key,e.target.value)}>{!d[key]&&<option value="">Select…</option>}{field.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>}
        {field.type==="toggle"  && <Toggle value={d[key]||""} onChange={v=>set(key,v)} options={field.options}/>}
      </Field>
    );
  }
  const concernLabels = selectedConcerns.map(id => CONCERN_LIST.find(c=>c.id===id)?.label).filter(Boolean);
  return (
    <PageWrap>
      <NavBar center={`Setting up: ${concernLabels.join(", ")}`} right={<GhostBtn onClick={onBack}>← Back</GhostBtn>}/>
      <ContentWrap>
        <div className="fu" style={{marginBottom:"32px"}}>
          <h2 style={{fontFamily:SERIF,fontSize:"28px",color:G,marginBottom:"8px"}}>A few details first</h2>
          <p style={{color:MUT,lineHeight:1.65,fontSize:"15px"}}>Only the fields relevant to your selected {selectedConcerns.length===1?"concern":"concerns"}. The more you fill in, the more specific the guidance.</p>
        </div>
        {groups.map((group,gi) => (
          <div key={group.key} className={`fu${Math.min(gi+1,7)}`}>
            {gi>0 && <div style={{margin:"8px 0 20px",paddingTop:"24px",borderTop:"1px solid rgba(22,47,36,0.1)"}}><span style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.08em",textTransform:"uppercase"}}>{group.heading}</span></div>}
            {group.fields.map(f => renderField(f))}
          </div>
        ))}
        <button onClick={onContinue} disabled={!coreComplete} style={{marginTop:"16px",width:"100%",padding:"15px",background:coreComplete?G:"rgba(22,47,36,0.2)",border:"none",borderRadius:"10px",color:coreComplete?WHITE:"rgba(255,255,255,0.4)",fontSize:"16px",fontWeight:600,cursor:coreComplete?"pointer":"not-allowed",transition:"all 0.2s"}}>
          {coreComplete ? "Start my concern deep-dive →" : "Enter your name and salary to continue"}
        </button>
      </ContentWrap>
    </PageWrap>
  );
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
function ScoreRing({ score }) {
  const r=50, circ=2*Math.PI*r, dash=(score/100)*circ;
  const col = score>=75 ? "#2d6b4a" : score>=50 ? GOLD : "#c0392b";
  const lb  = score>=75 ? "Good" : score>=50 ? "Developing" : "Needs work";
  return (
    <div style={{position:"relative",width:"124px",height:"124px",flexShrink:0}}>
      <svg width="124" height="124" style={{transform:"rotate(-90deg)"}}>
        <circle cx="62" cy="62" r={r} fill="none" stroke={`${col}28`} strokeWidth="9"/>
        <circle cx="62" cy="62" r={r} fill="none" stroke={col} strokeWidth="9" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{transition:"stroke-dasharray 1.2s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:SERIF,fontSize:"30px",fontWeight:700,color:WHITE,lineHeight:1}}>{score}</span>
        <span style={{fontSize:"10px",color:"rgba(255,255,255,0.55)",fontWeight:500,marginTop:"3px",letterSpacing:"0.04em"}}>{lb}</span>
      </div>
    </div>
  );
}

const SC = { ok:"#2d6b4a", attention:GOLD, critical:"#c0392b", na:MUT };
const SL = { ok:"On track", attention:"Review", critical:"Action needed", na:"N/A" };
const UG = { immediate:"#c0392b", soon:GOLD, "this tax year":"#2d6b4a" };

const MODULE_META = [
  { key:"cash",        icon:"💷", title:"Cash & savings"  },
  { key:"investments", icon:"📈", title:"Investments"     },
  { key:"pension",     icon:"🏦", title:"Pension"         },
  { key:"studentLoan", icon:"🎓", title:"Student loan"    },
  { key:"mortgage",    icon:"🏠", title:"Mortgage"        },
  { key:"personalLoan",icon:"💳", title:"Personal loan"   },
  { key:"kids",        icon:"👶", title:"Kids & family"   },
  { key:"insurance",   icon:"🛡️", title:"Insurance"       },
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
  if (t.includes("insur") || t.includes("life cover") || t.includes("income protection")) return "insurance";
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

  // Cash — yield gap + ISA headroom urgency
  const cashImpact = Math.round(m.annualYieldGap + m.isaHeadroom * 0.05 * isaUrgencyBoost);
  s.cash = {
    status: m.annualYieldGap > 800 || m.runwayMonths > 12 ? "critical"
          : m.annualYieldGap > 200 || m.runwayMonths > 9 || m.runwayMonths < 3 ? "attention" : "ok",
    impact: cashImpact,
    impactLabel: cashImpact > 0 ? `${fmt(cashImpact)}/yr in yield gap` : null,
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

const pensionImpact = Math.round(
  m.missedMatch +
  (!contributing ? m.salary * 0.05 * m.tr : 0)
);

s.pension = {
  status: !contributing
    ? "critical"                // no contribution = leaving free money
    : m.missedMatch > 0
      ? "critical"              // contributing but missing match
      : "attention",

  impact: pensionImpact > 0 ? pensionImpact : null,

  impactLabel: m.missedMatch > 0
    ? `${fmt(m.missedMatch)}/yr in missed employer match`
    : !contributing && pensionImpact > 0
      ? `${fmt(pensionImpact)}/yr in pension tax relief foregone`
      : null,
};

  // Student loan
  const slBalance = m.loanBal;
  const slImpact = m.willClear ? Math.round(slBalance * 0.075 * 0.1) : 0; // only meaningful if clearing
  s.studentLoan = {
    status: d.studentLoan === "none" ? "na"
          : m.annualRepayment === 0 ? "attention"
          : "attention",
    impact: slImpact,
    impactLabel: slBalance > 0 ? `${fmt(slBalance)} outstanding` : null,
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

  // Insurance
  const missing = [d.hasLifeInsurance, d.hasIncomeProtection, d.hasCriticalIllness].filter(v => v !== "yes").length;
  const ipImpact = d.hasIncomeProtection !== "yes" ? Math.round(m.salary * 0.6) : 0;
  s.insurance = {
    status: missing >= 2 ? "critical" : missing === 1 ? "attention" : "ok",
    impact: ipImpact,
    impactLabel: ipImpact > 0 ? `${fmt(ipImpact)}/yr income at risk without IP cover` : `${missing} protection gap${missing !== 1 ? "s" : ""}`,
  };

  return s;
}

function Dashboard({ insights, d, m, onReset, onDigDeeper, onOpenModule, completedModules }) {
  const [showAllModules, setShowAllModules] = useState(false);
  const [netWorthExpanded, setNetWorthExpanded] = useState(false);
      if (!insights) return null;

  // Net worth breakdown
  const netWorthPositive = m.netWorth >= 0;
  const isaThisYear = +d.isaUsedThisYear||0;
  const isaPrev     = +d.isaPreviousBalance||0;
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
  ].filter(a => a.value > 0);
  const liabilityItems = [
    { label:"Mortgage", value: d.hasMortgage === "yes" ? (+d.mortgageBalance||0) : 0, icon:"🏠" },
    { label:"Student loan", value: m.loanBal||0, icon:"🎓" },
    { label:"Personal loan", value: d.hasPersonalLoan === "yes" ? (+d.personalLoanBalance||0) : 0, icon:"💳" },
  ].filter(l => l.value > 0);

  // Build merged module data: local computation provides status/impact, AI provides summary
  const localStatuses = computeModuleStatuses(d, m);
  const statusOrder = { critical:0, attention:1, ok:2, na:3 };

  const allModules = MODULE_META.map(mm => {
    const local = localStatuses[mm.key] || { status:"na", impact:0 };
    const aiMod = insights.modules?.[mm.key];
    // AI summary wins; local status wins when AI says na but local disagrees (new modules)
    const status = (aiMod?.status && aiMod.status !== "na") ? aiMod.status : local.status;
    const summary = aiMod?.summary || (local.status !== "na" ? `Review your ${mm.title.toLowerCase()} situation.` : "N/A");
    return { ...mm, status, summary, impact: local.impact||0, impactLabel: local.impactLabel };
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
      <NavBar right={<GhostBtn onClick={onReset}>Start over</GhostBtn>}/>
      <ContentWrap maxWidth="780px">
        {/* Score card */}
        <div className="fu" style={{background:G,borderRadius:"16px",padding:"28px 32px",display:"flex",alignItems:"center",gap:"28px",marginBottom:"28px",flexWrap:"wrap"}}>
          <ScoreRing score={insights.score}/>
          <div style={{flex:1,minWidth:"200px"}}>
            <div style={{fontSize:"10px",fontWeight:700,color:GOLD,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"8px"}}>Your Candid Score</div>
            <h2 style={{fontFamily:SERIF,color:WHITE,fontSize:"20px",lineHeight:1.35,marginBottom:"10px"}}>{insights.headline}</h2>
            <p style={{color:"rgba(255,255,255,0.65)",fontSize:"14px",lineHeight:1.7,marginBottom:"16px"}}>{insights.narrative}</p>
          </div>
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

        {/* Net worth summary */}
{(assetItems.length > 0 || liabilityItems.length > 0) && (
  <div
    className="fu1"
    style={{
      background: WHITE,
      borderRadius: "12px",
      padding: "20px 22px",
      border: "1px solid rgba(22,47,36,0.09)",
      marginBottom: "24px"
    }}
  >
    {/* Header + toggle */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "14px",
        flexWrap: "wrap",
        gap: "8px"
      }}
    >
      <span style={{ fontFamily: SERIF, fontSize: "17px", color: G, fontWeight: 600 }}>
        Net worth snapshot
      </span>

      <button
        type="button"
        onClick={() => setNetWorthExpanded(v => !v)}
        style={{
          background: "transparent",
          border: "none",
          fontSize: "12px",
          fontWeight: 600,
          color: G,
          cursor: "pointer"
        }}
      >
        {netWorthExpanded ? "Hide breakdown ↑" : "View breakdown ↓"}
      </button>
    </div>

    {/* Net worth headline */}
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "16px" }}>
      <span
        style={{
          fontFamily: SERIF,
          fontSize: "24px",
          fontWeight: 700,
          color: netWorthPositive ? "#2d6b4a" : "#c0392b"
        }}
      >
        {fmt(Math.abs(m.netWorth))}
      </span>
      <span style={{ fontSize: "12px", color: MUT }}>
        {netWorthPositive ? "net positive" : "net negative"}
      </span>
    </div>

    {/* Assets / Liabilities summary row + breakdown toggle */}
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "14px",
    gap: "16px"
  }}
>
  <div>
    <div
      style={{
        fontSize: "10px",
        fontWeight: 700,
        color: "#2d6b4a",
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        marginBottom: "6px"
      }}
    >
      Assets — {fmt(m.totalAssets)}
    </div>

    <div
      style={{
        fontFamily: SERIF,
        fontSize: "18px",
        fontWeight: 700,
        color: "#2d6b4a"
      }}
    >
      {fmt(m.totalAssets)}
    </div>
  </div>

  <div>
    <div
      style={{
        fontSize: "10px",
        fontWeight: 700,
        color: "#c0392b",
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        marginBottom: "6px",
        textAlign: "right"
      }}
    >
      Liabilities — {fmt(m.totalLiabilities)}
    </div>

    <div
      style={{
        fontFamily: SERIF,
        fontSize: "18px",
        fontWeight: 700,
        color: "#c0392b",
        textAlign: "right"
      }}
    >
      {fmt(m.totalLiabilities)}
    </div>
  </div>

  <button
    type="button"
    onClick={() => setNetWorthExpanded(v => !v)}
    style={{
      background: "transparent",
      border: "none",
      fontSize: "12px",
      fontWeight: 600,
      color: G,
      cursor: "pointer",
      marginTop: "6px",
      whiteSpace: "nowrap"
    }}
  >
    {netWorthExpanded ? "Breakdown ↑" : "Breakdown ↓"}
  </button>
</div>
        
    {/* Detailed breakdown (toggle) */}
    {netWorthExpanded && (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#2d6b4a",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                marginBottom: "8px"
              }}
            >
              Assets — {fmt(m.totalAssets)}
            </div>

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
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#c0392b",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                marginBottom: "8px"
              }}
            >
              Liabilities — {fmt(m.totalLiabilities)}
            </div>

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

        {/* Module breakdown — sorted, collapsible */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
          <h3 style={{fontFamily:SERIF,fontSize:"21px",color:G}}>Module breakdown</h3>
          <span style={{fontSize:"12px",color:MUT}}>{completedModules.length} of {activeModules.length} reviewed</span>
        </div>

        {/* Unreviewed modules — top 3 always visible */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"10px"}}>
          {visibleUnreviewed.map((mm,i) => {
            const col = SC[mm.status] || MUT;
            return (
              <div key={mm.key} onClick={() => onOpenModule(mm.key)} className={`fu${Math.min(i+1,7)}`}
                style={{background:WHITE,borderRadius:"12px",padding:"18px",border:`1px solid rgba(22,47,36,0.09)`,cursor:"pointer",borderTop:`3px solid ${col}`}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                  <span style={{fontSize:"16px"}}>{mm.icon}</span>
                  <span style={{fontWeight:600,fontSize:"13px",color:TEXT}}>{mm.title}</span>
                </div>
                <span style={{fontSize:"10px",fontWeight:700,color:col,background:`${col}18`,padding:"3px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",display:"inline-block",marginBottom:"8px"}}>{SL[mm.status]}</span>
                <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginBottom:"6px"}}>{mm.summary}</p>
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
                      style={{background:WHITE,borderRadius:"12px",padding:"18px",border:`1px solid rgba(22,47,36,0.09)`,cursor:"pointer",borderTop:`3px solid ${col}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                        <span style={{fontSize:"16px"}}>{mm.icon}</span>
                        <span style={{fontWeight:600,fontSize:"13px",color:TEXT}}>{mm.title}</span>
                      </div>
                      <span style={{fontSize:"10px",fontWeight:700,color:col,background:`${col}18`,padding:"3px 9px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",display:"inline-block",marginBottom:"8px"}}>{SL[mm.status]}</span>
                      <p style={{fontSize:"12px",color:MUT,lineHeight:1.5,marginBottom:"6px"}}>{mm.summary}</p>
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
                <div key={mm.key} onClick={() => onOpenModule(mm.key)} style={{background:"rgba(22,47,36,0.03)",borderRadius:"12px",padding:"14px 16px",border:"1px solid rgba(22,47,36,0.08)",cursor:"pointer",opacity:0.65,display:"flex",alignItems:"center",gap:"10px"}}>
                  <div style={{width:"22px",height:"22px",background:"#2d6b4a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke={WHITE} strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </div>
                  <span style={{fontSize:"16px"}}>{mm.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:"13px",color:TEXT}}>{mm.title}</div>
                    <div style={{fontSize:"11px",color:MUT}}>Reviewed — click to revisit</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Go Deeper CTA */}
        <div onClick={onDigDeeper} style={{background:WHITE,borderRadius:"12px",padding:"20px 24px",border:`1.5px solid ${GOLD}`,marginBottom:"28px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:GOLD,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"5px"}}>Go deeper</div>
            <h3 style={{fontFamily:SERIF,fontSize:"18px",color:G,marginBottom:"4px"}}>Something specific on your mind?</h3>
            <p style={{fontSize:"13px",color:MUT}}>Walk through a tailored concern — mortgage, pension, student loan, and more.</p>
          </div>
          <div style={{fontSize:"24px",color:GOLD,flexShrink:0,marginLeft:"16px"}}>→</div>
        </div>

        <p style={{fontSize:"12px",color:MUT,lineHeight:1.7,borderTop:"1px solid rgba(22,47,36,0.12)",paddingTop:"20px"}}>
          Candid provides financial education and guidance only — not regulated financial advice. All projections are estimates. Tax rules may change. Consider speaking to an IFA for personalised advice.
        </p>
      </ContentWrap>
    </PageWrap>
  );
}

// ── Module deep-dive ──────────────────────────────────────────────────────────
// ── Take Me There demo CTA ────────────────────────────────────────────────────
// ── Starter affiliate link (demo state) ───────────────────────────────────────
function StarterLink({ label, icon, app }) {
  const [tapped, setTapped] = useState(false);
  return (
    <button type="button" onClick={() => setTapped(true)} style={{
      width:"100%", padding:"12px 14px", marginBottom:"6px",
      background: tapped ? "rgba(22,47,36,0.05)" : WHITE,
      border:`1.5px solid ${tapped ? "rgba(22,47,36,0.15)" : "rgba(22,47,36,0.18)"}`,
      borderRadius:"10px", display:"flex", alignItems:"center", gap:"12px",
      cursor: tapped ? "default" : "pointer", transition:"all 0.15s", textAlign:"left"
    }}>
      <span style={{fontSize:"20px",flexShrink:0}}>{icon}</span>
      <div style={{flex:1}}>
        <div style={{fontSize:"13px",fontWeight:600,color:tapped?MUT:G,lineHeight:1.3}}>
          {tapped ? `↗ Opening ${app}…` : label}
        </div>
        {tapped && <div style={{fontSize:"11px",color:MUT,marginTop:"2px",fontStyle:"italic"}}>Demo — would open {app} in the full app</div>}
      </div>
      {!tapped && <span style={{fontSize:"13px",color:GOLD,fontWeight:700,flexShrink:0}}>→</span>}
    </button>
  );
}

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
  return (
    <div style={{background:WHITE,borderRadius:"12px",padding:"18px",border:`1.5px solid ${p.highlight ? GOLD : "rgba(22,47,36,0.09)"}`,position:"relative"}}>
      {p.badge && <span style={{position:"absolute",top:"14px",right:"14px",fontSize:"10px",fontWeight:700,color:GOLD,background:"rgba(196,150,58,0.12)",padding:"3px 8px",borderRadius:"100px",letterSpacing:"0.04em"}}>{p.badge}</span>}
      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
        <div style={{width:"36px",height:"36px",background:p.highlight ? G : "rgba(22,47,36,0.07)",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:"18px"}}>{p.appIcon||"💳"}</span>
        </div>
        <div>
          <div style={{fontWeight:600,fontSize:"14px",color:TEXT}}>{p.name}</div>
          <div style={{fontSize:"12px",color:MUT}}>{p.type}</div>
        </div>
      </div>
      {p.rate && <div style={{fontFamily:SERIF,fontSize:"18px",color:G,fontWeight:700,marginBottom:"6px"}}>{p.rate}</div>}
      <p style={{fontSize:"13px",color:MUT,lineHeight:1.55,marginBottom:"12px"}}>{p.feature}</p>
      <button type="button" onClick={() => p.internalLink ? onInternalLink(p.internalLink) : null}
        style={{width:"100%",padding:"9px",background:p.highlight?G:"transparent",border:`1.5px solid ${p.highlight?G:"rgba(22,47,36,0.22)"}`,borderRadius:"8px",color:p.highlight?WHITE:G,fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
        {p.cta}
      </button>
      {p.demoNote && (
        <div style={{marginTop:"8px",fontSize:"11px",color:"rgba(22,47,36,0.4)",textAlign:"center",fontStyle:"italic"}}>
          Demo: {p.demoNote}
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
    ? "Investments your parents would want you to make 👴"
    : "Investments you'd want your kids to make 🧒";
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

function ModuleDeepDive({ moduleKey, insights, d, m, openSection, goBack, goToDashboard, onComplete, isComplete, onOpenModule, nextModule }) {
  const [openTip,   setOpenTip]   = useState(null);
  const [expandAlt, setExpandAlt] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const [bonusInput,setBonusInput]= useState(+d.bonusAmount||"");
  const [sacrificePct, setSacrificePct] = useState(100);

  useEffect(() => {
    if (openSection === "bonusSacrifice") {
      setShowBonus(true);
      setTimeout(() => {
        const el = document.getElementById("bonus-sacrifice-panel");
        if (el) el.scrollIntoView({ behavior:"smooth", block:"start" });
      }, 200);
    }
  }, [openSection]);

  // Scroll to top whenever the module changes
useEffect(() => {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}, [moduleKey]);

  const meta = MODULE_META.find(mm => mm.key === moduleKey);
  // Use extended functions for new modules, original for existing
  const newModules = ["personalLoan","kids","insurance","inheritance","mortgage"];
  const modInsights = newModules.includes(moduleKey)
    ? getModuleInsightsExtended(moduleKey, d, m)
    : getModuleInsights(moduleKey, d, m);
  const products = newModules.includes(moduleKey)
    ? getModuleProductsExtended(moduleKey, d, m)
    : getModuleProducts(moduleKey, d, m);
  const crossLinks = getCrossModuleLinks(moduleKey, d, m);
  const modSummary = insights?.modules?.[moduleKey];
  const col = SC[modSummary?.status] || MUT;
  const surplus = m.surplusCash;
  const showRunwayCallout = moduleKey === "cash" && m.runwayMonths > 9;
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

  return (
    <PageWrap>
      <NavBar center={meta?.title} right={<GhostBtn onClick={goBack}>← Back</GhostBtn>}/>
      <ContentWrap maxWidth="680px">

        {/* Header */}
        <div className="fu" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"16px",marginBottom:"24px",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <span style={{fontSize:"32px"}}>{meta?.icon}</span>
            <div>
              <h2 style={{fontFamily:SERIF,fontSize:"26px",color:G,lineHeight:1.2}}>{meta?.title}</h2>
              {modSummary?.status && (
                <span style={{fontSize:"11px",fontWeight:700,color:col,background:`${col}18`,padding:"3px 10px",borderRadius:"100px",letterSpacing:"0.04em",textTransform:"uppercase",display:"inline-block",marginTop:"6px"}}>{SL[modSummary.status]}</span>
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

        {/* AI summary */}
        {modSummary?.summary && (
          <div className="fu1" style={{background:G,borderRadius:"12px",padding:"18px 22px",marginBottom:"24px"}}>
            <p style={{fontSize:"15px",color:"rgba(255,255,255,0.85)",lineHeight:1.75}}>{modSummary.summary}</p>
          </div>
        )}

        {/* Computed metrics with tooltips */}
        {modInsights.length > 0 && (
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

        {/* Cash runway callout */}
        {showRunwayCallout && (
          <div className="fu2" style={{background:"rgba(196,150,58,0.07)",border:"1px solid rgba(196,150,58,0.28)",borderRadius:"12px",padding:"18px 20px",marginBottom:"20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
              <span style={{fontSize:"16px"}}>💡</span>
              <span style={{fontSize:"12px",fontWeight:700,color:GOLD,letterSpacing:"0.06em",textTransform:"uppercase"}}>Your cash is working hard — maybe too hard</span>
            </div>
            <p style={{fontSize:"14px",color:TEXT,lineHeight:1.7,marginBottom:"12px"}}>
              You have <strong>{m.runwayMonths.toFixed(0)} months</strong> of runway — that's {(m.runwayMonths / 6).toFixed(1)}× the recommended 3–6 months. The excess ({fmt(surplus)}) is sitting in cash while likely losing ground to inflation. Consider putting it to work:
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
        {products && (
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

        {/* ── Take Me There (insurance module) ── */}
        {moduleKey === "insurance" && (
          <div style={{marginTop:"16px",background:"rgba(22,47,36,0.03)",border:"1px solid rgba(22,47,36,0.1)",borderRadius:"12px",padding:"16px 18px"}}>
            <div style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"10px"}}>Get a quote</div>
            <p style={{fontSize:"13px",color:MUT,lineHeight:1.6,marginBottom:"12px"}}>In the full app, these would open comparison sites or insurers pre-filled with your details.</p>
            {d.hasLifeInsurance !== "yes" && <TakeMeThere app="Compare the Market" icon="🛡️" message="Compare life insurance quotes" demoNote="Would open Compare the Market pre-filled"/>}
            {d.hasIncomeProtection !== "yes" && <TakeMeThere app="Drewberry" icon="💼" message="Get income protection quote" demoNote="Would open Drewberry income protection quote"/>}
            {d.hasCriticalIllness !== "yes" && <TakeMeThere app="Cavendish Online" icon="❤️" message="Compare critical illness cover" demoNote="Would open Cavendish Online"/>}
          </div>
        )}

        {/* ── Mortgage: overpayment scenarios + remortgage timing + Take Me There ── */}
        {moduleKey === "mortgage" && products?.mortgageSection && (() => {
          const { bal, rate, mo, monthsSaved, interestSaved10k, fixUrgent, fixExpiry, savRate, overpayBenefit } = products.mortgageSection;
          const scenarios = [5000, 10000, 25000].filter(x => x < bal);
          return (
            <div style={{marginTop:"16px"}}>
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
          <button type="button" onClick={onComplete} style={{width:"100%",padding:"15px",background:isComplete?"rgba(45,107,74,0.1)":G,border:isComplete?"1.5px solid rgba(45,107,74,0.3)":"none",borderRadius:"10px",color:isComplete?"#2d6b4a":WHITE,fontSize:"15px",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",transition:"all 0.2s",cursor:"pointer"}}>
            {isComplete ? (
              <><svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d="M1 6L5 10L13 1" stroke="#2d6b4a" strokeWidth="2.2" strokeLinecap="round"/></svg>Reviewed — click to unmark</>
            ) : (
              <><svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d="M1 6L5 10L13 1" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round"/></svg>Mark as reviewed</>
            )}
          </button>
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

// ── Concern deep-dive ─────────────────────────────────────────────────────────
function ConcernDeepDive({ concernId, concernIdx, totalConcerns, answers, setAnswer, onAnalyse, d, m }) {
  const concern = CONCERN_LIST.find(c => c.id === concernId);
  const questions = CONCERN_QUESTIONS[concernId] || [];
  const intro = getConcernIntro(concernId, d, m);
  const allAnswered = questions.every(q => answers[q.id]);
  return (
    <PageWrap>
      <NavBar center={`Concern ${concernIdx+1} of ${totalConcerns}`}/>
      <ProgressBar pct={(concernIdx+1)/totalConcerns*100}/>
      <ContentWrap>
        <div className="fu" style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"6px"}}>
          <span style={{fontSize:"28px"}}>{concern?.icon}</span>
          <h2 style={{fontFamily:SERIF,fontSize:"26px",color:G}}>{concern?.label}</h2>
        </div>
        <div className="fu1" style={{background:G,borderRadius:"10px",padding:"16px 20px",marginBottom:"32px"}}>
          <p style={{fontSize:"14px",color:"rgba(255,255,255,0.82)",lineHeight:1.7}}>{intro}</p>
        </div>
        {questions.map((q,i) => (
          <div key={q.id} className={`fu${i+2}`}>
            <Field label={q.label} hint={q.hint}>
              {q.type==="toggle"   && <Toggle value={answers[q.id]||""} onChange={v=>setAnswer(q.id,v)} options={q.options}/>}
              {q.type==="select"   && <select style={INP} value={answers[q.id]||""} onChange={e=>setAnswer(q.id,e.target.value)}><option value="">Select one…</option>{q.options.map(o=><option key={o} value={o}>{o}</option>)}</select>}
              {q.type==="textarea" && <textarea style={{...INP,minHeight:"100px",resize:"vertical",lineHeight:1.6}} value={answers[q.id]||""} onChange={e=>setAnswer(q.id,e.target.value)} placeholder="Type here…"/>}
            </Field>
          </div>
        ))}
        <button onClick={onAnalyse} disabled={!allAnswered} style={{marginTop:"20px",width:"100%",padding:"15px",background:allAnswered?G:"rgba(22,47,36,0.2)",border:"none",borderRadius:"10px",color:allAnswered?WHITE:"rgba(255,255,255,0.4)",fontSize:"16px",fontWeight:600,cursor:allAnswered?"pointer":"not-allowed",transition:"all 0.2s"}}>
          Analyse my {concern?.label.toLowerCase()} →
        </button>
      </ContentWrap>
    </PageWrap>
  );
}

// ── Concern result ────────────────────────────────────────────────────────────
function ConcernResult({ result, concernId, concernIdx, totalConcerns, onNext, onViewAll, isLast }) {
  const concern = CONCERN_LIST.find(c => c.id === concernId);
  if (!result) return null;
  const urgCol = UG[result.urgency] || MUT;
  return (
    <PageWrap>
      <NavBar center={`${concernIdx+1} of ${totalConcerns} done`}/>
      <ContentWrap maxWidth="620px">
        <div className="fu" style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"24px"}}>
          <span style={{fontSize:"26px"}}>{concern?.icon}</span>
          <div>
            <div style={{fontSize:"10px",fontWeight:700,color:urgCol,letterSpacing:"0.08em",textTransform:"uppercase"}}>{result.urgency}</div>
            <h2 style={{fontFamily:SERIF,fontSize:"24px",color:G,lineHeight:1.2}}>{result.headline}</h2>
          </div>
        </div>
        <div className="fu1" style={{background:WHITE,borderRadius:"12px",padding:"24px",border:"1px solid rgba(22,47,36,0.09)",marginBottom:"14px"}}>
          <p style={{fontSize:"15px",color:TEXT,lineHeight:1.75,marginBottom:"16px"}}>{result.narrative}</p>
          {result.impact && (
            <div style={{background:"rgba(196,150,58,0.1)",borderRadius:"8px",padding:"12px 16px",display:"inline-flex",alignItems:"center",gap:"12px"}}>
              <span style={{fontSize:"10px",fontWeight:700,color:GOLD,textTransform:"uppercase",letterSpacing:"0.06em"}}>Estimated impact</span>
              <span style={{fontFamily:SERIF,fontSize:"20px",color:G,fontWeight:700}}>{result.impact}</span>
            </div>
          )}
        </div>
        {(result.actions||[]).length > 0 && (
          <div className="fu2" style={{background:WHITE,borderRadius:"12px",border:"1px solid rgba(22,47,36,0.09)",overflow:"hidden",marginBottom:"24px"}}>
            <div style={{padding:"14px 20px",background:"rgba(22,47,36,0.04)",borderBottom:"1px solid rgba(22,47,36,0.08)"}}>
              <span style={{fontSize:"11px",fontWeight:700,color:G,letterSpacing:"0.07em",textTransform:"uppercase"}}>What to do</span>
            </div>
            {result.actions.map((a,i) => (
              <div key={i} style={{padding:"14px 20px",borderBottom:i<result.actions.length-1?"1px solid rgba(22,47,36,0.07)":"none",display:"flex",gap:"12px",alignItems:"flex-start"}}>
                <div style={{width:"22px",height:"22px",background:G,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px"}}>
                  <span style={{fontSize:"11px",fontWeight:700,color:GOLD}}>{i+1}</span>
                </div>
                <p style={{fontSize:"14px",color:TEXT,lineHeight:1.6}}>{a}</p>
              </div>
            ))}
          </div>
        )}
        <div className="fu3" style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {!isLast && <button onClick={onNext} style={{width:"100%",padding:"15px",background:G,border:"none",borderRadius:"10px",color:WHITE,fontSize:"16px",fontWeight:600}}>Next concern →</button>}
          <button onClick={onViewAll} style={{width:"100%",padding:"15px",background:WHITE,border:"1.5px solid rgba(22,47,36,0.2)",borderRadius:"10px",color:G,fontSize:"15px",fontWeight:500}}>
            {isLast ? "See my full summary →" : "View full report"}
          </button>
        </div>
      </ContentWrap>
    </PageWrap>
  );
}

// ── All concerns done ─────────────────────────────────────────────────────────
function AllConcernsDone({ concernResults, hasFullScore, onBackToDashboard, onReset }) {
  const urgPriority = { immediate:0, soon:1, "this tax year":2 };
  const sorted = [...concernResults].sort((a,b) => (urgPriority[a.result?.urgency]||3)-(urgPriority[b.result?.urgency]||3));
  return (
    <PageWrap>
      <NavBar right={<GhostBtn onClick={onReset}>Start over</GhostBtn>}/>
      <ContentWrap maxWidth="680px">
        <div className="fu" style={{marginBottom:"32px"}}>
          <h1 style={{fontFamily:SERIF,fontSize:"clamp(26px,4vw,36px)",color:G,marginBottom:"10px"}}>Your concern summary</h1>
          <p style={{fontSize:"15px",color:MUT,lineHeight:1.7}}>Everything we worked through, ranked by urgency.</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"12px",marginBottom:"32px"}}>
          {sorted.map(({ concernId, result },i) => {
            const concern = CONCERN_LIST.find(c => c.id === concernId);
            const urgCol = UG[result?.urgency] || MUT;
            return (
              <div key={concernId} className={`fu${Math.min(i+1,7)}`} style={{background:WHITE,borderRadius:"12px",padding:"20px 22px",border:"1px solid rgba(22,47,36,0.09)",borderLeft:`4px solid ${urgCol}`}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",flex:1}}>
                    <span style={{fontSize:"20px"}}>{concern?.icon}</span>
                    <div>
                      <div style={{fontSize:"10px",fontWeight:700,color:urgCol,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"3px"}}>{result?.urgency}</div>
                      <h3 style={{fontFamily:SERIF,fontSize:"16px",color:G,lineHeight:1.25}}>{result?.headline}</h3>
                    </div>
                  </div>
                  {result?.impact && <div style={{background:"rgba(196,150,58,0.1)",borderRadius:"6px",padding:"5px 10px",flexShrink:0}}><div style={{fontSize:"12px",fontWeight:700,color:GOLD,whiteSpace:"nowrap"}}>{result.impact}</div></div>}
                </div>
                <p style={{fontSize:"13px",color:MUT,lineHeight:1.6,paddingLeft:"30px"}}>{(result?.narrative||"").slice(0,180)}{(result?.narrative||"").length>180?"…":""}</p>
              </div>
            );
          })}
        </div>
        {hasFullScore && (
          <button onClick={onBackToDashboard} style={{width:"100%",padding:"15px",background:G,border:"none",borderRadius:"10px",color:WHITE,fontSize:"16px",fontWeight:600,marginBottom:"12px"}}>
            ← Back to my Candid score
          </button>
        )}
        <p style={{fontSize:"12px",color:MUT,lineHeight:1.7,borderTop:"1px solid rgba(22,47,36,0.12)",paddingTop:"20px"}}>Candid provides financial education and guidance only — not regulated financial advice. Consider speaking to an IFA for personalised recommendations.</p>
      </ContentWrap>
    </PageWrap>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
const HARVEY_DATA = {
  name:"Harvey", age:"29", salary:"85000", otherIncome:"",
  monthlyExpenses:"3000", cashSavings:"40000", savingsRate:"4.2", premiumBonds:"10000",
  hasInvestments:"yes", isaUsedThisYear:"8000", isaPreviousBalance:"22000", isaType:"ss", unwrappedValue:"15000", unrealisedGains:"4500",
  hasPension:"yes", myContribution:"5", employerMatch:"5", potValue:"28000", retirementAge:"65",
  studentLoan:"plan2", loanBalance:"35000", hasMortgage:"no", mortgageBalance:"", mortgageRate:"", monthlyMortgage:"",
  hasBonus:"yes", bonusAmount:"50000", salaryTrajectory:"high", savingsGoal:"goals", investHorizon:"10plus",
  fixExpiry:"", inheritDirection:"passing", estateValue:"620000", hasWill:"no",
  hasPersonalLoan:"yes", personalLoanBalance:"8000", personalLoanRate:"9.9", personalLoanMonthly:"180", personalLoanTermRemaining:"48",
  hasKids:"no", numKids:"", kidsAges:"", hasJISA:"no", juniorISAValue:"",
  hasLifeInsurance:"no", hasIncomeProtection:"no", hasCriticalIllness:"no", hasContentsInsurance:"yes",
};

// Demo persona 2 — Sophie: 34, basic rate, no pension, high cash, mortgage expiring, Plan 2 loan, 1 child
const SOPHIE_DATA = {
  name:"Sophie", age:"34", salary:"42000", otherIncome:"",
  monthlyExpenses:"2200", cashSavings:"55000", savingsRate:"3.8", premiumBonds:"0",
  hasInvestments:"no", isaUsedThisYear:"0", isaPreviousBalance:"0", isaType:"none", unwrappedValue:"0", unrealisedGains:"0",
  hasPension:"no", myContribution:"", employerMatch:"5", potValue:"0", retirementAge:"65",
  studentLoan:"plan2", loanBalance:"28000", hasMortgage:"yes", mortgageBalance:"220000", mortgageRate:"5.2", monthlyMortgage:"1180",
  hasBonus:"no", bonusAmount:"", salaryTrajectory:"moderate", savingsGoal:"house", investHorizon:"5to10",
  fixExpiry:"under6m", inheritDirection:"", estateValue:"", hasWill:"no",
  hasPersonalLoan:"no", personalLoanBalance:"", personalLoanRate:"", personalLoanMonthly:"", personalLoanTermRemaining:"",
  hasKids:"yes", numKids:"1", kidsAges:"2", hasJISA:"no", juniorISAValue:"",
  hasLifeInsurance:"no", hasIncomeProtection:"no", hasCriticalIllness:"no", hasContentsInsurance:"yes",
};

const INIT_DATA = HARVEY_DATA;

export default function Candid() {
  const [screen,           setScreen]           = useState("landing");
  const [step,             setStep]             = useState(0);
  const [d,                setD]                = useState(INIT_DATA);
  const [insights,         setInsights]         = useState(null);
  const [selectedConcerns, setSelectedConcerns] = useState([]);
  const [concernIdx,       setConcernIdx]       = useState(0);
  const [concernAnswers,   setConcernAnswers]   = useState({});
  const [concernResults,   setConcernResults]   = useState([]);
  const [activeModule,     setActiveModule]     = useState(null);
  const [activeSection,    setActiveSection]    = useState(null);
  const [completedModules, setCompletedModules] = useState([]);
  const [prevScreen,       setPrevScreen]       = useState("dashboard");
  const [activePersona,    setActivePersona]    = useState("harvey");

  const set = (k, v) => setD(p => ({...p, [k]:v}));
  const m = calcMetrics(d);

  function switchPersona(persona) {
    const data = persona === "sophie" ? SOPHIE_DATA : HARVEY_DATA;
    setActivePersona(persona);
    setD(data);
    setInsights(null);
    setCompletedModules([]);
    setSelectedConcerns([]);
    setConcernResults([]);
    setScreen("landing");
  }

  function toggleConcern(id) {
    setSelectedConcerns(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }
  function setAnswer(qId, val) {
    const cId = selectedConcerns[concernIdx];
    setConcernAnswers(prev => ({...prev, [cId]:{...(prev[cId]||{}), [qId]:val}}));
  }
  function openModule(key, from, section) {
    setActiveModule(key);
    setActiveSection(section || null);
    setPrevScreen(from || screen);
    setScreen("moduleDeepDive");
    // Scroll to app container, not window top (avoids landing page scroll)
    setTimeout(() => {
      const appEl = document.getElementById("candid-app");
      if (appEl) appEl.scrollIntoView({ behavior: "instant", block: "start" });
    }, 0);
  }
  function markModuleComplete(key) {
    setCompletedModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  async function callClaude(prompt, maxTokens=1200) {
    const timeout = new Promise((_,reject) => setTimeout(() => reject(new Error("timeout")), 28000));
    const call = fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:maxTokens,messages:[{role:"user",content:prompt}]})
    });
    const res = await Promise.race([call, timeout]);
    const json = await res.json();
    const raw = (json.content?.[0]?.text||"").replace(/```json|```/g,"").trim();
    return JSON.parse(raw);
  }

  async function generateDashboard() {
    setScreen("loading");
    const prompt = `You are Candid, a UK personal finance guidance tool. Return ONLY valid JSON — no markdown, no backticks, no text outside the JSON.

USER: Name: ${d.name||"User"}, Age: ${d.age||"?"}, Salary: £${d.salary||0}, Tax: ${m.taxBandLabel} rate (auto-calculated from £${m.adjustedNetIncome.toLocaleString()} adjusted net income)
Cash: £${d.cashSavings||0} at ${d.savingsRate||4.5}%, Premium bonds: £${d.premiumBonds||0}, Monthly expenses: £${d.monthlyExpenses||0}
Investments: ${d.hasInvestments==="yes" ? `ISA this year £${d.isaUsedThisYear||0} (${d.isaType||"unspecified"}), ISA previous years £${d.isaPreviousBalance||0}, total ISA £${(+d.isaUsedThisYear||0)+(+d.isaPreviousBalance||0)}, unwrapped £${d.unwrappedValue||0}, ~£${d.unrealisedGains||0} gains` : "None"}
Pension: ${d.hasPension==="yes" ? `${d.myContribution}%/${d.employerMatch}% employer, pot ~£${d.potValue}, retire ${d.retirementAge}` : "No pension"}
Student loan: ${d.studentLoan==="none" ? "None" : `${d.studentLoan}, ~£${d.loanBalance||0}`}
Mortgage: ${d.hasMortgage==="yes" ? `£${d.mortgageBalance} at ${d.mortgageRate}%, £${d.monthlyMortgage}/mo` : "None"}
Personal loan: ${d.hasPersonalLoan==="yes" ? `£${d.personalLoanBalance} at ${d.personalLoanRate}%, ${d.personalLoanTermRemaining} months remaining` : "None"}
Kids: ${d.hasKids==="yes" ? `${d.numKids} child(ren), ages: ${d.kidsAges}, JISA: ${d.hasJISA==="yes"?`£${d.juniorISAValue}`:"None"}` : "None"}
Insurance: life ${d.hasLifeInsurance}, income protection ${d.hasIncomeProtection}, critical illness ${d.hasCriticalIllness}
Calculated: runway ${m.runwayMonths.toFixed(1)}mo, surplus £${Math.round(m.surplusCash)}, ISA headroom £${m.isaHeadroom}, missed match £${Math.round(m.missedMatch)}/yr, CGT saving £${Math.round(m.cgtSaving)}, yield gap £${Math.round(m.annualYieldGap)}/yr, loan repay ${m.annualRepayment>0?fmt(m.annualRepayment)+"/yr":"n/a"}, will${m.willClear?"":" NOT"} clear, pension at retire ~£${Math.round(m.projectedPot)}

Return exactly this structure:
{"score":<0-100>,"headline":"<one punchy sentence>","narrative":"<3-4 sentences, use first name, specific numbers>","priorities":[{"title":"<max 6 words>","impact":"<£ figure>","description":"<2-3 sentences>","urgency":"<immediate|soon|this tax year>"}],"modules":{"cash":{"status":"<ok|attention|critical>","summary":"<one sentence>"},"investments":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"},"pension":{"status":"<ok|attention|critical>","summary":"<one sentence>"},"studentLoan":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"},"mortgage":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"},"personalLoan":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"},"kids":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"},"insurance":{"status":"<ok|attention|critical|na>","summary":"<one sentence>"}}}`;

    const fallback = {
      score:46, headline:"You're leaving meaningful money on the table — but it's all fixable.",
      narrative:`${d.name?d.name.split(" ")[0]:""}, your finances have a solid foundation with clear optimisation gaps. The pension and ISA opportunities alone could significantly boost your long-term wealth.`,
      priorities:[
        {title:"Start pension contributions now",impact:"£3,000+",description:"Tax relief plus employer match means a £100 contribution costs ~£80 in take-home. Higher-rate taxpayers get even more back.",urgency:"immediate"},
        {title:"Maximise ISA allowance before April",impact:"£800+",description:"You have unused ISA allowance expiring April 5th. Moving surplus cash protects all future growth from tax permanently.",urgency:"this tax year"},
        {title:"Review student loan overpayment",impact:"Varies",description:"Most Plan 2/5 borrowers won't clear before write-off. That money works harder in a pension.",urgency:"soon"},
      ],
      modules:{
        cash:{status:"attention",summary:"Cash position looks reasonable but yield could be higher."},
        investments:{status:"attention",summary:"ISA allowance may not be fully utilised this tax year."},
        pension:{status:"critical",summary:"No pension contributions — this is your highest-priority fix."},
        studentLoan:{status:"attention",summary:"Overpayment strategy worth reviewing at your income level."},
        mortgage:{status:"na",summary:"N/A"},
        personalLoan:{status:"attention",summary:"Personal loan at a high rate — worth reviewing overpayment options."},
        kids:{status:"na",summary:"N/A"},
        insurance:{status:"attention",summary:"Income protection and life insurance not confirmed — worth reviewing."}
      }
    };
    try { const result = await callClaude(prompt,1200); setInsights(result); }
    catch(e) { setInsights(fallback); }
    finally { setScreen("dashboard"); }
  }

  async function analyseConcern() {
    const cId = selectedConcerns[concernIdx];
    const concern = CONCERN_LIST.find(c => c.id === cId);
    const answers = concernAnswers[cId] || {};
    setScreen("concernLoading");
    const prompt = `You are Candid, a UK personal finance guidance tool. Deep-dive: ${concern?.label}.
USER: Name: ${d.name||"User"}, Age: ${d.age}, Salary: £${d.salary}, Tax: ${m.taxBandLabel} rate (adjusted net income £${m.adjustedNetIncome.toLocaleString()}), Bonus: ${d.hasBonus==="yes"?`~£${d.bonusAmount}/yr`:"None"}
Cash: £${d.cashSavings||0} at ${d.savingsRate||4.2}%, Bonds: £${d.premiumBonds||0}, Expenses: £${d.monthlyExpenses||0}/mo
Investments: ${d.hasInvestments==="yes"?`ISA this yr £${d.isaUsedThisYear||0} (${d.isaType||"unspecified"}), ISA prev £${d.isaPreviousBalance||0}, total £${(+d.isaUsedThisYear||0)+(+d.isaPreviousBalance||0)}, unwrapped £${d.unwrappedValue||0}`:"None"}
Pension: ${d.hasPension==="yes"?`${d.myContribution}%/${d.employerMatch}% match, pot £${d.potValue}`:"No pension"}
Student loan: ${d.studentLoan==="none"?"None":`${d.studentLoan}, ~£${d.loanBalance}`}, salary trajectory: ${d.salaryTrajectory||"unknown"}
Mortgage: ${d.hasMortgage==="yes"?`£${d.mortgageBalance} at ${d.mortgageRate}%, fix: ${d.fixExpiry||"unknown"}`:"None"}
PRE-COMPUTED (treat as facts, do not contradict):
- Cash runway: ${m.runwayMonths.toFixed(1)} months (${m.runwayMonths > 6 ? "above" : "below"} 6-month recommended buffer)
- Surplus cash above 6-month buffer: £${Math.round(m.surplusCash)}
- ISA headroom: £${m.isaHeadroom}
- Missed employer pension match: £${Math.round(m.missedMatch)}/yr
- Student loan annual mandatory repayment: £${Math.round(m.annualRepayment)}/yr
- Student loan WILL${m.willClear?"":" NOT"} clear before write-off at current salary (balance/repayment ratio = ${m.loanBal > 0 && m.annualRepayment > 0 ? (m.loanBal/m.annualRepayment).toFixed(1) : "n/a"} years vs ${d.studentLoan==="plan2"?"30":d.studentLoan==="plan5"?"40":"25"}-year write-off)
- Student loan interest rate: ~${d.studentLoan==="plan2"?(+d.salary>49130?"7.5":"5.4"):d.studentLoan==="plan5"?"7.3":"5.0"}% p.a.
- Savings rate: ${d.savingsRate||4.2}% — net benefit of SL overpayment vs saving: ${d.studentLoan!=="none"?((d.studentLoan==="plan2"?(+d.salary>49130?7.5:5.4):7.3)-(+d.savingsRate||4.2)).toFixed(1)+"% in favour of "+(!m.willClear?"saving (don't overpay)":"overpaying"):"n/a"}
Concern answers: ${Object.entries(answers).map(([k,v])=>`${k}: ${v}`).join(", ")}
IMPORTANT: If the student loan WILL clear before write-off and the net benefit of overpaying vs saving is positive, advise considering overpayment of the loan. Do NOT give generic "Plan 2 loans shouldn't be overpaid" advice — base advice on the pre-computed facts above.
Return ONLY: {"headline":"<one frank sentence>","narrative":"<3-4 sentences, first name, specific £ numbers>","impact":"<£ figure>","urgency":"<immediate|soon|this tax year>","actions":["<step 1>","<step 2>","<step 3>"]}`;

    const fallback = {
      headline:`Your ${concern?.label.toLowerCase()} situation needs attention.`,
      narrative:`${d.name?d.name.split(" ")[0]+", based":"Based"} on what you've shared, there are meaningful improvements available here.`,
      impact:"Varies", urgency:"soon",
      actions:["Review your current setup.","Consider an independent financial adviser.","Revisit annually as circumstances change."]
    };
    try { const result = await callClaude(prompt,900); setConcernResults(prev=>[...prev,{concernId:cId,result}]); }
    catch(e) { setConcernResults(prev=>[...prev,{concernId:cId,result:fallback}]); }
    finally { setScreen("concernResult"); }
  }

  function nextConcern() {
    const next = concernIdx + 1;
    if (next < selectedConcerns.length) { setConcernIdx(next); setScreen("concernDeepDive"); }
    else setScreen("allConcernsDone");
  }

  function resetAll() {
    setScreen("landing"); setStep(0); setInsights(null); setD(INIT_DATA);
    setSelectedConcerns([]); setConcernIdx(0); setConcernAnswers({}); setConcernResults([]);
    setActiveModule(null); setCompletedModules([]);
  }

  // ── Router ──
  if (screen === "landing") return <Landing onFullJourney={() => setScreen("onboarding")} onConcernOnly={() => setScreen("concernSelector")} onStarterFlow={() => setScreen("starterFlow")} activePersona={activePersona} onSwitchPersona={switchPersona}/>;

  if (screen === "starterFlow") return <StarterFlow onBack={() => setScreen("landing")} onUpgrade={() => setScreen("onboarding")}/>;

  if (screen === "onboarding") return (
    <PageWrap>
      <NavBar center={`Step ${step+1} of ${STEPS.length} — ${STEPS[step]}`}/>
      <ProgressBar pct={(step+1)/STEPS.length*100}/>
      <ContentWrap>
        <OnboardingStep step={step} d={d} set={set}/>
        <div style={{display:"flex",gap:"10px",marginTop:"40px"}}>
          <button onClick={() => step>0 ? setStep(s=>s-1) : setScreen("landing")} style={{flex:1,padding:"13px",background:"transparent",border:"1.5px solid rgba(22,47,36,0.22)",borderRadius:"8px",fontSize:"15px",color:TEXT,fontWeight:500}}>← Back</button>
          <button onClick={() => step<STEPS.length-1 ? setStep(s=>s+1) : generateDashboard()} style={{flex:2,padding:"13px",background:G,border:"none",borderRadius:"8px",fontSize:"15px",fontWeight:600,color:WHITE}}>
            {step===STEPS.length-1 ? "Generate my Candid report →" : "Continue →"}
          </button>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:"6px",marginTop:"22px"}}>
          {STEPS.map((_,i) => <div key={i} style={{width:i===step?"26px":"8px",height:"8px",borderRadius:"4px",background:i===step?GOLD:i<step?G:"rgba(22,47,36,0.18)",transition:"all 0.3s ease"}}/>)}
        </div>
      </ContentWrap>
    </PageWrap>
  );

  if (screen === "loading") return <LoadingScreen name={d.name} msgs={["Analysing your cash position...","Calculating pension tax relief...","Reviewing ISA headroom...","Modelling your student loan...","Building your Candid report..."]}/>;

  if (screen === "dashboard") return (
    <Dashboard insights={insights} d={d} m={m} onReset={resetAll} completedModules={completedModules}
      onOpenModule={key => openModule(key, "dashboard")}
      onDigDeeper={() => { setConcernResults([]); setConcernIdx(0); setScreen("concernSelector"); }}/>
  );

  if (screen === "moduleDeepDive") {
    const localStatuses = computeModuleStatuses(d, m);
    const statusOrder = { critical:0, attention:1, ok:2, na:3 };
    const allMods = MODULE_META.map(mm => {
      const local = localStatuses[mm.key] || { status:"na", impact:0 };
      const aiMod = insights?.modules?.[mm.key];
      const status = (aiMod?.status && aiMod.status !== "na") ? aiMod.status : local.status;
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
      <ModuleDeepDive moduleKey={activeModule} insights={insights} d={d} m={m}
        openSection={activeSection}
        goBack={() => setScreen("dashboard")}
        goToDashboard={() => setScreen("dashboard")}
        onComplete={() => markModuleComplete(activeModule)}
        isComplete={completedModules.includes(activeModule)}
        onOpenModule={(key, section) => openModule(key, "moduleDeepDive", section)}
        nextModule={nextMod}/>
    );
  }

  if (screen === "concernSelector") return (
    <ConcernSelector selected={selectedConcerns} onToggle={toggleConcern}
      onContinue={() => { setConcernIdx(0); setConcernResults([]); setScreen("concernTriage"); }}
      onBack={() => setScreen(insights ? "dashboard" : "landing")}/>
  );

  if (screen === "concernTriage") return (
    <ConcernTriage selectedConcerns={selectedConcerns} d={d} set={set}
      onContinue={() => setScreen("concernDeepDive")}
      onBack={() => setScreen("concernSelector")}/>
  );

  if (screen === "concernDeepDive") {
    const cId = selectedConcerns[concernIdx];
    return (
      <ConcernDeepDive concernId={cId} concernIdx={concernIdx} totalConcerns={selectedConcerns.length}
        answers={concernAnswers[cId]||{}} setAnswer={setAnswer}
        onAnalyse={analyseConcern} d={d} m={m}/>
    );
  }

  if (screen === "concernLoading") {
    const cLabel = CONCERN_LIST.find(c=>c.id===selectedConcerns[concernIdx])?.label.toLowerCase();
    return <LoadingScreen name={d.name} msgs={[`Looking at your ${cLabel}...`,"Running the numbers...","Checking the rules...","Putting together your guidance..."]}/>;
  }

  if (screen === "concernResult") {
    const cId = selectedConcerns[concernIdx];
    const result = concernResults.find(r => r.concernId === cId)?.result;
    const isLast = concernIdx === selectedConcerns.length - 1;
    return (
      <ConcernResult result={result} concernId={cId} concernIdx={concernIdx}
        totalConcerns={selectedConcerns.length} onNext={nextConcern}
        onViewAll={() => setScreen(isLast ? "allConcernsDone" : "dashboard")} isLast={isLast}/>
    );
  }

  if (screen === "allConcernsDone") return (
    <AllConcernsDone concernResults={concernResults} hasFullScore={!!insights}
      onBackToDashboard={() => setScreen("dashboard")} onReset={resetAll}/>
  );

  return null;
}
