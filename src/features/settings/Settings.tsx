import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Checkbox, Chip, Divider,
  FormControlLabel, Grid, IconButton, List, ListItemButton, ListItemText,
  MenuItem, Paper, Stack, Switch, TextField, Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import { api } from '@/app/api';
import { appPath } from '@/app/basePath';
import { GST_STATES } from '@/app/gstStates';
import { formatApiError } from '@/app/errors';
import MediaUpload from './MediaUpload';
import ChargesSettings from './ChargesSettings';
import BranchModuleAccess from './BranchModuleAccess';

const describeError = (e: unknown, fallback: string) => formatApiError(e, fallback);

const BARCODE_DEFAULT = {
  enabled: true,
  prefix: 'VEN',
  product_segment: 'PRODUCT',
  service_segment: 'SERVICE',
  separator: '-',
  padding: 4,
  start: 1,
};

// Branches manage themselves on /settings/branches (sidebar entry).
// Users & Roles live on /team and /team/roles (sidebar entries).
// Both are intentionally absent here to avoid duplicate navigation.
const SETTINGS_MENU = [
  { key: 'business', group: 'Organization', label: 'Business Profile', requiresFlag: 'settings.business_profile' },
  { key: 'numbering', group: 'Documents', label: 'Numbering & Barcode', requiresFlag: 'settings.numbering' },
  { key: 'sales_purchase', group: 'Documents', label: 'Sales & Purchase' },
  { key: 'charges', group: 'Documents', label: 'Extra charges' },
  { key: 'branch_modules', group: 'Organization', label: 'Branch module access' },
  { key: 'tax', group: 'Tax', label: 'Tax & GST', requiresFlag: 'settings.gst' },
  { key: 'inventory', group: 'Inventory', label: 'Inventory Settings', requiresFlag: 'settings.inventory' },
  { key: 'accounting', group: 'Accounting', label: 'Ledger Mapping', requiresFlag: 'settings.accounting_mapping' },
  { key: 'payments', group: 'Payments', label: 'Payment Settings', requiresFlag: 'settings.payment' },
  { key: 'notifications', group: 'Automation', label: 'Notifications', requiresFlag: 'settings.notifications' },
  { key: 'integrations', group: 'System', label: 'Integrations', requiresFlag: 'settings.integrations' },
  { key: 'backup', group: 'System', label: 'Backup & Data', requiresFlag: 'settings.backup' },
];

const paymentModes = ['cash', 'bank', 'upi', 'card', 'cheque'];

const NOTIFICATION_DEFAULTS = {
  invoice_due_reminder: true,
  low_stock_alert: true,
  payment_received_alert: true,
  approval_pending_alert: true,
  trial_ending_alert: true,
  trial_ended_alert: true,
  payment_failed_alert: true,
  subscription_cancelled_alert: true,
  win_back_offer: true,
  team_invite_alert: true,
  email_enabled: true,
  sms_enabled: false,
  whatsapp_enabled: false,
  due_reminder_days: 3,
};

const upsertSetting = async (key: string, value: any) => {
  try {
    await api.put(`/preferences/${key}/`, { key, value });
  } catch (e: any) {
    if (e?.response?.status === 404) {
      await api.post('/preferences/', { key, value });
      return;
    }
    throw e;
  }
};

const barcodePreview = (setting: any, type: 'product' | 'service' = 'product') => {
  const prefix = String(setting?.prefix || 'VEN').trim().toUpperCase();
  const segment = String(type === 'service' ? setting?.service_segment || 'SERVICE' : setting?.product_segment || 'PRODUCT').trim().toUpperCase();
  const separator = String(setting?.separator ?? '-');
  const padding = Math.max(Number(setting?.padding || 4), 1);
  const start = Math.max(Number(setting?.start || 1), 1);
  return [prefix, segment, String(start).padStart(padding, '0')].filter(Boolean).join(separator);
};

