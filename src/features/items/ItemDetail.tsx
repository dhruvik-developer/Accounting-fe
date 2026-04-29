/**
 * Right pane shown when an item is selected. Mirrors the Parties detail
 * layout so the two pages feel like one product.
 *
 * Header   : SKU + name + status chip + Edit / Delete
 * KPIs     : Current stock · Stock value · Sale price · Reorder status
 * Tabs     :
 *   • Overview              — quick facts + reorder indicator
 *   • Stock by warehouse    — /items/{id}/stock-by-warehouse/
 *   • Movements             — /inventory/movements/?item=
 *   • Pricing               — sale, purchase, MRP, margins
 *   • Info                  — barcode, HSN, accounts, batches/serials
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Divider, Grid, IconButton, Paper, Skeleton, Stack,
  Tab, Tabs, Tooltip, Typography, alpha,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import HistoryIcon from '@mui/icons-material/History';
import dayjs from 'dayjs';
import { api } from '@/app/api';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import MoneyDisplay, { formatMoney } from '@/components/MoneyDisplay';

const listOf = (data: any) => data?.results ?? data ?? [];
const num = (v: any) => Number(v || 0);

type Props = {
  item: any | null;
  // Pass `undefined` to hide the Edit / Delete buttons (e.g. when the
  // active branch has the module set to read-only).
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
};

export default function ItemDetail({ item, onEdit, onDelete }: Props) {
  if (!item) {
    return (
      <Paper sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 4 }}>
        <EmptyState
          icon={<Inventory2Icon />}
          title="Select an item"
          body="Pick a product or service from the left to see stock, movements and pricing."
        />
      </Paper>
    );
  }
  return <Loaded key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />;
}

function Loaded({ item, onEdit, onDelete }: Pick<Props, 'onEdit' | 'onDelete'> & { item: any }) {
  const [tab, setTab] = useState(0);

  const stock = item.is_serialized ? num(item.available_serials) : num(item.stock_on_hand);
  const reorder = num(item.min_stock_level || item.reorder_level);
  const status: 'out' | 'low' | 'ok' | 'negative' | 'untracked' =
    !item.track_inventory ? 'untracked'
    : stock < 0 ? 'negative'
    : stock === 0 ? 'out'
    : (reorder > 0 && stock <= reorder) ? 'low'
    : 'ok';
  const statusColor =
    status === 'negative' ? '#D500F9'
    : status === 'out' ? '#FF5252'
    : status === 'low' ? '#FFB300'
    : status === 'ok' ? '#00E676'
    : '#B0B0B0';
  const statusLabel = {
    out: 'Out of stock', low: 'Low stock', ok: 'In stock',
    negative: 'Negative balance', untracked: 'Not tracked',
  }[status];

  const margin = useMemo(() => {
    const sale = num(item.sale_price);
    const cost = num(item.purchase_price);
    if (sale <= 0 || cost <= 0) return null;
    return ((sale - cost) / sale) * 100;
  }, [item]);

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }} justifyContent="space-between">
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }} noWrap>
                {item.name}
              </Typography>
              <Chip
                size="small"
                label={item.type === 'service' ? 'Service' : 'Product'}
                sx={{ textTransform: 'capitalize', fontWeight: 700 }}
              />
              {item.is_serialized && <Chip size="small" icon={<QrCodeScannerIcon />} label="Serialized" color="primary" />}
              {item.is_batch_tracked && <Chip size="small" icon={<Inventory2Icon />} label="Batch + expiry" color="secondary" />}
              {item.is_active === false && <Chip size="small" label="Inactive" />}
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ color: 'text.secondary' }}>
              <Typography variant="body2" sx={{ fontFamily: '"IBM Plex Mono", monospace' }}>
                {item.sku}
              </Typography>
              {item.category_name && <Typography variant="body2">· {item.category_name}</Typography>}
              {item.unit_code && <Typography variant="body2">· per {item.unit_code}</Typography>}
              {item.tax_rate_value != null && <Typography variant="body2">· GST {item.tax_rate_value}%</Typography>}
              {item.hsn_code && <Typography variant="body2">· HSN {item.hsn_code}</Typography>}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            {/* `onEdit` / `onDelete` are passed as undefined when the active
                branch has read-only access, so the buttons disappear cleanly. */}
            {onEdit && (
              <Button startIcon={<EditIcon />} size="small" variant="outlined" onClick={() => onEdit(item)}>
                Edit
              </Button>
            )}
            {onDelete && (
              <Tooltip title="Delete item">
                <IconButton size="small" onClick={() => onDelete(item)} sx={{ color: 'error.main' }}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Current stock"
              value={status === 'untracked' ? '—' : stock.toLocaleString()}
              accent={statusColor}
              icon={<Inventory2Icon fontSize="small" />}
              hint={item.unit_code || ''}
              index={0}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Stock value"
              value={status === 'untracked'
                ? '—'
                : formatMoney(stock * num(item.purchase_price), { short: true })}
              accent="#4FC3F7"
              icon={<WarehouseIcon fontSize="small" />}
              hint={item.purchase_price ? `@ ${formatMoney(num(item.purchase_price), { fractionDigits: 0 })}` : undefined}
              index={1}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Sale price"
              value={item.sale_price ? formatMoney(num(item.sale_price), { fractionDigits: 0 }) : '—'}
              accent="#00E676"
              icon={<LocalShippingIcon fontSize="small" />}
              hint={margin != null ? `Margin ${margin.toFixed(1)}%` : undefined}
              index={2}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Status"
              value={statusLabel}
              accent={statusColor}
              icon={<HistoryIcon fontSize="small" />}
              hint={reorder > 0 ? `Reorder at ${reorder}` : 'No reorder set'}
              index={3}
            />
          </Grid>
        </Grid>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 1.5, minHeight: 40 }}
        variant="scrollable" scrollButtons="auto"
      >
        <Tab label="Overview" sx={{ minHeight: 40, textTransform: 'none' }} />
        <Tab
          label={item.is_serialized ? 'Serials'
            : item.is_batch_tracked ? 'Batches'
            : 'Stock by warehouse'}
          sx={{ minHeight: 40, textTransform: 'none' }}
        />
        <Tab label="Customers" sx={{ minHeight: 40, textTransform: 'none' }} />
        <Tab label="Suppliers" sx={{ minHeight: 40, textTransform: 'none' }} />
        <Tab label="Movements" sx={{ minHeight: 40, textTransform: 'none' }} />
        <Tab label="Pricing"   sx={{ minHeight: 40, textTransform: 'none' }} />
        <Tab label="Info"      sx={{ minHeight: 40, textTransform: 'none' }} />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {tab === 0 && <OverviewTab item={item} status={status} reorder={reorder} stock={stock} />}
        {tab === 1 && (
          item.is_serialized ? <SerialsTab itemId={item.id} />
            : item.is_batch_tracked ? <BatchesTab itemId={item.id} />
            : <WarehouseTab itemId={item.id} />
        )}
        {tab === 2 && <CustomersTab itemId={item.id} preferredId={item.preferred_customer} />}
        {tab === 3 && <SuppliersTab itemId={item.id} preferredId={item.preferred_supplier} />}
        {tab === 4 && <MovementsTab itemId={item.id} />}
        {tab === 5 && <PricingTab item={item} margin={margin} />}
        {tab === 6 && <InfoTab item={item} />}
      </Box>
    </Paper>
  );
}

