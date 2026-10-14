import test from "node:test";
import assert from "node:assert/strict";
import { profileValues, missingInputs, formatDate, valueFor, matchOption, phoneForms, canonicalAnswer } from "./profile.js";

test("profile values: only known keys, blanks dropped, date of birth split", () => {
  const v = profileValues({ firstName: "Sam", lastName: " ", dateOfBirth: "1993-04-07", niNumber: "QQ123456C" }, { depositAmount: 20000 });
  assert.deepEqual(v, { firstName: "Sam", dateOfBirth: "1993-04-07", dobDay: "07", dobMonth: "04", dobYear: "1993", depositAmount: "20000" });
});

test("a date of birth typed the UK way is read as YYYY-MM-DD", () => {
  assert.equal(profileValues({ dateOfBirth: "7/4/1993" }).dateOfBirth, "1993-04-07");
  assert.equal(profileValues({ dateOfBirth: "07-04-1993" }).dobMonth, "04");
});

test("gender, income source and income country reach the agent", () => {
  const v = profileValues({ gender: "Male", incomeSource: "Employment", incomeCountry: "United Kingdom" });
  assert.deepEqual(v, { gender: "Male", incomeSource: "Employment", incomeCountry: "United Kingdom" });
});

test("a mobile typed as 07…, +44… or 0044… gives the same three forms", () => {
  const want = { mobile: "07700900000", mobileInternational: "+447700900000", mobileWithoutCode: "7700900000", mobileCountryCode: "+44" };
  for (const typed of ["07700 900000", "+447700900000", "+44 (0)7700 900000", "0044 7700 900000"]) assert.deepEqual(phoneForms(typed), want, typed);
  assert.deepEqual(phoneForms("+33 6 12 34 56 78"), { mobile: "+33 6 12 34 56 78", mobileInternational: "+33 6 12 34 56 78" });
});

test("monthly income is annual ÷ 12; £ and commas are allowed", () => {
  const v = profileValues({ annualIncome: "£75,000" });
  assert.equal(v.annualIncome, "75000");
  assert.equal(v.monthlyIncome, "6250");
});

test("address search is line 1 then postcode", () => {
  assert.equal(profileValues({ addressLine1: "1 Example Street", postcode: "SW1A 1AA" }).addressSearch, "1 Example Street, SW1A 1AA");
});

test("missing inputs skip optional fields", () => {
  const keys = missingInputs({ firstName: "Sam", middleNames: "" }).map(f => f.key);
  assert.ok(keys.includes("gender") && keys.includes("incomeSource"));
  assert.ok(!keys.includes("firstName") && !keys.includes("middleNames") && !keys.includes("county"));
});

test("dates go in the format the field shows", () => {
  assert.equal(formatDate("1993-04-07", { type: "date" }), "1993-04-07");
  assert.equal(formatDate("1993-04-07", { placeholder: "DD-MM-YYYY" }), "07-04-1993");
  assert.equal(formatDate("1993-04-07", { label: "Date of birth (dd/mm/yy)" }), "07/04/93");
  assert.equal(formatDate("1993-04-07", { placeholder: "MM.DD.YYYY" }), "04.07.1993");
  assert.equal(formatDate("1993-04-07", {}), "07/04/1993");
});

test("the mobile form follows the field", () => {
  const v = profileValues({ mobile: "07700900000" });
  assert.equal(valueFor("mobile", v, { maxlength: 10 }), "7700900000");
  assert.equal(valueFor("mobile", v, { placeholder: "7700 900000" }), "7700900000");
  assert.equal(valueFor("mobile", v, { placeholder: "+44 7700 900000" }), "+447700900000");
  assert.equal(valueFor("mobile", v, {}), "07700900000");
});

