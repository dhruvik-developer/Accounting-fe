/**
 * Right pane shown when a party is selected. Shows:
 *   • Hero header — name, GSTIN, contact, [Edit] [Delete] [WhatsApp]
 *   • 4 stat cards — Total invoiced / Paid / Pending / Overdue (with counts)
 *   • Tabs — Ledger (running-balance, Tally-style)
 *            Invoices
 *            Payments
 *            Info (GST, addresses, contacts, bank)
 *
 * Each tab fetches lazily on first activation so opening a heavy party
 * doesn't fan out 4 calls at once.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Grid, IconButton, Menu, MenuItem,
  Paper, Skeleton, Stack, Tab, Tabs, TextField, Tooltip, Typography, alpha,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaidIcon from '@mui/icons-material/Paid';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottomOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ShareIcon from '@mui/icons-material/IosShare';
import SendIcon from '@mui/icons-material/Send';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import dayjs from 'dayjs';
import { api } from '@/app/api';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import { notify } from '@/components/Notifier';
import MoneyDisplay, { formatMoney } from '@/components/MoneyDisplay';
import { useDrCrMode, directionLabel } from '@/hooks/useDrCrMode';
import {
  formatInvoicesMessage, formatLedgerMessage, formatPaymentsMessage,
  openWhatsApp,
} from './share';

const listOf = (data: any) => data?.results ?? data ?? [];

type Summary = {
  party_id: string;
  balance: string;
  credit_limit: string;
  advance_held: string;
  invoices: {
    count: number;
    total: string;
    paid: string;
    pending_count: number;
    pending_amount: string;
    raw_pending_count?: number;
    raw_pending_amount?: string;
    overdue_count: number;
    overdue_amount: string;
  };
  last_payment: { date: string | null; amount: string };
};

type LedgerRow = {
  date: string;
  ref_type: string;
  ref_id: string;
  ref_number: string;
  debit: string;
  credit: string;
  running_balance: string;
};

type Props = {
  party: any | null;
  // Pass `undefined` to hide the corresponding button (used when the active
  // branch has the parties module set to read-only).
  onEdit?: (party: any) => void;
  onDelete?: (party: any) => void;
  onRefresh: () => void;
};

export default function PartyDetail({ party, onEdit, onDelete, onRefresh }: Props) {
  if (!party) {
    return (
      <Paper sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 4 }}>
        <EmptyState
          icon={<ReceiptLongIcon />}
          title="Select a party"
          body="Pick a customer or supplier from the left to see their ledger, invoices and payments."
        />
      </Paper>
    );
  }
  return <Loaded key={party.id} party={party} onEdit={onEdit} onDelete={onDelete} onRefresh={onRefresh} />;
}

function Loaded({ party, onEdit, onDelete, onRefresh }: Pick<Props, 'onEdit' | 'onDelete' | 'onRefresh'> & { party: any }) {
  const [tab, setTab] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryErr, setSummaryErr] = useState('');

  // ----- WhatsApp share state ------------------------------------------
  // The Share menu in the header drives multi-select on the Invoices and
  // Payments tabs. Each tab keeps its own selection set so switching back
  // and forth doesn't lose the user's progress.
  const [shareMenuAnchor, setShareMenuAnchor] = useState<null | HTMLElement>(null);
  const [invoiceSelectMode, setInvoiceSelectMode] = useState(false);
  const [paymentSelectMode, setPaymentSelectMode] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  // Tabs publish their loaded rows up here so the Share dialog can format
  // them without re-fetching.
  const [invoiceRows, setInvoiceRows] = useState<any[]>([]);
  const [paymentRows, setPaymentRows] = useState<any[]>([]);
  const [shareDialog, setShareDialog] = useState<null | { title: string; text: string }>(null);

  useEffect(() => {
    setSummary(null);
    setSummaryErr('');
    api.get(`/parties/${party.id}/summary/`)
      .then((r) => setSummary(r.data))
      .catch((e) => setSummaryErr(e?.response?.data?.detail || e?.message || 'Failed to load summary'));
  }, [party.id]);

  // Reset share state on party switch.
  useEffect(() => {
    setInvoiceSelectMode(false);
    setPaymentSelectMode(false);
    setSelectedInvoiceIds(new Set());
    setSelectedPaymentIds(new Set());
  }, [party.id]);

  const businessName = (() => {
    try { return localStorage.getItem('business_name') || undefined; } catch { return undefined; }
  })();

  const openShareLedger = async () => {
    setShareMenuAnchor(null);
    try {
      const { data } = await api.get(`/parties/${party.id}/ledger/`);
      const text = formatLedgerMessage(party, data, businessName);
      setShareDialog({ title: 'Share account statement', text });
    } catch (e: any) {
      notify({ severity: 'error', message: e?.response?.data?.detail || 'Failed to load ledger' });
    }
  };
  const startInvoiceShare = () => {
    setShareMenuAnchor(null);
    setTab(1);
    setInvoiceSelectMode(true);
  };
  const startPaymentShare = () => {
    setShareMenuAnchor(null);
    setTab(2);
    setPaymentSelectMode(true);
  };

  const shareSelectedInvoices = () => {
    const picked = invoiceRows.filter((r) => selectedInvoiceIds.has(r.id));
    if (picked.length === 0) {
      notify({ severity: 'info', message: 'Pick at least one invoice to share.' });
      return;
    }
    setShareDialog({
      title: `Share ${picked.length} invoice${picked.length > 1 ? 's' : ''}`,
      text: formatInvoicesMessage(party, picked, businessName),
    });
  };
  const shareSelectedPayments = () => {
    const picked = paymentRows.filter((r) => selectedPaymentIds.has(r.id));
    if (picked.length === 0) {
      notify({ severity: 'info', message: 'Pick at least one payment to share.' });
      return;
    }
    setShareDialog({
      title: `Share ${picked.length} payment${picked.length > 1 ? 's' : ''}`,
      text: formatPaymentsMessage(party, picked, businessName),
    });
  };

  const exitShareMode = () => {
    setInvoiceSelectMode(false);
    setPaymentSelectMode(false);
    setSelectedInvoiceIds(new Set());
    setSelectedPaymentIds(new Set());
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }} justifyContent="space-between">
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }} noWrap>
                {party.display_name || party.name}
              </Typography>
              <Chip
                size="small"
                label={party.type === 'both' ? 'Customer + Supplier' : party.type}
                sx={{ textTransform: 'capitalize', fontWeight: 700 }}
              />
              {party.is_active === false && <Chip size="small" label="Inactive" color="default" />}
            </Stack>
            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center" sx={{ color: 'text.secondary' }}>
              {party.gstin && (
                <Typography variant="body2" sx={{ fontFamily: '"IBM Plex Mono", monospace' }}>
                  {party.gstin}
                </Typography>
              )}
              {party.state && <Typography variant="body2">· {party.state}</Typography>}
              {party.phone && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PhoneIcon sx={{ fontSize: 14 }} />
                  <Typography variant="body2">{party.phone}</Typography>
                </Stack>
              )}
              {party.whatsapp && party.whatsapp !== party.phone && (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: '#25D366' }}>
                  <WhatsAppIcon sx={{ fontSize: 14 }} />
                  <Typography variant="body2">{party.whatsapp}</Typography>
                </Stack>
              )}
              {party.email && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <EmailIcon sx={{ fontSize: 14 }} />
                  <Typography variant="body2">{party.email}</Typography>
                </Stack>
              )}
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<ShareIcon />} size="small" variant="contained"
              sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1ebe57' } }}
              onClick={(e) => setShareMenuAnchor(e.currentTarget)}
            >
              Share
            </Button>
            <Menu
              anchorEl={shareMenuAnchor} open={!!shareMenuAnchor}
              onClose={() => setShareMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={openShareLedger}>
                <ReceiptLongIcon fontSize="small" sx={{ mr: 1.5 }} />
                Share full account statement
              </MenuItem>
              <MenuItem onClick={startInvoiceShare}>
                <PaidIcon fontSize="small" sx={{ mr: 1.5 }} />
                Pick invoices to share…
              </MenuItem>
              <MenuItem onClick={startPaymentShare}>
                <HourglassBottomIcon fontSize="small" sx={{ mr: 1.5 }} />
                Pick payments to share…
              </MenuItem>
            </Menu>
            {onEdit && (
              <Button startIcon={<EditIcon />} size="small" variant="outlined" onClick={() => onEdit(party)}>
                Edit
              </Button>
            )}
            {onDelete && (
              <Tooltip title="Delete party">
                <IconButton size="small" onClick={() => onDelete(party)} sx={{ color: 'error.main' }}>
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {summaryErr && <Alert severity="error" sx={{ mt: 2 }}>{summaryErr}</Alert>}

        {/* Stat cards */}
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Total invoiced"
              value={summary ? formatMoney(Number(summary.invoices.total), { short: true }) : '—'}
              accent="#4FC3F7"
              icon={<ReceiptLongIcon fontSize="small" />}
              hint={summary ? `${summary.invoices.count} invoices` : undefined}
              index={0}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Paid"
              value={summary ? formatMoney(Number(summary.invoices.paid), { short: true }) : '—'}
              accent="#00E676"
              icon={<PaidIcon fontSize="small" />}
              hint={summary?.last_payment?.date
                ? `Last: ${dayjs(summary.last_payment.date).format('DD MMM')}`
                : undefined}
              index={1}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label={summary && Number(summary.advance_held) > 0 ? 'Advance held' : 'Pending'}
              value={summary
                ? (Number(summary.advance_held) > 0
                    ? formatMoney(Number(summary.advance_held), { short: true })
                    : formatMoney(Number(summary.invoices.pending_amount), { short: true }))
                : '—'}
              accent={summary && Number(summary.advance_held) > 0 ? '#4FC3F7' : '#FFB300'}
              icon={<HourglassBottomIcon fontSize="small" />}
              hint={summary
                ? (Number(summary.advance_held) > 0
                    ? 'unallocated overpayment'
                    : `${summary.invoices.pending_count} unpaid`)
                : undefined}
              index={2}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Overdue"
              value={summary ? formatMoney(Number(summary.invoices.overdue_amount), { short: true }) : '—'}
              accent="#FF5252"
              icon={<ErrorOutlineIcon fontSize="small" />}
              hint={summary
                ? (summary.invoices.overdue_count > 0
                    ? `${summary.invoices.overdue_count} past due`
                    : 'On time')
                : undefined}
              index={3}
            />
          </Grid>
        </Grid>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 1.5, minHeight: 40 }}
      >
        <Tab label="Ledger" sx={{ minHeight: 40, textTransform: 'none' }} />
        <Tab label="Invoices" sx={{ minHeight: 40, textTransform: 'none' }} />
        <Tab label="Payments" sx={{ minHeight: 40, textTransform: 'none' }} />
        <Tab label="Info" sx={{ minHeight: 40, textTransform: 'none' }} />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {tab === 0 && <LedgerTab partyId={party.id} />}
        {tab === 1 && (
          <InvoicesTab
            partyId={party.id}
            selectMode={invoiceSelectMode}
            selectedIds={selectedInvoiceIds}
            onToggle={(id) => setSelectedInvoiceIds((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })}
            onSelectAll={(ids) => setSelectedInvoiceIds(new Set(ids))}
            onClearSelection={() => setSelectedInvoiceIds(new Set())}
            onRowsLoaded={setInvoiceRows}
            onShare={shareSelectedInvoices}
            onCancelSelectMode={exitShareMode}
          />
        )}
        {tab === 2 && (
          <PaymentsTab
            partyId={party.id}
            selectMode={paymentSelectMode}
            selectedIds={selectedPaymentIds}
            onToggle={(id) => setSelectedPaymentIds((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })}
            onSelectAll={(ids) => setSelectedPaymentIds(new Set(ids))}
            onClearSelection={() => setSelectedPaymentIds(new Set())}
            onRowsLoaded={setPaymentRows}
            onShare={shareSelectedPayments}
            onCancelSelectMode={exitShareMode}
          />
        )}
        {tab === 3 && <InfoTab party={party} onRefresh={onRefresh} />}
      </Box>

      {shareDialog && (
        <SharePreviewDialog
          title={shareDialog.title}
          initialText={shareDialog.text}
          phone={party.whatsapp || party.phone || ''}
          onClose={() => setShareDialog(null)}
        />
      )}
    </Paper>
  );
}

