import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { Category, Transaction, TransactionFilters } from '../types';
import { currentMonth, formatMoney, lastMonthKey, monthBounds, toDateInput } from '../lib/format';
import { EmptyState, ErrorBanner, Modal, Skeleton } from '../components/ui';
import { TransactionForm } from '../components/TransactionForm';
import { useDebounced } from '../components/MonthPicker';

type DatePreset = 'this' | 'last' | 'custom' | 'all';

export function TransactionsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Transaction[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [preset, setPreset] = useState<DatePreset>('this');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [modal, setModal] = useState<'create' | Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const debouncedQ = useDebounced(q);

  const dateRange = useMemo(() => {
    if (preset === 'this') return monthBounds(currentMonth());
    if (preset === 'last') return monthBounds(lastMonthKey());
    if (preset === 'custom') return { from: customFrom, to: customTo };
    return { from: '', to: '' };
  }, [preset, customFrom, customTo]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const filters: TransactionFilters = {
        q: debouncedQ,
        categoryId,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        minAmount,
        maxAmount,
      };
      const [list, cats, cfg] = await Promise.all([
        api.transactions.list(filters),
        api.categories.list(),
        api.config(),
      ]);
      setItems(list);
      setCategories(cats);
      setCurrency(cfg.currency);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load transactions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, categoryId, dateRange.from, dateRange.to, minAmount, maxAmount]);

  async function remove(id: string) {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await api.transactions.remove(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete transaction.');
    }
  }

  const hasExtraFilters = Boolean(debouncedQ || categoryId || minAmount || maxAmount || preset === 'custom');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand">Activity</p>
          <h1 className="font-display text-4xl">Transactions</h1>
          <p className="mt-1 text-sm text-ink-muted">Currency: {currency}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setModal('create')}>
          <Plus className="h-4 w-4" />
          New transaction
        </button>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <section className="card p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="relative min-w-[16rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                className="input pl-9"
                placeholder="Search title or notes"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <select className="input min-w-[12rem] flex-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className="input min-w-[11rem] sm:max-w-[14rem]" value={preset} onChange={(e) => setPreset(e.target.value as DatePreset)}>
              <option value="this">This month</option>
              <option value="last">Last month</option>
              <option value="custom">Custom range</option>
              <option value="all">All dates</option>
            </select>
          </div>
          <div className="grid max-w-md grid-cols-2 gap-2">
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Min amount"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Max amount"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
        </div>
        {preset === 'custom' ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input className="input" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <input className="input" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        ) : null}
      </section>

      {loading ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <EmptyState
          title={hasExtraFilters ? 'No matching transactions' : 'No transactions yet'}
          description={
            hasExtraFilters
              ? 'Try a different search, category, date range, or amount filter.'
              : 'Add your first expense to start tracking this month.'
          }
          action={
            <button type="button" className="btn-primary" onClick={() => setModal('create')}>
              Add transaction
            </button>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto card md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((tx) => (
                  <tr key={tx.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                    <td className="whitespace-nowrap px-4 py-3">{toDateInput(tx.date)}</td>
                    <td className="px-4 py-3 font-medium">{tx.title}</td>
                    <td className="px-4 py-3">{tx.category?.name}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-ink-muted">{tx.notes || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                      {formatMoney(tx.amount, tx.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" className="btn-ghost h-9 w-9 p-0" aria-label={`Edit ${tx.title}`} onClick={() => setModal(tx)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" className="btn-ghost h-9 w-9 p-0 text-red-600" aria-label={`Delete ${tx.title}`} onClick={() => void remove(tx.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((tx) => (
              <article key={tx.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{tx.title}</p>
                    <p className="text-xs text-ink-muted">
                      {toDateInput(tx.date)} · {tx.category?.name}
                    </p>
                  </div>
                  <p className="font-display text-xl">{formatMoney(tx.amount, tx.currency)}</p>
                </div>
                {tx.notes ? <p className="mt-2 text-sm text-ink-muted">{tx.notes}</p> : null}
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn-secondary flex-1" onClick={() => setModal(tx)}>
                    Edit
                  </button>
                  <button type="button" className="btn-secondary flex-1 text-red-600" onClick={() => void remove(tx.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {modal ? (
        <Modal
          title={modal === 'create' ? 'New transaction' : 'Edit transaction'}
          onClose={() => setModal(null)}
        >
          {categories.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Create a category first on the Categories page, then add a transaction.
            </p>
          ) : (
            <TransactionForm
              categories={categories}
              currency={currency}
              initial={modal === 'create' ? null : modal}
              submitting={saving}
              onCancel={() => setModal(null)}
              onSubmit={async (values) => {
                setSaving(true);
                try {
                  if (modal === 'create') await api.transactions.create(values);
                  else await api.transactions.update(modal.id, values);
                  setModal(null);
                  await load();
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
        </Modal>
      ) : null}
    </div>
  );
}
