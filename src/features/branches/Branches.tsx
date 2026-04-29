/**
 * Standalone Branches page — top-level sidebar entry. CRUD against /branches/
 * with hero header, search, drawer-based form, and typed-confirm delete since
 * branches are referenced by invoices and other documents downstream.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, IconButton, Paper, Stack, TextField, Typography, alpha,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';

import { api } from '@/app/api';
import { formatApiError } from '@/app/errors';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { notify } from '@/components/Notifier';
import Can, { useCan } from '@/components/Can';
import BranchForm, { type BranchInput } from './BranchForm';

type BranchRow = BranchInput & { id: string };

export default function Branches() {
  const canEditPerm = useCan('staff.branches.edit');
  const canDeletePerm = useCan('staff.branches.delete');
  const [rows, setRows] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 200);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BranchRow | null>(null);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await api.get('/branches/');
      setRows((r.data.results ?? r.data) as BranchRow[]);
    } catch (e) {
      setErr(formatApiError(e, 'Failed to load branches'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      r.code.toLowerCase().includes(term)
      || r.name.toLowerCase().includes(term)
      || (r.state || '').toLowerCase().includes(term)
      || (r.gstin || '').toLowerCase().includes(term),
    );
  }, [rows, debouncedQ]);

  const onCreate = () => { setEditing(null); setFormOpen(true); };
  const onEdit = (b: BranchRow) => { setEditing(b); setFormOpen(true); };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/branches/${deleteTarget.id}/`);
      notify({ severity: 'success', message: `Removed "${deleteTarget.name}"` });
      setDeleteTarget(null);
      load();
    } catch (e) {
      setErr(formatApiError(e, 'Failed to delete branch'));
      setDeleteTarget(null);
    }
  };

  const cols: GridColDef<BranchRow>[] = [
    {
      field: 'code', headerName: 'Code', width: 120,
      renderCell: (p) => (
        <Typography variant="body2" sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}>
          {p.value}
        </Typography>
      ),
    },
    { field: 'name', headerName: 'Branch', flex: 1, minWidth: 180 },
    { field: 'state', headerName: 'State', width: 140 },
    { field: 'gstin', headerName: 'GSTIN', width: 160 },
    {
      field: 'is_default', headerName: 'Default', width: 110,
      renderCell: (p) => p.value
        ? <Chip size="small" label="Default" sx={{
            background: alpha('#00E676', 0.12), color: '#00E676',
            border: '1px solid rgba(0,230,118,0.32)', fontWeight: 700,
          }} />
        : null,
    },
    {
      field: 'is_active', headerName: 'Status', width: 100,
      renderCell: (p) => {
        const active = p.value !== false; // null/undefined → assume active
        return (
          <Chip size="small" label={active ? 'Active' : 'Inactive'} sx={{
            background: alpha(active ? '#4FC3F7' : '#FFB300', 0.12),
            color: active ? '#4FC3F7' : '#FFB300',
            border: `1px solid ${alpha(active ? '#4FC3F7' : '#FFB300', 0.32)}`,
            fontWeight: 700,
          }} />
        );
      },
    },
    {
      field: '__actions', headerName: '', width: 100, sortable: false, filterable: false,
      renderCell: (p) => (
        <>
          {canEditPerm && (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(p.row); }}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          )}
          {canDeletePerm && (
            <IconButton size="small" sx={{ color: '#FF5252' }}
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.row); }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          )}
        </>
      ),
    },
  ];

  return (
    <Box>
      {/* Hero header */}
      <Box sx={{
        position: 'relative',
        mx: { xs: -1.5, sm: -2, md: -3 },
        mt: { xs: -1.5, sm: -2, md: -3 },
        mb: 3,
        px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3 },
        overflow: 'hidden',
        borderBottom: '1px solid', borderColor: 'divider',
        background: (t) => t.palette.mode === 'dark'
          ? 'radial-gradient(900px 320px at 0% 0%, rgba(79,195,247,0.18), transparent 60%),'
            + 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
          : 'linear-gradient(180deg, rgba(79,195,247,0.06), transparent 100%)',
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2} sx={{ position: 'relative' }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flex: 1 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 1.5,
              display: 'grid', placeItems: 'center', color: '#fff',
              background: 'linear-gradient(135deg, #4FC3F7, #00E676)',
              boxShadow: '0 8px 22px rgba(79,195,247,0.35)',
            }}>
              <HubOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>Branches</Typography>
                <Chip size="small" label={`${rows.length} branches`} sx={{
                  height: 22, fontWeight: 700,
                  background: 'rgba(79,195,247,0.12)', color: '#4FC3F7',
                  border: '1px solid rgba(79,195,247,0.32)',
                }} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Multiple physical locations · GSTIN per branch · per-branch users and reports
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
            <Can permission="staff.branches.create"><Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>New branch</Button></Can>
          </Stack>
        </Stack>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      <Paper sx={{ p: 1.5, mb: 1.5 }}>
        <TextField
          size="small" placeholder="Search by code, name, state, GSTIN…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          InputProps={{
            startAdornment: <SearchOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />,
          }}
          sx={{ width: { xs: '100%', sm: 360 } }}
        />
      </Paper>

      {!loading && filtered.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <EmptyState
            icon={<HubOutlinedIcon />}
            title={debouncedQ ? 'No branches match' : 'No branches yet'}
            body={debouncedQ
              ? 'Try clearing the search.'
              : 'Add your first branch to scope inventory, GSTIN and reports per location.'}
            action={!debouncedQ
              ? <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>New branch</Button>
              : undefined}
          />
        </Paper>
      ) : (
        <Paper>
          <DataGrid
            autoHeight
            loading={loading}
            rows={filtered}
            columns={cols}
            getRowId={(r) => r.id}
            disableRowSelectionOnClick
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            pageSizeOptions={[10, 25, 50, 100]}
            onRowClick={(p) => onEdit(p.row as BranchRow)}
            sx={{
              border: 0,
              '& .MuiDataGrid-row:hover': { cursor: 'pointer' },
            }}
          />
        </Paper>
      )}

      <BranchForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(b) => {
          notify({ severity: 'success', message: editing?.id ? `Updated "${b.name}"` : `Created "${b.name}"` });
          load();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name}?`}
        body={
          <>
            <Typography>This branch will be removed.</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Documents already issued under it remain intact, but new invoices/bills won't be able to use it.
            </Typography>
          </>
        }
        tone="danger"
        confirmLabel="Delete branch"
        requireTypedConfirm={deleteTarget?.code}
        onConfirm={onDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
