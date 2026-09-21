import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { parseEndDate, parseLocalDate, parseStartDate } from '../lib/dates.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { pushNewAlertsToUser } from '../ws/wsServer.js';

const router = Router();
router.use(requireAuth);

const dateSchema = z.preprocess((value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseLocalDate(value) ?? value;
  }
  return value;
}, z.date({ invalid_type_error: 'Transaction date must be a valid date' }));

const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  amount: z.coerce.number().positive('Amount must be greater than 0').finite(),
  currency: z.string().trim().min(1).max(8).optional(),
  date: dateSchema,
  categoryId: z.string().min(1, 'Category is required'),
  notes: z.string().trim().max(1000).nullish(),
});

// All fields optional for edits, but each still validated.
const updateSchema = createSchema.partial();

async function assertOwnedCategory(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  return Boolean(category);
}

function dateOnly(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function serialize(t: any) {
  return {
    id: t.id,
    title: t.title,
    amount: t.amount,
    currency: t.currency,
    date: dateOnly(t.date),
    categoryId: t.categoryId,
    category: t.category ? { id: t.category.id, name: t.category.name } : undefined,
    notes: t.notes ?? null,
  };
}

// List + search + filter.
router.get('/', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const { q, categoryId, dateFrom, dateTo, minAmount, maxAmount } = req.query;

    const where: Prisma.TransactionWhereInput = { userId };

    if (typeof q === 'string' && q.trim()) {
      where.OR = [
        { title: { contains: q.trim() } },
        { notes: { contains: q.trim() } },
      ];
    }
    if (typeof categoryId === 'string' && categoryId) where.categoryId = categoryId;

    const dateFilter: Prisma.DateTimeFilter = {};
    if (typeof dateFrom === 'string' && dateFrom) {
      const start = parseStartDate(dateFrom);
      if (!start) return res.status(400).json({ error: 'Invalid dateFrom.' });
      dateFilter.gte = start;
    }
    if (typeof dateTo === 'string' && dateTo) {
      const end = parseEndDate(dateTo);
      if (!end) return res.status(400).json({ error: 'Invalid dateTo.' });
      dateFilter.lte = end;
    }
    if (Object.keys(dateFilter).length) where.date = dateFilter;

    const amountFilter: Prisma.FloatFilter = {};
    if (typeof minAmount === 'string' && minAmount !== '') amountFilter.gte = Number(minAmount);
    if (typeof maxAmount === 'string' && maxAmount !== '') amountFilter.lte = Number(maxAmount);
    if (Object.keys(amountFilter).length) where.amount = amountFilter;

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { category: true },
    });
    res.json(transactions.map(serialize));
  } catch (err) {
    next(err);
  }
});

// Create.
router.post('/', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    if (!(await assertOwnedCategory(userId, parsed.data.categoryId))) {
      return res.status(400).json({ error: 'Invalid category.' });
    }
    const created = await prisma.transaction.create({
      data: {
        userId,
        title: parsed.data.title,
        amount: parsed.data.amount,
        currency: parsed.data.currency ?? config.currency,
        date: parsed.data.date,
        categoryId: parsed.data.categoryId,
        notes: parsed.data.notes ?? null,
      },
      include: { category: true },
    });
    await pushNewAlertsToUser(userId);
    res.status(201).json(serialize(created));
  } catch (err) {
    next(err);
  }
});

// Edit any field.
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const existing = await prisma.transaction.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Transaction not found.' });

    if (parsed.data.categoryId && !(await assertOwnedCategory(userId, parsed.data.categoryId))) {
      return res.status(400).json({ error: 'Invalid category.' });
    }

    const updated = await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        title: parsed.data.title,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        date: parsed.data.date,
        categoryId: parsed.data.categoryId,
        notes: parsed.data.notes === undefined ? undefined : parsed.data.notes ?? null,
      },
      include: { category: true },
    });
    await pushNewAlertsToUser(userId);
    res.json(serialize(updated));
  } catch (err) {
    next(err);
  }
});

// Delete.
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const existing = await prisma.transaction.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) return res.status(404).json({ error: 'Transaction not found.' });
    await prisma.transaction.delete({ where: { id: existing.id } });
    await pushNewAlertsToUser(userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
