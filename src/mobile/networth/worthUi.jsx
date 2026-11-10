import { Banknote, GraduationCap, Home, Landmark, Lock, CreditCard, PiggyBank, TrendingUp, Unlock } from "lucide-react";
import { G, CREAM, WHITE, TEXT, MUT, SANS, SERIF, GAIN_ON_DARK, GOLD_TEXT, ERROR_TEXT, MODULE_CHART_COLOR as C } from "../../design-tokens.js";
import { CREAM_SOFT, CREAM_FAINT } from "../ScreenBand.jsx";
import { HIDE_MVP_MODULES, HIDDEN_MVP_MODULE_KEYS } from "../../lib/moduleStatus.js";

// What Progress's net worth and its row pages (MobileWorthDetail.jsx) share:
// the colours handed to NetWorthParts.jsx, £ with money owed in brackets
// (these screens only, for now: Harvey, 10 Nov 2026), each row's colour and
// icon, and the words.

export const WORTH_THEME = {
  page: CREAM, surface: WHITE, text: TEXT, muted: MUT, hairline: "rgba(22,47,36,0.09)", track: "rgba(22,47,36,0.06)",
  fontBody: SANS, fontFigure: SERIF, shadow: "0 2px 10px rgba(22,47,36,0.07)",
  accent: GAIN_ON_DARK, band: G, bandText: CREAM, bandMuted: "rgba(250,247,240,0.68)", bandHairline: "rgba(250,247,240,0.16)", bandTrack: "rgba(250,247,240,0.12)",
  asset: GAIN_ON_DARK, debt: "#f0806f",
  // Cream, not red: red and green stacked fail the colour-blindness check.
  interest: "#e8e1cf",
  premium: GOLD_TEXT, dangerText: ERROR_TEXT, scrim: "rgba(10,20,15,0.5)",
};

// The band's colours for Progress's caption (BAND_T in
// ProgressTrackerDashboard.jsx): cream on the dark green.
export const WORTH_BAND_T = { figure: CREAM, label: CREAM_SOFT, body: CREAM_SOFT, track: "rgba(250,247,240,0.12)", dot: CREAM_FAINT };

const brackets = (v, text) => (v < 0 ? `(${text})` : text);
export const fmtWorth = v => brackets(v, `£${Math.abs(Math.round(v)).toLocaleString("en-GB")}`);
export const fmtWorthAxis = v => {
  const a = Math.abs(v);
  // A decimal under £100k, where a narrow range would repeat whole thousands.
  return brackets(v, a >= 999500 ? `£${(a / 1e6).toFixed(1)}m` : a >= 100000 ? `£${Math.round(a / 1000)}k` : `£${(a / 1000).toFixed(1)}k`);
};
// A debt's line and axis read as owed.
export const OWED = { format: v => fmtWorth(-Math.abs(v)), formatAxis: v => fmtWorthAxis(-Math.abs(v)), lineColor: WORTH_THEME.debt };

// Each row's colour and icon, by what it is (netWorthView.js `kind`).
export const KIND = {
  cash: { color: C.cash, Icon: Banknote },
  home: { color: G, Icon: Home },
  investments: { color: C.investments, Icon: TrendingUp },
  pension: { color: C.pension, Icon: PiggyBank },
  now: { color: C.cash, Icon: Unlock },
  lisa: { color: C.investments, Icon: Lock },
  mortgage: { color: C.mortgage, Icon: Landmark },
  studentLoan: { color: C.studentLoan, Icon: GraduationCap },
  personalLoan: { color: C.personalLoan, Icon: CreditCard },
};
export const icon = I => <I size={16} strokeWidth={2} aria-hidden="true"/>;

// A grouping's row for GroupedList.
// An account's provider's logo (public/logos), where its provider is known
// and has one.
export const logoOf = a => (a?.provider?.domain ? `/logos/${a.provider.domain}.png` : null);

// A grouping's row for GroupedList. A row that's one account shows its
// provider's logo in place of the category's icon.
export const toRow = g => ({
  id: g.key, label: g.label, value: g.value, negative: !!g.debt, color: KIND[g.kind].color, icon: icon(KIND[g.kind].Icon),
  logo: g.key.startsWith("acc-") ? logoOf(g.accounts[0]) : null,
  count: g.accounts.length, countSaid: `${g.accounts.length} accounts`,
});

// While the mortgage module is hidden (moduleStatus.js), Home and Mortgage
// show as rows still to come, at the foot of Assets and Debts, not opening
// and not counted. An outright owner's home, already counted, shows as
// itself.
export function comingSoonRows(worth) {
  if (!HIDE_MVP_MODULES || !HIDDEN_MVP_MODULE_KEYS.includes("mortgage")) return { assets: [], debts: [] };
  const soon = (id, label, kind) => ({ id, label, value: 0, text: "Coming soon", openable: false, dim: true, icon: icon(KIND[kind].Icon), color: KIND[kind].color });
  const hasHome = worth.assets.some(c => c.key === "home" && c.value > 0);
  return {
    assets: hasHome ? [] : [soon("soon-home", "Home", "home")],
    debts: [soon("soon-mortgage", "Mortgage", "mortgage")],
  };
}

export const WORTH_LABELS = {
  assets: "Assets", debts: "Debts", netWorthAria: "Net worth", chartAria: "Value over time. Scroll sideways to move through time.", rangeAria: "How much time to show", now: "Now",
  // Not a growth rate: each kind of asset grows at its own (Harvey, 10 Nov 2026).
  projectedNote: "Dashed line is a projection",
  soon: "Coming soon",
  assetsTitle: "Assets", debtsTitle: "Debts", assetsBarAria: "Assets by size, listed below", debtsBarAria: "Debts by size, listed below", viewAria: "Group by", backSaid: "Back",
};
export const DETAIL_LABELS = WORTH_LABELS;
export const VIEWS = [{ key: "type", label: "Category" }, { key: "account", label: "Account" }, { key: "access", label: "Access" }];
export const WINDOWS = [{ key: "1y", label: "1Y", months: 12 }, { key: "5y", label: "5Y", months: 60 }, { key: "all", label: "All time", months: Infinity }];

export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// TrendChart's props for a line over the timeline (netWorthView.js).
export const chartProps = (timeline, values, range, onRange, extra = {}) => ({
  windows: WINDOWS, range, onRangeChange: onRange, nowIndex: timeline.nowIndex, reduceMotion: reducedMotion(),
  points: timeline.points.map((p, i) => ({ ...p, value: values[i] })), ...extra,
});

// The change line under the headline, once there's a year behind Now.
export const changeSaid = diff => (diff == null ? undefined : { tone: diff > 0 ? "up" : diff < 0 ? "down" : "flat", text: `${diff > 0 ? "+" : ""}${fmtWorth(diff)} in the last 12 months` });
