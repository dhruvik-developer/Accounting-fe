import { ReactNode } from 'react';
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { layout } from '@/app/tokens';

/**
 * FormSection — a titled block inside a form. Groups fields visually with a
 * thin rule between them so scanning is fast.
 */
export function FormSection({
  title, description, children,
}: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Box sx={{ width: { xs: '100%', md: 240 }, flexShrink: 0 }}>
          <Typography variant="subtitle1">{title}</Typography>
          {description && <Typography variant="caption" color="text.secondary">{description}</Typography>}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>{children}</Box>
      </Stack>
    </Paper>
  );
}

/**
 * FormLayout — vertical stack of sections with a bottom sticky action bar.
 *
 * The sticky footer is rendered only when `dirty` is true and `actions` is
 * supplied, so forms that haven't been touched stay un-distracting.
 */
export default function FormLayout({
  children, actions, dirty,
}: { children: ReactNode; actions?: ReactNode; dirty?: boolean }) {
  return (
    <Box sx={{ pb: dirty && actions ? `${layout.stickyFooterHeight + 16}px` : 0 }}>
      <Stack spacing={2}>{children}</Stack>
      {actions && (
        <StickyActions show={!!dirty}>{actions}</StickyActions>
      )}
    </Box>
  );
}

/**
 * StickyActions — bottom-fixed bar that slides up when `show` flips true.
 * Used by FormLayout but also exported for standalone usage.
 */
export function StickyActions({ children, show = true }: { children: ReactNode; show?: boolean }) {
  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        zIndex: (t) => t.zIndex.appBar - 1,
        transform: show ? 'translateY(0)' : 'translateY(110%)',
        transition: (t) => t.transitions.create('transform', { duration: t.transitions.duration.short }),
        borderTop: 1, borderColor: 'divider',
        bgcolor: 'background.paper',
        px: { xs: 2, md: 3 }, py: 1.25,
        height: layout.stickyFooterHeight,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: 1,
      }}
    >
      {children}
    </Box>
  );
}

/** Thin visual divider between groups of fields inside a section. */
export function FieldGroupDivider() {
  return <Divider sx={{ my: 2 }} />;
}
