/**
 * Item create/edit wizard. 4 steps: Basics, Pricing & Accounts, Inventory, Tracking.
 * Extracted from Items.tsx during the 2-pane rebuild so the container can stay
 * focused on layout, filters, and selection.
 *
 * Side-effects worth knowing:
 *   • Inline create-category / create-subcategory / create-unit dialogs
 *     hit the API directly. After save we tell the parent via `onMastersChanged`
 *     so the left-pane filter chips and other pages stay current.
 *   • Bulk-add of serials/batches happens AFTER the item is created, in
 *     separate calls — kept inside this component so the wizard owns the
 *     full "create item + opening stock" flow end-to-end.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, Grid, IconButton, MenuItem, Paper, Stack, Switch,
  Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import DeleteIcon from '@mui/icons-material/Delete';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { api } from '@/app/api';

const EMPTY = {
  sku: '', name: '', description: '', type: 'product',
  category: '', subcategory: '', unit: '', purchase_unit: '', sales_unit: '',
  purchase_conversion_factor: 1, sales_conversion_factor: 1,
  hsn: null as any, hsn_code: '', tax_rate: '',
  sale_price: 0, purchase_price: 0, mrp: 0,
  opening_stock: 0, opening_stock_value: 0, opening_stock_date: '',
  opening_branch: '', opening_warehouse: '',
  track_inventory: true, is_serialized: false, is_batch_tracked: false,
  reorder_level: 0, min_stock_level: 0, max_stock_level: 0, reorder_qty: 0,
  is_active: true, barcode: '',
  sales_account: '', purchase_account: '', inventory_account: '', cogs_account: '',
  preferred_supplier: '', preferred_customer: '',
  serial_numbers: '', serial_branch: '', serial_warehouse: '',
  serial_auto_prefix: 'SN', serial_auto_start: 1, serial_auto_count: 10, serial_auto_padding: 4,
  batch_branch: '', batch_warehouse: '',
  batches: [{ batch_number: '', qty_available: 0, mfg_date: '', expiry_date: '' }],
};

const STEPS = ['Basics', 'Pricing & Accounts', 'Inventory', 'Tracking'];
const MASTER_EMPTY = { name: '', code: '' };
type MasterDialogKind = 'category' | 'subcategory' | 'unit' | null;

const splitSerials = (value: string) =>
  value.split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);

const sortedDuplicates = (values: string[]) => {
  const seen = new Set<string>();
  const dups = new Set<string>();
  values.forEach((v) => {
    const k = v.toUpperCase();
    if (seen.has(k)) dups.add(v);
    seen.add(k);
  });
  return Array.from(dups).sort();
};

const numberValue = (v: any) => Number(v || 0);
const escapeRegExp = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const barcodeParts = (s: any, type: string) => {
  const separator = String(s?.separator ?? '-');
  const prefix = String(s?.prefix || 'VEN').trim().toUpperCase();
  const segment = String(
    type === 'service' ? (s?.service_segment || 'SERVICE') : (s?.product_segment || 'PRODUCT'),
  ).trim().toUpperCase();
  return { prefix, segment, separator };
};

const buildBarcode = (s: any, type: string, n: number) => {
  const { prefix, segment, separator } = barcodeParts(s, type);
  const padding = Math.max(Number(s?.padding || 4), 1);
  const leading = [prefix, segment].filter(Boolean).join(separator);
  const glue = leading ? separator : '';
  return `${leading}${glue}${String(n).padStart(padding, '0')}`;
};

const generateBarcode = (s: any, type: string, items: any[]) => {
  if (!s?.enabled) return '';
  const { prefix, segment, separator } = barcodeParts(s, type);
  const leading = [prefix, segment].filter(Boolean).join(separator);
  const glue = leading ? separator : '';
  const pattern = new RegExp(`^${escapeRegExp(leading)}${escapeRegExp(glue)}(\\d+)$`, 'i');
  const start = Math.max(Number(s?.start || 1), 1);
  const maxExisting = items.reduce((max, it) => {
    const m = String(it.barcode || '').match(pattern);
    return m ? Math.max(max, Number(m[1])) : max;
  }, start - 1);
  return buildBarcode(s, type, maxExisting + 1);
};

const describeError = (e: any) =>
  e?.response?.data?.detail
  || (e?.response?.data && JSON.stringify(e.response.data))
  || e?.message
  || 'Could not save item';

type Props = {
  open: boolean;
  editing: any | null;
  rates: any[];
  categories: any[];
  units: any[];
  branches: any[];
  warehouses: any[];
  accounts: any[];
  parties: any[];
  barcodeSetting: any;
  existingItems: any[]; // used only for next-barcode prediction
  onClose: () => void;
  onSaved: (item: any) => void;
  onMastersChanged: () => void; // parent re-fetches /items/categories + /items/units
};

export default function ItemForm({
  open, editing, rates, categories, units, branches, warehouses, accounts, parties,
  barcodeSetting, existingItems,
  onClose, onSaved, onMastersChanged,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [activeStep, setActiveStep] = useState(0);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [barcodeManual, setBarcodeManual] = useState(false);

  // Inline master-create dialog (category / subcategory / unit).
  const [masterKind, setMasterKind] = useState<MasterDialogKind>(null);
  const [masterForm, setMasterForm] = useState(MASTER_EMPTY);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])), [categories],
  );
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent && c.is_active !== false), [categories],
  );
  const subcategories = useMemo(
    () => categories.filter((c) => c.parent === form.category && c.is_active !== false),
    [categories, form.category],
  );

  const defaultBranch = useMemo(
    () => branches.find((b) => b.id === localStorage.getItem('branch_id'))
      || branches.find((b) => b.is_default) || branches[0],
    [branches],
  );
  const filteredWarehouses = useMemo(
    () => warehouses.filter((w) => !form.serial_branch || !w.branch || w.branch === form.serial_branch),
    [warehouses, form.serial_branch],
  );
  const openingWarehouses = useMemo(
    () => warehouses.filter((w) => !form.opening_branch || !w.branch || w.branch === form.opening_branch),
    [warehouses, form.opening_branch],
  );
  const batchWarehouses = useMemo(
    () => warehouses.filter((w) => !form.batch_branch || !w.branch || w.branch === form.batch_branch),
    [warehouses, form.batch_branch],
  );
  const defaultWarehouse = useMemo(
    () => filteredWarehouses.find((w) => w.is_default)
      || warehouses.find((w) => w.is_default)
      || filteredWarehouses[0]
      || warehouses[0],
    [filteredWarehouses, warehouses],
  );

  const duplicateSerials = useMemo(
    () => sortedDuplicates(splitSerials(form.serial_numbers)),
    [form.serial_numbers],
  );
  const serialCount = splitSerials(form.serial_numbers).length;

  // Reset / hydrate when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setErr('');
    setActiveStep(0);
    setSaving(false);
    if (!editing) {
      setBarcodeManual(false);
      setForm({
        ...EMPTY,
        barcode: generateBarcode(barcodeSetting, 'product', existingItems),
        opening_stock_date: new Date().toISOString().slice(0, 10),
        opening_branch: defaultBranch?.id || '',
        opening_warehouse: defaultWarehouse?.id || '',
        serial_branch: defaultBranch?.id || '',
        serial_warehouse: defaultWarehouse?.id || '',
        batch_branch: defaultBranch?.id || '',
        batch_warehouse: defaultWarehouse?.id || '',
      });
      return;
    }
    setBarcodeManual(true);
    const selectedCategory = categoryById.get(editing.category);
    const isSubcategory = !!selectedCategory?.parent;
    setForm({
      ...EMPTY,
      ...editing,
      category: isSubcategory ? selectedCategory.parent : editing.category || '',
      subcategory: isSubcategory ? selectedCategory.id : '',
      unit: editing.unit || '',
      purchase_unit: editing.purchase_unit || editing.unit || '',
      sales_unit: editing.sales_unit || editing.unit || '',
      tax_rate: editing.tax_rate || '',
      hsn: editing.hsn || null,
      opening_branch: editing.opening_branch || defaultBranch?.id || '',
      opening_warehouse: editing.opening_warehouse || defaultWarehouse?.id || '',
      serial_branch: defaultBranch?.id || '',
      serial_warehouse: defaultWarehouse?.id || '',
      serial_numbers: '',
      batch_branch: defaultBranch?.id || '',
      batch_warehouse: defaultWarehouse?.id || '',
      batches: [{ batch_number: '', qty_available: 0, mfg_date: '', expiry_date: '' }],
      sales_account: editing.sales_account || '',
      purchase_account: editing.purchase_account || '',
      inventory_account: editing.inventory_account || '',
      cogs_account: editing.cogs_account || '',
      preferred_supplier: editing.preferred_supplier || '',
      preferred_customer: editing.preferred_customer || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const setBarcode = (e: any) => {
    setBarcodeManual(true);
    setForm({ ...form, barcode: e.target.value });
  };
  const regenerateBarcode = (type = form.type) => {
    setBarcodeManual(false);
    setForm({ ...form, barcode: generateBarcode(barcodeSetting, type, existingItems) });
  };

  const setType = (e: any) => {
    const type = e.target.value;
    const next: any = {
      ...form,
      type,
      track_inventory: type === 'product' ? form.track_inventory : false,
      is_serialized: type === 'product' ? form.is_serialized : false,
      is_batch_tracked: type === 'product' ? form.is_batch_tracked : false,
      opening_stock: type === 'product' ? form.opening_stock : 0,
      opening_stock_value: type === 'product' ? form.opening_stock_value : 0,
    };
    if (!editing && !barcodeManual) {
      next.barcode = generateBarcode(barcodeSetting, type, existingItems);
    }
    setForm(next);
  };

  const setSerialBranch = (e: any) => {
    const branchId = e.target.value;
    const nextWh = warehouses.find((w) => w.branch === branchId && w.is_default)
      || warehouses.find((w) => w.branch === branchId)
      || defaultWarehouse;
    setForm({ ...form, serial_branch: branchId, serial_warehouse: nextWh?.id || '' });
  };
  const setOpeningBranch = (e: any) => {
    const branchId = e.target.value;
    const nextWh = warehouses.find((w) => w.branch === branchId && w.is_default)
      || warehouses.find((w) => w.branch === branchId)
      || defaultWarehouse;
    setForm({ ...form, opening_branch: branchId, opening_warehouse: nextWh?.id || '' });
  };
  const setBatchBranch = (e: any) => {
    const branchId = e.target.value;
    const nextWh = warehouses.find((w) => w.branch === branchId && w.is_default)
      || warehouses.find((w) => w.branch === branchId)
      || defaultWarehouse;
    setForm({ ...form, batch_branch: branchId, batch_warehouse: nextWh?.id || '' });
  };

  const updateBatch = (i: number, key: string, value: any) => {
    const batches = [...(form.batches || [])];
    batches[i] = { ...batches[i], [key]: value };
    setForm({ ...form, batches });
  };
  const addBatchRow = () => setForm({
    ...form, batches: [...(form.batches || []), { batch_number: '', qty_available: 0, mfg_date: '', expiry_date: '' }],
  });
  const removeBatchRow = (i: number) => {
    const b = [...(form.batches || [])];
    b.splice(i, 1);
    setForm({ ...form, batches: b.length ? b : [{ batch_number: '', qty_available: 0, mfg_date: '', expiry_date: '' }] });
  };

  const generateSerialRows = () => {
    const prefix = String(form.serial_auto_prefix || 'SN').trim().toUpperCase();
    const sep = '-';
    const start = Math.max(numberValue(form.serial_auto_start) || 1, 1);
    const count = Math.max(numberValue(form.serial_auto_count) || 1, 1);
    const padding = Math.max(numberValue(form.serial_auto_padding) || 4, 1);
    const leading = prefix ? `${prefix}${sep}` : '';
    const serials = Array.from({ length: count }, (_, i) =>
      `${leading}${String(start + i).padStart(padding, '0')}`,
    );
    setForm({ ...form, serial_numbers: [...splitSerials(form.serial_numbers), ...serials].join('\n') });
  };

  const importSerialCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.split(',')[0]?.trim()).filter(Boolean);
    const first = lines[0]?.toLowerCase();
    const serials = first === 'serial_number' ? lines.slice(1) : lines;
    setForm({ ...form, serial_numbers: [...splitSerials(form.serial_numbers), ...serials].join('\n') });
  };

  const itemPayload = () => ({
    sku: String(form.sku || '').trim(),
    name: String(form.name || '').trim(),
    description: form.description || '',
    type: form.type,
    category: form.subcategory || form.category || null,
    unit: form.unit || null,
    purchase_unit: form.purchase_unit || form.unit || null,
    sales_unit: form.sales_unit || form.unit || null,
    purchase_conversion_factor: numberValue(form.purchase_conversion_factor || 1),
    sales_conversion_factor: numberValue(form.sales_conversion_factor || 1),
    hsn: form.hsn || null,
    hsn_code: form.hsn_code || '',
    tax_rate: form.tax_rate || null,
    sale_price: numberValue(form.sale_price),
    purchase_price: numberValue(form.purchase_price),
    mrp: numberValue(form.mrp),
    opening_stock: form.is_serialized || form.is_batch_tracked ? 0 : numberValue(form.opening_stock),
    opening_stock_value: form.is_serialized || form.is_batch_tracked ? 0 : numberValue(form.opening_stock_value),
    opening_stock_date: form.opening_stock_date || null,
    opening_branch: form.opening_branch || null,
    opening_warehouse: form.opening_warehouse || null,
    track_inventory: form.is_serialized || form.is_batch_tracked ? true : !!form.track_inventory,
    is_serialized: !!form.is_serialized,
    is_batch_tracked: !!form.is_batch_tracked,
    reorder_level: numberValue(form.reorder_level),
    min_stock_level: numberValue(form.min_stock_level),
    max_stock_level: numberValue(form.max_stock_level),
    reorder_qty: numberValue(form.reorder_qty),
    is_active: !!form.is_active,
    barcode: form.barcode || '',
    sales_account: form.sales_account || null,
    purchase_account: form.purchase_account || null,
    inventory_account: form.inventory_account || null,
    cogs_account: form.cogs_account || null,
    preferred_supplier: form.preferred_supplier || null,
    preferred_customer: form.preferred_customer || null,
  });

  const addSerials = async (itemId: string) => {
    const serials = splitSerials(form.serial_numbers);
    if (!form.is_serialized || serials.length === 0) return 0;
    if (!form.serial_branch || !form.serial_warehouse) {
      throw new Error('Select branch and warehouse before adding serial numbers.');
    }
    const { data } = await api.post('/inventory/serials/bulk-add/', {
      item: itemId, branch: form.serial_branch, warehouse: form.serial_warehouse,
      serial_numbers: serials,
    });
    return data.created || serials.length;
  };

  const addBatches = async (itemId: string) => {
    const batches = (form.batches || [])
      .map((row: any) => ({
        batch_number: String(row.batch_number || '').trim(),
        qty_available: numberValue(row.qty_available),
        mfg_date: row.mfg_date || null,
        expiry_date: row.expiry_date || null,
      }))
      .filter((row: any) => row.batch_number && row.qty_available > 0);
    if (!form.is_batch_tracked || batches.length === 0) return 0;
    if (!form.batch_branch || !form.batch_warehouse) {
      throw new Error('Select branch and warehouse before adding opening batches.');
    }
    const { data } = await api.post('/inventory/batches/bulk-add/', {
      item: itemId, branch: form.batch_branch, warehouse: form.batch_warehouse, batches,
    });
    return data.created || batches.length;
  };

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const payload = itemPayload();
      if (!payload.sku || !payload.name) throw new Error('SKU and name are required.');
      if (duplicateSerials.length) {
        throw new Error(`Duplicate serials in entry: ${duplicateSerials.slice(0, 5).join(', ')}`);
      }
      if (payload.max_stock_level && payload.min_stock_level && payload.max_stock_level < payload.min_stock_level) {
        throw new Error('Max stock cannot be less than min stock.');
      }
      const { data } = editing
        ? await api.patch(`/items/${editing.id}/`, payload)
        : await api.post('/items/', payload);
      await addSerials(data.id);
      await addBatches(data.id);
      onSaved(data);
      onClose();
    } catch (e: any) {
      setErr(describeError(e));
      setSaving(false);
    }
  };

  // --- inline category/unit creation ----------------------------------
  const openMaster = (kind: MasterDialogKind) => {
    if (kind === 'subcategory' && !form.category) {
      setErr('Select a parent category before creating a subcategory.');
      return;
    }
    setMasterKind(kind);
    setMasterForm(MASTER_EMPTY);
  };
  const closeMaster = () => { setMasterKind(null); setMasterForm(MASTER_EMPTY); };
  const saveMaster = async () => {
    try {
      const name = masterForm.name.trim();
      if (!masterKind || !name) throw new Error('Name is required.');
      if (masterKind === 'unit') {
        const code = (masterForm.code.trim() || name).toUpperCase().slice(0, 10);
        const { data } = await api.post('/items/units/', { code, name });
        onMastersChanged();
        setForm((p: any) => ({ ...p, unit: data.id }));
      } else {
        const { data } = await api.post('/items/categories/', {
          code: masterForm.code.trim(), name,
          parent: masterKind === 'subcategory' ? form.category : null,
          is_active: true, sort_order: 0,
        });
        onMastersChanged();
        setForm((p: any) => masterKind === 'subcategory'
          ? { ...p, subcategory: data.id }
          : { ...p, category: data.id, subcategory: '' });
      }
      setErr('');
      closeMaster();
    } catch (e: any) {
      setErr(describeError(e));
    }
  };

  return (
    <>
      <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="h6">{editing ? 'Edit item' : 'New item'}</Typography>
              <Typography variant="body2" color="text.secondary">
                Classification, pricing, GST and inventory behaviour from one place.
              </Typography>
            </Box>
            <Chip
              color={form.is_serialized ? 'primary' : 'default'}
              icon={form.is_serialized ? <QrCodeScannerIcon /> : <Inventory2Icon />}
              label={form.is_serialized
                ? 'Serialized stock'
                : form.is_batch_tracked
                  ? 'Batch + expiry'
                  : form.track_inventory ? 'Quantity stock' : 'No stock tracking'}
            />
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
          {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
            {STEPS.map((s) => (<Step key={s}><StepLabel>{s}</StepLabel></Step>))}
          </Stepper>

          <Stack spacing={2.5}>
            {/* Step 0 - Basics */}
            <Box sx={{ display: activeStep === 0 ? 'block' : 'none' }}>
              <Section title="Identity" helper="Core item details used on invoices, bills and reports."
                icon={<CategoryIcon fontSize="small" />}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth label="SKU" value={form.sku} onChange={set('sku')} required />
                  </Grid>
                  <Grid item xs={12} sm={5}>
                    <TextField fullWidth label="Item name" value={form.name} onChange={set('name')} required />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Type" value={form.type} onChange={setType}>
                      <MenuItem value="product">Product</MenuItem>
                      <MenuItem value="service">Service</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Description" value={form.description}
                      onChange={set('description')}
                      placeholder="Short item description for internal use" />
                  </Grid>
                </Grid>
              </Section>
            </Box>
            <Box sx={{ display: activeStep === 0 ? 'block' : 'none' }}>
              <Section title="Category and unit" helper="Create category, subcategory or unit inline if dropdowns are empty.">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Category"
                      value={form.category || ''}
                      onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: '' })}
                      helperText={parentCategories.length ? 'Main reporting group' : 'No category yet — create one below.'}>
                      <MenuItem value="">None</MenuItem>
                      {parentCategories.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Subcategory"
                      value={form.subcategory || ''} onChange={set('subcategory')}
                      disabled={!form.category || subcategories.length === 0}
                      helperText={form.category ? 'Optional child group' : 'Select category first'}>
                      <MenuItem value="">None</MenuItem>
                      {subcategories.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Unit" value={form.unit || ''} onChange={set('unit')}
                      helperText={units.length ? 'e.g. PCS, KG, BOX' : 'No unit yet — create one below.'}>
                      <MenuItem value="">None</MenuItem>
                      {units.map((u: any) => <MenuItem key={u.id} value={u.id}>{u.code} - {u.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Purchase unit"
                      value={form.purchase_unit || form.unit || ''} onChange={set('purchase_unit')}
                      helperText="Unit used on purchase bills">
                      <MenuItem value="">Same as base</MenuItem>
                      {units.map((u: any) => <MenuItem key={u.id} value={u.id}>{u.code} - {u.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Sales unit"
                      value={form.sales_unit || form.unit || ''} onChange={set('sales_unit')}
                      helperText="Unit used on sales invoices">
                      <MenuItem value="">Same as base</MenuItem>
                      {units.map((u: any) => <MenuItem key={u.id} value={u.id}>{u.code} - {u.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField fullWidth type="number" label="Purchase factor"
                      value={form.purchase_conversion_factor} onChange={set('purchase_conversion_factor')}
                      helperText="1 purchase unit = factor base units" />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField fullWidth type="number" label="Sales factor"
                      value={form.sales_conversion_factor} onChange={set('sales_conversion_factor')}
                      helperText="1 sales unit = factor base units" />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => openMaster('category')}>
                        Create category
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => openMaster('subcategory')} disabled={!form.category}>
                        Create subcategory
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => openMaster('unit')}>
                        Create unit
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Section>
            </Box>

            {/* Step 1 - Pricing & accounts */}
            <Box sx={{ display: activeStep === 1 ? 'block' : 'none' }}>
              <Section title="Pricing and GST" helper="Prices live on the item master; GST comes from Settings > Tax Rates.">
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth type="number" label="Sale price" value={form.sale_price} onChange={set('sale_price')} />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth type="number" label="Purchase price" value={form.purchase_price} onChange={set('purchase_price')} />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField fullWidth type="number" label="MRP" value={form.mrp} onChange={set('mrp')} />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <TextField fullWidth label="Barcode" value={form.barcode} onChange={setBarcode}
                        helperText={barcodeSetting?.enabled
                          ? `Auto: ${buildBarcode(barcodeSetting, form.type, Number(barcodeSetting.start || 1))}`
                          : 'Auto barcode is disabled in Settings'} />
                      <Button variant="outlined" sx={{ mt: 1 }}
                        disabled={!barcodeSetting?.enabled}
                        onClick={() => regenerateBarcode()}>
                        Auto
                      </Button>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth label="HSN/SAC" value={form.hsn_code} onChange={set('hsn_code')} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="GST rate" value={form.tax_rate || ''} onChange={set('tax_rate')}>
                      <MenuItem value="">None</MenuItem>
                      {rates.map((r: any) => <MenuItem key={r.id} value={r.id}>{r.name} ({r.rate}%)</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControlLabel
                      sx={{ height: '100%', alignItems: 'center', ml: 0 }}
                      control={<Switch checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />}
                      label="Active item"
                    />
                  </Grid>
                </Grid>
              </Section>
            </Box>
            <Box sx={{ display: activeStep === 1 ? 'block' : 'none' }}>
              <Section title="Accounting mapping" helper="Map item postings to ledger accounts. Leave blank for system defaults.">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <TextField select fullWidth label="Sales account"
                      value={form.sales_account || ''} onChange={set('sales_account')}>
                      <MenuItem value="">Default Sales</MenuItem>
                      {accounts.filter((a) => a.type === 'income').map((a: any) =>
                        <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField select fullWidth label="Purchase account"
                      value={form.purchase_account || ''} onChange={set('purchase_account')}>
                      <MenuItem value="">Default Purchases</MenuItem>
                      {accounts.filter((a) => a.type === 'expense').map((a: any) =>
                        <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField select fullWidth label="Inventory account"
                      value={form.inventory_account || ''} onChange={set('inventory_account')}>
                      <MenuItem value="">Default Inventory</MenuItem>
                      {accounts.filter((a) => a.type === 'asset').map((a: any) =>
                        <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField select fullWidth label="COGS account"
                      value={form.cogs_account || ''} onChange={set('cogs_account')}>
                      <MenuItem value="">Default COGS</MenuItem>
                      {accounts.filter((a) => a.type === 'expense').map((a: any) =>
                        <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>
              </Section>
            </Box>
            <Box sx={{ display: activeStep === 1 ? 'block' : 'none' }}>
              <Section title="Preferred trading partners"
                helper="Used to auto-fill the supplier on PO/Bill forms and identify the default customer for items sold mostly through one channel.">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField select fullWidth label="Preferred supplier"
                      value={form.preferred_supplier || ''} onChange={set('preferred_supplier')}
                      helperText="Auto-suggested when raising a PO / Bill">
                      <MenuItem value="">None</MenuItem>
                      {parties.filter((p: any) => p.type === 'supplier' || p.type === 'both').map((p: any) =>
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField select fullWidth label="Preferred customer"
                      value={form.preferred_customer || ''} onChange={set('preferred_customer')}
                      helperText="Default customer if this item is mostly sold to one buyer">
                      <MenuItem value="">None</MenuItem>
                      {parties.filter((p: any) => p.type === 'customer' || p.type === 'both').map((p: any) =>
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                </Grid>
              </Section>
            </Box>

            {/* Step 2 - Inventory */}
            <Box sx={{ display: activeStep === 2 ? 'block' : 'none' }}>
              <Section title="Inventory mode" helper="Quantity for normal items, Serial for IMEI/asset, Batch for expiry-tracked goods."
                icon={<Inventory2Icon fontSize="small" />}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Grid container spacing={2}>
                      <ModeCard
                        title="Quantity-based stock"
                        body="Opening qty, purchase in, sale out, balance."
                        active={form.track_inventory && !form.is_serialized && !form.is_batch_tracked}
                        disabled={form.type !== 'product'}
                        onChange={(checked) => setForm({
                          ...form, track_inventory: checked,
                          is_serialized: false, is_batch_tracked: false, serial_numbers: '',
                        })}
                      />
                      <ModeCard
                        title="Serial number stock"
                        body="Each unit has a unique serial."
                        active={form.is_serialized}
                        disabled={form.type !== 'product'}
                        onChange={(checked) => setForm({
                          ...form, is_serialized: checked, is_batch_tracked: false,
                          track_inventory: true, opening_stock: 0, opening_stock_value: 0,
                        })}
                      />
                      <ModeCard
                        title="Batch + expiry stock"
                        body="Track by batch, MFG date, expiry."
                        active={form.is_batch_tracked}
                        disabled={form.type !== 'product'}
                        onChange={(checked) => setForm({
                          ...form, is_batch_tracked: checked, is_serialized: false,
                          track_inventory: true, opening_stock: 0, opening_stock_value: 0,
                        })}
                      />
                    </Grid>
                  </Grid>
                  <Grid item xs={12} md={3}><TextField fullWidth type="number" label="Min stock level" value={form.min_stock_level} onChange={set('min_stock_level')} /></Grid>
                  <Grid item xs={12} md={3}><TextField fullWidth type="number" label="Max stock level" value={form.max_stock_level} onChange={set('max_stock_level')} /></Grid>
                  <Grid item xs={12} md={3}><TextField fullWidth type="number" label="Reorder qty" value={form.reorder_qty} onChange={set('reorder_qty')} /></Grid>
                  <Grid item xs={12} md={3}><TextField fullWidth type="number" label="Reorder alert level" value={form.reorder_level} onChange={set('reorder_level')} /></Grid>
                  {!form.is_serialized && form.track_inventory && (
                    <>
                      {!form.is_batch_tracked && (
                        <>
                          <Grid item xs={12} md={3}><TextField fullWidth type="number" label="Opening stock" value={form.opening_stock} onChange={set('opening_stock')} /></Grid>
                          <Grid item xs={12} md={3}><TextField fullWidth type="number" label="Opening value" value={form.opening_stock_value} onChange={set('opening_stock_value')} /></Grid>
                        </>
                      )}
                      <Grid item xs={12} md={3}>
                        <TextField fullWidth type="date" label="Opening date" value={form.opening_stock_date || ''} onChange={set('opening_stock_date')} InputLabelProps={{ shrink: true }} />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField select fullWidth label="Opening branch" value={form.opening_branch || ''} onChange={setOpeningBranch}>
                          <MenuItem value="">Default branch</MenuItem>
                          {branches.map((b: any) => <MenuItem key={b.id} value={b.id}>{b.code} - {b.name}</MenuItem>)}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField select fullWidth label="Opening warehouse" value={form.opening_warehouse || ''} onChange={set('opening_warehouse')}>
                          <MenuItem value="">Default warehouse</MenuItem>
                          {openingWarehouses.map((w: any) => <MenuItem key={w.id} value={w.id}>{w.code} - {w.name}</MenuItem>)}
                        </TextField>
                      </Grid>
                    </>
                  )}
                  {form.type !== 'product' && (
                    <Grid item xs={12}>
                      <Alert severity="info">Services do not track inventory or serial numbers.</Alert>
                    </Grid>
                  )}
                </Grid>
              </Section>
            </Box>

            {/* Step 3 - Tracking */}
            {activeStep === 3 && form.is_serialized && (
              <Section title="Opening serial stock" helper="Optional — paste serials, auto-generate or upload CSV."
                icon={<QrCodeScannerIcon fontSize="small" />}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}><TextField fullWidth label="Auto prefix" value={form.serial_auto_prefix} onChange={set('serial_auto_prefix')} /></Grid>
                  <Grid item xs={12} md={2}><TextField fullWidth type="number" label="Start" value={form.serial_auto_start} onChange={set('serial_auto_start')} /></Grid>
                  <Grid item xs={12} md={2}><TextField fullWidth type="number" label="Count" value={form.serial_auto_count} onChange={set('serial_auto_count')} /></Grid>
                  <Grid item xs={12} md={2}><TextField fullWidth type="number" label="Padding" value={form.serial_auto_padding} onChange={set('serial_auto_padding')} /></Grid>
                  <Grid item xs={12} md={3}>
                    <Button fullWidth variant="outlined" onClick={generateSerialRows} sx={{ height: '100%' }}>Auto generate</Button>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Branch" value={form.serial_branch || ''} onChange={setSerialBranch}>
                      <MenuItem value="">Select branch</MenuItem>
                      {branches.map((b: any) => <MenuItem key={b.id} value={b.id}>{b.code} - {b.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Warehouse" value={form.serial_warehouse || ''} onChange={set('serial_warehouse')}>
                      <MenuItem value="">Select warehouse</MenuItem>
                      {filteredWarehouses.map((w: any) => (
                        <MenuItem key={w.id} value={w.id}>{w.code} - {w.name}{w.branch_name ? ` (${w.branch_name})` : ''}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
                      <Button fullWidth startIcon={<UploadFileIcon />} variant="outlined"
                        onClick={() => fileRef.current?.click()}>
                        Upload CSV
                      </Button>
                      <input ref={fileRef} hidden type="file" accept=".csv,text/csv"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) importSerialCsv(f);
                          e.target.value = '';
                        }} />
                    </Stack>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth multiline minRows={6} label="Serial numbers"
                      value={form.serial_numbers} onChange={set('serial_numbers')}
                      placeholder={'SN-001\nSN-002\nSN-003'}
                      helperText={`${serialCount} serial number(s). Paste one per line or comma-separated. CSV first column is supported.`} />
                  </Grid>
                  {duplicateSerials.length > 0 && (
                    <Grid item xs={12}>
                      <Alert severity="error">
                        Duplicate serials: {duplicateSerials.slice(0, 8).join(', ')}
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </Section>
            )}

            {activeStep === 3 && form.is_batch_tracked && (
              <Section title="Opening batch + expiry stock" helper="Add one or more opening batches with qty, MFG and expiry."
                icon={<Inventory2Icon fontSize="small" />}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Batch branch" value={form.batch_branch || ''} onChange={setBatchBranch}>
                      <MenuItem value="">Select branch</MenuItem>
                      {branches.map((b: any) => <MenuItem key={b.id} value={b.id}>{b.code} - {b.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField select fullWidth label="Batch warehouse" value={form.batch_warehouse || ''} onChange={set('batch_warehouse')}>
                      <MenuItem value="">Select warehouse</MenuItem>
                      {batchWarehouses.map((w: any) => (
                        <MenuItem key={w.id} value={w.id}>{w.code} - {w.name}{w.branch_name ? ` (${w.branch_name})` : ''}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Button fullWidth variant="outlined" onClick={addBatchRow} sx={{ height: '100%' }}>Add batch row</Button>
                  </Grid>
                  {(form.batches || []).map((row: any, i: number) => (
                    <Grid item xs={12} key={i}>
                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Grid container spacing={1.5} alignItems="center">
                          <Grid item xs={12} md={3}>
                            <TextField fullWidth label="Batch number" value={row.batch_number}
                              onChange={(e) => updateBatch(i, 'batch_number', e.target.value)} />
                          </Grid>
                          <Grid item xs={12} md={2}>
                            <TextField fullWidth type="number" label="Qty" value={row.qty_available}
                              onChange={(e) => updateBatch(i, 'qty_available', e.target.value)} />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <TextField fullWidth type="date" label="MFG date" value={row.mfg_date || ''}
                              onChange={(e) => updateBatch(i, 'mfg_date', e.target.value)} InputLabelProps={{ shrink: true }} />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <TextField fullWidth type="date" label="Expiry date" value={row.expiry_date || ''}
                              onChange={(e) => updateBatch(i, 'expiry_date', e.target.value)} InputLabelProps={{ shrink: true }} />
                          </Grid>
                          <Grid item xs={12} md={1}>
                            <IconButton onClick={() => removeBatchRow(i)} disabled={(form.batches || []).length === 1}>
                              <DeleteIcon />
                            </IconButton>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Section>
            )}

            {activeStep === 3 && !form.is_serialized && !form.is_batch_tracked && (
              <Alert severity="info">
                Quantity-based items don't need serials or batches. You can save the item now.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setActiveStep((s) => Math.max(s - 1, 0))} disabled={saving || activeStep === 0}>
            Back
          </Button>
          {activeStep < STEPS.length - 1 ? (
            <Button variant="contained" onClick={() => setActiveStep((s) => Math.min(s + 1, STEPS.length - 1))}>
              Next
            </Button>
          ) : (
            <Button onClick={save} variant="contained" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update item' : 'Save item'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Inline category/unit creation */}
      <Dialog open={!!masterKind} onClose={closeMaster} maxWidth="xs" fullWidth>
        <DialogTitle>
          {masterKind === 'unit' ? 'Create unit'
            : masterKind === 'subcategory' ? 'Create subcategory'
            : 'Create category'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {masterKind === 'subcategory' && (
              <Alert severity="info">
                Parent category: {categoryById.get(form.category)?.name || 'Selected category'}
              </Alert>
            )}
            <TextField autoFocus fullWidth
              label={masterKind === 'unit' ? 'Unit name' : 'Name'}
              value={masterForm.name}
              onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })} />
            <TextField fullWidth
              label={masterKind === 'unit' ? 'Unit code' : 'Code'}
              value={masterForm.code}
              onChange={(e) => setMasterForm({ ...masterForm, code: e.target.value })}
              helperText={masterKind === 'unit' ? 'Example: PCS, KG, BOX' : 'Optional reporting code'} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMaster}>Cancel</Button>
          <Button variant="contained" onClick={saveMaster}>Create</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ModeCard({ title, body, active, disabled, onChange }: {
  title: string; body: string; active: boolean; disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Grid item xs={12} md={4}>
      <Paper variant="outlined" sx={{
        p: 2, height: '100%',
        borderColor: active ? 'primary.main' : 'divider',
        bgcolor: active ? 'rgba(30,136,229,0.08)' : 'background.paper',
      }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="subtitle2">{title}</Typography>
            <Typography variant="body2" color="text.secondary">{body}</Typography>
          </Box>
          <Switch checked={active} disabled={disabled}
            onChange={(e) => onChange(e.target.checked)} />
        </Stack>
      </Paper>
    </Grid>
  );
}

function Section({ title, helper, icon, children }: {
  title: string; helper: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
      <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ mb: 2 }}>
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
