// Emails that keep Candid working between visits: what's due for one person
// on one day, worked out on their own figures with the same calculations the
// app uses. api/alerts.js runs it daily for everyone who can get them, sends
// what's due and records each send, so nothing goes twice.
//
// Who gets what:
//  - Subscribers, on their saved answers (subscriptions.saved_state): all
//    four kinds.
//  - Free users who asked for emails (the unlock tick box or "Get rate
//    alerts"), on what their row in `test` holds: the 5 April reminder and
//    better rates, each saying which date the figures are from. Better
//    rates are free for founding users only (confirmed by FOUNDING_UNTIL),
//    and start FREE_RATES_DELAY_DAYS after they confirm, so never alongside
//    their welcome (accountEmails.js confirmedWelcomeEmail).
//
// The kinds:
//  - taxYearEnd: early March, and again from 26 March, while there's
//    something to use before 5 April: the £100k trap, Child Benefit kept,
//    capital gains, ISA allowance.
//  - bonus: the month before a bonus is paid (February if the month isn't
//    known): what paying it into a pension could save.
//  - newTaxYear: 10 to 30 April: is your pay still £X?
//  - rates: today's best rates would earn £100+ a year more after tax than
//    their accounts. At most every 30 days, and only when the gain has moved
//    by £50 or the best account has changed since the last one.
//
// Information, not instruction (Candid is guidance, not advice): what each
// option is worth, largest first. Pure, unit tested in alerts.test.js.

import { calcMetrics, isaFillable } from "./metrics.js";
import { rollTaxYear, taxYearOf } from "./taxYear.js";
import { calcAnnualAllowanceRoom, calcPensionTaperSaving, calcBonusSacrificePotential, childBenefitCharge } from "./pension.js";
import { cashOpportunity } from "./assist.js";
import { childcareSupport } from "./childcare.js";
import { fmt } from "./format.js";
import { renderEmail } from "./emailLayout.js";

export const SITE = "https://www.candid-finance.co.uk";
export const SUBSCRIBER_KINDS = ["taxYearEnd", "bonus", "newTaxYear", "rates"];
export const FREE_KINDS = ["taxYearEnd", "rates"];
export const RATES_MIN_GAIN = 100;
export const RATES_MIN_DAYS = 30;
export const RATES_MIN_CHANGE = 50;
export const FREE_RATES_DELAY_DAYS = 3;
// Free users who confirm their email by this date are founding users, with
// rate alerts free. null: still open, so everyone who confirms is one.
export const FOUNDING_UNTIL = null;
export const isFounding = verifiedAt => !FOUNDING_UNTIL || new Date(verifiedAt) <= new Date(FOUNDING_UNTIL);
// The final reminder before 5 April starts here (day of March).
const FINAL_FROM = 26;
const DAY_MS = 86400000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const num = v => (v === null || v === undefined || v === "") ? "" : String(v);

// A free user's answers, from the columns their row holds
// (reportRow.js rowInputFields). Dated from the row, so this year's ISA
// payments roll over if they're from an earlier tax year (rollTaxYear).
export function inputsFromRow(row) {
  const made = row.created_at ? new Date(row.created_at) : null;
  return {
    name: row.name || "",
    age: num(row.age),
    employmentStatus: row.employment_status || "",
    salary: num(row.salary),
    otherIncome: num(row.other_income),
    monthlyExpenses: num(row.monthly_expenses),
    cashSavings: num(row.cash_savings),
    savingsRate: num(row.savings_rate),
    premiumBonds: num(row.premium_bonds),
    hasPension: row.has_pension ? "yes" : "no",
    myContribution: num(row.pension_my_pct),
    employerMatch: num(row.pension_employer_pct),
    potValue: num(row.pension_pot),
    hasBonus: row.has_bonus ? "yes" : "no",
    bonusAmount: num(row.bonus_amount),
    hasKids: row.has_kids ? "yes" : "no",
    numKids: num(row.num_kids),
    isaThisYearOther: num(row.isa_this_year),
    studentLoan: row.student_loan_plan || "none",
    loanBalance: num(row.student_loan_balance),
    ...(made && !isNaN(made) ? { inputsTaxYear: taxYearOf(made) } : {}),
  };
}

// ── Each kind: null when nothing's due, else { key, kind, subject, intro,
// items, link, detail }. `key` is unique per person per send, so the same
// one never goes twice.