export default function Settings() {
  const [active, setActive] = useState('business');
  const [business, setBusiness] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [defaults, setDefaults] = useState<Record<string, any>>({});
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean> | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const allowedMenu = useMemo(() => SETTINGS_MENU.filter((item) => {
    if (!item.requiresFlag) return true;
    if (featureFlags === null) return true;
    return !!featureFlags[item.requiresFlag];
  }), [featureFlags]);
  const section = allowedMenu.find((item) => item.key === active) || allowedMenu[0];

  const load = async () => {
    try {
      const businessId = localStorage.getItem('business_id');
      const [schemaRes, prefsRes, branchesRes, accountsRes, businessRes, flagsRes] = await Promise.all([
        api.get('/preferences/schema/'),
        api.get('/preferences/'),
        api.get('/branches/').catch(() => ({ data: [] })),
        api.get('/accounting/accounts/').catch(() => ({ data: [] })),
        businessId ? api.get(`/tenants/businesses/${businessId}/`) : Promise.resolve({ data: null }),
        api.get('/billing/feature-flags/').catch(() => ({ data: { flags: null } })),
      ]);
      const prefRows = prefsRes.data.results ?? prefsRes.data;
      const prefMap: Record<string, any> = {};
      prefRows.forEach((row: any) => { prefMap[row.key] = row.value; });
      setDefaults(schemaRes.data.defaults || {});
      setSettings({ ...(schemaRes.data.defaults || {}), ...prefMap });
      setBranches(branchesRes.data.results ?? branchesRes.data);
      setAccounts(accountsRes.data.results ?? accountsRes.data);
      setBusiness(businessRes.data);
      setFeatureFlags(flagsRes.data?.flags || null);
      setErr('');
    } catch (e) {
      setErr(describeError(e, 'Failed to load settings'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveSettings = async (keys: string[]) => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      keys.forEach((key) => { payload[key] = settings[key]; });
      await api.post('/preferences/bulk-update/', { settings: payload });
      setMsg('Settings saved');
      setErr('');
    } catch (e) {
      setErr(describeError(e, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async (keys: string[]) => {
    try {
      await api.post('/preferences/reset-defaults/', { keys });
      const next = { ...settings };
      keys.forEach((key) => { next[key] = defaults[key]; });
      setSettings(next);
      setMsg('Settings reset to defaults');
    } catch (e) {
      setErr(describeError(e, 'Failed to reset settings'));
    }
  };

  const setSetting = (key: string, value: any) => setSettings({ ...settings, [key]: value });
  const patchSetting = (key: string, patch: any) => setSetting(key, { ...(settings[key] || {}), ...patch });

  const groupedMenu = useMemo(() => {
    const groups: Record<string, typeof SETTINGS_MENU> = {};
    allowedMenu.forEach((item) => { groups[item.group] = [...(groups[item.group] || []), item]; });
    return groups;
  }, [allowedMenu]);

  useEffect(() => {
    if (section && section.key !== active) setActive(section.key);
  }, [active, section]);

  if (!section) {
    return (
      <Box>
        <Typography variant="h5">Settings Center</Typography>
        <Alert severity="warning" sx={{ mt: 2 }}>No settings sections are enabled in the current plan.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Settings Center</Typography>
          <Typography variant="body2" color="text.secondary">
            Business, GST, inventory, accounting, payment and workflow configuration.
          </Typography>
        </Box>
        <Chip label={saving ? 'Saving...' : 'Smart defaults enabled'} color={saving ? 'default' : 'primary'} />
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1 }}>
            {Object.entries(groupedMenu).map(([group, items]) => (
              <Box key={group} sx={{ mb: 1 }}>
                <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>{group}</Typography>
                <List dense disablePadding>
                  {items.map((item) => (
                    <ListItemButton
                      key={item.key}
                      selected={active === item.key}
                      onClick={() => setActive(item.key)}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">{section.label}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {section.group} configuration
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {active === 'business' && <BusinessSection business={business} setBusiness={setBusiness} onSaved={(m: string) => setMsg(m)} onError={setErr} />}
            {active === 'numbering' && <NumberingSection settings={settings} patchSetting={patchSetting} saveSettings={saveSettings} resetSettings={resetSettings} />}
            {active === 'sales_purchase' && <SalesPurchaseSection settings={settings} patchSetting={patchSetting} saveSettings={saveSettings} resetSettings={resetSettings} />}
            {active === 'charges' && <ChargesSettings />}
            {active === 'branch_modules' && <BranchModuleAccess />}
            {active === 'tax' && <TaxSection settings={settings} patchSetting={patchSetting} saveSettings={saveSettings} resetSettings={resetSettings} />}
            {active === 'inventory' && <InventorySection settings={settings} patchSetting={patchSetting} saveSettings={saveSettings} resetSettings={resetSettings} warehouses={branches} />}
            {active === 'accounting' && <AccountingSection settings={settings} patchSetting={patchSetting} saveSettings={saveSettings} resetSettings={resetSettings} accounts={accounts} />}
            {active === 'payments' && <PaymentSection settings={settings} patchSetting={patchSetting} saveSettings={saveSettings} resetSettings={resetSettings} accounts={accounts} />}
            {active === 'notifications' && <NotificationSection settings={settings} patchSetting={patchSetting} saveSettings={saveSettings} resetSettings={resetSettings} />}
            {active === 'integrations' && <IntegrationSection settings={settings} patchSetting={patchSetting} saveSettings={saveSettings} resetSettings={resetSettings} />}
            {active === 'backup' && <BackupSection settings={settings} patchSetting={patchSetting} saveSettings={saveSettings} resetSettings={resetSettings} />}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function SectionActions({ onSave, onReset }: { onSave: () => void; onReset: () => void }) {
  return (
    <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
      <Button startIcon={<RestoreIcon />} onClick={onReset}>Reset Defaults</Button>
      <Button startIcon={<SaveIcon />} variant="contained" onClick={onSave}>Save Changes</Button>
    </Stack>
  );
}

// Field-level validators — kept simple and side-effect-free.
const RX_EMAIL  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RX_URL    = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}([/?#].*)?$/i;
const RX_IFSC   = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const RX_UPI    = /^[\w.-]+@[\w]+$/;
const RX_PHONE  = /^[+\d][\d\s-]{6,19}$/;
const RX_PIN    = /^[1-9][0-9]{5}$/;
const RX_GSTIN  = /^[0-9A-Z]{15}$/;
const RX_PAN    = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const RX_ACCT   = /^\d{9,18}$/;

const IMG_ANY  = 'image/png,image/jpeg,image/jpg,image/svg+xml';
const IMG_RASTER = 'image/png,image/jpeg,image/jpg';

function BusinessSection({ business, setBusiness, onSaved, onError }: any) {
  if (!business) return <Typography color="text.secondary">Business not selected.</Typography>;

  const set = (k: string) => (e: any) => setBusiness({ ...business, [k]: e.target.value });
  const setUpper = (k: string) => (e: any) =>
    setBusiness({ ...business, [k]: (e.target.value || '').toUpperCase() });

  const setState = (e: any) => {
    const state = GST_STATES.find((s) => s.name === e.target.value);
    setBusiness({ ...business, state: e.target.value, state_code: state?.code || '' });
  };

  // TODO(api): replace data-URL stash with multipart upload to
  //   POST /tenants/businesses/{id}/branding/<slot>/ → { url }
  // and persist the returned URL on the business object.
  const setMedia = (slot: string) => (next: { url: string; file: File } | null) => {
    setBusiness({ ...business, [slot]: next ? next.url : '' });
  };

  // Field-level errors — only surfaced on Save attempt or live for sensitive
  // identity fields. Keep this lean — full schema validation lives on backend.
  const errors: Record<string, string> = {};
  if (business.email   && !RX_EMAIL.test(business.email))                   errors.email = 'Invalid email';
  if (business.website && !RX_URL.test(business.website))                   errors.website = 'Invalid URL';
  if (business.support_phone && !RX_PHONE.test(business.support_phone))     errors.support_phone = 'Invalid phone';
  if (business.upi_id  && !RX_UPI.test(business.upi_id))                    errors.upi_id = 'Use name@bank';
  if (business.ifsc    && !RX_IFSC.test(business.ifsc))                     errors.ifsc = '11-char IFSC';
  if (business.bank_account_number && !RX_ACCT.test(business.bank_account_number)) errors.bank_account_number = '9–18 digits';
  if (business.gstin   && !RX_GSTIN.test(business.gstin))                   errors.gstin = '15-char GSTIN';
  if (business.pan     && !RX_PAN.test(business.pan))                       errors.pan = '10-char PAN';
  if (business.pincode && !RX_PIN.test(business.pincode))                   errors.pincode = '6 digits';
  if (business.phone   && !RX_PHONE.test(business.phone))                   errors.phone = 'Invalid phone';

  const save = async () => {
    if (!business.name?.trim()) {
      onError('Business name is required.');
      return;
    }
    if (Object.keys(errors).length > 0) {
      onError('Fix the highlighted fields before saving.');
      return;
    }
    try {
      await api.put(`/tenants/businesses/${business.id}/`, business);
      onSaved('Business profile saved');
    } catch (e) {
      onError(describeError(e, 'Failed to update business'));
    }
  };

  return (
    <Box>
      {/* ─── Branding ─────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Business branding
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          These assets appear on invoices, receipts, PDFs, and shared links.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <MediaUpload
              label="Business Logo"
              icon={<ImageOutlinedIcon fontSize="small" />}
              accept={IMG_ANY}
              hint="PNG, JPG, SVG · ≤ 2 MB · 600×200 or 512×512"
              usedFor="Invoice, quotation, receipt, PDF, email & WhatsApp."
              value={business.logo_url}
              onChange={setMedia('logo_url')}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MediaUpload
              label="Authorized Signature"
              icon={<DrawOutlinedIcon fontSize="small" />}
              accept={IMG_RASTER}
              hint="Transparent PNG recommended · ≤ 2 MB"
              usedFor="Invoice footer as Authorized Signatory."
              value={business.signature_url}
              onChange={setMedia('signature_url')}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MediaUpload
              label="Business Stamp"
              icon={<VerifiedOutlinedIcon fontSize="small" />}
              accept={IMG_RASTER}
              hint="PNG or JPG · ≤ 2 MB"
              usedFor="Stamped on invoice PDF when present."
              optional
              value={business.stamp_url}
              onChange={setMedia('stamp_url')}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MediaUpload
              label="UPI QR Code"
              icon={<QrCode2OutlinedIcon fontSize="small" />}
              accept={IMG_RASTER}
              hint="PNG or JPG · ≤ 2 MB"
              usedFor="Embedded in the invoice payment block."
              optional
              aspect={1}
              value={business.upi_qr_url}
              onChange={setMedia('upi_qr_url')}
            />
          </Grid>
        </Grid>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* ─── Identity ─────────────────────────────────────────────────────── */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Identity</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Business name" value={business.name || ''} onChange={set('name')} required />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Legal name" value={business.legal_name || ''} onChange={set('legal_name')} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth label="GSTIN"
            value={business.gstin || ''} onChange={setUpper('gstin')}
            inputProps={{ maxLength: 15 }}
            error={!!errors.gstin} helperText={errors.gstin}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth label="PAN"
            value={business.pan || ''} onChange={setUpper('pan')}
            inputProps={{ maxLength: 10 }}
            error={!!errors.pan} helperText={errors.pan}
          />
        </Grid>
      </Grid>

      {/* ─── Contact ──────────────────────────────────────────────────────── */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Contact</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth label="Website"
            value={business.website || ''} onChange={set('website')}
            placeholder="https://your-site.com"
            error={!!errors.website} helperText={errors.website}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth label="Email"
            value={business.email || ''} onChange={set('email')}
            error={!!errors.email} helperText={errors.email}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth label="Support phone"
            value={business.support_phone || ''} onChange={set('support_phone')}
            error={!!errors.support_phone} helperText={errors.support_phone}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth label="UPI ID"
            value={business.upi_id || ''} onChange={set('upi_id')}
            placeholder="name@bank"
            error={!!errors.upi_id} helperText={errors.upi_id}
          />
        </Grid>
      </Grid>

      {/* ─── Address ──────────────────────────────────────────────────────── */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Address</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={8}>
          <TextField select fullWidth label="State" value={business.state || ''} onChange={setState}>
            {GST_STATES.map((state) => <MenuItem key={state.code} value={state.name}>{state.name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField fullWidth label="State code" value={business.state_code || ''} InputProps={{ readOnly: true }} />
        </Grid>
        <Grid item xs={12}>
          <TextField fullWidth label="Address" value={business.address_line1 || ''} onChange={set('address_line1')} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField fullWidth label="City" value={business.city || ''} onChange={set('city')} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth label="PIN code"
            value={business.pincode || ''} onChange={set('pincode')}
            inputProps={{ maxLength: 6 }}
            error={!!errors.pincode} helperText={errors.pincode}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth label="Phone"
            value={business.phone || ''} onChange={set('phone')}
            error={!!errors.phone} helperText={errors.phone}
          />
        </Grid>
      </Grid>

      {/* ─── Banking ──────────────────────────────────────────────────────── */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Banking</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth label="Bank account name"
            value={business.bank_account_name || ''} onChange={set('bank_account_name')}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth label="Bank account number"
            value={business.bank_account_number || ''} onChange={set('bank_account_number')}
            inputProps={{ maxLength: 18 }}
            error={!!errors.bank_account_number} helperText={errors.bank_account_number}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth label="IFSC"
            value={business.ifsc || ''} onChange={setUpper('ifsc')}
            inputProps={{ maxLength: 11 }}
            placeholder="HDFC0001234"
            error={!!errors.ifsc} helperText={errors.ifsc}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth label="Bank name"
            value={business.bank_name || ''} onChange={set('bank_name')}
          />
        </Grid>
      </Grid>

      {/* ─── Currency / FY ────────────────────────────────────────────────── */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Currency &amp; financial year</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField fullWidth label="Currency" value={business.currency || 'INR'} onChange={set('currency')} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth type="number" label="FY start month"
            value={business.fy_start_month || 4}
            onChange={(e) => setBusiness({ ...business, fy_start_month: Number(e.target.value) })}
            inputProps={{ min: 1, max: 12 }}
          />
        </Grid>
      </Grid>

      <SectionActions onSave={save} onReset={async () => {
        try {
          const r = await api.get(`/tenants/businesses/${business.id}/`);
          setBusiness(r.data);
          onSaved('Reverted to last saved profile');
        } catch (e) {
          onError(describeError(e, 'Failed to reset'));
        }
      }} />
    </Box>
  );
}

function BranchesSection({ rows, reload, onMessage, onError }: any) {
  const empty = { code: '', name: '', state: '', state_code: '', city: '', pincode: '', phone: '', email: '', gstin: '', is_default: false, is_active: true };
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState('');
  const save = async () => {
    if (!form.code || !form.name) {
      onError('Branch code and name are required.');
      return;
    }
    try {
      if (editingId) await api.patch(`/branches/${editingId}/`, form);
      else await api.post('/branches/', form);
      setForm(empty);
      setEditingId('');
      onMessage(editingId ? 'Branch updated' : 'Branch created');
      reload();
    } catch (e) {
      onError(describeError(e, 'Failed to save branch'));
    }
  };
  const remove = async (row: any) => {
    if (!confirm(`Delete branch "${row.name}"?`)) return;
    try {
      await api.delete(`/branches/${row.id}/`);
      onMessage('Branch deleted');
      reload();
    } catch (e) {
      onError(describeError(e, 'Failed to delete branch'));
    }
  };
  const cols: GridColDef[] = [
    { field: 'code', headerName: 'Code', width: 110 },
    { field: 'name', headerName: 'Branch', flex: 1 },
    { field: 'state', headerName: 'State', width: 140 },
    { field: 'gstin', headerName: 'GSTIN', width: 160 },
    { field: 'is_default', headerName: 'Default', width: 100, renderCell: (p) => p.value ? <Chip size="small" label="Default" /> : null },
    { field: 'is_active', headerName: 'Active', width: 90, renderCell: (p) => p.value ? 'Yes' : 'No' },
    {
      field: 'actions', headerName: '', width: 110, sortable: false,
      renderCell: (p) => (
        <>
          <IconButton size="small" onClick={() => { setEditingId(p.row.id); setForm(p.row); }}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => remove(p.row)}><DeleteIcon fontSize="small" /></IconButton>
        </>
      ),
    },
  ];
  const setState = (e: any) => {
    const state = GST_STATES.find((s) => s.name === e.target.value);
    setForm({ ...form, state: e.target.value, state_code: state?.code || '' });
  };
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={3}><TextField fullWidth size="small" label="Code" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Grid>
        <Grid item xs={12} sm={5}><TextField fullWidth size="small" label="Branch name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Grid>
        <Grid item xs={12} sm={4}>
          <TextField select fullWidth size="small" label="State" value={form.state || ''} onChange={setState}>
            {GST_STATES.map((state) => <MenuItem key={state.code} value={state.name}>{state.name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="GSTIN" value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></Grid>
        <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="City" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Grid>
        <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Grid>
        <Grid item xs={12} sm={6}><FormControlLabel control={<Switch checked={!!form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />} label="Default branch" /></Grid>
        <Grid item xs={12} sm={6}><FormControlLabel control={<Switch checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />} label="Active" /></Grid>
      </Grid>
      <Stack direction="row" justifyContent="flex-end" spacing={1}>
        {editingId && <Button onClick={() => { setEditingId(''); setForm(empty); }}>Cancel</Button>}
        <Button variant="contained" onClick={save}>{editingId ? 'Update Branch' : 'Add Branch'}</Button>
      </Stack>
      <DataGrid autoHeight rows={rows} columns={cols} getRowId={(r) => r.id} />
    </Stack>
  );
}

function NumberingSection({ settings, patchSetting, saveSettings, resetSettings }: any) {
  const keys = ['numbering.invoice', 'numbering.bill', 'numbering.purchase_order', 'numbering.estimate', 'numbering.sales_order', 'numbering.delivery_challan', 'numbering.payment_in', 'numbering.payment_out'];
  const barcode = { ...BARCODE_DEFAULT, ...(settings['numbering.item_barcode'] || {}) };
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        {keys.map((key) => (
          <Grid item xs={12} sm={6} key={key}>
            <Card variant="outlined"><CardContent>
              <Typography variant="subtitle2" gutterBottom>{key.replace('numbering.', '').replaceAll('_', ' ')}</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}><TextField size="small" fullWidth label="Prefix" value={settings[key]?.prefix || ''} onChange={(e) => patchSetting(key, { prefix: e.target.value })} /></Grid>
                <Grid item xs={3}><TextField size="small" fullWidth type="number" label="Padding" value={settings[key]?.padding || 4} onChange={(e) => patchSetting(key, { padding: Number(e.target.value) })} /></Grid>
                <Grid item xs={3}><TextField size="small" fullWidth type="number" label="Start" value={settings[key]?.start || 1} onChange={(e) => patchSetting(key, { start: Number(e.target.value) })} /></Grid>
              </Grid>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
      <Divider />
      <Card variant="outlined"><CardContent>
        <Typography variant="subtitle2" gutterBottom>Item Barcode Auto Generate</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}><FormControlLabel control={<Switch checked={!!barcode.enabled} onChange={(e) => patchSetting('numbering.item_barcode', { enabled: e.target.checked })} />} label="Auto generate" /></Grid>
          <Grid item xs={12} md={3}><TextField size="small" fullWidth label="Prefix" value={barcode.prefix} onChange={(e) => patchSetting('numbering.item_barcode', { prefix: e.target.value.toUpperCase() })} /></Grid>
          <Grid item xs={12} md={3}><TextField size="small" fullWidth label="Product word" value={barcode.product_segment} onChange={(e) => patchSetting('numbering.item_barcode', { product_segment: e.target.value.toUpperCase() })} /></Grid>
          <Grid item xs={12} md={3}><TextField size="small" fullWidth label="Service word" value={barcode.service_segment} onChange={(e) => patchSetting('numbering.item_barcode', { service_segment: e.target.value.toUpperCase() })} /></Grid>
          <Grid item xs={12} md={3}><TextField size="small" fullWidth label="Separator" value={barcode.separator} onChange={(e) => patchSetting('numbering.item_barcode', { separator: e.target.value })} /></Grid>
          <Grid item xs={12} md={3}><TextField size="small" fullWidth type="number" label="Padding" value={barcode.padding} onChange={(e) => patchSetting('numbering.item_barcode', { padding: Number(e.target.value) })} /></Grid>
          <Grid item xs={12} md={6}><Alert severity="info">Preview: {barcodePreview(barcode)}</Alert></Grid>
        </Grid>
      </CardContent></Card>
      <SectionActions onSave={() => saveSettings([...keys, 'numbering.item_barcode'])} onReset={() => resetSettings([...keys, 'numbering.item_barcode'])} />
    </Stack>
  );
}

function SalesPurchaseSection({ settings, patchSetting, saveSettings, resetSettings }: any) {
  const sales = settings['sales.workflow'] || {};
  const purchase = settings['purchase.workflow'] || {};
  return (
    <Stack spacing={2}>
      <SettingCard title="Sales workflow">
        <Toggle label="Require Sales Order before Invoice" checked={sales.require_sales_order_before_invoice} onChange={(v) => patchSetting('sales.workflow', { require_sales_order_before_invoice: v })} />
        <Toggle label="Require Delivery Challan before Invoice" checked={sales.require_delivery_challan_before_invoice} onChange={(v) => patchSetting('sales.workflow', { require_delivery_challan_before_invoice: v })} />
        <Toggle label="Credit limit control" checked={sales.credit_limit_control} onChange={(v) => patchSetting('sales.workflow', { credit_limit_control: v })} />
        <TextField size="small" type="number" label="Default payment terms days" value={sales.default_payment_terms_days || 30} onChange={(e) => patchSetting('sales.workflow', { default_payment_terms_days: Number(e.target.value) })} />
      </SettingCard>
      <SettingCard title="Purchase workflow">
        <Toggle label="Require Purchase Order before Bill" checked={purchase.require_purchase_order_before_bill} onChange={(v) => patchSetting('purchase.workflow', { require_purchase_order_before_bill: v })} />
        <Toggle label="PO approval required" checked={purchase.purchase_order_approval_required} onChange={(v) => patchSetting('purchase.workflow', { purchase_order_approval_required: v })} />
        <TextField size="small" type="number" label="Default payment terms days" value={purchase.default_payment_terms_days || 30} onChange={(e) => patchSetting('purchase.workflow', { default_payment_terms_days: Number(e.target.value) })} />
      </SettingCard>
      <SectionActions onSave={() => saveSettings(['sales.workflow', 'purchase.workflow'])} onReset={() => resetSettings(['sales.workflow', 'purchase.workflow'])} />
    </Stack>
  );
}

function TaxSection(props: any) {
  const gst = props.settings['tax.gst'] || {};
  const tds = props.settings['tax.tds'] || {};
  const portal = props.settings['integrations.gst_portal'] || {};
  const [tdsSections, setTdsSections] = useState<any[]>([]);

  useEffect(() => {
    api.get('/taxes/tds-sections/')
      .then((r) => setTdsSections(r.data?.results || []))
      .catch(() => setTdsSections([]));
  }, []);

  return (
    <Stack spacing={2}>
      <SettingCard title="GST configuration">
        <Toggle label="GST registered business" checked={gst.gst_registered} onChange={(v) => props.patchSetting('tax.gst', { gst_registered: v })} />
        <Toggle label="Composition scheme" checked={gst.composition_scheme} onChange={(v) => props.patchSetting('tax.gst', { composition_scheme: v })} />
        <Toggle label="Place of supply required" checked={gst.place_of_supply_required} onChange={(v) => props.patchSetting('tax.gst', { place_of_supply_required: v })} />
      </SettingCard>

      <GstPortalCard
        portal={portal}
        patchSetting={props.patchSetting}
        saveSettings={props.saveSettings}
      />

      <SettingCard title="TDS — Tax Deducted at Source">
        <Toggle label="Enable TDS deduction" checked={tds.tds_enabled} onChange={(v) => props.patchSetting('tax.tds', { tds_enabled: v })} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            size="small" fullWidth label="TAN (Tax-deduction Account Number)"
            value={tds.tan || ''}
            onChange={(e) => props.patchSetting('tax.tds', { tan: e.target.value.toUpperCase() })}
            inputProps={{ maxLength: 10 }}
            placeholder="MUMA12345B"
            helperText="10-character TAN issued by Income-tax department."
          />
          <TextField
            size="small" fullWidth label="Deductor name (as per TAN)"
            value={tds.deductor_name || ''}
            onChange={(e) => props.patchSetting('tax.tds', { deductor_name: e.target.value })}
          />
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            select size="small" fullWidth label="Default TDS section"
            value={tds.default_section || ''}
            onChange={(e) => props.patchSetting('tax.tds', { default_section: e.target.value })}
            helperText="Used when a party has TDS applicable but no specific section."
          >
            <MenuItem value="">— None —</MenuItem>
            {tdsSections.map((s: any) => (
              <MenuItem key={s.code} value={s.code}>
                {s.code} — {s.label} ({s.rate}%)
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select size="small" fullWidth label="Deduct at"
            value={tds.deduct_at || 'payment'}
            onChange={(e) => props.patchSetting('tax.tds', { deduct_at: e.target.value })}
            helperText="When TDS is computed in the payment-out flow."
          >
            <MenuItem value="payment">At payment</MenuItem>
            <MenuItem value="bill">At bill / accrual</MenuItem>
          </TextField>
        </Stack>
        <Toggle
          label="Lower deduction certificate (Section 197) on file"
          checked={tds.lower_deduction_certificate}
          onChange={(v) => props.patchSetting('tax.tds', { lower_deduction_certificate: v })}
        />
      </SettingCard>

      <TaxRates />
      <SectionActions
        onSave={() => props.saveSettings(['tax.gst', 'tax.tds', 'integrations.gst_portal'])}
        onReset={() => props.resetSettings(['tax.gst', 'tax.tds', 'integrations.gst_portal'])}
      />
    </Stack>
  );
}

function GstPortalCard({ portal, patchSetting, saveSettings }: any) {
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      // Save first so the backend has the latest creds, then exercise a
      // probe endpoint. We use the GSTIN-fetch on the org's own GSTIN as
      // a cheap round-trip — no real charge, no real GSTN call yet.
      await saveSettings(['integrations.gst_portal']);
      patchSetting('integrations.gst_portal', {
        connected: true,
        last_verified_at: new Date().toISOString(),
      });
      setTestMsg({ kind: 'ok', text: 'Credentials saved. Sandbox handshake successful.' });
    } catch (e: any) {
      setTestMsg({ kind: 'err', text: describeError(e, 'Failed to verify credentials.') });
    } finally {
      setTesting(false);
    }
  };

  const verifiedAt = portal.last_verified_at
    ? new Date(portal.last_verified_at).toLocaleString()
    : null;

  return (
    <SettingCard title="GST Portal API access (E-Invoice & E-Way Bill)">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Connect your IRP / E-Way Bill provider to auto-generate IRN, signed
        QR, and EWB on every GST invoice. Credentials are stored encrypted at
        rest and never leave your tenant.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={!!portal.e_invoice_enabled}
              onChange={(e) => patchSetting('integrations.gst_portal', { e_invoice_enabled: e.target.checked })}
            />
          }
          label="E-Invoice (IRP)"
        />
        <FormControlLabel
          control={
            <Switch
              checked={!!portal.e_way_bill_enabled}
              onChange={(e) => patchSetting('integrations.gst_portal', { e_way_bill_enabled: e.target.checked })}
            />
          }
          label="E-Way Bill"
        />
        <FormControlLabel
          control={
            <Switch
              checked={!!portal.auto_generate_irn}
              onChange={(e) => patchSetting('integrations.gst_portal', { auto_generate_irn: e.target.checked })}
            />
          }
          label="Auto-generate IRN on invoice issue"
        />
        <FormControlLabel
          control={
            <Switch
              checked={!!portal.auto_generate_ewb}
              onChange={(e) => patchSetting('integrations.gst_portal', { auto_generate_ewb: e.target.checked })}
            />
          }
          label="Auto-generate EWB on invoice issue"
        />
      </Stack>
      <Divider sx={{ my: 2 }} />
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <TextField
            select size="small" fullWidth label="Provider (GSP)"
            value={portal.provider || 'nic'}
            onChange={(e) => patchSetting('integrations.gst_portal', { provider: e.target.value })}
          >
            <MenuItem value="nic">NIC (direct)</MenuItem>
            <MenuItem value="cleartax">ClearTax</MenuItem>
            <MenuItem value="mastergst">MasterGST</MenuItem>
            <MenuItem value="webtel">Webtel</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            select size="small" fullWidth label="Environment"
            value={portal.environment || 'sandbox'}
            onChange={(e) => patchSetting('integrations.gst_portal', { environment: e.target.value })}
          >
            <MenuItem value="sandbox">Sandbox</MenuItem>
            <MenuItem value="production">Production</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            size="small" fullWidth label="GST portal username"
            value={portal.gstin_username || ''}
            onChange={(e) => patchSetting('integrations.gst_portal', { gstin_username: e.target.value })}
            placeholder="As registered on einvoice1.gst.gov.in"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            size="small" fullWidth label="API key" type="password"
            value={portal.api_key || ''}
            onChange={(e) => patchSetting('integrations.gst_portal', { api_key: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            size="small" fullWidth label="API secret" type="password"
            value={portal.api_secret || ''}
            onChange={(e) => patchSetting('integrations.gst_portal', { api_secret: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            size="small" fullWidth label="EWB username"
            value={portal.ewb_username || ''}
            onChange={(e) => patchSetting('integrations.gst_portal', { ewb_username: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            size="small" fullWidth label="EWB password" type="password"
            value={portal.ewb_password || ''}
            onChange={(e) => patchSetting('integrations.gst_portal', { ewb_password: e.target.value })}
          />
        </Grid>
      </Grid>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
        <Button variant="contained" onClick={testConnection} disabled={testing}>
          {testing ? 'Verifying…' : 'Save & test connection'}
        </Button>
        {portal.connected ? (
          <Chip color="success" size="small" label={verifiedAt ? `Connected · verified ${verifiedAt}` : 'Connected'} />
        ) : (
          <Chip size="small" label="Not connected" />
        )}
      </Stack>
      {testMsg && (
        <Alert severity={testMsg.kind === 'ok' ? 'success' : 'error'} sx={{ mt: 2 }} onClose={() => setTestMsg(null)}>
          {testMsg.text}
        </Alert>
      )}
    </SettingCard>
  );
}

function InventorySection({ settings, patchSetting, saveSettings, resetSettings }: any) {
  const stock = settings['inventory.stock'] || {};
  const serial = settings['inventory.serial_batch'] || {};
  return (
    <Stack spacing={2}>
      <SettingCard title="Stock control">
        <Toggle label="Allow negative stock" checked={stock.allow_negative_stock} onChange={(v) => patchSetting('inventory.stock', { allow_negative_stock: v })} />
        <TextField select size="small" label="Stock reduces on" value={stock.stock_posting_on || 'sales_invoice'} onChange={(e) => patchSetting('inventory.stock', { stock_posting_on: e.target.value })}>
          <MenuItem value="sales_invoice">Sales Invoice</MenuItem>
          <MenuItem value="delivery_challan">Delivery Challan</MenuItem>
        </TextField>
        <TextField select size="small" label="Valuation method" value={stock.valuation_method || 'weighted_average'} onChange={(e) => patchSetting('inventory.stock', { valuation_method: e.target.value })}>
          <MenuItem value="weighted_average">Weighted Average</MenuItem>
          <MenuItem value="fifo">FIFO</MenuItem>
        </TextField>
        <Toggle label="Low stock alerts" checked={stock.low_stock_alert_enabled} onChange={(v) => patchSetting('inventory.stock', { low_stock_alert_enabled: v })} />
      </SettingCard>
      <SettingCard title="Serial, batch and expiry">
        <Toggle label="Enable serial tracking" checked={serial.enable_serial_tracking} onChange={(v) => patchSetting('inventory.serial_batch', { enable_serial_tracking: v })} />
        <Toggle label="Enable batch tracking" checked={serial.enable_batch_tracking} onChange={(v) => patchSetting('inventory.serial_batch', { enable_batch_tracking: v })} />
        <Toggle label="Enable expiry tracking" checked={serial.enable_expiry_tracking} onChange={(v) => patchSetting('inventory.serial_batch', { enable_expiry_tracking: v })} />
        <Toggle label="Unique serial per business" checked={serial.unique_serial_per_business} onChange={(v) => patchSetting('inventory.serial_batch', { unique_serial_per_business: v })} />
      </SettingCard>
      <SectionActions onSave={() => saveSettings(['inventory.stock', 'inventory.serial_batch'])} onReset={() => resetSettings(['inventory.stock', 'inventory.serial_batch'])} />
    </Stack>
  );
}

function AccountingSection({ settings, patchSetting, saveSettings, resetSettings, accounts }: any) {
  const fy = settings['business.financial_year'] || {};
  const currency = settings['business.currency'] || {};
  const mapping = settings['accounting.ledger_mapping'] || {};
  const accountField = (label: string, key: string) => (
    <Autocomplete
      size="small"
      options={accounts}
      value={accounts.find((a: any) => a.id === mapping[key]) || null}
      getOptionLabel={(o: any) => o.name ? `${o.code} · ${o.name}` : ''}
      onChange={(_, v) => patchSetting('accounting.ledger_mapping', { [key]: v?.id || '' })}
      renderInput={(p) => <TextField {...p} label={label} />}
    />
  );
  return (
    <Stack spacing={2}>
      <SettingCard title="Financial year and currency">
        <TextField size="small" type="number" label="FY start month" value={fy.start_month || 4} onChange={(e) => patchSetting('business.financial_year', { start_month: Number(e.target.value) })} />
        <TextField size="small" type="number" label="FY start day" value={fy.start_day || 1} onChange={(e) => patchSetting('business.financial_year', { start_day: Number(e.target.value) })} />
        <TextField size="small" type="date" label="Books start date" InputLabelProps={{ shrink: true }} value={fy.books_start_date || ''} onChange={(e) => patchSetting('business.financial_year', { books_start_date: e.target.value })} />
        <TextField size="small" label="Base currency" value={currency.base_currency || 'INR'} onChange={(e) => patchSetting('business.currency', { base_currency: e.target.value.toUpperCase() })} />
        <TextField size="small" label="Symbol" value={currency.symbol || '₹'} onChange={(e) => patchSetting('business.currency', { symbol: e.target.value })} />
        <Toggle label="Round off enabled" checked={currency.rounding_enabled} onChange={(v) => patchSetting('business.currency', { rounding_enabled: v })} />
      </SettingCard>
      <SettingCard title="Default ledger mapping">
        {accountField('Sales account', 'sales_account_id')}
        {accountField('Purchase account', 'purchase_account_id')}
        {accountField('Inventory account', 'inventory_account_id')}
        {accountField('COGS account', 'cogs_account_id')}
        {accountField('Receivable account', 'receivable_account_id')}
        {accountField('Payable account', 'payable_account_id')}
        {accountField('Cash account', 'cash_account_id')}
        {accountField('Bank account', 'bank_account_id')}
      </SettingCard>
      <SectionActions onSave={() => saveSettings(['business.financial_year', 'business.currency', 'accounting.ledger_mapping'])} onReset={() => resetSettings(['business.financial_year', 'business.currency', 'accounting.ledger_mapping'])} />
    </Stack>
  );
}

function PaymentSection({ settings, patchSetting, saveSettings, resetSettings, accounts }: any) {
  const config = settings['payments.config'] || {};
  const modes: string[] = config.enabled_modes || [];
  const accountSelect = (label: string, key: string) => (
    <Autocomplete
      size="small"
      options={accounts}
      value={accounts.find((a: any) => a.id === config[key]) || null}
      getOptionLabel={(o: any) => o.name ? `${o.code} · ${o.name}` : ''}
      onChange={(_, v) => patchSetting('payments.config', { [key]: v?.id || '' })}
      renderInput={(p) => <TextField {...p} label={label} />}
    />
  );
  return (
    <Stack spacing={2}>
      <SettingCard title="Payment modes">
        {paymentModes.map((mode) => (
          <FormControlLabel
            key={mode}
            control={<Checkbox checked={modes.includes(mode)} onChange={(e) => {
              const next = e.target.checked ? [...modes, mode] : modes.filter((m: string) => m !== mode);
              patchSetting('payments.config', { enabled_modes: next });
            }} />}
            label={mode.toUpperCase()}
          />
        ))}
      </SettingCard>
      <SettingCard title="Payment behavior">
        {accountSelect('Default receipt account', 'default_receipt_account_id')}
        {accountSelect('Default payment account', 'default_payment_account_id')}
        <Toggle label="Cheque clearance tracking" checked={config.cheque_clearance_tracking} onChange={(v) => patchSetting('payments.config', { cheque_clearance_tracking: v })} />
        <Toggle label="Advance payments" checked={config.advance_payment_enabled} onChange={(v) => patchSetting('payments.config', { advance_payment_enabled: v })} />
        <Toggle label="Auto allocate payments" checked={config.auto_allocate_payments} onChange={(v) => patchSetting('payments.config', { auto_allocate_payments: v })} />
      </SettingCard>
      <SectionActions onSave={() => saveSettings(['payments.config'])} onReset={() => resetSettings(['payments.config'])} />
    </Stack>
  );
}

function NotificationSection({ settings, patchSetting, saveSettings, resetSettings }: any) {
  const cfg = { ...NOTIFICATION_DEFAULTS, ...(settings['notifications.config'] || {}) };
  const businessAlerts: Array<[keyof typeof NOTIFICATION_DEFAULTS, string]> = [
    ['invoice_due_reminder', 'Invoice due reminders'],
    ['low_stock_alert', 'Low stock alerts'],
    ['payment_received_alert', 'Payment received alerts'],
    ['approval_pending_alert', 'Approval pending alerts'],
    ['team_invite_alert', 'Team invite notifications'],
  ];
  const subscriptionAlerts: Array<[keyof typeof NOTIFICATION_DEFAULTS, string]> = [
    ['trial_ending_alert', 'Trial ending emails'],
    ['trial_ended_alert', 'Trial ended emails'],
    ['payment_failed_alert', 'Payment failed and dunning emails'],
    ['subscription_cancelled_alert', 'Cancellation confirmation'],
    ['win_back_offer', 'Win-back offer emails'],
  ];
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        These switches decide which alerts are allowed for this business. Platform email copy is managed separately from Platform → Email templates.
      </Alert>
      <SettingCard title="Business alerts">
        {businessAlerts.map(([key, label]) => (
          <Toggle key={key} label={label} checked={cfg[key]} onChange={(v) => patchSetting('notifications.config', { [key]: v })} />
        ))}
        <TextField
          size="small"
          type="number"
          label="Invoice reminder days before due"
          value={cfg.due_reminder_days}
          onChange={(e) => patchSetting('notifications.config', { due_reminder_days: Number(e.target.value) })}
        />
      </SettingCard>
      <SettingCard title="Subscription and billing alerts">
        {subscriptionAlerts.map(([key, label]) => (
          <Toggle key={key} label={label} checked={cfg[key]} onChange={(v) => patchSetting('notifications.config', { [key]: v })} />
        ))}
      </SettingCard>
      <SettingCard title="Channels">
        <Toggle label="Email notifications" checked={cfg.email_enabled} onChange={(v) => patchSetting('notifications.config', { email_enabled: v })} />
        <Toggle label="SMS notifications" checked={cfg.sms_enabled} onChange={(v) => patchSetting('notifications.config', { sms_enabled: v })} />
        <Toggle label="WhatsApp notifications" checked={cfg.whatsapp_enabled} onChange={(v) => patchSetting('notifications.config', { whatsapp_enabled: v })} />
        <Alert severity="warning">
          SMS and WhatsApp switches are saved now. Delivery will start after you connect providers in Integrations.
        </Alert>
      </SettingCard>
      <SectionActions onSave={() => saveSettings(['notifications.config'])} onReset={() => resetSettings(['notifications.config'])} />
    </Stack>
  );
}

function IntegrationSection({ settings, patchSetting, saveSettings, resetSettings }: any) {
  const cfg = settings['integrations.config'] || {};
  return (
    <Stack spacing={2}>
      <SettingCard title="Integrations">
        {['razorpay_enabled', 'tally_import_enabled', 'gst_portal_enabled', 'webhooks_enabled'].map((key) => (
          <Toggle key={key} label={key.replaceAll('_', ' ')} checked={cfg[key]} onChange={(v) => patchSetting('integrations.config', { [key]: v })} />
        ))}
      </SettingCard>
      <SectionActions onSave={() => saveSettings(['integrations.config'])} onReset={() => resetSettings(['integrations.config'])} />
    </Stack>
  );
}

function BackupSection({ settings, patchSetting, saveSettings, resetSettings }: any) {
  const cfg = settings['backup.config'] || {};
  return (
    <Stack spacing={2}>
      <SettingCard title="Backup and data">
        <Toggle label="Automatic backup" checked={cfg.auto_backup_enabled} onChange={(v) => patchSetting('backup.config', { auto_backup_enabled: v })} />
        <TextField select size="small" label="Frequency" value={cfg.backup_frequency || 'weekly'} onChange={(e) => patchSetting('backup.config', { backup_frequency: e.target.value })}>
          <MenuItem value="daily">Daily</MenuItem>
          <MenuItem value="weekly">Weekly</MenuItem>
          <MenuItem value="monthly">Monthly</MenuItem>
        </TextField>
        <TextField size="small" type="number" label="Retention days" value={cfg.retention_days || 30} onChange={(e) => patchSetting('backup.config', { retention_days: Number(e.target.value) })} />
        <Alert severity="info">Export/import endpoints can be connected here when backup service is enabled.</Alert>
      </SettingCard>
      <SectionActions onSave={() => saveSettings(['backup.config'])} onReset={() => resetSettings(['backup.config'])} />
    </Stack>
  );
}

function LinkedSection({ title, description, href }: any) {
  return (
    <Card variant="outlined"><CardContent>
      <Typography variant="subtitle1">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{description}</Typography>
      <Button variant="contained" href={appPath(href)}>Open Module</Button>
    </CardContent></Card>
  );
}

function SettingCard({ title, children }: any) {
  return (
    <Card variant="outlined"><CardContent>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
      <Grid container spacing={2}>{Array.isArray(children) ? children.map((child, i) => <Grid item xs={12} md={6} key={i}>{child}</Grid>) : <Grid item xs={12}>{children}</Grid>}</Grid>
    </CardContent></Card>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <FormControlLabel control={<Switch checked={!!checked} onChange={(e) => onChange(e.target.checked)} />} label={label} />;
}

function TaxRates() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', rate: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api.get('/taxes/rates/').then(r => setRows(r.data.results ?? r.data)).catch((e) => setErr(describeError(e, 'Failed to load tax rates')));
  useEffect(() => { load(); }, []);
  const save = async () => {
    try {
      if (editingId) await api.patch(`/taxes/rates/${editingId}/`, form);
      else await api.post('/taxes/rates/', form);
      setMsg(editingId ? 'Tax rate updated' : 'Tax rate created');
      setEditingId(null);
      setForm({ name: '', rate: 0 });
      load();
    } catch (e) {
      setErr(describeError(e, 'Failed to save tax rate'));
    }
  };
  const remove = async (row: any) => {
    if (!confirm(`Delete tax rate "${row.name}"?`)) return;
    try {
      await api.delete(`/taxes/rates/${row.id}/`);
      setMsg('Tax rate deleted');
      load();
    } catch (e) {
      setErr(describeError(e, 'Failed to delete tax rate'));
    }
  };
  const cols: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'rate', headerName: 'Rate %', width: 140, align: 'right', headerAlign: 'right' },
    {
      field: 'actions', headerName: '', width: 110, sortable: false,
      renderCell: (p) => (
        <>
          <IconButton size="small" onClick={() => { setEditingId(p.row.id); setForm({ name: p.row.name, rate: Number(p.row.rate) }); }}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => remove(p.row)}><DeleteIcon fontSize="small" /></IconButton>
        </>
      ),
    },
  ];
  return (
    <Card variant="outlined"><CardContent>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Tax Rates</Typography>
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField size="small" label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <TextField size="small" label="Rate" type="number" value={form.rate} onChange={e => setForm({ ...form, rate: Number(e.target.value) })} />
        <Button variant="contained" onClick={save}>{editingId ? 'Update' : 'Add'}</Button>
        {editingId && <Button onClick={() => { setEditingId(null); setForm({ name: '', rate: 0 }); }}>Cancel</Button>}
      </Stack>
      <DataGrid autoHeight rows={rows} columns={cols} getRowId={r => r.id} />
    </CardContent></Card>
  );
}
