import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

const router = Router();

// POST /api/transactions
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      userId = 'default',
      type,
      title,
      amount,
      currency = 'AED',
      exchangeRate = 1,
      convertedAmount,
      baseCurrency = 'AED',
      category,
      paymentMethod,
      transactionDate,
      isRecurring = false,
      notes,
    } = req.body;

    if (!type || !title || amount == null || !category || !transactionDate) {
      return res.status(400).json({ error: 'Missing required fields: type, title, amount, category, transactionDate' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type,
        title,
        amount: Number(amount),
        currency,
        exchangeRate: Number(exchangeRate),
        convertedAmount: Number(convertedAmount ?? amount),
        baseCurrency,
        category,
        paymentMethod: paymentMethod ?? null,
        transactionDate,
        isRecurring: Boolean(isRecurring),
        notes: notes ?? null,
      },
    });
    return res.status(201).json(transaction);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/transactions
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId = 'default', type, currency, from, to, category } = req.query as Record<string, string>;

    const where: Record<string, unknown> = { userId };
    if (type) where.type = type;
    if (currency) where.currency = currency;
    if (category) where.category = category;
    if (from || to) {
      where.transactionDate = {};
      if (from) (where.transactionDate as Record<string, string>).gte = from;
      if (to) (where.transactionDate as Record<string, string>).lte = to;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
    });
    return res.json(transactions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/transactions/monthly-summary
router.get('/monthly-summary', async (req: Request, res: Response) => {
  try {
    const { userId = 'default', month } = req.query as Record<string, string>;
    const targetMonth = month ?? new Date().toISOString().slice(0, 7); // YYYY-MM

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        transactionDate: { startsWith: targetMonth },
      },
    });

    const summary = {
      month: targetMonth,
      totalIncome: 0,
      totalExpenses: 0,
      totalDebtPayments: 0,
      totalSavings: 0,
      netSurplus: 0,
      count: transactions.length,
      byCategory: {} as Record<string, number>,
    };

    for (const t of transactions) {
      const amt = t.convertedAmount;
      if (t.type === 'INCOME') summary.totalIncome += amt;
      else if (t.type === 'EXPENSE') summary.totalExpenses += amt;
      else if (t.type === 'DEBT_PAYMENT') summary.totalDebtPayments += amt;
      else if (t.type === 'SAVING') summary.totalSavings += amt;

      summary.byCategory[t.category] = (summary.byCategory[t.category] ?? 0) + amt;
    }
    summary.netSurplus = summary.totalIncome - summary.totalExpenses - summary.totalDebtPayments;

    return res.json(summary);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    const updated = await prisma.transaction.update({
      where: { id },
      data: req.body,
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    await prisma.transaction.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/transactions/bulk
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { transactions } = req.body as { transactions: unknown[] };
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'transactions array is required' });
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i] as Record<string, unknown>;
      if (!t.type || !t.title || t.amount == null || !t.category || !t.transactionDate) {
        errors.push({ index: i, error: 'Missing required fields' });
        continue;
      }
      try {
        const result = await prisma.transaction.create({
          data: {
            userId: (t.userId as string) ?? 'default',
            type: t.type as string,
            title: t.title as string,
            amount: Number(t.amount),
            currency: (t.currency as string) ?? 'AED',
            exchangeRate: Number(t.exchangeRate ?? 1),
            convertedAmount: Number(t.convertedAmount ?? t.amount),
            baseCurrency: (t.baseCurrency as string) ?? 'AED',
            category: t.category as string,
            paymentMethod: (t.paymentMethod as string) ?? null,
            transactionDate: t.transactionDate as string,
            isRecurring: Boolean(t.isRecurring ?? false),
            notes: (t.notes as string) ?? null,
          },
        });
        created.push(result);
      } catch (e) {
        errors.push({ index: i, error: String(e) });
      }
    }

    return res.status(207).json({ created: created.length, errors, data: created });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
