import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, TextField,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';

type Coupon = {
  id: string; code: string; description: string;
  discount_pct: number; discount_paise: number;
  valid_until: string | null;
  max_redemptions: number; redemptions_count: number;
  is_active: boolean; created_at: string;
};

export default function PlatformCoupons() {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState({ code: '', description: '', discount_pct: 0, discount_paise: 0, max_redemptions: 0 });

  const load = () => {
    setLoading(true);
    api.get('/platform/coupons/').then(r => setRows(r.data.results ?? r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    try {
      await api.post('/platform/coupons/', {
        code: draft.code.toUpperCase(),
        description: draft.description,
        discount_pct: draft.discount_pct,
        discount_paise: draft.discount_paise,
        max_redemptions: draft.max_redemptions,
        is_active: true,
      });
      setOpen(false);
      setDraft({ code: '', description: '', discount_pct: 0, discount_paise: 0, max_redemptions: 0 });
      load();
    } catch (e: any) { setErr(JSON.stringify(e?.response?.data || e?.message || 'Failed')); }
  };

  const cols: GridColDef[] = [
    { field: 'code', headerName: 'Code', width: 160 },
    { field: 'description', headerName: 'Description', flex: 1, minWidth: 180 },
    { field: 'discount_pct', headerName: '%', width: 70, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => v ? `${v}%` : '—' },
    { field: 'discount_paise', headerName: 'Flat', width: 90, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => v ? `₹${Math.round(Number(v) / 100).toLocaleString('en-IN')}` : '—' },
    { field: 'redemptions_count', headerName: 'Used', width: 80, align: 'right', headerAlign: 'right' },
    { field: 'max_redemptions', headerName: 'Max', width: 80, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => Number(v || 0) === 0 ? '∞' : String(v) },
    {
      field: 'is_active', headerName: 'Status', width: 100,
      renderCell: (p) => <Chip size="small" color={p.value ? 'success' : 'default'} label={p.value ? 'active' : 'disabled'} />,
    },
    {
      field: 'valid_until', headerName: 'Valid until', width: 130,
      valueFormatter: (v) => (v as string)?.slice(0, 10) || '—',
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Coupons"
        subtitle={`${rows.length} coupon${rows.length > 1 ? 's' : ''}`}
        actions={<Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>New coupon</Button>}
      />
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      <DataTable id="platform.coupons" rows={rows} columns={cols} loading={loading} getRowId={(r) => r.id} />

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create coupon</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}><TextField fullWidth label="Code" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value.toUpperCase() })} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Max redemptions (0 = ∞)" value={draft.max_redemptions} onChange={e => setDraft({ ...draft, max_redemptions: Number(e.target.value) })} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Discount %" value={draft.discount_pct} onChange={e => setDraft({ ...draft, discount_pct: Number(e.target.value) })} inputProps={{ min: 0, max: 100 }} /></Grid>
            <Grid item xs={6}><TextField fullWidth type="number" label="Flat discount (paise)" value={draft.discount_paise} onChange={e => setDraft({ ...draft, discount_paise: Number(e.target.value) })} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!draft.code}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
