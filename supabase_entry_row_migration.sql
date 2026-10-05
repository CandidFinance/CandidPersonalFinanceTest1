-- Onboarding phase 2: one row per user from the app's two-question entry.
-- The row is created at entry (name and interests) and then updated as each
-- module's questions are answered, and when the report is made, instead of
-- the report inserting a second row. See onboarding-guided-questions.md.
--
-- Grants only: no columns added, renamed, dropped or changed, and no rows
-- touched. anon can only UPDATE columns it has a column-level grant for, and
-- any column in a PATCH it can't update makes PostgREST reject the whole
-- update (401), so every column the app writes after entry is listed here.
--
-- Left insert-only, as they're fixed once written: id, created_at,
-- session_id, acquisition_source, acquisition_medium, acquisition_campaign,
-- referred_by, first_visit_at, assessment_started_at, confidence_score.
-- Already updatable (earlier migrations): pension_my_pct,
-- pension_employer_pct, modules_completed, feedback_submitted, returned, the
-- post_feedback_* columns, and the Property and partner columns.

grant update (
  name, email, interests,
  age, salary, other_income, tax_band, salary_trajectory, monthly_expenses,
  has_bonus, bonus_amount,
  cash_savings, savings_rate, premium_bonds,
  has_investments, isa_this_year, isa_previous, isa_type, unwrapped_investments,
  has_pension, pension_pot, retirement_age,
  has_student_loan, student_loan_plan, student_loan_balance,
  has_mortgage, mortgage_balance, mortgage_rate, mortgage_provider,
  has_personal_loan, personal_loan_balance, personal_loan_rate, personal_loan_provider,
  has_kids, num_kids,
  candid_score, total_opportunity_gbp, critical_modules
) on public.test to anon;
