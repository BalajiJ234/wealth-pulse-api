/**
 * Budget Engine Service
 * Core algorithms for budget generation, tracking, and insights
 */

import { v4 as uuidv4 } from "uuid";
import {
  MonthlyBudgetPlan,
  BudgetBucket,
  BudgetInsight,
  BudgetRuleSet,
  IncomeSource,
  Debt,
  Goal,
  DebtSnapshot,
  GoalSnapshot,
  CategoryBudget,
  BucketStatus,
  BucketType,
  Transaction,
  DEFAULT_BUDGET_RULES,
  DEFAULT_CATEGORIES,
  Currency,
} from "../models/budget.models";
import { createMoney } from "./fx.service";

// In-memory storage (replace with database in production)
const budgetPlans: Map<string, MonthlyBudgetPlan> = new Map();
const transactions: Map<string, Transaction> = new Map();

// ==================== Helper Functions ====================

/**
 * Determine bucket status based on spent vs planned
 */
function calculateStatus(spent: number, planned: number): BucketStatus {
  if (planned === 0) return "UNDER";
  const ratio = spent / planned;
  if (ratio > 1) return "OVER";
  if (ratio >= 0.8) return "NEAR_LIMIT";
  return "UNDER";
}

/**
 * Generate plan key for storage
 */
function getPlanKey(userId: string, month: string): string {
  return `${userId}_${month}`;
}

// ==================== Core Algorithms ====================

/**
 * 5.2 Budget Generation
 * Generate a monthly budget plan for a user
 */
