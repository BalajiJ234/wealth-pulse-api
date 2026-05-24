import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

const router = Router();

const TODAY = () => new Date().toISOString().slice(0, 10);

// GET /api/currency-rates/latest  — last known rate for a pair
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const { from = 'AED', to = 'INR' } = req.query as Record<string, string>;
    const rate = await prisma.currencyRate.findFirst({
      where: { fromCurrency: from.toUpperCase(), toCurrency: to.toUpperCase() },
      orderBy: { rateDate: 'desc' },
    });
    if (!rate) return res.status(404).json({ error: 'No rate found for this pair' });
    return res.json(rate);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/currency-rates/manual  — store a manually entered rate
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const { fromCurrency, toCurrency, rate, rateDate } = req.body as {
      fromCurrency: string;
      toCurrency: string;
      rate: number;
      rateDate?: string;
    };

    if (!fromCurrency || !toCurrency || rate == null) {
      return res.status(400).json({ error: 'fromCurrency, toCurrency, rate are required' });
    }

    const stored = await prisma.currencyRate.upsert({
      where: {
        fromCurrency_toCurrency_rateDate: {
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase(),
          rateDate: rateDate ?? TODAY(),
        },
      },
      update: { rate: Number(rate), source: 'manual' },
      create: {
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        rate: Number(rate),
        source: 'manual',
        rateDate: rateDate ?? TODAY(),
      },
    });
    return res.status(201).json(stored);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/currency/convert
router.post('/convert', async (req: Request, res: Response) => {
  try {
    const { amount, from, to } = req.body as { amount: number; from: string; to: string };
    if (amount == null || !from || !to) {
      return res.status(400).json({ error: 'amount, from, to are required' });
    }
    if (from.toUpperCase() === to.toUpperCase()) {
      return res.json({ amount, from, to, converted: amount, rate: 1 });
    }

    const rateRow = await prisma.currencyRate.findFirst({
      where: { fromCurrency: from.toUpperCase(), toCurrency: to.toUpperCase() },
      orderBy: { rateDate: 'desc' },
    });

    if (!rateRow) {
      return res
        .status(404)
        .json({
          error: `No rate found for ${from}→${to}. Store one via POST /api/currency-rates/manual`,
        });
    }

    return res.json({
      amount: Number(amount),
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate: rateRow.rate,
      converted: Number(amount) * rateRow.rate,
      rateDate: rateRow.rateDate,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
