import { useEffect, useState } from 'react';
import {
  Box, Button, Chip, Grid, IconButton, Paper, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography, Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '@/app/api';
import { formatApiError } from '@/app/errors';
import { lineTotal } from '@/utils/money';
import Suggest, { SuggestResult } from '@/components/Suggest';
import { fetchLastSoldTo, type LastPriceHint } from '@/features/items/lastPrice';
import { notify } from '@/components/Notifier';
import dayjsAlias from 'dayjs';
import HistoryIcon from '@mui/icons-material/History';
import ChargesSection, { type ChargeRow } from '@/features/charges/ChargesSection';
import { computeDocumentTotals, fmt } from '@/utils/computeDocumentTotals';

type Line = {
  item: string; item_name?: string; description: string; hsn_code: string;
  quantity: number; rate: number; discount: number; tax_rate: number;
  taxable?: string; cgst?: string; sgst?: string; igst?: string; total?: string;
  // Memo of the last-sold rate for this (item, party) pair. Cleared when
  // the user manually edits the rate cell — we don't want to imply the
  // typed value came from history.
  _lastHint?: LastPriceHint;
};

const BLANK_LINE: Line = {
  item: '', description: '', hsn_code: '',
  quantity: 1, rate: 0, discount: 0, tax_rate: 18,
};

export default function InvoiceForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [party, setParty] = useState<SuggestResult | null>(null);
  const [hydratePartyId, setHydratePartyId] = useState<string | null>(null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [dueDate, setDueDate] = useState(dayjs().add(30, 'day').format('YYYY-MM-DD'));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ ...BLANK_LINE }]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState<any>(null);

  const describeError = (e: unknown) => formatApiError(e, 'Failed to load invoice');

  useEffect(() => {
    Promise.all([
      api.get('/taxes/rates/').catch(() => ({ data: [] })),
      id ? api.get(`/sales/invoices/${id}/`) : Promise.resolve(null),
    ]).then(([taxRes, invoiceRes]) => {
      setTaxRates(taxRes?.data?.results ?? taxRes?.data ?? []);
      if (!invoiceRes) return;
      const d = invoiceRes.data;
      setSaved(d); setDate(d.date); setDueDate(d.due_date || '');
      setNotes(d.notes || ''); setLines(d.lines);
      setCharges((d.charges_data || []).map((c: any) => ({
        id: c.id, template: c.template, template_name: c.template_name,
        label: c.label, amount: Number(c.amount), tax_rate: Number(c.tax_rate),
        apply_before_tax: c.apply_before_tax, sequence: c.sequence,
      })));
      setTotals({
        subtotal: d.subtotal, cgst: d.cgst_total, sgst: d.sgst_total,
        igst: d.igst_total, grand: d.grand_total,
      });
      if (d.party) {
        setParty({ id: d.party, label: d.party_name || '' });
        setHydratePartyId(d.party);
      }
    }).catch((e) => setErr(describeError(e)));
  }, [id]);

  const taxRateValue = (taxRateId: string | null | undefined) => {
    if (!taxRateId) return 0;
    return Number(taxRates.find((rate) => rate.id === taxRateId)?.rate ?? 0);
  };

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => {
      const nl = prev.slice();
      nl[idx] = { ...nl[idx], ...patch };
      return nl;
    });
  };
  const addLine = () => setLines((prev) => [...prev, { ...BLANK_LINE }]);
  const delLine = (i: number) => setLines((prev) => prev.filter((_, ix) => ix !== i));

  const save = async (issue = false) => {
    setErr('');
    try {
      if (!party) { setErr('Select a party'); return; }
      const payload = {
        party: party.id, date, due_date: dueDate || null, notes,
        lines: lines.filter(l => l.item).map(l => ({
          item: l.item, description: l.description, hsn_code: l.hsn_code,
          quantity: Number(l.quantity), rate: Number(l.rate),
          discount: Number(l.discount), tax_rate: Number(l.tax_rate),
        })),
        charges: charges
          .filter((c) => c.label.trim() && Number(c.amount) > 0)
          .map((c, i) => ({
            template: c.template || null,
            label: c.label.trim(),
            amount: Number(c.amount),
            tax_rate: Number(c.tax_rate),
            apply_before_tax: !!c.apply_before_tax,
            sequence: i,
          })),
      };
      let invoice = saved
        ? (await api.put(`/sales/invoices/${saved.id}/`, payload)).data
        : (await api.post('/sales/invoices/', payload)).data;
      if (issue) {
        invoice = (await api.post(`/sales/invoices/${invoice.id}/issue/`)).data;
      }
      setSaved(invoice);
      setTotals({
        subtotal: invoice.subtotal, cgst: invoice.cgst_total, sgst: invoice.sgst_total,
        igst: invoice.igst_total, grand: invoice.grand_total,
      });
      if (issue) nav('/sales/invoices');
    } catch (e: any) {
      setErr(JSON.stringify(e?.response?.data) || 'Save failed');
    }
  };

  const openPdf = async () => {
    if (!saved) return;
    try {
      const res = await api.get(`/print/sales_invoice/${saved.id}/pdf/`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      setErr('Failed to open PDF');
    }
  };

  const openPrint = async () => {
    if (!saved) return;
    try {
      const res = await api.get(`/print/sales_invoice/${saved.id}/html/`, { responseType: 'text' });
      const w = window.open('', '_blank');
      if (!w) { setErr('Allow pop-ups to print'); return; }
      w.document.open();
      w.document.write(res.data);
      w.document.close();
      w.onload = () => { w.focus(); w.print(); };
    } catch {
      setErr('Failed to open print preview');
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>{saved ? `Invoice ${saved.number || ''}` : 'New Invoice'}</Typography>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Suggest
              entity="parties"
              label="Customer"
              required
              value={party}
              hydrateId={hydratePartyId}
              onChange={setParty}
              size="medium"
            />
            {party && (
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                {party.meta?.gstin && <Chip size="small" label={`GSTIN ${party.meta.gstin}`} />}
                {Number(party.meta?.outstanding ?? 0) > 0 && (
                  <Chip size="small" color="warning" label={`Outstanding ₹${Number(party.meta?.outstanding ?? 0).toLocaleString()}`} />
                )}
                {party.meta?.last_txn && <Chip size="small" variant="outlined" label={`Last: ${party.meta.last_txn}`} />}
              </Stack>
            )}
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={e => setDate(e.target.value)} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth type="date" label="Due" InputLabelProps={{ shrink: true }} value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </Grid>
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
              <TableCell align="right">Disc</TableCell>
              <TableCell align="right">GST %</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell sx={{ minWidth: 260 }}>
                  <Suggest
                    entity="items"
                    context={{ party_id: party?.id }}
                    value={l.item ? { id: l.item, label: l.item_name || '' } : null}
                    hydrateId={l.item || null}
                    placeholder="Pick item"
                    onChange={(v) => {
                      const fallbackRate = Number(v?.meta?.sale_price ?? 0);
                      updateLine(i, {
                        item: v?.id || '',
                        item_name: v?.label,
                        rate: fallbackRate,
                        tax_rate: v?.meta?.tax_rate != null
                          ? Number(v.meta.tax_rate)
                          : taxRateValue(v?.meta?.tax_rate_id),
                        hsn_code: v?.meta?.hsn_code || '',
                        _lastHint: undefined,
                      });
                      // If party + item are both set, override with the last
                      // rate this customer actually paid. Best-effort: if
                      // the call fails we just keep the master sale_price.
                      if (v?.id && party?.id) {
                        fetchLastSoldTo(v.id, party.id)
                          .then((res) => {
                            if (!res.found) return;
                            updateLine(i, {
                              rate: Number(res.rate),
                              _lastHint: {
                                rate: Number(res.rate),
                                date: res.date,
                                docNumber: res.invoice_number,
                              },
                            });
                            notify({
                              severity: 'info',
                              message: `Last sold to ${party.label || 'this party'} at ₹${Number(res.rate).toLocaleString('en-IN')} on ${dayjsAlias(res.date).format('DD MMM YY')}`,
                            });
                          })
                          .catch(() => { /* silent — fallback to master price */ });
                      }
                    }}
                  />
                </TableCell>
                <TableCell><TextField size="small" value={l.hsn_code} onChange={e => updateLine(i, { hsn_code: e.target.value })} /></TableCell>
                <TableCell align="right"><TextField size="small" type="number" value={l.quantity} onChange={e => updateLine(i, { quantity: Number(e.target.value) })} sx={{ width: 80 }} /></TableCell>
                <TableCell align="right">
                  <Stack alignItems="flex-end" spacing={0.25}>
                    <TextField size="small" type="number" value={l.rate}
                      onChange={e => updateLine(i, { rate: Number(e.target.value), _lastHint: undefined })}
                      sx={{ width: 100 }} />
                    {l._lastHint && (
                      <Chip
                        size="small" icon={<HistoryIcon sx={{ fontSize: 12 }} />}
                        label={`Last ₹${l._lastHint.rate.toLocaleString('en-IN')} · ${dayjsAlias(l._lastHint.date).format('DD MMM')}`}
                        sx={{ height: 18, fontSize: 10, fontWeight: 600,
                          color: 'primary.main', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(79,195,247,0.14)' : 'rgba(79,195,247,0.10)' }}
                      />
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right"><TextField size="small" type="number" value={l.discount} onChange={e => updateLine(i, { discount: Number(e.target.value) })} sx={{ width: 90 }} /></TableCell>
                <TableCell align="right"><TextField size="small" type="number" value={l.tax_rate} onChange={e => updateLine(i, { tax_rate: Number(e.target.value) })} sx={{ width: 80 }} /></TableCell>
                <TableCell align="right">{l.total || lineTotal(l.quantity, l.rate, l.discount)}</TableCell>
                <TableCell><IconButton size="small" onClick={() => delLine(i)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ p: 1 }}>
          <Button size="small" startIcon={<AddIcon />} onClick={addLine}>Add line</Button>
        </Box>
      </Paper>

      <ChargesSection
        side="sales"
        rows={charges}
        onChange={setCharges}
        // Use the live line subtotal so "% of subtotal" template defaults
        // compute against fresh data, not stale saved totals.
        subtotal={lines.reduce(
          (acc, l) => acc + Math.max(0, Number(l.quantity || 0) * Number(l.rate || 0) - Number(l.discount || 0)),
          0,
        )}
      />

      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12} md={7}>
          <TextField fullWidth label="Notes" multiline rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={0.5}>
              {/* Live preview — recomputes on every keystroke.
                  Inter-state vs intra-state is derived from the loaded
                  invoice's IGST flag if present, else we default to
                  intra-state. Either way, the server reconciles on save. */}
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
                    <Row k="Subtotal" v={fmt(t.subtotal)} />
                    <Row k="CGST" v={fmt(t.cgst)} />
                    <Row k="SGST" v={fmt(t.sgst)} />
                    <Row k="IGST" v={fmt(t.igst)} />
                    <Row k="Grand total" v={fmt(t.grand)} bold />
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
      </Grid>

      <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => save(false)}>Save draft</Button>
        <Button variant="contained" onClick={() => save(true)} disabled={!!saved?.number}>
          {saved?.number ? 'Issued' : 'Save & Issue'}
        </Button>
        {saved?.number && (
          <>
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={openPrint}>Print</Button>
            <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={openPdf}>PDF</Button>
          </>
        )}
      </Stack>
    </Box>
  );
}

function Row({ k, v, bold }: { k: string; v?: string; bold?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant={bold ? 'subtitle1' : 'body2'}>{k}</Typography>
      <Typography variant={bold ? 'subtitle1' : 'body2'}>{v ?? '0.00'}</Typography>
    </Stack>
  );
}
