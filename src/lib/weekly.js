// Subscribers' emails beyond the alerts (src/lib/alerts.js): the welcome,
// as someone subscribes, and the Sunday email. Pure, unit tested in
// weekly.test.js; api/alerts.js sends them.
//
// The Sunday email has two parts:
//  - Your week: worked out on their own figures, the same way the app does
//    (today's best rates against their accounts, the ISA allowance left,
//    and dates coming up that apply to them).
//  - This week: the news, written for the week (rate changes, Budget
//    rumours) and approved on /admin/alerts before it goes. Each item can
//    carry an `impact`, worked out on their figures: "For you: ...". An
//    item whose impact doesn't apply to them goes without the line.
//
// An issue (the weekly_issues table): { week (the Sunday, YYYY-MM-DD),
// subject, intro, items: [{ title, status, body, source, url, impact }],
// approved_at }. `status`: "rumour", "confirmed" or "news"; `verdict`:
// "win", "bites" or "" (weekly.js VERDICTS). `impact`:
// { kind, ...its figures }, a kind from IMPACTS, or null.
//
// Information, not instruction (Candid is guidance, not advice): what each
// change would mean on their figures, never what to do about it.

import { calcMetrics, isaFillable } from "./metrics.js";
import { rollTaxYear } from "./taxYear.js";
import { cashOpportunity } from "./assist.js";
import { calcBonusSacrificePotential } from "./pension.js";
import { fmt } from "./format.js";
import { taxFreeInterest, savingsTaxRates, INCOME_TAX_RATES, ISA_ALLOWANCE, PSA_BY_BAND } from "./tax.js";
import { renderEmail } from "./emailLayout.js";

export const SITE = "https://www.candid-finance.co.uk";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_MS = 86400000;
// The Sunday email can still go on the two days after, if a run doesn't
// get through everyone (alert_sends stops anyone getting it twice).
export const WEEKLY_GRACE_DAYS = 2;
// Dates within this many days make "Coming up".
const SOON_DAYS = 42;
// Better rates are only worth a line from this much a year.
const RATES_LINE_MIN = 50;
// A mortgage fix ending within this many days makes "Your week": long
// enough to arrange the next deal.
const FIX_SOON_DAYS = 183;
// Above this, National Insurance on pay is 2%; below, 8% (2026/27).
const NI_UPPER = 50270;
export const PAID_PLANS = ["monthly", "yearly"];
// The most free months invites can earn (server/referrals.js REFERRAL_CAP).
export const REFERRAL_MONTHS = 12;
// Free addresses get this many Sunday emails, from the first after they
// gave it; then it's for subscribers.
export const FREE_WEEKLY_ISSUES = 3;
export const STATUSES = { rumour: "Rumour", confirmed: "Confirmed", news: "News" };
// An item's verdict, shown in place of its status: a win for people's
// money, or a change that bites. Optional.
export const VERDICTS = { win: "Win", bites: "Bites" };
// "This week" shows what's settled first: confirmed, then news, then
// rumours; within each, the issue's own order.
const STATUS_ORDER = { confirmed: 0, news: 1, rumour: 2 };

const firstName = name => (name || "").trim().split(/\s+/)[0] || "";
const iso = date => date.toISOString().slice(0, 10);

