// Cash & savings' quick start (quickStart.js): how much, roughly what it
// earns, monthly costs, and a Cash ISA this tax year only where interest
// could go over the Personal Savings Allowance. Unit tested in
// quickStart.test.js.
import { PSA_BY_BAND } from "./tax.js";
import { withEstimates, addAsked } from "./quickStart.js";

// For "Not sure" of the rate: the UK average easy-access rate, about 2.5%
// through 2026 (Moneyfacts monthly averages). Not the rate feed's average,
// which tracks only the top accounts and would make the gap look smaller.
export const TYPICAL_EASY_ACCESS_PCT = 2.5;

export const SAVINGS_BANDS = [
  { value:"u1", label:"Under £1k", floor:0, figure:500 },
  { value:"1-2.5", label:"£1k to £2.5k", floor:1000, figure:1750 },
  { value:"2.5-5", label:"£2.5k to £5k", floor:2500, figure:3750 },
  { value:"5-10", label:"£5k to £10k", floor:5000, figure:7500 },
  { value:"10-20", label:"£10k to £20k", floor:10000, figure:15000 },
  { value:"20-50", label:"£20k to £50k", floor:20000, figure:35000 },
  { value:"50-100", label:"£50k to £100k", floor:50000, figure:75000 },
  { value:"100+", label:"£100k or more", floor:100000, figure:130000 },
];
export const RATE_BANDS = [
  { value:"u1", label:"Under 1%", figure:0.5 },
  { value:"1-2", label:"1% to 2%", figure:1.5 },
  { value:"2-3", label:"2% to 3%", figure:2.5 },
  { value:"3-4", label:"3% to 4%", figure:3.5 },
  { value:"4+", label:"4% or more", figure:4.5 },
  { value:"unsure", label:"Not sure", figure:TYPICAL_EASY_ACCESS_PCT },
];
export const COST_BANDS = [
  { value:"u1", label:"Under £1k", figure:800 },
  { value:"1-1.5", label:"£1k to £1.5k", figure:1250 },
  { value:"1.5-2", label:"£1.5k to £2k", figure:1750 },
  { value:"2-3", label:"£2k to £3k", figure:2500 },
  { value:"3-4", label:"£3k to £4k", figure:3500 },
  { value:"4+", label:"£4k or more", figure:4750 },
];
export const ISA_BANDS = [
  { value:"none", label:"No", figure:0 },
  { value:"u5", label:"Under £5k", figure:2500 },
  { value:"5-10", label:"£5k to £10k", figure:7500 },
  { value:"10-20", label:"£10k to £20k", figure:15000 },
];

// The savings at which interest at about 5% would use up the Personal
// Savings Allowance: £20k basic rate (£1,000), £10k higher (£500), and from
// £1k for additional rate (no allowance).
export function isaAskedFrom(m) {
  const psa = PSA_BY_BAND[m?.taxBandLabel] ?? PSA_BY_BAND.basic;
  return psa > 0 ? psa / 0.05 : 1000;
}

const hasCash = d => (d.cashTiers || []).some(t => +t.amount > 0);
// Whether the amount is asked: the rate is counted with it from the start,
// so "1 of N" doesn't grow.
const savingsAsked = d => !hasCash(d) && !(d.askedFields || []).some(f => f === "cashTiers" || f === "hasCashSavings");
const band = (list, value) => list.find(b => b.value === value);

export const CASH_QUICK = {
  module: "cash",
  intro: { title: "Cash & savings", subtitle: "Money left in a low-rate account loses value every year.", question: "How much is yours losing?" },
  order: ["savings", "rate", "costs", "isa"],
  questions: {
    savings: {
      ask: "Roughly how much do you have in savings?", why: "Not counting Premium Bonds. Cash ISAs included.",
      options: () => SAVINGS_BANDS,
      when: ({ d }) => savingsAsked(d),
    },
    rate: {
      ask: "Roughly what does it earn?", why: "Your banking app shows the rate. A rough idea is fine.",
      options: () => RATE_BANDS,
      when: ({ d, a }) => !!a.savings || savingsAsked(d),
    },
    costs: {
      ask: "Roughly what are your monthly costs?", why: "Rent or mortgage, bills, food and travel.",
      options: () => COST_BANDS,
      when: ({ d }) => !(+d.monthlyExpenses > 0),
    },
    isa: {
      ask: "Paid into a Cash ISA since 6 April?", why: "Interest in an ISA is tax-free, so it changes what you keep.",
      options: () => ISA_BANDS,
      when: ({ d, m, a }) => (band(SAVINGS_BANDS, a.savings)?.floor ?? -1) >= isaAskedFrom(m) && !(d.askedFields || []).includes("hasCashIsaThisYear"),
    },
  },
  patch(d, m, a) {
    const patch = {}, items = [], asked = [];
    const savings = band(SAVINGS_BANDS, a.savings), rate = band(RATE_BANDS, a.rate);
    if (savings) {
      const r = rate || band(RATE_BANDS, "unsure");
      patch.cashTiers = [{ name: "", amount: String(savings.figure), rate: String(r.figure) }];
      patch.hasCashSavings = "yes";
      asked.push("hasCashSavings", "cashTiers");
      items.push({ phrase: `${savings.label} in savings`, field: "cashTiers.0.amount", value: patch.cashTiers[0].amount });
      items.push({ phrase: r.value === "unsure" ? `earning ${r.figure}%, the UK average` : `earning ${r.label.toLowerCase()}`, field: "cashTiers.0.rate", value: patch.cashTiers[0].rate });
    }
    const costs = band(COST_BANDS, a.costs);
    if (costs) {
      patch.monthlyExpenses = String(costs.figure);
      items.push({ phrase: `${costs.label} a month in costs`, field: "monthlyExpenses", value: patch.monthlyExpenses });
    }
    const isa = band(ISA_BANDS, a.isa);
    if (isa) {
      patch.hasCashIsaThisYear = isa.figure > 0 ? "yes" : "no";
      patch.isaThisYearCash = isa.figure > 0 ? String(isa.figure) : "";
      asked.push("hasCashIsaThisYear");
      if (isa.figure > 0) items.push({ phrase: `${isa.label} in a Cash ISA this year`, field: "isaThisYearCash", value: patch.isaThisYearCash });
    }
    return { ...patch, ...addAsked(d, asked), ...withEstimates(d, "cash", items) };
  },
};
