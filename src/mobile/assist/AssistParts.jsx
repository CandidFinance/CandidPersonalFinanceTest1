import { ChevronLeft, ChevronRight, ArrowUpRight, Check } from "lucide-react";
import { G, WHITE, MUT, TEXT, SERIF, SANS } from "../../design-tokens.js";
import { fmt } from "../../lib/format.js";
import { accountName, resolveAccount, MIN_SPLIT_GAIN } from "../../lib/assist.js";
import { devicePlatform, appLinkFor } from "../../lib/appLinks.js";
import { FSCS_DEPOSIT_LIMIT } from "../../lib/cashAllocation.js";

// Parts of Candid Assist's panel (CandidAssist): option lists, provider
// links, the account walk-through and the Elsewhere list, with the formats
// and styles they share with the panel.

export const pct = n => `${(+n).toFixed(2)}%`;
// How much of a move comes from Premium Bonds the user already holds.
export const bondsIn = o => (o.from || []).filter(f => f.taxFree).reduce((t, f) => t + f.amount, 0);
const fmtDate = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const fromName = f => f.taxFree ? `your Premium Bonds (${pct(f.ratePct)} prize fund rate)` : f.name ? `${f.name} (${pct(f.ratePct)})` : f.index == null ? `your savings (${pct(f.ratePct)} on average)` : `your account paying ${pct(f.ratePct)}`;
export const ratesDate = opts => {
  const dates = opts.map(o => o.updatedAt).filter(Boolean).map(s => new Date(s));
  return dates.length ? new Date(Math.min(...dates)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
};

export const sectionLabel = { fontSize: "10.5px", fontWeight: 700, color: MUT, letterSpacing: "0.08em", textTransform: "uppercase" };
export const primaryButton = disabled => ({ width: "100%", padding: "14px", borderRadius: "100px", border: "none", background: disabled ? "rgba(22,47,36,0.2)" : G, color: WHITE, fontSize: "15px", fontWeight: 700, fontFamily: SANS, cursor: disabled ? "default" : "pointer" });
export const textButton = { background: "none", border: "none", padding: "10px", color: G, fontSize: "14px", fontWeight: 700, fontFamily: SANS, cursor: "pointer" };
export const card = { background: WHITE, border: "1px solid rgba(22,47,36,0.12)", borderRadius: "14px" };

export function Mark({ on, round = false }) {
  return (
    <span style={{ width: "20px", height: "20px", borderRadius: round ? "50%" : "6px", flexShrink: 0, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
      border: on ? "none" : "1.5px solid rgba(22,47,36,0.3)", background: on ? G : WHITE, color: WHITE }}>
      {on && <Check size={13} strokeWidth={3}/>}
    </span>
  );
}

// One section's providers: tap to pick, tap again to unpick. `absolute`:
// show what each would earn in a year, for when there's no current rate to
// compare against.
export function OptionList({ options, picked, onPick, absolute = false }) {
  return options.map(o => {
    const on = picked?.id === o.id;
    return (
      <button key={o.id} type="button" onClick={() => onPick(on ? null : o.id)} aria-pressed={on}
        style={{ ...card, display: "flex", alignItems: "flex-start", gap: "12px", width: "100%", textAlign: "left", padding: "13px 14px", marginBottom: "8px", cursor: "pointer", fontFamily: SANS,
          borderColor: on ? G : "rgba(22,47,36,0.12)", boxShadow: on ? `0 0 0 1px ${G}` : "none" }}>
        <span style={{ marginTop: "1px" }}><Mark on={on} round/></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: "14.5px", fontWeight: 700, color: TEXT }}>{accountName(o)}</span>
          <span style={{ display: "block", fontSize: "12.5px", color: MUT, marginTop: "2px", lineHeight: 1.45 }}>
            {o.pb
              ? `${pct(o.ratePct)} prize fund rate (an average) · would take ${fmt(o.amount)}`
              : `${pct(o.ratePct)} · would take ${fmt(o.amount)}${o.cap != null ? ` (pays this on up to ${fmt(o.cap)})` : ""}`}{bondsIn(o) ? ` · ${fmt(bondsIn(o))} of it from your Premium Bonds` : ""}{o.appOnly ? " · app only" : ""}
          </span>
        </span>
        <span style={{ fontFamily: SERIF, fontSize: "15px", fontWeight: 700, color: G, whiteSpace: "nowrap" }}>{absolute ? `${fmt(o.gain)}/yr` : `+${fmt(o.gain)}`}</span>
      </button>
    );
  });
}