// ---------- Overview ------------------------------------------------------

function OverviewTab({ item, status, reorder, stock }: { item: any; status: string; reorder: number; stock: number }) {
  return (
    <Stack spacing={2}>
      <InfoCard title="Description">
        <Typography variant="body2" color={item.description ? 'text.primary' : 'text.disabled'}>
          {item.description || 'No description on file.'}
        </Typography>
      </InfoCard>
      <InfoCard title="Inventory">
        <KV label="Tracked" value={item.track_inventory ? 'Yes' : 'No'} />
        <KV label="Mode" value={
          item.is_serialized ? 'Serial-tracked'
          : item.is_batch_tracked ? 'Batch-tracked'
          : item.track_inventory ? 'Quantity-tracked'
          : 'Not tracked'
        } />
        <KV label="Min level" value={String(item.min_stock_level ?? 0)} />
        <KV label="Max level" value={String(item.max_stock_level ?? 0)} />
        <KV label="Reorder qty" value={String(item.reorder_qty ?? 0)} />
        <KV label="Reorder level" value={String(item.reorder_level ?? 0)} />
      </InfoCard>
      {status === 'low' && reorder > 0 && (
        <Alert severity="warning">
          Stock ({stock}) is at or below reorder level ({reorder}). Consider raising a purchase order.
        </Alert>
      )}
      {status === 'out' && (
        <Alert severity="error">Out of stock. New sales for this item will create negative balance.</Alert>
      )}
      {status === 'negative' && (
        <Alert severity="error">Negative balance — there's been a sale without matching purchase or opening stock.</Alert>
      )}
    </Stack>
  );
}

