// The user's row in Supabase's `test` table, as columns: what the app
// writes when the row is inserted and each time it's PATCHed (useReportRow.js
// does the writing). Every column has an anon UPDATE grant
// (supabase/hand-run/supabase_entry_row_migration.sql), or the whole PATCH
// would be refused.
import { borrowingInputs, calcBorrowingCheck } from "./borrowing.js";
import { mortgageInputs, mortgageSummary } from "./mortgage.js";
import { rentVsBuyInputs, calcRentVsBuy } from "./rentVsBuy.js";
import { monthlyBudget, affordableMaxPrice } from "./monthlyBudget.js";

// The user's inputs. Written when the row is inserted, and PATCHed as each
// module's questions are answered and when the score first shows.
/**
 * @param {import("./types.js").Inputs} d
 * @param {import("./types.js").Metrics} m
 */
export function rowInputFields(d, m) {
  return {
    email: d.email || null,
    name: d.name || null,
    interests: (d.interests || []).join(", ") || null,
    // supabase/hand-run/supabase_financial_goals_migration.sql
    financial_goals: (d.financialGoals || []).join(", ") || null,
    age: +d.age||null,
    // supabase/hand-run/supabase_employment_migration.sql
    employment_status: d.employmentStatus || null,
    not_working_reason: d.employmentStatus === "not_working" ? (d.notWorkingReason || null) : null,
    salary: +d.salary||null,
    other_income: +d.otherIncome||null,
    tax_band: m.taxBandLabel,
    salary_trajectory: d.salaryTrajectory||null,
    monthly_expenses: +d.monthlyExpenses||null,
    cash_savings: +d.cashSavings||null,
    savings_rate: +d.savingsRate||null,
    premium_bonds: +d.premiumBonds||null,
    has_investments: d.hasInvestments === "yes",
    isa_this_year: m.isaUsedThisYear||null,
    isa_previous: (+d.isaPrevCash||0)+(+d.isaPrevSS||0)+(+d.isaPrevLISA||0)+(+d.isaPrevOther||0)||null,
    isa_type: d.isaType||null,
    unwrapped_investments: +d.unwrappedValue||null,
    has_pension: d.hasPension === "yes",
    pension_my_pct: +d.myContribution||null,
    pension_employer_pct: +d.employerMatch||null,
    pension_pot: +d.potValue||null,
    retirement_age: +d.retirementAge||null,
    has_student_loan: d.studentLoan !== "none",
    student_loan_plan: d.studentLoan !== "none" ? d.studentLoan : null,
    student_loan_balance: +d.loanBalance||null,
    has_mortgage: d.hasMortgage === "yes",
    mortgage_balance: +d.mortgageBalance||null,
    mortgage_rate: +d.mortgageRate||null,
    mortgage_provider: d.mortgageProvider||null,
    has_personal_loan: d.hasPersonalLoan === "yes",
    personal_loan_balance: +d.personalLoanBalance||null,
    personal_loan_rate: +d.personalLoanRate||null,
    personal_loan_provider: d.personalLoanProvider||null,
    has_bonus: d.hasBonus === "yes",
    bonus_amount: +d.bonusAmount||null,
    has_kids: d.hasKids === "yes",
    num_kids: +d.numKids||null,
  };
}

// The report's own columns: its score, and the modules' total opportunity
// and critical ones at the time.
/**
 * @param {import("./types.js").Statuses} statuses
 * @param {number|null} score
 */
export function rowReportFields(statuses, score) {
  const criticals = Object.entries(statuses).filter(([,v]) => v.status === "critical").map(([k]) => k).join(",");
  const totalOpp = Object.entries(statuses).reduce((sum, [,v]) => sum + Math.min(v.impact||0, 99998), 0);
  return {
    candid_score: score,
    total_opportunity_gbp: Math.round(totalOpp / 100) * 100,
    critical_modules: criticals,
  };
}

// The Property screen's inputs and results (src/lib/borrowing.js,
// mortgage.js, rentVsBuy.js, monthlyBudget.js), sent once the user edits
// them there. Includes the user's own pension figures, which the Property
// screen can ask for when the Pension module wasn't chosen, and the shared
// figures its walk-through asks (salary, monthly spending): someone arriving
// from a shared Property link may answer nothing else.
/**
 * @param {import("./types.js").Inputs} d
 * @param {import("./types.js").Metrics} m
 * @param {Object[]|null} regionalRates property_regional_rates rows, or null (regionalRates.js falls back).
 * @param {import("./types.js").MarketRates} marketRates
 */
