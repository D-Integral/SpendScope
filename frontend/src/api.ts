import type {
  ApiError,
  Category,
  MonthSummary,
  Transaction,
  TransactionFilters,
  TransactionInput,
  User,
} from './types';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, { ...init, headers, credentials: 'include' });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as ApiError;
    throw new Error(err.message || err.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),
  config: () => request<{ currency: string }>('/api/config'),
  providers: () =>
    request<{ google: boolean; github: boolean; testMode: boolean }>('/api/auth/providers'),
  me: () => request<{ user: User | null }>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  testLogin: (profile: {
    provider: 'google' | 'github';
    providerUserId: string;
    email?: string | null;
    displayName: string;
    avatarUrl?: string | null;
  }) =>
    request<{ user: User }>('/api/auth/test/login', {
      method: 'POST',
      body: JSON.stringify(profile),
    }),

  categories: {
    list: () => request<Category[]>('/api/categories'),
    create: (name: string) =>
      request<Category>('/api/categories', { method: 'POST', body: JSON.stringify({ name }) }),
    rename: (id: string, name: string) =>
      request<Category>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/api/categories/${id}`, { method: 'DELETE' }),
  },

  transactions: {
    list: (filters: TransactionFilters = {}) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const qs = params.toString();
      return request<Transaction[]>(`/api/transactions${qs ? `?${qs}` : ''}`);
    },
    create: (input: TransactionInput) =>
      request<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: Partial<TransactionInput>) =>
      request<Transaction>(`/api/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/api/transactions/${id}`, { method: 'DELETE' }),
  },

  budgets: {
    get: (month: string) => request<MonthSummary>(`/api/budgets/${month}`),
    set: (month: string, amount: number) =>
      request<MonthSummary>(`/api/budgets/${month}`, {
        method: 'PUT',
        body: JSON.stringify({ amount }),
      }),
    clear: (month: string) =>
      request<{ ok: boolean }>(`/api/budgets/${month}`, { method: 'DELETE' }),
  },
};
