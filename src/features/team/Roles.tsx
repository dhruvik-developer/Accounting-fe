import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import { api } from '@/app/api';
import RoleFormDialog from './RoleFormDialog';

type Role = {
  id: string; name: string; code: string; description: string;
  is_system: boolean; is_default: boolean;
  permission_count: number; member_count: number;
  created_at: string; updated_at: string;
};

export default function Roles() {
  const [rows, setRows] = useState<Role[]>([]);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setErr('');
    try {
      const { data } = await api.get('/rbac/roles/');
      setRows(data.results ?? data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Failed to load roles');
    }
  };

  useEffect(() => { load(); }, []);

  const startCreate = () => { setEditingId(null); setOpen(true); };
  const startEdit = (id: string) => { setEditingId(id); setOpen(true); };

  const remove = async (row: Role) => {
    if (row.is_system) return;
    if (!confirm(`Delete role "${row.name}"?`)) return;
    try {
      await api.delete(`/rbac/roles/${row.id}/`);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Delete failed');
    }
  };

  const cols: GridColDef<Role>[] = [
    {
      field: 'name', headerName: 'Role', flex: 1,
      renderCell: (p) => (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2">{p.row.name}</Typography>
          {p.row.is_system && (
            <Tooltip title="System role — cannot delete">
              <LockIcon fontSize="small" color="disabled" />
            </Tooltip>
          )}
        </Stack>
      ),
    },
    { field: 'description', headerName: 'Description', flex: 1.2 },
    {
      field: 'permission_count', headerName: 'Permissions', width: 130,
      renderCell: (p) => <Chip size="small" label={`${p.value} perms`} />,
    },
    {
      field: 'member_count', headerName: 'Members', width: 110,
      renderCell: (p) => <Chip size="small" color="primary" variant="outlined" label={p.value} />,
    },
    {
      field: 'actions', headerName: '', width: 110, sortable: false,
      renderCell: (p) => (
        <>
          <IconButton size="small" onClick={() => startEdit(p.row.id)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" disabled={p.row.is_system} onClick={() => remove(p.row)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Roles & Permissions</Typography>
          <Typography variant="body2" color="text.secondary">
            Create custom roles with granular permissions. Assign them to team members.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
          Create Role
        </Button>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      <Paper>
        <DataGrid
          autoHeight rows={rows} columns={cols} getRowId={(r) => r.id}
          pageSizeOptions={[25, 50]} disableRowSelectionOnClick
        />
      </Paper>

      <RoleFormDialog
        open={open}
        roleId={editingId}
        onClose={() => setOpen(false)}
        onSaved={() => { setOpen(false); load(); }}
      />
    </Box>
  );
}
