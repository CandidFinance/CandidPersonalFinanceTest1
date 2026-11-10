import { useCallback, useMemo, useState } from "react";
import { Banknote, Briefcase, Building2, Car, CreditCard, Crown, Gem, GraduationCap, Hourglass, Home, Landmark, List, Lock, Package, Percent, PiggyBank, Receipt, TrendingDown, TrendingUp, Unlock } from "lucide-react";
import { G, CREAM, WHITE, TEXT, MUT, SANS, SERIF, GAIN_ON_DARK, GOLD_TEXT, ERROR_TEXT, MODULE_CHART_COLOR as C, CUSTOM_GOAL_COLOR } from "../design-tokens.js";
import { DetailScreen, GroupedList, MonthlyStack, NetWorthScreen, Segmented, Sheet } from "../mobile/networth/NetWorthParts.jsx";

// Dev only, /dev/net-worth-mock: the net worth redesign on invented figures.
// Every series is built per account and summed upwards, so a category's line,
// the assets total and the net worth line all tally at every point.
//
// Custom items, the shape proposed for saved inputs (customItems):
//   { id, kind: "asset" | "debt", type, name, value,
//     liquidity: "days" | "months" | "longer"  (assets; decides Access view),
//     growthPct                                (assets; projection, can be negative),
//     ratePct, monthlyPayment                  (debts; projection) }

const brackets = (v, text) => (v < 0 ? `(${text})` : text);
const fmt = v => brackets(v, `£${Math.abs(Math.round(v)).toLocaleString("en-GB")}`);
const fmtAxis = v => {
  const a = Math.abs(v);
  // A decimal under £100k, where a narrow range would repeat whole thousands.
  return brackets(v, a >= 999500 ? `£${(a / 1e6).toFixed(1)}m` : a >= 100000 ? `£${Math.round(a / 1000)}k` : `£${(a / 1000).toFixed(1)}k`);
};
const owed = { format: v => fmt(-Math.abs(v)), formatAxis: v => fmtAxis(-Math.abs(v)) };

const theme = {
  page: CREAM, surface: WHITE, text: TEXT, muted: MUT, hairline: "rgba(22,47,36,0.09)", track: "rgba(22,47,36,0.06)", fontBody: SANS, fontFigure: SERIF, shadow: "0 2px 10px rgba(22,47,36,0.07)",
  accent: GAIN_ON_DARK, band: G, bandText: CREAM, bandMuted: "rgba(250,247,240,0.68)", bandHairline: "rgba(250,247,240,0.16)", bandTrack: "rgba(250,247,240,0.12)", asset: GAIN_ON_DARK, debt: "#f0806f", interest: "#e8e1cf", // cream, not red: red and green stacked fail the colour-blindness check
  premium: GOLD_TEXT, dangerText: ERROR_TEXT, scrim: "rgba(10,20,15,0.5)",
};
const icon = I => <I size={16} strokeWidth={2} aria-hidden="true"/>;

// ── Time: 24 months back, then 20 years of projection ─────────────────
const BACK = 24, AHEAD = 240, NOW_T = 2026 * 12 + 10; // Nov 2026
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TIMES = Array.from({ length: BACK + AHEAD + 1 }, (_, i) => {
  const t = NOW_T + i - BACK;
  return { t, label: `${MONTHS[t % 12]} ${String(Math.floor(t / 12)).slice(2)}` };
});
// `fresh`: added today, so counted from today only. `past`: balances from a
// ledger (walkBack), so payments and the line tally.
const series = (v, { back = 0, pct = 0, add = 0, wiggle = 0, seed = 1, fresh = false, past } = {}) => TIMES.map((_, i) => {
  const k = i - BACK;
  if (k === 0) return v;
  if (k < 0 && fresh) return 0;
  if (k < 0 && past) return past[k];
  if (k < 0) return Math.max(0, Math.round(v + k * back + wiggle * Math.sin(k * 1.3 + seed)));
  const r = pct / 100 / 12;
  return Math.max(0, Math.round(v * (1 + r) ** k + add * (r ? ((1 + r) ** k - 1) / r : k)));
});
const addUp = list => TIMES.map((_, i) => list.reduce((s, a) => s + a.series[i], 0));