// ---------- Stock by warehouse -------------------------------------------

type WarehouseRow = {
  warehouse_id: string;
  warehouse_name: string;
  warehouse_code: string;
  branch_name: string;
  qty_in: string;
  qty_out: string;
  balance: string;
  average_cost: string;
  value: string;
  is_negative: boolean;
};

function WarehouseTab({ itemId }: { itemId: string }) {
  const [rows, setRows] = useState<WarehouseRow[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setRows(null);
    setErr('');
    api.get(`/items/${itemId}/stock-by-warehouse/`)
      .then((r) => setRows(r.data))
      .catch((e) => setErr(e?.response?.data?.detail || e?.message || 'Failed to load stock breakdown'));
  }, [itemId]);

  if (err) return <Alert severity="error">{err}</Alert>;
  if (rows === null) return <Skeleton variant="rounded" height={220} />;
  if (rows.length === 0) {
    return <EmptyState compact title="No movements yet"
      body="Once you record opening stock, purchases or sales, per-warehouse stock will appear here." />;
  }

  return (
    <Paper variant="outlined">
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 90px 90px 110px 130px 140px',
        bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
        px: 1.5, py: 1, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
        textTransform: 'uppercase', color: 'text.secondary',
        borderBottom: 1, borderColor: 'divider',
      }}>
        <Box>Warehouse</Box>
        <Box sx={{ textAlign: 'right' }}>In</Box>
        <Box sx={{ textAlign: 'right' }}>Out</Box>
        <Box sx={{ textAlign: 'right' }}>Balance</Box>
        <Box sx={{ textAlign: 'right' }}>Avg cost</Box>
        <Box sx={{ textAlign: 'right' }}>Value</Box>
      </Box>
      {rows.map((r) => {
        const balance = num(r.balance);
        const balanceColor = r.is_negative ? '#D500F9' : balance > 0 ? '#00E676' : 'text.disabled';
        return (
          <Box key={r.warehouse_id || r.warehouse_name} sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 90px 90px 110px 130px 140px',
            px: 1.5, py: 1, alignItems: 'center', fontSize: 13,
            borderBottom: 1, borderColor: 'divider',
            '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.025) },
          }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {r.warehouse_name}
              </Typography>
              {r.branch_name && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {r.branch_name}
                </Typography>
              )}
            </Box>
            <Box sx={{ textAlign: 'right', color: 'text.secondary' }}>{num(r.qty_in).toLocaleString()}</Box>
            <Box sx={{ textAlign: 'right', color: 'text.secondary' }}>{num(r.qty_out).toLocaleString()}</Box>
            <Box sx={{ textAlign: 'right', fontWeight: 700, color: balanceColor }}>
              {balance.toLocaleString()}
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <MoneyDisplay value={num(r.average_cost)} fractionDigits={0} />
            </Box>
            <Box sx={{ textAlign: 'right', fontWeight: 700 }}>
              <MoneyDisplay value={num(r.value)} fractionDigits={0} />
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
}

// ---------- Serials -------------------------------------------------------

const SERIAL_STATUS_COLOR: Record<string, string> = {
  available:   '#00E676',
  reserved:    '#4FC3F7',
  sold:        '#B0B0B0',
  returned:    '#FFB300',
  damaged:     '#FF5252',
  transferred: '#B388FF',
  inactive:    '#90A4AE',
};

function SerialsTab({ itemId }: { itemId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    setRows(null);
    setErr('');
    api.get(`/items/${itemId}/serials/`, { params: { page_size: 1000 } })
      .then((r) => setRows(listOf(r.data)))
      .catch((e) => setErr(e?.response?.data?.detail || e?.message || 'Failed to load serials'));
  }, [itemId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    (rows || []).forEach((r) => {
      c.all += 1;
      c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (rows || []).filter((r) => statusFilter === 'all' || r.status === statusFilter),
    [rows, statusFilter],
  );

  if (err) return <Alert severity="error">{err}</Alert>;
  if (rows === null) return <Skeleton variant="rounded" height={260} />;
  if (rows.length === 0) {
    return <EmptyState compact title="No serials yet"
      body="This item is serial-tracked but no individual units have been added. Add them via the wizard or a purchase entry." />;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        {(['all', 'available', 'sold', 'reserved', 'damaged', 'returned'] as const).map((s) => {
          const active = statusFilter === s;
          const color = s === 'all' ? '#90A4AE' : SERIAL_STATUS_COLOR[s];
          const n = counts[s] || 0;
          if (s !== 'all' && n === 0) return null;
          return (
            <Chip
              key={s} size="small" clickable
              label={`${s === 'all' ? 'All' : s} · ${n}`}
              onClick={() => setStatusFilter(s)}
              sx={{
                height: 24, fontWeight: 700, fontSize: 11, textTransform: 'capitalize',
                color: active ? color : 'text.secondary',
                bgcolor: active ? alpha(color, 0.18) : 'transparent',
                border: (t) => `1px solid ${active ? alpha(color, 0.5) : alpha(t.palette.text.primary, 0.15)}`,
              }}
            />
          );
        })}
      </Stack>

      <Paper variant="outlined">
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 110px 1fr 110px 110px 1fr',
          bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
          px: 1.5, py: 1, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
          textTransform: 'uppercase', color: 'text.secondary',
          borderBottom: 1, borderColor: 'divider',
        }}>
          <Box>Serial</Box>
          <Box>Status</Box>
          <Box>Warehouse</Box>
          <Box>Received</Box>
          <Box>Warranty till</Box>
          <Box>Customer</Box>
        </Box>
        {filtered.map((r) => {
          const color = SERIAL_STATUS_COLOR[r.status] || '#90A4AE';
          const warrantyEnd = r.warranty_end ? dayjs(r.warranty_end) : null;
          const warrantyDaysLeft = warrantyEnd ? warrantyEnd.diff(dayjs(), 'day') : null;
          return (
            <Box key={r.id} sx={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 110px 1fr 110px 110px 1fr',
              px: 1.5, py: 1, alignItems: 'center', fontSize: 13,
              borderBottom: 1, borderColor: 'divider',
              '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.025) },
            }}>
              <Typography variant="body2" sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }} noWrap>
                {r.serial_number}
              </Typography>
              <Box>
                <Chip size="small" label={r.status} sx={{
                  height: 20, fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                  color, bgcolor: alpha(color, 0.15),
                  border: `1px solid ${alpha(color, 0.4)}`,
                }} />
              </Box>
              <Typography variant="body2" color="text.secondary" noWrap>
                {r.warehouse_name || '—'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {r.received_at ? dayjs(r.received_at).format('DD MMM YY') : '—'}
              </Typography>
              <Typography variant="body2" sx={{
                color: warrantyDaysLeft != null && warrantyDaysLeft < 0 ? '#FF5252'
                  : warrantyDaysLeft != null && warrantyDaysLeft <= 30 ? '#FFB300'
                  : 'text.secondary',
                fontWeight: warrantyDaysLeft != null && warrantyDaysLeft <= 30 ? 700 : 400,
              }}>
                {warrantyEnd ? warrantyEnd.format('DD MMM YY') : '—'}
              </Typography>
              <Typography variant="body2" color={r.customer_name ? 'text.primary' : 'text.disabled'} noWrap>
                {r.customer_name || '—'}
              </Typography>
            </Box>
          );
        })}
        {filtered.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No serials match this filter.
            </Typography>
          </Box>
        )}
      </Paper>
      <Typography variant="caption" color="text.secondary">
        {filtered.length} of {rows.length} serials shown
      </Typography>
    </Stack>
  );
}