// Where to go to open the account. On a phone with the provider's app
// available (confirmed links only), an app-only account leads with the app
// and the website comes second; otherwise the website leads, with the app
// as the alternative. On a laptop, the store links sit underneath.
const platform = () => (typeof navigator !== "undefined" ? devicePlatform(navigator.userAgent) : "desktop");
export const openStep = o => o.pb
  ? "Buy Premium Bonds on NS&I's website or app."
  : o.appOnly
  ? `Download the ${o.provider} app and open the account there: it can only be opened in the app.`
  : `Open the account on ${o.provider}'s website or app.`;

export function ProviderLinks({ o }) {
  const device = platform();
  const app = appLinkFor(device, o);
  const store = device === "ios" ? "App Store" : "Google Play";
  const site = o.url;
  const appFirst = app && (o.appOnly || !site);
  const link = { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13.5px", fontWeight: 700, color: G, textDecoration: "none" };
  const small = { color: G, fontWeight: 600, textDecoration: "none" };
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "3px" }}>
      {appFirst
        ? <a href={app} target="_blank" rel="noopener noreferrer" style={link}>Get the {o.provider} app<ArrowUpRight size={14}/></a>
        : site && <a href={site} target="_blank" rel="noopener noreferrer" style={link}>Open {o.provider}<ArrowUpRight size={14}/></a>}
      <span style={{ fontSize: "12px", color: MUT }}>
        {appFirst && site && <a href={site} target="_blank" rel="noopener noreferrer" style={small}>or their website</a>}
        {!appFirst && app && <a href={app} target="_blank" rel="noopener noreferrer" style={small}>or get the app ({store})</a>}
        {device === "desktop" && (o.iosAppUrl || o.androidAppUrl) && (
          <>
            The app:{" "}
            {o.iosAppUrl && <a href={o.iosAppUrl} target="_blank" rel="noopener noreferrer" style={small}>App Store</a>}
            {o.iosAppUrl && o.androidAppUrl && " · "}
            {o.androidAppUrl && <a href={o.androidAppUrl} target="_blank" rel="noopener noreferrer" style={small}>Google Play</a>}
          </>
        )}
      </span>
    </span>
  );
}

// After a capped pick, the rest of the money: an optional second account,
// and how the two together compare with one account that could take it all.
export function SecondChoice({ section, onPick }) {
  if (!section.pick || !section.secondOptions.length) return null;
  const { pick, split } = section;
  return (
    <div style={{ margin: "2px 0 12px 10px", paddingLeft: "12px", borderLeft: "2px solid rgba(22,47,36,0.12)" }}>
      <div style={{ fontSize: "13.5px", fontWeight: 700, color: TEXT }}>The other {fmt(section.leftover)}</div>
      <p style={{ fontSize: "12.5px", color: MUT, margin: "2px 0 8px", lineHeight: 1.5 }}>
        {pick.fscsLimited
          ? `FSCS protects up to ${fmt(FSCS_DEPOSIT_LIMIT)} with each bank, so ${fmt(pick.amount)} goes into ${accountName(pick)}.`
          : `${accountName(pick)} pays ${pct(pick.ratePct)} on up to ${fmt(pick.cap)}.`} If you like, the rest can go into a second account.
      </p>
      <OptionList options={section.secondOptions} picked={section.second} onPick={onPick}/>
      {split && (
        <p style={{ fontSize: "12.5px", color: TEXT, lineHeight: 1.5, margin: "2px 0 0" }}>
          Together: +{fmt(split.together)} a year.{" "}
          {split.extra > 0 ? `That's ${fmt(split.extra)} a year more than all of it in ${accountName(split.single)}.` : `That's no more than all of it in ${accountName(split.single)}.`}
          {split.extra < MIN_SPLIT_GAIN ? " Under £25 a year for running a second account." : ""}
        </p>
      )}
    </div>
  );
}

