import SiteLayout from "./SiteLayout.jsx";

// What Candid is and isn't: guidance, not advice, said in full. Linked from
// the foot of every module page (src/mobile/GuidanceNote.jsx), the paywall
// and the site footer. Keep it true to how the app behaves: if Candid ever
// earns from a provider, or recommends a product, this page has to change.
// Each topic is a ruled row (.st-split, shared in SiteLayout.jsx).
const HELP = [
  { label: "MoneyHelper: guidance, targeted support and advice explained", href: "https://www.moneyhelper.org.uk/en/getting-help-and-advice/financial-advisers/guidance-targeted-support-and-advice-explained" },
  { label: "Pension Wise: free pension guidance if you're 50 or over", href: "https://www.moneyhelper.org.uk/en/pensions-and-retirement/pension-wise" },
  { label: "MoneyHelper: how to choose a financial adviser", href: "https://www.moneyhelper.org.uk/en/getting-help-and-advice/financial-advisers/choosing-a-financial-adviser" },
  { label: "The FCA register, to check an adviser is authorised", href: "https://register.fca.org.uk/s/" },
];

export default function WhatCandidIsPage() {
  return (
    <SiteLayout title="What Candid is, and isn't | Candid">
      <section className="st-section st-hero">
        <div className="st-label">Guidance, not advice</div>
        <h1 className="st-h1">What Candid is, and isn't</h1>
        <p className="st-lede">Candid is guidance, not financial advice. Here is what that means in practice.</p>
      </section>

      <section className="st-section">
        <div className="st-split">
          <h2>What Candid does</h2>
          <ul>
            <li>Does the sums on the figures you give it, using UK tax rules, allowances and live savings rates.</li>
            <li>Shows your options and works out what each could be worth to you in pounds, so you can compare them.</li>
            <li>Explains the rules behind every figure, and the assumptions it uses.</li>
          </ul>
        </div>

        <div className="st-split">
          <h2>What Candid doesn't do</h2>
          <ul>
            <li>Recommend a particular product, provider or fund.</li>
            <li>Tell you to buy, sell, move or keep any investment or pension.</li>
            <li>Check whether something is suitable for you. It only knows the figures you've given it, not your whole situation, your plans or how you feel about risk.</li>
            <li>Give regulated financial advice.</li>
          </ul>
        </div>

        <div className="st-split">
          <h2>No stake in what you choose</h2>
          <p>Candid is paid for by its subscribers. It isn't paid by any bank, platform or pension provider, and it earns nothing from what you decide. It's a calculator that works out which options are worth most on your figures. It makes no judgement about which is right for you.</p>
        </div>

        <div className="st-split">
          <h2>Not authorised by the FCA</h2>
          <p>Candid Personal Finance Ltd is not authorised or regulated by the Financial Conduct Authority. Because Candid doesn't give advice, you don't get the protections that come with regulated financial advice.</p>
        </div>

        <div className="st-split">
          <h2>When to get more help</h2>
          <div>
            <p>Some decisions are worth talking through with someone, particularly about pensions, large sums, or anything you can't easily undo. These are free or help you find someone:</p>
            <ul>
              {HELP.map(h => (
                <li key={h.href}><a href={h.href} target="_blank" rel="noopener noreferrer" className="st-link">{h.label}<span className="st-sr"> (opens in a new tab)</span></a></li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
