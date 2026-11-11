import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Home, Percent, Receipt, TrendingDown } from "lucide-react";
import { G, MODULE_CHART_COLOR as C } from "../../design-tokens.js";
import { ScreenBand, ScreenSheet } from "../ScreenBand.jsx";
import { DetailScreen, GroupedList, MonthlyStack } from "../networth/NetWorthParts.jsx";
import WorthEditSheet from "../networth/WorthEditSheet.jsx";
import { editFieldsOf } from "../../lib/worthEdit.js";
import { WORTH_THEME, DETAIL_LABELS, KIND, OWED, fmtWorth, fmtWorthAxis, icon, chartProps, logoOf } from "../networth/worthUi.jsx";
import { worthAccounts, worthGroupByKey, worthTimeline, seriesOf, studentLoanSplit, mortgageSplit, homeShare } from "../../lib/netWorthView.js";

// A row of Progress's net worth on its own page
// (/app/progress/worth/<row>): its figure and line over time on the band,
// then what makes it up, More detail, its Details and the module it comes
// from. More detail opens a level further (/app/progress/worth/<row>/<page>):
// a loan's payments this tax year, worked out from its balance and rate, or
// your share of the home. Transactions wait for a bank connection.
// A page that's one account has Edit: its figures in a sheet, with Hide and
// Remove (WorthEditSheet.jsx). `onSave(patch, what)` saves the answers.

const MODULE_NAME = { cash: "Cash", investments: "Investments", pension: "Pension", studentLoan: "Student loan" };
const WRAP = { band: c => <ScreenBand tone="green">{c}</ScreenBand>, sheet: c => <ScreenSheet>{c}</ScreenSheet> };
const SPLIT_LABELS = { interest: "Interest", principal: "Principal", aria: "Payments by month this tax year" };

export default function MobileWorthDetail({ d, m, rates, rowKey, more, onOpen, onOpenRow, onBack, onOpenModule, onSave }) {
  const [range, setRange] = useState("1y");
  const [editing, setEditing] = useState(false);
  const worth = useMemo(() => worthAccounts(d, m), [d, m]);
  const timeline = useMemo(() => worthTimeline(d, m, worth, d.netWorthHistory), [d, m, worth]);
  const g = useMemo(() => worthGroupByKey(d, m, worth, rowKey, { rates }), [d, m, worth, rowKey, rates]);
  if (!g) return <Navigate to="/app/progress" replace/>;

  const lone = g.accounts.length === 1 ? g.accounts[0] : null;
  const loan = lone && (lone.id === "studentLoan" || lone.id === "mortgage") ? lone.id : null;
  const split = loan === "studentLoan" ? studentLoanSplit(d, m) : loan === "mortgage" ? mortgageSplit(d) : null;
  const share = lone?.id === "home" ? homeShare(d, worth, d.netWorthHistory) : null;
  const common = { theme: WORTH_THEME, format: fmtWorth, formatAxis: fmtWorthAxis, labels: DETAIL_LABELS, onBack, wrap: WRAP };
  const list = { theme: WORTH_THEME, format: fmtWorth };
  const color = KIND[g.kind].color;

  if (more === "payments" && split) {
    return (
      <DetailScreen {...common} title="Payments this tax year" value={fmtWorth(split.paid)}
        bandBody={<MonthlyStack theme={WORTH_THEME} format={fmtWorth} months={split.months} labels={SPLIT_LABELS} note="Worked out from your balance and rate"/>}>
        <GroupedList {...list} first title="Where it went" total={split.paid} barAria="Interest and principal, listed below" items={[
          { id: "interest", label: "Interest", value: split.interest, color: G, icon: icon(Percent) },
          { id: "principal", label: "Principal repaid", note: loan === "mortgage" ? "Adds to your share of the home" : "Takes the balance down", value: split.principal, color: C.pension, icon: icon(TrendingDown) },
        ]}/>
      </DetailScreen>
    );
  }
  if (more === "share" && share && share.mortgage > 0) {
    const ids = key => worth.assets.concat(worth.debts).find(c => c.key === key)?.accounts || [];
    const home = seriesOf(timeline, ids("home")), owed = seriesOf(timeline, ids("mortgage"));
    const change = share.principal + (share.valueChange || 0);
    return (
      <DetailScreen {...common} title="Your share of the home" value={fmtWorth(share.share)} chart={chartProps(timeline, home.map((v, i) => v - owed[i]), range, setRange)}>
        <GroupedList {...list} first noBar title="How it adds up" total={share.share} items={[
          { id: "value", label: "Home value", value: share.home },
          { id: "owed", label: "Mortgage", value: share.mortgage, negative: true },
        ]}/>
        {(share.principal > 0 || share.valueChange != null) && (
          <GroupedList {...list} noBar title="Change this tax year" total={change} items={[
            { id: "principal", label: "Principal repaid", value: share.principal },
            ...(share.valueChange != null ? [{ id: "homeValue", label: "Change in the home's value", value: share.valueChange }] : []),
          ]}/>
        )}
      </DetailScreen>
    );
  }
  if (more) return <Navigate to={`/app/progress/worth/${encodeURIComponent(rowKey)}`} replace/>;

  const parts = g.accounts.length > 1 ? [...g.accounts].sort((a, b) => b.value - a.value) : [];
  const moreItems = [
    ...(split ? [{ id: "payments", label: "Payments this tax year", value: split.paid, color, icon: icon(Receipt) }] : []),
    ...(share && share.mortgage > 0 ? [{ id: "share", label: "Your share of the home", value: share.share, color, icon: icon(Home) }] : []),
  ];
  const editable = !!(lone && onSave && editFieldsOf(d, lone));
  const actions = [
    ...(editable ? [{ label: "Edit", onClick: () => setEditing(true) }] : []),
    ...(MODULE_NAME[g.module] ? [{ label: `Open the ${MODULE_NAME[g.module]} module`, onClick: () => onOpenModule(g.module) }] : []),
  ];
  return (
    <>
    {editable && <WorthEditSheet open={editing} onClose={() => setEditing(false)} d={d} account={lone} onSave={onSave} onRemoved={onBack}/>}
    <DetailScreen {...common} title={g.label} logo={lone ? logoOf(lone) : null} value={fmtWorth(g.debt ? -g.value : g.value)}
      chart={chartProps(timeline, seriesOf(timeline, g.accounts), range, setRange, g.debt ? OWED : {})}
      breakdownTitle="What makes it up"
      breakdown={{ total: g.value, negative: g.debt, items: parts.map(a => ({
        id: `acc-${a.id}`, label: a.label, note: a.note, value: a.value, negative: g.debt, color: KIND[a.cat].color, icon: icon(KIND[a.cat].Icon), logo: logoOf(a),
      })) }}
      onOpenPart={onOpenRow}
      moreTitle="More detail" more={moreItems} onOpenMore={onOpen}
      factsTitle="Details" facts={g.facts} actions={actions}/>
    </>
  );
}
