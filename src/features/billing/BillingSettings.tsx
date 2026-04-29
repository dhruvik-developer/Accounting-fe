import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, Grid, MenuItem, Paper, Skeleton,
  Stack, TextField, Tooltip, Typography, alpha,
} from '@mui/material';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';
import StatusPill from '@/components/StatusPill';
import { notify } from '@/components/Notifier';
import { checkoutRoute } from './checkoutNavigation';
import { openRazorpayCheckout, verifyRazorpayPayment } from './razorpayCheckout';

type Subscription = {
  id: string; status: string; billing_cycle: 'monthly' | 'annual';
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  extra_branches?: number;
  plan: {
    slug: string; name: string;
    price_monthly: number; price_annual: number;
    max_branches?: number;
    price_per_extra_branch_paise?: number;
  };
};

type Plan = { slug: string; name: string; price_monthly: number; price_annual: number };

const fmtINR = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function BillingSettings() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [warn, setWarn] = useState('');
  const nav = useNavigate();

  // Change-plan dialog
  const [changeOpen, setChangeOpen] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  const [newCycle, setNewCycle] = useState<'monthly' | 'annual'>('annual');
  const [changingPlan, setChangingPlan] = useState(false);

  // Cancel / retention dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [retentionAvailable, setRetentionAvailable] = useState(false);

  const load = async () => {
    try {
      setErr('');
      const [s, p] = await Promise.all([
        api.get('/billing/subscription/'),
        api.get('/billing/plans/'),
      ]);
      setSub(s.data);
      setPlans(p.data.results ?? p.data);
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Failed to load'); }
  };
  useEffect(() => { load(); }, []);

  const finishUpgradeResponse = async (data: any) => {
    const url = data.short_url as string;

    if (data.mode === 'live_order') {
      const payment = await openRazorpayCheckout(data);
      const verified = await verifyRazorpayPayment(payment);
      setSub(verified.data.subscription);
      setChangeOpen(false);
      await load();
      setMsg('Payment verified. Plan updated successfully.');
      notify({ severity: 'success', message: 'Payment verified. Plan updated successfully.' });
      return;
    }

    if (data.mode === 'live' && url && /^https?:\/\//.test(url)) {
      location.href = url;
      return;
    }

    if (url) {
      nav(checkoutRoute(url));
      return;
    }

    setChangeOpen(false);
    if (data.subscription) setSub(data.subscription);
    await load();
    setMsg(data.mode === 'no_change' ? 'This is already your current plan.' : 'Plan updated.');
  };

  const changePlan = async () => {
    if (!newPlan) return;
    setChangingPlan(true);
    setErr('');
    setWarn('');
    setMsg('');
    try {
      const r = await api.post('/billing/subscription/upgrade/', {
        plan_slug: newPlan, billing_cycle: newCycle,
      });
      await finishUpgradeResponse(r.data);
    } catch (e: any) {
      const text = e?.message === 'Payment cancelled.' ? 'Payment cancelled. Plan was not changed.' : flatten(e);
      if (text.toLowerCase().includes('cancelled')) {
        setWarn(text);
        notify({ severity: 'warning', message: text });
      } else {
        setErr(text);
        notify({ severity: 'error', message: text });
      }
    } finally {
      setChangingPlan(false);
    }
  };

  const openCancel = () => {
    // If retention offer is still available, show it first.
    if (retentionAvailable) { setRetentionOpen(true); return; }
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    try {
      const r = await api.post('/billing/subscription/cancel/', { immediate: false });
      setRetentionAvailable(!!r.data.retention_offer_available);
      setMsg('Your subscription will cancel at the end of the current period.');
      setCancelOpen(false); setRetentionOpen(false); await load();
    } catch (e: any) { setErr(flatten(e)); }
  };

  const acceptRetention = async () => {
    try {
      await api.post('/billing/subscription/retain/');
      setMsg('Retention offer applied — 90 days added. Thanks for staying!');
      setRetentionOpen(false); await load();
    } catch (e: any) { setErr(flatten(e)); setRetentionOpen(false); }
  };

  useEffect(() => {
    // Heuristic: retention offer is first-time only when there's no record.
    // Backend decides definitively; we ask once on mount.
    if (!sub) return;
    setRetentionAvailable(true); // optimistic; backend still gates
  }, [sub?.id]);

  if (!sub) {
    return (
      <Box>
        <PageHeader title="Billing" />
        {err ? <Alert severity="error">{err}</Alert> : <Typography color="text.secondary">Loading…</Typography>}
      </Box>
    );
  }

  const price = sub.billing_cycle === 'annual' ? sub.plan.price_annual : sub.plan.price_monthly;
  const sameSelection = newPlan === sub.plan.slug
    && newCycle === sub.billing_cycle
    && sub.status === 'active'
    && !sub.cancel_at_period_end;

  return (
    <Box>
      <PageHeader
        title="Billing"
        crumbs={[{ label: 'Billing' }, { label: 'Settings' }]}
        actions={<Button startIcon={<RefreshOutlinedIcon />} onClick={load}>Refresh</Button>}
      />

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {warn && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setWarn('')}>{warn}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <UsageByBranch sub={sub} />

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <WorkspacePremiumOutlinedIcon color="primary" />
                <Typography variant="h6" sx={{ flex: 1 }}>{sub.plan.name}</Typography>
                <StatusPill status={sub.status} />
                <Chip size="small" label={sub.billing_cycle === 'annual' ? 'Annual' : 'Monthly'} />
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Stack spacing={0.75}>
                <Row k="Next price" v={fmtINR(price)} />
                <Row k="Period ends" v={(sub.current_period_end || '').slice(0, 10) || '—'} />
                {sub.trial_ends_at && <Row k="Trial ends" v={sub.trial_ends_at.slice(0, 10)} />}
                {sub.cancel_at_period_end && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Subscription will end on {(sub.current_period_end || '').slice(0, 10)}. You can re-activate any time.
                  </Alert>
                )}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button variant="contained" onClick={() => { setNewPlan(sub.plan.slug); setNewCycle(sub.billing_cycle); setChangeOpen(true); }}>Change plan</Button>
                <Button onClick={() => nav('/billing/invoices')}>Past invoices</Button>
                {!sub.cancel_at_period_end && (
                  <Button color="error" onClick={openCancel}>Cancel subscription</Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Billing cycle</Typography>
            <Typography variant="body2" color="text.secondary">
              Switch to annual to save 20%. Mid-cycle changes credit the unused portion of your current plan.
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle1" gutterBottom>Payment method</Typography>
            <Typography variant="body2" color="text.secondary">
              Managed on Razorpay's hosted checkout. A new payment flow is generated each time you change plan.
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Available plans</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Pick a plan and billing cycle. Payment is applied only after Razorpay verifies the transaction.
        </Typography>
        <Grid container spacing={2}>
          {plans.map((p) => {
            const current = p.slug === sub.plan.slug && sub.status === 'active' && !sub.cancel_at_period_end;
            return (
              <Grid item xs={12} sm={6} lg={3} key={p.slug}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack spacing={1.25} sx={{ height: '100%' }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="h6" sx={{ flex: 1 }}>{p.name}</Typography>
                        {current && <Chip size="small" color="primary" label="Current" />}
                      </Stack>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>
                          {fmtINR(p.price_monthly)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">per month</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Annual: {fmtINR(p.price_annual)}
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      <Button
                        fullWidth
                        variant={current ? 'outlined' : 'contained'}
                        disabled={current || changingPlan}
                        onClick={() => { setNewPlan(p.slug); setNewCycle(sub.billing_cycle); setChangeOpen(true); }}
                      >
                        {current ? 'Current plan' : 'Select plan'}
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Change-plan dialog */}
      <Dialog open={changeOpen} onClose={() => setChangeOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Change plan</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField select fullWidth label="Plan" value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                {plans.map(p => (
                  <MenuItem key={p.slug} value={p.slug}>
                    {p.name} — ₹{p.price_monthly.toLocaleString('en-IN')}/mo
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField select fullWidth label="Billing cycle" value={newCycle} onChange={e => setNewCycle(e.target.value as any)}>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="annual">Annual (−20%)</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={changePlan}
            disabled={changingPlan || !newPlan || sameSelection}
          >
            {sameSelection ? 'Current plan' : changingPlan ? 'Opening checkout…' : 'Continue to checkout'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel confirm dialog */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel subscription?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You'll keep full access until <b>{(sub.current_period_end || '').slice(0, 10) || 'end of period'}</b>.
            Nothing is deleted — you can re-subscribe any time.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>Keep subscription</Button>
          <Button color="error" variant="contained" onClick={confirmCancel}>Cancel at period end</Button>
        </DialogActions>
      </Dialog>

      {/* Retention offer dialog */}
      <Dialog open={retentionOpen} onClose={() => setRetentionOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Before you go…</DialogTitle>
        <DialogContent>
          <Paper variant="outlined" sx={{
            p: 2, mb: 2,
            background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}12, ${t.palette.secondary.main}12)`,
          }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Stay with 90 free days</Typography>
            <Typography variant="body2" color="text.secondary">
              We'll add <b>90 days</b> to your current plan — on the house. No charge, no paperwork.
            </Typography>
          </Paper>
          <Typography variant="caption" color="text.secondary">
            This offer is one-time. If you decline it, your subscription will still stay active until
            the end of the current paid period.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={confirmCancel}>No thanks, cancel</Button>
          <Button variant="contained" onClick={acceptRetention}>Keep me + 90 days</Button>
        </DialogActions>
      </Dialog>
    </Box>
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

function flatten(e: any): string {
  const d = e?.response?.data;
  if (!d) return e?.message || 'Request failed';
  if (typeof d === 'string') return d;
  if (d.detail) return d.detail;
  const first = Object.entries(d)[0];
  if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}`;
  return 'Request failed';
}

// ---------- Usage by branch (Phase B) ------------------------------------

type BranchUsageRow = {
  branch_id: string;
  name: string;
  code: string;
  is_default: boolean;
  preset: string;
  invoices_this_month: number;
  invoices_last_30d: number;
  plan_share_paise: number;
  is_paid_seat: boolean;
};

type UsageByBranchResponse = {
  period: string;
  branches: BranchUsageRow[];
  totals: {
    invoices_this_month: number;
    invoices_last_30d: number;
    active_users: number;
    plan_share_paise: number;
    branches_count: number;
    paid_seats: number;
  };
};

type BranchLimitInfo = {
  base_limit: number;          // Plan.max_branches
  extra_purchased: number;     // Subscription.extra_branches
  effective_limit: number;     // base + extra (0 if unlimited)
  used: number;                // current active branches
  seat_price_paise: number;    // Plan.price_per_extra_branch_paise
};

const fmt = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function UsageByBranch({ sub }: { sub: Subscription | null }) {
  const nav = useNavigate();
  const [data, setData] = useState<UsageByBranchResponse | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get<UsageByBranchResponse>('/billing/usage-by-branch/')
      .then((r) => setData(r.data))
      .catch((e) => setErr(flatten(e)));
  }, []);

  // Stack the rows by spend so the most expensive branch is at the top.
  const sorted = useMemo(
    () => (data?.branches || []).slice().sort(
      (a, b) => b.plan_share_paise - a.plan_share_paise,
    ),
    [data],
  );

  if (err) return <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>;
  if (!data) return <Skeleton variant="rounded" height={120} sx={{ mb: 2 }} />;

  const t = data.totals;
  const maxShare = Math.max(...sorted.map((r) => r.plan_share_paise), 1);

  // Seat economics — drives the "Add branch" CTA's price label and the
  // over-limit warning.
  const baseLimit = sub?.plan.max_branches ?? 0;
  const extraPurchased = sub?.extra_branches ?? 0;
  const effectiveLimit = baseLimit === 0 ? 0 : baseLimit + extraPurchased;
  const used = t.branches_count;
  const seatPrice = sub?.plan.price_per_extra_branch_paise ?? 0;
  const overLimit = effectiveLimit > 0 && used >= effectiveLimit;
  const seatsAvailable = effectiveLimit === 0 ? Infinity : Math.max(effectiveLimit - used, 0);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
        <HubOutlinedIcon sx={{ color: 'primary.main' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Usage by branch
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Period {data.period} · {used} of {effectiveLimit === 0 ? '∞' : effectiveLimit} branches
            {' · '}{t.paid_seats} paid seat{t.paid_seats === 1 ? '' : 's'}
            {' · '}{t.active_users} active users
          </Typography>
        </Box>
        <Tooltip
          title={
            overLimit
              ? `Buy a new branch seat for ${fmt(seatPrice)}/${sub?.billing_cycle === 'annual' ? 'yr' : 'mo'}`
              : seatPrice > 0
                ? `Each extra branch is ${fmt(seatPrice)}/${sub?.billing_cycle === 'annual' ? 'yr' : 'mo'}`
                : 'Add a new branch'
          }
        >
          <Button
            startIcon={<AddIcon />} variant={overLimit ? 'contained' : 'outlined'} size="small"
            onClick={() => nav('/branches')}
          >
            {overLimit && seatPrice > 0
              ? `Add branch (+${fmt(seatPrice)})`
              : 'Add branch'}
          </Button>
        </Tooltip>
      </Stack>

      {overLimit && (
        <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }}>
          You're using {used} of {effectiveLimit} branch slots.
          {seatPrice > 0
            ? ` Adding another branch will purchase a seat at ${fmt(seatPrice)}/${sub?.billing_cycle === 'annual' ? 'yr' : 'mo'}, billed on the next cycle.`
            : ' Upgrade to a plan that allows additional branches.'}
        </Alert>
      )}
      {!overLimit && seatsAvailable > 0 && seatsAvailable !== Infinity && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          {seatsAvailable} branch slot{seatsAvailable === 1 ? '' : 's'} remaining on the current plan.
        </Typography>
      )}

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1.35fr 96px 126px', md: '1.4fr 1fr 90px 90px 130px' },
        rowGap: 0.5,
      }}>
        <H>Branch</H>
        <H>Plan share</H>
        <H right hideBelowMd>This month</H>
        <H right hideBelowMd>Last 30d</H>
        <H>Type</H>

        {sorted.map((b) => {
          const pct = (b.plan_share_paise / maxShare) * 100;
          return (
            <Box key={b.branch_id} sx={{ display: 'contents' }}>
              <Cell>
                <Stack>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{b.name}</Typography>
                  <Typography variant="caption" color="text.secondary"
                    sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10 }}>
                    {b.code}
                  </Typography>
                </Stack>
              </Cell>
              <Cell>
                <Stack spacing={0.25}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmt(b.plan_share_paise)}</Typography>
                  <Box sx={{ height: 6, borderRadius: 999,
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                  }}>
                    <Box sx={{
                      height: '100%', width: `${Math.max(2, pct)}%`,
                      borderRadius: 999,
                      background: (t) => `linear-gradient(90deg, ${t.palette.primary.main}, ${alpha(t.palette.primary.main, 0.6)})`,
                    }} />
                  </Box>
                </Stack>
              </Cell>
              <Cell right hideBelowMd>{b.invoices_this_month.toLocaleString('en-IN')}</Cell>
              <Cell right hideBelowMd>{b.invoices_last_30d.toLocaleString('en-IN')}</Cell>
              <Cell>
                {b.is_default ? (
                  <Chip size="small" label="HO · base plan" color="primary" variant="outlined" />
                ) : (
                  <Chip size="small" label="Add-on seat" sx={{
                    height: 22, fontWeight: 700,
                    color: '#FFB300',
                    bgcolor: (t) => alpha('#FFB300', t.palette.mode === 'dark' ? 0.15 : 0.1),
                  }} />
                )}
              </Cell>
            </Box>
          );
        })}

        {/* Total row */}
        <Box sx={{ display: 'contents' }}>
          <Cell strong>Total</Cell>
          <Cell strong>{fmt(t.plan_share_paise)}</Cell>
          <Cell right strong hideBelowMd>{t.invoices_this_month.toLocaleString('en-IN')}</Cell>
          <Cell right strong hideBelowMd>{t.invoices_last_30d.toLocaleString('en-IN')}</Cell>
          <Cell />
        </Box>
      </Box>
    </Paper>
  );
}

function H({ children, right, hideBelowMd }: { children?: React.ReactNode; right?: boolean; hideBelowMd?: boolean }) {
  return (
    <Box sx={{
      display: hideBelowMd ? { xs: 'none', md: 'block' } : 'block',
      px: 1, py: 0.5, fontSize: 11, fontWeight: 700,
      letterSpacing: 0.5, textTransform: 'uppercase',
      color: 'text.secondary', textAlign: right ? 'right' : 'left',
      borderBottom: 1, borderColor: 'divider',
    }}>
      {children}
    </Box>
  );
}

function Cell({ children, right, strong, hideBelowMd }: { children?: React.ReactNode; right?: boolean; strong?: boolean; hideBelowMd?: boolean }) {
  return (
    <Box sx={{
      display: hideBelowMd ? { xs: 'none', md: 'block' } : 'block',
      px: 1, py: 0.75, fontSize: 13,
      textAlign: right ? 'right' : 'left',
      fontWeight: strong ? 700 : 400,
      borderTop: strong ? 1 : 0, borderColor: 'divider',
    }}>
      {children}
    </Box>
  );
}