// ---------- Batches -------------------------------------------------------

function batchExpiryStatus(expiry: string | null): { label: string; color: string; days: number | null } {
  if (!expiry) return { label: 'No expiry', color: '#90A4AE', days: null };
  const days = dayjs(expiry).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (days < 0) return { label: 'Expired', color: '#FF5252', days };
  if (days <= 30) return { label: 'Expiring soon', color: '#FFB300', days };
  if (days <= 90) return { label: 'Expires < 3 mo', color: '#FFC400', days };
  return { label: 'Healthy', color: '#00E676', days };
}

function BatchesTab({ itemId }: { itemId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'all' | 'expired' | 'soon' | 'healthy'>('all');

  useEffect(() => {
    setRows(null);
    setErr('');
    api.get(`/items/${itemId}/batches/`, { params: { page_size: 1000 } })
      .then((r) => setRows(listOf(r.data)))
      .catch((e) => setErr(e?.response?.data?.detail || e?.message || 'Failed to load batches'));
  }, [itemId]);

  const enriched = useMemo(
    () => (rows || []).map((r) => ({ ...r, _expiry: batchExpiryStatus(r.expiry_date) })),
    [rows],
  );

  const counts = useMemo(() => {
    let expired = 0, soon = 0, healthy = 0;
    enriched.forEach((r) => {
      if (r._expiry.days != null && r._expiry.days < 0) expired += 1;
      else if (r._expiry.days != null && r._expiry.days <= 30) soon += 1;
      else healthy += 1;
    });
    return { all: enriched.length, expired, soon, healthy };
  }, [enriched]);

  const filtered = useMemo(() => enriched.filter((r) => {
    if (filter === 'all') return true;
    const d = r._expiry.days;
    if (filter === 'expired') return d != null && d < 0;
    if (filter === 'soon')    return d != null && d >= 0 && d <= 30;
    if (filter === 'healthy') return d == null || d > 30;
    return true;
  }), [enriched, filter]);

  const totals = useMemo(() => {
    let qty = 0;
    enriched.forEach((r) => { qty += num(r.qty_available); });
    return { qty };
  }, [enriched]);

  if (err) return <Alert severity="error">{err}</Alert>;
  if (rows === null) return <Skeleton variant="rounded" height={260} />;
  if (rows.length === 0) {
    return <EmptyState compact title="No batches yet"
      body="This item is batch-tracked but no batches have been recorded. Add them via the wizard or a purchase entry." />;
  }

  return (
    <Stack spacing={1.5}>
      {counts.expired > 0 && (
        <Alert severity="error" sx={{ py: 0.5 }}>
          <strong>{counts.expired}</strong> batch{counts.expired === 1 ? '' : 'es'} expired —
          remove from saleable stock.
        </Alert>
      )}
      {counts.soon > 0 && (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          <strong>{counts.soon}</strong> batch{counts.soon === 1 ? '' : 'es'} expiring within 30 days.
        </Alert>
      )}

      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        {([
          ['all',     'All',           '#90A4AE', counts.all],
          ['expired', 'Expired',       '#FF5252', counts.expired],
          ['soon',    'Expiring soon', '#FFB300', counts.soon],
          ['healthy', 'Healthy',       '#00E676', counts.healthy],
        ] as const).map(([k, label, color, n]) => {
          const active = filter === k;
          if (k !== 'all' && n === 0) return null;
          return (
            <Chip
              key={k} size="small" clickable
              label={`${label} · ${n}`}
              onClick={() => setFilter(k)}
              sx={{
                height: 24, fontWeight: 700, fontSize: 11,
                color: active ? color : 'text.secondary',
                bgcolor: active ? alpha(color, 0.18) : 'transparent',
                border: (t) => `1px solid ${active ? alpha(color, 0.5) : alpha(t.palette.text.primary, 0.15)}`,
              }}
            />
          );
        })}
      </Stack>

      <Paper variant="outlined">
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 110px 110px 110px 1fr 130px',
          bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
          px: 1.5, py: 1, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
          textTransform: 'uppercase', color: 'text.secondary',
          borderBottom: 1, borderColor: 'divider',
        }}>
          <Box>Batch #</Box>
          <Box sx={{ textAlign: 'right' }}>Qty</Box>
          <Box>MFG</Box>
          <Box>Expiry</Box>
          <Box>Warehouse</Box>
          <Box sx={{ textAlign: 'center' }}>Status</Box>
        </Box>
        {filtered.map((r) => {
          const exp = r._expiry;
          return (
            <Box key={r.id} sx={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 110px 110px 110px 1fr 130px',
              px: 1.5, py: 1, alignItems: 'center', fontSize: 13,
              borderBottom: 1, borderColor: 'divider',
              '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.025) },
            }}>
              <Typography variant="body2"
                sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }} noWrap>
                {r.batch_number}
              </Typography>
              <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 600 }}>
                {num(r.qty_available).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {r.mfg_date ? dayjs(r.mfg_date).format('DD MMM YY') : '—'}
              </Typography>
              <Stack direction="column">
                <Typography variant="body2" sx={{ color: exp.color, fontWeight: 700 }}>
                  {r.expiry_date ? dayjs(r.expiry_date).format('DD MMM YY') : '—'}
                </Typography>
                {exp.days != null && (
                  <Typography variant="caption" color="text.secondary">
                    {exp.days < 0 ? `${Math.abs(exp.days)}d ago` : `in ${exp.days}d`}
                  </Typography>
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary" noWrap>
                {r.warehouse_name || '—'}
              </Typography>
              <Box sx={{ textAlign: 'center' }}>
                <Chip size="small" label={exp.label} sx={{
                  height: 22, fontSize: 11, fontWeight: 700,
                  color: exp.color,
                  bgcolor: alpha(exp.color, 0.15),
                  border: `1px solid ${alpha(exp.color, 0.4)}`,
                }} />
              </Box>
            </Box>
          );
        })}
        {filtered.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No batches match this filter.
            </Typography>
          </Box>
        )}
      </Paper>
      <Typography variant="caption" color="text.secondary">
        {filtered.length} of {rows.length} batches shown · total qty across all batches: {totals.qty.toLocaleString()}
      </Typography>
    </Stack>
  );
}

