import { ReactNode } from 'react';
import { Box, Chip, Stack, Tab, Tabs, Typography, alpha } from '@mui/material';
import { keyframes } from '@emotion/react';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import PlatformGuard, { usePlatformRole } from './PlatformGuard';

type Tab = { to: string; label: string; ownerOnly?: boolean };

const TABS: Tab[] = [
  { to: '/platform', label: 'Overview' },
  { to: '/platform/organizations', label: 'Organizations' },
  { to: '/platform/subscriptions', label: 'Subscriptions' },
  { to: '/platform/invoices', label: 'Invoices' },
  { to: '/platform/dunning', label: 'Dunning' },
  { to: '/platform/plans', label: 'Plans', ownerOnly: true },
  { to: '/platform/coupons', label: 'Coupons', ownerOnly: true },
  { to: '/platform/feature-flags', label: 'Feature flags', ownerOnly: true },
  { to: '/platform/email-templates', label: 'Email templates', ownerOnly: true },
  { to: '/platform/settings', label: 'Settings', ownerOnly: true },
  { to: '/platform/team', label: 'Team', ownerOnly: true },
];

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export default function PlatformLayout({ children }: { children?: ReactNode }) {
  return (
    <PlatformGuard>
      <PlatformLayoutInner>{children}</PlatformLayoutInner>
    </PlatformGuard>
  );
}

function PlatformLayoutInner({ children }: { children?: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const role = usePlatformRole();

  const visible = TABS.filter(t => !t.ownerOnly || role === 'owner');
  const blocked = role !== 'owner' && TABS.some(t =>
    t.ownerOnly && (loc.pathname === t.to || loc.pathname.startsWith(t.to + '/')),
  );

  const active = [...visible].sort((a, b) => b.to.length - a.to.length)
    .find(t => loc.pathname === t.to || loc.pathname.startsWith(t.to + '/'))
    ?? visible[0];

  const isOwner = role === 'owner';
  const accent = isOwner ? '#B388FF' : '#4FC3F7';

  return (
    <Box>
      {/* Premium hero header */}
      <Box sx={{
        position: 'relative',
        mx: { xs: -1.5, sm: -2, md: -3 },
        mt: { xs: -1.5, sm: -2, md: -3 },
        mb: 3,
        px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3 },
        overflow: 'hidden',
        borderBottom: '1px solid',
        borderColor: 'divider',
        background: (t) => t.palette.mode === 'dark'
          ? 'radial-gradient(900px 320px at 0% 0%, rgba(0,230,118,0.10), transparent 60%),'
            + `radial-gradient(700px 280px at 100% 0%, ${alpha(accent, 0.18)}, transparent 65%),`
            + 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
          : `linear-gradient(180deg, ${alpha(accent, 0.06)}, transparent 100%)`,
      }}>
        {/* faint grid */}
        <Box aria-hidden sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: (t) => t.palette.mode === 'dark'
            ? 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),'
              + 'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)'
            : 'linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px),'
              + 'linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse at top left, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top left, black 0%, transparent 70%)',
        }} />

        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ position: 'relative', animation: `${fadeIn} .4s ease-out both` }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: 1.5, display: 'grid', placeItems: 'center', color: '#fff',
            background: `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.5)})`,
            boxShadow: `0 8px 22px ${alpha(accent, 0.45)}`,
          }}>
            <ShieldOutlinedIcon fontSize="small" />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>Platform Console</Typography>
              <Chip
                size="small"
                icon={<VerifiedUserOutlinedIcon sx={{ fontSize: 14 }} />}
                label={isOwner ? 'Software Owner' : 'Software Admin'}
                sx={{
                  height: 22, fontWeight: 700,
                  background: alpha(accent, 0.14),
                  color: accent,
                  border: `1px solid ${alpha(accent, 0.35)}`,
                  '& .MuiChip-icon': { color: accent },
                }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Cross-tenant operations · revenue · subscriptions · billing
            </Typography>
          </Box>
        </Stack>

        {/* Glass tab strip */}
        <Box sx={{
          mt: 2.5, position: 'relative',
          borderRadius: 2, p: 0.5,
          background: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}`,
          display: 'inline-flex', maxWidth: '100%',
        }}>
          <Tabs
            value={active?.to ?? false}
            onChange={(_, v) => nav(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            TabIndicatorProps={{ sx: { display: 'none' } }}
            sx={{
              minHeight: 36,
              '& .MuiTab-root': {
                minHeight: 36, py: 0.5, px: 1.75, mx: 0.25,
                borderRadius: 1.5,
                fontWeight: 600,
                color: 'text.secondary',
                textTransform: 'none',
                transition: 'background .2s ease, color .2s ease',
              },
              '& .MuiTab-root.Mui-selected': {
                color: '#fff',
                background: (t) => t.palette.mode === 'dark'
                  ? `linear-gradient(135deg, ${alpha(accent, 0.32)}, ${alpha(accent, 0.18)})`
                  : `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.7)})`,
                boxShadow: `0 0 0 1px ${alpha(accent, 0.45)} inset, 0 6px 18px ${alpha(accent, 0.32)}`,
              },
              '& .MuiTab-root:hover': {
                background: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
              },
            }}
          >
            {visible.map(t => <Tab key={t.to} label={t.label} value={t.to} />)}
          </Tabs>
        </Box>
      </Box>

      {blocked ? <PlatformNotFound /> : (children ?? <Outlet />)}
    </Box>
  );
}

function PlatformNotFound() {
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <Typography variant="h3" sx={{ fontWeight: 700, color: 'text.secondary' }}>404</Typography>
      <Typography color="text.secondary">Page not found.</Typography>
    </Box>
  );
}
