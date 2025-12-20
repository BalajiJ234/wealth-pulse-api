/**
 * Budget Engine Models
 * Based on BUDGET_ENGINE_SPEC.md
 */

// ==================== Core Types ====================

export type Currency = string; // ISO 4217 codes (e.g., "AED", "INR", "USD")

export type IncomeType = 'salary' | 'freelance' | 'passive';
export type Recurrence = 'monthly' | 'weekly' | 'one-time';
export type GoalType =
  | 'emergency'
  | 'marriage'
  | 'retirement'
  | 'education'
  | 'large_purchase'
  | 'other';
export type DebtStrategy = 'snowball' | 'avalanche';
export type StrategyType = 'percentage' | 'zero-based' | 'custom';
export type BucketStatus = 'UNDER' | 'NEAR_LIMIT' | 'OVER';
export type BucketType = 'NEEDS' | 'WANTS' | 'SAVINGS' | 'DEBT';

// ==================== Domain Objects ====================

/**
 * 3.1 Money - Encapsulates monetary value with metadata
 */
export interface Money {
  amount: number;
  currency: Currency;
  baseAmount: number; // Converted to user's baseCurrency
  fxRate: number; // Conversion rate used
  fxTimestamp: Date; // When rate was applied
}

/**
 * 3.2 UserProfile - User-level settings
 */
