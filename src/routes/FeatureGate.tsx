import { ReactNode, useEffect, useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { api } from '@/app/api';
import { useBillingAccess } from '@/hooks/useBillingAccess';

type State = 'loading' | 'allowed' | 'blocked';

export default function FeatureGate({
  feature,
  children,
}: {
  feature: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>('loading');
  const { loaded: billingAccessLoaded, canManageBilling } = useBillingAccess();

  useEffect(() => {
    api.get('/billing/feature-flags/')
      .then(r => setState(r.data?.flags?.[feature] ? 'allowed' : 'blocked'))
      .catch(() => setState('blocked'));
  }, [feature]);

  if (state === 'loading') return null;
  if (state === 'blocked') {
    // Open the in-app UpgradeModal so the user stays in the authenticated
    // app — sending them to /pricing kicks them into the marketing/signup
    // flow which feels like creating a new account.
    return (
      <Box sx={{ maxWidth: 760 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>This feature is not enabled in the current plan.</Alert>
        <Typography variant="h5" sx={{ mb: 1 }}>
          {canManageBilling ? 'Upgrade required' : 'Feature not available'}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {canManageBilling
            ? <>The current plan does not include <b>{feature}</b>.</>
            : <>This module is not enabled for this business plan. Ask the owner/admin if your team needs it.</>}
        </Typography>
        {billingAccessLoaded && canManageBilling && (
          <Button
            variant="contained"
            onClick={() => window.dispatchEvent(new CustomEvent('upgrade-required', {
              detail: { detail: `The ${feature} feature is included in a higher plan.`, feature },
            }))}
          >
            View plans
          </Button>
        )}
      </Box>
    );
  }
  return <>{children}</>;
}
