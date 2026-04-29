/**
 * Payments — receipts (in) and payouts (out).
 *
 * Major upgrades from the previous version:
 *   • Hero header (matches Parties / Items style)
 *   • KPI strip — today collected / paid out / advance on hand / AR / AP
 *   • FIFO autofill of allocations against outstanding invoices
 *     - oldest invoice gets paid down first (matches Vyapar/Tally default)
 *     - re-runs whenever amount or party changes
 *     - "Auto FIFO / Auto LIFO / Clear / Mark as advance" buttons
 *   • Live "Allocated / Remaining (advance)" chips with colour cues
 *   • Party balance chip next to the picker so the user knows what's owed
 *   • Cr/Dr label toggle for Tally migrants
 *   • WhatsApp receipt share after save (reuses the share helper)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, ButtonGroup, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, IconButton, Menu, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography, alpha,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PaidIcon from '@mui/icons-material/Paid';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottomOutlined';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import dayjs from 'dayjs';
import { api } from '@/app/api';
import { formatApiError } from '@/app/errors';
import useAutoOpenCreate from '@/hooks/useAutoOpenCreate';
import { useDrCrMode, directionLabel } from '@/hooks/useDrCrMode';
import ConfirmDialog from '@/components/ConfirmDialog';
import StatCard from '@/components/StatCard';
import MoneyDisplay, { formatMoney } from '@/components/MoneyDisplay';
import { notify } from '@/components/Notifier';
import { openWhatsApp } from '@/features/parties/share';

const num = (v: any) => Number(v || 0);

const EMPTY = {
  direction: 'in' as 'in' | 'out',
  date: dayjs().format('YYYY-MM-DD'),
  amount: 0,
  status: 'completed',
  mode: 'cash',
  reference: '',
  cheque_no: '',
  cheque_date: '',
  notes: '',
};

const describeError = (e: unknown, fallback = 'Failed to load payments') => formatApiError(e, fallback);

type Outstanding = {
  document_type: 'invoice' | 'bill';
  document_id: string;
  number: string;
  date: string;
  grand_total: string;
  amount_paid: string;
  due_amount: string;
};

type Summary = {
  today_collected: string;
  today_paid_out: string;
  advance_on_hand: string;
  receivables: string;
  payables: string;
};

export default function Payments() {
  const { drCr, toggle: toggleDrCr } = useDrCrMode();

  const [rows, setRows] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [outstanding, setOutstanding] = useState<Outstanding[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [partyBalance, setPartyBalance] = useState<{ balance: number; pending: number; pending_count: number } | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [party, setParty] = useState<any>(null);
  const [filters, setFilters] = useState({ party: '', mode: '', status: '', direction: '' });
  const [allocStrategy, setAllocStrategy] = useState<'auto' | 'manual'>('auto');
  const [allocDirection, setAllocDirection] = useState<'fifo' | 'lifo'>('fifo');

  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<any>(null);

  // Row-level action menu + Re-allocate dialog state.
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; row: any } | null>(null);
  const [reallocTarget, setReallocTarget] = useState<any | null>(null);
  const [reallocOutstanding, setReallocOutstanding] = useState<Outstanding[]>([]);
  const [reallocAllocations, setReallocAllocations] = useState<Record<string, number>>({});
  const [reallocSaving, setReallocSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);

  useAutoOpenCreate(() => setOpen(true));

  // ---- Loaders --------------------------------------------------------

  const load = () => api.get('/payments/', {
    params: { ...filters, page_size: 1000 },
  })
    .then(r => {
      setRows(r.data.results ?? r.data);
      setErr('');
    })
    .catch((e) => setErr(describeError(e)));

  const loadSummary = () => api.get<Summary>('/payments/summary/')
    .then((r) => setSummary(r.data))
    .catch(() => setSummary(null));

  const loadParties = () => api.get('/parties/', { params: { page_size: 1000 } })
    .then(r => setParties(r.data.results ?? r.data))
    .catch((e) => setErr(describeError(e, 'Failed to load parties')));

  const loadOutstanding = (selectedParty: any, direction: 'in' | 'out') => {
    if (!selectedParty?.id) {
      setOutstanding([]);
      setAllocations({});
      setPartyBalance(null);
      return;
    }
    Promise.all([
      api.get<Outstanding[]>('/payments/outstanding/', { params: { party: selectedParty.id, direction } }),
      api.get(`/parties/${selectedParty.id}/summary/`).catch(() => null),
    ])
      .then(([outRes, summaryRes]) => {
        setOutstanding(outRes.data);
        if (summaryRes?.data) {
          setPartyBalance({
            balance: num(summaryRes.data.balance),
            pending: num(summaryRes.data.invoices?.pending_amount),
            pending_count: summaryRes.data.invoices?.pending_count || 0,
          });
        } else {
          setPartyBalance(null);
        }
      })
      .catch((e) => setErr(describeError(e, 'Failed to load outstanding documents')));
  };

  useEffect(() => { load(); loadSummary(); loadParties(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);

  // ---- Auto-allocation (the Arjun Rao fix) ----------------------------
  // Whenever the outstanding list, amount or strategy changes, redistribute.
  // This is what was missing before — the user had to type into each row by
  // hand, and a typo'd / forgotten allocation became a silent advance.
  useEffect(() => {
    if (allocStrategy !== 'auto') return;
    if (outstanding.length === 0) {
      setAllocations({});
      return;
    }
    let remaining = num(form.amount);
    const ordered = allocDirection === 'fifo'
      ? outstanding
      : [...outstanding].reverse();
    const next: Record<string, number> = {};
    for (const doc of ordered) {
      if (remaining <= 0) break;
      const due = num(doc.due_amount);
      const apply = Math.min(due, remaining);
      if (apply > 0) next[doc.document_id] = +apply.toFixed(2);
      remaining -= apply;
    }
    setAllocations(next);
  }, [outstanding, form.amount, allocStrategy, allocDirection]);

  // ---- Computed -------------------------------------------------------

  const availableParties = useMemo(() =>
    parties.filter((p) => {
      if (form.direction === 'in') return p.type === 'customer' || p.type === 'both';
      if (form.direction === 'out') return p.type === 'supplier' || p.type === 'both';
      return true;
    }),
  [parties, form.direction]);

  const allocatedTotal = useMemo(
    () => Object.values(allocations).reduce((a, b) => a + num(b), 0),
    [allocations],
  );
  const unusedAmount = num(form.amount) - allocatedTotal;
  const unusedColor = unusedAmount > 0 ? '#4FC3F7' : unusedAmount < 0 ? '#FF5252' : '#00E676';

  // ---- Allocation actions --------------------------------------------

  const setRowAllocation = (docId: string, val: string) => {
    // The moment the user types into a cell, drop out of "auto" so we don't
    // immediately overwrite their edit on the next render.
    setAllocStrategy('manual');
    const n = Math.max(0, num(val));
    setAllocations((prev) => {
      if (n <= 0) {
        const { [docId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [docId]: n };
    });
  };

  const clearAllocations = () => {
    setAllocStrategy('manual');
    setAllocations({});
  };

  const payFullBalance = () => {
    if (outstanding.length === 0) return;
    const total = outstanding.reduce((a, d) => a + num(d.due_amount), 0);
    setAllocStrategy('auto');
    setForm((f) => ({ ...f, amount: total }));
  };

  // ---- Save -----------------------------------------------------------

  const save = async () => {
    setErr('');
    setSaving(true);
    try {
      if (!party) throw new Error('Select a party first.');
      if (num(form.amount) <= 0) throw new Error('Amount must be greater than zero.');
      if (allocatedTotal > num(form.amount) + 0.01) {
        throw new Error('Allocated total exceeds payment amount.');
      }
      const allocationPayload = outstanding
        .map((doc) => ({
          document_type: doc.document_type,
          document_id: doc.document_id,
          invoice: doc.document_type === 'invoice' ? doc.document_id : null,
          bill: doc.document_type === 'bill' ? doc.document_id : null,
          amount: num(allocations[doc.document_id] || 0),
        }))
        .filter((row) => row.amount > 0);

      const { data } = await api.post('/payments/', {
        ...form,
        amount: num(form.amount),
        party: party.id,
        cheque_date: form.cheque_date || null,
        allocations: allocationPayload,
      });
      setLastSaved({ ...data, partyName: party.name, partyPhone: party.whatsapp || party.phone });
      setMsg(form.status === 'draft' ? 'Draft payment saved' : 'Payment recorded');
      notify({ severity: 'success', message: form.status === 'draft' ? 'Draft saved' : `Recorded ${formatMoney(num(form.amount))}` });
      setOpen(false);
      setForm(EMPTY);
      setParty(null);
      setOutstanding([]);
      setAllocations({});
      load();
      loadSummary();
    } catch (e: any) {
      setErr(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  const complete = async (id: string) => {
    try {
      await api.post(`/payments/${id}/complete/`);
      setMsg('Payment completed');
      load();
      loadSummary();
    } catch (e) {
      setErr(describeError(e));
    }
  };

  // ---- WhatsApp receipt share after save ------------------------------

  const shareReceipt = (p: any) => {
    if (!p) return;
    const businessName = (() => {
      try { return localStorage.getItem('business_name') || ''; } catch { return ''; }
    })();
    const lines = [
      `*Payment receipt — ${p.number || ''}*`,
      businessName ? `From: ${businessName}` : '',
      '',
      `Date:   ${dayjs(p.date).format('DD MMM YYYY')}`,
      `Mode:   ${String(p.mode).toUpperCase()}`,
      `Amount: ₹${num(p.amount).toLocaleString('en-IN')}`,
      p.direction === 'in' ? `Received from ${p.partyName}` : `Paid to ${p.partyName}`,
      '',
      'Thank you!',
    ].filter(Boolean);
    openWhatsApp(p.partyPhone, lines.join('\n'));
    setLastSaved(null);
  };

  // ---- Columns --------------------------------------------------------

  const cols: GridColDef[] = [
    { field: 'number', headerName: 'Number', width: 140 },
    {
      field: 'date', headerName: 'Date', width: 110,
      renderCell: (p) => dayjs(p.value).format('DD MMM YY'),
    },
    {
      field: 'direction', headerName: drCr ? 'Dr/Cr' : 'Type', width: 110,
      renderCell: (p) => {
        const label = directionLabel(p.value, drCr);
        const isIn = p.value === 'in';
        const color = isIn ? '#00E676' : '#FFB300';
        return (
          <Chip size="small" label={label} sx={{
            height: 22, fontSize: 11, fontWeight: 700,
            color, bgcolor: alpha(color, 0.12),
            border: `1px solid ${alpha(color, 0.32)}`,
          }} />
        );
      },
    },
    { field: 'party_name', headerName: 'Party', flex: 1, minWidth: 180 },
    {
      field: 'mode', headerName: 'Mode', width: 100,
      renderCell: (p) => <Chip size="small" label={String(p.value).toUpperCase()} sx={{ height: 20, fontSize: 10 }} />,
    },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: (p) => (
        <Chip size="small" label={p.value}
          color={p.value === 'completed' ? 'success' : p.value === 'cancelled' ? 'error' : 'default'} />
      ),
    },
    {
      field: 'amount', headerName: 'Amount', width: 130, align: 'right', headerAlign: 'right',
      renderCell: (p) => <MoneyDisplay value={num(p.value)} sx={{ fontWeight: 700 }} />,
    },
    {
      field: 'unused_amount', headerName: 'Advance', width: 110, align: 'right', headerAlign: 'right',
      renderCell: (p) => num(p.value) > 0
        ? <MoneyDisplay value={num(p.value)} sx={{ color: '#4FC3F7', fontWeight: 700 }} />
        : <Typography variant="body2" color="text.disabled">—</Typography>,
    },
    {
      field: 'actions', headerName: '', width: 60, sortable: false, filterable: false,
      renderCell: (p) => (
        <IconButton size="small" onClick={(e) => {
          e.stopPropagation();
          setMenuAnchor({ el: e.currentTarget, row: p.row });
        }}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const openReallocate = async (row: any) => {
    setMenuAnchor(null);
    if (!row?.party) return;
    setReallocTarget(row);
    try {
      // Pull all open documents for the party PLUS the ones this payment
      // currently sits on (so "move 90 from invoice A → invoice B" works
      // even when A is fully paid only because of this payment).
      const { data } = await api.get<Outstanding[]>('/payments/outstanding/', {
        params: { party: row.party, direction: row.direction },
      });
      // Pre-fill from the existing allocations.
      const existing: Record<string, number> = {};
      (row.allocations || []).forEach((a: any) => {
        const id = a.invoice || a.bill || a.document_id;
        if (id) existing[id] = num(a.amount);
      });
      // Make sure already-allocated targets show up in the dialog even if
      // they're now status=paid (they were paid because of this very payment).
      const includedIds = new Set(data.map((d: any) => d.document_id));
      const missing = (row.allocations || [])
        .filter((a: any) => !includedIds.has(a.invoice || a.bill || a.document_id))
        .map((a: any) => ({
          document_type: a.document_type,
          document_id: a.invoice || a.bill || a.document_id,
          number: a.document_number || '—',
          date: row.date,
          grand_total: a.amount,
          amount_paid: a.amount,
          due_amount: '0',
        }));
      setReallocOutstanding([...data, ...missing] as any);
      setReallocAllocations(existing);
    } catch (e) {
      setErr(describeError(e, 'Failed to load outstanding documents'));
    }
  };

  const reallocAllocated = useMemo(
    () => Object.values(reallocAllocations).reduce((a, b) => a + num(b), 0),
    [reallocAllocations],
  );
  const reallocUnused = reallocTarget ? num(reallocTarget.amount) - reallocAllocated : 0;

  const setReallocRow = (docId: string, val: string) => {
    const n = Math.max(0, num(val));
    setReallocAllocations((prev) => {
      if (n <= 0) {
        const { [docId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [docId]: n };
    });
  };

  const reallocAutoFifo = () => {
    let remaining = num(reallocTarget?.amount);
    const next: Record<string, number> = {};
    // Walk outstanding sorted oldest first (the API already returns that).
    for (const doc of reallocOutstanding) {
      if (remaining <= 0) break;
      const due = num(doc.due_amount) + (reallocAllocations[doc.document_id] || 0);
      // ↑ add any current allocation back to the doc's "available headroom"
      //    so we don't double-count what this very payment covered.
      const apply = Math.min(due, remaining);
      if (apply > 0) next[doc.document_id] = +apply.toFixed(2);
      remaining -= apply;
    }
    setReallocAllocations(next);
  };

  const reallocClear = () => setReallocAllocations({});

  const reallocSave = async () => {
    if (!reallocTarget) return;
    setReallocSaving(true);
    setErr('');
    try {
      const allocations = Object.entries(reallocAllocations)
        .filter(([, amt]) => num(amt) > 0)
        .map(([id, amt]) => {
          const doc = reallocOutstanding.find((d) => d.document_id === id);
          return {
            document_type: doc?.document_type || 'invoice',
            document_id: id,
            amount: num(amt),
          };
        });
      await api.post(`/payments/${reallocTarget.id}/reallocate/`, { allocations });
      notify({ severity: 'success', message: 'Allocation updated' });
      setReallocTarget(null);
      setReallocOutstanding([]);
      setReallocAllocations({});
      load();
      loadSummary();
    } catch (e) {
      setErr(describeError(e, 'Failed to re-allocate'));
    } finally {
      setReallocSaving(false);
    }
  };

  const cancelPayment = async () => {
    if (!cancelTarget) return;
    try {
      await api.post(`/payments/${cancelTarget.id}/cancel/`);
      notify({ severity: 'success', message: `Cancelled ${cancelTarget.number}` });
      setCancelTarget(null);
      load();
      loadSummary();
    } catch (e) {
      setErr(describeError(e, 'Failed to cancel payment'));
    }
  };

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  // ---- Render --------------------------------------------------------

  return (
    <Box>
      {/* Hero header */}
      <Box sx={{
        position: 'relative',
        mx: { xs: -1.5, sm: -2, md: -3 },
        mt: { xs: -1.5, sm: -2, md: -3 },
        mb: 3,
        px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3 },
        borderBottom: '1px solid', borderColor: 'divider',
        background: (t) => t.palette.mode === 'dark'
          ? 'radial-gradient(900px 320px at 0% 0%, rgba(0,230,118,0.18), transparent 60%)'
          : 'linear-gradient(180deg, rgba(0,230,118,0.06), transparent 100%)',
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flex: 1 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 1.5,
              display: 'grid', placeItems: 'center', color: '#fff',
              background: 'linear-gradient(135deg, #00E676, #4FC3F7)',
              boxShadow: '0 8px 22px rgba(0,230,118,0.32)',
            }}>
              <PaidIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>Payments</Typography>
              <Typography variant="body2" color="text.secondary">
                Receipts, payouts, advances · auto-applied to oldest invoice
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={drCr ? 'Showing Dr/Cr (Tally style)' : 'Showing Received / Paid out'}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="caption" color="text.secondary">Dr/Cr</Typography>
                <Switch size="small" checked={drCr} onChange={toggleDrCr} />
              </Stack>
            </Tooltip>
            <Button startIcon={<RefreshIcon />} onClick={() => { load(); loadSummary(); }}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
              New payment
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* KPI strip */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}>
          <StatCard label="Today collected"
            value={summary ? formatMoney(num(summary.today_collected), { short: true }) : '—'}
            accent="#00E676" icon={<PaidIcon fontSize="small" />}
            hint={dayjs().format('DD MMM YYYY')} index={0} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Today paid out"
            value={summary ? formatMoney(num(summary.today_paid_out), { short: true }) : '—'}
            accent="#FFB300" icon={<SwapVertIcon fontSize="small" />} index={1} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Advances on hand"
            value={summary ? formatMoney(num(summary.advance_on_hand), { short: true }) : '—'}
            accent="#4FC3F7" icon={<LocalAtmIcon fontSize="small" />}
            hint="unallocated payments" index={2} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Receivables"
            value={summary ? formatMoney(num(summary.receivables), { short: true }) : '—'}
            accent="#FF5252" icon={<HourglassBottomIcon fontSize="small" />}
            hint={summary ? `Payables ${formatMoney(num(summary.payables), { short: true })}` : undefined}
            index={3} />
        </Grid>
      </Grid>

      {/* List filters */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={3}>
            <Autocomplete
              size="small" options={parties}
              getOptionLabel={(o: any) => o.name || ''}
              onChange={(_, v) => setFilters({ ...filters, party: v?.id || '' })}
              renderInput={(p) => <TextField {...p} size="small" label="Filter party" />}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField select size="small" fullWidth label="Direction" value={filters.direction}
              onChange={e => setFilters({ ...filters, direction: e.target.value })}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="in">{drCr ? 'Cr (in)' : 'Payment In'}</MenuItem>
              <MenuItem value="out">{drCr ? 'Dr (out)' : 'Payment Out'}</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField select size="small" fullWidth label="Mode" value={filters.mode}
              onChange={e => setFilters({ ...filters, mode: e.target.value })}>
              <MenuItem value="">All</MenuItem>
              {['cash', 'bank', 'upi', 'card', 'cheque'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField select size="small" fullWidth label="Status" value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <MenuItem value="">All</MenuItem>
              {['draft', 'completed', 'cancelled'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Paper>
        <DataGrid autoHeight rows={rows} columns={cols} getRowId={(r) => r.id}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Paper>

      {/* Receipt-share prompt that appears right after a save */}
      <Dialog open={!!lastSaved} onClose={() => setLastSaved(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <PaidIcon sx={{ color: '#00E676' }} />
            <Typography variant="h6" component="span">Payment recorded</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {lastSaved && (
              <>
                {lastSaved.direction === 'in' ? 'Received' : 'Paid'}{' '}
                <strong>{formatMoney(num(lastSaved.amount))}</strong>
                {' '}from <strong>{lastSaved.partyName}</strong>.
                {' '}Want to send a receipt confirmation on WhatsApp?
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLastSaved(null)}>Skip</Button>
          <Button variant="contained" startIcon={<WhatsAppIcon />}
            sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1ebe57' } }}
            onClick={() => shareReceipt(lastSaved)}>
            Share via WhatsApp
          </Button>
        </DialogActions>
      </Dialog>

      {/* Row action menu */}
      <Menu anchorEl={menuAnchor?.el} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {menuAnchor?.row?.status === 'draft' && (
          <MenuItem onClick={() => { complete(menuAnchor!.row.id); setMenuAnchor(null); }}>
            <CheckCircleOutlineIcon fontSize="small" sx={{ mr: 1.25 }} /> Complete
          </MenuItem>
        )}
        {menuAnchor?.row?.status === 'completed' && (
          <MenuItem onClick={() => openReallocate(menuAnchor!.row)}>
            <ShuffleIcon fontSize="small" sx={{ mr: 1.25 }} /> Re-allocate
          </MenuItem>
        )}
        {menuAnchor?.row?.status === 'completed' && (
          <MenuItem onClick={() => { setCancelTarget(menuAnchor!.row); setMenuAnchor(null); }}
            sx={{ color: '#FF5252' }}>
            <CancelOutlinedIcon fontSize="small" sx={{ mr: 1.25 }} /> Cancel payment
          </MenuItem>
        )}
      </Menu>

      {/* Re-allocate dialog */}
      <Dialog open={!!reallocTarget} onClose={() => !reallocSaving && setReallocTarget(null)}
        maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ShuffleIcon sx={{ color: '#4FC3F7' }} />
            <Box>
              <Typography variant="h6" component="span">
                Re-allocate {reallocTarget?.number}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Re-tag this payment to invoices/bills. Cash position and ledger stay unchanged —
                this only changes which document gets credit.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {reallocTarget && (
            <Stack spacing={1} direction="row" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`Party: ${reallocTarget.party_name}`} />
              <Chip size="small" label={`Amount: ${formatMoney(num(reallocTarget.amount))}`} />
              <Chip size="small" label={`Mode: ${String(reallocTarget.mode).toUpperCase()}`} />
              <Chip size="small" label={`Date: ${dayjs(reallocTarget.date).format('DD MMM YY')}`} />
            </Stack>
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
            <Button size="small" variant="outlined" onClick={reallocAutoFifo}
              disabled={reallocOutstanding.length === 0}>
              Auto FIFO
            </Button>
            <Button size="small" onClick={reallocClear}
              disabled={Object.keys(reallocAllocations).length === 0}>
              Clear (keep as advance)
            </Button>
            <Box sx={{ flex: 1 }} />
            <Chip size="small" label={`Allocated ${formatMoney(reallocAllocated)}`}
              sx={{
                height: 26, fontWeight: 700, color: '#00E676',
                bgcolor: (t) => alpha('#00E676', t.palette.mode === 'dark' ? 0.18 : 0.12),
              }} />
            <Chip size="small"
              label={reallocUnused > 0 ? `Advance ${formatMoney(reallocUnused)}`
                : reallocUnused < 0 ? `Over-allocated ${formatMoney(Math.abs(reallocUnused))}`
                : 'Fully applied'}
              sx={{
                height: 26, fontWeight: 700,
                color: reallocUnused > 0 ? '#4FC3F7' : reallocUnused < 0 ? '#FF5252' : '#00E676',
                bgcolor: (t) => alpha(
                  reallocUnused > 0 ? '#4FC3F7' : reallocUnused < 0 ? '#FF5252' : '#00E676',
                  t.palette.mode === 'dark' ? 0.18 : 0.12,
                ),
              }} />
          </Stack>

          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Document</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Due (excl. this)</TableCell>
                  <TableCell align="right" sx={{ width: 130 }}>Allocate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reallocOutstanding.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ color: 'text.secondary' }}>
                      No open documents — keeping payment as advance.
                    </TableCell>
                  </TableRow>
                )}
                {reallocOutstanding.map((doc) => {
                  // The "due excluding this payment" is the doc's normal due
                  // PLUS whatever this payment is currently parked on it.
                  const currentAlloc = reallocAllocations[doc.document_id] || 0;
                  const trueDue = num(doc.due_amount) + currentAlloc;
                  return (
                    <TableRow key={doc.document_id}>
                      <TableCell>
                        <Typography variant="body2"
                          sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}>
                          {doc.number || doc.document_type}
                        </Typography>
                      </TableCell>
                      <TableCell>{dayjs(doc.date).format('DD MMM YY')}</TableCell>
                      <TableCell align="right">
                        <MoneyDisplay value={num(doc.grand_total)} fractionDigits={0} />
                      </TableCell>
                      <TableCell align="right">
                        <MoneyDisplay value={trueDue} fractionDigits={0}
                          sx={{ color: '#FFB300', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell align="right">
                        <TextField size="small" type="number"
                          value={reallocAllocations[doc.document_id] ?? ''}
                          placeholder="0"
                          onChange={(e) => setReallocRow(doc.document_id, e.target.value)}
                          inputProps={{
                            min: 0, max: trueDue, step: '0.01',
                            style: { textAlign: 'right' },
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReallocTarget(null)} disabled={reallocSaving}>Cancel</Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={reallocSave} disabled={reallocSaving || reallocUnused < 0}>
            {reallocSaving ? 'Saving…' : 'Save allocations'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!cancelTarget}
        title={`Cancel payment ${cancelTarget?.number}?`}
        body="This reverses the ledger entries and unlocks any invoices this payment was tagged to. Audit trail is preserved. To re-record, create a new payment."
        tone="danger"
        confirmLabel="Cancel payment"
        onConfirm={cancelPayment}
        onClose={() => setCancelTarget(null)}
      />

      {/* New / edit dialog */}
      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" component="span">New payment</Typography>
            <Chip size="small" label={form.direction === 'in' ? 'Receipt' : 'Payout'}
              color={form.direction === 'in' ? 'success' : 'warning'} />
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} md={4}>
              <TextField select fullWidth label="Direction" value={form.direction}
                onChange={(e) => {
                  const direction = e.target.value as 'in' | 'out';
                  setForm({ ...form, direction });
                  setParty(null);
                  setOutstanding([]);
                  setAllocations({});
                  setPartyBalance(null);
                }}>
                <MenuItem value="in">Payment in (receipt)</MenuItem>
                <MenuItem value="out">Payment out</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth type="date" label="Date"
                InputLabelProps={{ shrink: true }} value={form.date} onChange={set('date')} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField select fullWidth label="Status" value={form.status} onChange={set('status')}>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                options={availableParties} getOptionLabel={(o: any) => o.name || ''}
                value={party}
                onChange={(_, v) => {
                  setParty(v);
                  loadOutstanding(v, form.direction);
                  setAllocStrategy('auto');
                }}
                renderInput={(p) => <TextField {...p} label="Party" required />}
                isOptionEqualToValue={(o, v) => o.id === v.id}
              />
              {party && partyBalance && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap">
                  {partyBalance.balance !== 0 && (
                    <Chip size="small" sx={{
                      height: 22, fontWeight: 700,
                      color: partyBalance.balance > 0 ? '#FFB300' : '#00E676',
                      bgcolor: (t) => alpha(partyBalance.balance > 0 ? '#FFB300' : '#00E676', t.palette.mode === 'dark' ? 0.18 : 0.12),
                    }}
                    label={`Balance ${formatMoney(Math.abs(partyBalance.balance))} ${
                      drCr ? (partyBalance.balance > 0 ? 'Dr' : 'Cr') : (partyBalance.balance > 0 ? 'owes us' : 'we owe')
                    }`} />
                  )}
                  {partyBalance.pending_count > 0 && (
                    <Chip size="small" icon={<ReceiptLongIcon sx={{ fontSize: 14 }} />}
                      label={`${partyBalance.pending_count} unpaid · ${formatMoney(partyBalance.pending)}`} />
                  )}
                </Stack>
              )}
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth type="number" label="Amount" value={form.amount}
                onChange={(e) => { setAllocStrategy('auto'); set('amount')(e); }} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField select fullWidth label="Mode" value={form.mode} onChange={set('mode')}>
                {['cash', 'bank', 'upi', 'card', 'cheque'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth label="Reference" value={form.reference} onChange={set('reference')} />
            </Grid>
            {form.mode === 'cheque' && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Cheque no" value={form.cheque_no} onChange={set('cheque_no')} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth type="date" label="Cheque date"
                    InputLabelProps={{ shrink: true }} value={form.cheque_date} onChange={set('cheque_date')} />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <TextField fullWidth label="Notes" value={form.notes} onChange={set('notes')} />
            </Grid>
          </Grid>

          {/* Allocation toolbar */}
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between"
            alignItems={{ sm: 'center' }} spacing={1} sx={{ mt: 3, mb: 1.25 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Apply to {form.direction === 'in' ? 'invoices' : 'bills'}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <ButtonGroup size="small">
                <Button
                  variant={allocStrategy === 'auto' && allocDirection === 'fifo' ? 'contained' : 'outlined'}
                  onClick={() => { setAllocStrategy('auto'); setAllocDirection('fifo'); }}
                  disabled={outstanding.length === 0}
                >
                  Auto FIFO
                </Button>
                <Button
                  variant={allocStrategy === 'auto' && allocDirection === 'lifo' ? 'contained' : 'outlined'}
                  onClick={() => { setAllocStrategy('auto'); setAllocDirection('lifo'); }}
                  disabled={outstanding.length === 0}
                >
                  LIFO
                </Button>
              </ButtonGroup>
              <Button size="small" onClick={clearAllocations}
                disabled={Object.keys(allocations).length === 0}>
                Clear (keep as advance)
              </Button>
              <Button size="small" variant="outlined" onClick={payFullBalance}
                disabled={outstanding.length === 0}>
                Pay full balance
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            <Chip size="small" label={`Allocated ${formatMoney(allocatedTotal)}`}
              sx={{
                height: 26, fontWeight: 700, color: '#00E676',
                bgcolor: (t) => alpha('#00E676', t.palette.mode === 'dark' ? 0.18 : 0.12),
              }} />
            <Chip size="small"
              label={unusedAmount > 0
                ? `Advance ${formatMoney(unusedAmount)}`
                : unusedAmount < 0
                  ? `Over-allocated ${formatMoney(Math.abs(unusedAmount))}`
                  : 'Fully applied'}
              sx={{
                height: 26, fontWeight: 700,
                color: unusedColor,
                bgcolor: (t) => alpha(unusedColor, t.palette.mode === 'dark' ? 0.18 : 0.12),
              }} />
          </Stack>

          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Document</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Due</TableCell>
                  <TableCell align="right" sx={{ width: 130 }}>Allocate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {outstanding.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ color: 'text.secondary' }}>
                      {party
                        ? 'No open documents — payment will be kept as advance.'
                        : 'Pick a party to see open documents.'}
                    </TableCell>
                  </TableRow>
                )}
                {outstanding.map((doc) => {
                  const allocated = num(allocations[doc.document_id] || 0);
                  const isAuto = allocStrategy === 'auto' && allocated > 0;
                  return (
                    <TableRow key={doc.document_id}
                      sx={{
                        bgcolor: isAuto
                          ? (t) => alpha('#00E676', t.palette.mode === 'dark' ? 0.06 : 0.04)
                          : 'transparent',
                      }}>
                      <TableCell>
                        <Typography variant="body2"
                          sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}>
                          {doc.number || doc.document_type}
                        </Typography>
                      </TableCell>
                      <TableCell>{dayjs(doc.date).format('DD MMM YY')}</TableCell>
                      <TableCell align="right">
                        <MoneyDisplay value={num(doc.grand_total)} fractionDigits={0} />
                      </TableCell>
                      <TableCell align="right">
                        <MoneyDisplay value={num(doc.due_amount)} fractionDigits={0}
                          sx={{ color: '#FFB300', fontWeight: 700 }} />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small" type="number"
                          value={allocations[doc.document_id] ?? ''}
                          placeholder="0"
                          onChange={(e) => setRowAllocation(doc.document_id, e.target.value)}
                          inputProps={{
                            min: 0, max: num(doc.due_amount),
                            step: '0.01',
                            style: { textAlign: 'right' },
                          }}
                          sx={isAuto ? {
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00E676' },
                          } : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
          {outstanding.length > 0 && allocStrategy === 'auto' && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Auto-applied to oldest {allocDirection === 'fifo' ? 'first' : 'last'}. Type into any cell to override.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
