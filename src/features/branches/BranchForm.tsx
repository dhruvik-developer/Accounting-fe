import { useEffect, useMemo, useState } from 'react';
import {
  Alert, FormControlLabel, Grid, MenuItem, Switch, TextField,
} from '@mui/material';

import { api } from '@/app/api';
import { GST_STATES } from '@/app/gstStates';
import FormDrawer from '@/components/FormDrawer';
import { formatApiError } from '@/app/errors';

export type BranchInput = {
  id?: string;
  code: string;
  name: string;
  state?: string;
  state_code?: string;
  city?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  is_default?: boolean;
  is_active?: boolean;
};

const EMPTY: BranchInput = {
  code: '', name: '', state: '', state_code: '', city: '',
  pincode: '', phone: '', email: '', gstin: '',
  is_default: false, is_active: true,
};

type Props = {
  open: boolean;
  editing: BranchInput | null;
  onClose: () => void;
  onSaved: (b: BranchInput) => void;
};

export default function BranchForm({ open, editing, onClose, onSaved }: Props) {
  const [form, setForm] = useState<BranchInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    setForm(editing ? { ...EMPTY, ...editing } : EMPTY);
  }, [open, editing]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.code.trim()) e.code = 'Required';
    if (!form.name.trim()) e.name = 'Required';
    if (form.gstin && !/^[0-9A-Z]{15}$/.test(form.gstin)) e.gstin = '15-char GSTIN';
    if (form.pincode && !/^[1-9][0-9]{5}$/.test(form.pincode)) e.pincode = '6 digits';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    return e;
  }, [form]);

  const valid = Object.keys(errors).length === 0;

  const patch = (p: Partial<BranchInput>) => setForm((f) => ({ ...f, ...p }));

  const onPickState = (name: string) => {
    const match = GST_STATES.find((s) => s.name === name);
    patch({ state: name, state_code: match?.code || '' });
  };

  const handleSubmit = async () => {
    if (!valid) return;
    setBusy(true);
    setErr('');
    try {
      const res = editing?.id
        ? await api.patch(`/branches/${editing.id}/`, form)
        : await api.post('/branches/', form);
      onSaved(res.data as BranchInput);
      onClose();
    } catch (e) {
      setErr(formatApiError(e, 'Failed to save branch'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDrawer
      open={open}
      title={editing?.id ? 'Edit branch' : 'New branch'}
      subtitle="Each branch can hold its own GSTIN, address, and document numbering."
      submitLabel={editing?.id ? 'Save changes' : 'Create branch'}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={busy}
      submitDisabled={!valid}
    >
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth size="small" label="Code *"
            value={form.code}
            error={!!errors.code} helperText={errors.code}
            onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
          />
        </Grid>
        <Grid item xs={12} sm={8}>
          <TextField
            fullWidth size="small" label="Branch name *"
            value={form.name}
            error={!!errors.name} helperText={errors.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            select fullWidth size="small" label="State"
            value={form.state || ''}
            onChange={(e) => onPickState(e.target.value)}
          >
            <MenuItem value="">— select —</MenuItem>
            {GST_STATES.map((s) => <MenuItem key={s.code} value={s.name}>{s.name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" label="GSTIN"
            value={form.gstin || ''}
            error={!!errors.gstin} helperText={errors.gstin}
            onChange={(e) => patch({ gstin: e.target.value.toUpperCase() })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" label="City"
            value={form.city || ''}
            onChange={(e) => patch({ city: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            fullWidth size="small" label="PIN"
            value={form.pincode || ''}
            error={!!errors.pincode} helperText={errors.pincode}
            onChange={(e) => patch({ pincode: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            fullWidth size="small" label="Phone"
            value={form.phone || ''}
            onChange={(e) => patch({ phone: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth size="small" label="Email"
            value={form.email || ''}
            error={!!errors.email} helperText={errors.email}
            onChange={(e) => patch({ email: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={<Switch checked={!!form.is_default}
              onChange={(e) => patch({ is_default: e.target.checked })} />}
            label="Default branch"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={<Switch checked={form.is_active !== false}
              onChange={(e) => patch({ is_active: e.target.checked })} />}
            label="Active"
          />
        </Grid>
      </Grid>
    </FormDrawer>
  );
}
