import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, Paper, Stack, Typography,
} from '@mui/material';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';

type Subscription = {
  id: string;
  status: string;
  billing_cycle: 'monthly' | 'annual';
  pending_billing_cycle?: 'monthly' | 'annual' | '';
  plan: { slug: string; name: string; price_monthly: number; price_annual: number };
  pending_plan?: { slug: string; name: string; price_monthly: number; price_annual: number } | null;
};

/**
 * Stub-mode checkout page. In LIVE mode Razorpay's hosted page opens instead
 * and the user never sees this component — the short_url from /upgrade/ takes
 * them directly to Razorpay.
 *
 * This page POSTs to /subscription/stub-confirm/ which routes through the same
 * webhook processor a real subscription.charged event would, so the end state
 * (Subscription active + PlatformInvoice paid) is identical.
 */
export default function UpgradeCheckout() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [err, setErr] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/billing/subscription/')
      .then(r => { if (!cancelled) setSub(r.data); })
      .catch(e => { if (!cancelled) setErr(e?.response?.data?.detail || 'Failed to load subscription'); });
    return () => { cancelled = true; };
  }, [id]);

  const confirm = async () => {
    setPaying(true);
    try {
      await api.post('/billing/subscription/stub-confirm/', {});
      nav('/billing/settings?success=1');
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Payment failed');
      setPaying(false);
    }
  };

  if (!sub) {
    return (
      <Box>
        <PageHeader title="Checkout" crumbs={[{ label: 'Billing', to: '/billing/invoices' }, { label: 'Checkout' }]} />
        {err ? <Alert severity="error">{err}</Alert> : <CircularProgress />}
      </Box>
    );
  }

  const checkoutPlan = sub.pending_plan || sub.plan;
  const checkoutCycle = sub.pending_billing_cycle || sub.billing_cycle;
  const price = checkoutCycle === 'annual' ? checkoutPlan.price_annual : checkoutPlan.price_monthly;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <PageHeader
        title="Confirm your plan"
        subtitle="Dev mode · no card will be charged"
        crumbs={[{ label: 'Billing', to: '/billing/invoices' }, { label: 'Checkout' }]}
      />

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <WorkspacePremiumOutlinedIcon color="primary" />
            <Typography variant="h6" sx={{ flex: 1 }}>{checkoutPlan.name}</Typography>
            <Chip size="small" color="primary" label={checkoutCycle === 'annual' ? 'Annual' : 'Monthly'} />
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" justifyContent="space-between">
            <Typography>Subtotal</Typography>
            <Typography className="num">₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography color="text.secondary" variant="body2">GST</Typography>
            <Typography className="num" color="text.secondary" variant="body2">Included</Typography>
          </Stack>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="h6">Total due today</Typography>
            <Typography variant="h6" className="num">₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography>
          </Stack>
        </CardContent>
      </Card>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockOutlinedIcon fontSize="small" color="action" />
        <Typography variant="body2" color="text.secondary">
          Demo Razorpay checkout is active because live keys are not configured. Dummy key:
          <code> rzp_test_demo_stub</code>. For production, configure <code>RAZORPAY_KEY_ID</code>,
          <code> RAZORPAY_KEY_SECRET</code>, and <code> RAZORPAY_WEBHOOK_SECRET</code> in
          <code> .env</code>.
        </Typography>
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button onClick={() => nav(-1)}>Cancel</Button>
        <Button variant="contained" onClick={confirm} disabled={paying}>
          {paying ? 'Processing…' : `Pay ₹${price.toLocaleString('en-IN')}`}
        </Button>
      </Stack>
    </Box>
  );
}
