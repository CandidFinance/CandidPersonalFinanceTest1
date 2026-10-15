import { isEasyAccess } from "../lib/savingsRates.js";

// The provider lists on the Cash, Investments and Pension screens, shown by
// MobileProductListTile (cash rates) and MobileProviderTile (the others).
export function getModuleProducts(key, d, m, savingsRates) {
  switch (key) {
    case "cash": {
      const heading = "Cash ISA rates";
      const nonIsaHeading = "Savings account rates";
      // A second, genuinely different list — non-ISA rows, for the portion of
      // the pot that doesn't fit in the ISA (Step 2's Personal Savings
      // Allowance fill). Capped at 4 rows, unlike the ISA list, to keep this
      // secondary list visibly secondary.
      const buildNonIsaProducts = () => (savingsRates || [])
        .filter(r => r.is_isa === false && isEasyAccess(r))
        .sort((a, b) => +b.rate_aer - +a.rate_aer)
        .slice(0, 4)
        .map((r, i) => ({ name: r.provider_name, type: r.account_type, rate: `${r.rate_aer}% AER`, badge: i === 0 ? "Highest rate" : "", productUrl: r.product_url }));

      if (savingsRates === null || savingsRates === undefined) {
        return { heading, nonIsaHeading, products: [], nonIsaProducts: [], disclaimer: "" };
      }
      // The main list is ISA rows only, matching its heading.
      const isaRows = savingsRates.filter(r => r.is_isa === true && isEasyAccess(r));
      if (isaRows.length === 0) {
        return { heading, nonIsaHeading, products: [], nonIsaProducts: buildNonIsaProducts(), disclaimer: "Current rates are temporarily unavailable — check back shortly." };
      }

      const sorted = [...isaRows].sort((a, b) => +b.rate_aer - +a.rate_aer);
      // Conservative "correct as of" date — the oldest row's updated_at, so the
      // disclaimer never overstates freshness for a stale entry in the list.
      const oldestUpdate = sorted.reduce((oldest, r) =>
        !oldest || new Date(r.updated_at) < new Date(oldest) ? r.updated_at : oldest, null);
      const dateLabel = oldestUpdate
        ? new Date(oldestUpdate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "recently";

      return {
        heading, nonIsaHeading,
        products: sorted.map((r, i) => ({
          name: r.provider_name,
          type: r.account_type,
          rate: `${r.rate_aer}% AER`,
          badge: i === 0 ? "Highest rate" : "",
          productUrl: r.product_url,
        })),
        nonIsaProducts: buildNonIsaProducts(),
        disclaimer: `Sorted by rate, highest first. Not a recommendation: Candid isn't paid by any provider. Rates correct as of ${dateLabel}; always confirm current rates directly with the provider before applying.`,
      };
    }
    case "investments":
      return {
        products: [
          // Neutral: alphabetical, no badges or highlight, the same facts for
          // each, fees as each provider published them (checked October
          // 2026). Not a recommendation (advice-vs-guidance review, fix 1).
          { name:"Hargreaves Lansdown", type:"Funds, shares and ETFs", rate:"0.35% a year", feature:"Charge on shares and ETFs capped at £150 a year. Dealing charges apply.", cta:"Visit site", productUrl:"https://www.hl.co.uk/investing/isa" },
          { name:"InvestEngine",  type:"ETFs only", rate:"No platform fee", feature:"0.25% a year if they choose the investments for you.", cta:"Visit site", productUrl:"https://www.investengine.com/isa/" },
          { name:"Trading 212",   type:"Shares and ETFs", rate:"No platform fee", feature:"0.15% currency fee on trades not in pounds.", cta:"Visit site", productUrl:"https://www.trading212.com/isa" },
          { name:"Vanguard",      type:"Vanguard funds and ETFs only", rate:"0.15% a year", feature:"£4 a month below £32,000.", cta:"Visit site", productUrl:"https://www.vanguardinvestor.co.uk/investing-explained/stocks-shares-isa" },
        ],
        disclaimer:"Listed alphabetically. Not a recommendation, and not every provider: Candid isn't paid by any of them. Fees as each provider published them, October 2026; fund and ETF charges are extra. Check the provider's own fees and terms before opening anything. Investments can fall as well as rise.",
      };
    case "pension":
      return {
        products: [
          // Neutral, as the ISA list above.
          { name:"Moneybox",      type:"Personal pension", rate:"0.15% a year", feature:"Capped at £150 a year. Moneybox's own funds charge 0.29% on top.", cta:"Visit site", productUrl:"https://www.moneyboxapp.com/pension/" },
          { name:"PensionBee",    type:"Personal pension", rate:"0.50–0.95% a year", feature:"One charge, including the funds, depending on the plan. Halved on savings over £100,000.", cta:"Visit site", productUrl:"https://www.pensionbee.com/" },
          { name:"Vanguard",      type:"Personal pension (SIPP)", rate:"0.15% a year", feature:"£4 a month below £32,000. Vanguard funds and ETFs only, with their own charges on top.", cta:"Visit site", productUrl:"https://www.vanguardinvestor.co.uk/what-we-offer/personal-pension" },
        ],
        disclaimer:"Listed alphabetically. Not a recommendation, and not every provider: Candid isn't paid by any of them. Fees as each provider published them, October 2026; check them, and the provider's terms, before opening anything. Before moving an existing pension, check for exit fees and any guaranteed benefits you'd lose."
      };
    default:
      return null;
  }
}