// Pounds in the emails as £30k, £2.4k, £1.2m: quicker to read on a phone.
// Under £1,000 stays as it is.
export function shortMoney(s) {
  return String(s ?? "").replace(/£(\d{1,3}(?:,\d{3})+|\d{4,})(?!\d|\.\d)/g, (all, num) => {
    const n = +num.replace(/,/g, "");
    const one = x => String(Math.round(x * 10) / 10);
    if (n >= 1e6) return `£${one(n / 1e6)}m`;
    const k = n / 1000;
    return `£${k >= 100 ? Math.round(k) : one(k)}k`;
  });
}
// **bold** in a line, as the layout's inline pieces.
export const boldPieces = s => String(s).split(/\*\*(.+?)\*\*/g).map((x, i) => i % 2 ? { b: x } : x).filter(x => x !== "");
const unbold = s => String(s || "").replace(/\*\*/g, "");
// An intro as blocks: lines starting "- " make a list (the skimmable
// summary), other lines paragraphs; **bold** either way.
export function introBlocks(intro) {
  const blocks = [];
  for (const line of String(intro || "").split(/\n+/).map(l => l.trim()).filter(Boolean)) {
    const bullet = /^[-•]\s+/.test(line);
    const pieces = boldPieces(shortMoney(line.replace(/^[-•]\s+/, "")));
    if (bullet && blocks.at(-1)?.list) blocks.at(-1).list.push(pieces);
    else blocks.push(bullet ? { list: [pieces] } : { p: pieces });
  }
  return blocks;
}
// A subject's {first}: their first name, or dropped with its comma.
export const personalSubject = (subject, first) => subject.replace(/,?\s*\{first\}/g, m => first ? m.replace("{first}", first) : "").trim();

// The Sunday this week's email belongs to, when it's due on `today`: on
// the Sunday or up to WEEKLY_GRACE_DAYS after. Null on other days.
export function weeklyWeek(today = new Date()) {
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const since = day.getUTCDay();
  return since <= WEEKLY_GRACE_DAYS ? iso(new Date(day - since * DAY_MS)) : null;
}
// The next Sunday from `today` (today, if it's a Sunday): the week an
// issue being written is for.
export function nextSunday(today = new Date()) {
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return iso(new Date(+day + ((7 - day.getUTCDay()) % 7) * DAY_MS));
}

// A Bank Rate move on their mortgage: the monthly interest if their rate
// followed it, or that their fix holds it off. Null without a mortgage.
function mortgageLine(d, c, today) {
  const bal = +d.mortgageBalance || 0;
  if (d.hasMortgage !== "yes" || !(bal > 0) || !c) return null;
  const fixEnd = +d.fixExpiryYear && +d.fixExpiryMonth >= 1 ? Date.UTC(+d.fixExpiryYear, +d.fixExpiryMonth - 1, 1) : null;
  if (fixEnd && fixEnd > +today) return `Your mortgage is fixed until ${MONTHS[+d.fixExpiryMonth - 1]} ${d.fixExpiryYear}, so its payments wouldn't change before then.`;
  const month = Math.round(bal * Math.abs(c) / 100 / 12);
  if (month < 1) return null;
  return `On your ${fmt(bal)} mortgage, if your rate followed it, that would mean about ${fmt(month)} a month ${c < 0 ? "less" : "more"} in interest.`;
}

