/**
 * Reusable "Charges" panel for sales / purchase document forms.
 *
 *   Subtotal …             ₹10,000
 *   + Freight       ₹500   (taxable, GST 18%)
 *   + Insurance     ₹100   (taxable, GST 18%)
 *   + Loading       ₹200   (post-tax, no GST)
 *   ──────────────────────────────────────
 *   Grand total     ₹...
 *
 * The parent form owns the `charges` array (so it can save it alongside
 * lines). This component just renders the table + toolbar + maintains
 * the order. Each row is one of:
 *   - Picked from a master template (label is editable, all other fields
 *     hydrated from the template — user can override).
 *   - Custom ("Add custom charge" button) — fully blank.
 *
 * Use side="sales" on InvoiceForm, side="purchase" on BillForm. The
 * dropdown is filtered by the matching `applies_to_*` flag.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, ButtonGroup, Chip, IconButton, Menu, MenuItem, Paper,
  Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography, alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalShippingIcon from '@mui/icons-material/LocalShippingOutlined';
import { api } from '@/app/api';
import MoneyDisplay from '@/components/MoneyDisplay';

const num = (v: any) => Number(v || 0);

export type ChargeRow = {
  id?: string;
  template?: string | null;
  template_name?: string;
  label: string;
  amount: number;
  tax_rate: number;
  apply_before_tax: boolean;
  sequence?: number;
  // Server-computed; ignored on write.
  taxable?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
};

type Template = {
  id: string;
  code: string;
  name: string;
  type: 'fixed' | 'percent';
  default_value: string;
  apply_before_tax: boolean;
  tax_rate: string | null;
  tax_rate_value: string | null;
};

type Props = {
  side: 'sales' | 'purchase';
  rows: ChargeRow[];
  onChange: (rows: ChargeRow[]) => void;
  // Subtotal of line items (pre-charge). Used to compute % charges.
  subtotal: number;
  // For preview only — the live numbers come from the server on save.
  estimatedTax?: { gst?: number };
};

export default function ChargesSection({ side, rows, onChange, subtotal }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pickerAnchor, setPickerAnchor] = useState<null | HTMLElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get<Template[] | { results: Template[] }>('/charges/templates/', {
      params: { is_active: true, side, page_size: 100 },
    })
      .then((r) => {
        const list = (Array.isArray(r.data) ? r.data : r.data.results) || [];
        setTemplates(list);
      })
      .catch((e) => setErr(e?.response?.data?.detail || 'Failed to load charge templates'));
  }, [side]);

  // Push a new row from a template — pre-fill what the template suggests so
  // the user only has to type the value if they don't like the default.
  const addFromTemplate = (t: Template) => {
    const isPct = t.type === 'percent';
    const amount = isPct
      ? +(num(subtotal) * num(t.default_value) / 100).toFixed(2)
      : num(t.default_value);
    onChange([...rows, {
      template: t.id,
      template_name: t.name,
      label: t.name,
      amount,
      tax_rate: num(t.tax_rate_value),
      apply_before_tax: t.apply_before_tax,
      sequence: rows.length,
    }]);
    setPickerAnchor(null);
  };

  const addCustom = () => {
    onChange([...rows, {
      label: '',
      amount: 0,
      tax_rate: 0,
      apply_before_tax: false,
      sequence: rows.length,
    }]);
    setPickerAnchor(null);
  };

  const updateRow = (i: number, patch: Partial<ChargeRow>) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    onChange(next);
  };

  const removeRow = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i)
      .map((r, idx) => ({ ...r, sequence: idx }));
    onChange(next);
  };

  // Filter templates not already added (allow re-add of same template,
  // but show used ones with a checkmark hint).
  const used = useMemo(() => new Set(rows.filter((r) => r.template).map((r) => r.template)), [rows]);

  // Live preview of what these charges add to subtotal/tax/grand.
  const preview = useMemo(() => {
    let preTax = 0, postTax = 0, gstOnCharges = 0;
    rows.forEach((r) => {
      const amt = num(r.amount);
      if (amt <= 0) return;
      if (r.apply_before_tax) {
        preTax += amt;
        gstOnCharges += amt * num(r.tax_rate) / 100;
      } else {
        postTax += amt;
      }
    });
    return { preTax, postTax, gstOnCharges, total: preTax + postTax + gstOnCharges };
  }, [rows]);

  return (
    <Paper variant="outlined" sx={{ mt: 2, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" spacing={1}
        sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider',
          bgcolor: (t) => alpha(t.palette.text.primary, 0.02) }}>
        <LocalShippingIcon fontSize="small" sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Extra charges
        </Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 0 && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip size="small" label={`+ ${rows.length} ${rows.length === 1 ? 'charge' : 'charges'}`}
              sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
            {preview.total > 0 && (
              <Chip size="small" label={`adds ₹${preview.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                color="primary" sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
            )}
          </Stack>
        )}
        <Button size="small" startIcon={<AddIcon />}
          onClick={(e) => setPickerAnchor(e.currentTarget)}>
          Add charge
        </Button>
        <Menu anchorEl={pickerAnchor} open={!!pickerAnchor}
          onClose={() => setPickerAnchor(null)}>
          {templates.length === 0 && (
            <MenuItem disabled>
              <Typography variant="caption">
                No templates yet. Add some in Settings → Charges.
              </Typography>
            </MenuItem>
          )}
          {templates.map((t) => (
            <MenuItem key={t.id} onClick={() => addFromTemplate(t)}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                <Typography variant="body2" sx={{ flex: 1 }}>{t.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.type === 'percent' ? `${t.default_value}%` : `₹${t.default_value}`}
                  {' · '}
                  {t.apply_before_tax ? `${t.tax_rate_value || 0}% GST` : 'No GST'}
                </Typography>
                {used.has(t.id) && <Typography variant="caption" color="primary.main">·</Typography>}
              </Stack>
            </MenuItem>
          ))}
          <MenuItem divider sx={{ borderTop: 1, borderColor: 'divider' }} disabled />
          <MenuItem onClick={addCustom}>
            <AddIcon fontSize="small" sx={{ mr: 1.5 }} />
            <Typography variant="body2">Custom charge…</Typography>
          </MenuItem>
        </Menu>
      </Stack>

      {err && <Alert severity="error" sx={{ m: 1.5, mb: 0 }}>{err}</Alert>}

      {rows.length === 0 ? (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            No extra charges on this document.
          </Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 220 }}>Label</TableCell>
              <TableCell align="right" sx={{ width: 120 }}>Amount</TableCell>
              <TableCell align="center" sx={{ width: 110 }}>
                <Tooltip title="Charge value goes into the document's taxable value (and gets taxed at the GST rate below). If off, the amount is added flat to the grand total — no GST.">
                  <span>Taxable?</span>
                </Tooltip>
              </TableCell>
              <TableCell align="right" sx={{ width: 100 }}>GST %</TableCell>
              <TableCell align="right">Adds</TableCell>
              <TableCell sx={{ width: 50 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => {
              const taxOnRow = r.apply_before_tax ? num(r.amount) * num(r.tax_rate) / 100 : 0;
              const adds = num(r.amount) + taxOnRow;
              return (
                <TableRow key={i}>
                  <TableCell>
                    <TextField
                      size="small" fullWidth
                      placeholder="e.g. Labour"
                      value={r.label}
                      onChange={(e) => updateRow(i, { label: e.target.value })}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small" type="number"
                      value={r.amount}
                      onChange={(e) => updateRow(i, { amount: num(e.target.value) })}
                      inputProps={{ min: 0, step: '0.01', style: { textAlign: 'right' } }}
                      sx={{ width: 110 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      size="small"
                      checked={r.apply_before_tax}
                      onChange={(e) => updateRow(i, { apply_before_tax: e.target.checked })}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small" type="number"
                      value={r.tax_rate}
                      onChange={(e) => updateRow(i, { tax_rate: num(e.target.value) })}
                      disabled={!r.apply_before_tax}
                      inputProps={{ min: 0, max: 28, step: '0.01', style: { textAlign: 'right' } }}
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <MoneyDisplay value={adds} fractionDigits={2} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeRow(i)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Preview footer */}
      {rows.length > 0 && (
        <Stack direction="row" spacing={1.5} sx={{
          px: 1.5, py: 1, borderTop: 1, borderColor: 'divider',
          bgcolor: (t) => alpha(t.palette.text.primary, 0.02),
        }} flexWrap="wrap" useFlexGap>
          <Typography variant="caption" color="text.secondary">Preview:</Typography>
          {preview.preTax > 0 && (
            <Typography variant="caption">
              Taxable charges <strong>₹{preview.preTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
            </Typography>
          )}
          {preview.gstOnCharges > 0 && (
            <Typography variant="caption">
              GST on charges <strong>₹{preview.gstOnCharges.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
            </Typography>
          )}
          {preview.postTax > 0 && (
            <Typography variant="caption">
              Flat add <strong>₹{preview.postTax.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            + ₹{preview.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}
