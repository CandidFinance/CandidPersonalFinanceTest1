// Builds the investor page from the model's results: out/candid-lives.html.
// Usage: npm run personas (runs the model), then node scripts/personas/build-page.js
//
// The page (page.html) is self-contained: the data is written into it.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARCHETYPES } from "./archetypes.js";
import { LEVERS } from "./engine.js";
import { PATHS, yearOf, monthlyPrice } from "./rules.js";

const here = dirname(fileURLToPath(import.meta.url));
const results = JSON.parse(readFileSync(join(here, "out", "results.json"), "utf8"));
const template = readFileSync(join(here, "page.html"), "utf8");

const k = n => `£${Math.round(n / 1000).toLocaleString("en-GB")}k`;
const gbp = n => `£${Math.round(n).toLocaleString("en-GB")}`;

// A year's life events, in words.
function eventText(arch, ev) {
  const who = arch.people.length > 1 && ev.person != null ? `${arch.people[ev.person].name}: ` : arch.people.length > 1 ? `${arch.people[0].name}: ` : "";
  switch (ev.type) {
    case "salary":
      if (ev.employment === "self" && arch.people[ev.person ?? 0].employment === "employed") return `${who}goes self-employed, ${k(ev.to)}`;
      if (ev.employment === "employed" && (arch.people[ev.person ?? 0].salary || 0) === 0) return `${who}back at work, ${k(ev.to)}`;
      if (ev.employment === "self") return `${who}consultancy work, ${k(ev.to)}`;
      return `${who}pay ${k(ev.to)}${ev.bonus ? ` plus ${k(ev.bonus)} bonus` : ""}`;
    case "bonus": return `${who}${k(ev.amount)} bonus`;
    case "monthsOut": return `${who}${ev.months} months without pay`;
    case "redundancy": return `${who}made redundant, ${k(ev.payout)} payout, ${ev.monthsOut} months out`;
    case "break": return `${who}a year out${ev.cost ? `, costing ${k(ev.cost)}` : ""}`;
    case "partTime": return ev.factor >= 1 ? `${who}back to full time` : `${who}works ${Math.round(ev.factor * 5)} days a week`;
    case "retire": return `${who}retires${ev.lumpSum ? ` with a ${k(ev.lumpSum)} tax-free lump sum` : ""}`;
    case "baby": return "A baby";
    case "inheritance": return `Inherits ${k(ev.amount)}`;
    case "gift": return `Gives ${k(ev.amount)} to family`;
    case "downsize": return `Downsizes, freeing about ${k(arch.housing.value - ev.newValue - (ev.costs || 0))}`;
    case "buy": return `Buys a ${k(ev.price)} home`;
    case "rent": return ev.to > 0 ? `Moves out to rent, ${gbp(ev.to / 12)} a month` : null;
    case "oneOff": return `A one-off cost of ${k(ev.amount)}`;
    case "spend": return null;
    default: return null;
  }
}

// What Candid did that year (the model's flags), in words.
const FLAG_TEXT = [
  [/^moves cash$/, "Savings moved to better rates, after tax"],
  [/^transfers an old Cash ISA$/, "Old Cash ISA transferred to a better rate"],
  [/^partner's Cash ISA$/, "Partner's Cash ISA used (roadmap)"],
  [/^raises pension to the match$/, "Pension raised to get the full employer match"],
  [/^bonus into pension$/, "Bonus paid into the pension, out of the 40% or 60% band"],
  [/^stops overpaying the student loan$/, "Student loan overpayments paused: savings pay more"],
  [/^overpays the student loan$/, "Student loan overpaid: it clears, and its rate beats savings"],
  [/^ISA and tax-free gains$/, "Investments moved into the ISA; the year's tax-free gains taken"],
  [/^pays off (.+)$/, (m) => `${m[1] === "the SVR mortgage from savings" ? "Mortgage on the standard variable rate paid off from savings (roadmap)" : `${m[1]} paid off from savings`}`],
  [/^pays voluntary NI$/, "Voluntary NI paid to keep a year of State Pension (roadmap)"],
];
function flagText(f) {
  for (const [re, out] of FLAG_TEXT) { const m = f.match(re); if (m) return typeof out === "function" ? out(m) : out; }
  return null;
}

const data = {
  generated: results.generated,
  price: { first: monthlyPrice(1), last: monthlyPrice(20) },
  paths: Object.fromEntries(Object.entries(results.paths).map(([key, p]) => [key, { ...p, label: PATHS[key].label }])),
  levers: Object.fromEntries(Object.entries(LEVERS).map(([key, l]) => [key, { label: l.label, roadmap: l.group === "roadmap" }])),
  people: results.archetypes.map(a => {
    const arch = ARCHETYPES.find(x => x.id === a.id);
    const events = {};
    for (const [t, evs] of Object.entries(arch.events || {})) {
      const texts = evs.map(ev => eventText(arch, ev)).filter(Boolean);
      if (texts.length) events[t] = texts;
    }
    return {
      id: a.id, name: a.name, age: a.age, summary: a.summary, engagement: a.engagement, member: a.member,
      household: arch.people.length > 1 ? arch.people.map(p => p.name).join(" and ") : null,
      events,
      paths: Object.fromEntries(Object.entries(a.paths).map(([key, r]) => [key, {
        whileMember: r.whileMember, perMemberYear: r.perMemberYear, lasting: r.lasting, ifActedOn: r.ifActedOn,
        withRoadmap: r.withRoadmap, feesPaid: r.feesPaid, perPound: r.perPound, revenue: r.revenue,
        memberYears: r.memberYears, curve: r.curve, byLever: r.byLever,
        years: r.timeline.map((y, i) => ({
          label: `${y.year}/${String(y.year + 1).slice(2)}`,
          member: y.member, gap: y.gap, road: y.netWorthRoadmap - y.netWorthWithout,
          without: y.netWorthWithout, with: y.netWorthWith,
          candid: [...new Set(y.flags.map(flagText).filter(Boolean))],
        })),
      }])),
    };
  }),
};

const html = template.replace("/*__DATA__*/null", JSON.stringify(data));
writeFileSync(join(here, "out", "candid-lives.html"), html);
console.log(`Wrote out/candid-lives.html (${Math.round(html.length / 1024)} KB)`);