// ── What a change would mean on their figures ────────────────────────────────
// Each takes the item's figures (and the day) and returns a line, or null
// when it doesn't apply to them. `label` and `fields` drive the editor on
// /admin/alerts.
export const IMPACTS = {
  savingsRate: {
    label: "Savings rates move",
    fields: [{ key: "change", label: "Change, in percentage points (e.g. -0.25)" }],
    line: (d, m, { change }) => {
      const c = +change;
      if (!c || !(m.cash > 0)) return null;
      const year = Math.round(m.cash * Math.abs(c) / 100);
      if (year < 1) return null;
      return `On your ${fmt(m.cash)} in cash, a ${Math.abs(c)} point ${c < 0 ? "fall" : "rise"} would mean about ${fmt(year)} a year ${c < 0 ? "less" : "more"} interest, if your accounts follow it.`;
    },
  },
  bankRate: {
    label: "Bank Rate moves (savings and mortgage)",
    fields: [{ key: "change", label: "Change, in percentage points (e.g. 0.25)" }],
    line: (d, m, { change }, today = new Date()) => {
      const lines = [IMPACTS.savingsRate.line(d, m, { change }), mortgageLine(d, +change, today)].filter(Boolean);
      return lines.length ? lines.join(" ") : null;
    },
  },
  inflation: {
    label: "Inflation figure",
    fields: [{ key: "rate", label: "Inflation, % a year (e.g. 3.5)" }],
    line: (d, m, { rate }) => {
      const cpi = +rate;
      if (!(cpi > 0) || !(m.cash > 0)) return null;
      const earns = Math.round(m.effectiveSavingsRate * 100) / 100;
      if (earns >= cpi) return `Your cash earns about ${earns}% on average, above ${cpi}% inflation, so it's growing in real terms, before tax.`;
      const lost = Math.round(m.cash * (cpi - earns) / 100);
      return `Your cash earns about ${earns}% on average, below ${cpi}% inflation, so it's losing spending power: about ${fmt(lost)} a year in real terms on your ${fmt(m.cash)}, before tax.`;
    },
  },
  cashIsaLimit: {
    label: "Cash ISA limit",
    fields: [{ key: "limit", label: "New yearly limit for cash (£)" }, { key: "from", label: "From (e.g. April 2027)" }],
    line: (d, m, { limit, from }) => {
      const cap = +limit;
      if (!(cap > 0)) return null;
      const when = from ? ` from ${from}` : "";
      const paid = +d.isaThisYearCash || 0;
      // A limit at the full allowance (a cut scrapped): what still fits.
      if (cap >= ISA_ALLOWANCE) {
        if (paid > 0) return `You've put ${fmt(paid)} into a cash ISA this tax year. ${from ? `From ${from}` : "From now on"}, up to ${fmt(cap)} a year can still go into cash.`;
        return m.cash > 0 ? `You hold ${fmt(m.cash)} in cash. Up to ${fmt(cap)} a year of it can still go into a cash ISA${when}.` : null;
      }
      if (paid > 0) {
        return paid > cap
          ? `You've put ${fmt(paid)} into a cash ISA this tax year. Under a ${fmt(cap)} limit${when}, ${fmt(paid - cap)} of that would have to go into a stocks and shares ISA, or stay outside an ISA.`
          : `You've put ${fmt(paid)} into a cash ISA this tax year, within a ${fmt(cap)} limit${when}.`;
      }
      return m.cash > cap ? `You hold ${fmt(m.cash)} in cash. Under a ${fmt(cap)} limit${when}, that's the most of it that could go into a cash ISA each year.` : null;
    },
  },
  isaLeft: {
    label: "ISA allowance left",
    fields: [],
    line: (d, m) => m.isaHeadroom > 0 ? `You have ${fmt(m.isaHeadroom)} of this year's £20,000 ISA allowance left, until 5 April.` : null,
  },
  salarySacrificeCap: {
    label: "Salary sacrifice cap",
    fields: [{ key: "cap", label: "Yearly cap before NI is due (£)" }, { key: "from", label: "From (e.g. April 2029)" }],
    line: (d, m, { cap, from }) => {
      const limit = +cap;
      if (!(limit > 0) || d.pensionType !== "sacrifice" || !(m.salary > 0)) return null;
      const sacrificed = Math.round(m.salary * (+d.myContribution || 0) / 100);
      if (!(sacrificed > 0)) return null;
      const when = from ? ` from ${from}` : "";
      if (sacrificed <= limit) return `You sacrifice about ${fmt(sacrificed)} a year, under a ${fmt(limit)} cap${when}, so this wouldn't change what you pay.`;
      const ni = Math.round((sacrificed - limit) * (m.salary > NI_UPPER ? 0.02 : 0.08));
      return `You sacrifice about ${fmt(sacrificed)} a year. Under a ${fmt(limit)} cap${when}, National Insurance would be due on ${fmt(sacrificed - limit)} of it: about ${fmt(ni)} a year.`;
    },
  },
  // Rates come from the engine (tax.js savingsTaxRates), so the line and the
  // app agree; `from` names the tax year they start.
  savingsTax: {
    label: "Savings interest tax rates",
    fields: [{ key: "from", label: "From (e.g. April 2027)" }],
    line: (d, m, { from }) => {
      if (!(m.cash > 0) || !(m.salary > 0)) return null;
      const year = yearOf(from), band = m.taxBandLabel || "basic";
      const interest = Math.round(m.cash * (+m.effectiveSavingsRate || 0) / 100);
      if (interest < 1) return null;
      const free = taxFreeInterest(m.nonSavingsIncome, band);
      const [now, then] = [m.taxYear, year].map(y => Math.round(Math.max(0, interest - free) * savingsTaxRates(y)[band]));
      const on = `Your ${fmt(m.cash)} in cash earns about ${fmt(interest)} a year`;
      if (!then) return `${on}, within the ${fmt(free)} you can earn tax-free, so no tax on it now or from ${from || year}.`;
      return `${on}. Over the ${fmt(free)} you can earn tax-free, that's about ${fmt(then)} a year in tax from ${from || year}, against ${fmt(now)} now.`;
    },
    example: (d, m, { from }, { rows } = {}) => {
      const year = yearOf(from), band = salaryBand(m), rate = bestEasyAccess(rows);
      const interest = Math.round(30000 * rate / 100);
      const tax = (b, y) => fmt(Math.round(Math.max(0, interest - PSA_BY_BAND[b]) * savingsTaxRates(y)[b]));
      const on = `£30,000 at ${rate}%${rows?.length ? " (today's best easy-access rate)" : ""} earns ${fmt(interest)} a year`;
      return band
        ? `${on}. As a ${band}-rate taxpayer, the tax on it would be ${tax(band, year)} a year from ${from || year}, against ${tax(band, year - 1)} now.`
        : `${on}. The tax on it from ${from || year}: ${tax("basic", year)} at basic rate (${tax("basic", year - 1)} now), ${tax("higher", year)} at higher rate (${tax("higher", year - 1)} now).`;
    },
  },
  // Rental profits: their own rates from April 2027 (October 2026 Budget).
  // Candid doesn't ask about rental income, so this is only ever an example.
  propertyTax: {
    label: "Rental income tax rates",
    fields: [{ key: "from", label: "From (e.g. April 2027)" }],
    line: () => null,
    example: (d, m, { from }) => {
      const band = salaryBand(m), when = from || "April 2027";
      const tax = (rates, b) => fmt(Math.round(10000 * rates[b]));
      return band
        ? `As a ${band}-rate taxpayer, £10,000 of rental profit would be taxed ${tax(PROPERTY_TAX_RATES, band)} from ${when}, against ${tax(INCOME_TAX_RATES, band)} now.`
        : `£10,000 of rental profit would be taxed ${tax(PROPERTY_TAX_RATES, "basic")} at basic rate from ${when} (${tax(INCOME_TAX_RATES, "basic")} now), and ${tax(PROPERTY_TAX_RATES, "higher")} at higher rate (${tax(INCOME_TAX_RATES, "higher")} now).`;
    },
  },
  // Side income under the allowance is tax-free; over it, tax is on the
  // rest. Candid doesn't ask about trading income, so only an example.
  tradingAllowance: {
    label: "Trading allowance",
    fields: [{ key: "allowance", label: "New allowance (£)" }, { key: "from", label: "From (e.g. April 2027)" }],
    line: () => null,
    example: (d, m, { allowance, from }) => {
      const now = 1000, next = +allowance || 3000, income = 2500, band = salaryBand(m) || "basic";
      if (income > next) return null;
      const tax = Math.round((income - now) * INCOME_TAX_RATES[band]);
      return `${fmt(income)} of side income is taxed on the ${fmt(income - now)} over today's ${fmt(now)} allowance: ${fmt(tax)} at ${band} rate. From ${from || "April 2027"} it's all within the ${fmt(next)} allowance, so no tax and no Self Assessment return for it.`;
    },
  },
  // The LISA charge on a home over £450,000: 25% to 20% (October 2026
  // Budget). 20% of savings plus the 25% bonus is what was paid in; 25% of
// it, 6.25% less.
  lisaCharge: {
    label: "LISA charge on homes over £450,000",
    fields: [],
    line: d => {
      const paid = +d.isaThisYearLISA || 0;
      if (!(paid > 0)) return null;
      return `You've paid ${fmt(paid)} into a LISA this tax year, ${fmt(Math.round(paid * 1.25))} with the bonus. Withdrawn for a home over £450,000, you'd get back ${fmt(paid)} at the 20% charge, ${fmt(Math.round(paid * 0.0625))} more than at 25%.`;
    },
    example: () => "£4,000 paid in becomes £5,000 with the bonus. Withdrawn for a home over £450,000, you'd get back £4,000 at the 20% charge, £250 more than at 25%.",
  },
};

