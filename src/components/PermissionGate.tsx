/**
 * Route guard that shows a polite "no access" panel when the user's role
 * lacks the required permission. Pairs with BranchModuleGate (branch
 * visibility) and FeatureGate (plan visibility) — different layers of
 * the same access matrix.
 *
 * Use in App.tsx:
 *   <Route path="settings"
 *          element={<Guarded><PermissionGate code="settings.business.view"><Settings /></PermissionGate></Guarded>} />
 */
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useMyPermissions } from '@/hooks/useMyPermissions';

type Props = {
  code: string;
  children: React.ReactNode;
};

export default function PermissionGate({ code, children }: Props) {
  const { hasPermission, loaded } = useMyPermissions();
  if (!loaded) return <>{children}</>;
  if (hasPermission(code)) return <>{children}</>;

  return (
    <Box sx={{ p: 3, maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Alert severity="warning">
        <AlertTitle>Not allowed for your role</AlertTitle>
        Your role doesn't include <code>{code}</code>. Ask the owner / admin
        to assign you a role that has it, or to grant this permission on
        your current role from <em>Team → Roles</em>.
        <Box sx={{ mt: 1.5 }}>
          <Button component={RouterLink} to="/dashboard" variant="contained" size="small">
            Back to dashboard
          </Button>
        </Box>
      </Alert>
    </Box>
  );
}
