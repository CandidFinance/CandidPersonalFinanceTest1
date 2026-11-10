// Dev only (/dev/ui-kit): every component in src/mobile/ui on one phone-width
// page, in each variant and state, so each can be checked before it goes
// into a screen.
import { useRef, useState } from "react";
import { ArrowRight, MoreHorizontal, Plus, X } from "lucide-react";
import { CARD, CREAM, G, MUT, SANS, SERIF, WHITE, SUCCESS, WARNING_TEXT, CRITICAL, GOLD_TEXT } from "../../design-tokens.js";
import {
  Button, IconButton, Switch, SwitchRow, Segmented, Chip, Tag, Select, TextField, Sheet, SheetHeader,
  AnimatedCounter, fireConfetti, DeleteButton, ProgressiveBlur, ShineBorder, TaskList, PillMoneyInput,
} from "./index.js";

const h = { fontSize: "13px", fontWeight: 600, color: G, margin: "0 0 10px" };
const note = { fontSize: "11px", color: MUT, margin: "0 0 8px" };
const row = { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" };
const group = { background: WHITE, borderRadius: "16px", overflow: "hidden" };

export default function UiKitDemo() {
  const [amount, setAmount] = useState(12450);
  const [removed, setRemoved] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sw, setSw] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [rowOn, setRowOn] = useState(true);
  const [year, setYear] = useState("2026");
  const [scheme, setScheme] = useState("ras");
  const [chips, setChips] = useState({ bonus: true, partner: false });
  const [pick, setPick] = useState("");
  const [pick2, setPick2] = useState("fixed");
  const [email, setEmail] = useState("");
  const [money, setMoney] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [page, setPage] = useState(null);
  const confettiBtn = useRef(null);

  const save = () => { setSaving(true); setTimeout(() => setSaving(false), 1500); };
  const emailError = email && !/^\S+@\S+\.\S+$/.test(email) ? "That doesn't look like an email address." : undefined;

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: SANS, color: G }}>
      <div style={{ maxWidth: "430px", margin: "0 auto", padding: "24px 16px 80px", display: "flex", flexDirection: "column", gap: "32px" }}>
        <p style={{ margin: 0, fontSize: "12px", color: MUT }}>UI kit, dev only. Components in src/mobile/ui.</p>

        <section>
          <h2 style={h}>Button</h2>
          <p style={note}>One height, 37px</p>
          <div style={row}>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="blue">Subscribe</Button>
          </div>
          <div style={{ ...row, marginTop: "8px" }}>
            <Button variant="text">Not now</Button>
            <Button variant="text" icon={Plus}>Add goal</Button>
          </div>
          <p style={{ ...note, marginTop: "14px" }}>Full width, icon, loading, disabled</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Button fullWidth icon={ArrowRight} loading={saving} loadingLabel="Saving…" onClick={save}>Save my answers</Button>
            <Button fullWidth variant="secondary" disabled>Disabled</Button>
          </div>
        </section>

        <section>
          <h2 style={h}>Icon button</h2>
          <div style={row}>
            <IconButton icon={X} label="Close" />
            <IconButton icon={X} label="Close" variant="tint" color="#0071E3" />
            <IconButton icon={MoreHorizontal} label="More" size={28} variant="plain" />
            <IconButton icon={X} label="Close" size={28} />
          </div>
        </section>

        <section>
          <h2 style={h}>Switch</h2>
          <div style={row}>
            <Switch checked={sw} onChange={setSw} label="Salary sacrifice" showLabel />
            <Switch checked={sw2} onChange={setSw2} label="Include bonus" />
            <Switch checked label="Locked" disabled />
          </div>
          <div style={{ ...group, marginTop: "12px" }}>
            <SwitchRow label="Weekly email" sub="A short note on Sundays when your figures change." checked={rowOn} onChange={setRowOn} />
          </div>
        </section>

        <section>
          <h2 style={h}>Segmented</h2>
          <Segmented ariaLabel="Tax year" value={year} onChange={setYear}
            options={[{ value: "2026", label: "2026/27" }, { value: "2027", label: "2027/28" }, { value: "2028", label: "2028/29" }]} />
          <div style={{ marginTop: "10px" }}>
            <Segmented size="compact" fullWidth={false} ariaLabel="Pension scheme" value={scheme} onChange={setScheme}
              options={[{ value: "ras", label: "Relief at source" }, { value: "ss", label: "Salary sacrifice" }]} />
          </div>
          <div style={{ marginTop: "10px", background: G, padding: "12px", borderRadius: "14px" }}>
            <Segmented onDark ariaLabel="View" value={year} onChange={setYear}
              options={[{ value: "2026", label: "Now" }, { value: "2027", label: "In 5 years" }, { value: "2028", label: "At 67" }]} />
          </div>
        </section>

        <section>
          <h2 style={h}>Chip and tag</h2>
          <div style={row}>
            <Chip pressed={chips.bonus} onClick={() => setChips((c) => ({ ...c, bonus: !c.bonus }))}>Include bonus</Chip>
            <Chip pressed={chips.partner} onClick={() => setChips((c) => ({ ...c, partner: !c.partner }))}>With partner</Chip>
            <Chip icon={Plus}>Add account</Chip>
          </div>
          <div style={{ ...row, marginTop: "12px" }}>
            <Tag color={SUCCESS}>On track</Tag>
            <Tag color={WARNING_TEXT}>Review</Tag>
            <Tag color={CRITICAL}>Action needed</Tag>
            <Tag color={GOLD_TEXT}>Estimate</Tag>
          </div>
        </section>

        <section>
          <h2 style={h}>Fields</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <PillMoneyInput label="Balance" value={money} onChange={setMoney} />
            <Select label="Rate type" value={pick2} onChange={setPick2} options={[{ value: "fixed", label: "Fixed" }, { value: "tracker", label: "Tracker" }, { value: "svr", label: "Standard variable" }]} />
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <Select value={pick} onChange={setPick} placeholder="Choose a provider" state="empty" options={[{ value: "a", label: "Nationwide" }, { value: "b", label: "Monzo" }]} />
            <Select size="compact" value={pick2} onChange={setPick2} placeholder="Rate type" state="estimate" options={[{ value: "fixed", label: "Fixed" }, { value: "tracker", label: "Tracker" }]} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
            <TextField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} error={emailError} hint="We send a code, no password." />
            <TextField label="Name" size="compact" value="Disabled field" disabled />
          </div>
        </section>

        <section>
          <h2 style={h}>Sheet</h2>
          <Button variant="secondary" onClick={() => setSheet(true)}>Open a sheet</Button>
          <Sheet open={sheet} onClose={() => { setSheet(false); setPage(null); }} onEscape={page ? () => setPage(null) : undefined} labelledBy="kit-sheet-title">
            <SheetHeader id="kit-sheet-title" title={page ? "Notifications" : "Account"} onBack={page ? () => setPage(null) : undefined} onClose={() => { setSheet(false); setPage(null); }} />
            {page ? (
              <div style={{ ...group, marginTop: "18px" }}>
                <SwitchRow label="Weekly email" checked={rowOn} onChange={setRowOn} />
              </div>
            ) : (
              <>
                <p style={{ margin: "16px 0 0", fontSize: "12px", lineHeight: 1.55 }}>Pull the handle down, tap outside, or press Escape to close.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "18px" }}>
                  <Button size="compact" fullWidth onClick={() => setPage("n")}>Open an inner page</Button>
                  <Button size="compact" fullWidth variant="secondary" onClick={() => setSheet(false)}>Close</Button>
                </div>
                {Array.from({ length: 6 }, (_, i) => <p key={i} style={{ fontSize: "12px", color: MUT, margin: "14px 0 0" }}>Content line {i + 1}, to show the sheet scrolling on a short screen.</p>)}
              </>
            )}
          </Sheet>
        </section>

        <hr style={{ border: "none", borderTop: "1px solid rgba(22,47,36,0.1)", margin: 0 }} />

        <section>
          <h2 style={h}>Animated counter</h2>
          <div style={{ fontFamily: SERIF, fontSize: "36px", fontWeight: 600, lineHeight: 1 }}>
            <AnimatedCounter value={amount} prefix="£" />
          </div>
          <div style={{ fontFamily: SANS, fontSize: "28px", fontWeight: 700, lineHeight: 1, marginTop: "10px" }}>
            <AnimatedCounter value={amount} prefix="£" />
          </div>
          <div style={{ ...row, marginTop: "14px" }}>
            <Button size="compact" onClick={() => setAmount((a) => a + 1375)}>Add £1,375</Button>
            <Button size="compact" variant="secondary" onClick={() => setAmount((a) => Math.max(0, a - 2890))}>Take £2,890</Button>
            <Button size="compact" variant="secondary" onClick={() => setAmount(Math.round(Math.random() * 250000))}>Random</Button>
          </div>
        </section>

        <section>
          <h2 style={h}>Confetti</h2>
          <Button ref={confettiBtn} size="compact" onClick={() => fireConfetti(confettiBtn.current)}>Celebrate</Button>
        </section>

        <section>
          <h2 style={h}>Shine border</h2>
          <div style={{ ...CARD, position: "relative", padding: "18px" }}>
            <ShineBorder />
            <p style={{ margin: 0, fontSize: "12px", color: MUT }}>Largest opportunity</p>
            <p style={{ margin: "4px 0 0", fontFamily: SERIF, fontSize: "28px", fontWeight: 600 }}>£3,420</p>
          </div>
        </section>

        <section>
          <h2 style={h}>Task list</h2>
          <TaskList defaultTasks={[
            { id: "a", label: "Tax code checked" },
            { id: "b", label: "Easy-access rates compared" },
            { id: "c", label: "Old workplace pensions found" },
          ]} />
        </section>

        <section>
          <h2 style={h}>Delete button</h2>
          {["Monzo current account", "Holiday fund goal"].filter((n) => !removed.includes(n)).map((name) => (
            <div key={name} style={{ ...CARD, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 8px 8px 16px", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px" }}>{name}</span>
              <DeleteButton label={`Remove ${name}`} onConfirm={() => setTimeout(() => setRemoved((r) => [...r, name]), 900)} />
            </div>
          ))}
          {removed.length > 0 && <Button size="compact" variant="secondary" onClick={() => setRemoved([])}>Bring back</Button>}
        </section>

        <section>
          <h2 style={h}>Progressive blur</h2>
          <div style={{ position: "relative", height: "220px", borderRadius: "14px", overflow: "hidden", background: WHITE }}>
            <div style={{ height: "100%", overflowY: "auto", padding: "12px 16px" }}>
              {Array.from({ length: 18 }, (_, i) => (
                <p key={i} style={{ margin: "0 0 10px", fontSize: "13px" }}>Row {i + 1}: scroll to see it fade under the edge</p>
              ))}
            </div>
            <ProgressiveBlur position="bottom" height="72px" />
          </div>
        </section>
      </div>
    </div>
  );
}