// Rental profits from April 2027 (October 2026 Budget): 4 points over income
// tax on each band.
const PROPERTY_TAX_RATES = { basic: 0.24, higher: 0.44, additional: 0.49 };
// When savings_rates has none, an easy-access rate for the example.
const EXAMPLE_RATE = 4.5;
// "April 2027" → 2027; the tax year a change starts.
const yearOf = from => +(/\d{4}/.exec(from || "")?.[0]) || 2027;
// Their band, only when they've given a salary.
const salaryBand = m => m.salary > 0 ? m.taxBandLabel : null;
// Today's best easy-access rate outside an ISA (savings_rates rows).
export function bestEasyAccess(rows) {
  const top = Math.max(0, ...(rows || []).filter(r => !r.is_isa && /^easy access$/i.test(r.account_type || "")).map(r => +r.rate_aer || 0));
  return top > 0 ? Math.round(top * 100) / 100 : EXAMPLE_RATE;
}
// What a change means for them: the line on their figures, or failing
// that, a worked example ({ text, example }), or null.
export function impactFor(item, d, m, ctx = {}) {
  const impact = item?.impact && IMPACTS[item.impact.kind];
  if (!impact) return null;
  const own = impact.line(d, m, item.impact, ctx.today);
  if (own) return { text: own, example: false };
  const ex = impact.example?.(d, m, item.impact, ctx);
  return ex ? { text: ex, example: true } : null;
}

