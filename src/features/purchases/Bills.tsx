import { useEffect, useState } from 'react';
import { Box, Button, Chip, Grid, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { api } from '@/app/api';
import Can from '@/components/Can';

const STATUS_COLOR: Record<string, any> = {
  draft: 'default', issued: 'info', partial: 'warning', paid: 'success', cancelled: 'error',
};

export default function Bills() {
  const [rows, setRows] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', party: '', status: '', branch: '', payment_status: '' });
  const nav = useNavigate();
  const load = () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    api.get('/purchases/bills/', { params }).then(r => setRows(r.data.results ?? r.data));
  };
  useEffect(() => {
    load();
    api.get('/parties/').then(r => setParties(r.data.results ?? r.data)).catch(() => setParties([]));
    api.get('/branches/').then(r => setBranches(r.data.results ?? r.data)).catch(() => setBranches([]));
  }, []);

  const cols: GridColDef[] = [
    { field: 'number', headerName: 'Number', width: 140 },
    { field: 'supplier_invoice_number', headerName: 'Supplier Inv #', width: 160 },
    { field: 'date', headerName: 'Date', width: 120 },
    { field: 'party_name', headerName: 'Supplier', flex: 1 },
    { field: 'grand_total', headerName: 'Total', width: 130, align: 'right', headerAlign: 'right' },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => <Chip size="small" label={p.value} color={STATUS_COLOR[p.value] || 'default'} />,
    },
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Purchase Bills</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={load}>Apply Filters</Button>
          <Can permission="purchase.bill.create">
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => nav('/purchases/bills/new')}>
              New Bill
            </Button>
          </Can>
        </Stack>
      </Stack>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}><TextField fullWidth size="small" type="date" label="From" value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={12} md={2}><TextField fullWidth size="small" type="date" label="To" value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth size="small" label="Supplier" value={filters.party} onChange={e => setFilters({ ...filters, party: e.target.value })}>
              <MenuItem value="">All</MenuItem>
              {parties.map((party) => <MenuItem key={party.id} value={party.id}>{party.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}><TextField fullWidth size="small" label="Status" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} /></Grid>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth size="small" label="Branch" value={filters.branch} onChange={e => setFilters({ ...filters, branch: e.target.value })}>
              <MenuItem value="">All</MenuItem>
              {branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.code} - {branch.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth size="small" label="Payment" value={filters.payment_status} onChange={e => setFilters({ ...filters, payment_status: e.target.value })}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="unpaid">Unpaid</MenuItem>
              <MenuItem value="partial">Partial</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>
      <Paper>
        <DataGrid
          autoHeight rows={rows} columns={cols} getRowId={(r) => r.id}
          onRowClick={(p) => nav(`/purchases/bills/${p.row.id}`)}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Paper>
    </Box>
  );
}