// Walks back from today's balance a month at a time. Each month's entries
// carry `delta`, the change they made to this balance.
function walkBack(v, monthOf) {
  const past = {}, txs = [];
  let bal = v;
  for (let k = 0; k > -BACK; k--) {
    const list = monthOf(k, bal);
    txs.push(...list.map(x => ({ ...x, k })));
    bal -= list.reduce((s, x) => s + x.delta, 0);
    past[k - 1] = bal;
  }
  return { past, txs };
}
// The one overpayment is one movement seen from both sides: out of the saver,
// off the student loan. Net worth doesn't change.
const OVERPAID_K = -3, OVERPAID = 500;
const STUDENT_LEDGER = walkBack(41200, (k, bal) => {
  if (k === 0) return []; // November's payday hasn't happened
  const interest = Math.round(bal * 0.0432 / 12), principal = 185 - interest;
  return [
    { day: 28, desc: "Repayment through payroll", source: "Payslip", amount: -185, interest, principal, delta: -principal },
    ...(k === OVERPAID_K ? [{ day: 14, desc: "Overpayment to Student Loans Company", source: "Bank", from: "From Easy access saver", amount: -OVERPAID, interest: 0, principal: OVERPAID, delta: -OVERPAID }] : []),
  ];
});
const MORTGAGE_LEDGER = walkBack(268000, (k, bal) => {
  const r = 0.0445 / 12, interest = Math.round((bal + 1420) / (1 + r) * r), principal = 1420 - interest;
  return [{ day: 1, desc: "Mortgage payment", source: "Bank", amount: -1420, interest, principal, delta: -principal }];
});
const SAVER_LEDGER = walkBack(12000, (k, bal) => [
  { day: 1, desc: "Interest", source: "Bank", amount: Math.round(bal * 0.0425 / 12), delta: Math.round(bal * 0.0425 / 12) },
  ...(k < 0 ? [{ day: 25, desc: "Transfer in", source: "Bank", amount: 150, delta: 150 }] : []),
  ...(k === OVERPAID_K ? [{ day: 14, desc: "Student Loans Company", source: "Bank", from: "Overpayment, taken off the student loan", amount: -OVERPAID, delta: -OVERPAID }] : []),
]);

// ── Sample accounts ───────────────────────────────────────────────────
const acct = (id, label, value, note, facts, s) => ({ id, label, value, note, facts, series: series(value, s) });
const CASH = [
  acct("easy", "Easy access saver", 12000, "4.25% a year", [["Rate", "4.25% a year"], ["Interest a year", "£510"]], { past: SAVER_LEDGER.past, pct: 4.25, add: 150 }),
  acct("fixed", "1-year fixed saver", 8000, "4.60% a year", [["Rate", "4.60% a year"], ["Interest a year", "£368"], ["Matures", "Jun 2027"]], { back: 28, pct: 4.6 }),
  acct("bonds", "Premium Bonds", 4500, "3.60% prize rate", [["Prize fund rate", "3.60%"], ["Typical prizes a year", "£162"]], { back: 40, pct: 3.6 }),
];
const PENSIONS = [
  acct("workplace", "Workplace pension", 71200, "You 5%, employer 5%", [["You pay in", "5% of pay"], ["Employer pays in", "5% of pay"]], { back: 760, pct: 6, add: 580, wiggle: 900, seed: 2 }),
  acct("oldpension", "Previous employer's pension", 17200, "No longer paying in", [["Payments", "Stopped"]], { back: 75, pct: 6, wiggle: 260, seed: 3 }),
];
const INVEST = [
  acct("vanguard", "Vanguard ISA", 26000, "Stocks and shares", [["Type", "Stocks and shares ISA"], ["Paid in this tax year", "£2,100"]], { back: 310, pct: 6, add: 300, wiggle: 520, seed: 4 }),
  acct("hl", "Hargreaves Lansdown ISA", 15000, "Stocks and shares", [["Type", "Stocks and shares ISA"], ["Paid in this tax year", "£0"]], { back: 170, pct: 6, wiggle: 300, seed: 7 }),
  acct("lisa", "Moneybox Lifetime ISA", 7000, "From 60, or towards a first home", [["Type", "Lifetime ISA"], ["Available from", "60, or towards a first home"]], { back: 170, pct: 6, add: 80, wiggle: 110, seed: 5 }),
  acct("gia", "General investment account", 14300, "£3,100 of it gains", [["Unrealised gains", "£3,100"], ["Wrapper", "None"]], { back: 90, pct: 6, wiggle: 340, seed: 6 }),
];
const HOME = [acct("home", "Home", 410000, null, [["Yours", "35%"], ["On the mortgage", "65%"], ["Turns into cash", "By selling or borrowing against it"]], { back: 700 })];
const MORTGAGE = [acct("mortgage", "Mortgage", 268000, null, [["Rate", "4.45%, fixed"], ["Fixed rate ends", "Mar 2028"], ["Monthly payment", "£1,420"]], { past: MORTGAGE_LEDGER.past, pct: 4.45, add: -1420 })];
const STUDENT = [acct("studentLoan", "Student loan", 41200, null, [["Interest rate", "4.32% a year"], ["Repaying a year", "£2,220"], ["Plan outcome", "Rest written off at the end of the plan"]], { past: STUDENT_LEDGER.past, pct: 4.32, add: -185 })];

