/**
 * Route guard that hides a page if the current branch's preset doesn't
 * enable the requested module. Pairs with FeatureGate (plan-driven gate)
 * — both must allow the module before children render.
 *
 * Use it in App.tsx routes:
 *   <Route path="reports"
 *          element={<Guarded>
 *            <FeatureGate feature="module_reports_basic">
 *              <BranchModuleGate module="module_reports">
 *                <Reports />
 *              </BranchModuleGate>
 *            </FeatureGate>
 *          </Guarded>}
 *   />
 *
 * Failure mode = polite redirect to dashboard with a chip explaining why,
 * so a retail-outlet user clicking a stale bookmark doesn't see a blank
 * "no permission" screen.
 */
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useBranchModules } from '@/hooks/useBranchModules';

type Props = {
  module: string;
  children: React.ReactNode;
};

export default function BranchModuleGate({ module, children }: Props) {
  const { isModuleAllowed, activeBranch, loaded } = useBranchModules();
  // Until branches load we render optimistically — same fail-open the
  // sidebar does. Avoids a flash-of-empty-page during navigation.
  if (!loaded) return <>{children}</>;
  if (isModuleAllowed(module)) return <>{children}</>;

  return (
    <Box sx={{ p: 3, maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Alert severity="info">
        <AlertTitle>Not enabled for this branch</AlertTitle>
        This module is hidden at <strong>{activeBranch?.name || 'the selected branch'}</strong>.
        Switch to a branch that has it enabled, or ask your HO admin to enable
        it from <em>Settings → Branches → Module access</em>.
        <Box sx={{ mt: 1.5 }}>
          <Button component={RouterLink} to="/dashboard" variant="contained" size="small">
            Back to dashboard
          </Button>
        </Box>
      </Alert>
    </Box>
  );
}
