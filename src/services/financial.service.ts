/**
 * Financial calculation utilities for the decision engine.
 */

export interface MonthlySummary {
  totalIncome: number;
  totalExpenses: number;
  totalDebtPayments: number;
  totalSavings: number;
  netSurplus: number;
}

// ─── Health Score ─────────────────────────────────────────────────────────────
// Returns 0–100
export function calcHealthScore(params: {
  income: number;
  expenses: number;
  debtPayments: number;
  savings: number;
  totalActiveDebt: number;
  emergencyFundMonths: number;
  upcomingHighPriorityAmount: number;
  lastThreeMonthsSurpluses: number[];
}): number {
  const {
    income,
    expenses,
    debtPayments,
    savings,
    totalActiveDebt,
    emergencyFundMonths,
    upcomingHighPriorityAmount,
    lastThreeMonthsSurpluses,
  } = params;

  if (income <= 0) return 0;

  let score = 100;

  // Savings rate (target 20%)
  const savingsRate = savings / income;
  if (savingsRate < 0.05) score -= 25;
  else if (savingsRate < 0.1) score -= 15;
  else if (savingsRate < 0.2) score -= 5;

  // Expense ratio (target <60%)
  const expenseRatio = expenses / income;
  if (expenseRatio > 0.9) score -= 25;
  else if (expenseRatio > 0.75) score -= 15;
  else if (expenseRatio > 0.6) score -= 5;

  // DTI (debt-to-income — monthly payments / income, target <30%)
  const dti = debtPayments / income;
  if (dti > 0.5) score -= 20;
  else if (dti > 0.4) score -= 12;
  else if (dti > 0.3) score -= 6;

  // Emergency fund months (target 6)
  if (emergencyFundMonths < 1) score -= 20;
  else if (emergencyFundMonths < 3) score -= 10;
  else if (emergencyFundMonths < 6) score -= 4;

  // Outstanding debt vs income (ratio)
  const debtIncomeRatio = totalActiveDebt / (income * 12);
  if (debtIncomeRatio > 2) score -= 10;
  else if (debtIncomeRatio > 1) score -= 5;

  // Upcoming high-priority commitments burden
  const commitmentRatio = upcomingHighPriorityAmount / income;
  if (commitmentRatio > 0.5) score -= 10;
  else if (commitmentRatio > 0.25) score -= 5;

  // 3-month trend (penalise consistently negative surplus)
  const negativeMonths = lastThreeMonthsSurpluses.filter((s) => s < 0).length;
  if (negativeMonths >= 2) score -= 15;
  else if (negativeMonths === 1) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Purchase Decision Engine ───────────────────────────────────────────────
export type PurchaseDecision =
  | 'SAFE_TO_BUY'
  | 'WAIT_3_MONTHS'
  | 'WAIT_6_MONTHS'
  | 'BUY_LOWER_MODEL'
  | 'AVOID_FOR_NOW';

export function calcPurchaseDecision(params: {
  income: number;
  expenses: number;
  debtPayments: number;
  totalActiveDebt: number;
  emergencyFundBalance: number;
  monthlyEssentials: number;
  upcomingHighPriorityTotal: number;
  itemPrice: number; // one-time or total cost
  itemEmi?: number; // if paying via EMI
  emiMonths?: number;
  hasActiveDebt: boolean;
}): { decision: PurchaseDecision; reasons: string[]; score: number } {
  const {
    income,
    expenses,
    debtPayments,
    totalActiveDebt: _totalActiveDebt,
    emergencyFundBalance,
    monthlyEssentials,
    upcomingHighPriorityTotal,
    itemPrice,
    itemEmi = itemPrice, // default: single payment treated as EMI
    hasActiveDebt,
  } = params;

  const reasons: string[] = [];
  let failCount = 0;
  let strictFail = 0;

  const emergencyFundMonths = monthlyEssentials > 0 ? emergencyFundBalance / monthlyEssentials : 0;
  const dti = income > 0 ? debtPayments / income : 1;
  const emiRatio = income > 0 ? itemEmi / income : 1;
  const netSurplus = income - expenses - debtPayments - upcomingHighPriorityTotal;
  const surplusAfterEmi = netSurplus - itemEmi;

  // Rule 1: Emergency fund >= 3 months
  if (emergencyFundMonths < 3) {
    reasons.push(`Emergency fund only covers ${emergencyFundMonths.toFixed(1)} months (need 3+)`);
    hasActiveDebt ? strictFail++ : failCount++;
  }

  // Rule 2: DTI <= 30% (stricter 20% if has active debt)
  const dtiThreshold = hasActiveDebt ? 0.2 : 0.3;
  if (dti > dtiThreshold) {
    reasons.push(
      `Debt-to-income ratio ${(dti * 100).toFixed(1)}% exceeds ${dtiThreshold * 100}% limit`
    );
    strictFail++;
  }

  // Rule 3: Item EMI <= 10–15% of income
  const emiThreshold = hasActiveDebt ? 0.1 : 0.15;
  if (emiRatio > emiThreshold) {
    reasons.push(
      `Item EMI is ${(emiRatio * 100).toFixed(1)}% of income (limit ${emiThreshold * 100}%)`
    );
    hasActiveDebt ? strictFail++ : failCount++;
  }

  // Rule 4: Monthly surplus remains positive after EMI
  if (surplusAfterEmi <= 0) {
    reasons.push(
      `Monthly surplus goes negative (${surplusAfterEmi.toFixed(0)}) after purchase payment`
    );
    strictFail++;
  }

  // Rule 5: High-priority commitments covered (already in netSurplus calc)

  // Rule 6: Emergency fund doesn't fall below threshold after purchase
  const balanceAfter = emergencyFundBalance - itemPrice;
  const monthsAfter = monthlyEssentials > 0 ? balanceAfter / monthlyEssentials : 0;
  if (monthsAfter < 3) {
    reasons.push(`Emergency fund would drop to ${monthsAfter.toFixed(1)} months after purchase`);
    failCount++;
  }

  const score = Math.max(0, 100 - strictFail * 30 - failCount * 15);

  let decision: PurchaseDecision;
  if (strictFail === 0 && failCount === 0) {
    decision = 'SAFE_TO_BUY';
  } else if (strictFail >= 2 || (hasActiveDebt && strictFail >= 1 && failCount >= 1)) {
    decision = 'AVOID_FOR_NOW';
  } else if (strictFail >= 1) {
    decision = hasActiveDebt ? 'WAIT_6_MONTHS' : 'WAIT_3_MONTHS';
  } else if (failCount >= 2) {
    decision = 'BUY_LOWER_MODEL';
  } else {
    decision = 'WAIT_3_MONTHS';
  }

  if (reasons.length === 0) {
    reasons.push('All financial conditions are healthy. Safe to proceed.');
  }

  return { decision, reasons, score };
}

// ─── Future Impact Simulator ──────────────────────────────────────────────────
export function simulateFutureImpact(params: {
  currentSavings: number;
  monthlySurplus: number;
  oneTimePurchase: number;
  monthlyEmi: number;
  emiMonths: number;
  projectionMonths: number;
}): { months: number; savings: number; surplus: number }[] {
  const {
    currentSavings,
    monthlySurplus,
    oneTimePurchase,
    monthlyEmi,
    emiMonths,
    projectionMonths,
  } = params;
  const result = [];

  let savings = currentSavings - oneTimePurchase;
  for (let m = 1; m <= projectionMonths; m++) {
    const emi = m <= emiMonths ? monthlyEmi : 0;
    const surplus = monthlySurplus - emi;
    savings += surplus;
    result.push({
      months: m,
      savings: Math.round(savings * 100) / 100,
      surplus: Math.round(surplus * 100) / 100,
    });
  }
  return result;
}
