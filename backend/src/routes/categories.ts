import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { currentUserId, requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const nameSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(60) });

// List categories (with transaction counts, for delete UX).
router.get('/', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { transactions: true } } },
    });
    res.json(
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        isDefault: c.isDefault,
        transactionCount: c._count.transactions,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// Create a category (name unique per user).
router.post('/', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const parsed = nameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const existing = await prisma.category.findUnique({
      where: { userId_name: { userId, name: parsed.data.name } },
    });
    if (existing) {
      return res.status(409).json({ error: 'A category with this name already exists.' });
    }
    const category = await prisma.category.create({
      data: { userId, name: parsed.data.name },
    });
    res.status(201).json({ id: category.id, name: category.name, isDefault: category.isDefault });
  } catch (err) {
    next(err);
  }
});

// Rename a category.
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const parsed = nameSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    }
    const category = await prisma.category.findFirst({ where: { id: req.params.id, userId } });
    if (!category) return res.status(404).json({ error: 'Category not found.' });

    const clash = await prisma.category.findUnique({
      where: { userId_name: { userId, name: parsed.data.name } },
    });
    if (clash && clash.id !== category.id) {
      return res.status(409).json({ error: 'A category with this name already exists.' });
    }
    const updated = await prisma.category.update({
      where: { id: category.id },
      data: { name: parsed.data.name },
    });
    res.json({ id: updated.id, name: updated.name, isDefault: updated.isDefault });
  } catch (err) {
    next(err);
  }
});

// Delete a category.
// Deletion policy: BLOCK deletion when transactions exist (documented in README).
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, userId },
      include: { _count: { select: { transactions: true } } },
    });
    if (!category) return res.status(404).json({ error: 'Category not found.' });
    if (category._count.transactions > 0) {
      return res.status(409).json({
        error: 'Category is not empty.',
        message: `Reassign or delete its ${category._count.transactions} transaction(s) first.`,
      });
    }
    await prisma.category.delete({ where: { id: category.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
