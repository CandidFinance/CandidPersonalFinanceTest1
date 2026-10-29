// Emails that keep Candid working between visits: what's due for one person
// on one day, worked out on their own figures with the same calculations the
// app uses. api/alerts.js runs it daily for everyone who can get them, sends
// what's due and records each send, so nothing goes twice.
//
// Who gets what:
//  - Subscribers, on their saved answers (subscriptions.saved_state): all
//    five kinds.
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
//    known): what paying it into a pension could save. Not once they've
//    marked it done or not for them this tax year.
//  - newTaxYear: 10 to 30 April: is your pay still £X?
//  - rates: today's best rates would earn £100+ a year more after tax than
//    their accounts. At most every 30 days, and only when the gain has moved
//    by £50 or the best account has changed since the last one.
//  - payday: on their payday (taxTrap.js paydayOf, the 28th unless they've
//    said), with the £100k trap in view: where this tax year's income is
//    heading (taxTrap.js yearProjection), and the pension top-up that would
//    bring it back to £100,000 when it's over.
//
// Information, not instruction (Candid is guidance, not advice): what each
// option is worth, largest first. Pure, unit tested in alerts.test.js.

import { calcMetrics, isaFillable } from "./metrics.js";
import { rollTaxYear, taxYearOf } from "./taxYear.js";
import { calcAnnualAllowanceRoomBeforeTopUps, calcPensionTaperSaving, calcBonusSacrificePotential, childBenefitCharge } from "./pension.js";
import { cashOpportunity } from "./assist.js";
import { childcareSupport } from "./childcare.js";
import { choiceFor, CHOICE_IDS } from "./opportunityChoices.js";
import { fmt } from "./format.js";
import { trapInView, yearProjection, thisTaxYear, isPayday, monthKey, allowanceLost, bonusMonthOf, allowanceLeft, TRAP_START } from "./taxTrap.js";
import { renderEmail } from "./emailLayout.js";

