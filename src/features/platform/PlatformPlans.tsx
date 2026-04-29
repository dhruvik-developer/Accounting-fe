import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, Grid, IconButton, InputAdornment, Stack, Switch, Tab, Tabs,
  TextField, Tooltip, Typography,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';

type Plan = {
  id: string; slug: string; name: string; currency: string;
  price_monthly_paise: number; price_annual_paise: number;
  price_monthly: number; price_annual: number;
  max_branches: number; max_users: number; max_invoices_per_month: number;
  features: Record<string, boolean | string | number>;
  is_active: boolean; sort_order: number;
};

type RegistryFlag = { slug: string; name: string; description: string; default_value: boolean };
type FeatureFlagDef = { slug: string; label: string; hint?: string };
type FeatureSection = { title: string; flags: FeatureFlagDef[] };

/* Module groups for the editor — nicer than a flat checkbox list. */
const FEATURE_GROUPS: { title: string; flags: { slug: string; label: string; hint?: string }[] }[] = [
  {
    title: 'Dashboard',
    flags: [
      { slug: 'dashboard.kpi', label: 'KPI cards' },
      { slug: 'dashboard.first_run_checklist', label: 'First-run checklist' },
      { slug: 'dashboard.sales_chart', label: 'Sales chart' },
      { slug: 'dashboard.stock_alerts', label: 'Stock alerts' },
      { slug: 'dashboard.outstanding_summary', label: 'Outstanding summary' },
      { slug: 'dashboard.gst_snapshot', label: 'GST snapshot' },
      { slug: 'dashboard.plan_usage', label: 'Plan usage' },
    ],
  },
  {
    title: 'Sales',
    flags: [
      { slug: 'module_sales', label: 'Sales module on' },
      { slug: 'sales.estimate', label: 'Estimate' },
      { slug: 'sales.sales_order', label: 'Sales order' },
      { slug: 'sales.delivery_challan', label: 'Delivery challan' },
      { slug: 'sales.invoice', label: 'Invoice' },
      { slug: 'sales.gst_invoice', label: 'GST invoice fields' },
      { slug: 'sales.recurring_invoice', label: 'Recurring invoice' },
      { slug: 'recurring_invoices', label: 'Recurring invoice engine' },
      { slug: 'sales.bulk_actions', label: 'Bulk actions' },
      { slug: 'bulk_actions', label: 'Global bulk actions' },
      { slug: 'sales.export', label: 'Export' },
      { slug: 'sales.email_whatsapp', label: 'Email / WhatsApp' },
      { slug: 'whatsapp', label: 'WhatsApp sharing' },
      { slug: 'sales.payment_status', label: 'Payment status' },
      { slug: 'sales.convert_flow', label: 'Convert flow' },
    ],
  },
  {
    title: 'Payments',
    flags: [
      { slug: 'module_payments', label: 'Payments module on' },
      { slug: 'payments.receipt', label: 'Receipt' },
      { slug: 'payments.payment_out', label: 'Payment out' },
      { slug: 'payments.allocation', label: 'Allocation' },
      { slug: 'payments.discount_tds_writeoff', label: 'Discount / TDS / write-off' },
      { slug: 'payments.cheque_details', label: 'Cheque details' },
      { slug: 'payments.bank_cash_accounts', label: 'Bank / cash accounts' },
      { slug: 'payments.unused_amount', label: 'Unused amount' },
      { slug: 'payments.reports', label: 'Payment reports' },
    ],
  },
  {
    title: 'Purchases',
    flags: [
      { slug: 'module_purchases', label: 'Purchases module on' },
      { slug: 'purchases.purchase_order', label: 'Purchase order' },
      { slug: 'purchases.bill', label: 'Purchase bill' },
      { slug: 'purchases.gst_bill', label: 'GST bill fields' },
      { slug: 'purchases.convert_po_to_bill', label: 'Convert PO to bill' },
      { slug: 'purchases.supplier_outstanding', label: 'Supplier outstanding' },
      { slug: 'purchases.payment_allocation', label: 'Payment allocation' },
      { slug: 'purchases.export', label: 'Export' },
    ],
  },
  {
    title: 'Branches',
    flags: [
      { slug: 'module_branches', label: 'Branches module on' },
      { slug: 'branches.list', label: 'Branch list' },
      { slug: 'branches.create', label: 'Create branch' },
      { slug: 'branches.edit', label: 'Edit branch' },
      { slug: 'branches.delete', label: 'Delete branch' },
      { slug: 'branches.default', label: 'Set default branch' },
      { slug: 'branches.gst_details', label: 'GSTIN and state details' },
      { slug: 'branches.contact_details', label: 'City, phone and email details' },
      { slug: 'settings.branches', label: 'Show branches in Settings' },
    ],
  },
  {
    title: 'Parties',
    flags: [
      { slug: 'module_parties', label: 'Parties module on' },
      { slug: 'parties.customer', label: 'Customers' },
      { slug: 'parties.supplier', label: 'Suppliers' },
      { slug: 'parties.contacts', label: 'Contacts' },
      { slug: 'parties.addresses', label: 'Addresses' },
      { slug: 'parties.bank_accounts', label: 'Bank accounts' },
      { slug: 'parties.branch_access', label: 'Branch access' },
      { slug: 'parties.opening_balance', label: 'Opening balance' },
      { slug: 'parties.ledger', label: 'Ledger' },
      { slug: 'parties.import_export', label: 'Import / export' },
    ],
  },
  {
    title: 'Items',
    flags: [
      { slug: 'module_items', label: 'Items module on' },
      { slug: 'items.identity', label: 'Identity' },
      { slug: 'items.category_unit', label: 'Category and unit' },
      { slug: 'items.barcode', label: 'Barcode' },
      { slug: 'items.pricing', label: 'Pricing' },
      { slug: 'items.account_mapping', label: 'Accounting mapping' },
      { slug: 'items.opening_stock', label: 'Opening stock' },
      { slug: 'items.reorder_levels', label: 'Reorder levels' },
      { slug: 'items.multi_warehouse', label: 'Multi-warehouse' },
      { slug: 'items.serial_tracking', label: 'Serial number stock' },
      { slug: 'items.batch_expiry_tracking', label: 'Batch / expiry stock' },
      { slug: 'items.bulk_import_export', label: 'Bulk import / export' },
    ],
  },
  {
    title: 'Inventory',
    flags: [
      { slug: 'module_inventory', label: 'Inventory module on' },
      { slug: 'inventory.stock_summary', label: 'Stock summary' },
      { slug: 'inventory.warehouse', label: 'Warehouses' },
      { slug: 'inventory.multi_branch_stock', label: 'Multi-branch stock' },
      { slug: 'inventory.stock_movement', label: 'Stock movement' },
      { slug: 'inventory.adjustment', label: 'Adjustment' },
      { slug: 'inventory.serial_lookup', label: 'Serial lookup' },
      { slug: 'inventory.batch_lookup', label: 'Batch lookup' },
      { slug: 'inventory.expiry_alert', label: 'Expiry alert' },
      { slug: 'inventory.low_stock_alert', label: 'Low stock alert' },
      { slug: 'inventory.valuation', label: 'Valuation' },
    ],
  },
  {
    title: 'Reports',
    flags: [
      { slug: 'module_reports_basic', label: 'Reports module on' },
      { slug: 'reports.sales_basic', label: 'Sales basic' },
      { slug: 'reports.purchase_basic', label: 'Purchase basic' },
      { slug: 'reports.party_outstanding', label: 'Party outstanding' },
      { slug: 'reports.stock_summary', label: 'Stock summary' },
      { slug: 'reports.gst_summary', label: 'GST summary' },
      { slug: 'reports_advanced', label: 'Advanced reports' },
      { slug: 'reports.pnl', label: 'P&L' },
      { slug: 'reports.ledger', label: 'Ledger' },
      { slug: 'reports.aging', label: 'Aging' },
      { slug: 'reports.advanced_filters', label: 'Advanced filters' },
      { slug: 'reports.export', label: 'Export' },
    ],
  },
  {
    title: 'Templates',
    flags: [
      { slug: 'templates.view', label: 'View templates' },
      { slug: 'designer', label: 'Template designer' },
      { slug: 'templates.customize_invoice', label: 'Customize invoice' },
      { slug: 'templates.logo_signature', label: 'Logo and signature' },
      { slug: 'templates.watermark', label: 'Watermark' },
      { slug: 'templates.terms_conditions', label: 'Terms and conditions' },
      { slug: 'templates.assignment', label: 'Assignment' },
      { slug: 'templates.versioning', label: 'Versioning' },
      { slug: 'templates.email_templates', label: 'Email templates' },
    ],
  },
  {
    title: 'Team and roles',
    flags: [
      { slug: 'team.invite_user', label: 'Invite user' },
      { slug: 'team.change_role', label: 'Change role' },
      { slug: 'team.deactivate_user', label: 'Deactivate user' },
      { slug: 'roles.view', label: 'View roles' },
      { slug: 'rbac', label: 'RBAC module' },
      { slug: 'roles.create_custom', label: 'Create custom roles' },
      { slug: 'roles.edit_permissions', label: 'Edit permissions' },
      { slug: 'roles.system_role_edit', label: 'Edit system roles' },
      { slug: 'audit.user_activity', label: 'User activity audit' },
      { slug: 'audit', label: 'Detailed audit log' },
    ],
  },
  {
    title: 'Settings',
    flags: [
      { slug: 'module_settings', label: 'Settings module on' },
      { slug: 'settings.business_profile', label: 'Business profile' },
      { slug: 'settings.branches', label: 'Branches' },
      { slug: 'settings.gst', label: 'GST' },
      { slug: 'settings.numbering', label: 'Numbering' },
      { slug: 'settings.barcode', label: 'Barcode' },
      { slug: 'settings.inventory', label: 'Inventory' },
      { slug: 'settings.accounting_mapping', label: 'Accounting mapping' },
      { slug: 'settings.payment', label: 'Payment' },
      { slug: 'settings.notifications', label: 'Notifications' },
      { slug: 'settings.backup', label: 'Backup' },
      { slug: 'settings.integrations', label: 'Integrations' },
      { slug: 'api', label: 'Public API access' },
      { slug: 'e_invoice', label: 'E-invoice integration' },
      { slug: 'multi_state', label: 'Multi-state GST' },
      { slug: 'online_store', label: 'Online store' },
      { slug: 'sso', label: 'Single Sign-On' },
      { slug: 'dedicated_support', label: 'Dedicated support' },
    ],
  },
];