// ── Your week ────────────────────────────────────────────────────────────────
export function yourWeek(d, m, today, rows) {
  const lines = [];
  const opp = rows?.length ? cashOpportunity(d, m, rows) : null;
  if (opp && opp.gain >= RATES_LINE_MIN) {
    const top = opp.lines[0]?.option;
    lines.push({ label: "Rates", text: `against today's best rates, your cash is losing about ${fmt(Math.round(opp.gain))} a year after tax${top ? `. Highest for you: ${top.provider}${top.product ? ` ${top.product}` : ""} at ${top.ratePct}%` : ""}.` });
  } else if (m.cash > 0 && opp) {
    lines.push({ label: "Rates", text: "your savings are within £50 a year of today's best rates." });
  }
  if (m.isaHeadroom > 0 && isaFillable(d, m, today) > 0) {
    lines.push({ label: "ISA", text: `${fmt(m.isaHeadroom)} of this year's allowance left, until 5 April.` });
  }
  for (const text of comingUp(d, m, today)) lines.push({ label: "Coming up", text });
  const fixMonth = +d.fixExpiryMonth, fixYear = +d.fixExpiryYear;
  if (d.hasMortgage === "yes" && fixMonth >= 1 && fixMonth <= 12 && fixYear) {
    const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const toFix = Math.round((Date.UTC(fixYear, fixMonth - 1, 1) - day) / DAY_MS);
    if (toFix >= 0 && toFix <= FIX_SOON_DAYS) lines.push({ label: "Coming up", text: `your mortgage fix ends in ${MONTHS[fixMonth - 1]} ${fixYear}.` });
  }
  return lines;
}

