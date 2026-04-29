import { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import { notify } from '@/components/Notifier';

type Inv = {
  id: string; business_name: string; number: string;
  period_start: string; period_end: string;
  amount_paise: number; total_paise: number; total: number;
  currency: string; status: 'due' | 'paid' | 'failed' | 'refunded';
  razorpay_payment_id: string; issued_at: string;
};

const fmtINR = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function PlatformInvoices() {
  const [rows, setRows] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/platform/invoices/')
      .then(r => setRows(r.data.results ?? r.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const retry = async (id: string) => {
    try {
      await api.post(`/platform/invoices/${id}/retry/`);
      notify({ severity: 'success', message: 'Retry dispatched.' });
      load();
    } catch (e: any) {
      notify({ severity: 'error', message: e?.response?.data?.detail || 'Retry failed' });
    }
  };

  const cols: GridColDef[] = [
    {
      field: 'issued_at', headerName: 'Issued', width: 120,
      valueFormatter: (v) => (v as string)?.slice(0, 10) ?? '',
    },
    { field: 'business_name', headerName: 'Organization', flex: 1, minWidth: 180 },
    { field: 'number', headerName: 'Number', width: 140 },
    {
      field: 'total', headerName: 'Total', width: 130, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => fmtINR(Number(v || 0)),
    },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => <StatusPill status={p.value} />,
    },
    {
      field: 'razorpay_payment_id', headerName: 'Payment ref', flex: 1, minWidth: 200,
      renderCell: (p) => <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{p.value || '—'}</span>,
    },
    {
      field: 'actions', headerName: '', width: 110, sortable: false,
      renderCell: (p) => p.row.status !== 'paid' && (
        <Button size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={(e) => { e.stopPropagation(); retry(p.row.id); }}>
          Retry
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Platform invoices"
        subtitle={`${rows.length} record${rows.length > 1 ? 's' : ''}`}
        actions={<Button size="small" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>}
      />
      <DataTable id="platform.invoices" rows={rows} columns={cols} loading={loading} getRowId={(r) => r.id} />
    </Box>
  );
}