const MODULE_FLAG_BY_GROUP: Record<string, string> = {
  Dashboard: 'dashboard.kpi',
  Sales: 'module_sales',
  Payments: 'module_payments',
  Purchases: 'module_purchases',
  Branches: 'module_branches',
  Parties: 'module_parties',
  Items: 'module_items',
  Inventory: 'module_inventory',
  Reports: 'module_reports_basic',
  Templates: 'designer',
  'Team and roles': 'module_team',
  Settings: 'module_settings',
};

const ITEM_SECTIONS: FeatureSection[] = [
  {
    title: 'Item Identity',
    flags: [
      { slug: 'items.identity', label: 'Item list / identity' },
      { slug: 'module_items', label: 'Items module on' },
    ],
  },
  {
    title: 'Category & Unit',
    flags: [
      { slug: 'items.category_unit', label: 'Category, subcategory and unit' },
    ],
  },
  {
    title: 'Pricing & Accounting',
    flags: [
      { slug: 'items.pricing', label: 'Sale price, purchase price, MRP and tax' },
      { slug: 'items.account_mapping', label: 'Sales, purchase, inventory and COGS accounts' },
      { slug: 'items.barcode', label: 'Barcode' },
    ],
  },
  {
    title: 'Inventory',
    flags: [
      { slug: 'items.opening_stock', label: 'Quantity stock and opening stock' },
      { slug: 'items.reorder_levels', label: 'Reorder, min and max stock' },
      { slug: 'items.multi_warehouse', label: 'Branch and warehouse stock' },
    ],
  },
  {
    title: 'Tracking',
    flags: [
      { slug: 'items.serial_tracking', label: 'Serial number stock' },
      { slug: 'items.batch_expiry_tracking', label: 'Batch, MFG and expiry stock' },
    ],
  },
  {
    title: 'Import / Export',
    flags: [
      { slug: 'items.bulk_import_export', label: 'Bulk import and export' },
    ],
  },
];

