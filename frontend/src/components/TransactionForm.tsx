import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Category, Transaction } from '../types';
import { toDateInput } from '../lib/format';

interface Props {
  categories: Category[];
  currency: string;
  initial?: Transaction | null;
  submitting: boolean;
  onSubmit: (values: {
    title: string;
    amount: number;
    date: string;
    categoryId: string;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
}

interface Errors {
  title?: string;
  amount?: string;
  date?: string;
  categoryId?: string;
}

export function TransactionForm({
  categories,
  currency,
  initial,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [date, setDate] = useState(initial ? toDateInput(initial.date) : toDateInput(new Date().toISOString()));
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = useMemo(
    () => () => {
      const next: Errors = {};
      if (!title.trim()) next.title = 'Title is required.';
      const amountNum = Number(amount);
      if (!amount || Number.isNaN(amountNum) || amountNum <= 0) {
        next.amount = 'Amount must be greater than 0.';
      }
      if (!date || Number.isNaN(new Date(date).getTime())) {
        next.date = 'Enter a valid date.';
      }
      if (!categoryId) next.categoryId = 'Choose a category.';
      setErrors(next);
      return Object.keys(next).length === 0;
    },
    [title, amount, date, categoryId]
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    if (!validate()) return;
    try {
      await onSubmit({
        title: title.trim(),
        amount: Number(amount),
        date,
        categoryId,
        notes: notes.trim(),
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not save transaction.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {serverError ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
      ) : null}

      <div>
        <label className="label" htmlFor="tx-title">
          Title
        </label>
        <input
          id="tx-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Coffee, rent, groceries…"
        />
        {errors.title ? <p className="field-error">{errors.title}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="tx-amount">
            Amount ({currency})
          </label>
          <input
            id="tx-amount"
            className="input"
            inputMode="decimal"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          {errors.amount ? <p className="field-error">{errors.amount}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="tx-date">
            Date
          </label>
          <input
            id="tx-date"
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {errors.date ? <p className="field-error">{errors.date}</p> : null}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="tx-category">
          Category
        </label>
        <select
          id="tx-category"
          className="input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId ? <p className="field-error">{errors.categoryId}</p> : null}
      </div>

      <div>
        <label className="label" htmlFor="tx-notes">
          Notes
        </label>
        <textarea
          id="tx-notes"
          className="input min-h-[88px] resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional details"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add transaction'}
        </button>
      </div>
    </form>
  );
}
