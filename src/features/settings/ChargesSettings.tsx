/**
 * Settings → Charges
 *
 * CRUD list for ChargeTemplate rows: master list of reusable charges
 * (Freight, Packing, Labour, Insurance, …) used by the invoice/bill
 * "Add charge" flow.
 *
 * One screen, two zones:
 *   • Top   : table of templates with inline activate/deactivate + delete
 *   • Right : side-drawer form for create/edit
 *
 * Keeping the form as a drawer (not a separate route) means a Settings user
 * can scan the list, edit a row, and see updated values back in the table
 * without leaving /settings.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, FormControlLabel, Grid, IconButton, MenuItem,
  Paper, Stack, Switch, TextField, Tooltip, Typography, alpha,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { api } from '@/app/api';
import { formatApiError } from '@/app/errors';
import { notify } from '@/components/Notifier';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormDrawer from '@/components/FormDrawer';

type Template = {
  id?: string;
  code: string;
  name: string;
  description: string;
  type: 'fixed' | 'percent';
  default_value: number | string;
  apply_before_tax: boolean;
  tax_rate: string | null;
  tax_rate_value?: string | null;
  ledger_account: string | null;
  ledger_account_name?: string | null;
  applies_to_sales: boolean;
  applies_to_purchase: boolean;
  is_active: boolean;
  sort_order: number;
};

const EMPTY: Template = {
  code: '', name: '', description: '',
  type: 'fixed', default_value: 0,
  apply_before_tax: true, tax_rate: null, ledger_account: null,
  applies_to_sales: true, applies_to_purchase: true,
  is_active: true, sort_order: 0,
};

const num = (v: any) => Number(v || 0);

export default function ChargesSettings() {
  const [rows, setRows] = useState<Template[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<Template>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [drawerErr, setDrawerErr] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([
      api.get('/charges/templates/', { params: { page_size: 200 } }),
      api.get('/taxes/rates/').catch(() => ({ data: [] })),
      api.get('/accounting/accounts/').catch(() => ({ data: [] })),
    ])
      .then(([cR, tR, aR]) => {
        setRows((cR.data.results ?? cR.data) as Template[]);
        setTaxRates((tR.data?.results ?? tR.data) || []);
        setAccounts((aR.data?.results ?? aR.data) || []);
      })
      .catch((e) => setErr(formatApiError(e, 'Failed to load charge templates')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY,
      sort_order: rows.length ? Math.max(...rows.map((r) => r.sort_order || 0)) + 10 : 10,
    });
    setDrawerErr('');
    setDrawerOpen(true);
  };
  const startEdit = (row: Template) => {
    setEditing(row);
    setForm({
      ...EMPTY,
      ...row,
      default_value: num(row.default_value),
      tax_rate: row.tax_rate || null,
      ledger_account: row.ledger_account || null,
    });
    setDrawerErr('');
    setDrawerOpen(true);
  };

  const set = <K extends keyof Template>(k: K, v: Template[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setDrawerErr('');
    try {
      const code = form.code.trim().toUpperCase();
      const name = form.name.trim();
      if (!code || !name) {
        throw new Error('Code and Name are required.');
      }
      const payload = {
        ...form,
        code,
        name,
        default_value: num(form.default_value),
        tax_rate: form.apply_before_tax ? form.tax_rate : null,
      };
      if (editing?.id) {
        await api.patch(`/charges/templates/${editing.id}/`, payload);
        notify({ severity: 'success', message: `Updated ${name}` });
      } else {
        await api.post('/charges/templates/', payload);
        notify({ severity: 'success', message: `Created ${name}` });
      }
      setDrawerOpen(false);
      load();
    } catch (e) {
      setDrawerErr(formatApiError(e, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  // Inline toggle on the table for quick activate / deactivate.
  const toggleActive = async (row: Template) => {
    try {
      await api.patch(`/charges/templates/${row.id}/`, { is_active: !row.is_active });
      load();
    } catch (e) {
      setErr(formatApiError(e, 'Failed to toggle active'));
    }
  };

  const onDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await api.delete(`/charges/templates/${deleteTarget.id}/`);
      notify({ severity: 'success', message: `Removed ${deleteTarget.name}` });
      setDeleteTarget(null);
      load();
    } catch (e) {
      setErr(formatApiError(e, 'Failed to delete'));
      setDeleteTarget(null);
    }
  };

  const cols: GridColDef<Template>[] = useMemo(() => [
    {
      field: 'code', headerName: 'Code', width: 110,
      renderCell: (p) => (
        <Typography variant="body2" sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'name', headerName: 'Name', flex: 1, minWidth: 200,
      renderCell: (p) => (
        <Stack>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.row.name}</Typography>
          {p.row.description && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {p.row.description}
            </Typography>
          )}
        </Stack>
      ),
    },
    {
      field: 'type', headerName: 'Type', width: 130,
      renderCell: (p) => (
        <Chip size="small"
          label={p.row.type === 'percent'
            ? `${num(p.row.default_value)}%`
            : `Fixed ₹${num(p.row.default_value).toLocaleString('en-IN')}`}
          sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
      ),
    },
    {
      field: 'apply_before_tax', headerName: 'GST', width: 140,
      renderCell: (p) => p.row.apply_before_tax ? (
        <Chip size="small" label={`Pre-tax · ${p.row.tax_rate_value || 0}%`}
          color="primary" variant="outlined"
          sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
      ) : (
        <Chip size="small" label="Flat (no GST)" variant="outlined"
          sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
      ),
    },
    {
      field: 'applies_to_sales', headerName: 'Side', width: 130,
      renderCell: (p) => {
        const sales = !!p.row.applies_to_sales, purchase = !!p.row.applies_to_purchase;
        const label = sales && purchase ? 'Sales + Purchase'
          : sales ? 'Sales only'
          : purchase ? 'Purchase only'
          : '—';
        return <Chip size="small" label={label} sx={{ height: 22, fontSize: 11 }} />;
      },
    },
    {
      field: 'is_active', headerName: 'Active', width: 100,
      renderCell: (p) => (
        <Switch size="small" checked={p.row.is_active}
          onChange={() => toggleActive(p.row)}
          onClick={(e) => e.stopPropagation()} />
      ),
    },
    {
      field: 'actions', headerName: '', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); startEdit(p.row); }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" sx={{ color: 'error.main' }}
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.row); }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], [rows]);

  const counts = useMemo(() => ({
    active: rows.filter((r) => r.is_active).length,
    sales: rows.filter((r) => r.applies_to_sales && r.is_active).length,
    purchase: rows.filter((r) => r.applies_to_purchase && r.is_active).length,
  }), [rows]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }}
        justifyContent="space-between" spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 1.5,
            display: 'grid', placeItems: 'center', color: '#fff',
            background: 'linear-gradient(135deg, #4FC3F7, #00E676)',
          }}>
            <LocalShippingOutlinedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
              Charge templates
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Reusable charges (Freight, Packing, Labour…) shown in the “Add charge” menu on
              invoices, bills, POs and estimates.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
            New template
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`${counts.active} active`}
          sx={{ height: 22, fontWeight: 700, color: '#00E676',
            bgcolor: (t) => alpha('#00E676', t.palette.mode === 'dark' ? 0.15 : 0.1) }} />
        <Chip size="small" label={`${counts.sales} on sales`} variant="outlined"
          sx={{ height: 22, fontWeight: 700 }} />
        <Chip size="small" label={`${counts.purchase} on purchase`} variant="outlined"
          sx={{ height: 22, fontWeight: 700 }} />
      </Stack>

      {err && <Alert severity="error" onClose={() => setErr('')}>{err}</Alert>}

      <Paper>
        <DataGrid
          autoHeight
          loading={loading}
          rows={rows} columns={cols}
          getRowId={(r) => r.id || r.code}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          onRowDoubleClick={(p) => startEdit(p.row as Template)}
          sx={{ border: 0, '& .MuiDataGrid-cell': { py: 1 } }}
        />
      </Paper>

      {/* Create / Edit drawer */}
      <FormDrawer
        open={drawerOpen}
        onClose={() => !saving && setDrawerOpen(false)}
        onSubmit={save}
        title={editing ? `Edit ${editing.code}` : 'New charge template'}
        subtitle="Configure a reusable charge that appears in the “Add charge” menu."
        submitLabel={editing ? 'Save changes' : 'Create template'}
        submitting={saving}
        width={520}
      >
        {drawerErr && <Alert severity="error" sx={{ mb: 2 }}>{drawerErr}</Alert>}
        <Stack spacing={2.25}>
          <Grid container spacing={1.5}>
            <Grid item xs={4}>
              <TextField fullWidth size="small" label="Code *"
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                inputProps={{ style: { fontFamily: '"IBM Plex Mono", monospace' } }}
                helperText="Short tag (FREIGHT, PACK)" />
            </Grid>
            <Grid item xs={8}>
              <TextField fullWidth size="small" label="Name *"
                value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" label="Description"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Optional internal note" />
            </Grid>
          </Grid>

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              Default value
            </Typography>
            <Grid container spacing={1.5} sx={{ mt: 0.25 }}>
              <Grid item xs={5}>
                <TextField select fullWidth size="small" label="Type"
                  value={form.type} onChange={(e) => set('type', e.target.value as any)}>
                  <MenuItem value="fixed">Fixed amount</MenuItem>
                  <MenuItem value="percent">% of subtotal</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={7}>
                <TextField fullWidth size="small" type="number"
                  label={form.type === 'percent' ? 'Default %' : 'Default ₹'}
                  value={form.default_value}
                  onChange={(e) => set('default_value', num(e.target.value))}
                  inputProps={{ min: 0, step: '0.01' }}
                  helperText={form.type === 'percent'
                    ? 'Pre-fills as a % of the document subtotal'
                    : 'Pre-fills as a fixed rupee amount'}
                />
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              GST treatment
            </Typography>
            <FormControlLabel
              control={<Switch checked={form.apply_before_tax}
                onChange={(e) => set('apply_before_tax', e.target.checked)} />}
              label={form.apply_before_tax
                ? 'Add to taxable value (GST applies)'
                : 'Flat post-tax addition (no GST)'}
              sx={{ mt: 0.5 }}
            />
            {form.apply_before_tax && (
              <TextField select fullWidth size="small" label="GST rate"
                value={form.tax_rate || ''} onChange={(e) => set('tax_rate', e.target.value || null)}
                sx={{ mt: 1 }}>
                <MenuItem value="">Same as item rate</MenuItem>
                {taxRates.map((r: any) => (
                  <MenuItem key={r.id} value={r.id}>{r.name} ({r.rate}%)</MenuItem>
                ))}
              </TextField>
            )}
          </Box>

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              Posting
            </Typography>
            <TextField select fullWidth size="small" label="Ledger account"
              value={form.ledger_account || ''}
              onChange={(e) => set('ledger_account', e.target.value || null)}
              sx={{ mt: 1 }}
              helperText="Where this charge posts on the P&L. Leave blank to use the document's default sales/purchases account."
            >
              <MenuItem value="">Default (Sales / Purchases)</MenuItem>
              {accounts.map((a: any) => (
                <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              Where it appears
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
              <FormControlLabel
                control={<Switch checked={form.applies_to_sales}
                  onChange={(e) => set('applies_to_sales', e.target.checked)} />}
                label="Sales (Estimate / SO / Challan / Invoice)" />
              <FormControlLabel
                control={<Switch checked={form.applies_to_purchase}
                  onChange={(e) => set('applies_to_purchase', e.target.checked)} />}
                label="Purchase (PO / Bill)" />
            </Stack>
          </Box>

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControlLabel
                control={<Switch checked={form.is_active}
                  onChange={(e) => set('is_active', e.target.checked)} />}
                label="Active" />
              <TextField type="number" size="small" label="Sort order"
                value={form.sort_order}
                onChange={(e) => set('sort_order', num(e.target.value))}
                sx={{ width: 130 }}
                helperText="Lower = first in dropdown" />
            </Stack>
          </Box>
        </Stack>
      </FormDrawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name}?`}
        body="The template won't appear in the “Add charge” menu anymore. Existing invoices and bills that already reference it keep their charge rows intact."
        tone="danger"
        confirmLabel="Delete"
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Stack>
  );
}
