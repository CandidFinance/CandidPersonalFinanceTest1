// Full marginal income tax calculation (UK 2025/26)
// Handles personal allowance taper (£100k–£125,140 → effective 60% rate)
export function calcIncomeTax(gross) {
  const g = Math.max(0, gross);
  const paBase = 12570;
  const taperReduction = Math.max(0, Math.min(paBase, (g - 100000) / 2));
  const pa = Math.max(0, paBase - taperReduction);
  const taxable = Math.max(0, g - pa);
  let tax = 0;
  tax += Math.min(taxable, 37700) * 0.20;
  if (taxable > 37700) tax += Math.min(taxable - 37700, 74870) * 0.40;
  if (taxable > 112570) tax += (taxable - 112570) * 0.45;
  return Math.round(tax);
}

// Returns tax breakdown on a cash bonus given taxable salary (after sacrifice)
export function calcBonusTaxBreakdown(taxableSalary, cashBonus) {
  if (cashBonus <= 0) return { tax:0, effectiveRate:0, crossesTaper:false, crossesAR:false };
  const taxTotal = calcIncomeTax(taxableSalary + cashBonus);
  const taxSalary = calcIncomeTax(taxableSalary);
  const tax = Math.max(0, taxTotal - taxSalary);
  const effectiveRate = cashBonus > 0 ? tax / cashBonus : 0;
  const crossesTaper = (taxableSalary < 125140) && (taxableSalary + cashBonus > 100000);
  const crossesAR = taxableSalary + cashBonus > 125140;
  return { tax, effectiveRate, crossesTaper, crossesAR };
}
