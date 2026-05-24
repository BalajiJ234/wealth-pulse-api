import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import {
  calcHealthScore,
  calcPurchaseDecision,
  simulateFutureImpact,
} from '../services/financial.service.js';

const router = Router();

// ─── Helper: get this month's summary ────────────────────────────────────────
async function getMonthlySummary(userId: string, month: string) {
  const txns = await prisma.transaction.findMany({
    where: { userId, transactionDate: { startsWith: month } },
  });
  const summary = {
    totalIncome: 0,
    totalExpenses: 0,
    totalDebtPayments: 0,
    totalSavings: 0,
    netSurplus: 0,
  };
  for (const t of txns) {
    const amt = t.convertedAmount;
    if (t.type === 'INCOME') summary.totalIncome += amt;
    else if (t.type === 'EXPENSE') summary.totalExpenses += amt;
    else if (t.type === 'DEBT_PAYMENT') summary.totalDebtPayments += amt;
    else if (t.type === 'SAVING') summary.totalSavings += amt;
  }
  summary.netSurplus = summary.totalIncome - summary.totalExpenses - summary.totalDebtPayments;
  return summary;
}

// ─── GET /api/dashboard/summary ──────────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { userId = 'default' } = req.query as Record<string, string>;
    const month = new Date().toISOString().slice(0, 7);

    const [monthly, activeDebts, upcomingCommitments, emergencyFund] = await Promise.all([
      getMonthlySummary(userId, month),
      prisma.debt.findMany({ where: { userId, status: 'ACTIVE' } }),
      prisma.commitment.findMany({ where: { userId, status: 'UPCOMING' } }),
      prisma.emergencyFund.findUnique({ where: { userId } }),
    ]);

    const totalActiveDebt = activeDebts.reduce((s, d) => s + d.remainingBalance, 0);
    const upcomingTotal = upcomingCommitments.reduce((s, c) => s + c.convertedAmount, 0);

    return res.json({
      month,
      ...monthly,
      totalActiveDebt,
      activeDebtCount: activeDebts.length,
      upcomingCommitmentsTotal: upcomingTotal,
      upcomingCommitmentsCount: upcomingCommitments.length,
      emergencyFundBalance: emergencyFund?.currentBalance ?? 0,
      emergencyFundMonths:
        emergencyFund && emergencyFund.monthlyEssentials > 0
          ? (emergencyFund.currentBalance / emergencyFund.monthlyEssentials).toFixed(1)
          : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/dashboard/financial-health ─────────────────────────────────────
router.get('/financial-health', async (req: Request, res: Response) => {
  try {
    const { userId = 'default' } = req.query as Record<string, string>;
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Last 3 months surpluses for trend
    const months = [-2, -1, 0].map((offset) => {
      const d = new Date();
      d.setMonth(d.getMonth() + offset);
      return d.toISOString().slice(0, 7);
    });
    const [m1, m2, m3, activeDebts, upcomingHigh, efund] = await Promise.all([
      getMonthlySummary(userId, months[0]),
      getMonthlySummary(userId, months[1]),
      getMonthlySummary(userId, months[2]),
      prisma.debt.findMany({ where: { userId, status: 'ACTIVE' } }),
      prisma.commitment.findMany({ where: { userId, status: 'UPCOMING', priority: 'HIGH' } }),
      prisma.emergencyFund.findUnique({ where: { userId } }),
    ]);

    const currentSummary = m3;
    const totalActiveDebt = activeDebts.reduce((s, d) => s + d.remainingBalance, 0);
    const upcomingHighTotal = upcomingHigh.reduce((s, c) => s + c.convertedAmount, 0);
    const efMonths =
      efund && efund.monthlyEssentials > 0 ? efund.currentBalance / efund.monthlyEssentials : 0;

    const score = calcHealthScore({
      income: currentSummary.totalIncome,
      expenses: currentSummary.totalExpenses,
      debtPayments: currentSummary.totalDebtPayments,
      savings: currentSummary.totalSavings,
      totalActiveDebt,
      emergencyFundMonths: efMonths,
      upcomingHighPriorityAmount: upcomingHighTotal,
      lastThreeMonthsSurpluses: [m1.netSurplus, m2.netSurplus, m3.netSurplus],
    });

    const dti =
      currentSummary.totalIncome > 0
        ? currentSummary.totalDebtPayments / currentSummary.totalIncome
        : 0;
    const savingsRate =
      currentSummary.totalIncome > 0 ? currentSummary.totalSavings / currentSummary.totalIncome : 0;

    return res.json({
      score,
      grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
      month: currentMonth,
      metrics: {
        dti: parseFloat((dti * 100).toFixed(1)),
        savingsRate: parseFloat((savingsRate * 100).toFixed(1)),
        emergencyFundMonths: parseFloat(efMonths.toFixed(1)),
        netSurplus: currentSummary.netSurplus,
        activeDebtCount: activeDebts.length,
      },
      trend: [
        { month: months[0], surplus: m1.netSurplus },
        { month: months[1], surplus: m2.netSurplus },
        { month: months[2], surplus: m3.netSurplus },
      ],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/dashboard/purchase-decision ───────────────────────────────────
router.get('/purchase-decision', async (req: Request, res: Response) => {
  try {
    const {
      userId = 'default',
      itemPrice = '5000',
      emiMonths = '12',
    } = req.query as Record<string, string>;

    const price = Number(itemPrice);
    const months = Number(emiMonths);
    const monthlyEmi = months > 0 ? price / months : price;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const [monthly, activeDebts, upcomingHigh, efund] = await Promise.all([
      getMonthlySummary(userId, currentMonth),
      prisma.debt.findMany({ where: { userId, status: 'ACTIVE' } }),
      prisma.commitment.findMany({ where: { userId, status: 'UPCOMING', priority: 'HIGH' } }),
      prisma.emergencyFund.findUnique({ where: { userId } }),
    ]);

    const totalActiveDebt = activeDebts.reduce((s, d) => s + d.remainingBalance, 0);
    const upcomingHighTotal = upcomingHigh.reduce((s, c) => s + c.convertedAmount, 0);

    const result = calcPurchaseDecision({
      income: monthly.totalIncome,
      expenses: monthly.totalExpenses,
      debtPayments: monthly.totalDebtPayments,
      totalActiveDebt,
      emergencyFundBalance: efund?.currentBalance ?? 0,
      monthlyEssentials: efund?.monthlyEssentials ?? monthly.totalExpenses * 0.6,
      upcomingHighPriorityTotal: upcomingHighTotal,
      itemPrice: price,
      itemEmi: monthlyEmi,
      emiMonths: months,
      hasActiveDebt: activeDebts.length > 0,
    });

    return res.json({
      ...result,
      input: { itemPrice: price, emiMonths: months, monthlyEmi },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/dashboard/future-impact ────────────────────────────────────────
router.get('/future-impact', async (req: Request, res: Response) => {
  try {
    const {
      userId = 'default',
      purchaseAmount = '5000',
      emiMonths = '12',
      projectionMonths = '24',
    } = req.query as Record<string, string>;

    const price = Number(purchaseAmount);
    const emiMo = Number(emiMonths);
    const projMo = Number(projectionMonths);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const [monthly, efund] = await Promise.all([
      getMonthlySummary(userId, currentMonth),
      prisma.emergencyFund.findUnique({ where: { userId } }),
    ]);

    const projection = simulateFutureImpact({
      currentSavings: efund?.currentBalance ?? 0,
      monthlySurplus: monthly.netSurplus,
      oneTimePurchase: emiMo === 0 ? price : 0,
      monthlyEmi: emiMo > 0 ? price / emiMo : 0,
      emiMonths: emiMo,
      projectionMonths: projMo,
    });

    return res.json({ projection, baseSurplus: monthly.netSurplus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/dashboard/monthly-snapshot ─────────────────────────────────────
router.get('/monthly-snapshot', async (req: Request, res: Response) => {
  try {
    const { userId = 'default', months: monthsParam = '6' } = req.query as Record<string, string>;
    const count = Math.min(Number(monthsParam), 12);

    const monthList = Array.from({ length: count }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (count - 1 - i));
      return d.toISOString().slice(0, 7);
    });

    const snapshots = await Promise.all(
      monthList.map(async (month) => {
        const s = await getMonthlySummary(userId, month);
        return { month, ...s };
      })
    );

    return res.json(snapshots);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
