// Keeps types.js in step with the engine: the Metrics and ModuleStatus
// typedefs list exactly the fields calcMetrics and computeModuleStatuses
// return (a field in [brackets] is optional). A new field in either fails
// here until its typedef has it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcMetrics } from "./metrics.js";
import { computeModuleStatuses } from "./moduleStatus.js";

const source = readFileSync(new URL("./types.js", import.meta.url), "utf8");
// The @property names of each typedef, by typedef name.
const typedefs = {};
for (const block of source.split("/**").slice(1)) {
  const name = block.match(/@typedef \{[^}]*\} (\w+)/)?.[1];
  if (name) typedefs[name] = [...block.matchAll(/@property \{[^}]*\} (\[?)(\w+)/g)].map(m => ({ name: m[2], optional: !!m[1] }));
}
const fieldsOf = intersection => intersection.split(" & ").flatMap(n => typedefs[n] || []).map(p => p.name);
const metricsParts = source.match(/@typedef \{([^}]*)\} Metrics\b/)[1];

const d = { age: "34", salary: "72000", monthlyExpenses: "2200", cashSavings: "18000", hasPension: "yes", myContribution: "3", employerMatch: "5", potValue: "55000", studentLoan: "plan2", loanBalance: "22000", selectedModules: ["cash", "investments", "pension", "studentLoan"] };

test("the Metrics typedef lists every field calcMetrics returns, and no others", () => {
  assert.deepEqual(fieldsOf(metricsParts).sort(), Object.keys(calcMetrics(d)).sort());
});

test("the ModuleStatus typedef lists every field of a module's status", () => {
  const listed = typedefs.ModuleStatus.map(p => p.name);
  const required = typedefs.ModuleStatus.filter(p => !p.optional).map(p => p.name);
  const kids = { ...d, hasKids: "yes", numKids: "2", kidsAges: "3,6" };
  for (const input of [d, kids]) {
    for (const [key, status] of Object.entries(computeModuleStatuses(input, calcMetrics(input)))) {
      for (const field of Object.keys(status)) assert.ok(listed.includes(field), `${key}.${field} isn't in the typedef`);
      for (const field of required) assert.ok(field in status, `${key} has no ${field}`);
    }
  }
});
