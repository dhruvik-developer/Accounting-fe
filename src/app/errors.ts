/**
 * Centralised API error formatter.
 *
 * Maps the various shapes Django/DRF, network, and Axios errors can take
 * into a single user-presentable string. Avoids leaking JSON-stringified
 * blobs or raw HTML error pages into the UI.
 */

const HTML_TAG = /<!DOCTYPE html|<html/i;
const MAX_LEN = 240;

function clip(s: string): string {
  const t = s.trim();
  return t.length > MAX_LEN ? `${t.slice(0, MAX_LEN - 1)}…` : t;
}

function flattenFieldErrors(data: Record<string, unknown>): string | null {
  // DRF returns { field_name: ["error 1", "error 2"], ... } for 400s.
  const parts: string[] = [];
  for (const [field, val] of Object.entries(data)) {
    if (field === 'detail' || field === 'non_field_errors') continue;
    const msg = Array.isArray(val) ? val.join(' ') : typeof val === 'string' ? val : null;
    if (msg) parts.push(`${field}: ${msg}`);
  }
  if (parts.length === 0) return null;
  return clip(parts.join(' · '));
}

export function formatApiError(e: unknown, fallback = 'Something went wrong'): string {
  if (!e) return fallback;
  // Axios shape: e.response.data
  const anyErr = e as { response?: { data?: unknown; status?: number }; message?: string };
  const data = anyErr?.response?.data;

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === 'string') return clip(obj.detail);
    if (Array.isArray(obj.non_field_errors) && obj.non_field_errors[0]) {
      return clip(String(obj.non_field_errors[0]));
    }
    const flat = flattenFieldErrors(obj);
    if (flat) return flat;
  }

  if (typeof data === 'string') {
    if (HTML_TAG.test(data)) return fallback;
    if (data.trim()) return clip(data);
  }

  if (anyErr?.message && typeof anyErr.message === 'string') {
    return clip(anyErr.message);
  }

  return fallback;
}