// ---------- Share preview dialog -----------------------------------------

function SharePreviewDialog({ title, initialText, phone, onClose }: {
  title: string; initialText: string; phone: string; onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WhatsAppIcon sx={{ color: '#25D366' }} />
          <Typography variant="h6" component="span">{title}</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Edit the message before sending. WhatsApp will open in a new tab.
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth multiline minRows={10} maxRows={20}
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputProps={{
            style: { fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 },
          }}
        />
        {!phone && (
          <Alert severity="info" sx={{ mt: 1 }}>
            No phone or WhatsApp number on this party. WhatsApp will let you pick a contact.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          startIcon={<ContentCopyIcon />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              notify({ severity: 'success', message: 'Copied to clipboard' });
            } catch {
              notify({ severity: 'error', message: 'Could not copy' });
            }
          }}
        >
          Copy
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained" startIcon={<SendIcon />}
          sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1ebe57' } }}
          onClick={() => { openWhatsApp(phone, text); onClose(); }}
        >
          Send via WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------- Ledger tab ----------------------------------------------------

function LedgerTab({ partyId }: { partyId: string }) {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setRows(null);
    setErr('');
    api.get(`/parties/${partyId}/ledger/`)
      .then((r) => setRows(r.data))
      .catch((e) => setErr(e?.response?.data?.detail || e?.message || 'Failed to load ledger'));
  }, [partyId]);

  if (err) return <Alert severity="error">{err}</Alert>;
  if (rows === null) return <Skeleton variant="rounded" height={300} />;
  if (rows.length === 0) {
    return <EmptyState
      compact
      title="No ledger entries yet"
      body="Sales invoices, payments and opening balances will appear here."
    />;
  }

  return (
    <Paper variant="outlined">
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: '110px 90px 1fr 130px 130px 150px',
        bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
        px: 1.5, py: 1, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
        textTransform: 'uppercase', color: 'text.secondary',
        borderBottom: 1, borderColor: 'divider',
      }}>
        <Box>Date</Box>
        <Box>Type</Box>
        <Box>Reference</Box>
        <Box sx={{ textAlign: 'right' }}>Debit</Box>
        <Box sx={{ textAlign: 'right' }}>Credit</Box>
        <Box sx={{ textAlign: 'right' }}>Balance</Box>
      </Box>
      {rows.map((r, i) => {
        const debit = Number(r.debit);
        const credit = Number(r.credit);
        const bal = Number(r.running_balance);
        return (
          <Box key={i} sx={{
            display: 'grid',
            gridTemplateColumns: '110px 90px 1fr 130px 130px 150px',
            px: 1.5, py: 1, alignItems: 'center', fontSize: 13,
            borderBottom: 1, borderColor: 'divider',
            '&:hover': { bgcolor: (t) => alpha(t.palette.text.primary, 0.025) },
          }}>
            <Box sx={{ color: 'text.secondary' }}>{dayjs(r.date).format('DD MMM YY')}</Box>
            <Box>
              <Chip size="small" label={r.ref_type} sx={{ height: 20, fontSize: 10, textTransform: 'capitalize' }} />
            </Box>
            <Typography variant="body2" noWrap
              sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 600 }}>
              {r.ref_number || r.ref_id?.slice(0, 8)}
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              {debit > 0 ? <MoneyDisplay value={debit} /> : <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>}
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              {credit > 0 ? <MoneyDisplay value={credit} /> : <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>}
            </Box>
            <Box sx={{ textAlign: 'right', fontWeight: 700,
              color: bal > 0 ? '#FFB300' : bal < 0 ? '#00E676' : 'text.primary',
            }}>
              {bal === 0 ? '—' : (
                <>
                  <MoneyDisplay value={Math.abs(bal)} />
                  <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.secondary' }}>
                    {bal > 0 ? 'Dr' : 'Cr'}
                  </Typography>
                </>
              )}
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
}

// ---------- Invoices tab --------------------------------------------------

type SelectableTabProps = {
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onRowsLoaded: (rows: any[]) => void;
  onShare: () => void;
  onCancelSelectMode: () => void;
};

function InvoicesTab({
  partyId, selectMode, selectedIds, onToggle, onSelectAll, onClearSelection,
  onRowsLoaded, onShare, onCancelSelectMode,
}: { partyId: string } & SelectableTabProps) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setRows(null);
    setErr('');
    api.get('/sales/invoices/', { params: { party: partyId, page_size: 100 } })
      .then((r) => {
        const list = listOf(r.data);
        setRows(list);
        onRowsLoaded(list);
      })
      .catch((e) => setErr(e?.response?.data?.detail || e?.message || 'Failed to load invoices'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  const allIds = useMemo(() => (rows || []).map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const unpaidIds = useMemo(
    () => (rows || []).filter((r) => r.status !== 'paid' && r.status !== 'cancelled').map((r) => r.id),
    [rows],
  );

  if (err) return <Alert severity="error">{err}</Alert>;
  if (rows === null) return <Skeleton variant="rounded" height={260} />;
  if (rows.length === 0) {
    return <EmptyState compact title="No invoices yet" body="Create a new sales invoice for this party to see it here." />;
  }

  return (
    <Stack spacing={1}>
      {selectMode && (
        <Paper variant="outlined" sx={{
          p: 1, position: 'sticky', top: 0, zIndex: 5,
          bgcolor: (t) => alpha('#25D366', t.palette.mode === 'dark' ? 0.12 : 0.08),
          borderColor: (t) => alpha('#25D366', 0.4),
        }}>
          <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap">
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={selectedIds.size > 0 && !allSelected}
              onChange={() => allSelected ? onClearSelection() : onSelectAll(allIds)}
            />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {selectedIds.size} selected
            </Typography>
            <Button size="small" onClick={() => onSelectAll(unpaidIds)}
              disabled={unpaidIds.length === 0}>
              Pick unpaid only ({unpaidIds.length})
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={onCancelSelectMode}>Cancel</Button>
            <Button
              size="small" variant="contained"
              startIcon={<WhatsAppIcon />}
              sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1ebe57' } }}
              disabled={selectedIds.size === 0}
              onClick={onShare}
            >
              Share via WhatsApp
            </Button>
          </Stack>
        </Paper>
      )}

      {rows.map((inv) => {
        const grand = Number(inv.grand_total || 0);
        const paid = Number(inv.amount_paid || 0);
        const pending = grand - paid;
        const checked = selectedIds.has(inv.id);
        return (
          <Paper
            key={inv.id} variant="outlined"
            sx={{
              p: 1.5, cursor: selectMode ? 'pointer' : 'default',
              borderColor: selectMode && checked ? '#25D366' : 'divider',
              bgcolor: (t) => selectMode && checked
                ? alpha('#25D366', t.palette.mode === 'dark' ? 0.1 : 0.06)
                : 'background.paper',
            }}
            onClick={() => { if (selectMode) onToggle(inv.id); }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
              {selectMode && (
                <Checkbox size="small" checked={checked}
                  onChange={() => onToggle(inv.id)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ p: 0.5 }} />
              )}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}>
                    {inv.number || inv.id.slice(0, 8)}
                  </Typography>
                  <Chip size="small" label={inv.status}
                    sx={{ textTransform: 'capitalize', height: 20, fontSize: 10, fontWeight: 700 }}
                    color={inv.status === 'paid' ? 'success'
                      : inv.status === 'partial' ? 'info'
                      : inv.status === 'cancelled' ? 'default'
                      : 'warning'} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {dayjs(inv.date).format('DD MMM YYYY')}
                  {inv.due_date && ` · due ${dayjs(inv.due_date).format('DD MMM')}`}
                </Typography>
              </Box>
              <Stack alignItems="flex-end">
                <MoneyDisplay value={grand} sx={{ fontWeight: 700 }} />
                {pending > 0 && (
                  <Typography variant="caption" sx={{ color: '#FFB300' }}>
                    Pending <MoneyDisplay value={pending} fractionDigits={0} />
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

// ---------- Payments tab --------------------------------------------------

function PaymentsTab({
  partyId, selectMode, selectedIds, onToggle, onSelectAll, onClearSelection,
  onRowsLoaded, onShare, onCancelSelectMode,
}: { partyId: string } & SelectableTabProps) {
  const { drCr } = useDrCrMode();
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setRows(null);
    setErr('');
    api.get('/payments/', { params: { party: partyId, page_size: 100 } })
      .then((r) => {
        const list = listOf(r.data);
        setRows(list);
        onRowsLoaded(list);
      })
      .catch((e) => setErr(e?.response?.data?.detail || e?.message || 'Failed to load payments'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  const allIds = useMemo(() => (rows || []).map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const receivedIds = useMemo(
    () => (rows || []).filter((r) => r.direction === 'in').map((r) => r.id),
    [rows],
  );

  if (err) return <Alert severity="error">{err}</Alert>;
  if (rows === null) return <Skeleton variant="rounded" height={220} />;
  if (rows.length === 0) {
    return <EmptyState compact title="No payments yet" body="Receipts and payouts for this party will appear here." />;
  }

  return (
    <Stack spacing={1}>
      {selectMode && (
        <Paper variant="outlined" sx={{
          p: 1, position: 'sticky', top: 0, zIndex: 5,
          bgcolor: (t) => alpha('#25D366', t.palette.mode === 'dark' ? 0.12 : 0.08),
          borderColor: (t) => alpha('#25D366', 0.4),
        }}>
          <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap">
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={selectedIds.size > 0 && !allSelected}
              onChange={() => allSelected ? onClearSelection() : onSelectAll(allIds)}
            />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {selectedIds.size} selected
            </Typography>
            <Button size="small" onClick={() => onSelectAll(receivedIds)}
              disabled={receivedIds.length === 0}>
              Received only ({receivedIds.length})
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={onCancelSelectMode}>Cancel</Button>
            <Button
              size="small" variant="contained"
              startIcon={<WhatsAppIcon />}
              sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1ebe57' } }}
              disabled={selectedIds.size === 0}
              onClick={onShare}
            >
              Share via WhatsApp
            </Button>
          </Stack>
        </Paper>
      )}

      {rows.map((p) => {
        const checked = selectedIds.has(p.id);
        return (
          <Paper
            key={p.id} variant="outlined"
            sx={{
              p: 1.5, cursor: selectMode ? 'pointer' : 'default',
              borderColor: selectMode && checked ? '#25D366' : 'divider',
              bgcolor: (t) => selectMode && checked
                ? alpha('#25D366', t.palette.mode === 'dark' ? 0.1 : 0.06)
                : 'background.paper',
            }}
            onClick={() => { if (selectMode) onToggle(p.id); }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
              {selectMode && (
                <Checkbox size="small" checked={checked}
                  onChange={() => onToggle(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ p: 0.5 }} />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}>
                    {p.number || p.id.slice(0, 8)}
                  </Typography>
                  <Chip size="small"
                    label={directionLabel(p.direction, drCr)}
                    color={p.direction === 'in' ? 'success' : 'warning'}
                    sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                  <Chip size="small" label={p.mode} sx={{
                    height: 20, fontSize: 10, textTransform: 'uppercase', fontWeight: 700,
                  }} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {dayjs(p.date).format('DD MMM YYYY')}
                </Typography>
              </Box>
              <MoneyDisplay value={Number(p.amount || 0)} sx={{ fontWeight: 700 }} />
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

// ---------- Info tab ------------------------------------------------------

function InfoTab({ party }: { party: any; onRefresh: () => void }) {
  const billing = party.addresses?.find((a: any) => a.type === 'billing');
  const shipping = party.addresses?.find((a: any) => a.type === 'shipping');
  const primaryContact = party.contacts?.find((c: any) => c.is_primary) || party.contacts?.[0];
  const defaultBank = party.bank_accounts?.find((b: any) => b.is_default) || party.bank_accounts?.[0];

  return (
    <Stack spacing={2}>
      <InfoCard title="Contact">
        <KV label="Phone" value={party.phone || '—'} />
        <KV label="WhatsApp" value={party.whatsapp || '—'} />
        <KV label="Email" value={party.email || '—'} />
        <KV label="Tags" value={party.tags || '—'} />
      </InfoCard>

      <InfoCard title="GST & tax">
        <KV label="Treatment" value={party.gst_treatment || '—'} />
        <KV label="GSTIN" value={party.gstin || '—'} mono />
        <KV label="PAN" value={party.pan || '—'} mono />
        <KV label="State" value={party.state ? `${party.state} (${party.state_code})` : '—'} />
        <KV label="Place of supply" value={party.place_of_supply || '—'} />
      </InfoCard>

      <InfoCard title="Credit & terms">
        <KV label="Payment terms" value={party.payment_terms?.replace(/_/g, ' ') || '—'} />
        <KV label="Credit days" value={String(party.credit_days ?? 0)} />
        <KV label="Credit limit"
          value={Number(party.credit_limit) ? formatMoney(Number(party.credit_limit)) : '—'} />
        <KV label="Current balance"
          value={Number(party.current_balance) ? formatMoney(Number(party.current_balance)) : '—'} />
        <KV label="Block on over-limit" value={party.block_if_credit_exceeded ? 'Yes' : 'No'} />
      </InfoCard>

      <InfoCard title="Primary contact">
        {primaryContact ? (
          <>
            <KV label="Name" value={primaryContact.name || '—'} />
            <KV label="Designation" value={primaryContact.designation || '—'} />
            <KV label="Phone" value={primaryContact.phone || '—'} />
            <KV label="Email" value={primaryContact.email || '—'} />
          </>
        ) : <Typography variant="body2" color="text.secondary">No contacts on file.</Typography>}
      </InfoCard>

      <InfoCard title="Billing address">
        {billing ? <AddressBlock a={billing} /> : <Typography variant="body2" color="text.secondary">—</Typography>}
      </InfoCard>

      <InfoCard title="Shipping address">
        {shipping ? <AddressBlock a={shipping} /> : <Typography variant="body2" color="text.secondary">—</Typography>}
      </InfoCard>

      <InfoCard title="Default bank">
        {defaultBank ? (
          <>
            <KV label="Bank" value={defaultBank.bank_name || '—'} />
            <KV label="Account no." value={defaultBank.account_number || '—'} mono />
            <KV label="IFSC" value={defaultBank.ifsc || '—'} mono />
            <KV label="UPI" value={defaultBank.upi_id || '—'} mono />
          </>
        ) : <Typography variant="body2" color="text.secondary">No bank on file.</Typography>}
      </InfoCard>
    </Stack>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.75 }}>
      <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.6 }}>
        {title}
      </Typography>
      <Divider sx={{ my: 1 }} />
      <Stack spacing={0.5}>{children}</Stack>
    </Paper>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 0.25 }}>
      <Typography variant="caption" color="text.secondary" sx={{ width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{
        fontFamily: mono ? '"IBM Plex Mono", monospace' : undefined,
        wordBreak: 'break-word',
      }}>
        {value}
      </Typography>
    </Stack>
  );
}

function AddressBlock({ a }: { a: any }) {
  const lines = [a.address_line1, a.address_line2, [a.city, a.pincode].filter(Boolean).join(' - '), [a.state, a.state_code && `(${a.state_code})`].filter(Boolean).join(' ')]
    .filter(Boolean);
  return (
    <Box>
      {lines.map((l, i) => (
        <Typography key={i} variant="body2">{l}</Typography>
      ))}
      {a.gstin && (
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"IBM Plex Mono", monospace', mt: 0.5, display: 'block' }}>
          GSTIN {a.gstin}
        </Typography>
      )}
    </Box>
  );
}
