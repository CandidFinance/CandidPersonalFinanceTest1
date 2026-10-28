// The shapes of the data that runs through Candid, as JSDoc for editors and
// readers (there's no TypeScript build). The engine's main functions refer to
// them, e.g. `@param {import("./types.js").Inputs} d`.
//
// Inputs keep numbers as the strings the user typed ("" when blank), read
// with `+d.salary || 0`; choices are option values ("yes", "no", "plan2").
// BLANK_DATA in src/CandidApp.jsx is every field's starting value. The
// metrics and statuses fields are calcMetrics' and computeModuleStatuses'
// outputs, as the characterisation test records them.

/**
 * Entry, progress and the app's own state
 * @typedef {Object} EntryInputs
 * @property {string} name
 * @property {string} email
 * @property {string[]} interests Modules picked at the entry, plus "property" or "exploring".
 * @property {boolean} appEntered Been through the entry, which opens the app.
 * @property {string[]} selectedModules Modules whose questions have been answered or skipped.
 * @property {string[]} [answeredModules] Modules whose walk-through was finished.
 * @property {string[]} goalPicks
 * @property {boolean} goalsAsked
 * @property {boolean} scoreShown The Candid score has appeared (recorded once).
 * @property {boolean} [cashTourDone] The Cash page's tour finished or skipped.
 * @property {boolean} [appTourDone] The app's tour of Home, Progress and Modules started (AppTour.jsx).
 * @property {boolean} [emailTileDismissed] The email tile on the Cash page closed.
 * @property {boolean} [emergencyCardDismissed] Cash's emergency fund card closed while at its target.
 * @property {string[]} financialGoals
 * @property {string} houseTargetAmount
 * @property {string} houseTimeframe
 * @property {string} bigPurchaseTargetAmount
 * @property {string} bigPurchaseTimeframe
 * @property {string} [confidence] The entry's confidence answer.
 * @property {number} [inputsTaxYear] The tax year the "this tax year" figures belong to (rollTaxYear).
 * @property {Object<string, {banked: number}>} [moduleBaselines] Each module's £ when first answered (moduleStatus.js).
 * @property {Object<string, {result: string, gap: number, years: number, on: string}>} [decisionsInformed] The last either/or answer seen for each question (valueMetrics.js, useDecisionLog).
 * @property {string[]} [onTrackLast] The modules on track last time the app worked it out (moduleStatus.js onTrackKeys).
 * @property {Object<string, {choice: string, taxYear: number, perYear?: number, on?: string, moduleKey?: string}>} [opportunityChoices] "Done" or "not for me" on an opportunity, for a tax year (opportunityChoices.js).
 * @property {boolean} [unlockGate] Came in after the paywall shipped (unlock.js).
 * @property {string[]} [unlockedModules]
 * @property {boolean} [unlockCallOk]
 * @property {string} [unlockFeedback]
 * @property {boolean} [alertsOptIn]
 * @property {string} [bonusMonth] "1" to "12", or "" when not sure (sharedQuestions.js).
 * @property {string} [payToDate] Taxable pay to date from a payslip (payday check-in, mobile/PaydayCheck.jsx).
 * @property {string} [payToDateOn] "YYYY-MM-DD", the day payToDate was entered.
 * @property {string} [paydayCheckedMonth] "YYYY-MM", the month the payday check-in was last answered or skipped.
 * @property {{implied:number,salary:number,taxYear:number}|null} [driftDismissed] A "No" to "has your pay changed?": the pay it was about, their salary then and the tax year; not asked again near it while those hold (taxTrap.js salaryDrift).
 * @property {string} [payday] "1" to "31", the day of the month they're paid; the 28th when blank (taxTrap.js paydayOf).
 * @property {boolean} [payCheckDue] Figures rolled into a new tax year; Home asks if pay is the same (PayCheckCard).
 */

/**
 * About you and income
 * @typedef {Object} IncomeInputs
 * @property {string} age
 * @property {string} salary
 * @property {string} otherIncome
 * @property {string} dividendIncome
 * @property {string} bonusAmount
 * @property {string} [hasBonus]
 * @property {string} salaryTrajectory "stable", "moderate"...
 * @property {string} employmentStatus "employed", "self_employed" or "not_working".
 * @property {string} [notWorkingReason] When not working: "retired" or "break" (between jobs, a career break).
 * @property {string} [earnedThisTaxYear] When between jobs: pay this tax year before stopping, before tax.
 * @property {string} [scottishTaxpayer] "yes" for a Scottish taxpayer (main home in Scotland): Scottish rates on earnings.
 * @property {string} [childBenefitChildren] Children they get Child Benefit for (asked over £60,000).
 * @property {string} [cbHigherEarner] "no" when a partner earns more, so the charge isn't theirs.
 * @property {string} [retirementTarget] What they'd like to live on a year in retirement, after tax, today's money.
 * @property {string[]} [askedFields] Fields of ask-once questions already asked in a walk-through, answered or not (propertyGuide.js neededAtStart).
 * @property {boolean} [employmentAsked]
 * @property {string} [hasExtraIncome]
 * @property {string} monthlyExpenses
 * @property {string} higherBuffer
 * @property {string} [emergencyMonths]
 */

