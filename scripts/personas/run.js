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
import { ARCHETYPES, ICP } from "./archetypes.js";
import * as R from "./rules.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
mkdirSync(out, { recursive: true });

const gap = (run, base, t) => run.rows[t - 1].netWorth - base.rows[t - 1].netWorth;
const lastYear = spans => Math.max(...spans.map(s => s[1]));
const memberYears = spans => spans.reduce((n, [a, b]) => n + b - a + 1, 0);

// Candid's revenue from a member in year t, after VAT and store fees, in today's money.
const revenueReal = (path, t) => R.netRevenue(t) / R.indices(path).cpi[t - 1];

// One view of Candid: as it is today (TODAY levers), or with the roadmap
// built (ALL levers). Everything the page shows for a person, for that view.
function view(arch, path, levers, base, feesOnly, singles) {
  const rate = R.ACTION_RATES[arch.engagement];
  const expected = simulate(arch, { path, levers, actionRate: rate });
  const full = simulate(arch, { path, levers, actionRate: 1 });
  const leave = lastYear(arch.member), years = memberYears(arch.member);
  const lasting = gap(expected, base, R.YEARS);
  // The standard churn curve instead of the story: membership of exactly k
  // years from year 1, weighted by how many members leave after k years.
  let curveBenefit = 0;
  for (let k = 1; k <= R.YEARS; k++) {
    const p = k < R.YEARS ? R.survival(k - 1) - R.survival(k) : R.survival(R.YEARS - 1);
    curveBenefit += p * gap(simulate(arch, { path, levers, actionRate: rate, membership: [[1, k]] }), base, R.YEARS);
  }
  const byLever = {};
  for (const k of levers) if (k in singles) byLever[k] = singles[k];
  return {
    run: expected,
    figures: {
      whileMember: Math.round(gap(expected, base, leave)),
      perMemberYear: Math.round(gap(expected, base, leave) / years),
      lasting: Math.round(lasting),
      ifActedOn: Math.round(gap(full, base, R.YEARS)),
      perPound: Math.round((lasting + expected.feesReal) / expected.feesReal),
      curveBenefit: Math.round(curveBenefit),
      byLever,
    },
  };
}

function runArchetype(arch, path) {
  const rate = R.ACTION_RATES[arch.engagement];
  const base = simulate(arch, { path });
  // Each lever on its own, against a member paying the subscription and
  // acting on nothing, so the fee isn't counted against every lever.
  const feesOnly = simulate(arch, { path, levers: ["none"], actionRate: rate });
  const singles = {};
  for (const k of ALL) {
    const v = gap(simulate(arch, { path, levers: [k], actionRate: rate }), feesOnly, R.YEARS);
    if (Math.abs(v) >= 100) singles[k] = Math.round(v);
  }
  const today = view(arch, path, TODAY, base, feesOnly, singles);
  const roadmap = view(arch, path, ALL, base, feesOnly, singles);

  let storyRevenue = 0, curveRevenue = 0;
  for (let t = 1; t <= R.YEARS; t++) {
    if (arch.member.some(([a, b]) => t >= a && t <= b)) storyRevenue += revenueReal(path, t);
    curveRevenue += R.survival(t - 1) * revenueReal(path, t);
  }
  return {
    memberYears: memberYears(arch.member), leaveYear: lastYear(arch.member),
    feesPaid: Math.round(today.run.feesReal),
    revenue: Math.round(storyRevenue), curveRevenue: Math.round(curveRevenue),
    today: today.figures, roadmap: roadmap.figures,
    timeline: base.rows.map((r, i) => ({
      year: r.year, member: today.run.rows[i].member,
      without: Math.round(r.netWorth),
      today: Math.round(today.run.rows[i].netWorth), roadmap: Math.round(roadmap.run.rows[i].netWorth),
      flagsToday: today.run.rows[i].flags, flagsRoadmap: roadmap.run.rows[i].flags,
    })),
  };
}

const results = { generated: new Date().toISOString().slice(0, 10), paths: {}, archetypes: [] };
for (const arch of ARCHETYPES) {
  const icp = Object.keys(ICP).find(k => ICP[k].includes(arch.id)) || null;
  const entry = { id: arch.id, name: arch.name, age: arch.age, summary: arch.summary, engagement: arch.engagement, member: arch.member, icp, paths: {} };
  for (const path of Object.keys(R.PATHS)) entry.paths[path] = runArchetype(arch, path);
  results.archetypes.push(entry);
}

