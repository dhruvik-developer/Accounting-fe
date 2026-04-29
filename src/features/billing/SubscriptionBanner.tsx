import { useEffect, useState } from 'react';
import { Alert, Button, LinearProgress, Stack } from '@mui/material';
import { api } from '@/app/api';

type Subscription = {
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'downgraded';
  plan: { slug: string; name: string };
  trial_ends_at: string | null;
};

/**
 * Open the in-app UpgradeModal (mounted at the app shell) instead of
 * navigating to the marketing /pricing page — that page pushes already-
 * authenticated users into the signup wizard, which feels like "create a
 * new account" even though they just want to upgrade their existing plan.
 */
function openUpgradeModal(reason: string) {
  window.dispatchEvent(new CustomEvent('upgrade-required', {
    detail: { detail: reason },
  }));
}

const TRIAL_LENGTH_DAYS = 14;

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

/**
 * Trial-countdown / past-due / cancelled banner, with urgency tiers:
 *   14..11d left → info    ("13 days of Pro trial left")
 *   10..4d  left → info    ("10 days of Pro trial left"), slight nudge
 *   3..1d   left → warning ("Trial ends in 2 days")
 *   ≤0d         → error   ("Trial ended — read-only until you upgrade")
 * past_due     → error
 * cancelled    → warning
 */
export default function SubscriptionBanner() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    api.get('/billing/subscription/')
      .then(r => setSub(r.data))
      .catch(() => setSub(null));
  }, []);

  if (!sub || hidden) return null;

  const days = daysUntil(sub.trial_ends_at);
  let severity: 'info' | 'warning' | 'error' | null = null;
  let msg = '';
  let showProgress = false;

  if (sub.status === 'trial') {
    if (days == null) return null;
    if (days <= 0) { severity = 'error'; msg = `Your ${sub.plan.name} trial has ended. Upgrade to keep creating invoices.`; }
    else if (days <= 3) { severity = 'warning'; msg = `Trial ends in ${days} day${days === 1 ? '' : 's'}. Don't lose your data.`; showProgress = true; }
    else if (days <= 10) { severity = 'info'; msg = `${days} days of ${sub.plan.name} trial left.`; showProgress = true; }
    else { severity = 'info'; msg = `You're on a ${sub.plan.name} trial — ${days} days left.`; showProgress = true; }
  } else if (sub.status === 'past_due') {
    severity = 'error'; msg = 'Your last payment failed. Update billing to keep your plan active.';
  } else if (sub.status === 'cancelled') {
    severity = 'warning'; msg = 'Your subscription is cancelled. Re-subscribe anytime to resume.';
  } else {
    return null;
  }

  const pct = days == null ? 0 : Math.max(0, Math.min(100, ((TRIAL_LENGTH_DAYS - days) / TRIAL_LENGTH_DAYS) * 100));

  return (
    <Alert
      severity={severity}
      sx={{
        borderRadius: 0,
        py: 0.5,
        alignItems: 'center',
        px: { xs: 2, md: 3 },
      }}
      action={
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant={severity === 'error' || severity === 'warning' ? 'contained' : 'text'}
            onClick={() => openUpgradeModal(msg)}
          >
            Upgrade
          </Button>
          {severity !== 'error' && (
            <Button size="small" color="inherit" onClick={() => setHidden(true)}>Dismiss</Button>
          )}
        </Stack>
      }
    >
      <Stack spacing={0.5} sx={{ minWidth: 280 }}>
        <span>{msg}</span>
        {showProgress && (
          <LinearProgress
            variant="determinate"
            value={pct}
            color={severity === 'warning' ? 'warning' : 'primary'}
            sx={{ height: 4, borderRadius: 2 }}
          />
        )}
      </Stack>
    </Alert>
  );
}
