export interface User {
  id: string;
  provider: 'google' | 'github' | string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  transactionCount: number;
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  currency: string;
  date: string;
  categoryId: string;
  category?: { id: string; name: string };
  notes: string | null;
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

export interface BudgetAlert {
  type: 'budget_alert';
  month: string;
  threshold: 50 | 80 | 100;
  usagePercent: number;
  spent: number;
  budget: number;
  remaining: number;
  currency: string;
  message: string;
}

export interface TransactionInput {
  title: string;
  amount: number;
  date: string;
  categoryId: string;
  notes?: string | null;
}

export interface TransactionFilters {
  q?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: string;
  maxAmount?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}
