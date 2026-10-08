// The 20 archetypes of investor-personas.md, section 4, as data for the
// engine. Amounts are in today's (2026/27) money. Year 1 is 2026/27; events
// are keyed by year. `member` lists the years each is a Candid member.
// The first person is the Candid user; Candid's levers act on their money,
// and on the household's cash.
//
// cash[].kind: "current" (0%), "bigbank" (the inertia rate), "legacy" (an
// old account, Bank Rate + spread), "diy" (someone who keeps their own money
// on top rates). `inflow`: the account the year's spare money lands in.

const employed = (salary, pension = {}) => ({ employment: "employed", salary, pension });
const dc = (own, { employer = 0, matchUpTo = null, pot = 0, sacrifice = false } = {}) => ({ type: "dc", own, employer, matchUpTo, pot, sacrifice });
const db = { type: "db" };

export const ARCHETYPES = [
  {
    id: "priya", name: "Priya", age: 23, summary: "First job", region: "other", engagement: "mid", member: [[1, 4]],
    people: [{ name: "Priya", age: 23, ...employed(32000, dc(4, { matchUpTo: 6, pot: 3000 })),
      sl: { plan: "plan2", balance: 52000, writeOffYear: 2056, overpay: 1200 } }],
    cash: [{ name: "Current account", amount: 3000, kind: "current" }],
    housing: { type: "rent", rent: 7800 }, spending: 13500,
    events: {
      2: [{ type: "salary", to: 35000 }],
      3: [{ type: "salary", to: 44000, pension: { matchUpTo: 5 } }, { type: "spend", amount: 1500 }],
      5: [{ type: "salary", to: 52000 }],
      6: [{ type: "buy", price: 220000 }, { type: "spend", amount: 1500 }],
    },
  },
  {
    id: "callum", name: "Callum", age: 29, summary: "Heading for the £100k trap", region: "other", engagement: "high", member: [[1, 10]],
    people: [
      { name: "Callum", age: 29, ...employed(68000, dc(5, { employer: 5, pot: 28000, sacrifice: true })), isaSS: 8000,
        sl: { plan: "plan2", balance: 60000, writeOffYear: 2049 } },
      { name: "Ella", age: 29, ...employed(38000, db), sl: { plan: "plan2", balance: 35000, writeOffYear: 2050 } },
    ],
    cash: [{ name: "Big-bank saver", amount: 25000, kind: "bigbank" }, { name: "Current account", amount: 3000, kind: "current" }],
    housing: { type: "rent", rent: 18000 }, spending: 38000,
    events: {
      2: [{ type: "salary", to: 78000 }],
      3: [{ type: "bonus", amount: 10000 }],
      4: [{ type: "salary", to: 88000, pension: { employer: 3 } }],
      5: [{ type: "buy", price: 450000 }, { type: "spend", amount: 2000 }],
      7: [{ type: "salary", to: 105000 }],
      8: [{ type: "baby" }, { type: "spend", amount: 3000 }],
      9: [{ type: "partTime", person: 1, factor: 0.8 }],
      10: [{ type: "baby" }, { type: "spend", amount: 2000 }],
      12: [{ type: "salary", to: 125000 }],
    },
  },
  {
    id: "aisha", name: "Aisha", age: 34, summary: "NHS nurse, family of four", region: "other", engagement: "mid", member: [[1, 3]],
    people: [
      { name: "Aisha", age: 34, ...employed(42000, db), sl: { plan: "plan1", balance: 9000, writeOffYear: 2039 } },
      { name: "Yusuf", age: 36, ...employed(34000, dc(5, { employer: 3, pot: 15000 })) },
    ],
    cash: [{ name: "Current account", amount: 6000, kind: "current" }],
    housing: { type: "mortgage", value: 240000, balance: 180000, ratePct: 4.2, fixEnd: 2, termYears: 25 },
    spending: 33000, children: [{ born: 2019 }, { born: 2022 }],
    events: {
      3: [{ type: "salary", to: 49000 }],
      4: [{ type: "partTime", person: 1, factor: 0.8 }],
    },
  },
  {
    id: "dev", name: "Dev", age: 41, summary: "Self-employed electrician", region: "london_se", engagement: "low", member: [[1, 2], [4, 6]],
    people: [
      { name: "Dev", age: 41, employment: "self", salary: 55000 },
      { name: "Anjali", age: 39, ...employed(28000, dc(5, { employer: 3, pot: 22000 })) },
    ],
    cash: [{ name: "Business account (tax pot)", amount: 18000, kind: "current" }, { name: "Current account", amount: 4000, kind: "current" }],
    housing: { type: "mortgage", value: 520000, balance: 210000, ratePct: 4.5, fixEnd: 3, termYears: 18 },
    spending: 33000, children: [{ born: 2016 }],
    events: {
      2: [{ type: "salary", to: 70000 }],
      3: [{ type: "salary", to: 31000 }],
      4: [{ type: "salary", to: 58000 }],
      6: [{ type: "salary", to: 65000 }],
    },
  },
  {
    id: "margaret", name: "Margaret", age: 62, summary: "Cash-rich, rate-poor", region: "other", engagement: "high", member: [[1, 12]],
    people: [{ name: "Margaret", age: 62, employment: "retired", dbIncome: 24000, spa: 67 }],
    cash: [
      { name: "Big-bank saver A", amount: 100000, kind: "bigbank" },
      { name: "Big-bank saver B", amount: 80000, kind: "bigbank" },
      { name: "Current account", amount: 5000, kind: "current" },
    ],
    inflow: 2, premiumBonds: 30000,
    housing: { type: "owned", value: 340000 }, spending: 19000,
    events: {
      3: [{ type: "gift", amount: 20000 }],
      8: [{ type: "downsize", newValue: 220000, costs: 12000 }],
      10: [{ type: "spend", amount: 12000 }],
    },
  },
  {
    id: "jordan-sam", name: "Jordan and Sam", age: 31, summary: "Saving for a first home", region: "other", engagement: "mid", member: [[1, 3], [7, 9]],
    people: [
      { name: "Jordan", age: 31, ...employed(36000, dc(3, { matchUpTo: 6, pot: 12000 })), sl: { plan: "plan2", balance: 38000, writeOffYear: 2047 } },
      { name: "Sam", age: 30, ...employed(39000, db), sl: { plan: "plan2", balance: 42000, writeOffYear: 2048 } },
    ],
    cash: [{ name: "Joint saver", amount: 35000, kind: "bigbank" }, { name: "Current account", amount: 3000, kind: "current" }],
    cashShare: [0.5, 0.5],
    housing: { type: "rent", rent: 13200 }, spending: 24000,
    events: {
      2: [{ type: "buy", price: 285000 }, { type: "spend", amount: 1500 }],
      3: [{ type: "baby" }, { type: "monthsOut", person: 1, months: 9 }, { type: "spend", amount: 2500 }],
      4: [{ type: "partTime", person: 1, factor: 0.6 }],
      6: [{ type: "baby" }, { type: "spend", amount: 2000 }],
      9: [{ type: "partTime", person: 1, factor: 1 }],
    },
  },
  {
    id: "kwame", name: "Kwame", age: 45, summary: "The 60% tax trap, then a windfall", region: "london_se", engagement: "high", member: [[1, 8]],
    people: [
      { name: "Kwame", age: 45, ...employed(110000, dc(5, { employer: 8, pot: 280000, sacrifice: true })), bonus: 30000,
        isaSS: 120000, gia: { value: 60000, basis: 35000 } },
      { name: "Adjoa", age: 44, ...employed(45000, db) },
    ],
    cash: [{ name: "Big-bank saver", amount: 40000, kind: "bigbank" }, { name: "Current account", amount: 6000, kind: "current" }],
    housing: { type: "mortgage", value: 1100000, balance: 400000, ratePct: 4.6, fixEnd: 2, termYears: 15 },
    spending: 62000, children: [{ born: 2010 }, { born: 2012 }],
    events: {
      2: [{ type: "bonus", amount: 45000 }],
      3: [{ type: "spend", amount: 10000 }],
      5: [{ type: "redundancy", payout: 45000, monthsOut: 7 }],
      6: [{ type: "salary", to: 120000, bonus: 20000 }],
      8: [{ type: "inheritance", amount: 250000 }],
      9: [{ type: "spend", amount: -10000 }],
    },
  },
  {
    id: "ellie", name: "Ellie", age: 26, summary: "No spare money", region: "london_se", engagement: "low", member: [[1, 1]],
    people: [{ name: "Ellie", age: 26, ...employed(22000, dc(5, { employer: 3, pot: 4000 })), sl: { plan: "plan2", balance: 48000, writeOffYear: 2052 } }],
    cash: [{ name: "Current account", amount: 800, kind: "current" }],
    debts: [{ name: "Credit card", balance: 1500, ratePct: 24, payment: 600 }],
    housing: { type: "rent", rent: 7800 }, spending: 10500,
    events: { 2: [{ type: "salary", to: 26000 }], 4: [{ type: "salary", to: 30000 }] },
  },
  {
    id: "raj", name: "Raj", age: 38, summary: "Missing the match", region: "other", engagement: "mid", member: [[1, 3], [9, 10]],
    people: [
      { name: "Raj", age: 38, ...employed(58000, dc(4, { matchUpTo: 8, pot: 60000 })) },
      { name: "Meera", age: 36, employment: "none", salary: 0 },
    ],
    cash: [{ name: "High-street saver", amount: 30000, kind: "bigbank" }, { name: "Current account", amount: 3000, kind: "current" }],
    premiumBonds: 10000,
    housing: { type: "mortgage", value: 330000, balance: 240000, ratePct: 4.4, fixEnd: 4, termYears: 25 },
    spending: 30000, children: [{ born: 2023 }],
    events: {
      3: [{ type: "baby" }, { type: "spend", amount: 2000 }],
      5: [{ type: "salary", person: 1, to: 32000, employment: "employed", pension: dc(5, { employer: 3 }) }],
      7: [{ type: "salary", to: 70000 }],
      9: [{ type: "inheritance", amount: 80000 }],
    },
  },
  {
    id: "hannah", name: "Hannah", age: 52, summary: "Old savings and early retirement", region: "other", engagement: "high", member: [[1, 7]],
    people: [{ name: "Hannah", age: 52, ...employed(82000, db) }],
    cash: [
      { name: "Old Cash ISAs", amount: 60000, kind: "legacy", spread: -2.55, isa: true },
      { name: "Current account", amount: 40000, kind: "current" },
    ],
    inflow: 1,
    housing: { type: "mortgage", value: 420000, balance: 90000, ratePct: 4.0, fixEnd: 2, termYears: 10 },
    spending: 36000,
    events: {
      4: [{ type: "gift", amount: 15000 }],
      6: [{ type: "retire", dbIncome: 30000, lumpSum: 95000 }, { type: "spend", amount: -6000 }],
      7: [{ type: "salary", to: 15000, employment: "self" }],
    },
  },
  {
    id: "marcus", name: "Marcus", age: 24, summary: "Living at home, saving hard", region: "other", engagement: "mid", member: [[1, 2]],
    people: [{ name: "Marcus", age: 24, ...employed(28000, dc(5, { employer: 3, pot: 6000 })) }],
    cash: [{ name: "Current account", amount: 9000, kind: "current" }],
    housing: { type: "rent", rent: 0 }, spending: 12000,
    events: {
      2: [{ type: "salary", to: 31000 }],
      3: [{ type: "rent", to: 8400 }, { type: "spend", amount: 3000 }],
      4: [{ type: "redundancy", payout: 3000, monthsOut: 4 }],
      5: [{ type: "salary", to: 38000 }],
      7: [{ type: "buy", price: 170000 }],
    },
  },
  {
    id: "sophie", name: "Sophie", age: 36, summary: "Academic on short contracts", region: "london_se", engagement: "mid", member: [[1, 4]],
    people: [{ name: "Sophie", age: 36, ...employed(44000, db), sl: { plan: "plan2", balance: 45000, writeOffYear: 2043, overpay: 600 } }],
    cash: [{ name: "Current account", amount: 12000, kind: "current" }],
    housing: { type: "rent", rent: 13800 }, spending: 14000,
    events: {
      2: [{ type: "monthsOut", months: 3 }],
      3: [{ type: "salary", to: 47000 }],
      5: [{ type: "break", cost: 8000, niGap: true, livingFactor: 0.4 }],
      6: [{ type: "salary", to: 52000 }],
    },
  },
  {
    id: "gareth", name: "Gareth", age: 58, summary: "Last of the mortgage, planning retirement", region: "other", engagement: "mid", member: [[1, 6]],
    people: [
      { name: "Gareth", age: 58, ...employed(46000, dc(5, { employer: 5, pot: 210000 })) },
      { name: "Carys", age: 57, ...employed(14000) },
    ],
    cash: [{ name: "Big-bank saver", amount: 35000, kind: "bigbank" }, { name: "Current account", amount: 3000, kind: "current" }],
    inflow: 1,
    housing: { type: "svr", value: 260000, balance: 20000, termYears: 4 }, spending: 30000,
    events: {
      2: [{ type: "salary", to: 48000 }],
      5: [{ type: "retire", drawdown: { annual: 22000 } }],
    },
  },
  {
    id: "nadia", name: "Nadia", age: 29, summary: "Fast-track career, big decisions", region: "london_se", engagement: "high", member: [[1, 3]],
    people: [{ name: "Nadia", age: 29, ...employed(75000, dc(0, { employer: 8, pot: 30000, sacrifice: true })), isaSS: 15000,
      sl: { plan: "plan2", balance: 65000, writeOffYear: 2049 } }],
    cash: [{ name: "Big-bank saver", amount: 40000, kind: "bigbank" }, { name: "Current account", amount: 4000, kind: "current" }],
    housing: { type: "rent", rent: 24000 }, spending: 20000,
    events: {
      2: [{ type: "salary", to: 85000 }, { type: "bonus", amount: 12000 }],
      3: [{ type: "break", cost: 30000, livingFactor: 0.8 }],
      4: [{ type: "salary", to: 130000, bonus: 30000 }],
      6: [{ type: "buy", price: 600000 }],
      7: [{ type: "salary", to: 160000 }],
    },
  },
  {
    id: "daniel", name: "Daniel", age: 47, summary: "Single dad, driving for a living", region: "other", engagement: "low", member: [[1, 1]],
    people: [{ name: "Daniel", age: 47, employment: "self", salary: 30000 }],
    cash: [{ name: "Current account", amount: 2000, kind: "current" }],
    debts: [{ name: "Car finance", balance: 4000, ratePct: 11.9, payment: 1600 }],
    housing: { type: "rent", rent: 7800 }, spending: 15500, children: [{ born: 2014 }, { born: 2017 }],
  },
  {
    id: "fatima-imran", name: "Fatima and Imran", age: 33, summary: "Banking without interest", region: "other", engagement: "mid", member: [[1, 4]],
    sharia: true, noPremiumBonds: true, noLisa: true,
    people: [
      { name: "Imran", age: 35, ...employed(52000, dc(3, { matchUpTo: 6, pot: 25000 })) },
      { name: "Fatima", age: 33, ...employed(38000, db) },
    ],
    cash: [{ name: "Current account", amount: 28000, kind: "current" }],
    cashShare: [0.5, 0.5],
    housing: { type: "rent", rent: 9600 }, spending: 34000, children: [{ born: 2023 }],
    events: {
      3: [{ type: "buy", price: 240000 }, { type: "baby" }, { type: "spend", amount: 2000 }],
      5: [{ type: "partTime", person: 1, factor: 0.6 }],
    },
  },
  {
    id: "oliver", name: "Oliver", age: 35, summary: "Already does it all", region: "other", engagement: "high", member: [[1, 1]],
    people: [
      { name: "Oliver", age: 35, ...employed(95000, dc(10, { employer: 10, pot: 150000, sacrifice: true })), isaSS: 90000, isaHabit: 20000 },
      { name: "Rosa", age: 34, ...employed(60000, dc(5, { employer: 5, pot: 60000, sacrifice: true })) },
    ],
    cash: [{ name: "Best-buy saver", amount: 30000, kind: "diy" }],
    housing: { type: "mortgage", value: 550000, balance: 300000, ratePct: 4.3, fixEnd: 3, termYears: 25 },
    spending: 40000,
  },
  {
    id: "grace", name: "Grace", age: 40, summary: "Caring for a parent, then a windfall", region: "other", engagement: "mid", member: [[1, 6]],
    people: [{ name: "Grace", age: 40, ...employed(60000, dc(5, { employer: 5, pot: 70000 })) }],
    cash: [{ name: "Big-bank saver", amount: 15000, kind: "bigbank" }, { name: "Current account", amount: 3000, kind: "current" }],
    inflow: 1,
    housing: { type: "mortgage", value: 230000, balance: 140000, ratePct: 4.3, fixEnd: 3, termYears: 20 },
    spending: 22000,
    events: {
      2: [{ type: "partTime", factor: 0.6 }, { type: "spend", amount: 3000 }],
      4: [{ type: "inheritance", amount: 220000 }, { type: "spend", amount: -3000 }],
      5: [{ type: "partTime", factor: 1 }, { type: "salary", to: 62000 }],
    },
  },
  {
    id: "ben", name: "Ben", age: 21, summary: "Grows up with Candid", region: "other", engagement: "mid", member: [[1, 12]],
    people: [
      { name: "Ben", age: 21, ...employed(9000), sl: { plan: "plan5", balance: 50000, writeOffYear: 2068 } },
      // A partner from year 8, when they buy together.
      { name: "Partner", age: 22, employment: "none", salary: 0, buying: false },
    ],
    cash: [{ name: "Current account", amount: 1500, kind: "current" }],
    // Year 1 spending is net of his maintenance loan.
    housing: { type: "rent", rent: 5400 }, spending: 3000,
    events: {
      2: [{ type: "salary", to: 30000, pension: dc(3, { matchUpTo: 5 }), creep: false }, { type: "rent", to: 8400 }, { type: "spend", amount: 9000 }],
      4: [{ type: "salary", to: 36000 }],
      6: [{ type: "salary", to: 46000 }],
      8: [{ type: "buy", price: 250000 }, { type: "salary", person: 1, to: 34000, employment: "employed", pension: dc(5, { employer: 3 }) }, { type: "spend", amount: 6000 }],
      10: [{ type: "salary", to: 58000 }],
      11: [{ type: "baby" }, { type: "spend", amount: 3000 }],
    },
  },
  {
    id: "helen-richard", name: "Helen and Richard", age: 66, summary: "Comfortable retirees", region: "london_se", engagement: "high", member: [[1, 7]],
    people: [
      { name: "Richard", age: 68, employment: "retired", dbIncome: 35000, spa: 66, isaSS: 150000 },
      { name: "Helen", age: 66, employment: "retired", dbIncome: 8000, spa: 66, isaSS: 150000, pension: { type: "dc", own: 0, pot: 400000 } },
    ],
    cash: [
      { name: "Big-bank saver (Richard)", amount: 200000, kind: "bigbank" },
      { name: "Big-bank saver (Helen)", amount: 50000, kind: "bigbank" },
      { name: "Current account", amount: 8000, kind: "current" },
    ],
    inflow: 2, cashShare: [0.8, 0.2],
    housing: { type: "owned", value: 1100000 }, spending: 52000,
    events: { 4: [{ type: "gift", amount: 100000 }], 7: [{ type: "oneOff", amount: 10000 }] },
  },
];