test("options: synonyms, months, countries", () => {
  assert.equal(matchOption("Male", ["Please select", "Man", "Woman", "Prefer not to say"], "gender"), "Man");
  assert.equal(matchOption("Female", ["Male", "Female"], "gender"), "Female");
  assert.equal(matchOption("04", ["January", "February", "March", "April"], "dobMonth"), "April");
  assert.equal(matchOption("04", ["Jan", "Feb", "Mar", "Apr"], "dobMonth"), "Apr");
  assert.equal(matchOption("07", ["5", "6", "7", "8"], "dobDay"), "7");
  assert.equal(matchOption("British", ["France", "United Kingdom", "United States"], "nationality"), "United Kingdom");
  assert.equal(matchOption("United Kingdom", ["Select country", "UK", "USA"], "incomeCountry"), "UK");
  assert.equal(matchOption("No", ["Yes, I am", "No, I'm not"], "usPerson"), "No, I'm not");
  assert.equal(matchOption("Employment", ["Salary or wages", "Benefits", "Inheritance"], "incomeSource"), "Salary or wages");
  assert.equal(matchOption("+44", ["France (+33)", "United Kingdom (+44)", "United States (+1)"], "mobileCountryCode"), "United Kingdom (+44)");
  assert.equal(matchOption("Pension", ["Employment", "Retirement income", "Benefits"], "incomeSource"), "Retirement income");
});

test("options: income and years go in the right band", () => {
  const bands = ["Under £25,000", "£25,000 - £49,999", "£50,000 - £74,999", "£75,000 - £99,999", "£100,000+"];
  assert.equal(matchOption("75000", bands, "annualIncome"), "£75,000 - £99,999");
  assert.equal(matchOption("120000", bands, "annualIncome"), "£100,000+");
  assert.equal(matchOption("20000", bands, "annualIncome"), "Under £25,000");
  assert.equal(matchOption("6250", ["£0-£2k", "£2k-£5k", "£5k-£10k", "Over £10k"], "monthlyIncome"), "£5k-£10k");
  assert.equal(matchOption("3", ["Less than 1 year", "1-3 years", "3+ years"], "yearsAtAddress"), "3+ years");
  assert.equal(matchOption("6", ["Less than 6 months", "6 months to 1 year"], "yearsAtAddress"), null);
});

test("options: an address is picked by line 1, never a near miss", () => {
  const list = ["Flat 1, 1 Example Street, London", "1 Example Street, London", "11 Example Street, London", "Flat 2, 10 Example St, London"];
  assert.equal(matchOption("1 Example Street", list, "addressLine1"), "1 Example Street, London");
  assert.equal(matchOption("Flat 2, 10 Example Street", list, "addressLine1"), "Flat 2, 10 Example St, London");
  assert.equal(matchOption("Flat 1 1 Example St", list, "addressLine1"), "Flat 1, 1 Example Street, London");
  assert.equal(matchOption("12 Example Street", list, "addressLine1"), null);
});

test("what Candid knows about the move overrides the profile, but a blank doesn't wipe it", () => {
  assert.equal(profileValues({ sourceOfFunds: "Salary" }, { sourceOfFunds: "Savings" }).sourceOfFunds, "Savings");
  assert.equal(profileValues({ sourceOfFunds: "Salary" }, { sourceOfFunds: undefined }).sourceOfFunds, "Salary");
});

test("full name and account holder's name come from the name fields", () => {
  const v = profileValues({ firstName: "Sam", middleNames: "James", lastName: "Example" });
  assert.equal(v.fullName, "Sam James Example");
  assert.equal(v.accountHolderName, "Sam Example");
});

test("industry, money from overseas and contact preference reach the agent, and match", () => {
  const v = profileValues({ industry: "Healthcare", fundsFromOverseas: "No", contactPreference: "Text" });
  assert.deepEqual(v, { industry: "Healthcare", fundsFromOverseas: "No", contactPreference: "Text" });
  assert.equal(matchOption("Text", ["Post", "SMS", "Phone", "Email"], "contactPreference"), "SMS");
  assert.equal(matchOption("Phone", ["Post", "Text message", "Telephone", "E-mail"], "contactPreference"), "Telephone");
  assert.equal(matchOption("Email", ["Post", "Text message", "Telephone", "E-mail"], "contactPreference"), "E-mail");
  assert.equal(matchOption("Savings", ["Salary", "Savings from income", "Inheritance"], "sourceOfFunds"), "Savings from income");
});

test("an ambiguous option is left for the user, not guessed", () => {
  assert.equal(matchOption("Employed", ["Full-time employed", "Self-employed"], "employmentStatus"), null);
});

test("an answer to a choice field is saved in the profile's words", () => {
  assert.equal(canonicalAnswer("gender", "Woman"), "Female");
  assert.equal(canonicalAnswer("usPerson", "No, I'm not"), "No");
  assert.equal(canonicalAnswer("occupation", "Nurse"), "Nurse");
});
