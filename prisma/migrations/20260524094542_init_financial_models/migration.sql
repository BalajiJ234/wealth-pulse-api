-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "exchangeRate" REAL NOT NULL DEFAULT 1,
    "convertedAmount" REAL NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'AED',
    "category" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "transactionDate" TEXT NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "debtName" TEXT NOT NULL,
    "lenderName" TEXT,
    "totalAmount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "exchangeRate" REAL NOT NULL DEFAULT 1,
    "convertedTotalAmount" REAL NOT NULL,
    "remainingBalance" REAL NOT NULL,
    "monthlyPayment" REAL NOT NULL,
    "interestRate" REAL NOT NULL DEFAULT 0,
    "dueDate" TEXT,
    "debtType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "exchangeRate" REAL NOT NULL DEFAULT 1,
    "convertedAmount" REAL NOT NULL,
    "dueDate" TEXT NOT NULL,
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "recurringType" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api',
    "rateDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FinancialSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "month" TEXT NOT NULL,
    "totalIncome" REAL NOT NULL,
    "totalExpenses" REAL NOT NULL,
    "totalDebtPayments" REAL NOT NULL,
    "totalSavings" REAL NOT NULL,
    "netSurplus" REAL NOT NULL,
    "healthScore" REAL NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'AED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmergencyFund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "currentBalance" REAL NOT NULL DEFAULT 0,
    "targetMonths" INTEGER NOT NULL DEFAULT 6,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "monthlyEssentials" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PurchaseGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "targetAmount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "savedAmount" REAL NOT NULL DEFAULT 0,
    "targetDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BudgetCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "monthlyLimit" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "color" TEXT,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_fromCurrency_toCurrency_rateDate_key" ON "CurrencyRate"("fromCurrency", "toCurrency", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialSnapshot_userId_month_key" ON "FinancialSnapshot"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyFund_userId_key" ON "EmergencyFund"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCategory_userId_name_key" ON "BudgetCategory"("userId", "name");
