import { G, MUT, TEXT, SERIF } from "../CandidApp.jsx";
import NewSiteLayout from "./NewSiteLayout.jsx";

// What Candid is and isn't: guidance, not advice, said in full. Linked from
// the foot of every module page (src/mobile/GuidanceNote.jsx), the paywall
// and the site footer. Keep it true to how the app behaves: if Candid ever
// earns from a provider, or recommends a product, this page has to change.
const HELP = [
  { label: "MoneyHelper: guidance, targeted support and advice explained", href: "https://www.moneyhelper.org.uk/en/getting-help-and-advice/financial-advisers/guidance-targeted-support-and-advice-explained" },
  { label: "Pension Wise: free pension guidance if you're 50 or over", href: "https://www.moneyhelper.org.uk/en/pensions-and-retirement/pension-wise" },
  { label: "MoneyHelper: how to choose a financial adviser", href: "https://www.moneyhelper.org.uk/en/getting-help-and-advice/financial-advisers/choosing-a-financial-adviser" },
  { label: "The FCA register, to check an adviser is authorised", href: "https://register.fca.org.uk/s/" },
];

export default function WhatCandidIsPage() {
  const h2 = { fontFamily: SERIF, fontSize: "21px", fontWeight: 700, color: G, margin: "36px 0 0" };
  const p = { fontSize: "15px", color: TEXT, lineHeight: 1.65, margin: "10px 0 0" };
  const li = { fontSize: "15px", color: TEXT, lineHeight: 1.65, marginTop: "6px" };
  return (
    <NewSiteLayout>
      <section style={{ maxWidth: "640px", margin: "0 auto", padding: "56px 16px 96px", boxSizing: "border-box" }}>
        <h1 style={{ fontFamily: SERIF, fontSize: "36px", fontWeight: 700, color: G, margin: 0, lineHeight: 1.15 }}>What Candid is, and isn't</h1>
        <p style={{ ...p, color: MUT }}>Candid is guidance, not financial advice. Here is what that means in practice.</p>

        <h2 style={h2}>What Candid does</h2>
        <ul style={{ paddingLeft: "20px", margin: "10px 0 0" }}>
          <li style={li}>Does the sums on the figures you give it, using UK tax rules, allowances and live savings rates.</li>
          <li style={li}>Shows your options and works out what each could be worth to you in pounds, so you can compare them.</li>
          <li style={li}>Explains the rules behind every figure, and the assumptions it uses.</li>
        </ul>

        <h2 style={h2}>What Candid doesn't do</h2>
        <ul style={{ paddingLeft: "20px", margin: "10px 0 0" }}>
          <li style={li}>Recommend a particular product, provider or fund.</li>
          <li style={li}>Tell you to buy, sell, move or keep any investment or pension.</li>
          <li style={li}>Check whether something is suitable for you. It only knows the figures you've given it, not your whole situation, your plans or how you feel about risk.</li>
          <li style={li}>Give regulated financial advice.</li>
        </ul>

        <h2 style={h2}>No stake in what you choose</h2>
        <p style={p}>Candid is paid for by its subscribers. It isn't paid by any bank, platform or pension provider, and it earns nothing from what you decide. It's a calculator that works out which options are worth most on your figures. It makes no judgement about which is right for you.</p>

        <h2 style={h2}>Not authorised by the FCA</h2>
        <p style={p}>Candid Personal Finance Ltd is not authorised or regulated by the Financial Conduct Authority. Because Candid doesn't give advice, you don't get the protections that come with regulated financial advice.</p>

        <h2 style={h2}>When to get more help</h2>
        <p style={p}>Some decisions are worth talking through with someone, particularly about pensions, large sums, or anything you can't easily undo. These are free or help you find someone:</p>
        <ul style={{ paddingLeft: "20px", margin: "10px 0 0" }}>
          {HELP.map(h => (
            <li key={h.href} style={li}><a href={h.href} target="_blank" rel="noopener noreferrer" style={{ color: G, fontWeight: 600 }}>{h.label}</a></li>
          ))}
        </ul>
      </section>
    </NewSiteLayout>
  );
}