function taxYearEnd(d, m, today) {
  const month = today.getMonth() + 1, day = today.getDate();
  if (!(month === 3 || (month === 4 && day <= 4))) return null;
  const final = month === 4 || day >= FINAL_FROM;
  const ty = taxYearOf(today);
  const items = [];
  const room = calcAnnualAllowanceRoom(d, m).room;
  const taper = calcPensionTaperSaving(m, room);
  // The same payment restores childcare support (Kids & family): said in
  // the line, not added to the tax figure.
  const cc = childcareSupport(d, m);
  const childcare = cc?.recoverable && cc.state === "lost" && !cc.planning && cc.atStake > 0 ? ` It would also restore ${fmt(cc.atStake)} a year of childcare support.` : "";
  if (taper.recoverable && taper.taperTaxSaving > 0) {
    items.push({ tax: taper.taperTaxSaving, line: `${fmt(taper.taperTaxSaving)} of tax: a pension payment of ${fmt(taper.taperSacrificeNeeded)} (including the tax relief added) before 5 April would bring your income back to £100,000 for this tax year.${childcare}` });
  }
  const cb = childBenefitCharge(d, m);
  if (cb && cb.charge > 0 && cb.payInNeeded <= room && !(taper.recoverable && taper.taperTaxSaving > 0)) {
    items.push({ tax: cb.charge, line: `${fmt(cb.charge)} of Child Benefit kept: a pension payment of ${fmt(cb.payInNeeded)} before 5 April would bring your income to £60,000.` });
  }
  if (m.crystallisable > 0 && m.cgtSaving > 0) {
    items.push({ tax: Math.round(m.cgtSaving), line: `${fmt(Math.round(m.cgtSaving))} of capital gains tax: taking ${fmt(m.crystallisable)} of profit before 5 April would use this year's tax-free allowance.` });
  }
  items.sort((a, b) => b.tax - a.tax);
  if (m.isaHeadroom > 0 && isaFillable(d, m, today) > 0) {
    items.push({ tax: 0, line: `${fmt(m.isaHeadroom)} of ISA allowance left this tax year. Unused allowance is lost on 5 April.` });
  }
  if (!items.length) return null;
  const tax = items.reduce((t, i) => t + i.tax, 0);
  const when = final ? `${daysTo5April(today)} days to 5 April` : "Before 5 April";
  return {
    key: `taxYearEnd:${ty}:${final ? "final" : "early"}`, kind: "taxYearEnd",
    subject: tax > 0 ? `${when}: ${fmt(tax)} of tax you could save` : `${when}: ${fmt(m.isaHeadroom)} of ISA allowance left`,
    intro: "The tax year ends on 5 April. On your figures, these could still be used this tax year:",
    items: items.map(i => i.line), link: `${SITE}/app/home`,
  };
}
function daysTo5April(today) {
  const end = new Date(today.getFullYear(), 3, 5);
  return Math.max(0, Math.round((end - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / DAY_MS));
}

function bonus(d, m, today) {
  if (d.employmentStatus !== "employed" || !(+d.bonusAmount > 0)) return null;
  const paid = +d.bonusMonth >= 1 && +d.bonusMonth <= 12 ? +d.bonusMonth : 3;
  // The month before it's paid: there's time to arrange it with payroll.
  const before = paid === 1 ? 12 : paid - 1;
  if (today.getMonth() + 1 !== before) return null;
  const saving = calcBonusSacrificePotential(d, m).standalone;
  if (!(saving > 0)) return null;
  const year = paid === 1 ? today.getFullYear() + 1 : today.getFullYear();
  const known = d.bonusMonth && +d.bonusMonth === paid;
  return {
    key: `bonus:${year}-${paid}`, kind: "bonus",
    subject: `Your bonus: up to ${fmt(Math.round(saving))} of tax you could save`,
    intro: known ? `Your bonus is usually paid in ${MONTHS[paid - 1]}.` : "Many bonuses are paid in March.",
    items: [`Paying your ${fmt(+d.bonusAmount)} bonus into your pension could save up to ${fmt(Math.round(saving))} in tax. It has to be arranged with HR or payroll before the bonus is paid.${bonusChildcare(d, m)}`],
    link: `${SITE}/app/module/pension`,
  };
}

// A bonus that takes income over £100,000 stops childcare support for the
// whole year; paying enough of it into a pension keeps it.
function bonusChildcare(d, m) {
  const cc = childcareSupport(d, m);
  return cc?.recoverable && cc.state === "lost" && !cc.planning && cc.atStake > 0
    ? ` With it, your income goes over £100,000, which stops ${fmt(cc.atStake)} a year of childcare support; paying ${fmt(cc.payInNeeded)} of it into your pension would keep it.`
    : "";
}

function newTaxYear(d, m, today) {
  const month = today.getMonth() + 1, day = today.getDate();
  if (month !== 4 || day < 10) return null;
  if (!(m.salary > 0) || m.noEarnings) return null;
  return {
    key: `newTaxYear:${taxYearOf(today)}`, kind: "newTaxYear",
    subject: `New tax year: is your pay still ${fmt(m.salary)}?`,
    intro: "A new tax year started on 6 April.",
    items: [
      `Is your pay still ${fmt(m.salary)} a year? If it's changed, updating it in Candid moves every figure with it.`,
      "Your ISA allowance is back to £20,000, and your capital gains allowance to £3,000.",
    ],
    link: `${SITE}/app/home`,
  };
}

function rates(d, m, today, { rows, sent, free, ratesFrom }) {
  if (ratesFrom && today < ratesFrom) return null;
  // A free user's row may not say what their savings pay, and Candid's
  // usual assumption isn't enough to email a figure on.
  if (free && !(+d.savingsRate > 0)) return null;
  const opp = cashOpportunity(d, m, rows);
  if (!opp || opp.gain < RATES_MIN_GAIN) return null;
  const gain = Math.round(opp.gain);
  const top = opp.lines[0]?.option;
  const topId = top ? `${top.provider}|${top.product || ""}|${top.ratePct}` : null;
  const last = (sent || []).filter(s => s.kind === "rates").sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
  if (last) {
    if (today - new Date(last.sent_at) < RATES_MIN_DAYS * DAY_MS) return null;
    const was = last.detail || {};
    if (Math.abs(gain - (+was.gain || 0)) < RATES_MIN_CHANGE && was.top === topId) return null;
  }
  const iso = today.toISOString().slice(0, 10);
  return {
    key: `rates:${iso}`, kind: "rates",
    subject: `Your savings could earn about ${fmt(gain)} a year more`,
    intro: `At today's best rates, your cash could earn about ${fmt(gain)} a year more after tax than where it is now.`,
    items: opp.lines.map(({ section, option: o }) => `${o.provider}${o.product ? ` ${o.product}` : ""}: ${o.ratePct}%${section === "Cash ISA" ? ", tax-free" : section === "Premium Bonds" ? " prize fund rate, tax-free" : ""}`),
    link: `${SITE}/app/module/cash`,
    detail: { gain, top: topId },
  };
}

const KINDS = { taxYearEnd, bonus, newTaxYear, rates };

// Everything due for one person today, not already sent. `who`: "subscriber"
// or "free". `sent`: their alert_sends rows. `rows`: savings_rates.
// `ratesFrom`: a free user's first day for better rates; false: none.
export function alertsDue(rawD, { who = "subscriber", today = new Date(), sent = [], rows = [], ratesFrom = null } = {}) {
  const d = rollTaxYear(rawD || {}, today);
  const m = calcMetrics(d);
  const free = who === "free";
  const done = new Set((sent || []).map(s => s.alert_key));
  return (free ? FREE_KINDS.filter(k => k !== "rates" || ratesFrom !== false) : SUBSCRIBER_KINDS)
    .map(kind => KINDS[kind](d, m, today, { rows, sent, free, ratesFrom }))
    .filter(a => a && !done.has(a.key));
}

// The email itself, as HTML and plain text (emailLayout.js). `asOf`: for a
// free user, when their figures are from. `unsubscribeUrl` is made by the
// server (a signed link).
export function alertEmail(alert, { name = "", free = false, asOf = null, unsubscribeUrl }) {
  const first = (name || "").trim().split(/\s+/)[0];
  return renderEmail({
    subject: alert.subject, preheader: alert.intro,
    greeting: first ? `Hi ${first},` : "Hi,",
    blocks: [
      { p: alert.intro },
      { list: alert.items },
      { button: { label: "See it in Candid", href: alert.link } },
      ...(free && asOf ? [{ small: `These figures are from what you told Candid in ${MONTHS[asOf.getMonth()]} ${asOf.getFullYear()}. If they've changed, so will these.` }] : []),
      ...(free ? [{ small: "A subscription keeps every module's figures current, with reminders before 5 April, at bonus time and when a better rate appears." }] : []),
    ],
    note: "Candid works out what each option is worth on the figures you've given it, with no stake in what you choose. It's guidance, not advice.",
    unsubscribeUrl,
  });
}
