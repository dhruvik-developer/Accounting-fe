/**
 * Expense list page — KPI strip + category breakdown + filterable list.
 *
 * The page is intentionally backend-agnostic: every data call goes through
 * `expenseService` (mock, localStorage). Replace that service with real
 * `api.*` calls once /expenses/ ships.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Grid, IconButton, MenuItem, Paper,
  Skeleton, Stack, TextField, Tooltip, Typography, Menu, alpha,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import useAutoOpenCreate from '@/hooks/useAutoOpenCreate';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import dayjs from 'dayjs';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import RepeatOutlinedIcon from '@mui/icons-material/RepeatOutlined';
import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import StatCard from '@/components/StatCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import MoneyDisplay, { formatMoney } from '@/components/MoneyDisplay';
import DateRangeFilter, { monthRange } from '@/components/DateRangeFilter';
import { notify } from '@/components/Notifier';
import { formatApiError } from '@/app/errors';
import { expenseService } from './mockService';
import type { Expense, ExpenseCategory } from './types';
import ExpenseForm from './ExpenseForm';

const STATUS_COLOR: Record<string, string> = {
  paid: '#00E676', partial: '#4FC3F7', unpaid: '#FFB300', overdue: '#FF5252', cancelled: '#B0B0B0',
};
const APPROVAL_COLOR: Record<string, string> = {
  approved: '#00E676', pending: '#FFB300', rejected: '#FF5252', not_required: '#B0B0B0',
};

export default function Expenses() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 200);
  const [status, setStatus] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [range, setRange] = useState(monthRange());
  const [summary, setSummary] = useState<{
    totalSpend: number; totalPaid: number; totalUnpaid: number; gstInput: number;
    pendingApproval: number; count: number; categories: { label: string; value: number }[];
  } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; row: Expense } | null>(null);

  // Categories load once — they don't change with filters and shouldn't race.
  // Failures used to be swallowed; now surface them so an empty filter
  // dropdown is distinguishable from a real backend error.
  useEffect(() => {
    expenseService.listCategories()
      .then(setCategories)
      .catch((e) => setErr(formatApiError(e, "Couldn't load expense categories")));
  }, []);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const [list, sum] = await Promise.all([
        expenseService.list({ q: debouncedQ, status, category_id: categoryId, date_from: range.from, date_to: range.to }),
        expenseService.summary({ date_from: range.from, date_to: range.to }),
      ]);
      setRows(list);
      setSummary(sum);
    } catch (e) {
      setErr(formatApiError(e, 'Failed to load expenses'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, categoryId, range.from, range.to]);

  const onCreate = () => { setEditing(null); setFormOpen(true); };
  const onEdit = (e: Expense) => { setEditing(e); setFormOpen(true); };

  // Auto-open the create drawer when reached via ?new=1
  // (Dashboard "Add Expense" quick action, Quick Create menu, ⌘K palette).
  useAutoOpenCreate(onCreate);

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await expenseService.remove(deleteTarget.id);
      notify({ severity: 'success', message: `Removed ${deleteTarget.expense_number}` });
      setDeleteTarget(null);
      load();
    } catch (e) {
      setErr(formatApiError(e, 'Failed to delete expense'));
      setDeleteTarget(null);
    }
  };

  const cols: GridColDef<Expense>[] = [
    {
      field: 'expense_number', headerName: '#', width: 140,
      renderCell: (p) => (
        <Stack>
          <Typography variant="body2" sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}>
            {p.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {dayjs(p.row.expense_date).format('DD MMM YYYY')}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'vendor_name', headerName: 'Vendor', flex: 1, minWidth: 200,
      renderCell: (p) => (
        <Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.row.vendor_name}</Typography>
            {p.row.is_recurring && (
              <Tooltip title={`Recurring · ${p.row.recurring_period}`}>
                <RepeatOutlinedIcon sx={{ fontSize: 14, color: '#4FC3F7' }} />
              </Tooltip>
            )}
            {p.row.attachment_name && (
              <Tooltip title={p.row.attachment_name}>
                <AttachFileOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              </Tooltip>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">{p.row.description}</Typography>
        </Stack>
      ),
    },
    {
      field: 'category_name', headerName: 'Category', width: 170,
      renderCell: (p) => p.value || <Typography component="span" color="text.disabled">—</Typography>,
    },
    {
      field: 'total_amount', headerName: 'Total', width: 130, type: 'number',
      renderCell: (p) => (
        <Stack alignItems="flex-end">
          <MoneyDisplay value={Number(p.value || 0)} />
          {Number(p.row.gst_amount) > 0 && (
            <Typography variant="caption" color="text.secondary">
              + GST <MoneyDisplay value={p.row.gst_amount} fractionDigits={0} />
            </Typography>
          )}
        </Stack>
      ),
    },
    {
      field: 'paid_amount', headerName: 'Paid', width: 110, type: 'number',
      renderCell: (p) => <MoneyDisplay value={Number(p.value || 0)} muted={p.value === 0} />,
    },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: (p) => (
        <Chip label={p.value} size="small" sx={chipSx(STATUS_COLOR[p.value as string])} />
      ),
    },
    {
      field: 'approval_status', headerName: 'Approval', width: 130,
      renderCell: (p) => (
        <Chip label={String(p.value).replace('_', ' ')} size="small" sx={chipSx(APPROVAL_COLOR[p.value as string])} />
      ),
    },
    {
      field: '__actions', headerName: '', width: 60, sortable: false, filterable: false,
      renderCell: (p) => (
        <IconButton size="small" onClick={(e) => setMenuAnchor({ el: e.currentTarget, row: p.row })}>
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
          ? 'radial-gradient(900px 320px at 0% 0%, rgba(255,82,82,0.18), transparent 60%),'
            + 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
          : 'linear-gradient(180deg, rgba(255,82,82,0.06), transparent 100%)',
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2} sx={{ position: 'relative' }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flex: 1 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 1.5,
              display: 'grid', placeItems: 'center', color: '#fff',
              background: 'linear-gradient(135deg, #FF5252, #FFB300)',
              boxShadow: '0 8px 22px rgba(255,82,82,0.32)',
            }}>
              <LocalAtmOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>Expenses</Typography>
                {summary && (
                  <Chip size="small" label={`${summary.count} this period`} sx={{
                    height: 22, fontWeight: 700,
                    background: 'rgba(255,82,82,0.12)', color: '#FF5252',
                    border: '1px solid rgba(255,82,82,0.32)',
                  }} />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Operating spend · GST input credit · approvals
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>New expense</Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Total spend" value={summary ? formatMoney(summary.totalSpend, { short: true }) : '—'}
            accent="#FF5252" icon={<LocalAtmOutlinedIcon fontSize="small" />}
            hint={summary ? `${summary.count} expenses` : undefined} index={0} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Paid" value={summary ? formatMoney(summary.totalPaid, { short: true }) : '—'}
            accent="#00E676" icon={<PaymentsOutlinedIcon fontSize="small" />} index={1} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Outstanding" value={summary ? formatMoney(summary.totalUnpaid, { short: true }) : '—'}
            accent="#FFB300" icon={<HourglassBottomOutlinedIcon fontSize="small" />} index={2} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="GST input credit" value={summary ? formatMoney(summary.gstInput, { short: true }) : '—'}
            accent="#4FC3F7" icon={<ReceiptLongOutlinedIcon fontSize="small" />}
            hint={summary && summary.pendingApproval > 0 ? `${summary.pendingApproval} pending approval` : undefined}
            index={3} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>Spend by category</Typography>
            {!summary ? <Skeleton height={120} /> : summary.categories.length === 0 ? (
              <EmptyState compact title="No spend in window" body="Try expanding the date range." />
            ) : (
              <Stack spacing={1.25}>
                {summary.categories.slice(0, 6).map((c, i) => {
                  const pct = summary.totalSpend > 0 ? (c.value / summary.totalSpend) * 100 : 0;
                  return (
                    <Box key={c.label}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="body2" noWrap>{c.label}</Typography>
                        <MoneyDisplay value={c.value} short fractionDigits={0} />
                      </Stack>
                      <Box sx={{ height: 8, borderRadius: 999, bgcolor: (t) => alpha(t.palette.divider, 0.4) }}>
                        <Box sx={{
                          height: '100%', width: `${Math.max(2, pct)}%`,
                          background: `linear-gradient(90deg, hsl(${(i * 47) % 360} 80% 60%), hsl(${(i * 47 + 30) % 360} 80% 65%))`,
                          borderRadius: 999, transition: 'width .35s ease',
                        }} />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 1.5, mb: 1.5 }}>
            <Stack direction="row" useFlexGap flexWrap="wrap" rowGap={1.25} columnGap={1.25}
              alignItems="center">
              <TextField
                size="small"
                placeholder="Search vendor, number, description…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} /> }}
                sx={{ flex: '1 1 240px', minWidth: 240 }}
              />
              <TextField select size="small" label="Category" value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)} sx={{ minWidth: 160 }}>
                <MenuItem value="all">All</MenuItem>
                {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Status" value={status}
                onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 140 }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="unpaid">Unpaid</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
              </TextField>
              <DateRangeFilter value={range} onChange={setRange} />
            </Stack>
          </Paper>
          {err && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErr('')}>{err}</Alert>}
          <Paper sx={{ height: 540 }}>
            {loading ? (
              <Box sx={{ p: 2 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} variant="rounded" height={48} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : rows.length === 0 ? (
              <Box sx={{ p: 4 }}>
                <EmptyState
                  icon={<LocalAtmOutlinedIcon />}
                  title={debouncedQ || status !== 'all' || categoryId !== 'all' ? 'No expenses match' : 'No expenses yet'}
                  body={debouncedQ || status !== 'all' || categoryId !== 'all'
                    ? 'Try clearing filters or expanding the date range.'
                    : 'Log your first expense to start tracking spend, GST input credit, and approvals.'}
                  action={(!debouncedQ && status === 'all' && categoryId === 'all')
                    ? <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>New expense</Button>
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
                onRowClick={(p) => onEdit(p.row as Expense)}
                sx={{
                  border: 0,
                  '& .MuiDataGrid-cell': { py: 1 },
                  '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
                }}
              />
            )}
          </Paper>
        </Grid>
      </Grid>

      <Menu anchorEl={menuAnchor?.el} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { onEdit(menuAnchor!.row); setMenuAnchor(null); }}>
          <EditOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => { setDeleteTarget(menuAnchor!.row); setMenuAnchor(null); }}
          sx={{ color: '#FF5252' }}>
          <DeleteOutlineIcon fontSize="small" sx={{ mr: 1.25 }} /> Delete
        </MenuItem>
      </Menu>

      <ExpenseForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(e) => {
          notify({
            severity: 'success',
            message: editing ? `Updated ${e.expense_number}` : `Created ${e.expense_number}`,
          });
          load();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.expense_number}?`}
        body="This expense will be removed locally. Backend deletion will be soft-delete with audit trail when wired."
        tone="danger"
        confirmLabel="Delete"
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}

const chipSx = (color: string) => ({
  textTransform: 'capitalize' as const,
  fontWeight: 700,
  color,
  bgcolor: alpha(color, 0.12),
  border: (theme: any) => `1px solid ${alpha(color, theme.palette.mode === 'dark' ? 0.32 : 0.20)}`,
});
