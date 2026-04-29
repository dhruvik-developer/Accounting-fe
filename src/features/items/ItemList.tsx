/**
 * Slim left-pane item list with the "premium" filter set:
 *   • Search (name, SKU, barcode, HSN)
 *   • Stock-status chips: All / In stock / Low / Out / Negative / Not tracked
 *   • Category dropdown
 *   • Type: Product / Service
 *   • GST rate
 *   • Tracking: Quantity / Serial / Batch
 *   • Active toggle (default: hide inactive)
 *
 * All filtering happens client-side for responsiveness — the parent loads the
 * full /items/ list once. If the dataset grows past ~5k items, switch to a
 * paginated server-side filter (the backend already supports `?search=`,
 * `?category=`, `?type=`, `?is_active=`).
 */
import { useMemo } from 'react';
import {
  Box, Chip, InputAdornment, MenuItem, Paper, Stack, TextField, Typography,
  alpha, useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { formatMoney } from '@/components/MoneyDisplay';

const num = (v: any) => Number(v || 0);

export type ItemRow = {
  id: string;
  sku: string;
  name: string;
  barcode?: string;
  hsn_code?: string;
  type: 'product' | 'service';
  category?: string;
  category_name?: string;
  unit_code?: string;
  is_active?: boolean;
  is_serialized?: boolean;
  is_batch_tracked?: boolean;
  track_inventory?: boolean;
  sale_price?: number | string;
  purchase_price?: number | string;
  stock_on_hand?: number | string;
  available_serials?: number;
  reorder_level?: number | string;
  min_stock_level?: number | string;
  tax_rate?: string;
  tax_rate_value?: number | string;
};

export type ItemFilters = {
  q: string;
  stockStatus: 'all' | 'in_stock' | 'low' | 'out' | 'negative' | 'not_tracked';
  category: string;          // 'all' | category id
  type: 'all' | 'product' | 'service';
  taxRateId: string;         // 'all' | tax rate id
  tracking: 'all' | 'quantity' | 'serial' | 'batch';
  showInactive: boolean;
};

export const DEFAULT_ITEM_FILTERS: ItemFilters = {
  q: '',
  stockStatus: 'all',
  category: 'all',
  type: 'all',
  taxRateId: 'all',
  tracking: 'all',
  showInactive: false,
};

const STATUS_CHIPS: { key: ItemFilters['stockStatus']; label: string; color: string }[] = [
  { key: 'all',         label: 'All',           color: '#90A4AE' },
  { key: 'in_stock',    label: 'In stock',      color: '#00E676' },
  { key: 'low',         label: 'Low',           color: '#FFB300' },
  { key: 'out',         label: 'Out',           color: '#FF5252' },
  { key: 'negative',    label: 'Negative',      color: '#D500F9' },
  { key: 'not_tracked', label: 'Not tracked',   color: '#B0B0B0' },
];

type Props = {
  rows: ItemRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: ItemFilters;
  setFilters: (next: ItemFilters) => void;
  categories: any[];
  rates: any[];
  loading?: boolean;
};

export default function ItemList({
  rows, selectedId, onSelect, filters, setFilters, categories, rates, loading,
}: Props) {
  const theme = useTheme();

  const setF = (patch: Partial<ItemFilters>) => setFilters({ ...filters, ...patch });

  const filtered = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    return rows.filter((r) => {
      if (!filters.showInactive && r.is_active === false) return false;
      if (filters.type !== 'all' && r.type !== filters.type) return false;
      if (filters.category !== 'all' && r.category !== filters.category) return false;
      if (filters.taxRateId !== 'all' && r.tax_rate !== filters.taxRateId) return false;

      if (filters.tracking !== 'all') {
        const isSerial = !!r.is_serialized;
        const isBatch = !!r.is_batch_tracked;
        const isQty = !isSerial && !isBatch && !!r.track_inventory;
        if (filters.tracking === 'serial' && !isSerial) return false;
        if (filters.tracking === 'batch' && !isBatch) return false;
        if (filters.tracking === 'quantity' && !isQty) return false;
      }

      const stock = r.is_serialized ? num(r.available_serials) : num(r.stock_on_hand);
      const reorder = num(r.min_stock_level || r.reorder_level);
      switch (filters.stockStatus) {
        case 'in_stock':
          if (!r.track_inventory || stock <= 0 || (reorder > 0 && stock <= reorder)) return false;
          break;
        case 'low':
          if (!r.track_inventory || reorder <= 0 || stock > reorder || stock <= 0) return false;
          break;
        case 'out':
          if (!r.track_inventory || stock > 0) return false;
          break;
        case 'negative':
          if (stock >= 0) return false;
          break;
        case 'not_tracked':
          if (r.track_inventory) return false;
          break;
      }

      if (!needle) return true;
      return (
        r.name?.toLowerCase().includes(needle)
        || r.sku?.toLowerCase().includes(needle)
        || r.barcode?.toLowerCase().includes(needle)
        || r.hsn_code?.toLowerCase().includes(needle)
        || r.category_name?.toLowerCase().includes(needle)
      );
    });
  }, [rows, filters]);

  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent && c.is_active !== false),
    [categories],
  );

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Stack spacing={1.25} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          placeholder="Search name, SKU, barcode, HSN…"
          value={filters.q}
          onChange={(e) => setF({ q: e.target.value })}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />

        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
          {STATUS_CHIPS.map((c) => {
            const active = filters.stockStatus === c.key;
            return (
              <Chip
                key={c.key}
                size="small"
                label={c.label}
                clickable
                onClick={() => setF({ stockStatus: c.key })}
                sx={{
                  height: 24, fontWeight: 700, fontSize: 11,
                  color: active ? c.color : 'text.secondary',
                  bgcolor: active ? alpha(c.color, 0.15) : 'transparent',
                  border: `1px solid ${active ? alpha(c.color, 0.5) : alpha(theme.palette.text.primary, 0.15)}`,
                }}
              />
            );
          })}
        </Stack>

        <Stack direction="row" spacing={1}>
          <TextField size="small" select fullWidth value={filters.category}
            onChange={(e) => setF({ category: e.target.value })}>
            <MenuItem value="all">All categories</MenuItem>
            {parentCategories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField size="small" select fullWidth value={filters.type}
            onChange={(e) => setF({ type: e.target.value as ItemFilters['type'] })}>
            <MenuItem value="all">All types</MenuItem>
            <MenuItem value="product">Products</MenuItem>
            <MenuItem value="service">Services</MenuItem>
          </TextField>
        </Stack>

        <Stack direction="row" spacing={1}>
          <TextField size="small" select fullWidth value={filters.taxRateId}
            onChange={(e) => setF({ taxRateId: e.target.value })}>
            <MenuItem value="all">All GST</MenuItem>
            {rates.map((r) => <MenuItem key={r.id} value={r.id}>{r.name} ({r.rate}%)</MenuItem>)}
          </TextField>
          <TextField size="small" select fullWidth value={filters.tracking}
            onChange={(e) => setF({ tracking: e.target.value as ItemFilters['tracking'] })}>
            <MenuItem value="all">All tracking</MenuItem>
            <MenuItem value="quantity">Quantity</MenuItem>
            <MenuItem value="serial">Serial</MenuItem>
            <MenuItem value="batch">Batch</MenuItem>
          </TextField>
        </Stack>

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Chip
            size="small" clickable
            label={filters.showInactive ? 'Showing inactive' : 'Active only'}
            onClick={() => setF({ showInactive: !filters.showInactive })}
            sx={{ height: 22, fontWeight: 600, fontSize: 11 }}
            color={filters.showInactive ? 'default' : 'primary'}
            variant={filters.showInactive ? 'outlined' : 'filled'}
          />
          <Typography variant="caption" color="text.secondary">
            {loading ? 'Loading…' : `${filtered.length} of ${rows.length}`}
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {rows.length === 0 ? 'No items yet.' : 'No matches — clear filters to see everything.'}
            </Typography>
          </Box>
        ) : (
          filtered.map((r) => {
            const isSelected = r.id === selectedId;
            const stock = r.is_serialized ? num(r.available_serials) : num(r.stock_on_hand);
            const reorder = num(r.min_stock_level || r.reorder_level);
            const status: 'out' | 'low' | 'ok' | 'negative' | 'untracked' =
              !r.track_inventory ? 'untracked'
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
            return (
              <Box
                key={r.id}
                onClick={() => onSelect(r.id)}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  borderLeft: '3px solid transparent',
                  borderBottom: 1, borderColor: 'divider',
                  bgcolor: isSelected
                    ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.08)
                    : 'transparent',
                  borderLeftColor: isSelected ? 'primary.main' : 'transparent',
                  transition: 'background-color 120ms, border-color 120ms',
                  '&:hover': {
                    bgcolor: isSelected
                      ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.1)
                      : alpha(theme.palette.text.primary, 0.04),
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                      {r.name}
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                      <Typography variant="caption" sx={{
                        fontFamily: '"IBM Plex Mono", monospace',
                        color: 'text.secondary', fontSize: 10,
                      }}>
                        {r.sku}
                      </Typography>
                      {r.category_name && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 10 }}>
                          · {r.category_name}
                        </Typography>
                      )}
                      {r.is_serialized && (
                        <Chip size="small" label="Serial" sx={{ height: 16, fontSize: 9, bgcolor: alpha('#4FC3F7', 0.15), color: '#4FC3F7' }} />
                      )}
                      {r.is_batch_tracked && (
                        <Chip size="small" label="Batch" sx={{ height: 16, fontSize: 9, bgcolor: alpha('#B388FF', 0.15), color: '#B388FF' }} />
                      )}
                    </Stack>
                  </Box>
                  <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{
                        width: 6, height: 6, borderRadius: '50%', bgcolor: statusColor,
                      }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: statusColor }}>
                        {status === 'untracked'
                          ? '—'
                          : (status === 'out' ? '0' : stock.toLocaleString())}
                      </Typography>
                    </Stack>
                    {Number(r.sale_price) > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {formatMoney(Number(r.sale_price), { fractionDigits: 0 })}
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Box>
            );
          })
        )}
      </Box>
    </Paper>
  );
}