export async function generateBudgetPlan(
  userId: string,
  month: string,
  baseCurrency: Currency,
  incomes: IncomeSource[],
  debts: Debt[],
  goals: Goal[],
  rules: BudgetRuleSet = {
    ...DEFAULT_BUDGET_RULES,
    id: "default",
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
): Promise<MonthlyBudgetPlan> {
  // Step 1: Sum income (normalize to base currency)
  let totalIncomeBase = 0;
  for (const income of incomes.filter((i) => i.isActive)) {
    totalIncomeBase += income.money.baseAmount;
  }

  const totalIncome = await createMoney(
    totalIncomeBase,
    baseCurrency,
    baseCurrency
  );

  // Step 2: Calculate bucket allocations
  const needsPlanned = (totalIncomeBase * rules.buckets.needs) / 100;
  const wantsPlanned = (totalIncomeBase * rules.buckets.wants) / 100;
  let savingsPlanned = (totalIncomeBase * rules.buckets.savings) / 100;
  let debtPlanned = (totalIncomeBase * rules.buckets.debt) / 100;

  // Step 3: Enforce minimums
  const minSavings = totalIncomeBase * (rules.minSavingsPercent / 100);
  const totalMinDebtPayments = debts.reduce(
    (sum, d) => sum + d.minMonthlyPayment.baseAmount,
    0
  );

  // Ensure savings meets minimum
  if (savingsPlanned < minSavings) {
    savingsPlanned = minSavings;
    // Note: In production, reduce wants to cover deficit
  }

  // Ensure debt covers minimum payments
  if (debtPlanned < totalMinDebtPayments) {
    debtPlanned = totalMinDebtPayments;
    // Note: In production, reduce wants to cover deficit
  }

  // Step 4: Distribute savings sub-buckets
  const savingsAllocation = {
    localEmergencyFund: savingsPlanned * rules.liabilityOriginPolicy.local,
    homeCountryInvestments: savingsPlanned * rules.liabilityOriginPolicy.home,
    globalInvestments: savingsPlanned * rules.liabilityOriginPolicy.global,
  };

  // Step 5: Distribute debt payments
  const sortedDebts =
    rules.debtStrategy === "snowball"
      ? [...debts].sort(
          (a, b) =>
            a.outstandingPrincipal.baseAmount - b.outstandingPrincipal.baseAmount
        )
      : [...debts].sort(
          (a, b) => b.interestRateAnnual - a.interestRateAnnual
        );

  let remainingDebtBudget = debtPlanned;
  const debtSnapshots: DebtSnapshot[] = [];

  for (const debt of sortedDebts) {
    const minPayment = debt.minMonthlyPayment.baseAmount;
    let allocatedPayment = minPayment;
    let isMinimum = true;

    // Allocate extra to highest priority debt
    if (remainingDebtBudget > minPayment && debtSnapshots.length === 0) {
      allocatedPayment = Math.min(
        remainingDebtBudget,
        debt.outstandingPrincipal.baseAmount
      );
      isMinimum = false;
    }

    remainingDebtBudget -= allocatedPayment;

    debtSnapshots.push({
      debtId: debt.id,
      name: debt.name,
      outstandingPrincipal: debt.outstandingPrincipal,
      allocatedPayment: await createMoney(
        allocatedPayment,
        baseCurrency,
        baseCurrency
      ),
      isMinimumPayment: isMinimum,
    });
  }

  // Calculate debt allocation by country
  const debtAllocation = {
    baseCurrencyDebt: debtSnapshots
      .filter((d) => {
        const debt = debts.find((db) => db.id === d.debtId);
        return debt?.currency === baseCurrency;
      })
      .reduce((sum, d) => sum + d.allocatedPayment.baseAmount, 0),
    homeCountryDebt: debtSnapshots
      .filter((d) => {
        const debt = debts.find((db) => db.id === d.debtId);
        return debt?.currency !== baseCurrency;
      })
      .reduce((sum, d) => sum + d.allocatedPayment.baseAmount, 0),
    otherDebt: 0,
  };

  // Step 6: Create goal snapshots
  const goalsSnapshots: GoalSnapshot[] = goals.map((goal) => {
    const monthsRemaining = calculateMonthsRemaining(goal.targetDate);
    const amountNeeded =
      goal.targetAmount.baseAmount - goal.currentAmount.baseAmount;
    const monthlyContribution =
      monthsRemaining > 0 ? amountNeeded / monthsRemaining : 0;
    const progressPercent =
      goal.targetAmount.baseAmount > 0
        ? (goal.currentAmount.baseAmount / goal.targetAmount.baseAmount) * 100
        : 0;

    return {
      goalId: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      monthlyContribution: {
        amount: monthlyContribution,
        currency: baseCurrency,
        baseAmount: monthlyContribution,
        fxRate: 1,
        fxTimestamp: new Date(),
      },
      progressPercent,
    };
  });

  // Step 7: Create bucket structures with categories
  const buckets = {
    NEEDS: createBucket(
      "NEEDS",
      needsPlanned,
      baseCurrency,
      DEFAULT_CATEGORIES.NEEDS
    ),
    WANTS: createBucket(
      "WANTS",
      wantsPlanned,
      baseCurrency,
      DEFAULT_CATEGORIES.WANTS
    ),
    SAVINGS: {
      ...createBucket(
        "SAVINGS",
        savingsPlanned,
        baseCurrency,
        DEFAULT_CATEGORIES.SAVINGS
      ),
      savingsAllocation,
    },
    DEBT: {
      ...createBucket(
        "DEBT",
        debtPlanned,
        baseCurrency,
        DEFAULT_CATEGORIES.DEBT
      ),
      debtAllocation,
    },
  };

  // Step 8: Generate initial insights
  const insights: BudgetInsight[] = [];

  if (savingsPlanned < minSavings) {
    insights.push({
      id: uuidv4(),
      type: "warning",
      message: `Your savings allocation is below the recommended minimum of ${rules.minSavingsPercent}%`,
      bucket: "SAVINGS",
      createdAt: new Date(),
    });
  }

  if (debtPlanned > totalIncomeBase * 0.4) {
    insights.push({
      id: uuidv4(),
      type: "alert",
      message:
        "Debt payments exceed 40% of income. Consider debt consolidation.",
      bucket: "DEBT",
      createdAt: new Date(),
    });
  }

  // Create the plan
  const plan: MonthlyBudgetPlan = {
    id: uuidv4(),
    userId,
    month,
    baseCurrency,
    totalIncome,
    buckets,
    debtsSnapshot: debtSnapshots,
    goalsSnapshot: goalsSnapshots,
    insights,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Persist
  budgetPlans.set(getPlanKey(userId, month), plan);

  return plan;
}

/**
 * Create a budget bucket with categories
 */
function createBucket(
  type: BucketType,
  planned: number,
  baseCurrency: Currency,
  categoryNames: string[]
): BudgetBucket {
  const categories: Record<string, CategoryBudget> = {};
  const perCategory = planned / categoryNames.length;

  for (const name of categoryNames) {
    categories[name] = {
      name,
      planned: perCategory,
      spent: 0,
      remaining: perCategory,
      status: "UNDER",
    };
  }

  return {
    type,
    planned: {
      amount: planned,
      currency: baseCurrency,
      baseAmount: planned,
      fxRate: 1,
      fxTimestamp: new Date(),
    },
    spent: {
      amount: 0,
      currency: baseCurrency,
      baseAmount: 0,
      fxRate: 1,
      fxTimestamp: new Date(),
    },
    remaining: {
      amount: planned,
      currency: baseCurrency,
      baseAmount: planned,
      fxRate: 1,
      fxTimestamp: new Date(),
    },
    status: "UNDER",
    categories,
  };
}

/**
 * Calculate months remaining until target date
 */
function calculateMonthsRemaining(targetDate: string): number {
  const target = new Date(targetDate);
  const now = new Date();
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(0, months);
}

// ==================== Transaction Evaluation ====================

/**
 * 5.3 Transaction Evaluation
 * Log a transaction and update the budget plan
 */
export async function logTransaction(
  userId: string,
  month: string,
  amount: number,
  currency: Currency,
  baseCurrency: Currency,
  category: string,
  bucket: BucketType,
  description: string,
  date: Date = new Date(),
  tags: string[] = []
): Promise<{
  transaction: Transaction;
  updatedPlan: MonthlyBudgetPlan;
  insights: BudgetInsight[];
}> {
  // Get or create budget plan
  let plan = budgetPlans.get(getPlanKey(userId, month));
  if (!plan) {
    // Create a default plan if none exists
    plan = await generateBudgetPlan(userId, month, baseCurrency, [], [], []);
  }

  // Convert transaction to base currency
  const money = await createMoney(amount, currency, baseCurrency);

  // Create transaction
  const transaction: Transaction = {
    id: uuidv4(),
    userId,
    budgetPlanId: plan.id,
    type: amount < 0 ? "income" : "expense",
    money,
    category,
    bucket,
    description,
    date,
    isRecurring: false,
    tags,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Update bucket
  const bucketData = plan.buckets[bucket];
  bucketData.spent.baseAmount += money.baseAmount;
  bucketData.spent.amount += money.baseAmount;
  bucketData.remaining.baseAmount =
    bucketData.planned.baseAmount - bucketData.spent.baseAmount;
  bucketData.remaining.amount = bucketData.remaining.baseAmount;
  bucketData.status = calculateStatus(
    bucketData.spent.baseAmount,
    bucketData.planned.baseAmount
  );

  // Update category
  if (bucketData.categories[category]) {
    const cat = bucketData.categories[category];
    cat.spent += money.baseAmount;
    cat.remaining = cat.planned - cat.spent;
    cat.status = calculateStatus(cat.spent, cat.planned);
  } else {
    // Create new category if it doesn't exist
    bucketData.categories[category] = {
      name: category,
      planned: 0,
      spent: money.baseAmount,
      remaining: -money.baseAmount,
      status: "OVER",
    };
  }

  // Generate insights
  const newInsights: BudgetInsight[] = [];

  if (bucketData.status === "NEAR_LIMIT") {
    newInsights.push({
      id: uuidv4(),
      type: "warning",
      message: `You're approaching your ${bucket} budget limit (${Math.round(
        (bucketData.spent.baseAmount / bucketData.planned.baseAmount) * 100
      )}% used)`,
      bucket,
      createdAt: new Date(),
    });
  }

  if (bucketData.status === "OVER") {
    newInsights.push({
      id: uuidv4(),
      type: "alert",
      message: `You've exceeded your ${bucket} budget by ${Math.round(
        bucketData.spent.baseAmount - bucketData.planned.baseAmount
      )} ${baseCurrency}`,
      bucket,
      createdAt: new Date(),
    });
  }

  if (bucketData.categories[category]?.status === "OVER") {
    newInsights.push({
      id: uuidv4(),
      type: "alert",
      message: `Over budget in ${category}`,
      bucket,
      category,
      createdAt: new Date(),
    });
  }

  // Add insights to plan
  plan.insights.push(...newInsights);
  plan.updatedAt = new Date();

  // Persist
  transactions.set(transaction.id, transaction);
  budgetPlans.set(getPlanKey(userId, month), plan);

  return { transaction, updatedPlan: plan, insights: newInsights };
}

// ==================== Retrieval Functions ====================

/**
 * Get budget plan for a user and month
 */
export function getBudgetPlan(
  userId: string,
  month: string
): MonthlyBudgetPlan | undefined {
  return budgetPlans.get(getPlanKey(userId, month));
}

/**
 * Get all transactions for a budget plan
 */
export function getTransactions(budgetPlanId: string): Transaction[] {
  return Array.from(transactions.values()).filter(
    (t) => t.budgetPlanId === budgetPlanId
  );
}

/**
 * Get insights for a month
 */
export function getInsights(userId: string, month: string): BudgetInsight[] {
  const plan = budgetPlans.get(getPlanKey(userId, month));
  return plan?.insights || [];
}

/**
 * Get all budget plans for a user
 */
export function getUserBudgetPlans(userId: string): MonthlyBudgetPlan[] {
  return Array.from(budgetPlans.values()).filter((p) => p.userId === userId);
}

// ==================== Insight Generation ====================

/**
 * Generate insights for a budget plan
 */
export function generateInsights(plan: MonthlyBudgetPlan): BudgetInsight[] {
  const insights: BudgetInsight[] = [];

  // Check each bucket
  for (const [bucketType, bucket] of Object.entries(plan.buckets)) {
    const percentUsed =
      bucket.planned.baseAmount > 0
        ? (bucket.spent.baseAmount / bucket.planned.baseAmount) * 100
        : 0;

    if (percentUsed >= 100) {
      insights.push({
        id: uuidv4(),
        type: "alert",
        message: `${bucketType} budget exceeded by ${(
          percentUsed - 100
        ).toFixed(1)}%`,
        bucket: bucketType as BucketType,
        createdAt: new Date(),
      });
    } else if (percentUsed >= 80) {
      insights.push({
        id: uuidv4(),
        type: "warning",
        message: `${bucketType} budget is ${percentUsed.toFixed(
          1
        )}% used. Consider reducing spending.`,
        bucket: bucketType as BucketType,
        createdAt: new Date(),
      });
    }

    // Check categories
    for (const [catName, cat] of Object.entries(bucket.categories)) {
      if (cat.status === "OVER") {
        insights.push({
          id: uuidv4(),
          type: "alert",
          message: `Over budget in ${catName} by ${Math.abs(
            cat.remaining
          ).toFixed(2)} ${plan.baseCurrency}`,
          bucket: bucketType as BucketType,
          category: catName,
          createdAt: new Date(),
        });
      }
    }
  }

  // Savings insights
  if (plan.buckets.SAVINGS.spent.baseAmount < plan.buckets.SAVINGS.planned.baseAmount * 0.5) {
    const daysInMonth = new Date(
      parseInt(plan.month.split("-")[0]),
      parseInt(plan.month.split("-")[1]),
      0
    ).getDate();
    const currentDay = new Date().getDate();
    
    if (currentDay > daysInMonth / 2) {
      insights.push({
        id: uuidv4(),
        type: "info",
        message: "You're on track with savings. Keep it up!",
        bucket: "SAVINGS",
        createdAt: new Date(),
      });
    }
  }

  // Goal progress insights
  for (const goal of plan.goalsSnapshot) {
    if (goal.progressPercent >= 100) {
      insights.push({
        id: uuidv4(),
        type: "success",
        message: `🎉 You've reached your goal: ${goal.name}!`,
        createdAt: new Date(),
      });
    } else if (goal.progressPercent >= 75) {
      insights.push({
        id: uuidv4(),
        type: "info",
        message: `Almost there! ${goal.name} is ${goal.progressPercent.toFixed(
          1
        )}% complete.`,
        createdAt: new Date(),
      });
    }
  }

  return insights;
}
