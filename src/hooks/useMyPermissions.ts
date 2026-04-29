/**
 * RBAC permission codes for the active user + active business.
 *
 * The backend `GET /rbac/me/permissions/` returns the effective set of
 * permission codes (e.g. `sales.invoice.create`, `masters.parties.view`)
 * that the user holds in the current business — already with the
 * `*.manage` shortcut expanded into individual actions, and superusers
 * pre-expanded to the full catalogue.
 *
 * Loading semantics mirror useBranchModules:
 *   - First call fetches once and caches the result for the session.
 *   - While loading, `hasPermission()` returns true (fail-open) so the
 *     sidebar/menu doesn't flash "empty" before settling.
 *   - Cross-tab invalidation via storage events on the `business_id`
 *     key (when the user switches business, the permission set changes).
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/app/api';

type Cache = { codes: Set<string>; isSuperuser: boolean; businessId: string | null };

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;
const invalidateBus = new Set<() => void>();

const fetchPerms = (): Promise<Cache> => {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = api.get<{ business_id: string | null; is_superuser: boolean; codes: string[] }>(
    '/rbac/me/permissions/',
  )
    .then((r) => {
      const c: Cache = {
        codes: new Set(r.data.codes || []),
        isSuperuser: !!r.data.is_superuser,
        businessId: r.data.business_id,
      };
      cache = c;
      return c;
    })
    .catch(() => {
      // Network/auth failure → empty set. The backend will still 403 the
      // actual request, so we'd rather hide menus than show false ones.
      const c: Cache = { codes: new Set(), isSuperuser: false, businessId: null };
      cache = c;
      return c;
    })
    .finally(() => { inflight = null; });
  return inflight;
};

export function invalidateMyPermissions() {
  cache = null;
  invalidateBus.forEach((cb) => cb());
}

export function useMyPermissions() {
  const [state, setState] = useState<Cache>(cache || {
    codes: new Set(), isSuperuser: false, businessId: null,
  });
  const [loaded, setLoaded] = useState<boolean>(cache !== null);

  useEffect(() => {
    let alive = true;
    fetchPerms().then((c) => {
      if (!alive) return;
      setState(c); setLoaded(true);
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'business_id') {
        invalidateMyPermissions();
      }
    };
    const onInvalidate = () => {
      fetchPerms().then((c) => { if (alive) setState(c); });
    };
    window.addEventListener('storage', onStorage);
    invalidateBus.add(onInvalidate);
    return () => {
      alive = false;
      window.removeEventListener('storage', onStorage);
      invalidateBus.delete(onInvalidate);
    };
  }, []);

  /** Strict check: does the user hold the exact permission code, OR the
   *  `<module>.<sub>.manage` shortcut for the same submodule? */
  const hasPermission = useCallback((code: string | undefined | null): boolean => {
    if (!code) return true;                  // no gate → allow
    if (!loaded) return true;                 // optimistic during load
    if (state.isSuperuser) return true;       // platform admin
    if (state.codes.has(code)) return true;
    const parts = code.split('.');
    if (parts.length >= 2) {
      const manage = [...parts.slice(0, -1), 'manage'].join('.');
      if (state.codes.has(manage)) return true;
    }
    return false;
  }, [state, loaded]);

  /** True if the user holds *any* permission whose code starts with the
   *  given prefix. Used for parent menu items that should appear when at
   *  least one child action is permitted (e.g. Sales menu opens if you
   *  have sales.invoice.view OR sales.quotation.view OR …). */
  const hasAnyPermissionStartingWith = useCallback((prefix: string): boolean => {
    if (!loaded) return true;
    if (state.isSuperuser) return true;
    for (const c of state.codes) if (c.startsWith(prefix)) return true;
    return false;
  }, [state, loaded]);

  return {
    loaded,
    isSuperuser: state.isSuperuser,
    codes: state.codes,
    hasPermission,
    hasAnyPermissionStartingWith,
  };
}
