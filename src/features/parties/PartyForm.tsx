/**
 * Party create/edit wizard. 4 steps: Basic, GST & Ledger, Credit & Contacts,
 * Address & Bank. Extracted from Parties.tsx during the 2-pane rebuild so
 * the container can stay focused on layout + selection state.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel, Grid, IconButton,
  MenuItem, Paper, Stack, Step, StepLabel, Stepper, Switch, TextField, Typography,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DeleteIcon from '@mui/icons-material/Delete';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { api } from '@/app/api';
import { GST_STATES } from '@/app/gstStates';

const today = () => new Date().toISOString().slice(0, 10);
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const gstStateName = (code: string) => GST_STATES.find((s) => s.code === code)?.name || '';

const EMPTY_CONTACT = {
  name: '', designation: '', phone: '', email: '',
  is_primary: true, receives_invoice: true, receives_reminder: true,
};
const EMPTY_BANK = {
  account_holder_name: '', bank_name: '', account_number: '',
  ifsc: '', branch_name: '', upi_id: '', is_default: true,
};
const EMPTY_ADDRESS = {
  label: '', address_line1: '', address_line2: '', city: '',
  state: '', state_code: '', pincode: '', country: 'India', gstin: '', is_default: true,
};

const EMPTY = {
  type: 'customer',
  name: '',
  display_name: '',
  legal_name: '',
  gst_treatment: 'unregistered',
  gstin: '',
  pan: '',
  phone: '',
  whatsapp: '',
  email: '',
  tags: '',
  state: '',
  state_code: '',
  place_of_supply: '',
  billing_address: '',
  shipping_address: '',
  opening_balance: 0,
  opening_balance_type: 'dr',
  opening_balance_date: today(),
  auto_create_ledger: true,
  ledger_group: 'sundry_debtors',
  ledger_account: '',
  credit_limit: 0,
  credit_days: 0,
  payment_terms: 'due_on_receipt',
  overdue_alert_enabled: true,
  block_if_credit_exceeded: false,
  preferred_payment_mode: '',
  is_active: true,
  contacts: [{ ...EMPTY_CONTACT }],
  billing: { ...EMPTY_ADDRESS, type: 'billing', label: 'Billing' },
  shipping: { ...EMPTY_ADDRESS, type: 'shipping', label: 'Shipping' },
  bank_accounts: [{ ...EMPTY_BANK }],
  tax_setting: {
    tds_applicable: false, tds_section: '', tds_rate: 0,
    tcs_applicable: false, tcs_rate: 0,
  },
  branch_access_ids: [] as string[],
};

const STEPS = ['Basic', 'GST & Ledger', 'Credit & Contacts', 'Address & Bank'];

const describeError = (e: any) =>
  e?.response?.data?.detail
  || JSON.stringify(e?.response?.data)
  || e?.message
  || 'Failed to save party';

type Props = {
  open: boolean;
  editing: any | null;
  branches: any[];
  accounts: any[];
  onClose: () => void;
  onSaved: (party: any) => void;
};

export default function PartyForm({ open, editing, branches, accounts, onClose, onSaved }: Props) {
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [activeStep, setActiveStep] = useState(0);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [gstinFetching, setGstinFetching] = useState(false);
  const [gstinFetchMsg, setGstinFetchMsg] = useState('');
  const [tdsSections, setTdsSections] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    api.get('/taxes/tds-sections/')
      .then((r) => setTdsSections(r.data?.results || []))
      .catch(() => setTdsSections([]));
  }, [open]);

  const fetchGstin = async () => {
    const gstin = String(form.gstin || '').trim().toUpperCase();
    if (!gstin || !GSTIN_RE.test(gstin)) {
      setGstinFetchMsg('Enter a valid 15-character GSTIN to fetch.');
      return;
    }
    setGstinFetching(true);
    setGstinFetchMsg('');
    try {
      const { data } = await api.get('/parties/gstin-fetch/', { params: { gstin } });
      // Always overwrite Display Name + Legal Name on Fetch — the user
      // explicitly asked for those fields to fill, and they can edit
      // afterwards. Source-aware messaging tells them whether the value
      // is real (live GSTN / existing-party reuse) or a placeholder.
      setForm((f: any) => ({
        ...f,
        gstin,
        pan: data.pan || f.pan,
        state: data.state || f.state,
        state_code: data.state_code || f.state_code,
        place_of_supply: data.place_of_supply || f.place_of_supply || data.state_code,
        gst_treatment: data.gst_treatment || 'registered',
        legal_name: data.legal_name || f.legal_name || '',
        name: data.trade_name || data.legal_name || f.name || '',
        billing: {
          ...f.billing,
          state: data.state || f.billing?.state || '',
          state_code: data.state_code || f.billing?.state_code || '',
          address_line1: f.billing?.address_line1 || data.address_line1 || '',
          city: f.billing?.city || data.city || '',
          pincode: f.billing?.pincode || data.pincode || '',
          gstin,
        },
      }));
      const sourceMsg = (() => {
        if (data.source === 'gstn') return `Fetched live from GST Portal · ${data.taxpayer_type}`;
        if (data.source === 'existing_party') return `Reused from an existing party with this GSTIN · ${data.taxpayer_type}`;
        return `${data.taxpayer_type} · placeholder name filled — verify against the GST registration certificate, or connect GST Portal in Settings for live name/address.`;
      })();
      setGstinFetchMsg(sourceMsg);
    } catch (e: any) {
      setGstinFetchMsg(e?.response?.data?.detail || 'GSTIN fetch failed.');
    } finally {
      setGstinFetching(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setErr('');
    setActiveStep(0);
    setSaving(false);
    if (!editing) {
      setForm({ ...EMPTY, opening_balance_date: today() });
      return;
    }
    const billing = editing.addresses?.find((a: any) => a.type === 'billing' && a.is_default)
      || editing.addresses?.find((a: any) => a.type === 'billing');
    const shipping = editing.addresses?.find((a: any) => a.type === 'shipping' && a.is_default)
      || editing.addresses?.find((a: any) => a.type === 'shipping');
    setForm({
      ...EMPTY,
      ...editing,
      ledger_account: editing.ledger_account || '',
      opening_balance: editing.opening_balance ?? 0,
      opening_balance_type: editing.opening_balance_type ?? 'dr',
      opening_balance_date: editing.opening_balance_date || today(),
      credit_limit: editing.credit_limit ?? 0,
      credit_days: editing.credit_days ?? 0,
      contacts: editing.contacts?.length ? editing.contacts : [{ ...EMPTY_CONTACT }],
      billing: billing
        ? { ...EMPTY_ADDRESS, ...billing }
        : { ...EMPTY_ADDRESS, type: 'billing', label: 'Billing', address_line1: editing.billing_address || '' },
      shipping: shipping
        ? { ...EMPTY_ADDRESS, ...shipping }
        : { ...EMPTY_ADDRESS, type: 'shipping', label: 'Shipping', address_line1: editing.shipping_address || '' },
      bank_accounts: editing.bank_accounts?.length ? editing.bank_accounts : [{ ...EMPTY_BANK }],
      tax_setting: editing.tax_setting || EMPTY.tax_setting,
      branch_access_ids: editing.branch_access?.map((b: any) => b.allowed_branch) || [],
    });
  }, [open, editing]);

  const ledgerAccounts = accounts.filter((a: any) => !form.ledger_group || a.group === form.ledger_group);

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });
  const setBool = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.checked });

  const setType = (e: any) => {
    const type = e.target.value;
    const ledger_group = type === 'supplier' ? 'sundry_creditors' : 'sundry_debtors';
    setForm({ ...form, type, ledger_group, ledger_account: '' });
  };

  const setGstin = (e: any) => {
    const gstin = String(e.target.value || '').toUpperCase();
    const next: any = { ...form, gstin };
    if (GSTIN_RE.test(gstin)) {
      const stateCode = gstin.slice(0, 2);
      next.gst_treatment = 'registered';
      next.pan = gstin.slice(2, 12);
      next.state_code = stateCode;
      next.state = gstStateName(stateCode);
      next.place_of_supply = stateCode;
    }
    setForm(next);
  };

  const setState = (e: any) => {
    const s = GST_STATES.find((x) => x.name === e.target.value);
    setForm({
      ...form,
      state: e.target.value,
      state_code: s?.code || '',
      place_of_supply: s?.code || form.place_of_supply,
    });
  };

  const updateContact = (i: number, key: string, value: any) => {
    const contacts = [...form.contacts];
    contacts[i] = { ...contacts[i], [key]: value };
    if (key === 'is_primary' && value) {
      contacts.forEach((c: any, j: number) => { if (j !== i) c.is_primary = false; });
    }
    setForm({ ...form, contacts });
  };
  const addContact = () => setForm({
    ...form, contacts: [...form.contacts, { ...EMPTY_CONTACT, is_primary: false }],
  });
  const removeContact = (i: number) => {
    const c = [...form.contacts];
    c.splice(i, 1);
    setForm({ ...form, contacts: c.length ? c : [{ ...EMPTY_CONTACT }] });
  };

  const updateBank = (i: number, key: string, value: any) => {
    const bank_accounts = [...form.bank_accounts];
    bank_accounts[i] = { ...bank_accounts[i], [key]: value };
    setForm({ ...form, bank_accounts });
  };
  const addBank = () => setForm({
    ...form, bank_accounts: [...form.bank_accounts, { ...EMPTY_BANK, is_default: false }],
  });
  const removeBank = (i: number) => {
    const b = [...form.bank_accounts];
    b.splice(i, 1);
    setForm({ ...form, bank_accounts: b.length ? b : [{ ...EMPTY_BANK }] });
  };

  const updateAddress = (kind: 'billing' | 'shipping', key: string, value: any) =>
    setForm({ ...form, [kind]: { ...form[kind], [key]: value } });
  const setAddressState = (kind: 'billing' | 'shipping', stateName: string) => {
    const s = GST_STATES.find((x) => x.name === stateName);
    setForm({
      ...form,
      [kind]: { ...form[kind], state: stateName, state_code: s?.code || '' },
    });
  };
  const copyBillingToShipping = () => setForm({
    ...form,
    shipping: { ...form.billing, type: 'shipping', label: 'Shipping', id: form.shipping?.id },
  });

  const buildPayload = () => {
    const contacts = form.contacts
      .map((c: any) => ({
        name: String(c.name || '').trim(),
        designation: c.designation || '',
        phone: c.phone || '',
        email: c.email || '',
        is_primary: !!c.is_primary,
        receives_invoice: !!c.receives_invoice,
        receives_reminder: !!c.receives_reminder,
      }))
      .filter((c: any) => c.name || c.phone || c.email);

    const bank_accounts = form.bank_accounts
      .map((b: any) => ({
        account_holder_name: b.account_holder_name || '',
        bank_name: b.bank_name || '',
        account_number: b.account_number || '',
        ifsc: String(b.ifsc || '').toUpperCase(),
        branch_name: b.branch_name || '',
        upi_id: b.upi_id || '',
        is_default: !!b.is_default,
      }))
      .filter((b: any) => b.bank_name || b.account_number || b.upi_id);

    return {
      type: form.type,
      name: String(form.name || '').trim(),
      display_name: form.display_name || form.name,
      legal_name: form.legal_name || '',
      gst_treatment: form.gst_treatment,
      gstin: String(form.gstin || '').toUpperCase(),
      pan: String(form.pan || '').toUpperCase(),
      phone: form.phone || '',
      whatsapp: form.whatsapp || '',
      email: form.email || '',
      tags: form.tags || '',
      state: form.state || '',
      state_code: form.state_code || '',
      place_of_supply: form.place_of_supply || form.state_code || '',
      billing_address: form.billing?.address_line1 || '',
      shipping_address: form.shipping?.address_line1 || '',
      opening_balance: Number(form.opening_balance || 0),
      opening_balance_type: form.opening_balance_type,
      opening_balance_date: form.opening_balance_date || today(),
      auto_create_ledger: !!form.auto_create_ledger,
      ledger_group: form.ledger_group,
      ledger_account: form.ledger_account || null,
      credit_limit: Number(form.credit_limit || 0),
      credit_days: Number(form.credit_days || 0),
      payment_terms: form.payment_terms,
      overdue_alert_enabled: !!form.overdue_alert_enabled,
      block_if_credit_exceeded: !!form.block_if_credit_exceeded,
      preferred_payment_mode: form.preferred_payment_mode || '',
      is_active: !!form.is_active,
      contacts,
      addresses: [
        { ...form.billing, type: 'billing', is_default: true },
        { ...form.shipping, type: 'shipping', is_default: true },
      ],
      bank_accounts,
      tax_setting: {
        tds_applicable: !!form.tax_setting.tds_applicable,
        tds_section: form.tax_setting.tds_section || '',
        tds_rate: Number(form.tax_setting.tds_rate || 0),
        tcs_applicable: !!form.tax_setting.tcs_applicable,
        tcs_rate: Number(form.tax_setting.tcs_rate || 0),
      },
      branch_access: form.branch_access_ids.map((allowed_branch: string) => ({ allowed_branch })),
    };
  };

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const body = buildPayload();
      if (!body.name) throw new Error('Party name is required.');
      if (body.gstin && !GSTIN_RE.test(body.gstin)) throw new Error('Enter a valid GSTIN.');
      if (!body.gstin && ['registered', 'composition', 'sez', 'deemed_export'].includes(body.gst_treatment)) {
        throw new Error('GSTIN is required for this GST treatment.');
      }
      const res = editing
        ? await api.patch(`/parties/${editing.id}/`, body)
        : await api.post('/parties/', body);
      onSaved(res.data);
      onClose();
    } catch (e: any) {
      setErr(describeError(e));
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="h6">{editing ? 'Edit party' : 'New party'}</Typography>
            <Typography variant="body2" color="text.secondary">
              GST, ledger, credit terms, contacts, addresses and bank — all in one place.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={form.type === 'both' ? 'Customer + Supplier' : form.type} />
            <Chip color={form.gstin ? 'primary' : 'default'} label={form.gstin ? 'GST registered' : 'No GSTIN'} />
            <Chip icon={<AccountBalanceIcon />} label={form.auto_create_ledger ? 'Ledger auto' : 'Manual ledger'} />
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
        {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map((label) => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
        </Stepper>

        {activeStep === 0 && (
          <Stack spacing={2.5}>
            <Section
              title="Start with GSTIN — we fill the rest"
              helper="For registered businesses, paste the GSTIN and click Fetch. State, PAN, treatment and legal name auto-fill so you don't retype anything."
              icon={<CloudDownloadIcon fontSize="small" />}
            >
              <Grid container spacing={2} alignItems="flex-start">
                <Grid item xs={12} md={3}>
                  <TextField select fullWidth label="Party type" value={form.type} onChange={setType}>
                    <MenuItem value="customer">Customer</MenuItem>
                    <MenuItem value="supplier">Supplier</MenuItem>
                    <MenuItem value="both">Both</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth label="GSTIN" value={form.gstin}
                    onChange={setGstin}
                    error={!!form.gstin && !GSTIN_RE.test(form.gstin)}
                    helperText={
                      gstinFetchMsg
                      || (form.gstin && !GSTIN_RE.test(form.gstin)
                        ? 'Invalid GSTIN format'
                        : 'Format: 27AAACR1234F1Z5 (state code · PAN · entity · check)')
                    }
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    onClick={fetchGstin}
                    disabled={gstinFetching || !GSTIN_RE.test(String(form.gstin || '').toUpperCase())}
                    startIcon={gstinFetching ? <CircularProgress size={16} /> : <CloudDownloadIcon />}
                    sx={{ height: 56 }}
                  >
                    {gstinFetching ? 'Fetching…' : 'Fetch from GST'}
                  </Button>
                </Grid>
                {form.gstin && GSTIN_RE.test(form.gstin) && (
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {form.pan && <Chip size="small" color="primary" variant="outlined" label={`PAN · ${form.pan}`} />}
                      {form.state && <Chip size="small" color="primary" variant="outlined" label={`${form.state} · ${form.state_code}`} />}
                      {form.gst_treatment && (
                        <Chip size="small" color="success" variant="outlined" label={`Treatment · ${form.gst_treatment}`} />
                      )}
                    </Stack>
                  </Grid>
                )}
              </Grid>
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!form.no_gstin_manual}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((f: any) => ({
                          ...f,
                          no_gstin_manual: checked,
                          gstin: checked ? '' : f.gstin,
                          pan: checked ? '' : f.pan,
                          gst_treatment: checked
                            ? (f.type === 'customer' ? 'consumer' : 'unregistered')
                            : f.gst_treatment,
                        }));
                        setGstinFetchMsg('');
                      }}
                    />
                  }
                  label={<Typography variant="body2">Don't have a GSTIN? Enter party details manually (Unregistered / Consumer)</Typography>}
                />
              </Box>
            </Section>

            <Section title="Party details" helper="Display name is what shows on invoices. Legal name is the registered business name (auto-filled from GST when available).">
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Display name" value={form.name} onChange={set('name')} required helperText="Shown on invoices and the parties list." />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Legal name" value={form.legal_name} onChange={set('legal_name')} helperText="As per GST registration." />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth label="Phone" value={form.phone} onChange={set('phone')} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth label="WhatsApp" value={form.whatsapp} onChange={set('whatsapp')} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth label="Email" value={form.email} onChange={set('email')} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth label="Tags" value={form.tags} onChange={set('tags')} placeholder="VIP, Retail, Distributor" />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel control={<Switch checked={form.is_active} onChange={setBool('is_active')} />} label="Active party" />
                </Grid>
              </Grid>
            </Section>
          </Stack>
        )}

        {activeStep === 1 && (
          <Stack spacing={2.5}>
            <Section
              title="GST summary"
              helper={form.gstin ? 'Pulled from Step 1 — edit only if the GST Portal data is wrong.' : 'No GSTIN — pick the right treatment for unregistered / consumer / export.'}
            >
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <TextField select fullWidth label="GST treatment" value={form.gst_treatment} onChange={set('gst_treatment')}>
                    <MenuItem value="registered">Registered Business</MenuItem>
                    <MenuItem value="unregistered">Unregistered Business</MenuItem>
                    <MenuItem value="consumer">Consumer</MenuItem>
                    <MenuItem value="composition">Composition Dealer</MenuItem>
                    <MenuItem value="sez">SEZ</MenuItem>
                    <MenuItem value="export">Export</MenuItem>
                    <MenuItem value="deemed_export">Deemed Export</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth label="GSTIN" value={form.gstin} InputProps={{ readOnly: true }} helperText={form.gstin ? 'Set on Step 1' : 'No GSTIN — manual entry'} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth label="PAN" value={form.pan} onChange={set('pan')} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField select fullWidth label="State" value={form.state} onChange={setState}>
                    <MenuItem value="">None</MenuItem>
                    {GST_STATES.map((s) => <MenuItem key={s.code} value={s.name}>{s.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={1}>
                  <TextField fullWidth label="Code" value={form.state_code} InputProps={{ readOnly: true }} />
                </Grid>
              </Grid>
            </Section>

            <Section title="TDS & TCS" helper="Configure if you deduct TDS on payments to this party (suppliers) or collect TCS at sale.">
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={<Switch checked={form.tax_setting.tds_applicable} onChange={(e) => setForm({ ...form, tax_setting: { ...form.tax_setting, tds_applicable: e.target.checked } })} />}
                    label="TDS applicable"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    select fullWidth label="TDS section"
                    value={form.tax_setting.tds_section || ''}
                    onChange={(e) => {
                      const code = e.target.value;
                      const match = tdsSections.find((s: any) => s.code === code);
                      setForm({
                        ...form,
                        tax_setting: {
                          ...form.tax_setting,
                          tds_section: code,
                          tds_rate: match ? match.rate : form.tax_setting.tds_rate,
                        },
                      });
                    }}
                    disabled={!form.tax_setting.tds_applicable}
                    helperText={form.tax_setting.tds_applicable ? 'Picks default rate; override below if needed.' : 'Toggle "TDS applicable" first.'}
                  >
                    <MenuItem value="">— Select section —</MenuItem>
                    {tdsSections.map((s: any) => (
                      <MenuItem key={s.code} value={s.code}>
                        {s.code} · {s.label} ({s.rate}%)
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth type="number" label="TDS %" value={form.tax_setting.tds_rate} onChange={(e) => setForm({ ...form, tax_setting: { ...form.tax_setting, tds_rate: e.target.value } })} disabled={!form.tax_setting.tds_applicable} />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControlLabel
                    control={<Switch checked={form.tax_setting.tcs_applicable} onChange={(e) => setForm({ ...form, tax_setting: { ...form.tax_setting, tcs_applicable: e.target.checked } })} />}
                    label="TCS applicable"
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField fullWidth type="number" label="TCS %" value={form.tax_setting.tcs_rate} onChange={(e) => setForm({ ...form, tax_setting: { ...form.tax_setting, tcs_rate: e.target.value } })} />
                </Grid>
              </Grid>
            </Section>

            <Section title="Accounting ledger" helper="Auto-create under Sundry Debtors / Creditors, or map an existing ledger.">
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <FormControlLabel control={<Switch checked={form.auto_create_ledger} onChange={setBool('auto_create_ledger')} />} label="Auto-create ledger" />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField select fullWidth label="Ledger group" value={form.ledger_group} onChange={set('ledger_group')}>
                    <MenuItem value="sundry_debtors">Sundry Debtors</MenuItem>
                    <MenuItem value="sundry_creditors">Sundry Creditors</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField select fullWidth label="Existing ledger account" value={form.ledger_account || ''} onChange={set('ledger_account')} disabled={form.auto_create_ledger}>
                    <MenuItem value="">Auto/new ledger</MenuItem>
                    {ledgerAccounts.map((a: any) => <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth type="number" label="Opening balance" value={form.opening_balance} onChange={set('opening_balance')} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField select fullWidth label="Dr/Cr" value={form.opening_balance_type} onChange={set('opening_balance_type')}>
                    <MenuItem value="dr">Dr — party owes us</MenuItem>
                    <MenuItem value="cr">Cr — we owe party</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth type="date" label="Opening date" value={form.opening_balance_date} onChange={set('opening_balance_date')} InputLabelProps={{ shrink: true }} />
                </Grid>
              </Grid>
            </Section>
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={2.5}>
            <Section title="Payment & credit" helper="Credit days, limits, overdue alerts and payment preferences.">
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <TextField select fullWidth label="Payment terms" value={form.payment_terms} onChange={set('payment_terms')}>
                    <MenuItem value="due_on_receipt">Due on receipt</MenuItem>
                    <MenuItem value="net_7">Net 7</MenuItem>
                    <MenuItem value="net_15">Net 15</MenuItem>
                    <MenuItem value="net_30">Net 30</MenuItem>
                    <MenuItem value="custom">Custom</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth type="number" label="Credit days" value={form.credit_days} onChange={set('credit_days')} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth type="number" label="Credit limit" value={form.credit_limit} onChange={set('credit_limit')} />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField select fullWidth label="Preferred payment" value={form.preferred_payment_mode} onChange={set('preferred_payment_mode')}>
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="bank">Bank</MenuItem>
                    <MenuItem value="upi">UPI</MenuItem>
                    <MenuItem value="cheque">Cheque</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel control={<Switch checked={form.overdue_alert_enabled} onChange={setBool('overdue_alert_enabled')} />} label="Overdue alerts" />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControlLabel control={<Switch checked={form.block_if_credit_exceeded} onChange={setBool('block_if_credit_exceeded')} />} label="Block over credit limit" />
                </Grid>
              </Grid>
            </Section>

            <Section title="Contacts" helper="Multiple contacts for invoices, reminders and communication.">
              <Stack spacing={1.5}>
                {form.contacts.map((contact: any, i: number) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid item xs={12} md={3}><TextField fullWidth label="Contact name" value={contact.name} onChange={(e) => updateContact(i, 'name', e.target.value)} /></Grid>
                      <Grid item xs={12} md={2}><TextField fullWidth label="Designation" value={contact.designation} onChange={(e) => updateContact(i, 'designation', e.target.value)} /></Grid>
                      <Grid item xs={12} md={2}><TextField fullWidth label="Phone" value={contact.phone} onChange={(e) => updateContact(i, 'phone', e.target.value)} /></Grid>
                      <Grid item xs={12} md={3}><TextField fullWidth label="Email" value={contact.email} onChange={(e) => updateContact(i, 'email', e.target.value)} /></Grid>
                      <Grid item xs={10} md={1}><FormControlLabel control={<Switch checked={contact.is_primary} onChange={(e) => updateContact(i, 'is_primary', e.target.checked)} />} label="Primary" /></Grid>
                      <Grid item xs={2} md={1}><IconButton onClick={() => removeContact(i)} disabled={form.contacts.length === 1}><DeleteIcon /></IconButton></Grid>
                    </Grid>
                  </Paper>
                ))}
                <Button variant="outlined" onClick={addContact}>Add contact</Button>
              </Stack>
            </Section>
          </Stack>
        )}

        {activeStep === 3 && (
          <Stack spacing={2.5}>
            <Section title="Billing & shipping address" helper="State code drives GST place of supply.">
              <Grid container spacing={2}>
                <AddressFields title="Billing" value={form.billing} update={(k, v) => updateAddress('billing', k, v)} setStateName={(v) => setAddressState('billing', v)} />
                <Grid item xs={12}><Button variant="outlined" onClick={copyBillingToShipping}>Copy billing to shipping</Button></Grid>
                <AddressFields title="Shipping" value={form.shipping} update={(k, v) => updateAddress('shipping', k, v)} setStateName={(v) => setAddressState('shipping', v)} />
              </Grid>
            </Section>

            <Section title="Bank details" helper="Optional bank account and UPI.">
              <Stack spacing={1.5}>
                {form.bank_accounts.map((bank: any, i: number) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                    <Grid container spacing={1.5} alignItems="center">
                      <Grid item xs={12} md={3}><TextField fullWidth label="Account holder" value={bank.account_holder_name} onChange={(e) => updateBank(i, 'account_holder_name', e.target.value)} /></Grid>
                      <Grid item xs={12} md={2}><TextField fullWidth label="Bank" value={bank.bank_name} onChange={(e) => updateBank(i, 'bank_name', e.target.value)} /></Grid>
                      <Grid item xs={12} md={2}><TextField fullWidth label="Account no." value={bank.account_number} onChange={(e) => updateBank(i, 'account_number', e.target.value)} /></Grid>
                      <Grid item xs={12} md={2}><TextField fullWidth label="IFSC" value={bank.ifsc} onChange={(e) => updateBank(i, 'ifsc', e.target.value)} /></Grid>
                      <Grid item xs={12} md={2}><TextField fullWidth label="UPI ID" value={bank.upi_id} onChange={(e) => updateBank(i, 'upi_id', e.target.value)} /></Grid>
                      <Grid item xs={12} md={1}><IconButton onClick={() => removeBank(i)} disabled={form.bank_accounts.length === 1}><DeleteIcon /></IconButton></Grid>
                    </Grid>
                  </Paper>
                ))}
                <Button variant="outlined" onClick={addBank}>Add bank</Button>
              </Stack>
            </Section>

            <Section title="Multi-branch mapping" helper="Empty = available in all branches.">
              <TextField
                select fullWidth label="Allowed branches"
                value={form.branch_access_ids}
                onChange={(e) => setForm({ ...form, branch_access_ids: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })}
                SelectProps={{ multiple: true }}
              >
                {branches.map((b: any) => <MenuItem key={b.id} value={b.id}>{b.code} - {b.name}</MenuItem>)}
              </TextField>
            </Section>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => setActiveStep((s) => Math.max(s - 1, 0))} disabled={activeStep === 0 || saving}>
          Back
        </Button>
        {activeStep < STEPS.length - 1 ? (
          <Button variant="contained" onClick={() => setActiveStep((s) => Math.min(s + 1, STEPS.length - 1))}>
            Next
          </Button>
        ) : (
          <Button onClick={save} variant="contained" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Update party' : 'Save party'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function Section({ title, helper, icon, children }: {
  title: string; helper: string; icon?: ReactNode; children: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
        {icon && <Box sx={{ color: 'primary.main', pt: 0.25 }}>{icon}</Box>}
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{helper}</Typography>
        </Box>
      </Stack>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Paper>
  );
}

function AddressFields({ title, value, update, setStateName }: {
  title: string;
  value: any;
  update: (key: string, value: any) => void;
  setStateName: (stateName: string) => void;
}) {
  return (
    <>
      <Grid item xs={12}><Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography></Grid>
      <Grid item xs={12} md={3}><TextField fullWidth label={`${title} label`} value={value.label || ''} onChange={(e) => update('label', e.target.value)} /></Grid>
      <Grid item xs={12} md={5}><TextField fullWidth label="Address line 1" value={value.address_line1 || ''} onChange={(e) => update('address_line1', e.target.value)} /></Grid>
      <Grid item xs={12} md={4}><TextField fullWidth label="Address line 2" value={value.address_line2 || ''} onChange={(e) => update('address_line2', e.target.value)} /></Grid>
      <Grid item xs={12} md={3}><TextField fullWidth label="City" value={value.city || ''} onChange={(e) => update('city', e.target.value)} /></Grid>
      <Grid item xs={12} md={3}>
        <TextField select fullWidth label="State" value={value.state || ''} onChange={(e) => setStateName(e.target.value)}>
          <MenuItem value="">None</MenuItem>
          {GST_STATES.map((s) => <MenuItem key={s.code} value={s.name}>{s.name}</MenuItem>)}
        </TextField>
      </Grid>
      <Grid item xs={12} md={2}><TextField fullWidth label="Code" value={value.state_code || ''} InputProps={{ readOnly: true }} /></Grid>
      <Grid item xs={12} md={2}><TextField fullWidth label="PIN" value={value.pincode || ''} onChange={(e) => update('pincode', e.target.value)} /></Grid>
      <Grid item xs={12} md={2}><TextField fullWidth label="GSTIN" value={value.gstin || ''} onChange={(e) => update('gstin', e.target.value.toUpperCase())} /></Grid>
    </>
  );
}
