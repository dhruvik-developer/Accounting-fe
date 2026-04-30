import { useEffect, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  InputAdornment, Stack, TextField, Typography,
} from '@mui/material';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { api } from '@/app/api';
import { appPath } from '@/app/basePath';
import { notify } from '@/components/Notifier';
import { checkoutRoute } from './checkoutNavigation';
import { openRazorpayCheckout, verifyRazorpayPayment } from './razorpayCheckout';

type Payload = {
  detail: string;
  metric?: 'invoices' | 'users' | 'branches';
  feature?: string;
  limit?: number;
  used?: number;
  plan_slug?: string;
  upgrade_url?: string;
};

type Plan = {
  slug: string; name: string;
  price_monthly: number;
  max_branches: number; max_users: number; max_invoices_per_month: number;
  features: Record<string, any>;
};

/**
 * Global upgrade modal.
 *
 * Listens to the `upgrade-required` CustomEvent dispatched by the axios 402
 * interceptor. Offers a one-click upgrade to the next plan that clears the
 * triggering constraint.
 */
export default function UpgradeModal() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [couponInfo, setCouponInfo] = useState<any>(null);
  const [couponErr, setCouponErr] = useState('');

  useEffect(() => {
    const handler = (e: Event) => setPayload((e as CustomEvent<Payload>).detail);
    window.addEventListener('upgrade-required', handler);
    return () => window.removeEventListener('upgrade-required', handler);
  }, []);

  useEffect(() => {
    if (payload && plans.length === 0) {
      api.get('/billing/plans/').then(r => setPlans(r.data.results ?? r.data)).catch(() => {});
    }
  }, [payload, plans.length]);

  if (!payload) return null;

  const sortedPlans = [...plans].sort((a, b) => a.price_monthly - b.price_monthly);
  const targetPlan = pickTargetPlan(sortedPlans, payload);

  const validateCoupon = async () => {
    setCouponErr(''); setCouponInfo(null);
    if (!coupon.trim() || !targetPlan) return;
    try {
      const r = await api.post('/billing/apply-coupon/', {
        code: coupon.trim().toUpperCase(),
        plan_slug: targetPlan.slug,
        cycle: 'monthly',
      });
      setCouponInfo(r.data.coupon);
    } catch (e: any) {
      setCouponErr(e?.response?.data?.code || e?.response?.data?.detail || 'Invalid coupon');
    }
  };

  const upgrade = async () => {
    if (!targetPlan) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        plan_slug: targetPlan.slug,
        billing_cycle: 'monthly',
      };
      // Only forward the coupon when one was actually validated — otherwise
      // backend gets `coupon_code: undefined` which serializes weirdly.
      if (couponInfo?.code) body.coupon_code = couponInfo.code;
      const r = await api.post('/billing/subscription/upgrade/', body);
      const { short_url, mode } = r.data ?? {};
      if (mode === 'live_order') {
        const payment = await openRazorpayCheckout(r.data);
        await verifyRazorpayPayment(payment);
        notify({ severity: 'success', message: 'Payment verified. Plan updated successfully.' });
        setPayload(null);
        setCoupon(''); setCouponInfo(null);
        location.href = appPath('/billing/settings');
      } else if (mode === 'live' && short_url && /^https?:\/\//.test(short_url)) {
        setPayload(null);
        setCoupon(''); setCouponInfo(null);
        // Razorpay-hosted checkout — full redirect.
        location.href = short_url;
      } else if (short_url) {
        setPayload(null);
        setCoupon(''); setCouponInfo(null);
        // Stub or in-app checkout URL — strip origin if present so the SPA
        // navigates rather than full-reloading.
        location.href = appPath(checkoutRoute(short_url));
      } else {
        setPayload(null);
        setCoupon(''); setCouponInfo(null);
        notify({ severity: 'success', message: mode === 'no_change' ? 'This is already your current plan.' : 'Plan updated.' });
        location.href = appPath('/billing/settings');
      }
    } catch (e: any) {
      notify({
        severity: e?.message === 'Payment cancelled.' ? 'warning' : 'error',
        message: e?.message || 'Payment failed.',
      });
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={() => setPayload(null)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WorkspacePremiumOutlinedIcon color="primary" />
        Upgrade required
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>{payload.detail}</Typography>
        {payload.metric && payload.limit != null && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Used <b>{payload.used}</b> of <b>{payload.limit}</b> {payload.metric} on your{' '}
            {payload.plan_slug} plan this period.
          </Typography>
        )}
        {payload.feature && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <b>{labelFeature(payload.feature)}</b> is included from{' '}
            {targetPlan?.name ?? 'a higher'} plan and up.
          </Typography>
        )}

        {targetPlan && (
          <Box sx={{
            border: 1, borderColor: 'divider', borderRadius: 1.5, p: 2,
            background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}10, ${t.palette.secondary.main}10)`,
          }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6" sx={{ flex: 1 }}>{targetPlan.name}</Typography>
              <Chip size="small" label={`₹${targetPlan.price_monthly.toLocaleString('en-IN')} / mo`} color="primary" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {targetPlan.max_branches || '∞'} branches · {targetPlan.max_users || '∞'} users ·{' '}
              {targetPlan.max_invoices_per_month
                ? `${targetPlan.max_invoices_per_month.toLocaleString('en-IN')} invoices/mo`
                : '∞ invoices'}
            </Typography>
          </Box>
        )}

        {targetPlan && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Have a coupon?"
              value={coupon}
              onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponInfo(null); setCouponErr(''); }}
              InputProps={{ startAdornment: <InputAdornment position="start"><LocalOfferOutlinedIcon fontSize="small" /></InputAdornment> }}
              error={!!couponErr}
              helperText={couponErr || (couponInfo ? `You save ${couponInfo.discount_pct ? couponInfo.discount_pct + '%' : '₹' + (couponInfo.computed_discount_paise / 100)} on this plan.` : '')}
            />
            <Button size="small" variant="outlined" onClick={validateCoupon} disabled={!coupon.trim()}>Apply</Button>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPayload(null)}>Not now</Button>
        <Button
          variant="contained"
          onClick={upgrade}
          disabled={submitting || !targetPlan}
        >
          {submitting ? 'Upgrading…' : `Upgrade to ${targetPlan?.name ?? '…'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function pickTargetPlan(sorted: Plan[], p: Payload): Plan | null {
  // Pick the cheapest plan that clears the triggering constraint.
  const current = sorted.find(x => x.slug === p.plan_slug);
  const idx = current ? sorted.indexOf(current) : -1;
  const candidates = sorted.slice(idx + 1);

  for (const plan of candidates) {
    if (p.metric === 'invoices' && (plan.max_invoices_per_month === 0 || plan.max_invoices_per_month > (p.used ?? 0))) return plan;
    if (p.metric === 'users' && (plan.max_users === 0 || plan.max_users > (p.used ?? 0))) return plan;
    if (p.metric === 'branches' && (plan.max_branches === 0 || plan.max_branches > (p.used ?? 0))) return plan;
    if (p.feature && plan.features?.[p.feature]) return plan;
  }
  return candidates[0] ?? null;
}

function labelFeature(key: string) {
  return ({
    designer: 'Template Designer',
    reports_advanced: 'Advanced reports (GST, P&L, etc.)',
    rbac: 'Custom Roles & Permissions',
    api: 'Public API access',
    e_invoice: 'E-invoice integration',
    multi_state: 'Multi-state GST',
    sso: 'Single Sign-On',
  } as Record<string, string>)[key] ?? key;
}