// ── The third level: where payments went, and what they moved ─────────
const TY_START = 2026 * 12 + 3; // April 2026; the tax year starts on the 6th
const inTaxYear = x => { const t = NOW_T + x.k; return t > TY_START || (t === TY_START && x.day >= 6); };
const splitOf = txs => {
  const year = txs.filter(inTaxYear), total = f => year.reduce((s, x) => s + x[f], 0);
  const months = Array.from({ length: 12 }, (_, i) => {
    const t = TY_START + i, inMonth = year.filter(x => NOW_T + x.k === t), of = f => inMonth.reduce((s, x) => s + x[f], 0);
    return { label: MONTHS[t % 12], interest: of("interest"), principal: of("principal") };
  });
  return { paid: -total("amount"), interest: total("interest"), principal: total("principal"), months };
};
const STUDENT_SPLIT = splitOf(STUDENT_LEDGER.txs), MORTGAGE_SPLIT = splitOf(MORTGAGE_LEDGER.txs);
const homeAt = i => HOME[0].series[i] - MORTGAGE[0].series[i];
const SHARE_NOW = homeAt(BACK), YEAR_START = BACK - 7; // the end of March
const HOME_CHANGE = HOME[0].series[BACK] - HOME[0].series[YEAR_START];
const DEEP = {
  "deep-student": { kind: "split", title: "Payments this tax year", ...STUDENT_SPLIT, txs: STUDENT_LEDGER.txs, principalNote: "Takes the balance down", empty: "Payments show here once a bank account or payslip is connected." },
  "deep-mortgage": { kind: "split", title: "Payments this tax year", ...MORTGAGE_SPLIT, txs: MORTGAGE_LEDGER.txs, principalNote: "Adds to your share of the home", empty: "Payments show here once a bank account is connected." },
  "deep-easy": { kind: "tx", title: "Transactions", txs: SAVER_LEDGER.txs, empty: "Transactions show here once a bank account is connected." },
  "deep-home": { kind: "share", title: "Your share of the home" },
};
STUDENT[0].more = [{ key: "deep-student", label: "Payments this tax year", value: STUDENT_SPLIT.paid, Icon: Receipt }];
MORTGAGE[0].more = [{ key: "deep-mortgage", label: "Payments this tax year", value: MORTGAGE_SPLIT.paid, Icon: Receipt }];
HOME[0].more = [{ key: "deep-home", label: "Your share of the home", value: SHARE_NOW, Icon: Home }];
CASH[0].more = [{ key: "deep-easy", label: "Transactions", text: "", Icon: List }];

const CATS = [
  { key: "cash", label: "Cash", color: C.cash, Icon: Banknote, accounts: CASH, facts: [["Interest a year", "£878"], ["At today's best rates", "£1,040"], ["Typical prizes a year", "£162"]], module: "Cash" },
  { key: "home", label: "Home", color: G, Icon: Home, accounts: HOME, facts: HOME[0].facts },
  { key: "pension", label: "Pension", color: C.pension, Icon: PiggyBank, accounts: PENSIONS, facts: [["By 67 at this rate", "£412,000, in today's money"]], module: "Pension" },
  { key: "investments", label: "Investments", color: C.investments, Icon: TrendingUp, accounts: INVEST, facts: [["In ISAs", "£48,000"], ["Outside an ISA", "£14,300"]], module: "Investments" },
];
const DEBT_CATS = [
  { key: "mortgage", label: "Mortgage", color: C.mortgage, Icon: Landmark, accounts: MORTGAGE, facts: MORTGAGE[0].facts },
  { key: "studentLoan", label: "Student loan", color: C.studentLoan, Icon: GraduationCap, accounts: STUDENT, facts: STUDENT[0].facts, module: "Student loan" },
];