// ---------- Customers / Suppliers (sales + purchase analytics) ------------

type AnalyticsRow = {
  party_id: string;
  party_name: string;
  party_phone: string;
  qty: string;
  revenue?: string;
  spend?: string;
  avg_rate: string;
  last_date: string | null;
  count: number;
};

function CustomersTab({ itemId, preferredId }: { itemId: string; preferredId?: string }) {
  return <PartiesAnalytics
    itemId={itemId}
    preferredId={preferredId}
    endpoint="top-customers"
    metricKey="revenue"
    metricLabel="Revenue"
    avgKey="avg_price"
    avgLabel="Average sell price"
    accent="#00E676"
    emptyTitle="No customers yet"
    emptyBody="Once you raise a sales invoice for this item, top buyers will appear here."
  />;
}

function SuppliersTab({ itemId, preferredId }: { itemId: string; preferredId?: string }) {
  return <PartiesAnalytics
    itemId={itemId}
    preferredId={preferredId}
    endpoint="top-suppliers"
    metricKey="spend"
    metricLabel="Spend"
    avgKey="avg_cost"
    avgLabel="Average buy price"
    accent="#4FC3F7"
    emptyTitle="No suppliers yet"
    emptyBody="Once you record a purchase bill for this item, top suppliers will appear here."
  />;
}

