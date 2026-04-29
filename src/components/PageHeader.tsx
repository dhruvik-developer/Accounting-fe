import { ReactNode } from 'react';
import { Box, Breadcrumbs, Link, Stack, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Link as RouterLink } from 'react-router-dom';

export type Crumb = { label: string; to?: string };

type Props = {
  title: string;
  subtitle?: ReactNode;
  crumbs?: Crumb[];
  /** Right-aligned action cluster (buttons, chips, etc.) */
  actions?: ReactNode;
  /** Optional filter / secondary row below the title. */
  filters?: ReactNode;
};

export default function PageHeader({ title, subtitle, crumbs, actions, filters }: Props) {
  return (
    <Box sx={{ mb: 2 }}>
      {crumbs && crumbs.length > 0 && (
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 0.5, '& a': { fontSize: 12 } }}>
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            if (last || !c.to) {
              return <Typography key={i} variant="caption" color="text.secondary">{c.label}</Typography>;
            }
            return (
              <Link key={i} component={RouterLink} to={c.to} underline="hover" color="text.secondary">
                {c.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1" noWrap sx={{ fontSize: { xs: 20, md: 22 } }}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        {actions && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            {actions}
          </Stack>
        )}
      </Stack>

      {filters && (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {filters}
        </Box>
      )}
    </Box>
  );
}
