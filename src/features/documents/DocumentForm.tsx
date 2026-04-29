/**
 * Generic create/edit form used by Estimate, Sales Order, Delivery Challan,
 * and Purchase Order routes. Brought to parity with InvoiceForm / BillForm:
 *
 *   • page_size=1000 + is_active=true on /items/ + /parties/ so big catalogues
 *     don't get silently truncated to 25
 *   • two-stage Autocomplete value (master row → item_name fallback) so
 *     archived items still render their saved name
 *   • last-sold-to / last-bought-from auto-fill of rate when both party and
 *     item are picked, with a small "↻ Last ₹X · DD MMM" badge
 *   • ChargesSection (skipped on Delivery Challan since it has no totals)
 *   • Live totals preview that recomputes on every keystroke; inter-state
 *     vs intra-state derived from the loaded doc's IGST when present
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, Grid, IconButton, Paper, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '@/app/api';
import { lineTotal } from '@/utils/money';
import { computeDocumentTotals, fmt } from '@/utils/computeDocumentTotals';
import { notify } from '@/components/Notifier';
import {
  fetchLastBoughtFrom, fetchLastSoldTo, type LastPriceHint,
} from '@/features/items/lastPrice';
import ChargesSection, { type ChargeRow } from '@/features/charges/ChargesSection';

type Line = {
  item: string;
  item_name?: string;
  description: string;
  hsn_code: string;
  quantity: number | string;
  rate: number | string;
  discount?: number | string;
  tax_rate: number | string;
  total?: string;
  _lastHint?: LastPriceHint;
};

const BLANK_LINE: Line = {
  item: '', item_name: '',
  description: '', hsn_code: '',
  quantity: 1, rate: 0, discount: 0, tax_rate: 18,
};

type ActionConfig = {
  label: string;
  endpoint: string;
  navigateTo?: (data: any) => string;
};

type Props = {
  title: string;
  endpoint: string;
  backPath: string;
  partyRole: 'customer' | 'supplier';
  docKind: 'purchase_order' | 'estimate' | 'sales_order' | 'delivery_challan';
};

const describeError = (e: any) =>
  e?.response?.data?.detail
  || (e?.response?.data && JSON.stringify(e.response.data))
  || e?.message
  || 'Failed to save document';

export default function DocumentForm({ title, endpoint, backPath, partyRole, docKind }: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [party, setParty] = useState<any>(null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [secondaryDate, setSecondaryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ ...BLANK_LINE }]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [saved, setSaved] = useState<any>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const isDeliveryChallan = docKind === 'delivery_challan';
  const secondaryDateLabel = docKind === 'purchase_order' || docKind === 'sales_order'
    ? 'Expected date'
    : docKind === 'estimate'
      ? 'Expiry date'
      : '';

  // The polymorphic charges table keys parents by these strings.
  const chargesParentKey: 'estimate' | 'sales_order' | 'purchase_order' | null =
    docKind === 'estimate' ? 'estimate'
    : docKind === 'sales_order' ? 'sales_order'
    : docKind === 'purchase_order' ? 'purchase_order'
    : null; // delivery challan has no totals → no charges UI

  useEffect(() => {
    Promise.all([
      api.get('/parties/', { params: { page_size: 1000 } }),
      api.get('/items/', { params: { page_size: 1000, is_active: true } }),
      api.get('/taxes/rates/').catch(() => ({ data: [] })),
      id ? api.get(`${endpoint}${id}/`) : Promise.resolve(null),
    ]).then(([partyRes, itemRes, taxRes, docRes]) => {
      const allParties = partyRes.data.results ?? partyRes.data;
      setParties(allParties.filter((p: any) => p.type === partyRole || p.type === 'both'));
      setItems(itemRes.data.results ?? itemRes.data);
      setTaxRates(taxRes?.data?.results ?? taxRes?.data ?? []);
      if (!docRes) return;
      const doc = docRes.data;
      setSaved(doc);
      setDate(doc.date);
      setNotes(doc.notes || '');
      setLines(doc.lines?.length ? doc.lines : [{ ...BLANK_LINE }]);
      setParty({ id: doc.party, name: doc.party_name });
      setSecondaryDate(doc.expected_date || doc.expiry_date || '');
      setCharges((doc.charges_data || []).map((c: any) => ({
        id: c.id,
        template: c.template,
        template_name: c.template_name,
        label: c.label,
        amount: Number(c.amount),
        tax_rate: Number(c.tax_rate),
        apply_before_tax: c.apply_before_tax,
        sequence: c.sequence,
      })));
    }).catch((e) => setErr(describeError(e)));
  }, [id, endpoint, partyRole]);

  const actions: ActionConfig[] = useMemo(() => {
    if (!saved?.id) return [];
    if (docKind === 'purchase_order') {
      return [
        { label: 'Submit', endpoint: `${endpoint}${saved.id}/submit/` },
        { label: 'Approve', endpoint: `${endpoint}${saved.id}/approve/` },
        { label: 'Convert to Bill', endpoint: `${endpoint}${saved.id}/convert-to-bill/`, navigateTo: (data) => `/purchases/bills/${data.id}` },
      ];
    }
    if (docKind === 'estimate') {
      return [
        { label: 'Send', endpoint: `${endpoint}${saved.id}/send/` },
        { label: 'Accept', endpoint: `${endpoint}${saved.id}/accept/` },
        { label: 'Convert to Sales Order', endpoint: `${endpoint}${saved.id}/convert-to-sales-order/`, navigateTo: (data) => `/sales/orders/${data.id}` },
      ];
    }
    if (docKind === 'sales_order') {
      return [
        { label: 'Confirm', endpoint: `${endpoint}${saved.id}/confirm/` },
        { label: 'Convert to Delivery Challan', endpoint: `${endpoint}${saved.id}/convert-to-delivery-challan/`, navigateTo: (data) => `/sales/delivery-challans/${data.id}` },
      ];
    }
    if (docKind === 'delivery_challan') {
      return [
        { label: 'Issue Challan', endpoint: `${endpoint}${saved.id}/issue/` },
        { label: 'Convert to Invoice', endpoint: `${endpoint}${saved.id}/convert-to-invoice/`, navigateTo: (data) => `/sales/invoices/${data.id}` },
      ];
    }
    return [];
  }, [docKind, endpoint, saved]);

  const taxRateValue = (taxRateId: string | null | undefined) => {
    if (!taxRateId) return 0;
    return Number(taxRates.find((rate) => rate.id === taxRateId)?.rate ?? 0);
  };

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addLine = () => setLines((prev) => [...prev, { ...BLANK_LINE }]);
  const deleteLine = (idx: number) => setLines((prev) => prev.filter((_, index) => index !== idx));

  const onPickItem = (idx: number, value: any) => {
    const masterRate = partyRole === 'supplier'
      ? Number(value?.purchase_price ?? 0)
      : Number(value?.sale_price ?? 0);
    updateLine(idx, {
      item: value?.id || '',
      item_name: value?.name || '',
      rate: masterRate,
      tax_rate: taxRateValue(value?.tax_rate),
      hsn_code: value?.hsn_code || '',
      _lastHint: undefined,
    });
    // Auto-fill from history if both party and item are set.
    if (value?.id && party?.id) {
      const fetcher = partyRole === 'supplier' ? fetchLastBoughtFrom : fetchLastSoldTo;
      fetcher(value.id, party.id)
        .then((res) => {
          if (!res.found) return;
          updateLine(idx, {
            rate: Number(res.rate),
            _lastHint: {
              rate: Number(res.rate),
              date: res.date,
              docNumber: res.invoice_number || res.bill_number,
            },
          });
          notify({
            severity: 'info',
            message: `${partyRole === 'supplier' ? 'Last bought from' : 'Last sold to'} ${party.name || 'this party'} at ₹${Number(res.rate).toLocaleString('en-IN')} on ${dayjs(res.date).format('DD MMM YY')}`,
          });
        })
        .catch(() => { /* silent — fallback to master */ });
    }
  };

  const payload = () => {
    const body: any = {
      party: party?.id,
      date,
      notes,
      lines: lines.filter((line) => line.item).map((line) => ({
        item: line.item,
        description: line.description || '',
        hsn_code: line.hsn_code || '',
        quantity: Number(line.quantity || 0),
        rate: Number(line.rate || 0),
        tax_rate: Number(line.tax_rate || 0),
        ...(isDeliveryChallan ? {} : { discount: Number(line.discount || 0) }),
      })),
    };
    if (chargesParentKey) {
      body.charges = charges
        .filter((c) => c.label.trim() && Number(c.amount) > 0)
        .map((c, i) => ({
          template: c.template || null,
          label: c.label.trim(),
          amount: Number(c.amount),
          tax_rate: Number(c.tax_rate),
          apply_before_tax: !!c.apply_before_tax,
          sequence: i,
        }));
    }
    if (docKind === 'purchase_order' || docKind === 'sales_order') body.expected_date = secondaryDate || null;
    if (docKind === 'estimate') body.expiry_date = secondaryDate || null;
    return body;
  };

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      if (!party) throw new Error(`Select a ${partyRole === 'supplier' ? 'supplier' : 'customer'}`);
      const body = payload();
      if (!body.lines.length) throw new Error('Add at least one item line');
      const doc = saved
        ? (await api.put(`${endpoint}${saved.id}/`, body)).data
        : (await api.post(endpoint, body)).data;
      setSaved(doc);
      setLines(doc.lines?.length ? doc.lines : lines);
      setCharges((doc.charges_data || []).map((c: any) => ({
        id: c.id, template: c.template, template_name: c.template_name,
        label: c.label, amount: Number(c.amount), tax_rate: Number(c.tax_rate),
        apply_before_tax: c.apply_before_tax, sequence: c.sequence,
      })));
    } catch (e: any) {
      setErr(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: ActionConfig) => {
    try {
      setErr('');
      const { data } = await api.post(action.endpoint, {});
      if (action.navigateTo) {
        nav(action.navigateTo(data));
        return;
      }
      setSaved(data);
      setLines(data.lines?.length ? data.lines : lines);
      setCharges((data.charges_data || []).map((c: any) => ({
        id: c.id, template: c.template, template_name: c.template_name,
        label: c.label, amount: Number(c.amount), tax_rate: Number(c.tax_rate),
        apply_before_tax: c.apply_before_tax, sequence: c.sequence,
      })));
    } catch (e: any) {
      setErr(describeError(e));
    }
  };

  // Live subtotal of line items only — feeds the ChargesSection % calc.
  const linesSubtotal = useMemo(
    () => lines.reduce(
      (acc, l) => acc + Math.max(0, Number(l.quantity || 0) * Number(l.rate || 0) - Number(l.discount || 0)),
      0,
    ),
    [lines],
  );

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">{saved ? `${title} ${saved.number || ''}` : `New ${title}`}</Typography>
          <Typography variant="body2" color="text.secondary">
            Create, save draft, and run conversion workflow actions from this screen.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {saved?.status && <Chip label={String(saved.status).replaceAll('_', ' ')} />}
          <Button onClick={() => nav(backPath)}>Back</Button>
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Autocomplete
              options={parties}
              getOptionLabel={(option) => option.name || ''}
              value={party}
              onChange={(_, value) => setParty(value)}
              renderInput={(params) => <TextField {...params} label={partyRole === 'supplier' ? 'Supplier' : 'Customer'} required />}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth type="date" label="Date" value={date}
              onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          {secondaryDateLabel && (
            <Grid item xs={12} md={3}>
              <TextField fullWidth type="date" label={secondaryDateLabel} value={secondaryDate}
                onChange={(e) => setSecondaryDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
          )}
        </Grid>
      </Paper>

      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell>HSN</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Rate</TableCell>
              {!isDeliveryChallan && <TableCell align="right">Disc</TableCell>}
              <TableCell align="right">GST %</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((line, index) => (
              <TableRow key={index}>
                <TableCell sx={{ minWidth: 240 }}>
                  <Autocomplete
                    options={items}
                    getOptionLabel={(option: any) => (option?.name ? `${option.sku ? option.sku + ' · ' : ''}${option.name}` : '')}
                    size="small"
                    // Two-stage value resolution: master list first, fall back
                    // to a synthetic stub from the line's own item_name so
                    // archived / removed items still render their saved name.
                    value={
                      items.find((item) => item.id === line.item)
                      || (line.item ? { id: line.item, name: line.item_name || '(deleted item)' } : null)
                    }
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    onChange={(_, value: any) => onPickItem(index, value)}
                    renderInput={(params) => <TextField {...params} placeholder="Pick item" />}
                  />
                </TableCell>
                <TableCell><TextField size="small" value={line.hsn_code || ''} onChange={(e) => updateLine(index, { hsn_code: e.target.value })} /></TableCell>
                <TableCell align="right"><TextField size="small" type="number" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} sx={{ width: 80 }} /></TableCell>
                <TableCell align="right">
                  <Stack alignItems="flex-end" spacing={0.25}>
                    <TextField size="small" type="number" value={line.rate}
                      onChange={(e) => updateLine(index, { rate: Number(e.target.value), _lastHint: undefined })}
                      sx={{ width: 100 }} />
                    {line._lastHint && (
                      <Chip
                        size="small" icon={<HistoryIcon sx={{ fontSize: 12 }} />}
                        label={`Last ₹${line._lastHint.rate.toLocaleString('en-IN')} · ${dayjs(line._lastHint.date).format('DD MMM')}`}
                        sx={{
                          height: 18, fontSize: 10, fontWeight: 600,
                          color: 'primary.main',
                          bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(79,195,247,0.14)' : 'rgba(79,195,247,0.10)',
                        }}
                      />
                    )}
                  </Stack>
                </TableCell>
                {!isDeliveryChallan && (
                  <TableCell align="right"><TextField size="small" type="number" value={line.discount || 0} onChange={(e) => updateLine(index, { discount: Number(e.target.value) })} sx={{ width: 90 }} /></TableCell>
                )}
                <TableCell align="right"><TextField size="small" type="number" value={line.tax_rate || 0} onChange={(e) => updateLine(index, { tax_rate: Number(e.target.value) })} sx={{ width: 80 }} /></TableCell>
                <TableCell align="right">{line.total || lineTotal(Number(line.quantity || 0), Number(line.rate || 0), Number(line.discount || 0))}</TableCell>
                <TableCell><IconButton size="small" onClick={() => deleteLine(index)} disabled={lines.length === 1}><DeleteIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ p: 1 }}>
          <Button size="small" startIcon={<AddIcon />} onClick={addLine}>Add line</Button>
        </Box>
      </Paper>

      {/* Extra charges — skipped for Delivery Challan (no totals on that doc). */}
      {chargesParentKey && (
        <ChargesSection
          side={partyRole === 'supplier' ? 'purchase' : 'sales'}
          rows={charges}
          onChange={setCharges}
          subtotal={linesSubtotal}
        />
      )}

      <Grid container spacing={2} sx={{ mt: chargesParentKey ? 0 : 0 }}>
        <Grid item xs={12} md={7}>
          <TextField fullWidth multiline minRows={3} label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Grid>
        {!isDeliveryChallan && (
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2 }}>
              <Stack spacing={0.5}>
                {/* Live preview — same math as the backend; recomputes on
                    every keystroke. Inter-state derived from saved IGST. */}
                {(() => {
                  const interState = Number(saved?.igst_total ?? 0) > 0;
                  const t = computeDocumentTotals(
                    lines.map((l) => ({
                      quantity: l.quantity, rate: l.rate,
                      discount: l.discount, tax_rate: l.tax_rate,
                    })),
                    charges.map((c) => ({
                      amount: c.amount, tax_rate: c.tax_rate,
                      apply_before_tax: c.apply_before_tax,
                    })),
                    interState,
                  );
                  return (
                    <>
                      <Row label="Subtotal" value={fmt(t.subtotal)} />
                      <Row label="CGST" value={fmt(t.cgst)} />
                      <Row label="SGST" value={fmt(t.sgst)} />
                      <Row label="IGST" value={fmt(t.igst)} />
                      <Row label="Grand Total" value={fmt(t.grand)} bold />
                    </>
                  );
                })()}
                <Typography variant="caption" color="text.secondary"
                  sx={{ pt: 0.5, textAlign: 'right' }}>
                  Live · server reconciles on save
                </Typography>
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 3 }}>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Update Draft' : 'Save Draft'}
        </Button>
        {actions.map((action) => (
          <Button key={action.label} variant="outlined" onClick={() => runAction(action)} disabled={!saved || saving}>
            {action.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}

function Row({ label, value, bold = false }: { label: string; value?: string; bold?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
      <Typography variant={bold ? 'subtitle1' : 'body2'}>{label}</Typography>
      <Typography variant={bold ? 'subtitle1' : 'body2'}>{value ?? '0.00'}</Typography>
    </Stack>
  );
}