function PartiesAnalytics({
  itemId, preferredId, endpoint, metricKey, metricLabel,
  avgKey, avgLabel, accent, emptyTitle, emptyBody,
}: {
  itemId: string;
  preferredId?: string;
  endpoint: 'top-customers' | 'top-suppliers';
  metricKey: 'revenue' | 'spend';
  metricLabel: string;
  avgKey: 'avg_price' | 'avg_cost';
  avgLabel: string;
  accent: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const nav = useNavigate();
  const [data, setData] = useState<{ rows: AnalyticsRow[]; avg: string } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setData(null);
    setErr('');
    api.get(`/items/${itemId}/${endpoint}/`)
      .then((r) => setData({
        rows: r.data.rows || [],
        avg: r.data[avgKey] || '0',
      }))
      .catch((e) => setErr(e?.response?.data?.detail || e?.message || 'Failed to load'));
  }, [itemId, endpoint, avgKey]);

  if (err) return <Alert severity="error">{err}</Alert>;
  if (data === null) return <Skeleton variant="rounded" height={260} />;
  if (data.rows.length === 0) {
    return <EmptyState compact title={emptyTitle} body={emptyBody} />;
  }

  // Top row's metric drives the bar widths so the leader fills 100%.
  const max = data.rows.reduce(
    (acc, r) => Math.max(acc, num(r[metricKey] as keyof AnalyticsRow as any)),
    1,
  );
  const avgPrice = num(data.avg);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`${avgLabel}: ${formatMoney(avgPrice, { fractionDigits: 2 })}`}
          sx={{ height: 22, fontSize: 11, fontWeight: 700,
            color: accent, bgcolor: alpha(accent, 0.12),
            border: `1px solid ${alpha(accent, 0.32)}` }} />
        <Chip size="small" label={`${data.rows.length} parties`}
          sx={{ height: 22, fontSize: 11 }} />
      </Stack>

      <Paper variant="outlined">
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 110px 110px 110px',
          bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
          px: 1.5, py: 1, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
          textTransform: 'uppercase', color: 'text.secondary',
          borderBottom: 1, borderColor: 'divider',
        }}>
          <Box>Party</Box>
          <Box>{metricLabel}</Box>
          <Box sx={{ textAlign: 'right' }}>Qty</Box>
          <Box sx={{ textAlign: 'right' }}>Avg rate</Box>
          <Box>Last</Box>
        </Box>
        {data.rows.slice(0, 20).map((r) => {
          const metricVal = num(r[metricKey] as keyof AnalyticsRow as any);
          const pct = max > 0 ? (metricVal / max) * 100 : 0;
          const lineAvg = num(r.avg_rate);
          // Margin alert: this party's average rate drifted > 10% from the
          // overall avg. For customers, "low" is bad (they're under-paying);
          // for suppliers, "high" is bad (they're over-charging).
          const drift = avgPrice > 0 ? ((lineAvg - avgPrice) / avgPrice) * 100 : 0;
          const concerning =
            (metricKey === 'revenue' && drift < -10)
            || (metricKey === 'spend' && drift > 10);
          const isPreferred = r.party_id === preferredId;
          return (
            <Box key={r.party_id} sx={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 110px 110px 110px',
              px: 1.5, py: 1, alignItems: 'center', fontSize: 13,
              borderBottom: 1, borderColor: 'divider',
              cursor: 'pointer',
              '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.025) },
            }}
              onClick={() => nav(`/parties?party_id=${r.party_id}`)}
            >
              <Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {r.party_name}
                  </Typography>
                  {isPreferred && (
                    <Chip size="small" label="Preferred" sx={{
                      height: 16, fontSize: 9, fontWeight: 700, color: '#FFB300',
                      bgcolor: alpha('#FFB300', 0.14),
                      border: `1px solid ${alpha('#FFB300', 0.34)}`,
                    }} />
                  )}
                </Stack>
                {r.party_phone && (
                  <Typography variant="caption" color="text.secondary">{r.party_phone}</Typography>
                )}
              </Stack>
              <Stack>
                <Box sx={{
                  height: 8, borderRadius: 999,
                  bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                }}>
                  <Box sx={{
                    height: '100%', width: `${Math.max(2, pct)}%`,
                    background: `linear-gradient(90deg, ${accent}, ${alpha(accent, 0.6)})`,
                    borderRadius: 999, transition: 'width 350ms ease',
                  }} />
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 700, mt: 0.25 }}>
                  {formatMoney(metricVal, { fractionDigits: 0 })}
                  <Typography component="span" variant="caption" color="text.secondary"
                    sx={{ ml: 0.5 }}>
                    · {r.count} {r.count === 1 ? 'doc' : 'docs'}
                  </Typography>
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ textAlign: 'right' }}>
                {num(r.qty).toLocaleString()}
              </Typography>
              <Stack alignItems="flex-end">
                <MoneyDisplay value={lineAvg} fractionDigits={0}
                  sx={{ fontWeight: 700, color: concerning ? '#FF5252' : 'text.primary' }} />
                {avgPrice > 0 && Math.abs(drift) >= 5 && (
                  <Typography variant="caption" sx={{
                    color: concerning ? '#FF5252' : 'text.secondary', fontWeight: 600,
                  }}>
                    {drift > 0 ? '+' : ''}{drift.toFixed(0)}% vs avg
                  </Typography>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {r.last_date ? dayjs(r.last_date).format('DD MMM YY') : '—'}
              </Typography>
            </Box>
          );
        })}
      </Paper>
    </Stack>
  );
}

