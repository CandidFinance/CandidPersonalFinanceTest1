// Runs every archetype on every economic path and writes the results:
//   out/results.json  everything, for the investor page
//   out/summary.md    the headline figures, to read
// Usage: node scripts/personas/run.js
//
// All figures are in today's (2026/27) money. "Benefit" is the gap in net
// worth between the life with Candid and the life without, after tax and
// after the subscription.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { simulate, TODAY, ALL, LEVERS } from "./engine.js";
import { ARCHETYPES } from "./archetypes.js";
import * as R from "./rules.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
mkdirSync(out, { recursive: true });

const gap = (run, base, t) => run.rows[t - 1].netWorth - base.rows[t - 1].netWorth;
const lastYear = spans => Math.max(...spans.map(s => s[1]));
const memberYears = spans => spans.reduce((n, [a, b]) => n + b - a + 1, 0);

// Candid's revenue from a member in year t, after VAT and store fees, in today's money.
const revenueReal = (path, t) => R.netRevenue(t) / R.indices(path).cpi[t - 1];

function runArchetype(arch, path) {
  const rate = R.ACTION_RATES[arch.engagement];
  const base = simulate(arch, { path });
  const full = simulate(arch, { path, levers: TODAY, actionRate: 1 });
  const expected = simulate(arch, { path, levers: TODAY, actionRate: rate });
  const roadmap = simulate(arch, { path, levers: ALL, actionRate: rate });
  const leave = lastYear(arch.member);
  const years = memberYears(arch.member);

  // Each lever on its own, against a member paying the subscription and
  // acting on nothing, so the fee isn't counted against every lever.
  const feesOnly = simulate(arch, { path, levers: ["none"], actionRate: rate });
  const byLever = {};
  for (const k of ALL) {
    const v = gap(simulate(arch, { path, levers: [k], actionRate: rate }), feesOnly, R.YEARS);
    if (Math.abs(v) >= 100) byLever[k] = Math.round(v);
  }

  // The standard churn curve instead of the story: membership of exactly k
  // years from year 1, weighted by how many members leave after k years.
  let curveBenefit = 0, curveRevenue = 0;
  for (let k = 1; k <= R.YEARS; k++) {
    const p = k < R.YEARS ? R.survival(k - 1) - R.survival(k) : R.survival(R.YEARS - 1);
    const run = simulate(arch, { path, levers: TODAY, actionRate: rate, membership: [[1, k]] });
    curveBenefit += p * gap(run, base, R.YEARS);
    curveRevenue += R.survival(k - 1) * revenueReal(path, k);
  }
  let storyRevenue = 0;
  for (let t = 1; t <= R.YEARS; t++) if (arch.member.some(([a, b]) => t >= a && t <= b)) storyRevenue += revenueReal(path, t);

  const lasting = gap(expected, base, R.YEARS);
  return {
    memberYears: years, leaveYear: leave,
    whileMember: Math.round(gap(expected, base, leave)),
    lasting: Math.round(lasting),
    ifActedOn: Math.round(gap(full, base, R.YEARS)),
    withRoadmap: Math.round(gap(roadmap, base, R.YEARS)),
    feesPaid: Math.round(expected.feesReal),
    perPound: Math.round((lasting + expected.feesReal) / expected.feesReal),
    perMemberYear: Math.round(gap(expected, base, leave) / years),
    revenue: Math.round(storyRevenue),
    byLever,
    curve: { benefit: Math.round(curveBenefit), revenue: Math.round(curveRevenue) },
    timeline: base.rows.map((r, i) => ({
      year: r.year, member: expected.rows[i].member,
      netWorthWithout: Math.round(r.netWorth), netWorthWith: Math.round(expected.rows[i].netWorth),
      netWorthRoadmap: Math.round(roadmap.rows[i].netWorth),
      gap: Math.round(expected.rows[i].netWorth - r.netWorth),
      flags: expected.rows[i].flags,
      events: (arch.events?.[i + 1] || []).map(e => e.type),
    })),
  };
}

