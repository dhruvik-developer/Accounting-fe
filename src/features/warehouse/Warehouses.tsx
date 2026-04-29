/**
 * Warehouse list — full CRUD using mock service. Drop-in compatible with the
 * real REST API once /warehouses/ ships (just swap the service layer).
 *
 * UX:
 *  - 4 KPI hero cards (count by status + total stock value)
 *  - Search + status filter
 *  - DataGrid with status pill, sticky right-side action menu
 *  - FormDrawer for create/edit
 *  - ConfirmDialog for delete
 *  - Empty state with CTA
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Grid, IconButton, MenuItem, Paper, Stack, TextField, Tooltip, Typography,
  Menu, Skeleton, alpha,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import LocationCityOutlinedIcon from '@mui/icons-material/LocationCityOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { useNavigate } from 'react-router-dom';
import { warehouseService } from './mockService';
import type { Warehouse } from './types';
import WarehouseForm from './WarehouseForm';
import StatCard from '@/components/StatCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import MoneyDisplay, { formatMoney } from '@/components/MoneyDisplay';
import { notify } from '@/components/Notifier';
import { formatApiError } from '@/app/errors';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { api } from '@/app/api';

// `archived` is neutral/done, not destructive — use grey, not red.
const STATUS_COLOR: Record<string, string> = {
  active: '#00E676', inactive: '#FFB300', archived: '#9E9E9E',
};

type WarehouseStats = {
  warehouse_id: string;
  items_present: number;
  total_qty: string;
  total_value: string;
  low_count: number;
  negative_count: number;
  expired_batches: number;
};

export default function Warehouses() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 200);
  const [status, setStatus] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; row: Warehouse } | null>(null);
  const [statsByWarehouse, setStatsByWarehouse] = useState<Record<string, WarehouseStats>>({});

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      // Fan out the list + stats together. Stats failures don't block the
      // list — the page still renders, columns just show "—".
      const [list, statsRes] = await Promise.all([
        warehouseService.list({ q: debouncedQ, status }),
        api.get<WarehouseStats[]>('/warehouses/stats/').catch(() => ({ data: [] as WarehouseStats[] })),
      ]);
      setRows(list);
      const map: Record<string, WarehouseStats> = {};
      (statsRes.data || []).forEach((s) => { map[s.warehouse_id] = s; });
      setStatsByWarehouse(map);
    } catch (e) {
      setErr(formatApiError(e, 'Failed to load warehouses'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status]);

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    inactive: rows.filter((r) => r.status === 'inactive').length,
    // Sum live current stock value, not opening — opening only reflects the
    // initial setup amount and goes stale after the first transaction.
    stockValue: rows.reduce(
      (acc, r) => acc + Number(statsByWarehouse[r.id]?.total_value || 0),
      0,
    ),
    itemsPresent: rows.reduce(
      (acc, r) => acc + (statsByWarehouse[r.id]?.items_present || 0),
      0,
    ),
  }), [rows, statsByWarehouse]);

  const onCreate = () => { setEditing(null); setFormOpen(true); };
  const onEdit = (w: Warehouse) => { setEditing(w); setFormOpen(true); };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await warehouseService.remove(deleteTarget.id);
      notify({ severity: 'success', message: `Removed "${deleteTarget.warehouse_name}"` });
      setDeleteTarget(null);
      load();
    } catch (e) {
      setErr(formatApiError(e, 'Failed to delete warehouse'));
      setDeleteTarget(null);
    }
  };

  const cols: GridColDef<Warehouse>[] = [
    {
      field: 'warehouse_code', headerName: 'Code', width: 120,
      renderCell: (p) => (
        <Typography variant="body2" sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'warehouse_name', headerName: 'Warehouse', flex: 1.4, minWidth: 220,
      renderCell: (p) => (
        <Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.row.warehouse_name}</Typography>
            {p.row.is_default && (
              <Tooltip title="Default warehouse"><VerifiedOutlinedIcon sx={{ fontSize: 14, color: '#4FC3F7' }} /></Tooltip>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">{p.row.address || '—'}</Typography>
        </Stack>
      ),
    },
    {
      field: 'branch_name', headerName: 'Branch', width: 160,
      renderCell: (p) => p.row.branch_name || <Typography variant="caption" color="text.secondary">—</Typography>,
    },
    {
      field: 'manager_name', headerName: 'Manager', width: 160,
      renderCell: (p) => (
        <Stack>
          <Typography variant="body2">{p.row.manager_name}</Typography>
          <Typography variant="caption" color="text.secondary">{p.row.phone}</Typography>
        </Stack>
      ),
    },
    {
      field: 'city', headerName: 'Location', width: 160,
      renderCell: (p) => `${p.row.city || '—'}, ${p.row.state || ''}`.replace(/, $/, ''),
    },
    {
      field: 'items_present', headerName: 'Items', width: 120, type: 'number',
      valueGetter: (_v, row) => statsByWarehouse[row.id]?.items_present ?? 0,
      renderCell: (p) => {
        const s = statsByWarehouse[p.row.id];
        if (!s) return <Typography variant="body2" color="text.disabled">—</Typography>;
        return (
          <Stack alignItems="flex-end">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {s.items_present.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {Number(s.total_qty).toLocaleString()} units
            </Typography>
          </Stack>
        );
      },
    },
    {
      field: 'total_value', headerName: 'Stock value', width: 140, type: 'number',
      valueGetter: (_v, row) => Number(statsByWarehouse[row.id]?.total_value || 0),
      renderCell: (p) => {
        const s = statsByWarehouse[p.row.id];
        if (!s) return <Typography variant="body2" color="text.disabled">—</Typography>;
        return <MoneyDisplay value={Number(s.total_value || 0)} short />;
      },
    },
    {
      field: 'alerts', headerName: 'Alerts', width: 170, sortable: false,
      renderCell: (p) => {
        const s = statsByWarehouse[p.row.id];
        if (!s) return null;
        const chips: { label: string; color: string }[] = [];
        if (s.expired_batches > 0) chips.push({ label: `${s.expired_batches} expired`, color: '#FF5252' });
        if (s.low_count > 0) chips.push({ label: `${s.low_count} low`, color: '#FFB300' });
        if (s.negative_count > 0) chips.push({ label: `${s.negative_count} neg`, color: '#D500F9' });
        if (chips.length === 0) {
          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00E676' }} />
              <Typography variant="caption" color="text.secondary">Healthy</Typography>
            </Stack>
          );
        }
        return (
          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {chips.map((c) => (
              <Chip key={c.label} label={c.label} size="small" sx={{
                height: 20, fontSize: 10, fontWeight: 700,
                color: c.color,
                bgcolor: alpha(c.color, 0.12),
                border: `1px solid ${alpha(c.color, 0.32)}`,
              }} />
            ))}
          </Stack>
        );
      },
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => (
        <Chip
          label={p.value} size="small"
          sx={{
            textTransform: 'capitalize', fontWeight: 700,
            color: STATUS_COLOR[p.value as string] ?? '#B0B0B0',
            bgcolor: alpha(STATUS_COLOR[p.value as string] ?? '#B0B0B0', 0.12),
            border: (theme) => `1px solid ${alpha(STATUS_COLOR[p.value as string] ?? '#B0B0B0', theme.palette.mode === 'dark' ? 0.32 : 0.20)}`,
          }}
        />
      ),
    },
    {
      field: '__actions', headerName: '', width: 60, sortable: false, filterable: false,
      renderCell: (p) => (
        <IconButton size="small" onClick={(e) => {
          e.stopPropagation();
          setMenuAnchor({ el: e.currentTarget, row: p.row });
        }}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      {/* Hero header */}
      <Box sx={{
        position: 'relative',
        mx: { xs: -1.5, sm: -2, md: -3 },
        mt: { xs: -1.5, sm: -2, md: -3 },
        mb: 3,
        px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3 },
        overflow: 'hidden',
        borderBottom: '1px solid', borderColor: 'divider',
        background: (t) => t.palette.mode === 'dark'
          ? 'radial-gradient(900px 320px at 0% 0%, rgba(0,230,118,0.18), transparent 60%),'
            + 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
          : 'linear-gradient(180deg, rgba(0,230,118,0.06), transparent 100%)',
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2} sx={{ position: 'relative' }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flex: 1 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 1.5,
              display: 'grid', placeItems: 'center', color: '#fff',
              background: 'linear-gradient(135deg, #00E676, #4FC3F7)',
              boxShadow: '0 8px 22px rgba(0,230,118,0.32)',
            }}>
              <WarehouseOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>Warehouses</Typography>
                <Chip size="small" label={`${stats.total} locations`} sx={{
                  height: 22, fontWeight: 700,
                  background: 'rgba(0,230,118,0.12)', color: '#00E676',
                  border: '1px solid rgba(0,230,118,0.32)',
                }} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Stock locations across branches · per-warehouse inventory and transfers
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>New warehouse</Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Total warehouses" value={String(stats.total)}
            accent="#4FC3F7" icon={<WarehouseOutlinedIcon fontSize="small" />}
            hint={stats.active === stats.total ? 'All active' : `${stats.active} active`}
            index={0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Items in stock" value={stats.itemsPresent.toLocaleString()}
            accent="#00E676" icon={<Inventory2OutlinedIcon fontSize="small" />}
            hint="across all warehouses" index={1} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Inactive" value={String(stats.inactive)} accent="#FFB300"
            icon={<LocationCityOutlinedIcon fontSize="small" />} index={2} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Live stock value" value={formatMoney(stats.stockValue, { short: true })}
            accent="#00E676" icon={<SwapHorizOutlinedIcon fontSize="small" />}
            hint="qty × avg cost" index={3} />
        </Grid>
      </Grid>

      <Paper sx={{ p: 1.5, mb: 1.5 }}>
        <Stack direction="row" useFlexGap flexWrap="wrap" rowGap={1.25} columnGap={1.25}
          alignItems="center">
          <TextField
            size="small"
            placeholder="Search by name, code, manager, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />,
            }}
            sx={{ flex: '1 1 280px', minWidth: 280 }}
          />
          <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}
            sx={{ minWidth: 160 }}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setErr('')}>{err}</Alert>}

      <Paper sx={{ height: 560, position: 'relative' }}>
        {loading ? (
          <Box sx={{ p: 2 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 1 }} />
            ))}
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 4 }}>
            <EmptyState
              icon={<WarehouseOutlinedIcon />}
              title={debouncedQ || status !== 'all' ? 'No warehouses match your filters' : 'No warehouses yet'}
              body={debouncedQ || status !== 'all'
                ? 'Try clearing the search or switching to "All" statuses.'
                : 'Add a warehouse to start tracking stock per location.'}
              action={!debouncedQ && status === 'all'
                ? <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>New warehouse</Button>
                : undefined}
            />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={cols}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{
              border: 0,
              '& .MuiDataGrid-cell': { py: 1 },
              '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
            }}
            onRowClick={(p) => onEdit(p.row as Warehouse)}
          />
        )}
      </Paper>

      <Menu anchorEl={menuAnchor?.el} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { onEdit(menuAnchor!.row); setMenuAnchor(null); }}>
          <EditOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => { nav('/inventory?warehouse=' + menuAnchor!.row.id); setMenuAnchor(null); }}>
          <VisibilityOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} /> View inventory
        </MenuItem>
        <MenuItem onClick={() => { notify({ severity: 'info', message: 'Stock transfer UI coming soon — backend endpoint pending.' }); setMenuAnchor(null); }}>
          <SwapHorizOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} /> Stock transfer
        </MenuItem>
        <MenuItem onClick={() => { setDeleteTarget(menuAnchor!.row); setMenuAnchor(null); }}
          sx={{ color: '#FF5252' }}>
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1.25 }} /> Delete
        </MenuItem>
      </Menu>

      <WarehouseForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(w) => {
          notify({
            severity: 'success',
            message: editing ? `Updated ${w.warehouse_name}` : `Created ${w.warehouse_name}`,
          });
          load();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.warehouse_name}?`}
        body={
          <>
            <Typography>This warehouse and its records will be removed locally.</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              When the backend is wired, deletion will be soft-delete with audit trail.
            </Typography>
          </>
        }
        tone="danger"
        confirmLabel="Delete"
        requireTypedConfirm={deleteTarget?.warehouse_code}
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