export function comingUp(d, m, today) {
  const out = [];
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const yearEnd = Date.UTC(today.getUTCMonth() > 3 || (today.getUTCMonth() === 3 && today.getUTCDate() > 5) ? today.getUTCFullYear() + 1 : today.getUTCFullYear(), 3, 5);
  const toYearEnd = Math.round((yearEnd - day) / DAY_MS);
  if (toYearEnd <= SOON_DAYS) out.push(`the tax year ends on 5 April, in ${toYearEnd} ${toYearEnd === 1 ? "day" : "days"}.`);
  const month = +d.bonusMonth;
  if (d.employmentStatus === "employed" && +d.bonusAmount > 0 && month >= 1 && month <= 12) {
    const y = today.getUTCMonth() + 1 > month ? today.getUTCFullYear() + 1 : today.getUTCFullYear();
    const toBonus = Math.round((Date.UTC(y, month - 1, 1) - day) / DAY_MS);
    if (toBonus >= 0 && toBonus <= SOON_DAYS) {
      const saving = Math.round(calcBonusSacrificePotential(d, m).standalone || 0);
      out.push(`your bonus is usually paid in ${MONTHS[month - 1]}.${saving > 0 ? ` Up to ${fmt(saving)} of tax on it is avoidable if it's paid into your pension, arranged with payroll before it's paid.` : ""}`);
    }
  }
  return out;
}

// ── The emails ──────────────────────────────────────────────────────────────
// Each as HTML and plain text (emailLayout.js).

// The Sunday email for one subscriber. `rows`: savings_rates. `free`: for a
// free address, { n, of } (this is free issue n of `of`) and `confirmUrl`
// while it isn't confirmed, whose button then replaces "Open Candid".
export function weeklyEmail(issue, rawD, { today = new Date(), rows = [], unsubscribeUrl, free = null }) {
  const d = rollTaxYear(rawD || {}, today);
  const m = calcMetrics(d);
  const first = firstName(d.name);
  const items = (issue.items || []).filter(i => i && i.title && i.body)
    .map((i, n) => ({ i, n })).sort((a, b) => (STATUS_ORDER[a.i.status] ?? 1) - (STATUS_ORDER[b.i.status] ?? 1) || a.n - b.n).map(x => x.i);
  const mine = yourWeek(d, m, today, rows);
  const subject = personalSubject(shortMoney((issue.subject || "").trim() || `This week: ${items[0]?.title?.trim() || "your money"}`), first);
  return renderEmail({ campaign: "weekly",
    subject, preheader: shortMoney(unbold(issue.intro).replace(/^[-•]\s+/gm, "").replace(/\n+/g, " ")) || items.map(i => i.title).join(" · "),
    greeting: first ? `Hi ${first},` : "Hi,",
    blocks: [
      ...(free ? [{ small: "You're getting this because you gave us your email, and we thought you might like a little support." }] : []),
      ...introBlocks(issue.intro),
      ...(mine.length ? [{ h: "Your week on Candid" }, { list: mine.map(l => [{ b: l.label }, `: ${shortMoney(l.text)}`]) }, { button: { label: "Fix with Candid", href: `${SITE}/app/home` } }] : []),
      ...(items.length ? [{ h: "What's happening this week that affects you" }] : []),
      ...items.map(i => {
        const forYou = impactFor(i, d, m, { today, rows });
        return { news: { title: shortMoney(unbold(i.title).trim()), status: i.status, verdict: i.verdict || null, body: shortMoney(unbold(i.body).trim()), forYou: forYou && shortMoney(forYou.text), forExample: !!forYou?.example, source: i.source?.trim() || null, url: i.url?.trim() || null } };
      }),
    ],
    after: [
      ...(free?.confirmUrl ? [{ small: "Your email isn't confirmed yet: this button confirms it's yours." }] : []),
      free?.confirmUrl ? { button: { label: "Confirm my email", href: free.confirmUrl } } : { button: { label: "Open Candid", href: `${SITE}/app/home` } },
      ...(free ? [{ small: `${free.n} of ${free.of} free emails, then the Candid chat email is for subscribers.` }] : []),
    ],
    note: "Rumours are just that: nothing changes until it's announced. Candid works out what each change would mean on the figures you've given it, with no stake in what you choose. It's guidance, not advice.",
    unsubscribeUrl,
  });
}

