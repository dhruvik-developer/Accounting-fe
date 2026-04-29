import { useEffect, useState } from 'react';
import { Button, Chip, Grid, MenuItem, TextField } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useNavigate } from 'react-router-dom';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import Can from '@/components/Can';
import EmptyState from '@/components/EmptyState';

export default function Invoices() {
  const [rows, setRows] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', party: '', status: '', branch: '', payment_status: '' });
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const load = () => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    api.get('/sales/invoices/', { params })
      .then(r => setRows(r.data.results ?? r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/parties/').then(r => setParties(r.data.results ?? r.data)).catch(() => setParties([]));
    api.get('/branches/').then(r => setBranches(r.data.results ?? r.data)).catch(() => setBranches([]));
  }, []);

  const cols: GridColDef[] = [
    { field: 'number', headerName: 'Number', width: 150 },
    { field: 'date', headerName: 'Date', width: 110 },
    { field: 'party_name', headerName: 'Customer', flex: 1, minWidth: 180 },
    { field: 'grand_total', headerName: 'Total', width: 120, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => v == null ? '' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    { field: 'amount_paid', headerName: 'Paid', width: 120, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => v == null ? '' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    { field: 'status', headerName: 'Status', width: 140,
      renderCell: (p) => <StatusPill status={p.value} /> },
  ];

  const filterRow = (
    <Grid container spacing={1.5} sx={{ width: '100%' }}>
      <Grid item xs={6} md={2}><TextField fullWidth size="small" type="date" label="From" value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
      <Grid item xs={6} md={2}><TextField fullWidth size="small" type="date" label="To" value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
      <Grid item xs={12} md={2}>
        <TextField select fullWidth size="small" label="Customer" value={filters.party} onChange={e => setFilters({ ...filters, party: e.target.value })}>
          <MenuItem value="">All</MenuItem>
          {parties.map((party) => <MenuItem key={party.id} value={party.id}>{party.name}</MenuItem>)}
        </TextField>
      </Grid>
      <Grid item xs={12} md={2}>
        <TextField select fullWidth size="small" label="Status" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
          <MenuItem value="">All</MenuItem>
          {['draft', 'issued', 'partial', 'paid', 'cancelled'].map(s =>
            <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
        </TextField>
      </Grid>
      <Grid item xs={12} md={2}>
        <TextField select fullWidth size="small" label="Branch" value={filters.branch} onChange={e => setFilters({ ...filters, branch: e.target.value })}>
          <MenuItem value="">All</MenuItem>
          {branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.code} — {branch.name}</MenuItem>)}
        </TextField>
      </Grid>
      <Grid item xs={12} md={2}>
        <Button fullWidth size="small" variant="outlined" startIcon={<FilterListIcon />} onClick={load}>Apply</Button>
      </Grid>
    </Grid>
  );

  return (
    <>
      <PageHeader
        title="Sales Invoices"
        crumbs={[{ label: 'Sales', to: '/sales/invoices' }, { label: 'Invoices' }]}
        subtitle={rows.length ? `${rows.length} invoice${rows.length > 1 ? 's' : ''}` : undefined}
        actions={
          <Can permission="sales.invoice.create">
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => nav('/sales/invoices/new')}>
              New Invoice
            </Button>
          </Can>
        }
        filters={filterRow}
      />

      <DataTable
        id="sales.invoices"
        rows={rows}
        columns={cols}
        loading={loading}
        getRowId={(r) => r.id}
        onRowClick={(p) => nav(`/sales/invoices/${p.row.id}`)}
        emptyState={
          <EmptyState
            title="No invoices yet"
            body="Create your first sales invoice — it takes under a minute."
            action={<Can permission="sales.invoice.create"><Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => nav('/sales/invoices/new')}>New Invoice</Button></Can>}
          />
        }
        sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
      />
    </>
  );
}
