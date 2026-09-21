import { prisma } from '../prisma.js';

/** Returns the "YYYY-MM" key for a date (defaults to now, local time). */
export function monthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Half-open [start, end) date range for a "YYYY-MM" month key. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { start, end };
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export function isValidMonth(month: string): boolean {
  return MONTH_RE.test(month);
}

export interface MonthSummary {
  month: string;
  currency: string;
  hasBudget: boolean;
  budget: number | null;
  spent: number;
  remaining: number | null;
  usagePercent: number | null;
}

/** Total spent by a user within a given month. */
export async function getSpentForMonth(userId: string, month: string): Promise<number> {
  const { start, end } = monthRange(month);
  const result = await prisma.transaction.aggregate({
    where: { userId, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

/** Full month summary used by the dashboard and alert logic. */
export async function getMonthSummary(
  userId: string,
  month: string,
  currency: string
): Promise<MonthSummary> {
  const [budget, spent] = await Promise.all([
    prisma.budget.findUnique({ where: { userId_month: { userId, month } } }),
    getSpentForMonth(userId, month),
  ]);

  if (!budget) {
    return {
      month,
      currency,
      hasBudget: false,
      budget: null,
      spent,
      remaining: null,
      usagePercent: null,
    };
  }

  const usagePercent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  return {
    month,
    currency,
    hasBudget: true,
    budget: budget.amount,
    spent,
    remaining: budget.amount - spent,
    usagePercent,
  };
}
