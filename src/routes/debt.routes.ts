import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

const router = Router();

// POST /api/debts
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      userId = 'default',
      debtName,
      lenderName,
      totalAmount,
      currency = 'AED',
      exchangeRate = 1,
      convertedTotalAmount,
      remainingBalance,
      monthlyPayment,
      interestRate = 0,
      dueDate,
      debtType,
      status = 'ACTIVE',
      notes,
    } = req.body;

    if (!debtName || totalAmount == null || remainingBalance == null || monthlyPayment == null) {
      return res.status(400).json({ error: 'Missing required fields: debtName, totalAmount, remainingBalance, monthlyPayment' });
    }

    const debt = await prisma.debt.create({
      data: {
        userId,
        debtName,
        lenderName: lenderName ?? null,
        totalAmount: Number(totalAmount),
        currency,
        exchangeRate: Number(exchangeRate),
        convertedTotalAmount: Number(convertedTotalAmount ?? totalAmount),
        remainingBalance: Number(remainingBalance),
        monthlyPayment: Number(monthlyPayment),
        interestRate: Number(interestRate),
        dueDate: dueDate ?? null,
        debtType: debtType ?? null,
        status,
        notes: notes ?? null,
      },
    });
    return res.status(201).json(debt);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/debts
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId = 'default', status } = req.query as Record<string, string>;
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;

    const debts = await prisma.debt.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json(debts);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/debts/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.debt.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Debt not found' });

    const updated = await prisma.debt.update({ where: { id }, data: req.body });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/debts/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.debt.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Debt not found' });

    await prisma.debt.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/debts/:id/payment — record a payment reducing remainingBalance
router.patch('/:id/payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentAmount } = req.body as { paymentAmount: number };

    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: 'paymentAmount must be a positive number' });
    }

    const existing = await prisma.debt.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Debt not found' });

    const newBalance = Math.max(0, existing.remainingBalance - Number(paymentAmount));
    const newStatus = newBalance === 0 ? 'PAID' : existing.status;

    const updated = await prisma.debt.update({
      where: { id },
      data: { remainingBalance: newBalance, status: newStatus },
    });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
