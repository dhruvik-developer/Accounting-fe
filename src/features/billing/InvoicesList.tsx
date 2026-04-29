import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Link, Snackbar } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import EmptyState from '@/components/EmptyState';

type Invoice = {
  id: string;
  number: string;
  period_start: string;
  period_end: string;
  amount: number;
  total: number;
  currency: string;
  status: 'due' | 'paid' | 'failed' | 'refunded';
  razorpay_payment_id: string;
  issued_at: string;
  paid_at: string | null;
  receipt_url: string;
};

const fmt = (s: string) => s ? s.slice(0, 10) : '';

export default function InvoicesList() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useSearchParams();
  const [toast, setToast] = useState(params.get('success') === '1');

  useEffect(() => {
    setLoading(true);
    api.get('/billing/invoices/')
      .then(r => setRows(r.data.results ?? r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => {
        setToast(false);
        params.delete('success');
        setParams(params, { replace: true });
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [toast, params, setParams]);

  const cols: GridColDef[] = [
    {
      field: 'issued_at', headerName: 'Issued', width: 120,
      valueFormatter: (v) => fmt(v as string),
    },
    { field: 'number', headerName: 'Number', width: 180,
      renderCell: (p) => p.row.number || <span style={{ color: '#9CA3AF' }}>—</span> },
    {
      field: 'period_start', headerName: 'Period', width: 200,
      renderCell: (p) => `${fmt(p.row.period_start)} → ${fmt(p.row.period_end)}`,
    },
    {
      field: 'total', headerName: 'Total', width: 140, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => v == null ? '' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => <StatusPill status={p.value} />,
    },
    {
      field: 'receipt_url', headerName: 'Receipt', width: 120, sortable: false,
      renderCell: (p) => p.value
        ? <Link href={p.value} target="_blank" rel="noopener" underline="hover">
            <DownloadOutlinedIcon fontSize="small" /> PDF
          </Link>
        : <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>,
    },
    {
      field: 'razorpay_payment_id', headerName: 'Payment ref', flex: 1, minWidth: 200,
      renderCell: (p) => p.value
        ? <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{p.value}</span>
        : <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>,
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Billing & Invoices"
        crumbs={[{ label: 'Billing' }, { label: 'Invoices' }]}
        subtitle={rows.length ? `${rows.length} invoice${rows.length > 1 ? 's' : ''}` : undefined}
        actions={
          <Button size="small" startIcon={<OpenInNewIcon />} href="/pricing">
            Change plan
          </Button>
        }
      />
      <DataTable
        id="billing.invoices"
        rows={rows}
        columns={cols}
        loading={loading}
        getRowId={(r) => r.id}
        emptyState={
          <EmptyState
            title="No billing history yet"
            body="Invoices will appear here after your first successful payment."
          />
        }
      />
      <Snackbar
        open={toast}
        message="Subscription upgraded — welcome aboard!"
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      />
    </Box>
  );
}