const results = { generated: new Date().toISOString().slice(0, 10), paths: {}, archetypes: [] };
for (const arch of ARCHETYPES) {
  const entry = { id: arch.id, name: arch.name, age: arch.age, summary: arch.summary, engagement: arch.engagement, member: arch.member, paths: {} };
  for (const path of Object.keys(R.PATHS)) entry.paths[path] = runArchetype(arch, path);
  results.archetypes.push(entry);
}

const median = list => { const s = [...list].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
for (const path of Object.keys(R.PATHS)) {
  const rs = results.archetypes.map(a => a.paths[path]);
  results.paths[path] = {
    label: R.PATHS[path].label,
    medianLasting: Math.round(median(rs.map(r => r.lasting))),
    meanLasting: Math.round(mean(rs.map(r => r.lasting))),
    medianWhileMember: Math.round(median(rs.map(r => r.whileMember))),
    medianPerMemberYear: Math.round(median(rs.map(r => r.perMemberYear))),
    medianPerPound: Math.round(median(rs.map(r => r.perPound))),
    medianWithRoadmap: Math.round(median(rs.map(r => r.withRoadmap))),
    meanRevenue: Math.round(mean(rs.map(r => r.revenue))),
    curveMeanBenefit: Math.round(mean(rs.map(r => r.curve.benefit))),
    curveMeanRevenue: Math.round(mean(rs.map(r => r.curve.revenue))),
    lowCases: rs.filter(r => r.lasting < 1000).length,
  };
}
writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 1));

// ── Summary ──
const gbp = n => `${n < 0 ? "-" : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
const lines = [];
lines.push(`# Customer lives: results (${results.generated})`, "",
  "Generated by `node scripts/personas/run.js`. Today's money, after tax and after the subscription. \"Expected\" applies each archetype's action rate (high 80%, mid 50%, low 25%). Hypothetical and illustrative.", "");
lines.push("## Across all 20", "", "| | Base | Low rates | High rates |", "|---|---|---|---|");
const row = (label, f) => lines.push(`| ${label} | ${Object.keys(R.PATHS).map(p => f(results.paths[p])).join(" | ")} |`);
row("Median benefit while a member", p => gbp(p.medianWhileMember));
row("Median benefit per member year", p => gbp(p.medianPerMemberYear));
row("Median lasting benefit, by year 20", p => gbp(p.medianLasting));
row("Mean lasting benefit, by year 20", p => gbp(p.meanLasting));
row("Median lasting benefit, with the roadmap", p => gbp(p.medianWithRoadmap));
row("Median benefit for every £1 of subscription", p => `£${p.medianPerPound}`);
row("Mean revenue per member, as the stories run", p => gbp(p.meanRevenue));
row("Mean benefit, on the standard churn curve", p => gbp(p.curveMeanBenefit));
row("Mean revenue (lifetime value), on the standard churn curve", p => gbp(p.curveMeanRevenue));
row("Archetypes gaining under £1,000", p => p.lowCases);
lines.push("", "## Each archetype (base path)", "",
  "| Archetype | Member | While a member | Per member year | Lasting, year 20 | If acted on | With roadmap | Per £1 | Revenue |",
  "|---|---|---|---|---|---|---|---|---|");
for (const a of results.archetypes) {
  const r = a.paths.base;
  lines.push(`| ${a.name}, ${a.age}: ${a.summary} | ${r.memberYears} yrs | ${gbp(r.whileMember)} | ${gbp(r.perMemberYear)} | ${gbp(r.lasting)} | ${gbp(r.ifActedOn)} | ${gbp(r.withRoadmap)} | £${r.perPound} | ${gbp(r.revenue)} |`);
}
lines.push("", "## Where it comes from (base path, lasting benefit by lever)", "");
for (const a of results.archetypes) {
  const parts = Object.entries(a.paths.base.byLever).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${LEVERS[k].label}${LEVERS[k].group === "roadmap" ? " (roadmap)" : ""} ${gbp(v)}`);
  lines.push(`- **${a.name}:** ${parts.length ? parts.join("; ") : "nothing to act on"}`);
}
writeFileSync(join(out, "summary.md"), lines.join("\n") + "\n");
console.log(lines.slice(0, 18).join("\n"));
