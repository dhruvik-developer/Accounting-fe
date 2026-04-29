import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Grid, Switch, TextField,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';

type Flag = {
  id: string;
  slug: string;
  name: string;
  description: string;
  default_value: boolean;
  is_visible_in_ui: boolean;
};

const BLANK: Omit<Flag, 'id'> = {
  slug: '', name: '', description: '', default_value: false, is_visible_in_ui: true,
};

export default function PlatformFeatureFlags() {
  const [rows, setRows] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<Flag | null>(null);
  const [newDraft, setNewDraft] = useState<Omit<Flag, 'id'> | null>(null);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/platform/feature-flags/')
      .then(r => setRows(r.data.results ?? r.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    try {
      if (edit) await api.patch(`/platform/feature-flags/${edit.id}/`, edit);
      if (newDraft) await api.post('/platform/feature-flags/', newDraft);
      setEdit(null); setNewDraft(null); load();
    } catch (e: any) {
      setErr(JSON.stringify(e?.response?.data || e?.message || 'Save failed'));
    }
  };

  const cols: GridColDef[] = [
    { field: 'slug', headerName: 'Slug', width: 180 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
    { field: 'description', headerName: 'Description', flex: 2, minWidth: 240 },
    {
      field: 'default_value', headerName: 'Default', width: 100,
      renderCell: (p) => <Chip size="small" color={p.value ? 'success' : 'default'} label={p.value ? 'ON' : 'OFF'} />,
    },
    {
      field: 'is_visible_in_ui', headerName: 'UI', width: 80,
      renderCell: (p) => p.value ? '✓' : '—',
    },
    {
      field: 'actions', headerName: '', width: 80, sortable: false,
      renderCell: (p) => <Button size="small" startIcon={<EditOutlinedIcon fontSize="small" />} onClick={() => setEdit(p.row)}>Edit</Button>,
    },
  ];

  const draft = edit ?? newDraft;
  const dialogOpen = !!draft;

  return (
    <Box>
      <PageHeader
        title="Feature flags"
        subtitle={`${rows.length} flag${rows.length > 1 ? 's' : ''}`}
        actions={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setNewDraft({ ...BLANK })}>New flag</Button>}
      />
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      <DataTable id="platform.flags" rows={rows} columns={cols} loading={loading} getRowId={(r) => r.id} />

      <Dialog open={dialogOpen} onClose={() => { setEdit(null); setNewDraft(null); }} fullWidth maxWidth="sm">
        <DialogTitle>{edit ? 'Edit flag' : 'New flag'}</DialogTitle>
        <DialogContent>
          {draft && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Slug" value={draft.slug}
                  disabled={!!edit}
                  onChange={e => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                    if (edit) setEdit({ ...edit, slug: v });
                    else setNewDraft({ ...newDraft!, slug: v });
                  }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Name" value={draft.name}
                  onChange={e => {
                    if (edit) setEdit({ ...edit, name: e.target.value });
                    else setNewDraft({ ...newDraft!, name: e.target.value });
                  }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth multiline minRows={2} label="Description" value={draft.description}
                  onChange={e => {
                    if (edit) setEdit({ ...edit, description: e.target.value });
                    else setNewDraft({ ...newDraft!, description: e.target.value });
                  }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel control={
                  <Switch checked={draft.default_value} onChange={e => {
                    if (edit) setEdit({ ...edit, default_value: e.target.checked });
                    else setNewDraft({ ...newDraft!, default_value: e.target.checked });
                  }} />
                } label="Default ON" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel control={
                  <Switch checked={draft.is_visible_in_ui} onChange={e => {
                    if (edit) setEdit({ ...edit, is_visible_in_ui: e.target.checked });
                    else setNewDraft({ ...newDraft!, is_visible_in_ui: e.target.checked });
                  }} />
                } label="Visible in UI" />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEdit(null); setNewDraft(null); }}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!draft?.slug}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