/**
 * Cash and savings
 * @typedef {Object} CashInputs
 * @property {string} cashSavings The single figure, used when there are no cash tiers.
 * @property {string} savingsRate
 * @property {string} premiumBonds
 * @property {string} [hasPremiumBonds]
 * @property {string} cashAccessType
 * @property {{amount: string, rate: string, name?: string}[]} cashTiers One row per account.
 * @property {string} [hasCashIsaThisYear]
 */

/**
 * Investments and ISAs
 * @typedef {Object} InvestmentInputs
 * @property {string} hasInvestments
 * @property {string} isaUsedThisYear Older inputs only; see isa.js.
 * @property {string} isaPreviousBalance
 * @property {string} isaType
 * @property {string} unwrappedValue
 * @property {string} [hasUnwrapped]
 * @property {string} unrealisedGains
 * @property {string} hasSoldAssetsOutsideWrapper
 * @property {string} realisedCgtGains
 * @property {string} isaThisYearCash
 * @property {string} isaThisYearSS
 * @property {string} isaThisYearLISA
 * @property {string} isaThisYearOther
 * @property {string} hasOtherIsaThisYear
 * @property {string} isaThisYearOtherTypes
 * @property {string} [hasLisa]
 * @property {string} isaPrevCash
 * @property {string} isaPrevSS
 * @property {string} isaPrevLISA
 * @property {string} isaPrevOther
 */

/**
 * Pension
 * @typedef {Object} PensionInputs
 * @property {string} hasPension
 * @property {string} [pensionStatus]
 * @property {boolean} pensionUnknown
 * @property {string} [hasPensionPot]
 * @property {string} [hasOldPensions]
 * @property {string} myContribution % of salary.
 * @property {string} employerMatch % of salary.
 * @property {string} potValue
 * @property {string} potValue2
 * @property {string} retirementAge
 * @property {string} pensionType "sacrifice" or "relief".
 * @property {string} niYears
 * @property {string} [statePensionAmount]
 * @property {string} [pensionAccess]
 * @property {string} [pensionProtection]
 * @property {string} [pensionProtectedAmount]
 * @property {string} [taxFreeCashTaken]
 */

/**
 * Student loan
 * @typedef {Object} StudentLoanInputs
 * @property {string} studentLoan "none", "plan1", "plan2", "plan4", "plan5" or "postgrad".
 * @property {string} loanBalance
 * @property {string} studentLoanRate
 * @property {string} [slPlanAnswer]
 * @property {string} [slPlanResult]
 * @property {string} [slCountry]
 * @property {string} [slCourse]
 * @property {string} [slStart]
 * @property {string} [slStudyYears]
 * @property {string} [slFinishYear]
 * @property {string} [slFirstDueYear]
 * @property {string} [slTuition]
 * @property {string} [slMaintenance]
 * @property {string} [slBalanceEstimate]
 * @property {string} [slBalanceResult]
 */

/**
 * Buying a home (Property). Partner figures are asked only when buying together.
 * @typedef {Object} PropertyInputs
 * @property {string} propertyBuyingMode "alone" or "together".
 * @property {string} propertyPrice
 * @property {string} propertyCashAvailable
 * @property {string} propertyStampDuty The user's own figure, for Scotland and Wales.
 * @property {string} propertyFees
 * @property {string} partnerSalary
 * @property {string} partnerOtherIncome
 * @property {string} partnerMyContribution
 * @property {string} partnerEmployerMatch
 * @property {string} partnerIsaThisYear
 * @property {string} propertyRegion A PROPERTY_REGIONS value (regions.js).
 * @property {string} propertyFirstTimeBuyer
 * @property {string} partnerFirstTimeBuyer
 * @property {string} propertySoleProperty
 * @property {string} [propertyUkResident]
 * @property {string} propertyMortgageTerm
 * @property {string} propertyFixedYears
 * @property {string} propertyMortgageRate
 * @property {string} propertyRemortgageFee
 * @property {string} propertyMonthlyRent
 * @property {string} propertyHorizonYears
 * @property {string} propertyTenure "freehold" or "leasehold".
 * @property {string} propertyGroundRent
 * @property {string} propertyGroundRentGrowth
 * @property {string} propertyServiceCharge
 * @property {string} propertyHousePriceGrowth
 * @property {string} propertyRentGrowth
 * @property {string} propertyInvestmentReturn
 * @property {string} propertyDividendYield
 * @property {string} propertyRenterMoney "cash" or "invested".
 * @property {string} propertyCashReturn
 * @property {string} propertyMaintenancePct
 * @property {string} propertyLeaseholdMaintenance
 * @property {string} propertySellingCosts
 * @property {string} propertySpendingScope "household" or "mine", buying together.
 * @property {boolean} propertyGuideReadinessDone
 * @property {boolean} propertyGuideMortgageDone
 * @property {boolean} propertyGuideRentVsBuyDone
 */

