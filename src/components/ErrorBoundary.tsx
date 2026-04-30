/**
 * Route-level error boundary. Catches render errors from any descendant
 * component so a single buggy module doesn't take the whole SPA to a blank
 * screen. Used in App.tsx around each <Route> child.
 *
 * Strategy:
 *   - Show a friendly fallback with the error message + a "Try again" button
 *     that resets the boundary's error state (forces re-render).
 *   - Log to console.error for dev. In prod you'd swap this for Sentry /
 *     LogRocket / etc.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Button, Stack, Typography, alpha } from '@mui/material';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import { appPath } from '@/app/basePath';

type Props = {
  children: ReactNode;
  /** Override the fallback UI entirely */
  fallback?: ReactNode;
  /** Called once when an error is caught — wire to Sentry here */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Resets the boundary when this prop changes (e.g. route key) */
  resetKey?: string | number;
};

type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep this even in prod — useful for support diagnosing customer reports.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  reset = () => {
    // Dynamic-import failures (deploy-mid-session, Vite HMR with stale chunk
    // hash, transient network blip) leave React.lazy with a *cached rejected*
    // Promise — re-rendering won't retry, only a fresh page load will.
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const message = this.state.error.message || 'Unexpected error';
    const chunkErr = isChunkLoadError(this.state.error);

    return (
      <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Stack alignItems="center" spacing={2} sx={{ textAlign: 'center', maxWidth: 480 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: 2, display: 'grid', placeItems: 'center',
            color: '#FF5252',
            background: (t) => alpha('#FF5252', t.palette.mode === 'dark' ? 0.12 : 0.10),
            border: `1px solid ${alpha('#FF5252', 0.3)}`,
          }}>
            <ErrorOutlineOutlinedIcon fontSize="large" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {chunkErr ? 'New version available' : 'Something went wrong on this page'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {chunkErr
              ? 'The page bundle changed since you opened the tab. Reload to fetch the latest version.'
              : 'The rest of the app is still working. You can try again, or go back to the dashboard.'}
          </Typography>
          <Box sx={{
            width: '100%', mt: 1, p: 1.25, borderRadius: 1,
            bgcolor: (t) => alpha('#FF5252', t.palette.mode === 'dark' ? 0.06 : 0.04),
            border: (t) => `1px solid ${alpha('#FF5252', t.palette.mode === 'dark' ? 0.20 : 0.18)}`,
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 12,
            color: 'text.secondary',
            textAlign: 'left',
            maxHeight: 120, overflow: 'auto',
          }}>
            {message}
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ pt: 0.5 }}>
            <Button startIcon={<RestartAltOutlinedIcon />} variant="contained" onClick={this.reset}>
              {chunkErr ? 'Reload page' : 'Try again'}
            </Button>
            <Button startIcon={<HomeOutlinedIcon />} onClick={() => { window.location.href = appPath('/dashboard'); }}>
              Go to dashboard
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }
}

function isChunkLoadError(err: Error | null): boolean {
  if (!err) return false;
  const msg = `${err.name} ${err.message}`;
  return /ChunkLoadError|Loading chunk \d|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg);
}