// ── Custom items ──────────────────────────────────────────────────────
const TYPES = {
  vehicle: { label: "Vehicle", group: "Vehicles", Icon: Car, liquidity: "months", growthPct: -15, hint: "e.g. Car" },
  property: { label: "Property", group: "Other property", Icon: Building2, liquidity: "longer", growthPct: 3, hint: "e.g. Second home" },
  valuable: { label: "Valuable", group: "Valuables", Icon: Gem, liquidity: "months", growthPct: 0, hint: "e.g. Watch, art" },
  business: { label: "Business", group: "Business", Icon: Briefcase, liquidity: "longer", growthPct: 0, hint: "e.g. Company shares" },
  other: { label: "Other", group: "Other assets", Icon: Package, liquidity: "months", growthPct: 0, hint: "e.g. Money owed to me" },
};
const LIQUIDITY = [{ key: "days", label: "Days" }, { key: "months", label: "Months" }, { key: "longer", label: "Longer" }];
const LIQ_SAID = { days: "Within days", months: "Within months", longer: "Longer than a year" };
const customAccount = x => x.kind === "asset"
  ? { id: x.id, label: x.name, value: x.value, custom: true,
      note: `${TYPES[x.type].label}, ${LIQ_SAID[x.liquidity].toLowerCase()} to sell`,
      facts: [["Type", TYPES[x.type].label], ["Could become cash", LIQ_SAID[x.liquidity]], ["Change in value a year", `${x.growthPct > 0 ? "+" : ""}${x.growthPct}%`]],
      series: series(x.value, { pct: x.growthPct, fresh: true }) }
  : { id: x.id, label: x.name, value: x.value, custom: true, note: x.ratePct ? `${x.ratePct}% a year` : null,
      facts: [...(x.ratePct ? [["Rate", `${x.ratePct}% a year`]] : []), ...(x.monthly ? [["Monthly payment", fmt(x.monthly)]] : [])],
      series: series(x.value, { pct: x.ratePct, add: -x.monthly, fresh: true }) };

