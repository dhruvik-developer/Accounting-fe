import { useEffect, useState } from 'react';
import { Box, Chip } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';

type Sub = {
  id: string; business: string; business_name: string;
  plan_slug: string; plan_name: string; status: string; billing_cycle: string;
  trial_ends_at: string | null; current_period_end: string | null;
  failed_attempts: number; updated_at: string;
};

export default function PlatformSubscriptions() {
  const [rows, setRows] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get('/platform/subscriptions/')
      .then(r => setRows(r.data.results ?? r.data))
      .finally(() => setLoading(false));
  }, []);

  const cols: GridColDef[] = [
    { field: 'business_name', headerName: 'Organization', flex: 1, minWidth: 180 },
    {
      field: 'plan_slug', headerName: 'Plan', width: 110,
      renderCell: (p) => <Chip size="small" color={p.value === 'free' ? 'default' : 'primary'} label={p.row.plan_name || p.value} />,
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => <StatusPill status={p.value} />,
    },
    { field: 'billing_cycle', headerName: 'Cycle', width: 100 },
    {
      field: 'trial_ends_at', headerName: 'Trial ends', width: 120,
      valueFormatter: (v) => (v as string)?.slice(0, 10) || '—',
    },
    {
      field: 'current_period_end', headerName: 'Period ends', width: 120,
      valueFormatter: (v) => (v as string)?.slice(0, 10) || '—',
    },
    { field: 'failed_attempts', headerName: 'Fails', width: 80, align: 'right', headerAlign: 'right' },
    {
      field: 'updated_at', headerName: 'Updated', width: 120,
      valueFormatter: (v) => (v as string)?.slice(0, 10) ?? '',
    },
  ];

  return (
    <Box>
      <PageHeader title="Subscriptions" subtitle={`${rows.length} subscription${rows.length > 1 ? 's' : ''}`} />
      <DataTable
        id="platform.subscriptions"
        rows={rows}
        columns={cols}
        loading={loading}
        getRowId={(r) => r.id}
        onRowClick={(p) => nav(`/platform/organizations/${p.row.business}`)}
        sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
      />
    </Box>
  );
}
