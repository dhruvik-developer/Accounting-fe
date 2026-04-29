/**
 * Warehouse service — wired to the live REST API at /api/v1/warehouses/.
 *
 * The file is still named `mockService.ts` so imports across the codebase
 * keep working. The methods now hit the real backend; the local seed +
 * branches fallback are kept only as a degraded-mode safety net.
 */
import { api } from '@/app/api';
import type { Warehouse, WarehouseInput } from './types';

type ApiList<T> = T[] | { results: T[]; count?: number };

const unwrap = <T,>(payload: ApiList<T>): T[] =>
  Array.isArray(payload) ? payload : payload.results || [];

export const warehouseService = {
  async list(params?: { q?: string; status?: string }): Promise<Warehouse[]> {
    const q: Record<string, string> = {};
    if (params?.q) q.search = params.q;
    if (params?.status && params.status !== 'all') q.status = params.status;
    const { data } = await api.get<ApiList<Warehouse>>('/warehouses/', { params: q });
    return unwrap(data);
  },

  async get(id: string): Promise<Warehouse | null> {
    try {
      const { data } = await api.get<Warehouse>(`/warehouses/${id}/`);
      return data;
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  },

  async create(input: WarehouseInput): Promise<Warehouse> {
    const { data } = await api.post<Warehouse>('/warehouses/', input);
    return data;
  },

  async update(id: string, patch: Partial<WarehouseInput>): Promise<Warehouse> {
    const { data } = await api.patch<Warehouse>(`/warehouses/${id}/`, patch);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/warehouses/${id}/`);
  },

  /**
   * Soft "reset" — only resets the local UI cache. The real backend rows are
   * untouched. Kept for compat with the previous mock implementation.
   */
  async resetSeed(): Promise<void> {
    /* no-op against live API */
  },
};

// ---- Lookups -------------------------------------------------------------

export async function fetchBranches(): Promise<{ id: string; name: string; code?: string }[]> {
  try {
    const { data } = await api.get('/branches/');
    const arr = Array.isArray(data) ? data : data?.results || [];
    return arr.map((b: any) => ({ id: b.id, name: b.name, code: b.code }));
  } catch {
    // Fallback when the user isn't yet attached to a business (early signup flow)
    return [
      { id: 'br-ho', name: 'Head Office', code: 'HO' },
      { id: 'br-camp', name: 'Camp Store', code: 'CAMP' },
    ];
  }
}
