import { Router, Request, Response } from 'express';

const router = Router();

// Temporary in-memory storage (will be replaced with PostgreSQL in Week 2)
interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

const expenses: Expense[] = [];

// GET /api/expenses - Get all expenses
router.get('/', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: expenses,
    meta: {
      total: expenses.length,
    },
  });
});

// GET /api/expenses/:id - Get single expense
router.get('/:id', (req: Request, res: Response): void => {
  const expense = expenses.find((e) => e.id === req.params.id);

  if (!expense) {
    res.status(404).json({
      success: false,
      error: { message: 'Expense not found' },
    });
    return;
  }

  res.json({
    success: true,
    data: expense,
  });
});

// POST /api/expenses - Create expense
router.post('/', (req: Request, res: Response): void => {
  const { amount, category, description, date, currency = 'INR' } = req.body;

  if (!amount || !category) {
    res.status(400).json({
      success: false,
      error: { message: 'Amount and category are required' },
    });
    return;
  }

  const expense: Expense = {
    id: `exp_${Date.now()}`,
    amount: parseFloat(amount),
    category,
    description: description || '',
    date: date || new Date().toISOString().split('T')[0],
    currency,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  expenses.push(expense);

  res.status(201).json({
    success: true,
    data: expense,
  });
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', (req: Request, res: Response): void => {
  const index = expenses.findIndex((e) => e.id === req.params.id);

  if (index === -1) {
    res.status(404).json({
      success: false,
      error: { message: 'Expense not found' },
    });
    return;
  }

  const { amount, category, description, date, currency } = req.body;

  expenses[index] = {
    ...expenses[index],
    ...(amount && { amount: parseFloat(amount) }),
    ...(category && { category }),
    ...(description !== undefined && { description }),
    ...(date && { date }),
    ...(currency && { currency }),
    updatedAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: expenses[index],
  });
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', (req: Request, res: Response): void => {
  const index = expenses.findIndex((e) => e.id === req.params.id);

  if (index === -1) {
    res.status(404).json({
      success: false,
      error: { message: 'Expense not found' },
    });
    return;
  }

  const deleted = expenses.splice(index, 1)[0];

  res.json({
    success: true,
    data: deleted,
    message: 'Expense deleted successfully',
  });
});

// POST /api/expenses/bulk - Bulk import expenses
router.post('/bulk', (req: Request, res: Response): void => {
  const { expenses: bulkExpenses } = req.body;

  if (!Array.isArray(bulkExpenses)) {
    res.status(400).json({
      success: false,
      error: { message: 'Expenses must be an array' },
    });
    return;
  }

  if (bulkExpenses.length === 0) {
    res.status(400).json({
      success: false,
      error: { message: 'Expenses array cannot be empty' },
    });
    return;
  }

  const results = {
    success: [] as Expense[],
    failed: [] as { index: number; data: any; reason: string }[],
  };

  bulkExpenses.forEach((expenseData, index) => {
    try {
      const { amount, category, description, date, currency = 'AED', id } = expenseData;

      if (!amount || !category) {
        results.failed.push({
          index,
          data: expenseData,
          reason: 'Amount and category are required',
        });
        return;
      }

      // Check if expense with same ID already exists
      if (id && expenses.find((e) => e.id === id)) {
        results.failed.push({
          index,
          data: expenseData,
          reason: 'Expense with this ID already exists',
        });
        return;
      }

      const expense: Expense = {
        id: id || `exp_${Date.now()}_${index}`,
        amount: parseFloat(amount),
        category,
        description: description || '',
        date: date || new Date().toISOString().split('T')[0],
        currency,
        createdAt: expenseData.createdAt || new Date().toISOString(),
        updatedAt: expenseData.updatedAt || new Date().toISOString(),
      };

      expenses.push(expense);
      results.success.push(expense);
    } catch (error) {
      results.failed.push({
        index,
        data: expenseData,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  res.status(results.success.length > 0 ? 201 : 400).json({
    success: results.failed.length === 0,
    data: {
      imported: results.success.length,
      failed: results.failed.length,
      total: bulkExpenses.length,
      expenses: results.success,
      errors: results.failed,
    },
    message: `Successfully imported ${results.success.length} out of ${bulkExpenses.length} expenses`,
  });
});

// POST /api/expenses/seed - Seed database with sample data (dev only)
router.post('/seed', (req: Request, res: Response): void => {
  const { clear = false } = req.body;

  if (clear) {
    expenses.length = 0;
  }

  const sampleExpenses: Expense[] = req.body.expenses || [];

  if (sampleExpenses.length === 0) {
    res.status(400).json({
      success: false,
      error: { message: 'No seed data provided' },
    });
    return;
  }

  sampleExpenses.forEach((exp) => {
    expenses.push(exp);
  });

  res.json({
    success: true,
    data: {
      seeded: sampleExpenses.length,
      total: expenses.length,
    },
    message: `Database seeded with ${sampleExpenses.length} expenses`,
  });
});

export default router;
