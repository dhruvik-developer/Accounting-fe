import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, MenuItem, Paper, Stack, Tab, Tabs,
  TextField, Typography,
} from '@mui/material';
import { useParams, useLocation } from 'react-router-dom';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { api } from '@/app/api';
import { startImpersonation } from '@/app/impersonation';
import PageHeader from '@/components/PageHeader';
import StatusPill from '@/components/StatusPill';

type Org = {
  id: string; name: string; gstin: string; state_code: string; created_at: string;
  plan_slug: string; plan_name: string; status: string; billing_cycle: string;
  mrr_paise: number; user_count: number; branch_count: number; invoice_count_30d: number;
  owner_email?: string;
};

type Plan = { slug: string; name: string; price_monthly: number };

type FeatureFlag = { id: string; flag_slug: string; value: boolean; expires_at: string | null; note: string };

const fmtINR = (paise: number) => `₹${Math.round((paise || 0) / 100).toLocaleString('en-IN')}`;

export default function PlatformOrgDetail() {
  const { id } = useParams();
  const loc = useLocation();
  const [org, setOrg] = useState<Org | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [tab, setTab] = useState(0);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState<number>(7);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantPlan, setGrantPlan] = useState('');
  const [grantMonths, setGrantMonths] = useState<number>(1);
  const [flagSlug, setFlagSlug] = useState('');
  const [flagValue, setFlagValue] = useState(true);

  const load = async () => {
    try {
      const [o, p, f] = await Promise.all([
        api.get(`/platform/organizations/${id}/`),
        api.get('/platform/plans/'),
        api.get(`/platform/organizations/${id}/feature-flags/`),
      ]);
      setOrg(o.data);
      setPlans((p.data.results ?? p.data) as Plan[]);
      setFlags((f.data.results ?? f.data) as FeatureFlag[]);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Failed to load');
    }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, [id]);

  const extendTrial = async () => {
    try {
      await api.post(`/platform/organizations/${id}/extend-trial/`, { days: extendDays });
      setMsg(`Trial extended by ${extendDays} days.`);
      setExtendOpen(false);
      load();
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Failed to extend trial'); }
  };

  const grant = async () => {
    try {
      await api.post(`/platform/organizations/${id}/grant-plan/`, { plan_slug: grantPlan, months: grantMonths });
      setMsg(`Granted ${grantPlan} for ${grantMonths} month(s).`);
      setGrantOpen(false);
      load();
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Failed to grant plan'); }
  };

  const setFlag = async (slug: string, value: boolean) => {
    try {
      await api.post(`/platform/organizations/${id}/feature-flags/`, { flag_slug: slug, value });
      const f = await api.get(`/platform/organizations/${id}/feature-flags/`);
      setFlags(f.data.results ?? f.data);
      setMsg(`Flag ${slug} ${value ? 'enabled' : 'disabled'}.`);
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Failed to set flag'); }
  };

  if (!org) return err ? <Alert severity="error">{err}</Alert> : null;

  return (
    <Box>
      <PageHeader
        title={org.name}
        subtitle={org.gstin || 'No GSTIN'}
        crumbs={[
          { label: 'Platform', to: '/platform' },
          { label: 'Organizations', to: '/platform/organizations' },
          { label: org.name },
        ]}
        actions={
          <>
            <Button
              size="small"
              startIcon={<LoginOutlinedIcon fontSize="small" />}
              onClick={() => startImpersonation(org.id, org.name, loc.pathname)}
            >
              Open as customer
            </Button>
            <Button size="small" onClick={() => setExtendOpen(true)}>Extend trial</Button>
            <Button size="small" variant="contained" onClick={() => { setGrantPlan(org.plan_slug || 'pro'); setGrantOpen(true); }}>Grant plan</Button>
          </>
        }
      />

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Meta label="Plan" value={<Chip size="small" color={org.plan_slug === 'free' ? 'default' : 'primary'} label={org.plan_name || org.plan_slug} />} />
        <Meta label="Status" value={<StatusPill status={org.status} />} />
        <Meta label="MRR" value={fmtINR(org.mrr_paise)} />
        <Meta label="Users" value={org.user_count} />
        <Meta label="Branches" value={org.branch_count} />
        <Meta label="Invoices 30d" value={org.invoice_count_30d} />
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Overview" />
        <Tab label="Feature flags" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent>
            <Stack spacing={1}>
              <Row k="Owner" v={org.owner_email || '—'} />
              <Row k="GSTIN" v={org.gstin || '—'} />
              <Row k="State code" v={org.state_code || '—'} />
              <Row k="Joined" v={(org.created_at || '').slice(0, 10)} />
              <Row k="Billing cycle" v={org.billing_cycle || '—'} />
            </Stack>
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <TextField size="small" label="Flag slug" value={flagSlug} onChange={e => setFlagSlug(e.target.value)} sx={{ flex: 1 }} />
            <TextField size="small" select label="Value" value={flagValue ? 'on' : 'off'} onChange={e => setFlagValue(e.target.value === 'on')} sx={{ width: 100 }}>
              <MenuItem value="on">Enable</MenuItem>
              <MenuItem value="off">Disable</MenuItem>
            </TextField>
            <Button variant="contained" size="small" disabled={!flagSlug} onClick={() => { setFlag(flagSlug, flagValue); setFlagSlug(''); }}>Save</Button>
          </Stack>
          {flags.length === 0 && <Typography color="text.secondary" variant="body2">No per-org flags set.</Typography>}
          {flags.map(f => (
            <Stack key={f.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75, borderBottom: '1px solid #eee' }}>
              <Typography sx={{ flex: 1 }}>{f.flag_slug}</Typography>
              <Chip size="small" color={f.value ? 'success' : 'default'} label={f.value ? 'ON' : 'OFF'} />
              <Button size="small" onClick={() => setFlag(f.flag_slug, !f.value)}>Toggle</Button>
            </Stack>
          ))}
        </Paper>
      )}

      {/* Extend-trial dialog */}
      <Dialog open={extendOpen} onClose={() => setExtendOpen(false)}>
        <DialogTitle>Extend trial</DialogTitle>
        <DialogContent>
          <TextField type="number" fullWidth autoFocus label="Additional days" value={extendDays} onChange={e => setExtendDays(Number(e.target.value))} inputProps={{ min: 1, max: 180 }} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExtendOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={extendTrial}>Extend</Button>
        </DialogActions>
      </Dialog>

      {/* Grant-plan dialog */}
      <Dialog open={grantOpen} onClose={() => setGrantOpen(false)}>
        <DialogTitle>Grant plan (comp)</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="Plan" value={grantPlan} onChange={e => setGrantPlan(e.target.value)} sx={{ mt: 1, mb: 2 }}>
            {plans.map(p => <MenuItem key={p.slug} value={p.slug}>{p.name}</MenuItem>)}
          </TextField>
          <TextField type="number" fullWidth label="Months" value={grantMonths} onChange={e => setGrantMonths(Number(e.target.value))} inputProps={{ min: 1, max: 36 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrantOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={grant}>Grant</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Meta({ label, value }: { label: string; value: any }) {
  return (
    <Grid item xs={6} sm={4} md={2}>
      <Card variant="outlined">
        <CardContent sx={{ py: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Typography>
          <Box sx={{ mt: 0.5, fontSize: 14, fontWeight: 600 }}>{value}</Box>
        </CardContent>
      </Card>
    </Grid>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">{k}</Typography>
      <Typography variant="body2">{v}</Typography>
    </Stack>
  );
}
