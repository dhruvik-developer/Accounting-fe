/**
 * Expense service — wired to live REST API at /api/v1/expenses/.
 *
 * File still named `mockService.ts` so existing imports (Expenses.tsx,
 * ExpenseForm.tsx) keep working. Methods hit the backend now.
 */
import { api } from '@/app/api';
import type { Expense, ExpenseCategory, ExpenseInput } from './types';

type ApiList<T> = T[] | { results: T[]; count?: number };

const unwrap = <T,>(payload: ApiList<T>): T[] =>
  Array.isArray(payload) ? payload : payload.results || [];

export const expenseService = {
  // ----- Expenses ----------------------------------------------------------

  async list(params?: {
    q?: string; status?: string; category_id?: string;
    date_from?: string; date_to?: string;
  }): Promise<Expense[]> {
    const q: Record<string, string> = {};
    if (params?.q) q.search = params.q;
    if (params?.status && params.status !== 'all') q.status = params.status;
    if (params?.category_id && params.category_id !== 'all') q.category_id = params.category_id;
    if (params?.date_from) q.date_from = params.date_from;
    if (params?.date_to) q.date_to = params.date_to;
    const { data } = await api.get<ApiList<Expense>>('/expenses/', { params: q });
    return unwrap(data);
  },

  async get(id: string): Promise<Expense | null> {
    try {
      const { data } = await api.get<Expense>(`/expenses/${id}/`);
      return data;
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  },

  async create(input: ExpenseInput): Promise<Expense> {
    const { data } = await api.post<Expense>('/expenses/', input);
    return data;
  },

  async update(id: string, patch: Partial<ExpenseInput>): Promise<Expense> {
    const { data } = await api.patch<Expense>(`/expenses/${id}/`, patch);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/expenses/${id}/`);
  },

  async summary(params?: { date_from?: string; date_to?: string }) {
    const q: Record<string, string> = {};
    if (params?.date_from) q.date_from = params.date_from;
    if (params?.date_to) q.date_to = params.date_to;
    const { data } = await api.get('/expenses/summary/', { params: q });
    return {
      totalSpend: Number(data.totalSpend ?? 0),
      totalPaid: Number(data.totalPaid ?? 0),
      totalUnpaid: Number(data.totalUnpaid ?? 0),
      gstInput: Number(data.gstInput ?? 0),
      pendingApproval: Number(data.pendingApproval ?? 0),
      count: Number(data.count ?? 0),
      categories: (data.categories || []).map((c: any) => ({
        label: c.label, value: Number(c.value ?? 0),
      })),
    };
  },

  // ----- Categories --------------------------------------------------------

  async listCategories(): Promise<ExpenseCategory[]> {
    const { data } = await api.get<ApiList<ExpenseCategory>>('/expenses/categories/', {
      params: { is_active: 'true' },
    });
    return unwrap(data);
  },

  async createCategory(name: string, code?: string): Promise<ExpenseCategory> {
    const { data } = await api.post<ExpenseCategory>('/expenses/categories/', {
      name, code: code || name.slice(0, 4).toUpperCase(), is_active: true,
    });
    return data;
  },

  async resetSeed(): Promise<void> {
    /* no-op against live API */
  },
};
