// Opens every app screen and module page in a real browser, for a spread of
// profiles, and steps through each module's answer, failing on any page
// error or the "Something is wrong" screen. Catches what the unit tests
// can't: a screen that throws when it draws (a variable used where it isn't
// defined, say), as the student loan page did in October 2026.
//
//   npm run check:screens   on the last build (dist/)
//   npm run verify          builds, then checks
//
// Serves dist/ with `vite preview` on a free port (the way Vercel serves it,
// vite.config.js). Nothing leaves the machine: Supabase, PostHog, Stripe,
// TrueLayer and Resend are blocked, and /api/* answers 503.

import { preview } from "vite";
import { chromium } from "playwright";
import { existsSync } from "node:fs";

if (!existsSync("dist/app-shell.html")) {
  console.error("No build in dist/. Run `npm run build` first, or `npm run verify`.");
  process.exit(1);
}

const all = ["pension", "cash", "investments", "studentLoan", "kids"];
const done = { selectedModules: all, answeredModules: all, unlockedModules: all, goalsAsked: true, confidenceAsked: true, email: "check@example.com",
  employmentAsked: true, hasExtraIncome: "no", extraIncomeKinds: ["none"] };
const rich = { ...done, name: "Sam", age: "38", employmentStatus: "employed", scottishTaxpayer: "no", salary: "110000", hasPension: "yes", pensionStatus: "yes",
  pensionKind: "dc", pensionType: "sacrifice", myContribution: "5", employerMatch: "5", employerContributionType: "match", potValue: "85000", retirementAge: "67",
  retirementTarget: "32700", childBenefitChildren: "2", cbHigherEarner: "yes", hasKids: "yes", numKids: "2", monthlyExpenses: "3000",
  cashTiers: [{ name: "Old", amount: "25000", rate: "1" }], hasInvestments: "yes", unwrappedValue: "30000", unrealisedGains: "8000",
  studentLoan: "plan2", slPlanAnswer: "plan2", loanBalance: "45000", bonusAmount: "15000", hasBonus: "yes", bonusMonth: "3", inputsTaxYear: 2025,
  ukNation: "england", kidsPreschool: "1", kidsSchool: "1", childcareMonthly: "1500", partnerOver100k: "no" };
export const PROFILES = {
  rich,
  scottish: { ...rich, scottishTaxpayer: "yes", salary: "95000" },
  finalSalary: { ...rich, salary: "60000", pensionStatus: "db", pensionKind: "db", dbPensionIncome: "21000", potValue: "" },
  unsurePension: { ...rich, salary: "40000", pensionStatus: "", hasPension: "", myContribution: "", employerMatch: "" },
  fixedEmployer: { ...rich, salary: "70000", employerContributionType: "fixed", employerMatch: "15", myContribution: "3" },
  selfEmployed: { ...rich, employmentStatus: "self_employed", salary: "55000", employerMatch: "" },
  director: { ...rich, salary: "12570", dividendIncome: "60000", hasExtraIncome: "yes", extraIncomeKinds: ["dividends"] },
  notWorking: { ...rich, employmentStatus: "not_working", notWorkingReason: "between_jobs", salary: "", earnedThisTaxYear: "20000" },
  retired: { ...rich, employmentStatus: "not_working", notWorkingReason: "retired", salary: "", age: "68", potValue: "400000" },
  loanNoAge: { ...rich, age: "", salary: "45000" },
  loanPlan1: { ...rich, studentLoan: "plan1", slPlanAnswer: "plan1", loanBalance: "8000", salary: "38000" },
  loanPostgrad: { ...rich, studentLoan: "postgrad", slPlanAnswer: "postgrad", loanBalance: "12000", salary: "35000" },
  loanUnsure: { ...rich, studentLoan: "none", slPlanAnswer: "unsure", slCountry: "england", loanBalance: "40000", salary: "45000" },
  loanLowPay: { ...rich, salary: "24000" },
  sparse: { ...done, name: "Al", age: "25", employmentStatus: "employed", salary: "30000" },
  familyWales: { ...rich, ukNation: "wales", salary: "105000" },
  familyPartnerOver: { ...rich, salary: "60000", partnerOver100k: "yes" },
  familyNear: { ...rich, salary: "98000", tfcClaiming: "yes" },
  familyUnclaimed: { ...rich, salary: "55000", tfcClaiming: "no", childBenefitChildren: "2", cbHigherEarner: "yes" },
  familyNoKids: { ...rich, kidsPreschool: "0", kidsSchool: "0", childcareMonthly: "" },
  loanWithPostgrad: { ...rich, salary: "48000", hasPgLoan: "yes", pgLoanBalance: "14000" },
  loanFastPay: { ...rich, salary: "34000", age: "25", loanBalance: "55000", salaryTrajectory: "high" },
  loanBelowThreshold: { ...rich, salary: "26000", age: "23", loanBalance: "50000", hasPgLoan: "yes", pgLoanBalance: "12000" },
};
const ROUTES = ["/app/home", "/app/modules", "/app/forecast", "/app/chat", "/app/inputs", "/app/property", ...all.map(k => `/app/module/${k}`)];
const BLOCK = /supabase\.co|posthog|stripe\.com|truelayer|resend\.com/;

const server = await preview({ preview: { port: 0, strictPort: false, open: false }, logLevel: "silent" });
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
const browser = await chromium.launch();
const problems = [];
try {
  for (const [name, d] of Object.entries(PROFILES)) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route("**/*", route => {
      const url = route.request().url();
      if (BLOCK.test(url)) return route.abort();
      if (url.startsWith(base + "/api/")) return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      return route.continue();
    });
    const page = await ctx.newPage();
    let errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error" && /Error/.test(m.text()) && !/Failed to load resource|net::/.test(m.text())) errors.push(m.text().split("\n")[0].slice(0, 200)); });
    await page.goto(base + "/");
    await page.evaluate(d => {
      localStorage.setItem("candid_inputs", JSON.stringify(d));
      localStorage.setItem("candid_insights", JSON.stringify({ score: 70, modules: {} }));
      localStorage.setItem("candid_cookie_choice", "denied");
      localStorage.setItem("candid_insights_date", new Date().toISOString());
    }, d);
    const check = async label => {
      const body = await page.innerText("body").catch(() => "");
      const broken = /Something (is|went) wrong/i.test(body);
      if (broken || errors.length) problems.push(`${name} ${label}${broken ? " [error screen]" : ""}: ${[...new Set(errors)].slice(0, 2).join(" | ") || "no message"}`);
      errors = [];
      return broken;
    };
    for (const r of ROUTES) {
      await page.goto(base + r);
      await page.waitForTimeout(1200);
      const broken = await check(r);
      // The module's answer, step by step, to its last step.
      if (!broken && r.startsWith("/app/module/")) {
        const explain = page.getByText("Explain this", { exact: true });
        if (await explain.count()) {
          await explain.first().click();
          await page.waitForTimeout(400);
          for (let i = 0; i < 3; i++) {
            const next = page.getByRole("button", { name: "Next" });
            if (!(await next.count())) break;
            await next.click();
            await page.waitForTimeout(300);
          }
          await check(`${r} (answer)`);
        }
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}

const checked = `${Object.keys(PROFILES).length} profiles x ${ROUTES.length} screens, and each module's answer`;
if (problems.length) {
  console.error(`Screen check failed (${checked}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`Screen check passed: ${checked}.`);
