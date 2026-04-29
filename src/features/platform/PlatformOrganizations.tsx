import { useEffect, useState } from 'react';
import { Box, Button, Chip, Tooltip } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/app/api';
import { startImpersonation } from '@/app/impersonation';
import PageHeader from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import EmptyState from '@/components/EmptyState';

type Org = {
  id: string; name: string; gstin: string; state_code: string;
  created_at: string;
  plan_slug: string; plan_name: string; status: string; billing_cycle: string;
  mrr_paise: number; user_count: number; branch_count: number; invoice_count_30d: number;
};

const fmtINR = (paise: number) => `₹${Math.round((paise || 0) / 100).toLocaleString('en-IN')}`;

export default function PlatformOrganizations() {
  const [rows, setRows] = useState<Org[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    setLoading(true);
    api.get('/platform/organizations/')
      .then(r => setRows(r.data.results ?? r.data))
      .finally(() => setLoading(false));
  }, []);

  const cols: GridColDef[] = [
    { field: 'name', headerName: 'Organization', flex: 1, minWidth: 180 },
    {
      field: 'plan_slug', headerName: 'Plan', width: 120,
      renderCell: (p) => p.row.plan_slug
        ? <Chip size="small" label={p.row.plan_name || p.row.plan_slug} color={p.row.plan_slug === 'free' ? 'default' : 'primary'} />
        : <Chip size="small" label="—" />,
    },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: (p) => <StatusPill status={p.value} />,
    },
    {
      field: 'mrr_paise', headerName: 'MRR', width: 110, align: 'right', headerAlign: 'right',
      valueFormatter: (v) => fmtINR(Number(v || 0)),
    },
    { field: 'user_count', headerName: 'Users', width: 80, align: 'right', headerAlign: 'right' },
    { field: 'branch_count', headerName: 'Branches', width: 90, align: 'right', headerAlign: 'right' },
    { field: 'invoice_count_30d', headerName: 'Inv 30d', width: 90, align: 'right', headerAlign: 'right' },
    { field: 'gstin', headerName: 'GSTIN', width: 160 },
    {
      field: 'created_at', headerName: 'Joined', width: 120,
      valueFormatter: (v) => (v as string)?.slice(0, 10) ?? '',
    },
    {
      field: 'actions', headerName: '', width: 130, sortable: false, filterable: false,
      renderCell: (p) => (
        <Tooltip title="Open this organization as Super Admin (audited)">
          <Button
            size="small"
            startIcon={<LoginOutlinedIcon fontSize="small" />}
            onClick={(e) => {
              e.stopPropagation();
              startImpersonation(p.row.id, p.row.name, loc.pathname);
            }}
          >
            Open as
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Organizations"
        subtitle={rows.length ? `${rows.length} organization${rows.length > 1 ? 's' : ''}` : undefined}
      />
      <DataTable
        id="platform.orgs"
        rows={rows}
        columns={cols}
        loading={loading}
        getRowId={(r) => r.id}
        onRowClick={(p) => nav(`/platform/organizations/${p.row.id}`)}
        emptyState={<EmptyState title="No organizations yet" body="New sign-ups will appear here." />}
        sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
      />
    </Box>
  );
}
