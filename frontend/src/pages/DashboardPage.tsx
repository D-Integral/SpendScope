import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { MonthSummary } from '../types';
import { formatMoney, formatPercent, currentMonth } from '../lib/format';
import { MonthPicker } from '../components/MonthPicker';
import { AlertBanner } from '../components/Alerts';
import { ErrorBanner, Skeleton } from '../components/ui';

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(nextMonth = month) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.budgets.get(nextMonth);
      setSummary(data);
      setBudgetInput(data.budget != null ? String(data.budget) : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load budget.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function saveBudget() {
    const amount = Number(budgetInput);
    if (!budgetInput || Number.isNaN(amount) || amount <= 0) {
      setError('Enter a budget greater than 0.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await api.budgets.set(month, amount);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save budget.');
    } finally {
      setSaving(false);
    }
  }

  async function clearBudget() {
    setSaving(true);
    setError(null);
    try {
      await api.budgets.clear(month);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear budget.');
    } finally {
      setSaving(false);
    }
  }

  const usage = summary?.usagePercent ?? 0;
  const barColor =
    !summary?.hasBudget ? 'bg-stone-300' : usage >= 100 ? 'bg-red-500' : usage >= 80 ? 'bg-amber-500' : 'bg-brand';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand">Overview</p>
          <h1 className="font-display text-4xl">Monthly budget</h1>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <AlertBanner />
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading || !summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Total spent"
              value={formatMoney(summary.spent, summary.currency)}
              hint={`Amounts in ${summary.currency}`}
            />
            <Stat
              label="Budget"
              value={summary.hasBudget ? formatMoney(summary.budget ?? 0, summary.currency) : 'No budget set'}
              muted={!summary.hasBudget}
            />
            <Stat
              label="Remaining"
              value={
                summary.hasBudget
                  ? formatMoney(summary.remaining ?? 0, summary.currency)
                  : 'No budget set'
              }
              muted={!summary.hasBudget}
              warn={Boolean(summary.hasBudget && (summary.remaining ?? 0) < 0)}
            />
            <Stat
              label="Usage"
              value={summary.hasBudget ? formatPercent(summary.usagePercent ?? 0) : 'No budget set'}
              muted={!summary.hasBudget}
            />
          </div>

          <section className="card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-2xl">Budget usage</h2>
              <p className="text-sm text-ink-muted">Single currency for this MVP: {summary.currency}</p>
            </div>
            {summary.hasBudget ? (
              <div className="mt-4">
                <div className="h-3 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(usage, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-ink-muted">
                  {formatMoney(summary.spent, summary.currency)} of{' '}
                  {formatMoney(summary.budget ?? 0, summary.currency)}
                </p>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-stone-300 bg-paper px-4 py-6 text-sm text-ink-muted">
                No budget set for this month. Add an amount below to track remaining funds and receive
                live threshold alerts.
              </p>
            )}

            <form
              className="mt-5 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void saveBudget();
              }}
            >
              <label className="sr-only" htmlFor="budget-amount">
                Monthly budget amount
              </label>
              <input
                id="budget-amount"
                className="input sm:max-w-xs"
                type="number"
                min="0.01"
                step="0.01"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder={`Amount in ${summary.currency}`}
              />
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Set monthly budget'}
              </button>
              {summary.hasBudget ? (
                <button type="button" className="btn-secondary" onClick={() => void clearBudget()}>
                  Clear budget
                </button>
              ) : null}
            </form>
          </section>
        </>
      )}

      <p className="text-sm text-ink-muted">
        Need to log spending?{' '}
        <Link to="/transactions" className="font-semibold text-brand hover:underline">
          Open transactions
        </Link>
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  muted,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
  warn?: boolean;
}) {
  return (
    <article className="card p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={`mt-2 font-display text-3xl ${muted ? 'text-ink-faint' : warn ? 'text-red-600' : ''}`}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-ink-faint">{hint}</p> : null}
    </article>
  );
}