// The welcome, as someone subscribes. `periodEnd`: when it renews (a date).
// `inviteCode`: their referral code (server/referrals.js), for their invite
// link; without one (email not confirmed yet), where to find it in Candid.
export function welcomeEmail({ name = "", plan, amountPence, periodEnd, inviteCode = null, unsubscribeUrl }) {
  const first = firstName(name);
  const price = amountPence > 0 ? `£${(amountPence / 100).toFixed(2)} a ${plan === "yearly" ? "year" : "month"}` : null;
  const renews = periodEnd && !isNaN(new Date(periodEnd)) ? new Date(periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }) : null;
  const invite = inviteCode ? `${SITE}/app/start?ref=${inviteCode}` : null;
  return renderEmail({ campaign: "welcome",
    subject: "Welcome to Candid", preheader: "Every module is now open to you.",
    greeting: first ? `Hi ${first},` : "Hi,",
    blocks: [
      { p: "Thanks for subscribing to Candid. Every module is now open to you, and your answers are saved to this email address." },
      { h: "What you'll get" },
      { list: [
        [{ b: "Every module's figures" }, ", kept current as you update your answers. Open Banking is in testing: in future you'll be able to connect your bank accounts, and your figures will update automatically."],
        [{ b: "An email roundup on Sunday mornings" }, ": rate changes and Budget news, and what each would mean on your figures."],
        [{ b: "Updates on key dates in the tax calendar" }, " that apply to you, from your bonus to 5 April, and whenever a better savings rate appears."],
      ] },
      { button: { label: "Open Candid", href: `${SITE}/app/home` } },
      { p: ["On another phone or computer, ", { a: "sign in", href: `${SITE}/signin` }, " with this email address."] },
      ...(price ? [{ panel: { label: "Your plan", text: `${price}${renews ? `, renewing on ${renews}` : ""}` } }] : []),
      { small: ["To manage your subscription, go to ", { a: "Edit inputs", href: `${SITE}/app/inputs` }, " in Candid, then Manage subscription."] },
      { h: "Share Candid" },
      { p: `Know someone who'd find Candid useful? For each friend who joins with your link and completes their first module, you get a month free, up to ${REFERRAL_MONTHS} months.${invite ? "" : " Your link is in Candid, under Edit inputs."}` },
      ...(invite ? [{ panel: { label: "Your invite link", text: [{ a: invite.replace(/^https:\/\/www\./, ""), href: invite }] } }] : []),
      { p: "Any questions or feedback, just reply to this email." },
    ],
    note: "Candid is guidance, not advice.",
    unsubscribeUrl,
  });
}

// An issue as saved from the editor, or pasted in as a draft: only the
// known fields, trimmed, with limits so nothing runs away.
export function cleanIssue(raw) {
  const str = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const items = (Array.isArray(raw?.items) ? raw.items : []).slice(0, 8).map(i => {
    const kind = IMPACTS[i?.impact?.kind] ? i.impact.kind : null;
    const impact = kind ? Object.fromEntries([["kind", kind], ...IMPACTS[kind].fields.map(f => [f.key, str(String(i.impact[f.key] ?? ""), 40)])]) : null;
    return { title: str(i?.title, 140), status: STATUSES[i?.status] ? i.status : "news", ...(VERDICTS[i?.verdict] ? { verdict: i.verdict } : {}), body: str(i?.body, 1200), source: str(i?.source, 140), url: /^https:\/\//.test(i?.url || "") ? str(i.url, 400) : "", impact };
  }).filter(i => i.title || i.body);
  return { subject: str(raw?.subject, 120), intro: str(raw?.intro, 800), items };
}
