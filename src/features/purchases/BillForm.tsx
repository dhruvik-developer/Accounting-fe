import { useEffect, useState } from 'react';
import {
  Autocomplete, Box, Button, Grid, IconButton, Paper, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography, Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '@/app/api';
import { formatApiError } from '@/app/errors';
import { lineTotal } from '@/utils/money';
import { fetchLastBoughtFrom } from '@/features/items/lastPrice';
import { notify } from '@/components/Notifier';
import HistoryIcon from '@mui/icons-material/History';
import { Chip } from '@mui/material';
import ChargesSection, { type ChargeRow } from '@/features/charges/ChargesSection';
import { computeDocumentTotals, fmt } from '@/utils/computeDocumentTotals';

const BLANK = { item: '', description: '', hsn_code: '', quantity: 1, rate: 0, discount: 0, tax_rate: 18, _lastHint: undefined as undefined | { rate: number; date: string; docNumber?: string } };

export default function BillForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [party, setParty] = useState<any>(null);
  const [supplierRef, setSupplierRef] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [lines, setLines] = useState<any[]>([{ ...BLANK }]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [saved, setSaved] = useState<any>(null);
  const [totals, setTotals] = useState<any>(null);
  const [err, setErr] = useState('');

  const describeError = (e: unknown) => formatApiError(e, 'Failed to load bill');

  useEffect(() => {
    // page_size=1000 so the entire item master is available for line picks.
    // Without this, DRF's default 25-row pagination silently truncated the
    // list and items beyond the first page couldn't be picked.
    Promise.all([
      api.get('/parties/', { params: { page_size: 1000 } }),
      api.get('/items/', { params: { page_size: 1000, is_active: true } }),
      api.get('/taxes/rates/').catch(() => ({ data: [] })),
      id ? api.get(`/purchases/bills/${id}/`) : Promise.resolve(null),
    ]).then(([partyRes, itemRes, taxRes, billRes]) => {
      const allParties = partyRes.data.results ?? partyRes.data;
      setSuppliers(allParties.filter((p: any) => p.type === 'supplier' || p.type === 'both'));
      setItems(itemRes.data.results ?? itemRes.data);
      setTaxRates(taxRes?.data?.results ?? taxRes?.data ?? []);
      if (!billRes) return;
      const d = billRes.data;
      setSaved(d); setDate(d.date); setSupplierRef(d.supplier_invoice_number || '');
      setLines(d.lines);
      setCharges((d.charges_data || []).map((c: any) => ({
        id: c.id, template: c.template, template_name: c.template_name,
        label: c.label, amount: Number(c.amount), tax_rate: Number(c.tax_rate),
        apply_before_tax: c.apply_before_tax, sequence: c.sequence,
      })));
      setTotals({ subtotal: d.subtotal, cgst: d.cgst_total, sgst: d.sgst_total, igst: d.igst_total, grand: d.grand_total });
      setParty({ id: d.party, name: d.party_name });
    }).catch((e) => setErr(describeError(e)));
  }, [id]);

  const taxRateValue = (taxRateId: string | null | undefined) => {
    if (!taxRateId) return 0;
    return Number(taxRates.find((rate) => rate.id === taxRateId)?.rate ?? 0);
  };

  const up = (i: number, p: any) => {
    setLines((prev) => {
      const nl = prev.slice();
      nl[i] = { ...nl[i], ...p };
      return nl;
    });
  };

  const save = async (issue = false) => {
    setErr('');
    try {
      if (!party) { setErr('Pick a supplier'); return; }
      const body = {
        party: party.id, date, supplier_invoice_number: supplierRef,
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
      let bill = saved
        ? (await api.put(`/purchases/bills/${saved.id}/`, body)).data
        : (await api.post('/purchases/bills/', body)).data;
      if (issue) bill = (await api.post(`/purchases/bills/${bill.id}/issue/`)).data;
      setSaved(bill);
      setTotals({ subtotal: bill.subtotal, cgst: bill.cgst_total, sgst: bill.sgst_total, igst: bill.igst_total, grand: bill.grand_total });
      if (issue) nav('/purchases/bills');
    } catch (e: any) {
      setErr(JSON.stringify(e?.response?.data) || 'Save failed');
    }
  };

  const openPdf = async () => {
    if (!saved) return;
    try {
      const res = await api.get(`/print/purchase_bill/${saved.id}/pdf/`, { responseType: 'blob' });
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
      const res = await api.get(`/print/purchase_bill/${saved.id}/html/`, { responseType: 'text' });
      const w = window.open('', '_blank');
      if (!w) { setErr('Allow pop-ups to print'); return; }
      w.document.open(); w.document.write(res.data); w.document.close();
      w.onload = () => { w.focus(); w.print(); };
    } catch {
      setErr('Failed to open print preview');
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>{saved ? `Bill ${saved.number || ''}` : 'New Bill'}</Typography>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Autocomplete
              options={suppliers} getOptionLabel={o => o.name || ''} value={party}
              onChange={(_, v) => setParty(v)}
              renderInput={p => <TextField {...p} label="Supplier" required />}
              isOptionEqualToValue={(o, v) => o.id === v.id}
            />
          </Grid>
          <Grid item xs={6} md={4}>
            <TextField fullWidth label="Supplier invoice #" value={supplierRef} onChange={e => setSupplierRef(e.target.value)} />
          </Grid>
          <Grid item xs={6} md={3}>
            <TextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={e => setDate(e.target.value)} />
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
                <TableCell sx={{ minWidth: 220 }}>
                  <Autocomplete
                    options={items}
                    getOptionLabel={(o: any) => (o?.name ? `${o.sku ? o.sku + ' · ' : ''}${o.name}` : '')}
                    size="small"
                    // Two-stage value resolution so the cell never goes blank:
                    //  1) Look the row up in the master list (full info).
                    //  2) Fall back to a synthetic stub built from the line's
                    //     own item / item_name fields (for archived items or
                    //     historical bills where the master row was renamed).
                    value={
                      items.find((it) => it.id === l.item)
                      || (l.item ? { id: l.item, name: l.item_name || '(deleted item)' } : null)
                    }
                    isOptionEqualToValue={(o, v) => o?.id === v?.id}
                    onChange={(_, v: any) => {
                      up(i, {
                        item: v?.id || '',
                        item_name: v?.name || '',
                        rate: v?.purchase_price || 0,
                        tax_rate: taxRateValue(v?.tax_rate),
                        hsn_code: v?.hsn_code || '',
                        _lastHint: undefined,
                      });
                      // Auto-fill from "last bought from this supplier" if both
                      // are picked. Falls back silently to the master purchase price.
                      if (v?.id && party?.id) {
                        fetchLastBoughtFrom(v.id, party.id)
                          .then((res) => {
                            if (!res.found) return;
                            up(i, {
                              rate: Number(res.rate),
                              _lastHint: {
                                rate: Number(res.rate),
                                date: res.date,
                                docNumber: res.bill_number,
                              },
                            });
                            notify({
                              severity: 'info',
                              message: `Last bought from ${party.name || 'this supplier'} at ₹${Number(res.rate).toLocaleString('en-IN')} on ${dayjs(res.date).format('DD MMM YY')}`,
                            });
                          })
                          .catch(() => { /* silent */ });
                      }
                    }}
                    renderInput={p => <TextField {...p} placeholder="Pick item" />}
                  />
                </TableCell>
                <TableCell><TextField size="small" value={l.hsn_code} onChange={e => up(i, { hsn_code: e.target.value })} /></TableCell>
                <TableCell align="right"><TextField size="small" type="number" value={l.quantity} onChange={e => up(i, { quantity: Number(e.target.value) })} sx={{ width: 80 }} /></TableCell>
                <TableCell align="right">
                  <Stack alignItems="flex-end" spacing={0.25}>
                    <TextField size="small" type="number" value={l.rate}
                      onChange={e => up(i, { rate: Number(e.target.value), _lastHint: undefined })}
                      sx={{ width: 100 }} />
                    {l._lastHint && (
                      <Chip size="small" icon={<HistoryIcon sx={{ fontSize: 12 }} />}
                        label={`Last ₹${l._lastHint.rate.toLocaleString('en-IN')} · ${dayjs(l._lastHint.date).format('DD MMM')}`}
                        sx={{ height: 18, fontSize: 10, fontWeight: 600,
                          color: 'primary.main', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(79,195,247,0.14)' : 'rgba(79,195,247,0.10)' }}
                      />
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right"><TextField size="small" type="number" value={l.discount} onChange={e => up(i, { discount: Number(e.target.value) })} sx={{ width: 90 }} /></TableCell>
                <TableCell align="right"><TextField size="small" type="number" value={l.tax_rate} onChange={e => up(i, { tax_rate: Number(e.target.value) })} sx={{ width: 80 }} /></TableCell>
                <TableCell align="right">{l.total || lineTotal(l.quantity, l.rate, l.discount)}</TableCell>
                <TableCell><IconButton size="small" onClick={() => setLines(lines.filter((_, ix) => ix !== i))}><DeleteIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ p: 1 }}>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setLines([...lines, { ...BLANK }])}>Add line</Button>
        </Box>
      </Paper>

      <ChargesSection
        side="purchase"
        rows={charges}
        onChange={setCharges}
        subtotal={lines.reduce(
          (acc, l) => acc + Math.max(0, Number(l.quantity || 0) * Number(l.rate || 0) - Number(l.discount || 0)),
          0,
        )}
      />

      <Grid container justifyContent="flex-end" sx={{ mt: 2 }}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={0.5}>
              {/* Live preview — recomputes on every keystroke. Inter-state
                  is derived from the loaded bill's IGST when present. */}
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
                const rows: [string, number][] = [
                  ['Subtotal', t.subtotal], ['CGST', t.cgst], ['SGST', t.sgst], ['IGST', t.igst],
                ];
                return (
                  <>
                    {rows.map(([k, v]) => (
                      <Stack key={k} direction="row" justifyContent="space-between">
                        <Typography variant="body2">{k}</Typography>
                        <Typography variant="body2">{fmt(v)}</Typography>
                      </Stack>
                    ))}
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle1">Grand total</Typography>
                      <Typography variant="subtitle1">{fmt(t.grand)}</Typography>
                    </Stack>
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

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 3 }}>
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