// ---------- Movements -----------------------------------------------------

function MovementsTab({ itemId }: { itemId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setRows(null);
    setErr('');
    api.get('/inventory/movements/', { params: { item: itemId, page_size: 100 } })
      .then((r) => setRows(listOf(r.data)))
      .catch((e) => setErr(e?.response?.data?.detail || e?.message || 'Failed to load movements'));
  }, [itemId]);

  if (err) return <Alert severity="error">{err}</Alert>;
  if (rows === null) return <Skeleton variant="rounded" height={220} />;
  if (rows.length === 0) {
    return <EmptyState compact title="No stock movements yet"
      body="Opening stock, purchase receipts, sales and adjustments will appear here." />;
  }

  return (
    <Stack spacing={1}>
      {rows.map((m) => {
        const inn = num(m.qty_in);
        const out = num(m.qty_out);
        return (
          <Paper key={m.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" label={m.type} sx={{
                    textTransform: 'capitalize', height: 20, fontSize: 10, fontWeight: 700,
                  }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {m.ref_number || m.ref_type || 'Movement'}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {dayjs(m.date).format('DD MMM YYYY')}
                  {m.warehouse_name && ` · ${m.warehouse_name}`}
                </Typography>
              </Box>
              <Stack alignItems="flex-end">
                {inn > 0 && (
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#00E676' }}>
                    + {inn.toLocaleString()}
                  </Typography>
                )}
                {out > 0 && (
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#FF5252' }}>
                    − {out.toLocaleString()}
                  </Typography>
                )}
                {num(m.rate) > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    @ <MoneyDisplay value={num(m.rate)} fractionDigits={0} />
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

// ---------- Pricing -------------------------------------------------------

function PricingTab({ item, margin }: { item: any; margin: number | null }) {
  return (
    <Stack spacing={2}>
      <InfoCard title="Selling">
        <KV label="Sale price" value={item.sale_price ? formatMoney(num(item.sale_price)) : '—'} />
        <KV label="MRP" value={item.mrp ? formatMoney(num(item.mrp)) : '—'} />
        <KV label="GST rate" value={item.tax_rate_value != null ? `${item.tax_rate_value}%` : '—'} />
        <KV label="HSN/SAC" value={item.hsn_code || '—'} mono />
      </InfoCard>
      <InfoCard title="Buying">
        <KV label="Purchase price" value={item.purchase_price ? formatMoney(num(item.purchase_price)) : '—'} />
        <KV label="Margin" value={margin != null ? `${margin.toFixed(1)}%` : '—'} />
        <KV label="Purchase unit" value={item.purchase_unit_code || item.unit_code || '—'} />
        <KV label="Sales unit" value={item.sales_unit_code || item.unit_code || '—'} />
      </InfoCard>
    </Stack>
  );
}

// ---------- Info ----------------------------------------------------------

function InfoTab({ item }: { item: any }) {
  return (
    <Stack spacing={2}>
      <InfoCard title="Identifiers">
        <KV label="SKU" value={item.sku || '—'} mono />
        <KV label="Barcode" value={item.barcode || '—'} mono />
        <KV label="HSN/SAC" value={item.hsn_code || '—'} mono />
      </InfoCard>
      <InfoCard title="Accounting">
        <KV label="Sales account" value={item.sales_account_name || (item.sales_account ? '(custom)' : 'Default')} />
        <KV label="Purchase account" value={item.purchase_account_name || (item.purchase_account ? '(custom)' : 'Default')} />
        <KV label="Inventory account" value={item.inventory_account_name || (item.inventory_account ? '(custom)' : 'Default')} />
        <KV label="COGS account" value={item.cogs_account_name || (item.cogs_account ? '(custom)' : 'Default')} />
      </InfoCard>
      <InfoCard title="System">
        <KV label="Active" value={item.is_active === false ? 'No' : 'Yes'} />
        <KV label="Created" value={item.created_at ? dayjs(item.created_at).format('DD MMM YYYY') : '—'} />
        <KV label="Updated" value={item.updated_at ? dayjs(item.updated_at).format('DD MMM YYYY') : '—'} />
      </InfoCard>
    </Stack>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.75 }}>
      <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.6 }}>
        {title}
      </Typography>
      <Divider sx={{ my: 1 }} />
      <Stack spacing={0.5}>{children}</Stack>
    </Paper>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 0.25 }}>
      <Typography variant="caption" color="text.secondary" sx={{ width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{
        fontFamily: mono ? '"IBM Plex Mono", monospace' : undefined,
        wordBreak: 'break-word',
      }}>
        {value}
      </Typography>
    </Stack>
  );
}
