// UK banks, building societies and platforms: each one's name, its domain
// (the file name of its logo in public/logos, where there is one) and the
// words that find it in an account's name ("Barclays Everyday Saver"). Until
// Open Banking says which provider an account is with, its name is the only
// clue. Pure, unit tested in netWorthView.test.js.

export const PROVIDERS = [
  { name: "Barclays", domain: "barclays.co.uk", match: /\bbarclays\b/i },
  { name: "HSBC", domain: "hsbc.co.uk", match: /\bhsbc\b/i },
  { name: "first direct", domain: "firstdirect.com", match: /\bfirst ?direct\b/i },
  { name: "Lloyds", domain: "lloydsbank.com", match: /\blloyds\b/i },
  { name: "Halifax", domain: "halifax.co.uk", match: /\bhalifax\b/i },
  { name: "NatWest", domain: "natwest.com", match: /\bnat ?west\b/i },
  { name: "RBS", domain: "rbs.co.uk", match: /\b(rbs|royal bank of scotland)\b/i },
  { name: "Nationwide", domain: "nationwide.co.uk", match: /\bnationwide\b/i },
  { name: "Santander", domain: null, match: /\bsantander\b/i },
  { name: "TSB", domain: "tsb.co.uk", match: /\btsb\b/i },
  { name: "Virgin Money", domain: "virginmoney.com", match: /\bvirgin\b/i },
  { name: "Monzo", domain: "monzo.com", match: /\bmonzo\b/i },
  { name: "Starling", domain: "starlingbank.com", match: /\bstarling\b/i },
  { name: "Revolut", domain: "revolut.com", match: /\brevolut\b/i },
  { name: "Chase", domain: "chase.co.uk", match: /\bchase\b/i },
  { name: "Kroo", domain: "kroo.com", match: /\bkroo\b/i },
  { name: "Zopa", domain: "zopa.com", match: /\bzopa\b/i },
  { name: "Marcus", domain: null, match: /\bmarcus\b/i },
  { name: "Metro Bank", domain: null, match: /\bmetro ?bank\b/i },
  { name: "Yorkshire Building Society", domain: "ybs.co.uk", match: /\b(ybs|yorkshire)\b/i },
  { name: "Skipton", domain: "skipton.co.uk", match: /\bskipton\b/i },
  { name: "Coventry Building Society", domain: null, match: /\bcoventry\b/i },
  { name: "Leek Building Society", domain: "leekbs.co.uk", match: /\bleek\b/i },
  { name: "Bank of Ireland", domain: "bankofirelanduk.com", match: /\bbank of ireland\b/i },
  { name: "Cahoot", domain: "cahoot.com", match: /\bcahoot\b/i },
  { name: "Charter Savings Bank", domain: "chartersavingsbank.co.uk", match: /\bcharter\b/i },
  { name: "Close Brothers", domain: "closesavings.co.uk", match: /\bclose brothers\b/i },
  { name: "Cynergy Bank", domain: "cynergybank.co.uk", match: /\bcynergy\b/i },
  { name: "Habib Bank", domain: "habibbank.com", match: /\bhabib\b/i },
  { name: "Investec", domain: "investec.com", match: /\binvestec\b/i },
  { name: "Oxbury", domain: "oxbury.com", match: /\boxbury\b/i },
  { name: "Post Office", domain: "postoffice.co.uk", match: /\bpost office\b/i },
  { name: "Saga", domain: "saga.co.uk", match: /\bsaga\b/i },
  { name: "Tandem", domain: "tandem.co.uk", match: /\btandem\b/i },
  { name: "Chip", domain: "getchip.uk", match: /\bchip\b/i },
  { name: "Plum", domain: "withplum.com", match: /\bplum\b/i },
  { name: "Sidekick", domain: "sidekickmoney.com", match: /\bsidekick\b/i },
  { name: "Moneybox", domain: "moneyboxapp.com", match: /\bmoneybox\b/i },
  { name: "NS&I", domain: "nsandi.com", match: /\b(ns ?& ?i|nsandi|premium bonds?)\b/i },
  { name: "Hargreaves Lansdown", domain: "hl.co.uk", match: /\b(hargreaves|hl)\b/i },
  { name: "Vanguard", domain: "vanguardinvestor.co.uk", match: /\bvanguard\b/i },
  { name: "Trading 212", domain: "trading212.com", match: /\btrading ?212\b/i },
  { name: "Student Loans Company", domain: "slc.co.uk", match: /\b(slc|student loans company)\b/i },
  { name: "PensionBee", domain: "pensionbee.com", match: /\bpension ?bee\b/i },
];

// Every domain with a logo file (ProviderLogo.jsx matches rate rows' links
// against these).
export const LOGO_DOMAINS = PROVIDERS.map(p => p.domain).filter(Boolean);

// The provider an account's name names, or null.
export function providerFromName(name) {
  const text = String(name || "");
  return PROVIDERS.find(p => p.match.test(text)) || null;
}
