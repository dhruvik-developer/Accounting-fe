import type { ReactNode } from 'react';
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useBillingAccess } from '@/hooks/useBillingAccess';

export default function BillingOwnerGate({ children }: { children: ReactNode }) {
  const { loaded, canManageBilling } = useBillingAccess();

  if (!loaded) return null;
  if (canManageBilling) return <>{children}</>;

  return (
    <Box sx={{ p: 3, maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Alert severity="warning">
        <AlertTitle>Owner/admin only</AlertTitle>
        Billing, SaaS invoices, checkout, and plan upgrades are available only
        to the business owner/admin. Staff can continue using the modules
        enabled for their role.
        <Box sx={{ mt: 1.5 }}>
          <Button component={RouterLink} to="/dashboard" variant="contained" size="small">
            Back to dashboard
          </Button>
        </Box>
      </Alert>
    </Box>
  );
}
