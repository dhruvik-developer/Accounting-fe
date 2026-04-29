/**
 * Expense create/edit drawer. Calculates GST + total inline as the user types
 * so the bookkeeper sees the same number that'll get posted.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Grid, ListSubheader, MenuItem, Stack, Switch,
  TextField, Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import FormDrawer from '@/components/FormDrawer';
import MoneyDisplay from '@/components/MoneyDisplay';
import { notify } from '@/components/Notifier';
import { formatApiError } from '@/app/errors';
import { expenseService } from './mockService';
import type {
  ApprovalStatus, Expense, ExpenseCategory, ExpenseInput,
  ExpenseStatus, PaymentMode, TaxType,
} from './types';

// Sentinel value for the "Add new category" menu item. Picked so it never
// collides with a real UUID coming back from the API.
const ADD_CATEGORY = '__add_new__';

type Props = {
  open: boolean;
  editing: Expense | null;
  onClose: () => void;
  onSaved: (e: Expense) => void;
};

const EMPTY: ExpenseInput = {
  expense_date: dayjs().format('YYYY-MM-DD'),
  category_id: '',
  vendor_name: '', vendor_gstin: '',
  description: '',
  amount: 0, tax_type: 'gst', gst_rate: 18, gst_amount: 0, total_amount: 0,
  payment_mode: 'bank', paid_amount: 0,
  status: 'unpaid', approval_status: 'pending',
  is_recurring: false,
  attachment_name: '', notes: '',
  branch_id: null,
};

const computeTax = (amount: number, rate: number, type: TaxType) => {
  if (type === 'exempt' || type === 'none') return { gst: 0, total: amount };
  const gst = +(amount * (rate / 100)).toFixed(2);
  return { gst, total: +(amount + gst).toFixed(2) };
};

const inferStatus = (paid: number, total: number): ExpenseStatus => {
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
};

export default function ExpenseForm({ open, editing, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ExpenseInput>(EMPTY);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Inline "Add category" dialog state.
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catBusy, setCatBusy] = useState(false);
  const [catErr, setCatErr] = useState('');

  const loadCategories = () =>
    expenseService.listCategories()
      .then(setCategories)
      .catch((e) => {
        setCategories([]);
        // Don't break the form — just surface why the dropdown is empty.
        setErr(formatApiError(e, "Couldn't load expense categories"));
      });

  useEffect(() => {
    if (!open) return;
    setErr('');
    loadCategories();
    if (editing) {
      const { id, expense_number, created_at, updated_at, category_name, ...rest } = editing;
      setForm({ ...EMPTY, ...rest });
    } else {
      setForm(EMPTY);
    }
  }, [open, editing]);

  // Recompute taxes whenever amount / rate / type changes
  useEffect(() => {
    const { gst, total } = computeTax(Number(form.amount) || 0, Number(form.gst_rate) || 0, form.tax_type);
    setForm((f) => ({ ...f, gst_amount: gst, total_amount: total, status: inferStatus(f.paid_amount, total) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.amount, form.gst_rate, form.tax_type]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.expense_date) e.expense_date = 'Required';
    if (!form.category_id) e.category_id = 'Required';
    if (!form.vendor_name.trim()) e.vendor_name = 'Required';
    if (!form.amount || form.amount <= 0) e.amount = 'Must be > 0';
    if (form.paid_amount < 0) e.paid_amount = 'Cannot be negative';
    if (form.paid_amount > form.total_amount) e.paid_amount = 'Exceeds total';
    return e;
  }, [form]);

  const valid = Object.keys(errors).length === 0;

  const handleSubmit = async () => {
    if (!valid) return;
    setBusy(true);
    setErr('');
    try {
      const cat = categories.find((c) => c.id === form.category_id);
      const payload = { ...form, status: inferStatus(form.paid_amount, form.total_amount) };
      const saved = editing
        ? await expenseService.update(editing.id, payload)
        : await expenseService.create(payload);
      saved.category_name = cat?.name;
      onSaved(saved);
      onClose();
    } catch (e: any) {
      setErr(e?.message || 'Could not save expense');
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof ExpenseInput>(k: K, v: ExpenseInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // TODO(backend): upload via /attachments/ endpoint and store the returned URL.
    // For now we just keep the filename — bytes aren't persisted.
    if (file) set('attachment_name', file.name);
  };

  const handleCreateCategory = async () => {
    const name = catName.trim();
    if (!name) {
      setCatErr('Name is required');
      return;
    }
    setCatBusy(true);
    setCatErr('');
    try {
      const created = await expenseService.createCategory(name, catCode.trim() || undefined);
      setCategories((cs) => {
        // Sort A-Z to match the backend's `ordering = ('name',)`.
        const next = [...cs.filter((c) => c.id !== created.id), created];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      set('category_id', created.id);
      setCatDialogOpen(false);
      notify({ severity: 'success', message: `Added category “${created.name}”` });
    } catch (e) {
      setCatErr(formatApiError(e, 'Could not create category'));
    } finally {
      setCatBusy(false);
    }
  };

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={editing ? `Edit ${editing.expense_number}` : 'New expense'}
      subtitle="Track purchase bills, recurring spend, and approvals."
      submitLabel={editing ? 'Save changes' : 'Save expense'}
      submitting={busy}
      submitDisabled={!valid}
      width={580}
    >
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Stack spacing={2.5}>
        <Section>Details</Section>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth size="small" type="date" label="Date *"
              InputLabelProps={{ shrink: true }}
              value={form.expense_date}
              onChange={(e) => set('expense_date', e.target.value)}
              error={!!errors.expense_date} helperText={errors.expense_date} />
          </Grid>
          <Grid item xs={12} sm={7}>
            <TextField fullWidth size="small" select label="Category *"
              value={form.category_id}
              onChange={(e) => {
                const v = e.target.value;
                if (v === ADD_CATEGORY) {
                  setCatName('');
                  setCatCode('');
                  setCatErr('');
                  setCatDialogOpen(true);
                  return;
                }
                set('category_id', v);
              }}
              error={!!errors.category_id}
              helperText={
                errors.category_id
                  || (categories.length === 0 ? 'No categories yet — use “Add new category”.' : ' ')
              }>
              <MenuItem value="">— Select —</MenuItem>
              {categories.length > 0 && (
                <ListSubheader sx={{ lineHeight: '32px', fontSize: 11, letterSpacing: 0.6 }}>
                  CATEGORIES
                </ListSubheader>
              )}
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.code} · {c.name}</MenuItem>
              ))}
              <MenuItem value={ADD_CATEGORY} sx={{ color: 'primary.main', fontWeight: 600 }}>
                <AddCircleOutlineIcon fontSize="small" sx={{ mr: 1 }} />
                Add new category
              </MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={7}>
            <TextField fullWidth size="small" label="Vendor / payee *"
              value={form.vendor_name} onChange={(e) => set('vendor_name', e.target.value)}
              error={!!errors.vendor_name} helperText={errors.vendor_name} />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth size="small" label="Vendor GSTIN"
              value={form.vendor_gstin ?? ''}
              onChange={(e) => set('vendor_gstin', e.target.value.toUpperCase())}
              inputProps={{ style: { fontFamily: '"IBM Plex Mono", monospace' } }} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)} />
          </Grid>
        </Grid>

        <Section>Amounts</Section>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" type="number" label="Amount (pre-tax) *"
              value={form.amount}
              onChange={(e) => set('amount', Number(e.target.value) || 0)}
              error={!!errors.amount} helperText={errors.amount}
              inputProps={{ min: 0, step: '0.01' }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" select label="Tax type"
              value={form.tax_type}
              onChange={(e) => set('tax_type', e.target.value as TaxType)}>
              <MenuItem value="gst">GST (CGST+SGST)</MenuItem>
              <MenuItem value="igst">IGST (inter-state)</MenuItem>
              <MenuItem value="exempt">Exempt</MenuItem>
              <MenuItem value="none">No tax</MenuItem>
            </TextField>
          </Grid>
          {form.tax_type !== 'none' && form.tax_type !== 'exempt' && (
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="number" label="GST rate %"
                value={form.gst_rate}
                onChange={(e) => set('gst_rate', Number(e.target.value) || 0)} />
            </Grid>
          )}
          {form.tax_type !== 'none' && (
            <Grid item xs={6} sm={4}>
              <ReadonlyValue label="GST amount" value={<MoneyDisplay value={form.gst_amount} />} />
            </Grid>
          )}
          <Grid item xs={6} sm={4}>
            <ReadonlyValue label="Total" value={<MoneyDisplay value={form.total_amount} sx={{ fontWeight: 800, fontSize: 16 }} />} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" type="number" label="Paid amount"
              value={form.paid_amount}
              onChange={(e) => set('paid_amount', Number(e.target.value) || 0)}
              error={!!errors.paid_amount} helperText={errors.paid_amount}
              inputProps={{ min: 0, step: '0.01' }} />
          </Grid>
        </Grid>

        <Section>Payment & approval</Section>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" select label="Payment mode"
              value={form.payment_mode}
              onChange={(e) => set('payment_mode', e.target.value as PaymentMode)}>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="bank">Bank transfer</MenuItem>
              <MenuItem value="upi">UPI</MenuItem>
              <MenuItem value="card">Card</MenuItem>
              <MenuItem value="cheque">Cheque</MenuItem>
              <MenuItem value="wallet">Wallet</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" select label="Approval"
              value={form.approval_status}
              onChange={(e) => set('approval_status', e.target.value as ApprovalStatus)}>
              <MenuItem value="not_required">Not required</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel control={
              <Switch checked={form.is_recurring}
                onChange={(e) => set('is_recurring', e.target.checked)} />
            } label="Recurring expense" />
          </Grid>
          {form.is_recurring && (
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" select label="Repeats"
                value={form.recurring_period ?? 'monthly'}
                onChange={(e) => set('recurring_period', e.target.value as any)}>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
                <MenuItem value="yearly">Yearly</MenuItem>
              </TextField>
            </Grid>
          )}
        </Grid>

        <Section>Attachment & notes</Section>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Button
              component="label"
              startIcon={<AttachFileOutlinedIcon />}
              variant="outlined"
              size="small"
            >
              {form.attachment_name ? 'Replace bill' : 'Attach bill / receipt'}
              <input hidden type="file" accept="image/*,.pdf" onChange={onAttach} />
            </Button>
            {form.attachment_name && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5 }}>
                {form.attachment_name}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              File contents are stored locally only — backend upload not yet wired.
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" multiline rows={3} label="Notes"
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)} />
          </Grid>
        </Grid>
      </Stack>

      <Dialog open={catDialogOpen} onClose={() => !catBusy && setCatDialogOpen(false)}
        maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>New expense category</DialogTitle>
        <DialogContent>
          {catErr && <Alert severity="error" sx={{ mb: 2 }}>{catErr}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus fullWidth size="small" label="Name *"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); } }}
            />
            <TextField
              fullWidth size="small" label="Code (optional)"
              value={catCode}
              onChange={(e) => setCatCode(e.target.value.toUpperCase().slice(0, 10))}
              helperText="Short tag like RENT, UTIL. Leave blank to auto-generate."
              inputProps={{ style: { fontFamily: '"IBM Plex Mono", monospace' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCatDialogOpen(false)} disabled={catBusy}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateCategory} disabled={catBusy}>
            {catBusy ? 'Adding…' : 'Add category'}
          </Button>
        </DialogActions>
      </Dialog>
    </FormDrawer>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" sx={{
      color: 'text.secondary', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
    }}>
      {children}
    </Typography>
  );
}

function ReadonlyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack sx={{
      px: 1.25, py: 1, borderRadius: 1,
      border: 1, borderColor: 'divider', minHeight: 40,
      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
    }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography component="div">{value}</Typography>
    </Stack>
  );
}
