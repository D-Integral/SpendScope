import { prisma } from '../prisma.js';
import { THRESHOLDS, type Threshold } from '../config.js';
import { getMonthSummary, monthKey } from './budgetService.js';

export interface BudgetAlert {
  type: 'budget_alert';
  month: string;
  threshold: Threshold;
  usagePercent: number;
  spent: number;
  budget: number;
  remaining: number;
  currency: string;
  message: string;
}

function buildAlert(
  threshold: Threshold,
  summary: { month: string; spent: number; budget: number | null; remaining: number | null; usagePercent: number | null; currency: string }
): BudgetAlert {
  const budget = summary.budget ?? 0;
  const usagePercent = summary.usagePercent ?? 0;
  const messages: Record<Threshold, string> = {
    50: `You've used 50% of your ${summary.month} budget.`,
    80: `Heads up: 80% of your ${summary.month} budget is spent.`,
    100: `Budget exceeded! You've reached 100% of your ${summary.month} budget.`,
  };
  return {
    type: 'budget_alert',
    month: summary.month,
    threshold,
    usagePercent,
    spent: summary.spent,
    budget,
    remaining: summary.remaining ?? budget - summary.spent,
    currency: summary.currency,
    message: messages[threshold],
  };
}

/**
 * Evaluate the CURRENT calendar month for a user and persist any newly crossed
 * thresholds. Returns only the thresholds that fired for the first time this
 * month (so callers can push them exactly once).
 *
 * If no budget is set for the current month, no alerts are generated.
 */
export async function evaluateNewAlerts(userId: string, currency: string): Promise<BudgetAlert[]> {
  const month = monthKey();
  const summary = await getMonthSummary(userId, month, currency);
  if (!summary.hasBudget) return [];

  const usagePercent = summary.usagePercent ?? 0;
  const existing = await prisma.alertState.findMany({ where: { userId, month } });
  const alreadyFired = new Set(existing.map((a) => a.threshold));

  const newAlerts: BudgetAlert[] = [];
  for (const threshold of THRESHOLDS) {
    if (usagePercent >= threshold && !alreadyFired.has(threshold)) {
      // Unique(userId, month, threshold) guarantees "once per threshold/month"
      // even under concurrent writes.
      try {
        await prisma.alertState.create({ data: { userId, month, threshold } });
        newAlerts.push(buildAlert(threshold, summary));
      } catch {
        // Already created by a concurrent request — skip (no re-fire).
      }
    }
  }
  return newAlerts;
}

/**
 * Alerts to (re)deliver when a WebSocket connection opens: every crossed
 * threshold for the current month that has not yet been acknowledged. This lets
 * a freshly connected client hydrate its UI without re-firing already-acked
 * alerts.
 */
export async function getUnacknowledgedAlerts(
  userId: string,
  currency: string
): Promise<BudgetAlert[]> {
  const month = monthKey();
  const summary = await getMonthSummary(userId, month, currency);
  if (!summary.hasBudget) return [];

  const states = await prisma.alertState.findMany({
    where: { userId, month, acknowledged: false },
    orderBy: { threshold: 'asc' },
  });
  return states.map((s) => buildAlert(s.threshold as Threshold, summary));
}

/** Client -> server "ack": stop re-delivering this alert on future connects. */
export async function acknowledgeAlert(
  userId: string,
  month: string,
  threshold: number
): Promise<boolean> {
  const result = await prisma.alertState.updateMany({
    where: { userId, month, threshold },
    data: { acknowledged: true },
  });
  return result.count > 0;
}
