/**
 * Parties — top-level container.
 *
 * Renders a 2-pane layout:
 *   • Left  : PartyList (search, filter, slim 4-col list)
 *   • Right : PartyDetail (header, KPI cards, ledger / invoices / payments / info tabs)
 *
 * State that lives here (and only here):
 *   • The full party list + masters (branches, accounts) needed by the form
 *   • The currently selected party id
 *   • Open/close + editing state of the create/edit wizard
 *
 * Data fetching for tab content is owned by PartyDetail so each tab can
 * lazy-load and show its own skeleton.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Stack, Typography, alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/app/api';
import useAutoOpenCreate from '@/hooks/useAutoOpenCreate';
import { useBranchModules } from '@/hooks/useBranchModules';
import { useCan } from '@/components/Can';
import { notify } from '@/components/Notifier';
import ConfirmDialog from '@/components/ConfirmDialog';
import PartyList from './PartyList';
import PartyDetail from './PartyDetail';
import PartyForm from './PartyForm';

const listOf = (data: any) => data?.results ?? data ?? [];
const describeError = (e: any) =>
  e?.response?.data?.detail
  || (e?.response?.data && JSON.stringify(e.response.data))
  || e?.message
  || 'Request failed';

export default function Parties() {
  const { canWrite, isModuleReadonly } = useBranchModules();
  const branchWritable = canWrite('module_parties');
  const readonly = isModuleReadonly('module_parties');
  // RBAC overlays branch-readonly: a user might have an admin role but
  // be on a read-only retail branch (or vice versa) — both must allow.
  const canCreate = useCan('masters.parties.create');
  const canEditPerm = useCan('masters.parties.edit');
  const canDeletePerm = useCan('masters.parties.delete');
  const writable = branchWritable && canCreate;
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  // Selection lives in the URL (`?party_id=…`) so the page is shareable —
  // e.g. paste the URL into a Slack DM or bookmark a customer.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('party_id');
  const setSelectedId = (id: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('party_id', id); else next.delete('party_id');
      return next;
    }, { replace: true });
  };
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const load = () => {
    setLoading(true);
    setErr('');
    return api.get('/parties/', { params: { page_size: 1000 } })
      .then((r) => {
        const list = listOf(r.data);
        setRows(list);
        // Keep current selection if still present, otherwise pick the first row.
        const stillThere = selectedId && list.some((p: any) => p.id === selectedId);
        if (!stillThere) setSelectedId(list[0]?.id ?? null);
      })
      .catch((e) => {
        setRows([]);
        setErr(describeError(e));
      })
      .finally(() => setLoading(false));
  };

  const loadMasters = () => Promise.all([
    api.get('/branches/').catch(() => ({ data: [] })),
    api.get('/accounting/accounts/').catch(() => ({ data: [] })),
  ]).then(([branchRes, accountRes]) => {
    setBranches(listOf(branchRes.data));
    setAccounts(listOf(accountRes.data));
  });

  useEffect(() => {
    load();
    loadMasters().catch((e) => setErr(describeError(e)));
  }, []);

  const startCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const startEdit = (party: any) => {
    setEditing(party);
    setFormOpen(true);
  };
  useAutoOpenCreate(startCreate);

  const onSaved = (saved: any) => {
    notify({
      severity: 'success',
      message: editing ? `Updated ${saved.name}` : `Created ${saved.name}`,
    });
    // Refresh list so balances/derived fields stay accurate, then jump to it.
    load().then(() => setSelectedId(saved.id));
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/parties/${deleteTarget.id}/`);
      notify({ severity: 'success', message: `Deleted ${deleteTarget.name}` });
      setDeleteTarget(null);
      // If we're deleting the selected party, clear selection.
      if (selectedId === deleteTarget.id) setSelectedId(null);
      load();
    } catch (e) {
      setErr(describeError(e));
      setDeleteTarget(null);
    }
  };

  return (
    <Box sx={{
      // Use viewport height minus the AppBar so the two panes fill the screen.
      height: 'calc(100vh - 96px)',
      display: 'flex', flexDirection: 'column',
    }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
            Parties
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Customers, suppliers — ledger, invoices and credit terms in one view.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {readonly && (
            <Chip size="small" label="Read-only at this branch"
              sx={{ height: 22, fontWeight: 700, color: '#FFB300',
                bgcolor: (t) => alpha('#FFB300', t.palette.mode === 'dark' ? 0.18 : 0.12),
                border: (t) => `1px solid ${alpha('#FFB300', 0.32)}` }} />
          )}
          <Button startIcon={<RefreshIcon />} onClick={() => { load(); loadMasters(); }}>
            Refresh
          </Button>
          {writable && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={startCreate}>
              New party
            </Button>
          )}
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setErr('')}>{err}</Alert>}

      <Box sx={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 360px) 1fr' },
        gap: 1.5,
      }}>
        <PartyList
          rows={rows}
          selectedId={selectedId}
          onSelect={setSelectedId}
          q={q} onQ={setQ}
          typeFilter={typeFilter} onTypeFilter={setTypeFilter}
          loading={loading}
        />

        {/* Right pane hidden on mobile when nothing is selected, so the list
            takes the full screen. Pick a party → the right pane opens. */}
        <Box sx={{
          display: { xs: selectedId ? 'block' : 'none', md: 'block' },
          minHeight: 0,
        }}>
          <PartyDetail
            party={selected}
            onEdit={branchWritable && canEditPerm ? startEdit : undefined}
            onDelete={branchWritable && canDeletePerm ? setDeleteTarget : undefined}
            onRefresh={load}
          />
        </Box>
      </Box>

      <PartyForm
        open={formOpen}
        editing={editing}
        branches={branches}
        accounts={accounts}
        onClose={() => setFormOpen(false)}
        onSaved={onSaved}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name}?`}
        body="This will remove the party and unlink them from any invoices. This cannot be undone."
        tone="danger"
        confirmLabel="Delete"
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