/**
 * Mortgage, loans and family: modules hidden for now (HIDE_MVP_MODULES).
 * @typedef {Object} OtherModuleInputs
 * @property {string} hasMortgage
 * @property {string} mortgageType
 * @property {string} mortgageBalance
 * @property {string} mortgageRate
 * @property {string} monthlyMortgage
 * @property {string} [mortgageOfferRate]
 * @property {string} fixExpiryMonth
 * @property {string} fixExpiryYear
 * @property {string} mortgageProvider
 * @property {string} propertyEquity
 * @property {boolean} ownsOutright
 * @property {string} outrightPropertyValue
 * @property {string} hasPersonalLoan
 * @property {string} personalLoanBalance
 * @property {string} personalLoanRate
 * @property {string} personalLoanMonthly
 * @property {string} personalLoanTermRemaining
 * @property {string} personalLoanAnnualExtra
 * @property {string} personalLoanProvider
 * @property {Object[]} [debts] Debts for the Property waterfall (waterfall.js).
 * @property {string} hasKids
 * @property {string} numKids
 * @property {string} kidsAges
 * @property {string} hasJISA
 * @property {string} juniorISAValue
 * @property {string} savingsGoal
 * @property {string} investHorizon
 * @property {string} inheritDirection
 * @property {string} estateValue
 * @property {string} hasWill
 */

/**
 * Candid Assist (assist.js)
 * @typedef {Object} AssistInputs
 * @property {Object<string, string>|null} assistSnoozed Per item, the figures the user said "not now" to.
 * @property {boolean} assistSkipIsa
 * @property {boolean} assistSkipPb
 * @property {Object[]} assistAccounts Accounts opened through Assist.
 */

/**
 * The Progress tab's own answers (progressTracker.js). £ figures as typed,
 * "" when not set.
 * @typedef {Object} ProgressInputs
 * @property {string} pensionTarget The user's pension target this tax year, theirs and their employer's; "" is the Annual Allowance.
 * @property {string} studentLoanOverpayTarget
 * @property {string} studentLoanOverpaidThisYear Cleared on 6 April (rollTaxYear); a lower balance typed in Student loan adds to it.
 * @property {string} mortgageOverpayTarget
 * @property {string} mortgageOverpaidThisYear Cleared on 6 April (rollTaxYear).
 * @property {{id: string, name?: string, target?: string, saved?: string, date?: string, removed?: boolean}[]} goalVaults
 *   Goal pots: date is "YYYY-MM" or "". A pot from a goal (id "home", "purchase") saved here replaces it; `removed` hides it.
 */

/**
 * The user's answers (`d`), kept in localStorage as `candid_inputs`.
 * @typedef {EntryInputs & IncomeInputs & CashInputs & InvestmentInputs & PensionInputs & StudentLoanInputs & PropertyInputs & OtherModuleInputs & AssistInputs & ProgressInputs} Inputs
 */

/**
 * Today's best savings rates, from the rate feed (CandidApp.jsx marketRates).
 * Empty while the rates are loading.
 * @typedef {Object} MarketRates
 * @property {number} [isaRate] Best easy-access cash ISA rate, %.
 * @property {number} [nonIsaRate] Best easy-access savings rate, %.
 * @property {Object[]|null} [rows] The savings_rates rows, for spreading cash across accounts.
 */

