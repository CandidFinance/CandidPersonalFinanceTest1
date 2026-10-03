import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PAGE_FIGURES, fillFigures } from "./pageFigures.js";

const PAGES = ["100k-tax-trap-calculator.html", "mortgage-vs-savings-calculator.html", "student-loan-calculator.html"];
const read = name => readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");

test("page figures are worked out from the app's own constants", () => {
  assert.equal(PAGE_FIGURES.PERSONAL_ALLOWANCE, "£12,570");
  assert.equal(PAGE_FIGURES.TAPER_END, "£125,140");
  assert.equal(PAGE_FIGURES.TAPER_RATE, "60%");
  assert.equal(PAGE_FIGURES.TAPER_ALL_IN_MAX, "71%");
  assert.equal(PAGE_FIGURES.PA_LEFT_AT_110K, "£7,570");
  assert.equal(PAGE_FIGURES.PSA_HIGHER, "£500");
  assert.equal(PAGE_FIGURES.SL_THRESHOLD_PLAN2, "£29,385");
  assert.equal(PAGE_FIGURES.SL_RATE_PLAN1, "4.1%");
  assert.equal(PAGE_FIGURES.SL_PLAN2_CAP_INCOME, "£44,270");
});

test("every {{FIGURE}} token in the calculator pages has a value", () => {
  for (const page of PAGES) {
    const filled = fillFigures(read(page));
    assert.ok(!filled.includes("{{"), `${page} still has an unfilled token`);
  }
});

test("an unknown token fails loudly rather than shipping", () => {
  assert.throws(() => fillFigures("<p>{{NOT_A_FIGURE}}</p>"), /NOT_A_FIGURE/);
});
