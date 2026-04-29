import { Alert, AlertTitle, Box } from '@mui/material';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';

/**
 * Shown on pages backed by an in-memory / localStorage mock service. Makes it
 * obvious that data isn't really persisted server-side, so users don't lose
 * work expecting a real backend.
 */
export default function DemoBanner({ module }: { module: string }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        severity="info"
        icon={<ScienceOutlinedIcon fontSize="small" />}
        sx={{ alignItems: 'center' }}
      >
        <AlertTitle sx={{ mb: 0, fontWeight: 700 }}>{module} — demo data</AlertTitle>
        Stored in your browser only. Records reset when local storage is cleared and aren't visible to other users.
      </Alert>
    </Box>
  );
}