export const SITE = "https://www.candid-finance.co.uk";
export const SUBSCRIBER_KINDS = ["taxYearEnd", "bonus", "newTaxYear", "rates", "payday"];
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
  // The £100k trap and Child Benefit on this tax year's figures (taxTrap.js
  // thisTaxYear), as the module has them: pay to date, and the top-ups
  // recorded, which also use up annual allowance.
  const { d: yd, m: ym, y: year } = thisTaxYear(d, m, today);
  const room = Math.max(0, calcAnnualAllowanceRoomBeforeTopUps(yd, ym).room - (ym.topUpsTotal || 0));
  const taper = calcPensionTaperSaving(ym, room);
  // The same payment restores childcare support (Kids & family): said in
  // the line, not added to the tax figure.
  const cc = childcareSupport(yd, ym);
  const childcare = cc?.recoverable && cc.state === "lost" && !cc.planning && cc.atStake > 0 ? ` It would also restore ${fmt(cc.atStake)} a year of childcare support.` : "";
  // With pay to date from a payday check-in, the year as it's going.
  let trapLine = false;
  if (year.tracked) {
    const tax = Math.round(allowanceLost(year.projected, !!m.scottish).tax);
    // Only what fits this year's annual allowance, as for the taper below.
    if (year.topUp > 0 && tax > 0 && year.topUp <= room && (trapLine = true)) items.push({ tax, line: `${fmt(tax)} of tax: on your pay to date, your income this tax year is heading for ${fmt(year.projected)}. A pension payment of ${fmt(year.topUp)} (including the tax relief added) before 5 April would bring it back to £100,000.${childcare}` });
  } else if (taper.recoverable && taper.taperTaxSaving > 0) {
    trapLine = true;
    items.push({ tax: taper.taperTaxSaving, line: `${fmt(taper.taperTaxSaving)} of tax: a pension payment of ${fmt(taper.taperSacrificeNeeded)} (including the tax relief added) before 5 April would bring your income back to £100,000 for this tax year.${childcare}` });
  }
  const cb = childBenefitCharge(yd, ym);
  if (cb && cb.charge > 0 && cb.payInNeeded <= room && !trapLine) {
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
    subject: tax > 0 ? `${when}: ${fmt(tax)} of avoidable tax` : `${when}: ${fmt(m.isaHeadroom)} of ISA allowance left`,
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
  // Already done, or set aside, this tax year (opportunityChoices.js).
  if (choiceFor(d, CHOICE_IDS.bonus, today)) return null;
  const paid = bonusMonthOf(d);
  // The month before it's paid: there's time to arrange it with payroll.
  const before = paid === 1 ? 12 : paid - 1;
  if (today.getMonth() + 1 !== before) return null;
  // On this tax year's figures (thisTaxYear), as taxYearEnd: the £100k
  // trap's top-ups have used some of the room.
  const { d: yd, m: ym } = thisTaxYear(d, m, today);
  const saving = calcBonusSacrificePotential(yd, ym, allowanceLeft(yd, ym, today)).standalone;
  if (!(saving > 0)) return null;
  const year = paid === 1 ? today.getFullYear() + 1 : today.getFullYear();
  const known = d.bonusMonth && +d.bonusMonth === paid;
  return {
    key: `bonus:${year}-${paid}`, kind: "bonus",
    subject: `Your bonus: up to ${fmt(Math.round(saving))} of avoidable tax`,
    intro: known ? `Your bonus is usually paid in ${MONTHS[paid - 1]}.` : "Many bonuses are paid in March.",
    items: [`Up to ${fmt(Math.round(saving))} of tax on your ${fmt(+d.bonusAmount)} bonus is avoidable, if it's paid into your pension. It has to be arranged with HR or payroll before the bonus is paid.${bonusChildcare(d, m) || bonusTrap(d, m)}`],
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

// A bonus that takes income over £100,000, into the trap: how much of it
// paid into a pension would keep them at £100,000.
function bonusTrap(d, m) {
  const ani = m.adjustedNetIncome, bonus = +d.bonusAmount || 0;
  if (!(ani > TRAP_START) || ani - bonus >= TRAP_START) return "";
  return ` With it, your income this tax year is ${fmt(ani)}, over £100,000, where you start losing your tax-free Personal Allowance; paying ${fmt(ani - TRAP_START)} of it into your pension would keep you at £100,000.`;
}

// Their payday, with the £100k trap in view: where the tax year is heading.
function payday(d, m, today) {
  if (d.employmentStatus !== "employed" || !isPayday(d, today) || !trapInView(d, m.adjustedNetIncome)) return null;
  const y = yearProjection(d, m, today);
  const from = y.tracked ? `On your pay to date (${new Date(y.asOf).toLocaleDateString("en-GB", { day: "numeric", month: "long" })})` : "On your answers";
  return {
    key: `payday:${monthKey(today)}`, kind: "payday",
    subject: y.over ? `Payday check-in: ${fmt(y.topUp)} over £100,000 this tax year` : `Payday check-in: heading for ${fmt(y.projected)} this tax year`,
    intro: "It's payday. The £100,000 trap is measured on the whole tax year, so here's where yours is heading.",
    items: [
      `${from}, your income this tax year is heading for ${fmt(y.projected)}.`,
      y.over ? `A pension payment of ${fmt(y.topUp)} (including the tax relief added) before 5 April would bring it back to £100,000.` : `That's ${fmt(TRAP_START - y.projected)} under £100,000, with ${y.paydaysLeft} payday${y.paydaysLeft === 1 ? "" : "s"} to go.`,
      "Adding this month's taxable pay to date from your payslip keeps it accurate.",
    ],
    link: `${SITE}/app/home`,
  };
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
    subject: `Your savings are losing about ${fmt(gain)} a year to low rates`,
    intro: `Against today's best rates, your cash is losing about ${fmt(gain)} a year after tax where it is now.`,
    items: opp.lines.map(({ section, option: o }) => `${o.provider}${o.product ? ` ${o.product}` : ""}: ${o.ratePct}%${section === "Cash ISA" ? ", tax-free" : section === "Premium Bonds" ? " prize fund rate, tax-free" : ""}`),
    link: `${SITE}/app/module/cash`,
    detail: { gain, top: topId },
  };
}

const KINDS = { taxYearEnd, bonus, newTaxYear, rates, payday };

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
  return renderEmail({ campaign: alert.kind,
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

// ── The daily cap ────────────────────────────────────────────────────────────
// Resend's free plan sends 100 emails a day (UTC), across every kind. A run
// sends what fits under DAILY_SEND_CAP (a few spare for test sends and
// billing's welcomes), most time-bound first; the rest go at the next run,
// as alert_sends stops anyone getting one twice. Sunday's and an event's
// emails can still go a few days after (WEEKLY_GRACE_DAYS, EVENT_EMAIL_DAYS).
export const DAILY_SEND_CAP = 95;
const SEND_ORDER = { confirmReminder: 0, confirmed: 1, welcome: 2, monthly: 4, event: 5, weekly: 6 };
const rank = e => SEND_ORDER[e.kind] ?? 3;
// `sent`: alert_sends rows ({ sent_at }). { now, later, room }.
export function capSends(emails, sent, today = new Date(), cap = DAILY_SEND_CAP) {
  const dayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const room = Math.max(0, cap - (sent || []).filter(s => +new Date(s.sent_at) >= dayStart).length);
  const ordered = emails.map((e, n) => ({ e, n })).sort((a, b) => rank(a.e) - rank(b.e) || a.n - b.n).map(x => x.e);
  return { now: ordered.slice(0, room), later: ordered.slice(room), room };
}
