/**
 * Slide-in drawer used for create / edit forms across the app.
 * Mobile: full-screen sheet. Desktop: 480-560px right rail.
 *
 * Keeps modules consistent without forcing every form to roll its own
 * Dialog/Drawer dance. Footer actions are sticky so submit is always visible.
 *
 *   <FormDrawer
 *     open={open}
 *     title={editing ? 'Edit warehouse' : 'New warehouse'}
 *     subtitle="Track stock per physical location"
 *     onClose={() => setOpen(false)}
 *     onSubmit={handleSubmit}
 *     submitLabel={editing ? 'Save changes' : 'Create'}
 *     submitting={busy}
 *     width={520}
 *   >
 *     <Stack spacing={2}>...form fields...</Stack>
 *   </FormDrawer>
 */
import {
  Box, Button, CircularProgress, Drawer, IconButton, Stack, Typography, alpha,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';

export type FormDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  width?: number;
  onClose: () => void;
  onSubmit?: (e?: React.FormEvent) => void | Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  /** Hides the sticky footer entirely — useful when the form has its own actions */
  hideFooter?: boolean;
  /** Optional secondary action shown on the left of the footer (e.g. "Save as draft") */
  secondaryAction?: React.ReactNode;
  children: React.ReactNode;
};

export default function FormDrawer({
  open, title, subtitle, width = 520,
  onClose, onSubmit,
  submitLabel = 'Save', cancelLabel = 'Cancel',
  submitting = false, submitDisabled = false,
  hideFooter = false, secondaryAction,
  children,
}: FormDrawerProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submitDisabled) return;
    onSubmit?.(e);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={submitting ? undefined : onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: width },
          display: 'flex', flexDirection: 'column',
          backgroundImage: 'none',
        },
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        {/* Header */}
        <Box sx={{
          p: 2, pb: 1.5,
          borderBottom: 1, borderColor: 'divider',
          background: (t: Theme) => t.palette.mode === 'dark'
            ? `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.06)}, transparent)`
            : 'transparent',
        }}>
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{title}</Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            <IconButton size="small" onClick={onClose} disabled={submitting}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {children}
        </Box>

        {/* Footer */}
        {!hideFooter && (
          <Box sx={{
            p: 2, borderTop: 1, borderColor: 'divider',
            display: 'flex', alignItems: 'center', gap: 1,
            position: 'sticky', bottom: 0, bgcolor: 'background.paper',
          }}>
            <Box sx={{ flex: 1 }}>{secondaryAction}</Box>
            <Button onClick={onClose} disabled={submitting}>{cancelLabel}</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || submitDisabled}
              startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {submitLabel}
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
