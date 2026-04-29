import { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, FormHelperText, Grid, IconButton, MenuItem,
  Paper, Stack, Switch, TextField, Typography, Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyIcon from '@mui/icons-material/Key';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { api } from '@/app/api';
import Can, { useCan } from '@/components/Can';

type Member = {
  id: string; user_id: string; email: string;
  first_name: string; last_name: string;
  role: string; is_active: boolean;
  allowed_branch_ids?: string[];
  default_branch_id?: string | null;
};

type BranchLite = { id: string; code: string; name: string; is_default: boolean; is_active: boolean };

const ROLES = ['owner', 'admin', 'accountant', 'staff'];
const ROLE_COLOR: Record<string, any> = {
  owner: 'primary', admin: 'secondary', accountant: 'info', staff: 'default',
};

const EMPTY_INVITE = {
  email: '', first_name: '', last_name: '', role: 'staff', password: '',
  allowed_branch_ids: [] as string[],
  default_branch_id: '' as string,
};

export default function Team() {
  const [rows, setRows] = useState<Member[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_INVITE);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempEmail, setTempEmail] = useState<string | null>(null);
  const [editAccess, setEditAccess] = useState<Member | null>(null);
  const [accessAllowed, setAccessAllowed] = useState<string[]>([]);
  const [accessDefault, setAccessDefault] = useState<string>('');
  const canEdit = useCan('staff.users.edit');
  const canDelete = useCan('staff.users.delete');

  const load = async () => {
    setErr('');
    try {
      const { data } = await api.get('/tenants/memberships/');
      setRows(data.results ?? data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Failed to load team');
    }
  };

  const loadBranches = async () => {
    try {
      const { data } = await api.get('/branches/', { params: { page_size: 200 } });
      const list: BranchLite[] = (data.results ?? data) || [];
      setBranches(list.filter((b) => b.is_active));
    } catch {
      setBranches([]);
    }
  };

  useEffect(() => { load(); loadBranches(); }, []);

  const invite = async () => {
    setErr(''); setMsg(''); setTempPassword(null); setTempEmail(null);
    try {
      const body: any = {
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
      };
      if (form.password) body.password = form.password;
      // Only send branch lock when relevant — owners/admins are
      // unrestricted by design, and an empty list means "all branches"
      // server-side, so omit it for non-locked invites to keep the
      // payload tidy.
      if (form.role !== 'owner' && form.role !== 'admin' && form.allowed_branch_ids.length) {
        body.allowed_branch_ids = form.allowed_branch_ids;
        body.default_branch_id = form.default_branch_id || null;
      }
      const { data } = await api.post('/tenants/memberships/invite/', body);
      setMsg(
        data.user_created
          ? `Added ${data.membership.email} — new user created.`
          : `Added ${data.membership.email} to this business.`,
      );
      if (data.temporary_password) {
        setTempPassword(data.temporary_password);
        setTempEmail(data.membership.email);
      }
      setForm(EMPTY_INVITE);
      setOpen(false);
      load();
    } catch (e: any) {
      setErr(
        e?.response?.data?.detail
          || JSON.stringify(e?.response?.data || {})
          || 'Invite failed',
      );
    }
  };

  const openAccess = (m: Member) => {
    setEditAccess(m);
    setAccessAllowed(m.allowed_branch_ids || []);
    setAccessDefault(m.default_branch_id || '');
  };
  const saveAccess = async () => {
    if (!editAccess) return;
    try {
      // Default must belong to the chosen allowed list — clamp on save.
      const def = accessAllowed.includes(accessDefault) ? accessDefault : '';
      await api.patch(`/tenants/memberships/${editAccess.id}/`, {
        allowed_branch_ids: accessAllowed,
        default_branch_id: def || null,
      });
      setEditAccess(null);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Failed to update access');
    }
  };

  const resetPassword = async (id: string, email: string) => {
    if (!confirm(`Generate a new temporary password for ${email}?\nThe old password will stop working.`)) return;
    setErr(''); setMsg(''); setTempPassword(null); setTempEmail(null);
    try {
      const { data } = await api.post(`/tenants/memberships/${id}/reset-password/`);
      setTempPassword(data.temporary_password);
      setTempEmail(data.email);
      setMsg(`New password generated for ${data.email}.`);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Reset failed');
    }
  };

  const changeRole = async (id: string, role: string) => {
    try {
      await api.patch(`/tenants/memberships/${id}/`, { role });
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Role change failed');
    }
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    try {
      await api.patch(`/tenants/memberships/${id}/`, { is_active });
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Update failed');
    }
  };

  const remove = async (id: string, email: string) => {
    if (!confirm(`Remove ${email} from this business?`)) return;
    try {
      await api.delete(`/tenants/memberships/${id}/`);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Remove failed');
    }
  };

  const cols: GridColDef[] = [
    {
      field: 'display', headerName: 'Name', flex: 1,
      valueGetter: (_v, row) =>
        `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—',
    },
    { field: 'email', headerName: 'Email', flex: 1 },
    {
      field: 'role', headerName: 'Role', width: 170,
      renderCell: (p) => (
        <TextField
          select size="small" value={p.value}
          onChange={(e) => changeRole(p.row.id, e.target.value)}
          sx={{ minWidth: 140 }}
          SelectProps={{ renderValue: (v: any) => (
            <Chip size="small" label={v} color={ROLE_COLOR[v] || 'default'} />
          ) }}
        >
          {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
      ),
    },
    {
      field: 'is_active', headerName: 'Active', width: 100,
      renderCell: (p) => (
        <Switch size="small" checked={p.value}
                onChange={(e) => toggleActive(p.row.id, e.target.checked)} />
      ),
    },
    {
      field: 'branch_access', headerName: 'Branch access', width: 220, sortable: false,
      renderCell: (p) => {
        const ids: string[] = p.row.allowed_branch_ids || [];
        if (p.row.role === 'owner' || p.row.role === 'admin') {
          return <Chip size="small" label="All (admin)" variant="outlined" />;
        }
        if (ids.length === 0) {
          return <Chip size="small" label="All branches" />;
        }
        const codes = ids
          .map((id) => branches.find((b) => b.id === id)?.code || '?')
          .slice(0, 3)
          .join(', ');
        const more = ids.length > 3 ? ` +${ids.length - 3}` : '';
        return <Chip size="small" color="primary" label={`${codes}${more}`} />;
      },
    },
    {
      field: 'actions', headerName: '', width: 150, sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0.5}>
          {canEdit && (
            <Tooltip title="Branch access">
              <IconButton size="small" onClick={() => openAccess(p.row)}>
                <AccountTreeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Reset password">
              <IconButton size="small" onClick={() => resetPassword(p.row.id, p.row.email)}>
                <KeyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Remove">
              <IconButton size="small" onClick={() => remove(p.row.id, p.row.email)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Team</Typography>
        <Can permission="staff.users.create">
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen(true)}>
            Add member
          </Button>
        </Can>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}
      {tempPassword && (
        <Alert severity="warning" sx={{ mb: 2 }}
               onClose={() => { setTempPassword(null); setTempEmail(null); }}
               action={
                 <Tooltip title="Copy password">
                   <IconButton size="small" onClick={() => navigator.clipboard.writeText(tempPassword)}>
                     <ContentCopyIcon fontSize="small" />
                   </IconButton>
                 </Tooltip>
               }>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Login credentials for {tempEmail ? <strong>{tempEmail}</strong> : 'this user'}:
          </Typography>
          <Typography variant="body2">
            Password: <code style={{ fontSize: '1.05em', padding: '2px 6px', background: 'rgba(0,0,0,0.06)', borderRadius: 4 }}>{tempPassword}</code>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Share it securely — it won't be shown again. The user can change it from their profile after logging in.
          </Typography>
        </Alert>
      )}

      <Paper>
        <DataGrid autoHeight rows={rows} columns={cols} getRowId={(r) => r.id}
                  pageSizeOptions={[25, 50]} disableRowSelectionOnClick />
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add team member</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            If the email belongs to an existing user, they'll be added to this business.
            Otherwise a new user is created and a temporary password is returned.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth type="email" label="Email" required
                         value={form.email}
                         onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="First name"
                         value={form.first_name}
                         onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Last name"
                         value={form.last_name}
                         onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Role"
                         value={form.role}
                         onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Temporary password (optional)"
                         value={form.password}
                         onChange={(e) => setForm({ ...form, password: e.target.value })}
                         helperText="Leave blank to auto-generate." />
            </Grid>
            {form.role !== 'owner' && form.role !== 'admin' && branches.length > 1 && (
              <>
                <Grid item xs={12}>
                  <Autocomplete
                    multiple disableCloseOnSelect
                    options={branches}
                    getOptionLabel={(b) => `${b.code} · ${b.name}`}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    value={branches.filter((b) => form.allowed_branch_ids.includes(b.id))}
                    onChange={(_, picked) => {
                      const ids = picked.map((b) => b.id);
                      const def = ids.includes(form.default_branch_id) ? form.default_branch_id : (ids[0] || '');
                      setForm({ ...form, allowed_branch_ids: ids, default_branch_id: def });
                    }}
                    renderOption={(props, option, { selected }) => (
                      <li {...props}>
                        <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                        {option.code} · {option.name}
                      </li>
                    )}
                    renderInput={(params) => (
                      <TextField {...params} label="Allowed branches"
                        helperText="Empty = all branches. Pick one or more to lock this user." />
                    )}
                  />
                </Grid>
                {form.allowed_branch_ids.length > 0 && (
                  <Grid item xs={12} sm={6}>
                    <TextField select fullWidth label="Land on (default branch)"
                               value={form.default_branch_id}
                               onChange={(e) => setForm({ ...form, default_branch_id: e.target.value })}>
                      {form.allowed_branch_ids.map((id) => {
                        const b = branches.find((x) => x.id === id);
                        return b ? <MenuItem key={id} value={id}>{b.code} · {b.name}</MenuItem> : null;
                      })}
                    </TextField>
                    <FormHelperText>The branch they'll see right after login.</FormHelperText>
                  </Grid>
                )}
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={invite} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editAccess} onClose={() => setEditAccess(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Branch access — {editAccess?.email}</DialogTitle>
        <DialogContent>
          {editAccess && (editAccess.role === 'owner' || editAccess.role === 'admin') ? (
            <Alert severity="info">
              Owners and admins always have access to every branch — branch lock doesn't apply to this role.
            </Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Autocomplete
                multiple disableCloseOnSelect
                options={branches}
                getOptionLabel={(b) => `${b.code} · ${b.name}`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                value={branches.filter((b) => accessAllowed.includes(b.id))}
                onChange={(_, picked) => {
                  const ids = picked.map((b) => b.id);
                  setAccessAllowed(ids);
                  if (!ids.includes(accessDefault)) setAccessDefault(ids[0] || '');
                }}
                renderOption={(props, option, { selected }) => (
                  <li {...props}>
                    <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                    {option.code} · {option.name}
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Allowed branches"
                    helperText="Empty = all branches (no lock)." />
                )}
              />
              {accessAllowed.length > 0 && (
                <TextField select fullWidth label="Default branch"
                           value={accessDefault}
                           onChange={(e) => setAccessDefault(e.target.value)}>
                  {accessAllowed.map((id) => {
                    const b = branches.find((x) => x.id === id);
                    return b ? <MenuItem key={id} value={id}>{b.code} · {b.name}</MenuItem> : null;
                  })}
                </TextField>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAccess(null)}>Cancel</Button>
          {editAccess && editAccess.role !== 'owner' && editAccess.role !== 'admin' && (
            <Button onClick={saveAccess} variant="contained">Save</Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
