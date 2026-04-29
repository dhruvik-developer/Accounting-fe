import { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

type Props = {
  /** Override the default inbox icon. */
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  /** Primary CTA (a Button). */
  action?: ReactNode;
  /** Compact variant for table-body / card in-page usage. */
  compact?: boolean;
};

export default function EmptyState({ icon, title, body, action, compact }: Props) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1}
      sx={{
        textAlign: 'center',
        py: compact ? 4 : 8,
        px: 2,
        color: 'text.secondary',
      }}
    >
      <Box
        sx={{
          width: compact ? 40 : 56,
          height: compact ? 40 : 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          bgcolor: 'action.hover',
          color: 'text.secondary',
        }}
      >
        {icon ?? <InboxOutlinedIcon fontSize={compact ? 'small' : 'medium'} />}
      </Box>
      <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>{title}</Typography>
      {body && <Typography variant="body2" sx={{ maxWidth: 420 }}>{body}</Typography>}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Stack>
  );
}
