/**
 * Budget Routes
 * API endpoints for the Budget Engine
 */

import { Router, Request, Response } from "express";
import {
  generateBudgetPlan,
  logTransaction,
  getBudgetPlan,
  getInsights,
  getUserBudgetPlans,
  generateInsights,
} from "../services/budget.service";
import { getAllCachedRates } from "../services/fx.service";
import {
  CreateBudgetPlanRequest,
  LogTransactionRequest,
  IncomeSource,
  Debt,
  Goal,
  BudgetRuleSet,
} from "../models/budget.models";

const router = Router();

/**
 * POST /api/budget/plan
 * Create or regenerate a budget plan for a given month
 */
router.post("/plan", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      userId,
      month,
      baseCurrency = "AED",
      incomes = [],
      debts = [],
      goals = [],
      rules,
    } = req.body as CreateBudgetPlanRequest & {
      baseCurrency?: string;
      incomes?: IncomeSource[];
      debts?: Debt[];
      goals?: Goal[];
      rules?: BudgetRuleSet;
    };

    if (!userId || !month) {
      res.status(400).json({
        success: false,
        error: "userId and month are required",
      });
      return;
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({
        success: false,
        error: "month must be in YYYY-MM format",
      });
      return;
    }

    const plan = await generateBudgetPlan(
      userId,
      month,
      baseCurrency,
      incomes,
      debts,
      goals,
      rules
    );

    res.status(201).json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Error creating budget plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create budget plan",
    });
  }
});

/**
 * GET /api/budget/:month
 * Retrieve the current budget plan and execution status
 */
router.get("/:month", async (req: Request, res: Response): Promise<void> => {
  try {
    const { month } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: "userId query parameter is required",
      });
      return;
    }

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({
        success: false,
        error: "month must be in YYYY-MM format",
      });
      return;
    }

    const plan = getBudgetPlan(userId, month);

    if (!plan) {
      res.status(404).json({
        success: false,
        error: "Budget plan not found for this month",
      });
      return;
    }

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("Error retrieving budget plan:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve budget plan",
    });
  }
});

/**
 * GET /api/budget/user/:userId
 * Get all budget plans for a user
 */
router.get(
  "/user/:userId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      const plans = getUserBudgetPlans(userId);

      res.json({
        success: true,
        plans,
        count: plans.length,
      });
    } catch (error) {
      console.error("Error retrieving user budget plans:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve budget plans",
      });
    }
  }
);

/**
 * POST /api/budget/transactions
 * Log a transaction and get updated budget plan
 */
router.post(
  "/transactions",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        userId,
        amount,
        currency = "AED",
        category,
        bucket,
        description,
        date,
        tags,
      } = req.body as LogTransactionRequest & { date?: string };

      if (!userId || amount === undefined || !category || !bucket) {
        res.status(400).json({
          success: false,
          error: "userId, amount, category, and bucket are required",
        });
        return;
      }

      // Validate bucket type
      const validBuckets = ["NEEDS", "WANTS", "SAVINGS", "DEBT"];
      if (!validBuckets.includes(bucket)) {
        res.status(400).json({
          success: false,
          error: `bucket must be one of: ${validBuckets.join(", ")}`,
        });
        return;
      }

      // Determine month from date
      const transactionDate = date ? new Date(date) : new Date();
      const month = `${transactionDate.getFullYear()}-${String(
        transactionDate.getMonth() + 1
      ).padStart(2, "0")}`;

      const result = await logTransaction(
        userId,
        month,
        amount,
        currency,
        currency, // Use transaction currency as base for now
        category,
        bucket,
        description,
        transactionDate,
        tags
      );

      res.status(201).json({
        success: true,
        transaction: result.transaction,
        updatedPlan: result.updatedPlan,
        insights: result.insights,
      });
    } catch (error) {
      console.error("Error logging transaction:", error);
      res.status(500).json({
        success: false,
        error: "Failed to log transaction",
      });
    }
  }
);

/**
 * GET /api/budget/insights/:month
 * List insights for a specific month
 */
router.get(
  "/insights/:month",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { month } = req.params;
      const userId = req.query.userId as string;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: "userId query parameter is required",
        });
        return;
      }

      // Validate month format
      if (!/^\d{4}-\d{2}$/.test(month)) {
        res.status(400).json({
          success: false,
          error: "month must be in YYYY-MM format",
        });
        return;
      }

      const insights = getInsights(userId, month);

      res.json({
        success: true,
        insights,
        count: insights.length,
      });
    } catch (error) {
      console.error("Error retrieving insights:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve insights",
      });
    }
  }
);

/**
 * POST /api/budget/insights/generate
 * Generate fresh insights for a budget plan
 */
router.post(
  "/insights/generate",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, month } = req.body;

      if (!userId || !month) {
        res.status(400).json({
          success: false,
          error: "userId and month are required",
        });
        return;
      }

      const plan = getBudgetPlan(userId, month);

      if (!plan) {
        res.status(404).json({
          success: false,
          error: "Budget plan not found",
        });
        return;
      }

      const insights = generateInsights(plan);

      res.json({
        success: true,
        insights,
        count: insights.length,
      });
    } catch (error) {
      console.error("Error generating insights:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate insights",
      });
    }
  }
);

/**
 * GET /api/budget/fx-rates
 * Provide current FX rates used for normalisation
 */
router.get("/fx-rates", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rates = getAllCachedRates();

    res.json({
      success: true,
      rates,
      count: rates.length,
    });
  } catch (error) {
    console.error("Error retrieving FX rates:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve FX rates",
    });
  }
});

export default router;
