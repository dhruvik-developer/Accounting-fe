/**
 * Per-branch module access — what the active branch can see.
 *
 * The HO admin configures this in Settings → Branches → Module access.
 * The backend stores `enabled_modules: [module_dashboard, module_sales, …]`
 * on each Branch row. The sidebar + route guards check whether the active
 * branch has a given module before rendering that menu entry / page.
 *
 * Loading semantics:
 *   - On first call we fetch /branches/ once (cached for the session).
 *   - While loading, `isModuleAllowed()` returns true (fail-open) — that
 *     way the sidebar doesn't flash empty during page navigation.
 *   - Cross-tab sync: if BranchSwitcher writes a new `branch_id`, the
 *     storage event re-fetches.
 *
 * This is *complementary* to plan-based feature flags (`module_*` flags
 * from /billing/feature-flags/). Both must allow the module — branch
 * gate hides at the org level, plan gate hides at the SaaS-tier level.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/app/api';

export type FeatureMeta = { key: string; module: string; label: string };

export type Branch = {
  id: string;
  name: string;
  code: string;
  is_default: boolean;
  is_active: boolean;
  preset?: string;
  enabled_modules?: string[];
  readonly_modules?: string[];
  disabled_features?: string[];
  available_modules?: string[];
  available_features?: FeatureMeta[];
};

let cache: Branch[] | null = null;
let inflight: Promise<Branch[]> | null = null;
let invalidateBus: Set<() => void> = new Set();

const fetchBranches = (): Promise<Branch[]> => {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = api.get<{ results?: Branch[] } | Branch[]>('/branches/', {
    params: { page_size: 200 },
  })
    .then((r) => {
      const data = (Array.isArray(r.data) ? r.data : r.data?.results) || [];
      cache = data;
      return data;
    })
    .catch(() => [] as Branch[])
    .finally(() => { inflight = null; });
  return inflight;
};

export function invalidateBranchModules() {
  cache = null;
  invalidateBus.forEach((cb) => cb());
}

export function useBranchModules() {
  const [branches, setBranches] = useState<Branch[]>(cache || []);
  const [loaded, setLoaded] = useState<boolean>(cache !== null);

  // Active branch id is owned by BranchSwitcher (localStorage). Re-pick
  // when it changes (cross-tab or in-tab via the switcher's location.reload).
  const [activeId, setActiveId] = useState<string | null>(() => {
    try { return localStorage.getItem('branch_id'); } catch { return null; }
  });

  useEffect(() => {
    let alive = true;
    fetchBranches().then((data) => {
      if (!alive) return;
      setBranches(data);
      setLoaded(true);
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'branch_id') setActiveId(e.newValue);
    };
    // Same-tab branch_id changes (e.g. BranchSwitcher auto-correcting a
    // stale id on first paint). Storage events do not fire in-tab.
    const onBranchChange = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setActiveId(detail ?? null);
    };
    const onInvalidate = () => {
      fetchBranches().then((data) => {
        if (!alive) return;
        setBranches(data);
      });
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('branchchange', onBranchChange as EventListener);
    invalidateBus.add(onInvalidate);
    return () => {
      alive = false;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('branchchange', onBranchChange as EventListener);
      invalidateBus.delete(onInvalidate);
    };
  }, []);

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeId)
      || branches.find((b) => b.is_default)
      || branches[0]
      || null,
    [branches, activeId],
  );

  const enabledSet = useMemo(
    () => new Set(activeBranch?.enabled_modules ?? []),
    [activeBranch],
  );
  const readonlySet = useMemo(
    () => new Set(activeBranch?.readonly_modules ?? []),
    [activeBranch],
  );
  const disabledFeatures = useMemo(
    () => new Set(activeBranch?.disabled_features ?? []),
    [activeBranch],
  );
  // Map a feature key → its parent module so isFeatureAllowed() can check
  // both layers in one go (parent module enabled + feature not blocked).
  const featureToModule = useMemo(() => {
    const map: Record<string, string> = {};
    (activeBranch?.available_features ?? []).forEach((f) => {
      map[f.key] = f.module;
    });
    return map;
  }, [activeBranch]);

  const isModuleAllowed = useCallback(
    (moduleKey: string): boolean => {
      // Fail-open while loading or if no branch is configured.
      if (!loaded || !activeBranch) return true;
      // Branch-level module check applies ONLY to keys the backend lists in
      // `available_modules` for this branch. Anything else — billing-only
      // plan flags like `module_reports_basic`, or arbitrary feature keys
      // like `designer` — is not branch-gated and falls through to the
      // plan-flag layer that the caller (sidebar / FeatureGate) handles.
      const available = new Set(activeBranch.available_modules || []);
      if (moduleKey.startsWith('module_')) {
        if (available.has(moduleKey)) return enabledSet.has(moduleKey);
        return true; // plan flag, not a branch module — let plan layer decide
      }
      // If we have a catalog match, treat it as a feature gate.
      const parent = featureToModule[moduleKey];
      if (parent) {
        return enabledSet.has(parent) && !disabledFeatures.has(moduleKey);
      }
      // Plan flags / arbitrary keys outside the catalog are not branch-gated.
      return true;
    },
    [enabledSet, disabledFeatures, featureToModule, activeBranch, loaded],
  );

  /** Explicit feature-level check. Use when the caller knows the key
   *  belongs to a specific feature, regardless of naming convention. */
  const isFeatureAllowed = useCallback(
    (featureKey: string): boolean => {
      if (!loaded || !activeBranch) return true;
      const parent = featureToModule[featureKey];
      if (!parent) return true; // not in catalog → not branch-gated
      return enabledSet.has(parent) && !disabledFeatures.has(featureKey);
    },
    [enabledSet, disabledFeatures, featureToModule, activeBranch, loaded],
  );

  const isModuleReadonly = useCallback(
    (moduleKey: string): boolean => {
      if (!loaded || !activeBranch) return false;
      if (!moduleKey.startsWith('module_')) return false;
      return readonlySet.has(moduleKey);
    },
    [readonlySet, activeBranch, loaded],
  );

  /** True if the branch can both see AND modify this module. Pages should
   *  hide Create / Edit / Delete buttons when this is false (but still
   *  show the page itself if `isModuleAllowed` is true). */
  const canWrite = useCallback(
    (moduleKey: string): boolean =>
      isModuleAllowed(moduleKey) && !isModuleReadonly(moduleKey),
    [isModuleAllowed, isModuleReadonly],
  );

  return {
    branches,
    activeBranch,
    isModuleAllowed,
    isFeatureAllowed,
    isModuleReadonly,
    canWrite,
    loaded,
  };
}