export function propertyRowFields(d, m, regionalRates, marketRates) {
  const b = borrowingInputs(d, m);
  const r = calcBorrowingCheck(b);
  const mi = mortgageInputs(d, r.loanNeeded);
  const num = v => (v === "" || v == null || isNaN(+v)) ? null : Math.round(+v);
  const pct = v => (v === "" || v == null || isNaN(+v)) ? null : +v;
  const yesNo = v => v === "yes" ? true : v === "no" ? false : null;
  const rvbInput = rentVsBuyInputs(d, m, regionalRates, "moderate", marketRates);
  // £0 rent is an answer (living with family, say), as on the screen.
  const rvb = num(d.propertyMonthlyRent) != null && b.price > 0 ? calcRentVsBuy(rvbInput) : null;
  // supabase/hand-run/supabase_property_budget_migration.sql
  const budget = monthlyBudget(d, m);
  const most = b.price > 0 ? affordableMaxPrice(d, m) : null;
  return {
    property_buying_mode: d.propertyBuyingMode === "together" ? "together" : "alone",
    property_price: num(d.propertyPrice),
    property_cash_available: Math.round(b.cashAvailable),
    property_stamp_duty: b.price > 0 && b.stampDutyDetail ? Math.round(b.stampDuty) : null,
    property_fees: Math.round(b.fees),
    property_loan_needed: b.price > 0 ? Math.round(r.loanNeeded) : null,
    property_income_multiple: b.price > 0 && r.multiple != null ? Math.round(r.multiple * 100) / 100 : null,
    salary: +d.salary||null,
    other_income: +d.otherIncome||null,
    tax_band: m.taxBandLabel,
    monthly_expenses: +d.monthlyExpenses||null,
    partner_salary: num(d.partnerSalary),
    partner_other_income: num(d.partnerOtherIncome),
    partner_pension_my_pct: pct(d.partnerMyContribution),
    partner_pension_employer_pct: pct(d.partnerEmployerMatch),
    partner_isa_this_year: num(d.partnerIsaThisYear),
    pension_my_pct: +d.myContribution||null,
    pension_employer_pct: +d.employerMatch||null,
    property_region: d.propertyRegion || null,
    property_first_time_buyer: yesNo(d.propertyFirstTimeBuyer),
    partner_first_time_buyer: yesNo(d.partnerFirstTimeBuyer),
    property_sole_property: yesNo(d.propertySoleProperty),
    // The mortgage figures the calculation used (the user's or the defaults).
    property_mortgage_term_years: mi.termYears,
    property_mortgage_fixed_years: mi.fixedYears,
    property_mortgage_rate: mi.ratePct,
    property_remortgage_fee: Math.round(mi.remortgageFee),
    property_monthly_repayment: r.loanNeeded > 0 ? Math.round(mortgageSummary(mi).monthlyPayment) : null,
    property_monthly_rent: num(d.propertyMonthlyRent),
    property_horizon_years: rvbInput.horizonYears,
    property_tenure: rvbInput.tenure,
    property_ground_rent: rvbInput.tenure === "leasehold" ? num(d.propertyGroundRent) : null,
    property_ground_rent_growth: rvbInput.tenure === "leasehold" ? pct(d.propertyGroundRentGrowth) : null,
    property_service_charge: rvbInput.tenure === "leasehold" ? num(d.propertyServiceCharge) : null,
    // The assumptions the calculation used (the user's or the defaults).
    property_house_price_growth: rvbInput.housePriceGrowthPct,
    property_rent_growth: rvbInput.rentGrowthPct,
    property_investment_return: rvbInput.investmentReturnPct,
    property_dividend_yield: rvbInput.returnType === "invested" ? rvbInput.dividendYieldPct : null,
    property_breakeven_year: rvb ? rvb.breakevenYear : null,
    // Buyer's net wealth less the renter's at the horizon (moderate).
    property_wealth_gap: rvb ? Math.round(rvb.gapAtHorizon) : null,
    // What they'd have left each month once they own it, and the most they
    // could afford with that as a limit (src/lib/monthlyBudget.js).
    property_take_home: budget ? Math.round(budget.takeHome) : null,
    property_other_spending: budget ? Math.round(budget.otherSpending) : null,
    property_budget_left: budget ? Math.round(budget.left) : null,
    property_budget_left_if_rates_rise: budget && budget.leftIfRatesRise != null ? Math.round(budget.leftIfRatesRise) : null,
    property_budget_status: budget ? budget.status : null,
    property_max_price: most ? most.price : null,
    property_max_price_limit: most ? most.limit : null,
    // supabase/hand-run/supabase_spending_scope_migration.sql: buying together, whether the
    // spending figure is the household's or their own.
    property_spending_scope: d.propertyBuyingMode === "together" && d.propertySpendingScope ? d.propertySpendingScope : null,
  };
}