// An account opened through Assist whose rate is ending or has been cut:
// what's happening, where the money could go instead (a choice, none picked
// in advance), how to move it, or keeping it where it is. Either way Candid's
// figures follow.
export function AccountFlow({ item, state, update, d, set, backToList }) {
  const a = item.account;
  const pick = item.options.find(o => o.id === state.accountChoice) || null;
  const absolute = item.toRate == null;
  const settle = movedTo => {
    Object.entries(resolveAccount(d, item, movedTo)).forEach(([k, v]) => set(k, v));
    update({ step: "finished", itemId: null, accountChoice: null, done: {} });
  };

  if (state.step === "how" && pick) {
    return (
      <div>
        <button type="button" style={{ ...textButton, padding: "0 0 10px", display: "inline-flex", alignItems: "center", gap: "2px" }} onClick={() => update({ step: "overview" })}><ChevronLeft size={16}/>Back</button>
        <div style={{ fontFamily: SERIF, fontSize: "24px", fontWeight: 700, color: G, lineHeight: 1.25 }}>{a.isa ? "Transferring your ISA" : "Moving your savings"}</div>
        <div style={{ ...card, padding: "14px 16px", marginTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: TEXT }}>{accountName(pick)}</span>
            <span style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 700, color: G, whiteSpace: "nowrap" }}>{fmt(pick.amount)}</span>
          </div>
          <div style={{ fontSize: "12.5px", color: MUT, marginTop: "2px" }}>{a.isa ? "Cash ISA" : "Savings account"} at {pct(pick.ratePct)}</div>
          <ul style={{ margin: "12px 0 12px", paddingLeft: "18px", fontSize: "13.5px", color: TEXT, lineHeight: 1.6 }}>
            {a.isa ? (
              <>
                <li>Open a Cash ISA with {pick.provider}.</li>
                <li>Ask {pick.provider} to transfer your ISA from {a.name}. They arrange it with {a.provider}.</li>
                <li>Don't withdraw it yourself: it would lose its tax-free status. A transfer doesn't use this year's allowance.</li>
              </>
            ) : (
              <>
                <li>{openStep(pick)}</li>
                <li>Move {fmt(pick.amount)} from your {a.name} into it.</li>
              </>
            )}
            {pick.cap != null && <li>Only the first {fmt(pick.cap)} earns {pct(pick.ratePct)}.</li>}
            {pick.fscsLimited && <li>FSCS protects up to {fmt(FSCS_DEPOSIT_LIMIT)} with each bank, counting anything you already hold there.</li>}
          </ul>
          <ProviderLinks o={pick}/>
        </div>
        <div style={{ marginTop: "18px" }}><button type="button" style={primaryButton(false)} onClick={() => settle(pick)}>I've moved it: update Candid</button></div>
      </div>
    );
  }

  const ended = item.daysLeft != null && item.daysLeft <= 0;
  return (
    <div>
      {backToList}
      <div style={sectionLabel}>{item.kind === "bonus" ? (ended ? "Rate ended" : "Rate ending") : "Rate cut"}</div>
      <div style={{ fontFamily: SERIF, fontSize: "30px", fontWeight: 700, color: G, lineHeight: 1.15, marginTop: "4px" }}>
        {item.loss != null ? `${fmt(item.loss)} a year less` : `${ended ? "Ended" : "Ends"} ${fmtDate(item.date)}`}
      </div>
      <p style={{ fontSize: "14px", color: TEXT, lineHeight: 1.6, marginTop: "8px" }}>
        {item.kind === "bonus"
          ? <>The {pct(item.fromRate)} rate on your {fmt(a.amount)} in {a.name} {ended ? "ended" : "ends"} on {fmtDate(item.date)}{!ended && item.daysLeft != null ? `, in ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"}` : ""}. {item.toRate != null ? `It then drops to ${pct(item.toRate)}.` : `${a.provider}'s page doesn't say what it drops to, so it's worth checking with them.`}</>
          : <>{a.provider} has cut the rate on your {a.name} from {pct(item.fromRate)} to {pct(item.toRate)}, on your {fmt(a.amount)}.</>}
      </p>
      <div style={{ fontSize: "16px", fontWeight: 700, color: TEXT, marginTop: "20px" }}>{a.isa ? "Cash ISAs you could transfer to" : "Savings accounts you could move to"}</div>
      <p style={{ fontSize: "12.5px", color: MUT, margin: "4px 0 10px", lineHeight: 1.5 }}>
        {absolute ? "What each would earn in a year." : `The extra a year compared with staying at ${pct(item.toRate)}.`}
      </p>
      {item.options.length
        ? <OptionList options={item.options} picked={pick} onPick={id => update({ accountChoice: id })} absolute={absolute}/>
        : <p style={{ fontSize: "12.5px", color: MUT }}>None of the easy-access accounts Candid tracks pays more right now.</p>}
      <p style={{ fontSize: "11.5px", color: MUT, lineHeight: 1.55, margin: "10px 0 18px" }}>
        These are figures, not a recommendation: whether to move, and where, is your choice. Sorted by rate. Check each account's terms.
      </p>
      <button type="button" disabled={!pick} style={primaryButton(!pick)} onClick={() => update({ step: "how" })}>Show me how</button>
      <div style={{ textAlign: "center", marginTop: "6px" }}>
        <button type="button" style={textButton} onClick={() => settle(null)}>Keep it where it is</button>
        {absolute && !a.isa && <p style={{ fontSize: "11.5px", color: MUT, margin: 0 }}>Candid will keep it at {pct(a.ratePct)} until you update it in Cash & savings.</p>}
      </div>
    </div>
  );
}

