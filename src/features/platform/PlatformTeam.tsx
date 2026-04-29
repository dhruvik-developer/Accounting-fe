import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, MenuItem, Stack, TextField, Tooltip,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import EmptyState from '@/components/EmptyState';

type PlatformUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  is_platform_admin: boolean;
  role: 'owner' | 'admin' | '';
  last_login: string | null;
  date_joined: string;
};

type Draft = { email: string; first_name: string; last_name: string; role: 'owner' | 'admin' };

const BLANK: Draft = { email: '', first_name: '', last_name: '', role: 'admin' };

export default function PlatformTeam() {
  const [rows, setRows] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [tempPw, setTempPw] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/platform/team/')
      .then(r => setRows(r.data.results ?? r.data))
      .catch(e => setErr(e?.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submitInvite = async () => {
    setErr(''); setMsg(''); setTempPw('');
    try {
      const r = await api.post('/platform/team/', draft);
      if (r.data?.temporary_password) setTempPw(r.data.temporary_password);
      setMsg(`${draft.role === 'owner' ? 'Owner' : 'Admin'} ${draft.email} added.`);
      setDraft(BLANK);
      setOpenInvite(false);
      load();
    } catch (e: any) {
      setErr(flatten(e));
    }
  };

  const promoteDemote = async (u: PlatformUser) => {
    const next = u.role === 'owner' ? 'admin' : 'owner';
    if (!confirm(`Change ${u.email} to ${next}?`)) return;
    try {
      await api.patch(`/platform/team/${u.id}/`, { role: next });
      setMsg(`${u.email} is now ${next}.`); load();
    } catch (e: any) { setErr(flatten(e)); }
  };

  const reactivate = async (u: PlatformUser) => {
    try {
      await api.patch(`/platform/team/${u.id}/`, { is_active: true });
      setMsg(`${u.email} re-activated.`); load();
    } catch (e: any) { setErr(flatten(e)); }
  };

  const revoke = async (u: PlatformUser) => {
    if (!confirm(`Revoke platform access for ${u.email}? They'll be deactivated.`)) return;
    try {
      await api.delete(`/platform/team/${u.id}/`);
      setMsg(`${u.email} revoked.`); load();
    } catch (e: any) { setErr(flatten(e)); }
  };

  const cols: GridColDef[] = [
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 220 },
    {
      field: 'role', headerName: 'Role', width: 130,
      renderCell: (p) => p.value
        ? <Chip size="small" color={p.value === 'owner' ? 'secondary' : 'primary'}
                label={p.value === 'owner' ? 'Owner' : 'Admin'} />
        : <Chip size="small" label="—" />,
    },
    {
      field: 'is_active', headerName: 'Status', width: 110,
      renderCell: (p) => <StatusPill status={p.value ? 'active' : 'inactive'} />,
    },
    { field: 'first_name', headerName: 'Name', width: 160,
      renderCell: (p) => `${p.row.first_name || ''} ${p.row.last_name || ''}`.trim() || '—' },
    {
      field: 'last_login', headerName: 'Last login', width: 160,
      valueFormatter: (v) => (v as string)?.slice(0, 16).replace('T', ' ') || 'Never',
    },
    {
      field: 'date_joined', headerName: 'Joined', width: 120,
      valueFormatter: (v) => (v as string)?.slice(0, 10) || '',
    },
    {
      field: 'actions', headerName: '', width: 180, sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={p.row.role === 'owner' ? 'Demote to Admin' : 'Promote to Owner'}>
            <IconButton size="small" onClick={() => promoteDemote(p.row)} disabled={!p.row.is_active}>
              <SwapVertOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {!p.row.is_active && (
            <Tooltip title="Re-activate">
              <IconButton size="small" onClick={() => reactivate(p.row)}>
                <RestartAltOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {p.row.is_active && (
            <Tooltip title="Revoke access">
              <IconButton size="small" color="error" onClick={() => revoke(p.row)}>
                <PersonRemoveOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Platform team"
        subtitle={rows.length ? `${rows.length} platform user${rows.length > 1 ? 's' : ''}` : undefined}
        actions={
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setOpenInvite(true)}>
            Add owner / admin
          </Button>
        }
      />

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}
      {tempPw && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Temporary password: <code style={{ fontWeight: 600 }}>{tempPw}</code>. Share it securely; the user should change it on first login.
        </Alert>
      )}

      <DataTable
        id="platform.team"
        rows={rows}
        columns={cols}
        loading={loading}
        getRowId={(r) => r.id}
        emptyState={<EmptyState title="No platform team yet" body="Invite a co-owner so the company never depends on a single account." />}
      />

      <Dialog open={openInvite} onClose={() => setOpenInvite(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add platform user</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Email" type="email" autoFocus value={draft.email}
                onChange={e => setDraft({ ...draft, email: e.target.value.toLowerCase() })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="First name" value={draft.first_name}
                onChange={e => setDraft({ ...draft, first_name: e.target.value })} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Last name" value={draft.last_name}
                onChange={e => setDraft({ ...draft, last_name: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField select fullWidth label="Role" value={draft.role}
                onChange={e => setDraft({ ...draft, role: e.target.value as 'owner' | 'admin' })}
                helperText={
                  draft.role === 'owner'
                    ? 'Full god-mode: edit plans, refunds, manage other admins.'
                    : 'Read-only platform data + customer-support actions. Cannot edit plans or coupons.'
                }>
                <MenuItem value="admin">Admin (support tier)</MenuItem>
                <MenuItem value="owner">Owner (full access)</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInvite(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitInvite} disabled={!draft.email}>
            Send invite
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
