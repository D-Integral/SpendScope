import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { getMonthSummary, isValidMonth, monthKey } from '../services/budgetService.js';
import { pushNewAlertsToUser } from '../ws/wsServer.js';

const router = Router();
router.use(requireAuth);

const amountSchema = z.object({
  amount: z.coerce.number().positive('Budget must be greater than 0').finite(),
});

// Month summary: spent, budget, remaining, usage %, and hasBudget flag.
router.get('/:month', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const month = req.params.month;
    if (!isValidMonth(month)) {
      return res.status(400).json({ error: 'Month must be in YYYY-MM format.' });
    }
    const summary = await getMonthSummary(userId, month, config.currency);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// Set / update the budget for a month.
router.put('/:month', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const month = req.params.month;
    if (!isValidMonth(month)) {
      return res.status(400).json({ error: 'Month must be in YYYY-MM format.' });
    }
    const parsed = amountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    await prisma.budget.upsert({
      where: { userId_month: { userId, month } },
      update: { amount: parsed.data.amount },
      create: { userId, month, amount: parsed.data.amount },
    });

    // Setting/raising a budget can immediately cross thresholds for the current
    // month given existing spend — evaluate and push alerts.
    if (month === monthKey()) await pushNewAlertsToUser(userId);

    const summary = await getMonthSummary(userId, month, config.currency);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// Remove a month's budget (UI returns to the "No budget set" state).
router.delete('/:month', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const month = req.params.month;
    if (!isValidMonth(month)) {
      return res.status(400).json({ error: 'Month must be in YYYY-MM format.' });
    }
    await prisma.budget.deleteMany({ where: { userId, month } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
