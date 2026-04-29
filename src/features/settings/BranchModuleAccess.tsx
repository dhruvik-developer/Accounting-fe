/**
 * Settings → Branch module access.
 *
 * Single-screen matrix: rows = modules, columns = branches, ✅ / ❌ per cell.
 * The HO admin clicks a cell to toggle which modules show up at that branch.
 *
 * Above the matrix is a per-branch preset picker — picking "Retail outlet"
 * for example fills the column with the retail preset's modules in one click,
 * then the user can fine-tune. As soon as any cell is hand-edited, that
 * branch's preset flips to "Custom" so the labels stay accurate.
 *
 * Hits PATCH /branches/{id}/ with { preset } or { enabled_modules } —
 * the serializer figures out which mode the user is in.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, MenuItem, Paper, Skeleton, Stack, TextField,
  Tooltip, Typography, alpha,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { api } from '@/app/api';
import { formatApiError } from '@/app/errors';
import { notify } from '@/components/Notifier';
import { invalidateBranchModules } from '@/hooks/useBranchModules';

type FeatureMeta = { key: string; module: string; label: string };

type Branch = {
  id: string;
  name: string;
  code: string;
  is_default: boolean;
  is_active: boolean;
  preset: string;
  enabled_modules: string[];
  readonly_modules: string[];
  disabled_features: string[];
  available_modules: string[];
  available_features: FeatureMeta[];
};

// 3-state per cell. Click cycles Off → View → Edit → Off.
type CellState = 'off' | 'view' | 'edit';

const stateOf = (b: Branch, m: string): CellState => {
  if (!b.enabled_modules.includes(m)) return 'off';
  if (b.readonly_modules?.includes(m)) return 'view';
  return 'edit';
};

const nextState = (s: CellState): CellState =>
  s === 'off' ? 'edit' : s === 'edit' ? 'view' : 'off';

const PRESETS: { value: string; label: string; hint: string }[] = [
  { value: 'full_access',   label: 'Full access',     hint: 'Everything — best for HO' },
  { value: 'retail_outlet', label: 'Retail outlet',   hint: 'Sales · Payments · Items · Parties · Expenses' },
  { value: 'warehouse_only', label: 'Warehouse only', hint: 'Items · Inventory · Warehouses' },
  { value: 'sales_office',  label: 'Sales office',    hint: 'Sales · Parties · Reports · Items (read)' },
  { value: 'custom',        label: 'Custom',          hint: 'Edit individual modules manually' },
];

// Display labels for module keys. New keys not in this map render with a
// title-cased fallback so the matrix never shows raw `module_foo` text.
const MODULE_LABELS: Record<string, { label: string; group: string }> = {
  module_dashboard: { label: 'Dashboard', group: 'Overview' },
  module_sales: { label: 'Sales (Estimate / SO / DC / Invoice)', group: 'Sales' },
  module_purchases: { label: 'Purchase (PO / Bill)', group: 'Purchases' },
  module_payments: { label: 'Payments', group: 'Sales' },
  module_expenses: { label: 'Expenses', group: 'Purchases' },
  module_parties: { label: 'Parties', group: 'Catalog' },
  module_items: { label: 'Items', group: 'Catalog' },
  module_inventory: { label: 'Inventory', group: 'Catalog' },
  module_warehouses: { label: 'Warehouses', group: 'Catalog' },
  module_reports: { label: 'Reports', group: 'Insights' },
  module_branches: { label: 'Branches', group: 'Configuration' },
  module_team: { label: 'Team & Roles', group: 'Configuration' },
  module_settings: { label: 'Settings', group: 'Configuration' },
  module_audit: { label: 'Audit log', group: 'Configuration' },
  module_charges: { label: 'Charges', group: 'Configuration' },
  module_billing: { label: 'SaaS subscription & billing', group: 'Organization' },
};

const labelFor = (key: string) =>
  MODULE_LABELS[key] || {
    label: key.replace(/^module_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    group: 'Other',
  };

const GROUP_ORDER = ['Overview', 'Organization', 'Sales', 'Purchases', 'Catalog', 'Insights', 'Configuration', 'Other'];

export default function BranchModuleAccess() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  // Which module rows are expanded to reveal feature sub-rows. Defaults
  // to collapsed — most users only ever touch the module-level toggle.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    setErr('');
    api.get('/branches/', { params: { page_size: 200 } })
      .then((r) => setBranches((r.data.results ?? r.data) as Branch[]))
      .catch((e) => setErr(formatApiError(e, 'Failed to load branches')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // The "available" module list is whatever the server reports for any
  // branch — they should all be the same, but we union just in case the
  // backend adds modules ahead of a branch's row being touched.
  const allModules = useMemo(() => {
    const set = new Set<string>();
    branches.forEach((b) => (b.available_modules || []).forEach((m) => set.add(m)));
    return Array.from(set);
  }, [branches]);

  // Feature catalog grouped by module (server returns a flat list).
  const featuresByModule = useMemo(() => {
    const map: Record<string, FeatureMeta[]> = {};
    branches.forEach((b) => {
      (b.available_features || []).forEach((f) => {
        if (!map[f.module]) map[f.module] = [];
        if (!map[f.module].some((x) => x.key === f.key)) map[f.module].push(f);
      });
    });
    return map;
  }, [branches]);

  // Group modules so the matrix mirrors the sidebar layout.
  const grouped = useMemo(() => {
    const map: Record<string, string[]> = {};
    allModules.forEach((m) => {
      const group = labelFor(m).group;
      (map[group] ||= []).push(m);
    });
    return GROUP_ORDER
      .filter((g) => map[g]?.length)
      .map((g) => ({ group: g, modules: map[g] }));
  }, [allModules]);

  const updateBranch = async (id: string, patch: Partial<Branch>) => {
    setSavingId(id);
    setErr('');
    // Optimistic — apply locally so the matrix toggle is instant.
    setBranches((prev) => prev.map((b) => b.id === id ? { ...b, ...patch } as Branch : b));
    try {
      const { data } = await api.patch<Branch>(`/branches/${id}/`, patch);
      setBranches((prev) => prev.map((b) => b.id === id ? data : b));
      // Other tabs / sidebar need to re-fetch to reflect the new access.
      invalidateBranchModules();
    } catch (e) {
      load(); // roll back optimistic change
      setErr(formatApiError(e, 'Failed to update branch'));
    } finally {
      setSavingId(null);
    }
  };

  const togglePreset = (b: Branch, preset: string) =>
    updateBranch(b.id, { preset });

  // Feature-level toggle (Phase 3). 2-state: enabled (default) ↔ disabled.
  // No "read-only" axis at the feature level — read-only is decided by
  // the parent module so we don't multiply states unnecessarily.
  const toggleFeature = (b: Branch, featureKey: string) => {
    const disabled = new Set(b.disabled_features || []);
    if (disabled.has(featureKey)) disabled.delete(featureKey);
    else disabled.add(featureKey);
    updateBranch(b.id, { disabled_features: Array.from(disabled) });
  };

  const toggleModule = (b: Branch, moduleKey: string) => {
    // Cycle: Off → Edit → View → Off. Both lists update in one PATCH so
    // the optimistic state is internally consistent (server clamps too).
    const current = stateOf(b, moduleKey);
    const target = nextState(current);
    const enabled = new Set(b.enabled_modules);
    const readonly = new Set(b.readonly_modules || []);
    if (target === 'off') {
      enabled.delete(moduleKey); readonly.delete(moduleKey);
    } else if (target === 'edit') {
      enabled.add(moduleKey); readonly.delete(moduleKey);
    } else {
      enabled.add(moduleKey); readonly.add(moduleKey);
    }
    updateBranch(b.id, {
      enabled_modules: Array.from(enabled),
      readonly_modules: Array.from(readonly),
    });
  };

  if (loading) {
    return <Skeleton variant="rounded" height={300} />;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 1.5,
          display: 'grid', placeItems: 'center', color: '#fff',
          background: 'linear-gradient(135deg, #4FC3F7, #B388FF)',
        }}>
          <HubOutlinedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
            Branch module access
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Decide which modules each branch can see. Pick a preset or tick individual modules. Sidebar + routes update for users at that branch.
          </Typography>
        </Box>
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr('')}>{err}</Alert>}

      {/* Three-state legend so the icon meanings are unambiguous. */}
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          States:
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <CheckCircleIcon sx={{ fontSize: 16, color: '#00E676' }} />
          <Typography variant="caption">Full access (view + edit)</Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <VisibilityOutlinedIcon sx={{ fontSize: 16, color: '#FFB300' }} />
          <Typography variant="caption">Read-only (view only)</Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
          <Typography variant="caption">Hidden</Typography>
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Click any cell to cycle Off → Edit → View → Off.
        </Typography>
      </Stack>

      {/* Per-branch preset row — quickest path; tweak the matrix afterwards */}
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        {branches.map((b) => (
          <Paper key={b.id} variant="outlined" sx={{ p: 1.5, minWidth: 280, flex: '0 1 320px' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{b.name}</Typography>
              <Chip size="small" label={b.code} sx={{
                fontFamily: '"IBM Plex Mono", monospace', height: 20, fontSize: 10,
              }} />
              {b.is_default && <Chip size="small" label="Default" color="primary" />}
              {!b.is_active && <Chip size="small" label="Inactive" />}
            </Stack>
            <TextField
              select fullWidth size="small" label="Preset"
              value={b.preset || 'full_access'}
              onChange={(e) => togglePreset(b, e.target.value)}
              disabled={savingId === b.id}
              helperText={PRESETS.find((p) => p.value === b.preset)?.hint || ''}
            >
              {PRESETS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {b.enabled_modules.length} of {allModules.length} enabled
              {(b.readonly_modules?.length || 0) > 0 && ` · ${b.readonly_modules.length} read-only`}
            </Typography>
          </Paper>
        ))}
      </Stack>

      {/* Matrix */}
      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: `260px repeat(${branches.length}, minmax(140px, 1fr))`,
          minWidth: 260 + branches.length * 140,
        }}>
          {/* Header row */}
          <HeaderCell first>Module</HeaderCell>
          {branches.map((b) => (
            <HeaderCell key={b.id}>
              <Stack alignItems="center" spacing={0.25}>
                <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>{b.name}</Typography>
                <Typography variant="caption" sx={{
                  fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: 'text.secondary',
                }} noWrap>
                  {b.code}
                </Typography>
              </Stack>
            </HeaderCell>
          ))}

          {/* Group rows */}
          {grouped.map(({ group, modules }) => (
            <Box key={group} sx={{ display: 'contents' }}>
              <GroupHeader colSpan={branches.length + 1}>{group}</GroupHeader>
              {modules.map((m) => {
                const features = featuresByModule[m] || [];
                const hasFeatures = features.length > 0;
                const isOpen = !!expanded[m];
                return (
                <Box key={m} sx={{ display: 'contents' }}>
                  <ModuleCell first>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {hasFeatures ? (
                        <Tooltip title={isOpen ? 'Collapse features' : 'Expand sub-features'}>
                          <Box
                            onClick={() => setExpanded((prev) => ({ ...prev, [m]: !prev[m] }))}
                            sx={{
                              display: 'inline-flex', alignItems: 'center',
                              cursor: 'pointer', color: 'text.secondary',
                              '&:hover': { color: 'text.primary' },
                            }}>
                            {isOpen ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                          </Box>
                        </Tooltip>
                      ) : (
                        <Box sx={{ width: 20 }} />
                      )}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2">{labelFor(m).label}</Typography>
                        <Typography variant="caption" color="text.secondary"
                          sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10 }}>
                          {m}
                          {hasFeatures && (
                            <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                              · {features.length} features
                            </Typography>
                          )}
                        </Typography>
                      </Box>
                    </Stack>
                  </ModuleCell>
                  {branches.map((b) => {
                    const state = stateOf(b, m);
                    const tip = state === 'off' ? 'Hidden — click to enable (full access)'
                      : state === 'edit' ? 'Full access — click to make read-only'
                      : 'Read-only — click to hide';
                    const icon = state === 'off' ? (
                      <RadioButtonUncheckedIcon sx={{ color: 'text.disabled', fontSize: 22 }} />
                    ) : state === 'edit' ? (
                      <CheckCircleIcon sx={{ color: '#00E676', fontSize: 22 }} />
                    ) : (
                      <VisibilityOutlinedIcon sx={{ color: '#FFB300', fontSize: 22 }} />
                    );
                    return (
                      <ModuleCell key={b.id} center>
                        <Tooltip title={tip}>
                          <Box
                            onClick={() => savingId !== b.id && toggleModule(b, m)}
                            sx={{
                              cursor: savingId === b.id ? 'wait' : 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 32, height: 32, borderRadius: '50%',
                              transition: 'background-color 120ms',
                              '&:hover': {
                                bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                              },
                            }}
                          >
                            {icon}
                          </Box>
                        </Tooltip>
                      </ModuleCell>
                    );
                  })}

                  {/* Feature sub-rows — visible only when the module is
                      expanded. Disabled visual state if parent module is
                      off at the branch (cascade), otherwise 2-state toggle. */}
                  {isOpen && features.map((f) => (
                    <Box key={f.key} sx={{ display: 'contents' }}>
                      <FeatureCell first>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ pl: 3 }}>
                          <Box sx={{ width: 20 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              {f.label}
                            </Typography>
                            <Typography variant="caption" color="text.disabled"
                              sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10 }}>
                              {f.key}
                            </Typography>
                          </Box>
                        </Stack>
                      </FeatureCell>
                      {branches.map((b) => {
                        const moduleOn = b.enabled_modules.includes(m);
                        const featureOn = moduleOn && !(b.disabled_features || []).includes(f.key);
                        const tip = !moduleOn
                          ? 'Module is hidden — enable the module first'
                          : featureOn
                            ? 'Sub-feature on — click to hide'
                            : 'Sub-feature hidden — click to enable';
                        return (
                          <FeatureCell key={b.id} center>
                            <Tooltip title={tip}>
                              <Box
                                onClick={() => moduleOn && savingId !== b.id && toggleFeature(b, f.key)}
                                sx={{
                                  cursor: !moduleOn ? 'not-allowed'
                                    : savingId === b.id ? 'wait'
                                    : 'pointer',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  width: 28, height: 28, borderRadius: '50%',
                                  opacity: moduleOn ? 1 : 0.4,
                                  '&:hover': moduleOn ? {
                                    bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                                  } : undefined,
                                }}
                              >
                                {featureOn ? (
                                  <CheckCircleIcon sx={{ color: '#00E676', fontSize: 18 }} />
                                ) : (
                                  <RadioButtonUncheckedIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                                )}
                              </Box>
                            </Tooltip>
                          </FeatureCell>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Paper>

      <Typography variant="caption" color="text.secondary">
        Sidebar + route guards update immediately when toggled. Users currently
        at that branch may need to refresh to see the change.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button variant="outlined" onClick={load}>Refresh</Button>
      </Stack>
    </Stack>
  );
}

function HeaderCell({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <Box sx={{
      px: 1.5, py: 1,
      borderBottom: 1, borderColor: 'divider',
      borderRight: first ? 1 : 0, borderRightColor: 'divider',
      bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
      position: first ? 'sticky' : 'static', left: first ? 0 : undefined, zIndex: first ? 1 : 0,
      textAlign: first ? 'left' : 'center',
      fontWeight: 700, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase',
    }}>
      {children}
    </Box>
  );
}

function GroupHeader({ children, colSpan }: { children: React.ReactNode; colSpan: number }) {
  return (
    <Box sx={{
      gridColumn: `1 / span ${colSpan + 1}`,
      px: 1.5, py: 0.75,
      bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
      fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase',
      color: 'primary.main',
      borderBottom: 1, borderColor: 'divider',
    }}>
      {children}
    </Box>
  );
}

function ModuleCell({ children, first, center }: { children: React.ReactNode; first?: boolean; center?: boolean }) {
  return (
    <Box sx={{
      px: 1.5, py: 1,
      borderBottom: 1, borderColor: 'divider',
      borderRight: first ? 1 : 0, borderRightColor: 'divider',
      position: first ? 'sticky' : 'static', left: first ? 0 : undefined,
      bgcolor: 'background.paper',
      display: center ? 'flex' : 'block',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </Box>
  );
}

/**
 * Slightly tinted variant of ModuleCell for feature sub-rows so the
 * matrix has clear visual hierarchy when a module is expanded.
 */
function FeatureCell({ children, first, center }: { children: React.ReactNode; first?: boolean; center?: boolean }) {
  return (
    <Box sx={{
      px: 1.5, py: 0.5,
      borderBottom: 1, borderColor: 'divider',
      borderRight: first ? 1 : 0, borderRightColor: 'divider',
      position: first ? 'sticky' : 'static', left: first ? 0 : undefined,
      bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.025 : 0.015),
      display: center ? 'flex' : 'block',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </Box>
  );
}
