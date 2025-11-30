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
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: expenses,
    meta: {
      total: expenses.length,
    },
  });
});

// GET /api/expenses/:id - Get single expense
router.get('/:id', (req: Request, res: Response) => {
  const expense = expenses.find((e) => e.id === req.params.id);
  
  if (!expense) {
    return res.status(404).json({
      success: false,
      error: { message: 'Expense not found' },
    });
  }

  res.json({
    success: true,
    data: expense,
  });
});

// POST /api/expenses - Create expense
router.post('/', (req: Request, res: Response) => {
  const { amount, category, description, date, currency = 'INR' } = req.body;

  if (!amount || !category) {
    return res.status(400).json({
      success: false,
      error: { message: 'Amount and category are required' },
    });
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
router.put('/:id', (req: Request, res: Response) => {
  const index = expenses.findIndex((e) => e.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: { message: 'Expense not found' },
    });
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
router.delete('/:id', (req: Request, res: Response) => {
  const index = expenses.findIndex((e) => e.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: { message: 'Expense not found' },
    });
  }

  const deleted = expenses.splice(index, 1)[0];

  res.json({
    success: true,
    data: deleted,
    message: 'Expense deleted successfully',
  });
});

export default router;