const BLANK_PLAN: Partial<Plan> = {
  slug: '', name: '', currency: 'INR',
  price_monthly_paise: 0, price_annual_paise: 0,
  max_branches: 1, max_users: 2, max_invoices_per_month: 50,
  features: {}, is_active: true, sort_order: 99,
};

export default function PlatformPlans() {
  const [rows, setRows] = useState<Plan[]>([]);
  const [registry, setRegistry] = useState<RegistryFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState(0);
  const [featureTab, setFeatureTab] = useState('Dashboard');
  const [featureSearch, setFeatureSearch] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/platform/plans/').then(r => setRows(r.data.results ?? r.data)).finally(() => setLoading(false));
    api.get('/billing/feature-flags/').then(r => setRegistry(r.data.registry || [])).catch(() => {});
  };
  useEffect(load, []);

  const save = async () => {
    if (!edit) return;
    setErr('');
    setMsg('');
    if (!edit.slug.trim() || !edit.name.trim()) {
      setErr('Plan slug and display name are required.');
      return;
    }
    if (
      edit.price_monthly_paise < 0 ||
      edit.price_annual_paise < 0 ||
      edit.max_branches < 0 ||
      edit.max_users < 0 ||
      edit.max_invoices_per_month < 0
    ) {
      setErr('Prices and limits cannot be negative.');
      return;
    }
    try {
      const payload = {
        slug: edit.slug.trim(), name: edit.name.trim(), currency: edit.currency || 'INR',
        price_monthly_paise: edit.price_monthly_paise,
        price_annual_paise: edit.price_annual_paise,
        max_branches: edit.max_branches,
        max_users: edit.max_users,
        max_invoices_per_month: edit.max_invoices_per_month,
        features: edit.features,
        is_active: edit.is_active,
        sort_order: edit.sort_order,
      };
      if (creating) {
        await api.post('/platform/plans/', payload);
        setMsg(`Plan "${edit.name}" created.`);
      } else {
        await api.patch(`/platform/plans/${edit.id}/`, payload);
        setMsg(`Plan "${edit.name}" saved.`);
      }
      setEdit(null); setCreating(false); setTab(0); load();
    } catch (e: any) { setErr(flatten(e)); }
  };

  const remove = async (p: Plan) => {
    if (!confirm(`Disable plan "${p.name}"? Existing customers keep it, but new customers will not see it.`)) return;
    try {
      await api.patch(`/platform/plans/${p.id}/`, { is_active: false });
      setMsg(`Plan "${p.name}" disabled.`); load();
    } catch (e: any) { setErr(flatten(e)); }
  };

  const setFlag = (slug: string, value: boolean) => {
    if (!edit) return;
    setEdit({ ...edit, features: { ...edit.features, [slug]: value } });
  };

  const setFlags = (slugs: string[], value: boolean) => {
    if (!edit) return;
    const next = { ...edit.features };
    slugs.forEach((slug) => { next[slug] = value; });
    setEdit({ ...edit, features: next });
  };

  const activeGroup = FEATURE_GROUPS.find(g => g.title === featureTab) || FEATURE_GROUPS[0];
  const moduleFlag = MODULE_FLAG_BY_GROUP[activeGroup.title] || '';
  const rawSections: FeatureSection[] = activeGroup.title === 'Items'
    ? ITEM_SECTIONS
    : [{ title: 'Features', flags: activeGroup.flags }];
  const filteredSections = rawSections
    .map(section => ({
      ...section,
      flags: section.flags.filter((f) => {
        const q = featureSearch.trim().toLowerCase();
        if (!q) return true;
        return f.label.toLowerCase().includes(q) || f.slug.toLowerCase().includes(q);
      }),
    }))
    .filter(section => section.flags.length > 0);
  const activeSlugs = Array.from(new Set(rawSections.flatMap(section => section.flags.map(f => f.slug))));
  const activeEnabled = activeSlugs.filter(slug => edit?.features?.[slug] === true).length;
  const moduleOn = moduleFlag ? !!edit?.features?.[moduleFlag] : activeEnabled > 0;

  const flagsCount = useMemo(() =>
    !edit ? 0 : Object.values(edit.features || {}).filter(v => v === true).length,
  [edit]);

  const cols: GridColDef[] = [
    { field: 'sort_order', headerName: '#', width: 60, align: 'right', headerAlign: 'right' },
    { field: 'slug', headerName: 'Slug', width: 130 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 130 },
    {
      field: 'price_monthly', headerName: 'Monthly', width: 110, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
    },
    {
      field: 'price_annual', headerName: 'Annual', width: 130, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
    },
    { field: 'max_branches', headerName: 'Br', width: 60, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => Number(v) === 0 ? '∞' : v },
    { field: 'max_users', headerName: 'Users', width: 80, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => Number(v) === 0 ? '∞' : v },
    { field: 'max_invoices_per_month', headerName: 'Inv/mo', width: 90, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => Number(v) === 0 ? '∞' : Number(v).toLocaleString('en-IN') },
    {
      field: 'features', headerName: 'Modules', width: 100, align: 'right', headerAlign: 'right',
      renderCell: (p) => {
        const n = Object.values(p.value as object || {}).filter(v => v === true).length;
        return <Chip size="small" label={`${n} on`} />;
      },
    },
    {
      field: 'is_active', headerName: 'Status', width: 90,
      renderCell: (p) => <Chip size="small" color={p.value ? 'success' : 'default'} label={p.value ? 'active' : 'disabled'} />,
    },
    {
      field: 'actions', headerName: '', width: 120, sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEdit(p.row); setTab(0); setFeatureTab('Dashboard'); }}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Disable"><IconButton size="small" color="error" disabled={!p.row.is_active} onClick={() => remove(p.row)}><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Plans"
        subtitle={`${rows.length} plan${rows.length > 1 ? 's' : ''}`}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setEdit({ ...BLANK_PLAN } as Plan); setCreating(true); setTab(0); setFeatureTab('Dashboard'); }}
          >
            New plan
          </Button>
        }
      />
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <DataTable id="platform.plans" rows={rows} columns={cols} loading={loading} getRowId={(r) => r.id} />

      {/* Edit / Create dialog */}
      <Dialog open={!!edit} onClose={() => { setEdit(null); setCreating(false); }} fullWidth maxWidth="md">
        <DialogTitle>
          {creating ? 'Create plan' : `Edit plan — ${edit?.slug}`}
          {!creating && edit && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{flagsCount} module{flagsCount === 1 ? '' : 's'} enabled</Typography>}
        </DialogTitle>
        <DialogContent>
          {edit && (
            <>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Tab label="Pricing & limits" />
                <Tab label="Modules & features" />
              </Tabs>

              {tab === 0 && (
                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                  <Grid item xs={6}>
                    <TextField fullWidth required label="Slug (unique)" value={edit.slug || ''}
                      disabled={!creating}
                      onChange={e => setEdit({ ...edit, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') })}
                      helperText="Lowercase letters, numbers, and hyphens only"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth required label="Display name" value={edit.name || ''}
                      onChange={e => setEdit({ ...edit, name: e.target.value })} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField fullWidth label="Currency" value={edit.currency || 'INR'}
                      onChange={e => setEdit({ ...edit, currency: e.target.value.toUpperCase().slice(0, 3) })} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth type="number"
                      label="Monthly price (₹)"
                      // Inputs are in rupees; we convert to paise on save.
                      // Step 0.01 lets ops set ₹349.50 if needed.
                      inputProps={{ min: 0, step: 0.01 }}
                      value={(edit.price_monthly_paise ?? 0) / 100}
                      onChange={e => {
                        const rupees = Number(e.target.value || 0);
                        const monthlyPaise = Math.round(rupees * 100);
                        // If annual was empty OR exactly matched the old
                        // monthly × 12, keep them in sync. Otherwise leave
                        // the explicit annual override alone — ops may have
                        // set a discounted annual rate they want preserved.
                        const oldMonthly = edit.price_monthly_paise ?? 0;
                        const annualFollowsMonthly = (edit.price_annual_paise ?? 0) === 0
                          || (edit.price_annual_paise ?? 0) === oldMonthly * 12;
                        setEdit({
                          ...edit,
                          price_monthly_paise: monthlyPaise,
                          ...(annualFollowsMonthly ? { price_annual_paise: monthlyPaise * 12 } : {}),
                        });
                      }}
                      helperText={`Stored as ${edit.price_monthly_paise ?? 0} paise · charged monthly`}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth type="number"
                      label="Annual price (₹/yr)"
                      inputProps={{ min: 0, step: 0.01 }}
                      value={(edit.price_annual_paise ?? 0) / 100}
                      onChange={e => {
                        const rupees = Number(e.target.value || 0);
                        setEdit({ ...edit, price_annual_paise: Math.round(rupees * 100) });
                      }}
                      helperText={(() => {
                        const monthly = edit.price_monthly_paise ?? 0;
                        const annual = edit.price_annual_paise ?? 0;
                        if (!annual) return 'Per-year price (auto-fills as monthly × 12)';
                        const fullYear = monthly * 12;
                        const effectivePerMonth = Math.round(annual / 12 / 100);
                        if (!fullYear || annual === fullYear) {
                          return `≈ ₹${effectivePerMonth.toLocaleString('en-IN')} / mo (no annual discount)`;
                        }
                        const savedPct = Math.round(((fullYear - annual) / fullYear) * 100);
                        return savedPct > 0
                          ? `≈ ₹${effectivePerMonth.toLocaleString('en-IN')} / mo · saves ${savedPct}% vs monthly billing`
                          : `≈ ₹${effectivePerMonth.toLocaleString('en-IN')} / mo · ${Math.abs(savedPct)}% MORE than monthly × 12 (review)`;
                      })()}
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Button size="small" variant="text"
                        onClick={() => setEdit({ ...edit, price_annual_paise: (edit.price_monthly_paise ?? 0) * 12 })}>
                        Sync (monthly × 12)
                      </Button>
                      <Button size="small" variant="text"
                        onClick={() => setEdit({ ...edit, price_annual_paise: Math.round((edit.price_monthly_paise ?? 0) * 12 * 0.83) })}>
                        Apply 17% annual discount
                      </Button>
                    </Stack>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField fullWidth type="number" label="Max branches (0 = ∞)" value={edit.max_branches ?? 1}
                      onChange={e => setEdit({ ...edit, max_branches: Number(e.target.value) })} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField fullWidth type="number" label="Max users (0 = ∞)" value={edit.max_users ?? 2}
                      onChange={e => setEdit({ ...edit, max_users: Number(e.target.value) })} />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField fullWidth type="number" label="Invoices / mo (0 = ∞)" value={edit.max_invoices_per_month ?? 50}
                      onChange={e => setEdit({ ...edit, max_invoices_per_month: Number(e.target.value) })} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth type="number" label="Sort order" value={edit.sort_order ?? 99}
                      onChange={e => setEdit({ ...edit, sort_order: Number(e.target.value) })} />
                  </Grid>
                  <Grid item xs={6}>
                    <FormControlLabel control={<Switch checked={!!edit.is_active}
                      onChange={e => setEdit({ ...edit, is_active: e.target.checked })} />} label="Active (visible to customers)" />
                  </Grid>
                </Grid>
              )}

              {tab === 1 && (
                <Box>
                  <Stack spacing={1.5}>
                    <Alert severity="info">
                      Pick the product modules and micro-features this plan includes. Role permissions still decide what each user can do inside the customer account.
                    </Alert>

                    <TextField
                      size="small"
                      placeholder="Search modules or features"
                      value={featureSearch}
                      onChange={e => setFeatureSearch(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ maxWidth: 420 }}
                    />

                    <Tabs
                      value={featureTab}
                      onChange={(_, v) => setFeatureTab(v)}
                      variant="scrollable"
                      allowScrollButtonsMobile
                      sx={{
                        minHeight: 40,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        '& .MuiTab-root': { minHeight: 40, textTransform: 'none' },
                      }}
                    >
                      {FEATURE_GROUPS.map(group => (
                        <Tab key={group.title} value={group.title} label={group.title} />
                      ))}
                    </Tabs>

                    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        spacing={1}
                        sx={{ px: 2, py: 1.25, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}
                      >
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={moduleOn}
                              indeterminate={!moduleOn && activeEnabled > 0}
                              onChange={e => setFlags([...(moduleFlag ? [moduleFlag] : []), ...activeSlugs], e.target.checked)}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="subtitle2">{activeGroup.title} on</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {activeEnabled} / {activeSlugs.length} enabled
                              </Typography>
                            </Box>
                          }
                          sx={{ m: 0, flex: 1 }}
                        />
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" onClick={() => setFlags([...(moduleFlag ? [moduleFlag] : []), ...activeSlugs], true)}>
                            Select all
                          </Button>
                          <Button size="small" onClick={() => setFlags([...(moduleFlag ? [moduleFlag] : []), ...activeSlugs], false)}>
                            Clear
                          </Button>
                        </Stack>
                      </Stack>

                      <Stack spacing={1.25} sx={{ p: 2 }}>
                        {filteredSections.length === 0 && (
                          <Typography color="text.secondary" sx={{ py: 2 }}>No matching features.</Typography>
                        )}
                        {filteredSections.map(section => {
                          const sectionSlugs = section.flags.map(f => f.slug);
                          const sectionEnabled = sectionSlugs.filter(slug => edit.features?.[slug] === true).length;
                          return (
                            <Box key={section.title} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.25 }}>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={sectionEnabled === sectionSlugs.length && sectionSlugs.length > 0}
                                      indeterminate={sectionEnabled > 0 && sectionEnabled < sectionSlugs.length}
                                      onChange={e => setFlags(sectionSlugs, e.target.checked)}
                                    />
                                  }
                                  label={<Typography fontWeight={700}>{section.title}</Typography>}
                                  sx={{ m: 0, flex: 1 }}
                                />
                                <Chip size="small" label={`${sectionEnabled}/${sectionSlugs.length}`} />
                              </Stack>
                              <Grid container spacing={0.5}>
                                {section.flags.map(f => (
                                  <Grid item xs={12} sm={6} md={4} key={f.slug}>
                                    <FormControlLabel
                                      control={<Checkbox checked={!!edit.features?.[f.slug]} onChange={e => setFlag(f.slug, e.target.checked)} />}
                                      label={
                                        <Box>
                                          <Typography variant="body2">{f.label}</Typography>
                                          <Typography variant="caption" color="text.secondary">{f.slug}</Typography>
                                        </Box>
                                      }
                                      sx={{ alignItems: 'flex-start', m: 0, py: 0.35, width: '100%' }}
                                    />
                                  </Grid>
                                ))}
                              </Grid>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEdit(null); setCreating(false); }}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!edit?.slug || !edit?.name}>
            {creating ? 'Create plan' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function flatten(e: any): string {
  const d = e?.response?.data;
  if (!d) return e?.message || 'Request failed';
  if (typeof d === 'string') return d;
  if (d.detail) return d.detail;
  const first = Object.entries(d)[0];
  if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}`;
  return 'Request failed';
}