// ── The three ways of grouping ────────────────────────────────────────
const sum = list => list.reduce((s, a) => s + a.value, 0);
function build(custom) {
  const items = custom.map(x => ({ ...x, account: customAccount(x) }));
  const typeGroups = Object.keys(TYPES).map(type => ({ type, list: items.filter(x => x.kind === "asset" && x.type === type) })).filter(g => g.list.length);
  const customCats = typeGroups.map(g => ({ key: `custom-${g.type}`, label: TYPES[g.type].group, color: CUSTOM_GOAL_COLOR, Icon: TYPES[g.type].Icon, accounts: g.list.map(x => x.account), facts: g.list.length === 1 ? g.list[0].account.facts : [] }));
  const debtItems = items.filter(x => x.kind === "debt").map(x => x.account);
  const customDebtCats = debtItems.length ? [{ key: "custom-debts", label: "Other debts", color: C.personalLoan, Icon: CreditCard, accounts: debtItems, facts: debtItems.length === 1 ? debtItems[0].facts : [] }] : [];

  const assetCats = [...CATS, ...customCats];
  const debtCats = [...DEBT_CATS, ...customDebtCats];
  const flat = cats => cats.flatMap(c => c.accounts.map(a => ({ key: `acc-${a.id}`, label: a.label, color: c.color, Icon: c.Icon, accounts: [a], facts: a.facts, custom: a.custom, debt: false })));

  const inDays = items.filter(x => x.kind === "asset" && x.liquidity === "days").map(x => x.account);
  const slow = items.filter(x => x.kind === "asset" && x.liquidity !== "days").map(x => x.account);
  const lisa = INVEST.find(a => a.id === "lisa");
  const nowList = [...CASH, ...INVEST.filter(a => a !== lisa), ...inDays];
  const access = [
    { key: "access-now", label: "Available now", color: C.cash, Icon: Unlock, accounts: nowList, facts: [["Months of spending", String(Math.floor(sum(nowList) / 2000))]] },
    { key: "access-pension", label: "Pension", color: C.pension, Icon: PiggyBank, accounts: PENSIONS, facts: [["Available from", "57, in 26 years"]] },
    { key: "access-lisa", label: "Lifetime ISA", color: C.investments, Icon: Lock, accounts: [lisa], facts: lisa.facts },
    { key: "access-home", label: "Home", color: G, Icon: Home, accounts: HOME, facts: HOME[0].facts },
    ...(slow.length ? [{ key: "access-slow", label: "Takes time to sell", color: CUSTOM_GOAL_COLOR, Icon: Hourglass, accounts: slow, facts: [] }] : []),
  ];

  const byDesc = list => [...list].sort((a, b) => sum(b.accounts) - sum(a.accounts));
  const assets = { type: byDesc(assetCats), account: byDesc(flat(assetCats)), access: byDesc(access) };
  const debts = byDesc(debtCats).map(c => ({ ...c, debt: true }));
  const debtsAcct = byDesc(flat(debtCats)).map(c => ({ ...c, debt: true }));

  const allAssets = assetCats.flatMap(c => c.accounts), allDebts = debtCats.flatMap(c => c.accounts);
  const aSeries = addUp(allAssets), dSeries = addUp(allDebts);
  const groups = {};
  [...assets.type, ...assets.account, ...assets.access, ...debts, ...debtsAcct].forEach(g => { groups[g.key] = g; });
  const addedToday = items.reduce((s, x) => s + (x.kind === "asset" ? x.value : -x.value), 0);
  return { assets, debts, debtsAcct, groups, addedToday, assetsTotal: sum(allAssets), debtsTotal: sum(allDebts), netSeries: aSeries.map((v, i) => v - dSeries[i]) };
}

const toRow = g => {
  const value = sum(g.accounts);
  return { id: g.key, label: g.label, value, negative: !!g.debt, color: g.color, icon: icon(g.Icon), count: g.accounts.length, countSaid: `${g.accounts.length} accounts` };
};

const LABELS = {
  assets: "Assets", debts: "Debts", netWorthAria: "Net worth", chartAria: "Value over time. Scroll sideways to move through time.", rangeAria: "How much time to show", now: "Now",
  projectedNote: "Dashed line projected, with 6% growth a year",
  assetsTitle: "Assets", debtsTitle: "Debts", assetsBarAria: "Assets by size, listed below", debtsBarAria: "Debts by size, listed below", viewAria: "Group by", backSaid: "Back",
};
const DETAIL_LABELS = { ...LABELS, projectedNote: "Dashed line is a projection" };
const VIEWS = [{ key: "type", label: "Category" }, { key: "account", label: "Account" }, { key: "access", label: "Access" }];
const WINDOWS = [{ key: "1y", label: "1Y", months: 12 }, { key: "5y", label: "5Y", months: 60 }, { key: "all", label: "All time", months: Infinity }];

