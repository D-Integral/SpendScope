import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { Category } from '../types';
import { EmptyState, ErrorBanner, Skeleton } from '../components/ui';

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.categories.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load categories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }
    try {
      await api.categories.create(name.trim());
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category.');
    }
  }

  async function rename(id: string, nextName: string) {
    if (!nextName.trim()) return;
    try {
      await api.categories.rename(id, nextName.trim());
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename category.');
    }
  }

  async function remove(category: Category) {
    if (category.transactionCount > 0) {
      setError(
        `“${category.name}” still has ${category.transactionCount} transaction(s). Reassign or delete them first.`
      );
      return;
    }
    if (!window.confirm(`Delete category “${category.name}”?`)) return;
    try {
      await api.categories.remove(category.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete category.');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-brand">Organization</p>
        <h1 className="font-display text-4xl">Categories</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-muted">
          Names must be unique. A category cannot be deleted while it still has transactions.
        </p>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <form className="card flex flex-col gap-3 p-4 sm:flex-row" onSubmit={create}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
        />
        <button type="submit" className="btn-primary sm:w-auto">
          <Plus className="h-4 w-4" />
          Create
        </button>
      </form>

      {loading ? (
        <Skeleton className="h-48" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create a category such as Groceries or Rent before adding transactions."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((category) => (
            <li key={category.id} className="card flex items-center gap-3 p-4">
              {editingId === category.id ? (
                <input
                  className="input"
                  defaultValue={category.name}
                  autoFocus
                  onBlur={(e) => void rename(category.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void rename(category.id, (e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-xs text-ink-muted">
                    {category.transactionCount} transaction{category.transactionCount === 1 ? '' : 's'}
                  </p>
                </div>
              )}
              <button
                type="button"
                className="btn-ghost h-9 w-9 p-0"
                onClick={() => setEditingId(category.id)}
                aria-label={`Rename ${category.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-ghost h-9 w-9 p-0 text-red-600"
                onClick={() => void remove(category)}
                aria-label={`Delete ${category.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
