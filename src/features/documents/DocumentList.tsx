import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Grid, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';
import { api } from '@/app/api';

const STATUS_COLOR: Record<string, any> = {
  draft: 'default',
  sent: 'info',
  pending_approval: 'warning',
  approved: 'success',
  confirmed: 'success',
  issued: 'info',
  accepted: 'success',
  rejected: 'error',
  partially_billed: 'warning',
  fully_billed: 'success',
  partially_delivered: 'warning',
  fully_delivered: 'success',
  partially_invoiced: 'warning',
  fully_invoiced: 'success',
  partial: 'warning',
  paid: 'success',
  cancelled: 'error',
};

type Props = {
  title: string;
  endpoint: string;
  partyLabel?: string;
  showPaymentStatus?: boolean;
  columns?: GridColDef[];
  createPath?: string;
  detailBasePath?: string;
};

const defaultColumns: GridColDef[] = [
  { field: 'number', headerName: 'Number', width: 150 },
  { field: 'date', headerName: 'Date', width: 120 },
  { field: 'party_name', headerName: 'Party', flex: 1, minWidth: 180 },
  { field: 'grand_total', headerName: 'Total', width: 130, align: 'right', headerAlign: 'right' },
  {
    field: 'status',
    headerName: 'Status',
    width: 160,
    renderCell: (p) => <Chip size="small" label={String(p.value || '').replaceAll('_', ' ')} color={STATUS_COLOR[p.value] || 'default'} />,
  },
];

export default function DocumentList({ title, endpoint, partyLabel = 'Party', showPaymentStatus = false, columns, createPath, detailBasePath }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    party: '',
    status: '',
    branch: '',
    payment_status: '',
  });
  const nav = useNavigate();

  const describeError = (e: any) =>
    e?.response?.data?.detail || JSON.stringify(e?.response?.data) || e?.message || 'Failed to load documents';

  const load = () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    api.get(endpoint, { params })
      .then((r) => {
        setRows(r.data.results ?? r.data);
        setErr('');
      })
      .catch((e) => {
        setRows([]);
        setErr(describeError(e));
      });
  };

  useEffect(() => {
    load();
    api.get('/parties/').then((r) => setParties(r.data.results ?? r.data)).catch(() => setParties([]));
    api.get('/branches/').then((r) => setBranches(r.data.results ?? r.data)).catch(() => setBranches([]));
  }, []);

  const set = (key: string) => (e: any) => setFilters({ ...filters, [key]: e.target.value });

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            Filter by date, {partyLabel.toLowerCase()}, status, branch, and payment status.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load}>Refresh</Button>
          {createPath && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => nav(createPath)}>
              New
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <TextField fullWidth size="small" type="date" label="From" value={filters.date_from} onChange={set('date_from')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField fullWidth size="small" type="date" label="To" value={filters.date_to} onChange={set('date_to')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth size="small" label={partyLabel} value={filters.party} onChange={set('party')}>
              <MenuItem value="">All</MenuItem>
              {parties.map((party) => <MenuItem key={party.id} value={party.id}>{party.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField fullWidth size="small" label="Status" value={filters.status} onChange={set('status')} placeholder="draft / issued" />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth size="small" label="Branch" value={filters.branch} onChange={set('branch')}>
              <MenuItem value="">All</MenuItem>
              {branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.code} - {branch.name}</MenuItem>)}
            </TextField>
          </Grid>
          {showPaymentStatus && (
            <Grid item xs={12} md={2}>
              <TextField select fullWidth size="small" label="Payment" value={filters.payment_status} onChange={set('payment_status')}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="unpaid">Unpaid</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
              </TextField>
            </Grid>
          )}
        </Grid>
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      <Paper>
        <DataGrid
          autoHeight
          rows={rows}
          columns={columns || defaultColumns}
          getRowId={(row) => row.id}
          pageSizeOptions={[25, 50]}
          onRowClick={(params) => {
            if (detailBasePath) nav(`${detailBasePath}/${params.row.id}`);
          }}
          sx={detailBasePath ? { '& .MuiDataGrid-row': { cursor: 'pointer' } } : undefined}
        />
      </Paper>
    </Box>
  );
}