// An item's one-line title and the detail beneath it, for lists.
export const itemTitle = i => i.id === "cash" ? "Your cash is losing out to low rates" : i.kind === "bonus" ? `${i.account.name}: its rate is ending` : `${i.account.name}: rate cut`;
export const itemDetail = i => i.id === "cash" ? `Up to ${fmt(i.gain)} a year more`
  : i.kind === "bonus" ? `${pct(i.fromRate)} ends on ${fmtDate(i.date)}${i.toRate != null ? `, then ${pct(i.toRate)}` : ""}`
  : `${pct(i.fromRate)} is now ${pct(i.toRate)}`;

// Items for other pages, each taking the user there with it open in Assist.
export function Elsewhere({ items, labels, onGo }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: "22px", paddingTop: "16px", borderTop: "1px solid rgba(22,47,36,0.08)" }}>
      <div style={sectionLabel}>Elsewhere</div>
      {items.map(i => (
        <button key={i.id} type="button" onClick={() => onGo(i)}
          style={{ ...card, display: "flex", alignItems: "center", gap: "12px", width: "100%", textAlign: "left", padding: "12px 14px", marginTop: "8px", cursor: "pointer", fontFamily: SANS }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: "11px", fontWeight: 700, color: MUT, letterSpacing: "0.04em" }}>{labels[i.module] || i.module}</span>
            <span style={{ display: "block", fontSize: "14px", fontWeight: 700, color: TEXT, marginTop: "1px" }}>{itemTitle(i)}</span>
            <span style={{ display: "block", fontSize: "12.5px", color: MUT, marginTop: "1px" }}>{itemDetail(i)}</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: "13px", fontWeight: 700, color: G, whiteSpace: "nowrap" }}>Go there<ChevronRight size={15}/></span>
        </button>
      ))}
    </div>
  );
}