export default function NetWorthMockPage() {
  const [plan, setPlan] = useState("premium");
  const [past, setPast] = useState("history");
  const [view, setView] = useState("type");
  const [range, setRange] = useState("1y");
  const [custom, setCustom] = useState([]);
  const [stack, setStack] = useState([]); // open pages: { key, y } with the scroll to go back to
  const [sheet, setSheet] = useState(null); // "asset", "debt" or "premium"
  const [bank, setBank] = useState("connected");
  const closeSheet = useCallback(() => setSheet(null), []);

  const world = useMemo(() => build(custom), [custom]);
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const from = past === "history" ? 0 : BACK;
  const nowIndex = BACK - from;
  const chartFor = (values, extra = {}, fromNow = false) => {
    const start = fromNow ? BACK : from;
    return { windows: WINDOWS, range, onRangeChange: setRange, points: TIMES.slice(start).map((t, i) => ({ ...t, value: values[i + start] })), nowIndex: BACK - start, reduceMotion, ...extra };
  };

  const open = key => { setStack(s => [...s, { key, y: window.scrollY }]); window.scrollTo(0, 0); };
  const back = () => { const y = stack[stack.length - 1]?.y || 0; setStack(s => s.slice(0, -1)); requestAnimationFrame(() => window.scrollTo(0, y)); };
  const add = kind => setSheet(plan === "premium" ? kind : "premium");
  const netWorth = world.assetsTotal - world.debtsTotal;

  let change;
  if (past === "history") {
    // Something added today is a new entry, not a gain.
    const diff = netWorth - world.addedToday - world.netSeries[BACK - 12];
    change = { tone: diff >= 0 ? "up" : "down", text: `${diff >= 0 ? "+" : ""}${fmt(diff)} in the last 12 months` };
  }

  let page;
  const top = stack[stack.length - 1];
  const g = top && world.groups[top.key];
  const deep = top && DEEP[top.key];
  const deepProps = { theme, format: fmt, formatAxis: fmtAxis, labels: DETAIL_LABELS, onBack: back };
  const listProps = { theme, format: fmt };
  if (deep?.kind === "split") {
    page = (
      <DetailScreen {...deepProps} title={deep.title} value={fmt(deep.paid)}
        bandBody={<MonthlyStack theme={theme} format={fmt} months={deep.months}
          labels={{ interest: "Interest", principal: "Principal", aria: "Payments by month this tax year" }}
          note={bank === "connected" ? "From your transactions" : "Worked out from your balance and rate"}/>}>
        <GroupedList {...listProps} first title="Where it went" total={deep.paid} barAria="Interest and principal, listed below" items={[
          { id: "interest", label: "Interest", value: deep.interest, color: G, icon: icon(Percent) },
          { id: "principal", label: "Principal repaid", note: deep.principalNote, value: deep.principal, color: C.pension, icon: icon(TrendingDown) },
        ]}/>
        <Transactions txs={deep.txs} connected={bank === "connected"} empty={deep.empty}/>
      </DetailScreen>
    );
  } else if (deep?.kind === "tx") {
    page = (
      <DetailScreen {...deepProps} title={deep.title} value={fmt(CASH[0].value)}>
        <Transactions first txs={deep.txs} connected={bank === "connected"} empty={deep.empty}/>
      </DetailScreen>
    );
  } else if (deep?.kind === "share") {
    page = (
      <DetailScreen {...deepProps} title={deep.title} value={fmt(SHARE_NOW)} chart={chartFor(TIMES.map((_, i) => homeAt(i)))}>
        <GroupedList {...listProps} first noBar title="How it adds up" total={SHARE_NOW} items={[
          { id: "value", label: "Home value", value: HOME[0].value },
          { id: "owed", label: "Mortgage", value: MORTGAGE[0].value, negative: true },
        ]}/>
        <GroupedList {...listProps} noBar title="Change this tax year" total={MORTGAGE_SPLIT.principal + HOME_CHANGE} onOpen={open} items={[
          { id: "deep-mortgage", label: "Principal repaid", value: MORTGAGE_SPLIT.principal },
          { id: "homeValue", label: "Change in the home's value", value: HOME_CHANGE, openable: false },
        ]}/>
      </DetailScreen>
    );
  } else if (g) {
    const value = sum(g.accounts);
    const parts = g.accounts.length > 1 ? [...g.accounts].sort((a, b) => b.value - a.value) : [];
    const lone = g.accounts.length === 1 ? g.accounts[0] : null;
    const actions = [
      ...(g.module ? [{ label: `Open the ${g.module} module`, onClick: () => {} }] : []),
      ...(lone?.custom ? [{ label: "Remove", danger: true, onClick: () => { setCustom(c => c.filter(x => x.id !== lone.id)); setStack(s => s.slice(0, -1)); } }] : []),
    ];
    page = (
      <DetailScreen {...deepProps} title={g.label} value={fmt(g.debt ? -value : value)}
        chart={chartFor(addUp(g.accounts), g.debt ? { lineColor: theme.debt, ...owed } : {}, g.accounts.every(a => a.custom))}
        breakdownTitle="What makes it up"
        breakdown={{ total: value, negative: !!g.debt, items: parts.map(a => ({ id: `acc-${a.id}`, label: a.label, note: a.note, value: a.value, negative: !!g.debt, color: g.color, icon: icon(g.Icon) })) }}
        onOpenPart={open}
        moreTitle="More detail" more={(lone?.more || []).map(m => ({ id: m.key, label: m.label, value: m.value || 0, text: m.text, color: g.color, icon: icon(m.Icon) }))} onOpenMore={open}
        factsTitle="Details" facts={g.facts || []} actions={actions}/>
    );
  } else {
    page = (
      <NetWorthScreen theme={theme} format={fmt} formatAxis={fmtAxis} labels={{ ...LABELS, netWorthAria: `Net worth ${fmt(netWorth)}` }}
        netWorth={netWorth} assetsTotal={world.assetsTotal} debtsTotal={world.debtsTotal} change={change}
        chart={chartFor(world.netSeries)} views={VIEWS} view={view} onViewChange={setView}
        assets={world.assets[view].map(toRow)} debts={(view === "account" ? world.debtsAcct : world.debts).map(toRow)} onOpen={open}
        addAsset={{ label: "Add an asset", locked: plan !== "premium", lockedSaid: "Premium", onAdd: () => add("asset") }}
        addDebt={{ label: "Add a debt", locked: plan !== "premium", lockedSaid: "Premium", onAdd: () => add("debt") }}/>
    );
  }

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: CREAM }}>
      {page}
      {(sheet === "asset" || sheet === "debt") && (
        <AddItem key={sheet} kind={sheet} onClose={closeSheet} onSave={x => { setCustom(c => [...c, { ...x, id: `c${c.length}-${x.name}` }]); closeSheet(); }}/>
      )}
      {sheet === "premium" && (
        <Sheet theme={theme} title="Add your own assets and debts" onClose={closeSheet} closeSaid="Close">
          <p style={{ margin: "0 0 18px", fontSize: 13, color: MUT, lineHeight: 1.45 }}>Cars, a second home, watches, art and anything else counted in your net worth. Part of Premium.</p>
          <button type="button" onClick={closeSheet} style={primary(true)}>See Premium</button>
        </Sheet>
      )}
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 10, width: "min(370px, calc(100vw - 24px))", display: "flex", gap: 6, padding: 6, boxSizing: "border-box", background: WHITE, borderRadius: 18, boxShadow: "0 6px 16px rgba(0,0,0,0.18)", zIndex: 10 }}>
        {deep ? (
          <Segmented options={[{ key: "connected", label: "Bank connected" }, { key: "none", label: "Not connected" }]} value={bank} onChange={setBank} theme={theme} ariaLabel="Mock: bank"/>
        ) : (
          <>
            <Segmented options={[{ key: "premium", label: "Premium" }, { key: "free", label: "Free" }]} value={plan} onChange={setPlan} theme={theme} ariaLabel="Mock: plan"/>
            <Segmented options={[{ key: "history", label: "History" }, { key: "new", label: "New user" }]} value={past} onChange={setPast} theme={theme} ariaLabel="Mock: past data"/>
          </>
        )}
      </div>
    </div>
  );
}