const median = list => { const s = [...list].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
const across = (rs, v) => ({
  medianWhileMember: Math.round(median(rs.map(r => r[v].whileMember))),
  medianPerMemberYear: Math.round(median(rs.map(r => r[v].perMemberYear))),
  medianLasting: Math.round(median(rs.map(r => r[v].lasting))),
  meanLasting: Math.round(mean(rs.map(r => r[v].lasting))),
  medianPerPound: Math.round(median(rs.map(r => r[v].perPound))),
  curveMeanBenefit: Math.round(mean(rs.map(r => r[v].curveBenefit))),
  lowCases: rs.filter(r => r[v].lasting < 1000).length,
});
for (const path of Object.keys(R.PATHS)) {
  const rs = results.archetypes.map(a => a.paths[path]);
  results.paths[path] = {
    label: R.PATHS[path].label,
    meanRevenue: Math.round(mean(rs.map(r => r.revenue))),
    curveMeanRevenue: Math.round(mean(rs.map(r => r.curveRevenue))),
    today: across(rs, "today"), roadmap: across(rs, "roadmap"),
  };
}
writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 1));

// ── Summary ──
const gbp = n => `${n < 0 ? "-" : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;
const lines = [];
lines.push(`# Customer lives: results (${results.generated})`, "",
  "Generated by `node scripts/personas/run.js`. Today's money, after tax and after the subscription. Each archetype acts on its share of what Candid shows (high 80%, mid 50%, low 25%). \"Today\" is Candid as it is; \"roadmap\" adds the levers not built yet. Hypothetical and illustrative.", "");
lines.push("## Across all 20", "", "| | Base | Low rates | High rates |", "|---|---|---|---|");
const row = (label, f) => lines.push(`| ${label} | ${Object.keys(R.PATHS).map(p => f(results.paths[p])).join(" | ")} |`);
for (const [v, name] of [["today", "today"], ["roadmap", "with the roadmap"]]) {
  row(`Median benefit per member year, ${name}`, p => gbp(p[v].medianPerMemberYear));
  row(`Median benefit while a member, ${name}`, p => gbp(p[v].medianWhileMember));
  row(`Median benefit by year 20, ${name}`, p => gbp(p[v].medianLasting));
  row(`Mean benefit by year 20, ${name}`, p => gbp(p[v].meanLasting));
  row(`Median benefit for every £1 of subscription, ${name}`, p => `£${p[v].medianPerPound}`);
  row(`Mean benefit on the standard churn curve, ${name}`, p => gbp(p[v].curveMeanBenefit));
}
row("Mean revenue per member, as the stories run", p => gbp(p.meanRevenue));
row("Mean revenue (lifetime value), on the standard churn curve", p => gbp(p.curveMeanRevenue));
row("Archetypes gaining under £1,000, today", p => p.today.lowCases);
lines.push("", "## Each archetype (base path)", "",
  "| Archetype | Member | Per member year | By year 20 | If acted on | Per £1 | With roadmap, by year 20 | Revenue |",
  "|---|---|---|---|---|---|---|---|");
for (const a of results.archetypes) {
  const r = a.paths.base;
  lines.push(`| ${a.name}, ${a.age}: ${a.summary} | ${r.memberYears} yrs | ${gbp(r.today.perMemberYear)} | ${gbp(r.today.lasting)} | ${gbp(r.today.ifActedOn)} | £${r.today.perPound} | ${gbp(r.roadmap.lasting)} | ${gbp(r.revenue)} |`);
}
lines.push("", "## Where it comes from (base path, by year 20, each lever on its own)", "");
for (const a of results.archetypes) {
  const parts = Object.entries(a.paths.base.roadmap.byLever).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${LEVERS[k].label}${LEVERS[k].group === "roadmap" ? " (roadmap)" : ""} ${gbp(v)}`);
  lines.push(`- **${a.name}:** ${parts.length ? parts.join("; ") : "nothing to act on"}`);
}
writeFileSync(join(out, "summary.md"), lines.join("\n") + "\n");
console.log(lines.slice(4, 26).join("\n"));
