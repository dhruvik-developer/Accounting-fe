/**
 * Inventory > Stock — warehouse-centric report.
 *
 * Different lens from /items (which is item-centric):
 *   • Pick a warehouse → see every item with qty + value at that location.
 *   • Top KPIs: items present · total value · low stock · out of stock · negative.
 *   • Search / category / status chips for in-page filtering.
 *
 * Data comes from /inventory/movements/summary/?warehouse=<id>. We also
 * pull /items/ once for category metadata that the summary doesn't return.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Grid, InputAdornment, MenuItem, Paper, Skeleton,
  Stack, TextField, Typography, alpha,
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottomOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PaidIcon from '@mui/icons-material/Paid';
import { api } from '@/app/api';
import { formatApiError } from '@/app/errors';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import MoneyDisplay, { formatMoney } from '@/components/MoneyDisplay';

const listOf = (data: any) => data?.results ?? data ?? [];
const num = (v: any) => Number(v || 0);

type StockRow = {
  item_id: string;
  sku: string;
  name: string;
  unit: string;
  opening: string;
  qty_in: string;
  qty_out: string;
  balance: string;
  average_cost: string;
  value: string;
  is_negative?: boolean;
  costing_method?: string;
  reorder_level?: string;
};

type Status = 'all' | 'in_stock' | 'low' | 'out' | 'negative';

const STATUS_CHIPS: { key: Status; label: string; color: string }[] = [
  { key: 'all',      label: 'All',       color: '#90A4AE' },
  { key: 'in_stock', label: 'In stock',  color: '#00E676' },
  { key: 'low',      label: 'Low',       color: '#FFB300' },
  { key: 'out',      label: 'Out',       color: '#FF5252' },
  { key: 'negative', label: 'Negative',  color: '#D500F9' },
];

export default function Stock() {
  const [params, setParams] = useSearchParams();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>(params.get('warehouse') || '');
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<Status>('all');

  // Hydrate warehouses + items metadata once.
  useEffect(() => {
    Promise.all([
      api.get('/warehouses/').catch(() => ({ data: [] })),
      api.get('/items/', { params: { page_size: 1000 } }).catch(() => ({ data: [] })),
    ]).then(([whRes, itRes]) => {
      const whs = listOf(whRes.data);
      setWarehouses(whs);
      setItems(listOf(itRes.data));
      // Auto-pick the default warehouse if URL didn't provide one.
      if (!warehouseId) {
        const def = whs.find((w: any) => w.is_default) || whs[0];
        if (def) {
          setWarehouseId(def.id);
          setParams((p) => { p.set('warehouse', def.id); return p; }, { replace: true });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = () => {
    setLoading(true);
    setErr('');
    api.get('/inventory/movements/summary/', {
      params: warehouseId ? { warehouse: warehouseId } : {},
    })
      .then((r) => setRows(r.data))
      .catch((e) => setErr(formatApiError(e, 'Failed to load stock')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [warehouseId]);

  const itemMeta = useMemo(() => new Map(items.map((it: any) => [it.id, it])), [items]);

  // Enrich rows with category + reorder + tax. The /summary/ payload doesn't
  // carry these — we look them up from the cached items list.
  const enriched = useMemo(() => rows.map((r) => {
    const meta = itemMeta.get(r.item_id);
    return {
      ...r,
      category: meta?.category || '',
      category_name: meta?.category_name || '',
      reorder: num(meta?.min_stock_level || meta?.reorder_level || r.reorder_level),
      tracked: meta?.track_inventory !== false,
      sale_price: meta?.sale_price,
    };
  }), [rows, itemMeta]);

  const totals = useMemo(() => {
    let value = 0, low = 0, out = 0, negative = 0, present = 0;
    enriched.forEach((r) => {
      const bal = num(r.balance);
      value += num(r.value);
      if (bal < 0) negative += 1;
      else if (bal === 0) out += 1;
      else if (r.reorder > 0 && bal <= r.reorder) low += 1;
      if (bal !== 0) present += 1;
    });
    return { items: enriched.length, present, value, low, out, negative };
  }, [enriched]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return enriched.filter((r) => {
      if (category !== 'all' && r.category !== category) return false;
      const bal = num(r.balance);
      switch (status) {
        case 'in_stock':
          if (bal <= 0 || (r.reorder > 0 && bal <= r.reorder)) return false;
          break;
        case 'low':
          if (r.reorder <= 0 || bal > r.reorder || bal <= 0) return false;
          break;
        case 'out':
          if (bal !== 0) return false;
          break;
        case 'negative':
          if (bal >= 0) return false;
          break;
      }
      if (!needle) return true;
      return r.name?.toLowerCase().includes(needle)
        || r.sku?.toLowerCase().includes(needle)
        || r.category_name?.toLowerCase().includes(needle);
    });
  }, [enriched, q, category, status]);

  const parentCategories = useMemo(() => {
    // Build category list from the items themselves so we don't need
    // another API call. De-dup by id, drop sub-categories' children silently
    // (they're rare and the parent label is enough at this level).
    const seen = new Map<string, string>();
    items.forEach((it: any) => {
      if (it.category && it.category_name) seen.set(it.category, it.category_name);
    });
    return Array.from(seen, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between"
        spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
            Inventory · Stock by warehouse
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pick a warehouse to see every item's quantity, value and status at that location.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
        </Stack>
      </Stack>

      {/* Warehouse picker */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
          <WarehouseIcon sx={{ color: 'primary.main' }} />
          <TextField
            select size="small" sx={{ minWidth: 280 }}
            label="Warehouse"
            value={warehouseId}
            onChange={(e) => {
              const v = e.target.value;
              setWarehouseId(v);
              setParams((p) => { v ? p.set('warehouse', v) : p.delete('warehouse'); return p; }, { replace: true });
            }}
          >
            <MenuItem value="">All warehouses (consolidated)</MenuItem>
            {warehouses.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name}{w.branch_name ? ` · ${w.branch_name}` : ''}
              </MenuItem>
            ))}
          </TextField>
          {selectedWarehouse && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {selectedWarehouse.is_default && <Chip size="small" label="Default" color="primary" />}
              {selectedWarehouse.code && (
                <Chip size="small" label={selectedWarehouse.code}
                  sx={{ fontFamily: '"IBM Plex Mono", monospace' }} />
              )}
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* KPI strip */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}>
          <StatCard label="Items present" value={loading ? '—' : totals.present.toString()}
            accent="#4FC3F7" icon={<Inventory2Icon fontSize="small" />}
            hint={`${totals.items} tracked`} index={0} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Stock value"
            value={loading ? '—' : formatMoney(totals.value, { short: true })}
            accent="#00E676" icon={<PaidIcon fontSize="small" />} index={1} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Low stock" value={loading ? '—' : totals.low.toString()}
            accent="#FFB300" icon={<HourglassBottomIcon fontSize="small" />}
            hint={totals.low > 0 ? 'Click chip to filter' : 'Healthy'}
            index={2} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Out / negative"
            value={loading ? '—' : (totals.out + totals.negative).toString()}
            accent="#FF5252" icon={<ErrorOutlineIcon fontSize="small" />}
            hint={`${totals.out} out · ${totals.negative} negative`}
            index={3} />
        </Grid>
      </Grid>

      {err && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setErr('')}>{err}</Alert>}

      {/* Filter bar */}
      <Paper sx={{ p: 1.5, mb: 1.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}
          alignItems={{ md: 'center' }}>
          <TextField
            size="small" sx={{ flex: 1, minWidth: 220 }}
            placeholder="Search item, SKU, category…"
            value={q} onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (<InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>),
            }}
          />
          <TextField size="small" select sx={{ minWidth: 200 }}
            label="Category" value={category}
            onChange={(e) => setCategory(e.target.value)}>
            <MenuItem value="all">All categories</MenuItem>
            {parentCategories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {STATUS_CHIPS.map((c) => {
              const active = status === c.key;
              return (
                <Chip
                  key={c.key} size="small" label={c.label} clickable
                  onClick={() => setStatus(c.key)}
                  sx={{
                    height: 28, fontWeight: 700, fontSize: 12, px: 0.5,
                    color: active ? c.color : 'text.secondary',
                    bgcolor: active ? alpha(c.color, 0.15) : 'transparent',
                    border: (t) => `1px solid ${active ? alpha(c.color, 0.5) : alpha(t.palette.text.primary, 0.15)}`,
                  }}
                />
              );
            })}
          </Stack>
        </Stack>
      </Paper>

      {/* Stock table */}
      <Paper>
        {loading ? (
          <Box sx={{ p: 2 }}>
            {[0, 1, 2, 3, 4].map((i) =>
              <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 1 }} />
            )}
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 4 }}>
            <EmptyState
              icon={<Inventory2Icon />}
              title={rows.length === 0 ? 'No stock data yet' : 'No items match'}
              body={rows.length === 0
                ? 'Once you add opening stock or record purchases, items will appear here.'
                : 'Clear filters or change the warehouse to see all items.'}
            />
          </Box>
        ) : (
          <>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 80px 90px 90px 110px 130px 140px 100px',
              bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
              px: 1.5, py: 1, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
              textTransform: 'uppercase', color: 'text.secondary',
              borderBottom: 1, borderColor: 'divider',
            }}>
              <Box>SKU</Box>
              <Box>Item</Box>
              <Box>Unit</Box>
              <Box sx={{ textAlign: 'right' }}>In</Box>
              <Box sx={{ textAlign: 'right' }}>Out</Box>
              <Box sx={{ textAlign: 'right' }}>Balance</Box>
              <Box sx={{ textAlign: 'right' }}>Avg cost</Box>
              <Box sx={{ textAlign: 'right' }}>Value</Box>
              <Box sx={{ textAlign: 'center' }}>Status</Box>
            </Box>
            {filtered.map((r) => {
              const bal = num(r.balance);
              const isNeg = bal < 0;
              const isOut = bal === 0;
              const isLow = !isOut && !isNeg && r.reorder > 0 && bal <= r.reorder;
              const statusColor = isNeg ? '#D500F9'
                : isOut ? '#FF5252'
                : isLow ? '#FFB300'
                : '#00E676';
              const statusLabel = isNeg ? 'Negative'
                : isOut ? 'Out'
                : isLow ? 'Low'
                : 'OK';
              return (
                <Box key={r.item_id} sx={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 80px 90px 90px 110px 130px 140px 100px',
                  px: 1.5, py: 1, alignItems: 'center', fontSize: 13,
                  borderBottom: 1, borderColor: 'divider',
                  '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.025) },
                }}>
                  <Box sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 600 }}>
                    {r.sku}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{r.name}</Typography>
                    {r.category_name && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {r.category_name}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ color: 'text.secondary' }}>{r.unit || '—'}</Box>
                  <Box sx={{ textAlign: 'right', color: 'text.secondary' }}>
                    {num(r.qty_in).toLocaleString()}
                  </Box>
                  <Box sx={{ textAlign: 'right', color: 'text.secondary' }}>
                    {num(r.qty_out).toLocaleString()}
                  </Box>
                  <Box sx={{ textAlign: 'right', fontWeight: 700, color: statusColor }}>
                    {bal.toLocaleString()}
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <MoneyDisplay value={num(r.average_cost)} fractionDigits={0} />
                  </Box>
                  <Box sx={{ textAlign: 'right', fontWeight: 700 }}>
                    <MoneyDisplay value={num(r.value)} fractionDigits={0} />
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Chip size="small" label={statusLabel} sx={{
                      height: 22, fontSize: 11, fontWeight: 700,
                      color: statusColor,
                      bgcolor: alpha(statusColor, 0.15),
                      border: `1px solid ${alpha(statusColor, 0.4)}`,
                    }} />
                  </Box>
                </Box>
              );
            })}
            <Box sx={{ p: 1.5, color: 'text.secondary' }}>
              <Typography variant="caption">
                {filtered.length} of {enriched.length} items shown
                {selectedWarehouse ? ` at ${selectedWarehouse.name}` : ' (all warehouses)'}
              </Typography>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
