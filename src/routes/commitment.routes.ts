import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

const router = Router();

// POST /api/commitments
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      userId = 'default',
      title,
      amount,
      currency = 'AED',
      exchangeRate = 1,
      convertedAmount,
      dueDate,
      category,
      priority = 'MEDIUM',
      recurringType = 'NONE',
      status = 'UPCOMING',
      notes,
    } = req.body;

    if (!title || amount == null || !dueDate) {
      return res.status(400).json({ error: 'Missing required fields: title, amount, dueDate' });
    }

    const commitment = await prisma.commitment.create({
      data: {
        userId,
        title,
        amount: Number(amount),
        currency,
        exchangeRate: Number(exchangeRate),
        convertedAmount: Number(convertedAmount ?? amount),
        dueDate,
        category: category ?? null,
        priority,
        recurringType,
        status,
        notes: notes ?? null,
      },
    });
    return res.status(201).json(commitment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/commitments
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId = 'default', status, priority } = req.query as Record<string, string>;
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const commitments = await prisma.commitment.findMany({
      where,
      orderBy: { dueDate: 'asc' },
    });
    return res.json(commitments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/commitments/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.commitment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Commitment not found' });

    const updated = await prisma.commitment.update({ where: { id }, data: req.body });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/commitments/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.commitment.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Commitment not found' });

    await prisma.commitment.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