export interface UserProfile {
  id: string;
  residencyCountry: string; // Where user currently lives
  homeCountry: string; // Country where long-term liabilities exist
  baseCurrency: Currency; // Selected currency for budgeting
  preferredViewCurrencies: Currency[]; // Currencies for reports
  isNRI: boolean; // Non-resident status flag
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 3.3 IncomeSource - Represents an income stream
 */
export interface IncomeSource {
  id: string;
  userId: string;
  name: string;
  type: IncomeType;
  money: Money;
  recurrence: Recurrence;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 3.4 Debt - Contains information about a liability
 */
export interface Debt {
  id: string;
  userId: string;
  name: string;
  currency: Currency;
  outstandingPrincipal: Money;
  interestRateAnnual: number; // Annual percentage rate
  minMonthlyPayment: Money;
  country: string; // Where debt is held
  priority?: number; // Manual order for Snowball strategy
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 3.5 Goal - Savings or investment target
 */
export interface Goal {
  id: string;
  userId: string;
  name: string;
  type: GoalType;
  targetAmount: Money;
  currentAmount: Money;
  targetDate: string; // YYYY-MM-DD
  country: string; // Where goal will be spent
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 3.6 FxRate - Foreign exchange rate record
 */
export interface FxRate {
  id: string;
  from: Currency;
  to: Currency;
  rate: number; // 1 unit of 'from' in 'to'
  timestamp: Date;
}

/**
 * 3.7 BudgetRuleSet - User-defined budgeting rules
 */
export interface BudgetRuleSet {
  id: string;
  userId: string;
  strategyType: StrategyType;
  buckets: {
    needs: number; // Percentage (0-100)
    wants: number;
    savings: number;
    debt: number;
  };
  minSavingsPercent: number; // Minimum savings fraction
  minDebtPercent: number; // Minimum debt payment fraction
  liabilityOriginPolicy: {
    home: number; // Weight for home country
    local: number; // Weight for local/residency
    global: number; // Weight for global
  };
  emergencyFundPolicy: number; // Desired months of expenses
  debtStrategy: DebtStrategy;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Budget Plan Structures ====================

/**
 * Category budget within a bucket
 */
export interface CategoryBudget {
  name: string;
  planned: number; // In base currency
  spent: number;
  remaining: number;
  status: BucketStatus;
}

/**
 * Savings allocation sub-buckets
 */
export interface SavingsAllocation {
  localEmergencyFund: number;
  homeCountryInvestments: number;
  globalInvestments: number;
}

/**
 * Debt allocation sub-buckets
 */
export interface DebtAllocation {
  baseCurrencyDebt: number;
  homeCountryDebt: number;
  otherDebt: number;
}

/**
 * Budget bucket structure
 */
export interface BudgetBucket {
  type: BucketType;
  planned: Money;
  spent: Money;
  remaining: Money;
  status: BucketStatus;
  categories: Record<string, CategoryBudget>;
  // Only for SAVINGS bucket
  savingsAllocation?: SavingsAllocation;
  // Only for DEBT bucket
  debtAllocation?: DebtAllocation;
}

/**
 * Budget insight/alert
 */
export interface BudgetInsight {
  id: string;
  type: 'warning' | 'alert' | 'info' | 'success';
  message: string;
  bucket?: BucketType;
  category?: string;
  createdAt: Date;
}

/**
 * Debt snapshot for a budget plan
 */
export interface DebtSnapshot {
  debtId: string;
  name: string;
  outstandingPrincipal: Money;
  allocatedPayment: Money;
  isMinimumPayment: boolean;
}

/**
 * Goal snapshot for a budget plan
 */
export interface GoalSnapshot {
  goalId: string;
  name: string;
  targetAmount: Money;
  currentAmount: Money;
  monthlyContribution: Money;
  progressPercent: number;
}

/**
 * Monthly Budget Plan - Main budget structure
 */
export interface MonthlyBudgetPlan {
  id: string;
  userId: string;
  month: string; // YYYY-MM format
  baseCurrency: Currency;
  totalIncome: Money;
  buckets: {
    NEEDS: BudgetBucket;
    WANTS: BudgetBucket;
    SAVINGS: BudgetBucket;
    DEBT: BudgetBucket;
  };
  debtsSnapshot: DebtSnapshot[];
  goalsSnapshot: GoalSnapshot[];
  insights: BudgetInsight[];
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Transaction ====================

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  userId: string;
  budgetPlanId: string;
  type: TransactionType;
  money: Money;
  category: string;
  bucket: BucketType;
  description: string;
  date: Date;
  isRecurring: boolean;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ==================== API Request/Response Types ====================

export interface CreateBudgetPlanRequest {
  userId: string;
  month: string; // YYYY-MM
}

export interface CreateBudgetPlanResponse {
  success: boolean;
  plan?: MonthlyBudgetPlan;
  error?: string;
}

export interface LogTransactionRequest {
  userId: string;
  amount: number;
  currency: Currency;
  category: string;
  bucket: BucketType;
  description: string;
  date?: string;
  tags?: string[];
}

export interface LogTransactionResponse {
  success: boolean;
  transaction?: Transaction;
  updatedPlan?: MonthlyBudgetPlan;
  insights?: BudgetInsight[];
  error?: string;
}

export interface GetBudgetPlanResponse {
  success: boolean;
  plan?: MonthlyBudgetPlan;
  error?: string;
}

export interface GetInsightsResponse {
  success: boolean;
  insights?: BudgetInsight[];
  error?: string;
}

export interface GetFxRatesResponse {
  success: boolean;
  rates?: FxRate[];
  error?: string;
}

// ==================== Default Values ====================

export const DEFAULT_BUDGET_RULES: Omit<
  BudgetRuleSet,
  'id' | 'userId' | 'createdAt' | 'updatedAt'
> = {
  strategyType: 'percentage',
  buckets: {
    needs: 50,
    wants: 20,
    savings: 15,
    debt: 15,
  },
  minSavingsPercent: 10,
  minDebtPercent: 5,
  liabilityOriginPolicy: {
    home: 0.5,
    local: 0.4,
    global: 0.1,
  },
  emergencyFundPolicy: 6, // 6 months of expenses
  debtStrategy: 'avalanche',
};

export const DEFAULT_CATEGORIES: Record<BucketType, string[]> = {
  NEEDS: ['rent', 'utilities', 'groceries', 'transport', 'insurance', 'healthcare'],
  WANTS: ['dining_out', 'entertainment', 'shopping', 'subscriptions', 'hobbies', 'travel'],
  SAVINGS: ['emergency_fund', 'investments', 'retirement', 'goals'],
  DEBT: ['credit_card', 'home_loan', 'personal_loan', 'car_loan', 'other_debt'],
};
