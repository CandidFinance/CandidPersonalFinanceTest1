import { test } from "node:test";
import assert from "node:assert/strict";
import { topRate, isEasyAccess } from "./savingsRates.js";

const rows = [
  { provider_name: "Leek", account_type: "5-year fixed ISA", rate_aer: "4.85", is_isa: true },
  { provider_name: "Sidekick", account_type: "Easy access ISA", rate_aer: "4.66", is_isa: true },
  { provider_name: "Investec", account_type: "3-year fixed", rate_aer: "5.00", is_isa: false },
  { provider_name: "Saga", account_type: "Easy access", rate_aer: "4.50", is_isa: false },
  { provider_name: "Bank", account_type: "Regular saver", rate_aer: "6.00", is_isa: false },
];

test("only easy-access accounts count as the top rate", () => {
  assert.equal(topRate(rows, true).provider_name, "Sidekick");
  assert.equal(topRate(rows, false).provider_name, "Saga");
  assert.equal(topRate([], true), null);
  assert.equal(isEasyAccess({ account_type: "95-day notice" }), false);
});
