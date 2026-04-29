/**
 * Items — top-level container.
 *
 * 2-pane layout matching Parties:
 *   • Left  : ItemList (search, filter chips, slim rows)
 *   • Right : ItemDetail (header, KPI cards, 5 tabs)
 *
 * Premium touch: a stock-alert strip above the panes. It summarises low /
 * out-of-stock / negative items at a glance and is clickable — each chip
 * jumps the left-pane filter to the matching status.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Stack, Typography, alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { api } from '@/app/api';
import useAutoOpenCreate from '@/hooks/useAutoOpenCreate';
import { useBranchModules } from '@/hooks/useBranchModules';
import { useCan } from '@/components/Can';
import { notify } from '@/components/Notifier';
import ConfirmDialog from '@/components/ConfirmDialog';
import ItemList, { DEFAULT_ITEM_FILTERS, ItemFilters } from './ItemList';
import ItemDetail from './ItemDetail';
import ItemForm from './ItemForm';

const listOf = (data: any) => data?.results ?? data ?? [];
const num = (v: any) => Number(v || 0);

const BARCODE_DEFAULT = {
  enabled: true,
  prefix: 'VEN',
  product_segment: 'PRODUCT',
  service_segment: 'SERVICE',
  separator: '-',
  padding: 4,
  start: 1,
};

const describeError = (e: any) =>
  e?.response?.data?.detail
  || (e?.response?.data && JSON.stringify(e.response.data))
  || e?.message
  || 'Request failed';

export default function Items() {
  const { canWrite, isModuleReadonly } = useBranchModules();
  const branchWritable = canWrite('module_items');
  const readonly = isModuleReadonly('module_items');
  const canCreate = useCan('masters.items.create');
  const canEditPerm = useCan('masters.items.edit');
  const canDeletePerm = useCan('masters.items.delete');
  const writable = branchWritable && canCreate;
  const [rows, setRows] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [barcodeSetting, setBarcodeSetting] = useState<any>(BARCODE_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filters, setFilters] = useState<ItemFilters>(DEFAULT_ITEM_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  // Stock alerts derived from the loaded list — no extra API call.
  const alerts = useMemo(() => {
    let low = 0, out = 0, negative = 0;
    rows.forEach((r) => {
      if (!r.track_inventory) return;
      const stock = r.is_serialized ? num(r.available_serials) : num(r.stock_on_hand);
      const reorder = num(r.min_stock_level || r.reorder_level);
      if (stock < 0) negative += 1;
      else if (stock === 0) out += 1;
      else if (reorder > 0 && stock <= reorder) low += 1;
    });
    return { low, out, negative };
  }, [rows]);

  const loadItems = () => {
    setLoading(true);
    return api.get('/items/', { params: { page_size: 1000 } })
      .then((r) => {
        const list = listOf(r.data);
        setRows(list);
        setSelectedId((curr) => {
          if (curr && list.some((p: any) => p.id === curr)) return curr;
          return list[0]?.id ?? null;
        });
        setErr('');
      })
      .catch((e) => { setRows([]); setErr(describeError(e)); })
      .finally(() => setLoading(false));
  };

  const loadMasters = async () => {
    const [rateRes, categoryRes, unitRes, branchRes, warehouseRes, accountRes, partyRes, barcodeRes] = await Promise.all([
      api.get('/taxes/rates/').catch(() => ({ data: [] })),
      api.get('/items/categories/').catch(() => ({ data: [] })),
      api.get('/items/units/').catch(() => ({ data: [] })),
      api.get('/branches/').catch(() => ({ data: [] })),
      api.get('/warehouses/').catch(() => ({ data: [] })),
      api.get('/accounting/accounts/').catch(() => ({ data: [] })),
      api.get('/parties/', { params: { page_size: 1000 } }).catch(() => ({ data: [] })),
      api.get('/preferences/numbering.item_barcode/').catch(() => ({ data: { value: BARCODE_DEFAULT } })),
    ]);
    setRates(listOf(rateRes.data));
    setCategories(listOf(categoryRes.data));
    setUnits(listOf(unitRes.data));
    setBranches(listOf(branchRes.data));
    setWarehouses(listOf(warehouseRes.data));
    setAccounts(listOf(accountRes.data));
    setParties(listOf(partyRes.data));
    setBarcodeSetting({ ...BARCODE_DEFAULT, ...(barcodeRes.data?.value || {}) });
  };

  // Refresh just the masters tables that the wizard can mutate inline
  // (categories, units) without re-fetching the whole world.
  const refreshMastersFromForm = async () => {
    const [c, u] = await Promise.all([
      api.get('/items/categories/').catch(() => ({ data: [] })),
      api.get('/items/units/').catch(() => ({ data: [] })),
    ]);
    setCategories(listOf(c.data));
    setUnits(listOf(u.data));
  };

  useEffect(() => {
    loadItems();
    loadMasters().catch((e) => setErr(describeError(e)));
  }, []);

  const startCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const startEdit = (item: any) => {
    setEditing(item);
    setFormOpen(true);
  };
  useAutoOpenCreate(startCreate);

  const onSaved = (saved: any) => {
    notify({
      severity: 'success',
      message: editing ? `Updated ${saved.name}` : `Created ${saved.name}`,
    });
    loadItems().then(() => setSelectedId(saved.id));
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/items/${deleteTarget.id}/`);
      notify({ severity: 'success', message: `Deleted ${deleteTarget.name}` });
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      loadItems();
    } catch (e) {
      setErr(describeError(e));
      setDeleteTarget(null);
    }
  };

  return (
    <Box sx={{
      height: 'calc(100vh - 96px)',
      display: 'flex', flexDirection: 'column',
    }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
            Items
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Products, services, pricing, GST, stock by warehouse — one place.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {readonly && (
            <Chip size="small" label="Read-only at this branch"
              sx={{ height: 22, fontWeight: 700, color: '#FFB300',
                bgcolor: (t) => alpha('#FFB300', t.palette.mode === 'dark' ? 0.18 : 0.12),
                border: (t) => `1px solid ${alpha('#FFB300', 0.32)}` }} />
          )}
          <Button startIcon={<RefreshIcon />} onClick={() => { loadItems(); loadMasters(); }}>
            Refresh
          </Button>
          {writable && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={startCreate}>
              New item
            </Button>
          )}
        </Stack>
      </Stack>

      <AlertStrip
        rowCount={rows.length}
        alerts={alerts}
        active={filters.stockStatus}
        onJump={(s) => setFilters({ ...filters, stockStatus: s })}
      />

      {err && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setErr('')}>{err}</Alert>}

      <Box sx={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, 380px) 1fr' },
        gap: 1.5,
      }}>
        <ItemList
          rows={rows}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filters={filters}
          setFilters={setFilters}
          categories={categories}
          rates={rates}
          loading={loading}
        />

        <Box sx={{
          display: { xs: selectedId ? 'block' : 'none', md: 'block' },
          minHeight: 0,
        }}>
          <ItemDetail
            item={selected}
            // Hide Edit / Delete on the detail header when the active branch
            // is read-only — pass undefined so ItemDetail doesn't render them.
            onEdit={branchWritable && canEditPerm ? startEdit : undefined}
            onDelete={branchWritable && canDeletePerm ? setDeleteTarget : undefined}
          />
        </Box>
      </Box>

      <ItemForm
        open={formOpen}
        editing={editing}
        rates={rates}
        categories={categories}
        units={units}
        branches={branches}
        warehouses={warehouses}
        accounts={accounts}
        parties={parties}
        barcodeSetting={barcodeSetting}
        existingItems={rows}
        onClose={() => setFormOpen(false)}
        onSaved={onSaved}
        onMastersChanged={refreshMastersFromForm}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name}?`}
        body="This will remove the item. Existing invoices and movements that reference it stay intact, but you won't be able to add new ones."
        tone="danger"
        confirmLabel="Delete"
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}

// ---- Stock-alert strip ---------------------------------------------------

function AlertStrip({ rowCount, alerts, active, onJump }: {
  rowCount: number;
  alerts: { low: number; out: number; negative: number };
  active: ItemFilters['stockStatus'];
  onJump: (status: ItemFilters['stockStatus']) => void;
}) {
  const total = alerts.low + alerts.out + alerts.negative;
  if (rowCount === 0) return null;
  if (total === 0) {
    return (
      <Box sx={{
        mb: 1.5, p: 1, borderRadius: 1,
        bgcolor: (t) => alpha('#00E676', t.palette.mode === 'dark' ? 0.1 : 0.08),
        border: (t) => `1px solid ${alpha('#00E676', t.palette.mode === 'dark' ? 0.4 : 0.3)}`,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00E676' }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          All stock levels healthy — {rowCount} items, no low stock or stock-outs.
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{
      mb: 1.5, p: 1.25, borderRadius: 1,
      bgcolor: (t) => alpha('#FFB300', t.palette.mode === 'dark' ? 0.08 : 0.06),
      border: (t) => `1px solid ${alpha('#FFB300', t.palette.mode === 'dark' ? 0.35 : 0.25)}`,
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25,
    }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <WarningAmberIcon sx={{ color: '#FFB300', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Stock alerts:
        </Typography>
      </Stack>
      <AlertChip label={`${alerts.low} low`}      color="#FFB300" active={active === 'low'}
        disabled={alerts.low === 0}      onClick={() => onJump(alerts.low ? 'low' : active)} />
      <AlertChip label={`${alerts.out} out`}      color="#FF5252" active={active === 'out'}
        disabled={alerts.out === 0}      onClick={() => onJump(alerts.out ? 'out' : active)} />
      <AlertChip label={`${alerts.negative} neg`} color="#D500F9" active={active === 'negative'}
        disabled={alerts.negative === 0} onClick={() => onJump(alerts.negative ? 'negative' : active)} />
      {active !== 'all' && (
        <Chip
          size="small" label="Clear filter" onClick={() => onJump('all')}
          sx={{ height: 24, fontSize: 11, ml: 'auto' }}
        />
      )}
    </Box>
  );
}

function AlertChip({ label, color, active, disabled, onClick }: {
  label: string; color: string; active: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <Chip
      size="small"
      label={label}
      clickable={!disabled}
      onClick={disabled ? undefined : onClick}
      sx={{
        height: 24, fontWeight: 700, fontSize: 11,
        color: disabled ? 'text.disabled' : color,
        bgcolor: active ? alpha(color, 0.18) : alpha(color, 0.08),
        border: `1px solid ${alpha(color, active ? 0.5 : 0.3)}`,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    />
  );
}
