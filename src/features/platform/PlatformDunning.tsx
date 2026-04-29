import { useEffect, useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import ReplayIcon from '@mui/icons-material/Replay';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import EmptyState from '@/components/EmptyState';
import { notify } from '@/components/Notifier';

type Row = {
  subscription_id: string;
  business_id: string; business_name: string;
  plan_slug: string;
  failed_attempts: number;
  last_payment_at: string | null;
  updated_at: string;
  mrr_paise: number;
};

const fmtINR = (paise: number) => `₹${Math.round((paise || 0) / 100).toLocaleString('en-IN')}`;

export default function PlatformDunning() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const load = () => {
    setLoading(true);
    api.get('/platform/dunning/')
      .then(r => setRows(r.data.rows || []))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const retryInvoices = async (biz: string) => {
    try {
      const inv = await api.get(`/platform/invoices/?status=failed`);
      const failed = ((inv.data.results ?? inv.data) as any[]).filter((i) => i.business === biz);
      if (!failed.length) {
        notify({ severity: 'info', message: 'No failed invoices for this org.' });
        return;
      }
      await api.post(`/platform/invoices/${failed[0].id}/retry/`);
      notify({ severity: 'success', message: 'Retry dispatched.' });
      load();
    } catch (e: any) {
      notify({ severity: 'error', message: e?.response?.data?.detail || 'Retry failed' });
    }
  };

  const cols: GridColDef[] = [
    { field: 'business_name', headerName: 'Organization', flex: 1, minWidth: 200 },
    { field: 'plan_slug', headerName: 'Plan', width: 120 },
    { field: 'failed_attempts', headerName: 'Fails', width: 80, align: 'right', headerAlign: 'right' },
    {
      field: 'mrr_paise', headerName: 'MRR at risk', width: 130, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => fmtINR(Number(v || 0)),
    },
    {
      field: 'last_payment_at', headerName: 'Last paid', width: 130,
      valueFormatter: (v) => (v as string)?.slice(0, 10) || '—',
    },
    {
      field: 'updated_at', headerName: 'Updated', width: 120,
      valueFormatter: (v) => (v as string)?.slice(0, 10) ?? '',
    },
    {
      field: 'actions', headerName: '', width: 200, sortable: false,
      renderCell: (p) => (
        <>
          <Button size="small" onClick={(e) => { e.stopPropagation(); nav(`/platform/organizations/${p.row.business_id}`); }}>Open</Button>
          <Button size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={(e) => { e.stopPropagation(); retryInvoices(p.row.business_id); }}>Retry</Button>
        </>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Dunning queue"
        subtitle={rows.length ? `${rows.length} past-due customer${rows.length > 1 ? 's' : ''}` : undefined}
        actions={<Button size="small" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>}
      />
      {rows.length === 0 && !loading ? (
        <Alert severity="success">All customers are current. Nothing to chase.</Alert>
      ) : (
        <DataTable
          id="platform.dunning"
          rows={rows}
          columns={cols}
          loading={loading}
          getRowId={(r) => r.subscription_id}
          emptyState={<EmptyState title="No past-due subscriptions" body="You're all caught up." />}
        />
      )}
    </Box>
  );
}