const primary = on => ({ width: "100%", minHeight: 44, border: "none", borderRadius: 12, background: on ? G : "rgba(22,47,36,0.25)", color: CREAM, fontFamily: SANS, fontSize: 14, fontWeight: 700, cursor: on ? "pointer" : "default" });
const fieldLabel = { display: "block", fontSize: 12, fontWeight: 600, color: TEXT, margin: "14px 0 6px" };
const input = { width: "100%", boxSizing: "border-box", height: 44, padding: "0 12px", border: "1px solid #8f8d84", borderRadius: 10, background: WHITE, color: TEXT, fontFamily: SANS, fontSize: 16 };

// Money out in brackets. The latest year shows first, the rest on request.
function Transactions({ txs, connected, empty, first }) {
  const [all, setAll] = useState(false);
  if (!connected) {
    return (
      <section aria-label="Transactions" style={{ marginTop: first ? 0 : 24 }}>
        <h2 style={{ margin: "0 0 10px", padding: "0 2px", fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>Transactions</h2>
        <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, padding: "0 2px", fontSize: 13, color: MUT, lineHeight: 1.45 }}>
          <Crown size={15} strokeWidth={2} color={GOLD_TEXT} aria-label="Premium" style={{ flexShrink: 0 }}/>{empty}
        </p>
      </section>
    );
  }
  const ordered = [...txs].sort((a, b) => b.k - a.k || b.day - a.day);
  const shown = all ? ordered : ordered.filter(x => x.k > -12);
  const items = shown.map((x, i) => {
    const t = NOW_T + x.k;
    const parts = [`${x.day} ${MONTHS[t % 12]} ${Math.floor(t / 12)}`, x.source];
    if (x.interest) parts.push(`Interest ${fmt(x.interest)}, principal ${fmt(x.principal)}`);
    if (x.from) parts.push(x.from);
    return { id: `${x.k}-${i}`, label: x.desc, note: parts.join(" · "), value: 0, text: fmt(x.amount) };
  });
  return (
    <div>
      <GroupedList theme={theme} format={fmt} noBar first={first} title="Transactions" items={items}/>
      {shown.length < ordered.length && (
        <button type="button" onClick={() => setAll(true)} style={{ width: "100%", minHeight: 44, marginTop: 8, border: "none", borderRadius: 12, background: "transparent", color: TEXT, fontFamily: SANS, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Show earlier</button>
      )}
    </div>
  );
}

function AddItem({ kind, onClose, onSave }) {
  const asset = kind === "asset";
  const [type, setType] = useState("vehicle");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [liquidity, setLiquidity] = useState(TYPES.vehicle.liquidity);
  const [growth, setGrowth] = useState(String(TYPES.vehicle.growthPct));
  const [rate, setRate] = useState("");
  const [monthly, setMonthly] = useState("");
  const pick = t => { setType(t); setLiquidity(TYPES[t].liquidity); setGrowth(String(TYPES[t].growthPct)); };
  const amount = Math.round(+value.replace(/[£,\s]/g, "")) || 0;
  const ready = name.trim() && amount > 0;
  const save = () => onSave(asset
    ? { kind, type, name: name.trim(), value: amount, liquidity, growthPct: +growth || 0 }
    : { kind, name: name.trim(), value: amount, ratePct: +rate || 0, monthly: +monthly || 0 });
  return (
    <Sheet theme={theme} title={asset ? "Add an asset" : "Add a debt"} onClose={onClose} closeSaid="Close">
      {asset && (
        <div role="radiogroup" aria-label="Type" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(TYPES).map(([k, t]) => {
            const on = k === type;
            return <button key={k} type="button" role="radio" aria-checked={on} onClick={() => pick(k)}
              style={{ minHeight: 34, padding: "0 12px", borderRadius: 100, border: "none", cursor: "pointer", fontFamily: SANS, fontSize: 12, fontWeight: 600, background: on ? G : "rgba(22,47,36,0.06)", color: on ? CREAM : MUT }}>{t.label}</button>;
          })}
        </div>
      )}
      <label style={{ ...fieldLabel, marginTop: asset ? 14 : 0 }} htmlFor="nw-name">Name</label>
      <input id="nw-name" value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder={asset ? TYPES[type].hint : "e.g. Car finance"} style={input}/>
      <label style={fieldLabel} htmlFor="nw-value">{asset ? "What it's worth today (£)" : "What's owed today (£)"}</label>
      <input id="nw-value" inputMode="numeric" value={value} onChange={e => setValue(e.target.value)} style={input}/>
      {asset ? (
        <>
          <span style={fieldLabel}>How quickly could it become cash?</span>
          <Segmented options={LIQUIDITY} value={liquidity} onChange={setLiquidity} theme={theme} ariaLabel="How quickly could it become cash"/>
          <label style={fieldLabel} htmlFor="nw-growth">Change in value each year (%)</label>
          <input id="nw-growth" inputMode="text" value={growth} onChange={e => setGrowth(e.target.value)} style={input}/>
        </>
      ) : (
        <>
          <label style={fieldLabel} htmlFor="nw-rate">Interest rate (%), if any</label>
          <input id="nw-rate" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} style={input}/>
          <label style={fieldLabel} htmlFor="nw-monthly">Monthly payment (£), if any</label>
          <input id="nw-monthly" inputMode="numeric" value={monthly} onChange={e => setMonthly(e.target.value)} style={input}/>
        </>
      )}
      <button type="button" disabled={!ready} onClick={save} style={{ ...primary(!!ready), marginTop: 20 }}>Add</button>
    </Sheet>
  );
}