/**
 * Income and tax
 * @typedef {Object} IncomeMetrics
 * @property {number} salary
 * @property {number} adjustedNetIncome
 * @property {number} nonSavingsIncome
 * @property {string} taxBandLabel
 * @property {number} tr Marginal income tax rate on salary, as a fraction.
 * @property {number} savingsTr Tax rate on savings interest, as a fraction.
 * @property {number} taxYear
 * @property {number} salarySacrifice
 * @property {number} salaryGrowthRate Pay growth as one rate: their own, their band, or the ten-year average of their pay by year.
 * @property {number|Object} payGrowth What the projections use: salaryGrowthRate, or their pay by year (metrics.js payPathOf).
 * @property {number} monthlyTakeHome
 * @property {number} monthlySurplus
 * @property {number} monthlyShortfall More going out than coming in, a month (0 with a surplus).
 * @property {boolean} expensesUnknown No monthly spending entered.
 * @property {number} largestCashHolding The most cash at one bank, for the FSCS limit.
 * @property {boolean} noEarnings Not working, or no salary.
 * @property {boolean} scottish A Scottish taxpayer.
 * @property {number} earnedEarlierThisYear Not working: pay earlier this tax year (stated or estimated).
 * @property {boolean} earnedEarlierEstimated Whether that's an estimate from their last salary.
 * @property {number} settlementTaxedThisYear A redundancy settlement's taxed parts, this tax year.
 * @property {number} expenses
 */

/**
 * Cash
 * @typedef {Object} CashMetrics
 * @property {number} cash
 * @property {number} bonds Premium Bonds.
 * @property {number} totalLiquid
 * @property {number} runwayMonths
 * @property {number} bufferMonths
 * @property {number} emergencyFund
 * @property {number} emergencyBuffer
 * @property {number} emergencyShortfall
 * @property {number} emergencyExcess
 * @property {number} surplusCash
 * @property {number} savingsRate
 * @property {number} effectiveSavingsRate
 * @property {number} bestSavingsRate
 * @property {number} annualYieldGap
 * @property {number} cashMoveAmount
 * @property {boolean} cashExcessNotWorthMoving
 */

/**
 * ISAs and investments
 * @typedef {Object} IsaMetrics
 * @property {number} isaHeadroom
 * @property {number} cashIsaHeadroom
 * @property {number} isaUsedThisYear
 * @property {number} crystallisable
 * @property {number} cgtSaving
 * @property {number} cgtRate
 * @property {number} remainingCgtAllowance
 */

/**
 * Pension and State Pension
 * @typedef {Object} PensionMetrics
 * @property {string|null} pensionStatus
 * @property {string} pensionType
 * @property {number} missedMatch Employer match left unclaimed, £ a year.
 * @property {number} projectedPot
 * @property {number} years Years to retirement.
 * @property {number} statePensionWeekly
 * @property {number} statePensionAnnual
 * @property {number} niYearsToFull
 * @property {boolean} pastStatePensionAge
 */

/**
 * Student loan
 * @typedef {Object} StudentLoanMetrics
 * @property {number} loanBal
 * @property {boolean} loanBalEstimated
 * @property {number} annualRepayment
 * @property {number} pgLoanBal A Postgraduate loan alongside the main plan (studentLoan.js hasPgLoan), else 0.
 * @property {number} pgRepayment Its repayment this year: 6% of pay over £21,000.
 * @property {number} slRepaymentRegular
 * @property {number} slEarnings
 * @property {boolean} willClear
 */

/**
 * Net worth, property and the hidden modules
 * @typedef {Object} NetWorthMetrics
 * @property {number} totalAssets
 * @property {number} totalLiabilities
 * @property {number} netWorth
 * @property {number} propertyEquity
 * @property {number} propertyValue
 * @property {number|null} ltv
 * @property {number|null} daysToFixExpiry
 * @property {number} personalLoanAnnualRepayment
 * @property {number|null} personalLoanPayoffMonths
 */

/**
 * What calcMetrics works out from the inputs (`m`). Amounts are £ a year
 * unless the name says otherwise; rates are fractions (tr: 0.4) unless
 * they're named in %.
 * @typedef {IncomeMetrics & CashMetrics & IsaMetrics & PensionMetrics & StudentLoanMetrics & NetWorthMetrics} Metrics
 */

/**
 * One module's state, from computeModuleStatuses.
 * @typedef {Object} ModuleStatus
 * @property {"ok"|"attention"|"critical"|"na"|"unknown"} status
 * @property {number} impact £ a year at stake, for ordering and the score.
 * @property {string|null} impactLabel
 * @property {number} amount The £ the module's screen leads with.
 * @property {number} [potentialAmount] Pension only.
 * @property {boolean} [belowThreshold] Student loan only: earnings are under the repayment threshold.
 * @property {boolean} [amountIsLumpSum] Kids only: the amount is a one-off, not a year's.
 * @property {boolean} [amountOnly] Student loan only: its status comes from the £ alone (isOnTrack).
 * @property {string|null} [reason] Cash only: why it needs action when under £50 a year is left.
 */

/**
 * Every module's state, by module key (cash, investments, pension,
 * studentLoan, mortgage, personalLoan, kids).
 * @typedef {Object<string, ModuleStatus>} Statuses
 */

export {};
