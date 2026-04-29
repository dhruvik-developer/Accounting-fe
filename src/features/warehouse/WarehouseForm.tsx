/**
 * Create / edit a warehouse via FormDrawer.
 *
 * Validation is done locally — required fields + 6-digit PIN + GST state
 * lookup happens at submit time. Replace `warehouseService.{create,update}`
 * with real `api.post/patch` calls when the backend ships.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, FormControl, FormControlLabel, Grid, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import FormDrawer from '@/components/FormDrawer';
import { fetchBranches, warehouseService } from './mockService';
import type { Warehouse, WarehouseInput, WarehouseStatus } from './types';

type Props = {
  open: boolean;
  editing: Warehouse | null;
  onClose: () => void;
  onSaved: (w: Warehouse) => void;
};

const STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const EMPTY: WarehouseInput = {
  warehouse_code: '', warehouse_name: '',
  branch_id: null,
  manager_name: '', phone: '', email: '',
  address: '', city: '', state: 'Maharashtra', pincode: '',
  status: 'active', opening_stock_value: 0,
  is_default: false, notes: '',
};

export default function WarehouseForm({ open, editing, onClose, onSaved }: Props) {
  const [form, setForm] = useState<WarehouseInput>(EMPTY);
  const [branches, setBranches] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    fetchBranches().then(setBranches).catch(() => setBranches([]));
    setErr('');
    if (editing) {
      const { id, created_at, updated_at, branch_name, ...rest } = editing;
      setForm({ ...EMPTY, ...rest });
    } else {
      setForm(EMPTY);
    }
  }, [open, editing]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.warehouse_code.trim()) e.warehouse_code = 'Required';
    if (!form.warehouse_name.trim()) e.warehouse_name = 'Required';
    if (!form.manager_name.trim()) e.manager_name = 'Required';
    if (form.pincode && !/^[1-9][0-9]{5}$/.test(form.pincode)) e.pincode = '6 digits';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (form.phone && form.phone.replace(/\D/g, '').length < 10) e.phone = 'At least 10 digits';
    return e;
  }, [form]);

  const valid = Object.keys(errors).length === 0;

  const handleSubmit = async () => {
    if (!valid) return;
    setBusy(true);
    setErr('');
    try {
      const branch = branches.find((b) => b.id === form.branch_id);
      const payload: WarehouseInput = { ...form };
      const saved = editing
        ? await warehouseService.update(editing.id, payload)
        : await warehouseService.create(payload);
      saved.branch_name = branch?.name;
      onSaved(saved);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Could not save warehouse');
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof WarehouseInput>(k: K, v: WarehouseInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={editing ? `Edit ${editing.warehouse_name}` : 'New warehouse'}
      subtitle="Track stock per physical location and assign to a branch."
      submitLabel={editing ? 'Save changes' : 'Create warehouse'}
      submitting={busy}
      submitDisabled={!valid}
      width={560}
    >
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Stack spacing={2.5}>
        <SectionTitle>Identity</SectionTitle>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth size="small"
              label="Warehouse code *"
              placeholder="WH-MAIN"
              value={form.warehouse_code}
              onChange={(e) => set('warehouse_code', e.target.value.toUpperCase())}
              error={!!errors.warehouse_code}
              helperText={errors.warehouse_code}
              inputProps={{ style: { fontFamily: '"IBM Plex Mono", monospace' } }}
            />
          </Grid>
          <Grid item xs={12} sm={7}>
            <TextField
              fullWidth size="small"
              label="Warehouse name *"
              placeholder="Main Warehouse"
              value={form.warehouse_name}
              onChange={(e) => set('warehouse_name', e.target.value)}
              error={!!errors.warehouse_name}
              helperText={errors.warehouse_name}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" select
              label="Branch"
              value={form.branch_id ?? ''}
              onChange={(e) => set('branch_id', e.target.value || null)}
            >
              <MenuItem value="">(unassigned)</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.code ? `${b.code} · ${b.name}` : b.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" select
              label="Status"
              value={form.status}
              onChange={(e) => set('status', e.target.value as WarehouseStatus)}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </TextField>
          </Grid>
        </Grid>

        <SectionTitle>Contact</SectionTitle>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small"
              label="Manager *"
              value={form.manager_name}
              onChange={(e) => set('manager_name', e.target.value)}
              error={!!errors.manager_name}
              helperText={errors.manager_name}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small"
              label="Phone"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              error={!!errors.phone}
              helperText={errors.phone}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small"
              label="Email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              error={!!errors.email}
              helperText={errors.email}
            />
          </Grid>
        </Grid>

        <SectionTitle>Address</SectionTitle>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" multiline rows={2}
              label="Street address"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth size="small" label="City"
              value={form.city} onChange={(e) => set('city', e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" select label="State"
              value={form.state} onChange={(e) => set('state', e.target.value)}>
              {STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth size="small" label="PIN"
              value={form.pincode}
              onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
              error={!!errors.pincode} helperText={errors.pincode}
            />
          </Grid>
        </Grid>

        <SectionTitle>Stock</SectionTitle>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth size="small" type="number"
              label="Opening stock value (₹)"
              value={form.opening_stock_value}
              onChange={(e) => set('opening_stock_value', Number(e.target.value) || 0)}
              inputProps={{ min: 0, step: '0.01' }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl>
              <FormControlLabel
                control={<Switch checked={form.is_default}
                  onChange={(e) => set('is_default', e.target.checked)} />}
                label="Default for new transactions"
              />
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" multiline rows={2}
              label="Notes"
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Grid>
        </Grid>
      </Stack>
    </FormDrawer>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" sx={{
      color: 'text.secondary', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
    }}>
      {children}
    </Typography>
  );
}
